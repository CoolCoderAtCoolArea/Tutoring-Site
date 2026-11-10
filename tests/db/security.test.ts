/**
 * DATABASE SECURITY TESTS
 * These prove the Row Level Security rules work at the DATABASE level —
 * not just that the website hides buttons. Run with: npm run test:db
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addChild, admin, as, createUser, giveHours, pool, rejects } from "./helpers";

let tutorA: string, tutorB: string, pendingTutor: string, adminUser: string;
let parentA: string, parentB: string;
let childA: string, childB: string, childAUser: string;
let bookingA: string, bookingB: string;

async function firstSlot(parent: string, tutor: string, skip = 0) {
  const slots = await as(parent, (q) =>
    q("select * from get_open_slots(now(), now() + interval '7 days', 'math', 'online', '4', $1)", [tutor]),
  );
  return slots[skip].starts_at as Date;
}

beforeAll(async () => {
  tutorA = await createUser({ role: "tutor", name: "Tutor A" });
  tutorB = await createUser({ role: "tutor", name: "Tutor B" });
  pendingTutor = await createUser({ role: "tutor", name: "Pending", approved: false });
  adminUser = await createUser({ role: "admin" });
  parentA = await createUser({ name: "Parent A" });
  parentB = await createUser({ name: "Parent B" });
  await giveHours(tutorA);
  await giveHours(tutorB);
  childA = await addChild(parentA, "Ana");
  childB = await addChild(parentB, "Ben");

  // Child A gets their own login (created by the server in real life).
  childAUser = await createUser({ role: "student" });
  await admin("update students set user_id = $1, username = 'ana_1' where id = $2", [childAUser, childA]);

  // Each family books a session with a different tutor.
  bookingA = (await as(parentA, async (q) =>
    q("select book_session($1, $2, 'math', $3, 'online', 'Needs fractions help') as id", [childA, tutorA, await firstSlot(parentA, tutorA)]),
  ))[0].id;
  bookingB = (await as(parentB, async (q) =>
    q("select book_session($1, $2, 'math', $3, 'online', null) as id", [childB, tutorB, await firstSlot(parentB, tutorB)]),
  ))[0].id;

  // Tutor A writes a session note.
  await as(tutorA, (q) =>
    q("insert into session_notes (booking_id, tutor_id, student_id, worked_on, practice) values ($1, $2, $3, 'Fractions', 'Practice 10 min')", [bookingA, tutorA, childA]),
  );
});

afterAll(async () => {
  await pool.end();
});

describe("sign-up and roles", () => {
  it("new users become parents; nobody can make themselves admin", async () => {
    const [u] = await admin("insert into auth.users (email, raw_user_meta_data) values ('sneaky@test.local', '{\"role\":\"admin\"}') returning id");
    const [p] = await admin("select role, approved from profiles where id = $1", [u.id]);
    expect(p.role).toBe("parent");
  });

  it("users cannot change their own role or approval", async () => {
    await rejects(as(parentA, (q) => q("update profiles set role = 'admin' where id = $1", [parentA])), "permission denied");
    await rejects(as(pendingTutor, (q) => q("update profiles set approved = true where id = $1", [pendingTutor])), "permission denied");
  });

  it("tutors who sign up are NOT approved until an admin approves them", async () => {
    const [p] = await admin("select role, approved from profiles where id = $1", [pendingTutor]);
    expect(p).toEqual({ role: "tutor", approved: false });
  });

  it("only admins can approve tutors", async () => {
    await rejects(as(tutorA, (q) => q("select admin_set_user($1, 'tutor', true)", [pendingTutor])), "not_allowed");
    await as(adminUser, (q) => q("select admin_set_user($1, 'tutor', true)", [pendingTutor]));
    const [p] = await admin("select approved from profiles where id = $1", [pendingTutor]);
    expect(p.approved).toBe(true);
    await admin("update profiles set approved = false where id = $1", [pendingTutor]); // reset for later tests
  });
});

describe("tutors only see their own students", () => {
  it("tutor A sees student A", async () => {
    const rows = await as(tutorA, (q) => q("select id from students"));
    expect(rows.map((r) => r.id)).toEqual([childA]);
  });

  it("tutor A CANNOT read tutor B's student, bookings, or notes", async () => {
    await as(tutorA, async (q) => {
      expect(await q("select * from students where id = $1", [childB])).toHaveLength(0);
      expect(await q("select * from bookings where id = $1", [bookingB])).toHaveLength(0);
      expect(await q("select * from session_notes where student_id = $1", [childB])).toHaveLength(0);
      expect(await q("select * from profiles where id = $1", [parentB])).toHaveLength(0);
    });
  });

  it("tutor B cannot see tutor A's session note or student", async () => {
    await as(tutorB, async (q) => {
      expect(await q("select * from session_notes")).toHaveLength(0);
      expect(await q("select * from students where id = $1", [childA])).toHaveLength(0);
    });
  });

  it("an unapproved tutor sees nothing, even if linked to a student", async () => {
    await admin("insert into tutor_students (tutor_id, student_id) values ($1, $2)", [pendingTutor, childA]);
    await as(pendingTutor, async (q) => {
      expect(await q("select * from students")).toHaveLength(0);
    });
    await rejects(
      as(pendingTutor, (q) => q("insert into availability_rules (tutor_id, weekday, start_time, end_time) values ($1, 1, '09:00', '10:00')", [pendingTutor])),
      "row-level security",
    );
    await admin("delete from tutor_students where tutor_id = $1", [pendingTutor]);
  });

  it("tutors cannot assign work to students who are not theirs", async () => {
    const [a] = await as(tutorA, (q) => q("insert into assignments (tutor_id, title, subject) values ($1, 'Worksheet', 'math') returning id", [tutorA]));
    await rejects(as(tutorA, (q) => q("insert into assignment_students values ($1, $2)", [a.id, childB])), "row-level security");
    await as(tutorA, (q) => q("insert into assignment_students values ($1, $2)", [a.id, childA]));
  });

  it("tutors cannot write notes on another tutor's session", async () => {
    await rejects(
      as(tutorA, (q) => q("insert into session_notes (booking_id, tutor_id, student_id, worked_on) values ($1, $2, $3, 'x')", [bookingB, tutorA, childB])),
      "row-level security",
    );
  });
});

describe("families only see their own data", () => {
  it("parent A sees only their own child, bookings, and notes", async () => {
    await as(parentA, async (q) => {
      expect((await q("select id from students")).map((r) => r.id)).toEqual([childA]);
      expect((await q("select id from bookings")).map((r) => r.id)).toEqual([bookingA]);
      expect(await q("select * from session_notes")).toHaveLength(1);
    });
  });

  it("parent A CANNOT read family B's data", async () => {
    await as(parentA, async (q) => {
      expect(await q("select * from students where id = $1", [childB])).toHaveLength(0);
      expect(await q("select * from bookings where id = $1", [bookingB])).toHaveLength(0);
      expect(await q("select * from profiles where id = $1", [parentB])).toHaveLength(0);
    });
  });

  it("parent A cannot book, edit, or delete for someone else's child", async () => {
    const slot = await firstSlot(parentA, tutorA, 2);
    await rejects(as(parentA, (q) => q("select book_session($1, $2, 'math', $3, 'online')", [childB, tutorA, slot])), "not_your_child");
    const updated = await as(parentA, (q) => q("update students set nickname = 'hacked' where id = $1 returning id", [childB]));
    expect(updated).toHaveLength(0);
    const deleted = await as(parentA, (q) => q("delete from students where id = $1 returning id", [childB]));
    expect(deleted).toHaveLength(0);
  });

  it("parents cannot add a child to another family", async () => {
    await rejects(as(parentA, (q) => q("insert into students (parent_id, nickname, grade) values ($1, 'x', '3')", [parentB])), "row-level security");
  });

  it("a student login sees only themself, their sessions and notes", async () => {
    await as(childAUser, async (q) => {
      expect((await q("select id from students")).map((r) => r.id)).toEqual([childA]);
      expect((await q("select id from bookings")).map((r) => r.id)).toEqual([bookingA]);
      expect(await q("select * from session_notes")).toHaveLength(1);
      expect(await q("select * from profiles where id = $1", [parentA])).toHaveLength(0);
    });
  });

  it("the public (not logged in) can't read any student data", async () => {
    for (const table of ["students", "bookings", "session_notes", "submissions", "quiz_attempts", "profiles"]) {
      await rejects(as(null, (q) => q(`select * from ${table}`)), "permission denied");
    }
  });
});

describe("booking rules", () => {
  it("nobody can insert bookings directly (must use book_session)", async () => {
    await rejects(
      as(parentA, (q) => q("insert into bookings (student_id, parent_id, tutor_id, subject, mode, starts_at, ends_at) values ($1, $2, $3, 'math', 'online', now() + interval '3 days', now() + interval '3 days 1 hour')", [childA, parentA, tutorA])),
      "permission denied",
    );
  });

  it("the database blocks double-booking a tutor", async () => {
    const [b] = await admin("select starts_at from bookings where id = $1", [bookingA]);
    const childC = await addChild(parentB, "Cleo");
    await rejects(as(parentB, (q) => q("select book_session($1, $2, 'math', $3, 'online')", [childC, tutorA, b.starts_at])), "slot_taken");
    // Even the database owner can't sneak an overlapping booking in.
    await rejects(
      admin("insert into bookings (student_id, parent_id, tutor_id, subject, mode, starts_at, ends_at) select $1, $2, tutor_id, 'math', 'online', starts_at, ends_at from bookings where id = $3", [childC, parentB, bookingA]),
      "no_tutor_double_booking",
    );
  });

  it("booked times disappear from the public calendar", async () => {
    const [b] = await admin("select starts_at from bookings where id = $1", [bookingA]);
    const slots = await as(null, (q) => q("select starts_at from get_open_slots(now(), now() + interval '7 days', null, null, null, $1)", [tutorA]));
    expect(slots.some((s) => s.starts_at.getTime() === b.starts_at.getTime())).toBe(false);
    expect(slots.length).toBeGreaterThan(0);
  });

  it("the public calendar never includes student info", async () => {
    const slots = await as(null, (q) => q("select * from get_open_slots(now(), now() + interval '2 days')"));
    expect(Object.keys(slots[0]).sort()).toEqual(["ends_at", "modes", "starts_at", "subjects", "tutor_id", "tutor_name"]);
  });

  it("parents can't cancel inside the cancel window; tutors must give a reason", async () => {
    const childD = await addChild(parentA, "Dee");
    const tutorC = await createUser({ role: "tutor", name: "Tutor C" });
    const [late] = await admin(
      "insert into bookings (student_id, parent_id, tutor_id, subject, mode, starts_at, ends_at) values ($1, $2, $3, 'math', 'online', now() + interval '3 hours', now() + interval '4 hours') returning id",
      [childD, parentA, tutorC],
    );
    await rejects(as(parentA, (q) => q("select cancel_booking($1)", [late.id])), "too_late");
    await rejects(as(tutorC, (q) => q("select cancel_booking($1, '')", [late.id])), "reason_required");
    const [r] = await as(tutorC, (q) => q("select cancel_booking($1, 'I am sick') as who", [late.id]));
    expect(r.who).toBe("tutor");
    // Tutor A can't cancel Tutor B's session at all.
    await rejects(as(tutorA, (q) => q("select cancel_booking($1, 'nope')", [bookingB])), "not_found");
  });

  it("meeting links are only visible to the booked family and tutor", async () => {
    await as(tutorA, (q) => q("update bookings set meeting_link = 'https://meet.google.com/abc-defg-hij' where id = $1", [bookingA]));
    const forTutorB = await as(tutorB, (q) => q("select meeting_link from bookings where id = $1", [bookingA]));
    expect(forTutorB).toHaveLength(0);
    const forParentA = await as(parentA, (q) => q("select meeting_link from bookings where id = $1", [bookingA]));
    expect(forParentA[0].meeting_link).toContain("meet.google.com");
    // Tutor B can't overwrite it either.
    const changed = await as(tutorB, (q) => q("update bookings set meeting_link = 'https://evil.example' where id = $1 returning id", [bookingA]));
    expect(changed).toHaveLength(0);
  });
});

describe("quizzes", () => {
  const quiz = "11111111-0000-4000-8000-000000000001"; // sample library quiz
  let myQuiz: string;

  beforeAll(async () => {
    // Tutor A makes their own copy and assigns it to child A.
    [{ id: myQuiz }] = await as(tutorA, (q) => q("insert into quizzes (tutor_id, title, subject) values ($1, 'My quiz', 'math') returning id", [tutorA]));
    await as(tutorA, async (q) => {
      const [qq] = await q("insert into quiz_questions (quiz_id, type, prompt, choices) values ($1, 'true_false', '1 + 1 = 2', '[]') returning id", [myQuiz]);
      await q("insert into quiz_question_keys (question_id, answer, explanation) values ($1, '{\"correct\": true}', 'Yes')", [qq.id]);
      await q("insert into quiz_assignments (quiz_id, student_id) values ($1, $2)", [myQuiz, childA]);
    });
  });

  it("students can read assigned questions but NEVER the answer key", async () => {
    await as(childAUser, async (q) => {
      expect(await q("select * from quiz_questions where quiz_id = $1", [myQuiz])).toHaveLength(1);
      expect(await q("select * from quiz_question_keys")).toHaveLength(0);
      expect(await q("select * from quizzes where id = $1", [quiz])).toHaveLength(0); // not assigned
    });
  });

  it("other tutors can't see or assign a tutor's quiz", async () => {
    await as(tutorB, async (q) => {
      expect(await q("select * from quizzes where id = $1", [myQuiz])).toHaveLength(0);
      expect(await q("select * from quiz_question_keys k join quiz_questions q on q.id = k.question_id where q.quiz_id = $1", [myQuiz])).toHaveLength(0);
    });
    await rejects(as(tutorB, (q) => q("insert into quiz_assignments (quiz_id, student_id) values ($1, $2)", [myQuiz, childB])), "row-level security");
  });

  it("approved tutors can read library quizzes with answer keys (to copy them)", async () => {
    const keys = await as(tutorB, (q) => q("select * from quiz_question_keys k join quiz_questions q on q.id = k.question_id where q.quiz_id = $1", [quiz]));
    expect(keys.length).toBe(6);
  });

  it("students can save progress but cannot give themselves a score", async () => {
    const [{ id }] = await as(childAUser, (q) => q("select start_quiz_attempt($1, $2) as id", [myQuiz, childA]));
    await as(childAUser, (q) => q("update quiz_attempts set responses = '{\"x\": true}', current_index = 1 where id = $1", [id]));
    await rejects(as(childAUser, (q) => q("update quiz_attempts set score = 100 where id = $1", [id])), "permission denied");
    await rejects(as(childAUser, (q) => q("update quiz_attempts set results = '{}' where id = $1", [id])), "permission denied");
    // Another family can't start or see it.
    await rejects(as(parentB, (q) => q("select start_quiz_attempt($1, $2)", [myQuiz, childA])), "not_allowed");
    expect(await as(parentB, (q) => q("select * from quiz_attempts"))).toHaveLength(0);
  });
});

describe("assignments and files", () => {
  it("students submit work through submit_assignment and only for themselves", async () => {
    const [a] = await admin("select assignment_id from assignment_students where student_id = $1", [childA]);
    await as(childAUser, (q) => q("select submit_assignment($1, $2, 'My answer is 3/4', '{}')", [a.assignment_id, childA]));
    await rejects(as(childAUser, (q) => q("select submit_assignment($1, $2, 'x', '{}')", [a.assignment_id, childB])), "not_allowed");
    await rejects(as(parentB, (q) => q("select * from submissions")).then((r) => { if (r.length) throw new Error("leak"); throw new Error("none"); }), "none");
    // Files must be inside the student's own folder.
    await rejects(
      as(childAUser, (q) => q("select submit_assignment($1, $2, 'x', $3)", [a.assignment_id, childA, [`${childB}/${a.assignment_id}/photo.jpg`]])),
      "bad_file",
    );
  });

  it("only the assignment's tutor can review it", async () => {
    const [s] = await admin("select id from submissions where student_id = $1", [childA]);
    await rejects(as(tutorB, (q) => q("select review_submission($1, 'Great', 100, '⭐', true)", [s.id])), "not_allowed");
    await as(tutorA, (q) => q("select review_submission($1, 'Great work!', 90, '⭐', true)", [s.id]));
    const [row] = await as(parentA, (q) => q("select status, feedback, sticker from submissions where id = $1", [s.id]));
    expect(row).toEqual({ status: "complete", feedback: "Great work!", sticker: "⭐" });
  });

  it("private files: tutor B cannot read photos of tutor A's student's work", async () => {
    const [a] = await admin("select assignment_id from assignment_students where student_id = $1", [childA]);
    const path = `${childA}/${a.assignment_id}/photo.jpg`;
    await as(childAUser, (q) => q("insert into storage.objects (bucket_id, name) values ('submission-files', $1)", [path]));
    expect(await as(tutorA, (q) => q("select name from storage.objects where name = $1", [path]))).toHaveLength(1);
    expect(await as(parentA, (q) => q("select name from storage.objects where name = $1", [path]))).toHaveLength(1);
    expect(await as(tutorB, (q) => q("select name from storage.objects where name = $1", [path]))).toHaveLength(0);
    expect(await as(parentB, (q) => q("select name from storage.objects where name = $1", [path]))).toHaveLength(0);
    // Family B can't upload into child A's folder.
    await rejects(as(parentB, (q) => q("insert into storage.objects (bucket_id, name) values ('submission-files', $1)", [`${childA}/${a.assignment_id}/x.jpg`])), "row-level security");
  });
});

describe("public content and inboxes", () => {
  it("the public sees approved, published tutors only", async () => {
    await admin("update tutor_profiles set published = true where tutor_id = $1", [pendingTutor]);
    const rows = await as(null, (q) => q("select tutor_id from tutor_profiles"));
    const ids = rows.map((r) => r.tutor_id);
    expect(ids).toContain(tutorA);
    expect(ids).not.toContain(pendingTutor);
  });

  it("form inboxes and the rate-limit table are private", async () => {
    await admin("insert into contact_messages (name, email, message) values ('a', 'a@b.c', 'hi')");
    expect(await as(parentA, (q) => q("select * from contact_messages"))).toHaveLength(0);
    expect(await as(tutorA, (q) => q("select * from contact_messages"))).toHaveLength(0);
    expect((await as(adminUser, (q) => q("select * from contact_messages"))).length).toBeGreaterThan(0);
    await rejects(as(null, (q) => q("select check_rate_limit('x', 1, 60)")), "permission denied");
  });

  it("only admins can edit site content", async () => {
    await rejects(as(tutorA, (q) => q("insert into announcements (message) values ('{\"en\":\"hi\"}')")), "row-level security");
    await as(adminUser, (q) => q("insert into announcements (message, active) values ('{\"en\":\"Closed Monday\"}', false)"));
  });
});

/**
 * KEY USER FLOWS (need a real Supabase project with the migrations + seed loaded).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e
 *
 * Use a TEST project (or `supabase start` locally), not your real one: this
 * creates test users and deletes them at the end.
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
test.skip(!url || !anon || !service, "Supabase test project not configured (see README)");

const run = Date.now().toString(36);
const password = "Test-password-123";
const pin = "246810";
const username = `e2e_${run}`.slice(0, 24);
const ids: { tutorA?: string; tutorB?: string; parent?: string; studentUser?: string; child?: string; assignment?: string; quiz?: string } = {};
const emails = { tutorA: `tutor-a-${run}@example.com`, tutorB: `tutor-b-${run}@example.com`, parent: `parent-${run}@example.com` };
let admin: SupabaseClient;

async function makeUser(email: string, meta: Record<string, unknown>, app: Record<string, unknown> = {}) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: app.role === "student" ? pin : password, email_confirm: true, user_metadata: meta, app_metadata: app });
  if (error) throw error;
  return data.user.id;
}

test.beforeAll(async () => {
  admin = createClient(url!, service!, { auth: { persistSession: false } });
  // Two approved tutors with open hours every day.
  for (const [key, name] of [["tutorA", "E2E Tutor A"], ["tutorB", "E2E Tutor B"]] as const) {
    const id = await makeUser(emails[key], { display_name: name, role: "tutor" });
    ids[key] = id;
    await admin.from("profiles").update({ approved: true }).eq("id", id);
    await admin.from("tutor_profiles").update({ public_name: name, published: true, subjects: ["math", "reading"] }).eq("tutor_id", id);
    await admin.from("availability_rules").insert([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ tutor_id: id, weekday, start_time: "08:00", end_time: "20:00", subjects: ["math"], modes: ["online", "in_person"] })));
  }
  // A family with one child, who has their own username + PIN login.
  ids.parent = await makeUser(emails.parent, { display_name: "E2E Parent" });
  const { data: child } = await admin.from("students").insert({ parent_id: ids.parent, nickname: "Robin", grade: "3", subjects: ["math"] }).select("id").single();
  ids.child = child!.id;
  ids.studentUser = await makeUser(`${username}@students.example.com`, { display_name: "Robin" }, { role: "student" });
  await admin.from("students").update({ user_id: ids.studentUser, username }).eq("id", ids.child);
  await admin.from("tutor_students").insert({ tutor_id: ids.tutorA, student_id: ids.child });
  // Tutor A gives Robin an assignment and a copy of the sample math quiz.
  const { data: a } = await admin.from("assignments").insert({ tutor_id: ids.tutorA, title: `Practice sheet ${run}`, instructions: "Solve 6 x 7.", subject: "math" }).select("id").single();
  ids.assignment = a!.id;
  await admin.from("assignment_students").insert({ assignment_id: ids.assignment, student_id: ids.child });
  const { data: q } = await admin.from("quizzes").insert({ tutor_id: ids.tutorA, title: `Math quiz ${run}`, subject: "math", instant_feedback: true }).select("id").single();
  ids.quiz = q!.id;
  const { data: sample } = await admin.from("quiz_questions").select("*, quiz_question_keys(answer, explanation)").eq("quiz_id", "11111111-0000-4000-8000-000000000001").order("position");
  for (const s of sample!) {
    const key = Array.isArray(s.quiz_question_keys) ? s.quiz_question_keys[0] : s.quiz_question_keys;
    const { data: nq } = await admin.from("quiz_questions").insert({ quiz_id: ids.quiz, position: s.position, type: s.type, prompt: s.prompt, choices: s.choices, hint: s.hint, points: s.points }).select("id").single();
    await admin.from("quiz_question_keys").insert({ question_id: nq!.id, answer: key.answer, explanation: key.explanation });
  }
  await admin.from("quiz_assignments").insert({ quiz_id: ids.quiz, student_id: ids.child });
});

test.afterAll(async () => {
  if (!admin) return;
  for (const id of [ids.studentUser, ids.parent, ids.tutorA, ids.tutorB]) if (id) await admin.auth.admin.deleteUser(id);
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard\//);
}

async function studentLogin(page: Page) {
  await page.goto("/login?as=student");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("PIN", { exact: true }).fill(pin);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard\/student/);
}

test("a parent books a session", async ({ page }) => {
  await login(page, emails.parent);
  await page.goto("/dashboard/parent/book");
  await page.getByLabel(/Robin/).check();
  await page.getByLabel("Subject").selectOption("math");
  await page.getByLabel("Tutor").selectOption({ label: "E2E Tutor A" });
  await page.getByLabel(/Online/).check();
  await page.getByRole("button", { name: "Show open times" }).click();
  await page.locator('input[name="slot"]').first().check();
  await page.getByLabel("Anything the tutor should know?").fill("Working on multiplication facts");
  await page.getByRole("button", { name: "Book this time" }).click();
  await expect(page.getByText("You're booked!")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Working on multiplication facts")).toBeVisible();
  // The booked time is gone from Tutor A's open times.
  const { data: booking } = await admin.from("bookings").select("starts_at, status").eq("student_id", ids.child).single();
  expect(booking!.status).toBe("booked");
  const { data: slots } = await createClient(url!, anon!).rpc("get_open_slots", { p_from: new Date().toISOString(), p_to: new Date(Date.now() + 14 * 864e5).toISOString(), p_tutor: ids.tutorA });
  expect((slots as { starts_at: string }[]).some((s) => new Date(s.starts_at).getTime() === new Date(booking!.starts_at).getTime())).toBe(false);
});

test("a student turns in an assignment", async ({ page }) => {
  await studentLogin(page);
  await page.goto("/dashboard/student/assignments");
  await page.getByRole("link", { name: `Practice sheet ${run}` }).click();
  await page.getByLabel("Type your answer").fill("6 x 7 = 42");
  await page.getByRole("button", { name: "Turn it in" }).click();
  await expect(page.getByText("Turned in! Nice work.")).toBeVisible({ timeout: 15_000 });
  const { data: sub } = await admin.from("submissions").select("answer_text, status").eq("assignment_id", ids.assignment).single();
  expect(sub).toEqual({ answer_text: "6 x 7 = 42", status: "submitted" });
});

test("a student takes a quiz and sees their results", async ({ page }) => {
  await studentLogin(page);
  await page.goto("/dashboard/student/quizzes");
  await page.getByRole("button", { name: "Start" }).click();
  await page.waitForURL(/\/dashboard\/quiz\//);
  const next = () => page.getByRole("button", { name: /^Next/ }).click();
  // 1. 7 + 5
  await page.getByLabel(/12/).check();
  await page.getByRole("button", { name: /Check my answer/ }).click();
  await expect(page.getByText(/Nice job|You got it|Great thinking|Awesome|Way to go/)).toBeVisible();
  await next();
  // 2. True/false
  await page.getByLabel(/True/).check(); await next();
  // 3. Number
  await page.getByLabel("Type a number").fill("12"); await next();
  // 4. Pick all
  await page.getByLabel("4", { exact: true }).check(); await page.getByLabel("8", { exact: true }).check(); await next();
  // 5. Fill in the blank
  await page.getByLabel("Blank 1").fill("4"); await next();
  // 6. Matching
  await page.getByLabel("2 + 2").selectOption({ label: "4" });
  await page.getByLabel("3 + 3").selectOption({ label: "6" });
  await page.getByLabel("5 + 5").selectOption({ label: "10" });
  await page.getByRole("button", { name: /Finish/ }).click();
  await page.waitForURL(/\/dashboard\/results\//);
  await expect(page.getByRole("heading", { name: "Perfect score! Amazing!" })).toBeVisible();
  await expect(page.getByText("6 out of 6 (100%)")).toBeVisible();
});

test("a tutor is blocked from another tutor's student", async ({ page }) => {
  await login(page, emails.tutorB);
  await page.goto("/dashboard/tutor/students");
  await expect(page.getByText("Robin")).toHaveCount(0);
  await page.goto(`/dashboard/tutor/students/${ids.child}`);
  await expect(page.getByRole("heading", { name: /can't find that page/ })).toBeVisible();
  await expect(page.getByText("Robin")).toHaveCount(0);
  // And straight through the database API, not just the website:
  const asTutorB = createClient(url!, anon!, { auth: { persistSession: false } });
  await asTutorB.auth.signInWithPassword({ email: emails.tutorB, password });
  const { data: students } = await asTutorB.from("students").select("*").eq("id", ids.child);
  const { data: subs } = await asTutorB.from("submissions").select("*").eq("student_id", ids.child);
  const { data: bookings } = await asTutorB.from("bookings").select("*").eq("student_id", ids.child);
  expect(students).toEqual([]);
  expect(subs).toEqual([]);
  expect(bookings).toEqual([]);
});

import pg from "pg";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });

/** Run SQL as the database owner (like the Supabase dashboard / service role). */
export async function admin<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

type Query = <T = any>(text: string, params?: unknown[]) => Promise<T[]>;

/**
 * Run queries exactly as a logged-in user would through the Supabase API:
 * role "authenticated" (or "anon" when uid is null) + their user id in the JWT claims.
 * Row Level Security applies.
 */
export async function as<T>(uid: string | null, fn: (q: Query) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${uid ? "authenticated" : "anon"}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(uid ? { sub: uid, role: "authenticated" } : { role: "anon" })]);
    const q: Query = async (text, params = []) => (await client.query(text, params)).rows;
    const result = await fn(q);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

let n = 0;
/** Create a user the same way Supabase sign-up does (the trigger makes the profile). */
export async function createUser(opts: { role?: "tutor" | "parent" | "admin" | "student"; name?: string; approved?: boolean } = {}) {
  n += 1;
  const meta = { display_name: opts.name ?? `User ${n}`, role: opts.role === "tutor" ? "tutor" : undefined };
  const app = opts.role === "student" ? { role: "student" } : {};
  const [u] = await admin<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3) returning id",
    [`user${n}-${Date.now()}@test.local`, meta, app],
  );
  if (opts.role === "admin") await admin("update profiles set role = 'admin', approved = true where id = $1", [u.id]);
  if (opts.role === "tutor" && opts.approved !== false) {
    await admin("update profiles set approved = true where id = $1", [u.id]);
    await admin("update tutor_profiles set published = true, public_name = $2, subjects = '{math,reading}' where tutor_id = $1", [u.id, opts.name ?? `Tutor ${n}`]);
  }
  return u.id;
}

/** Give a tutor open hours every day 8am–8pm Detroit time. */
export async function giveHours(tutorId: string) {
  for (let d = 0; d < 7; d++) {
    await admin(
      "insert into availability_rules (tutor_id, weekday, start_time, end_time, subjects, modes) values ($1, $2, '08:00', '20:00', '{math,reading}', '{in_person,online}')",
      [tutorId, d],
    );
  }
}

export async function addChild(parentId: string, nickname = "Kid", grade = "4") {
  const [s] = await as(parentId, (q) =>
    q<{ id: string }>("insert into students (parent_id, nickname, grade, subjects) values ($1, $2, $3, '{math}') returning id", [parentId, nickname, grade]),
  );
  return s.id;
}

/** Expect a promise to fail with a message containing `text`. */
export async function rejects(p: Promise<unknown>, text: string | RegExp) {
  try {
    await p;
  } catch (e) {
    const msg = (e as Error).message;
    if (typeof text === "string" ? msg.includes(text) : text.test(msg)) return;
    throw new Error(`Expected error matching ${text}, got: ${msg}`);
  }
  throw new Error(`Expected error matching ${text}, but it succeeded`);
}

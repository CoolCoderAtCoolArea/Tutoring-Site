import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Removes every uploaded file of a student's work from storage. (Server-only: never a Server Action.) */
export async function deleteStudentFiles(studentId: string) {
  const adminDb = createAdminClient();
  const bucket = adminDb.storage.from("submission-files");
  const { data: folders } = await bucket.list(studentId, { limit: 1000 });
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(`${studentId}/${folder.name}`, { limit: 1000 });
    if (files?.length) await bucket.remove(files.map((f) => `${studentId}/${folder.name}/${f.name}`));
  }
}

/**
 * Short-lived (1 hour) links to private files. Made with the USER's client,
 * so storage policies decide whether they may see each file.
 */
export async function signedUrls(bucket: "assignment-files" | "submission-files", paths: string[]) {
  if (!paths.length) return [] as { path: string; url: string | null; name: string }[];
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
  return paths.map((path, i) => ({
    path,
    url: data?.[i]?.signedUrl ?? null,
    name: path.split("/").pop()!.replace(/^\d+-/, ""),
  }));
}

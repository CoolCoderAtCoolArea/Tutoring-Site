import "server-only";
import { site } from "@/config/site";

/**
 * Sends an email with Resend (https://resend.com). If RESEND_API_KEY is not
 * set, the email is printed in the terminal instead — handy while testing.
 * Emails are short, plain, and never include a child's private details beyond
 * their first name/nickname.
 */
export type Email = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
};

export async function sendEmail(email: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || `${site.name} <${site.email}>`;
  const html = email.html ?? textToHtml(email.text);
  if (!key) {
    console.info(`\n📧 [email not sent — RESEND_API_KEY missing]\nTo: ${email.to}\nSubject: ${email.subject}\n${email.text}\n`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html,
        reply_to: site.email,
        attachments: email.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content).toString("base64"),
          content_type: a.contentType,
        })),
      }),
    });
    if (!res.ok) console.error("Resend error", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Email failed", err);
    return false;
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Turns plain text into simple, readable HTML (links become clickable). */
export function textToHtml(text: string) {
  const body = escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:system-ui,Arial,sans-serif;font-size:17px;line-height:1.5;color:#1c1917;max-width:560px">${body}<p style="color:#57534e;font-size:14px">— ${escapeHtml(site.name)}</p></div>`;
}

/** Where admin notifications go (new applications, contact messages). */
export function adminInbox() {
  return process.env.ADMIN_NOTIFY_EMAIL || site.email;
}

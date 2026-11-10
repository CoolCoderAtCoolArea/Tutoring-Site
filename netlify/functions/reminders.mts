/**
 * Netlify Scheduled Function: runs every hour and asks the website to send
 * 24-hour reminder emails. Needs the CRON_SECRET and URL env variables
 * (URL is set by Netlify automatically).
 */
export default async () => {
  const base = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL;
  const res = await fetch(`${base}/api/cron/reminders`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  console.log("reminders:", res.status, await res.text());
};

export const config = { schedule: "@hourly" };

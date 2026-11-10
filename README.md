# Detroit Learning Club — tutoring website

A free tutoring website for K–12 students and families in Detroit, MI.
Families book free sessions, kids do assignments and quizzes, tutors share notes,
and parents can see everything. It works on cheap phones and slow internet, in
English and Spanish, and is built to keep kids' information safe.

> **Name is a placeholder.** "Detroit Learning Club" is a stand-in. Change it in
> `src/config/site.ts` (see the [placeholder checklist](#placeholder-checklist)).

---

## Contents

1. [What the site does](#1-what-the-site-does)
2. [How the code is organized](#2-how-the-code-is-organized)
3. [Set up Supabase (database and logins)](#3-set-up-supabase-the-database-and-logins)
4. [Run it on your computer](#4-run-it-on-your-computer)
5. [Put it on the internet (Netlify)](#5-put-it-on-the-internet-netlify)
6. [Connect a custom domain](#6-connect-a-custom-domain)
7. [Make the first admin and approve tutors](#7-make-the-first-admin-and-approve-tutors)
8. [Everyday how-tos](#8-everyday-how-tos)
9. [Tests](#9-tests)
10. [Placeholder checklist](#placeholder-checklist)
11. [Free-tier limits and what costs money](#11-free-tier-limits-and-what-costs-money)
12. [Safety and privacy notes](#12-safety-and-privacy-notes)

---

## 1. What the site does

**Public pages (no login):** Home, About / Meet the Tutors, Subjects, Open Times
(live calendar), How It Works + FAQ, Resources, Become a Tutor, Contact, Homework
Help, Support Us, Privacy Policy, Child Safety, Accessibility, and a friendly 404 page.

**Four kinds of accounts:**

| Role | Who | What they can do |
|---|---|---|
| **Parent** | Parent or guardian | Add children, make kid logins, book/cancel/reschedule, read notes, see assignments and quiz results, download or delete family data |
| **Student** | A child (login made by their parent) | See sessions, do assignments (type or photo), take quizzes, earn badges |
| **Tutor** | Volunteer (must be **approved** by an admin) | Set weekly hours, see *only their own* students, write session notes, add video links, make assignments and quizzes, see results |
| **Admin** | You (the founders) | Approve tutors, manage users, see all bookings, edit FAQ/resources/testimonials/banner, see stats, export CSV |

**Built-in safety:** kids under 13 never sign up themselves. We store only a
child's first name or nickname, grade, and subjects. There is no private
messaging. Tutors can only see students they're connected to. This is enforced
by the database itself (Row Level Security), and tests prove it.

---

## 2. How the code is organized

```
messages/            ← ALL the words on the site. en.json = English, es.json = Spanish
public/              ← images, quiz-template.csv, og-image.png (link preview picture)
src/
  config/site.ts     ← business name, email, location, grades, subjects, cancel window
  config/resources.ts← default learning links
  app/[locale]/      ← every page. Folder name = web address
    page.tsx         ← home page  (/)
    about/page.tsx   ← /about
    dashboard/       ← logged-in pages: parent/, student/, tutor/, admin/
  components/        ← reusable pieces (buttons, forms, header, quiz player…)
  lib/
    actions/         ← "Server Actions": code that runs when a form is submitted
    supabase/        ← how we talk to the database
    quiz/            ← quiz grading, CSV import, question types
    email.ts         ← sending emails (Resend)
    notify.ts        ← booking confirmation / cancellation / reminder emails
supabase/
  migrations/        ← the database: tables, security rules, functions (run in order)
  seed.sql           ← starter FAQ, resources, and 3 sample quizzes
tests/unit/          ← small tests (grading, dates, CSV…)       npm test
tests/db/            ← database security tests                  npm run test:db
e2e/                 ← browser tests (Playwright + axe)          npm run test:e2e
netlify/functions/   ← hourly job that sends 24-hour reminder emails
```

**Tech used:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, Supabase
(Postgres, Auth, Storage), next-intl (languages), KaTeX (math), Resend (email),
Playwright + axe (tests), Netlify (hosting).

**Where does code run?** Files with `"use client"` at the top run in the
visitor's browser. Everything else runs on the server. Secret keys are only
used in server files. `src/lib/supabase/admin.ts` imports `server-only`, so the
build fails if a browser file ever tries to use the secret key.

---

## 3. Set up Supabase (the database and logins)

You do this once. It's free.

### 3.1 Create the project
1. Go to <https://supabase.com>, sign up, and click **New project**.
2. Name it (e.g. `tutoring`), make a strong database password (save it in a
   password manager), and pick the region closest to Michigan (**East US**).
3. Wait about 2 minutes for it to start.

### 3.2 Create the tables (run the migrations)
1. In Supabase, open **SQL Editor** → **New query**.
2. Open each file in `supabase/migrations/` **in order** (`…0001_schema.sql`,
   `…0002_security.sql`, `…0003_functions.sql`, `…0004_storage.sql`).
   Copy the whole file, paste it into the SQL editor, and click **Run**.
   You should see "Success. No rows returned."
3. Do the same with `supabase/seed.sql` (starter FAQ, links, and 3 sample quizzes).

> *Using the Supabase CLI instead?* `npx supabase link --project-ref YOUR-REF`
> then `npx supabase db push`, then run `seed.sql` in the SQL Editor.

### 3.3 Login settings
In Supabase → **Authentication**:
1. **Sign In / Providers → Email**: keep **Email** on and **Confirm email** on.
   Set **Minimum password length** to **6**, because kids' PINs are 6+ digits.
   Parents and tutors are still required to use 8+ characters by the website.
2. **URL Configuration**:
   - **Site URL**: your website address (e.g. `https://yourdomain.org`). While
     testing locally, use `http://localhost:3000`.
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` and
     `https://yourdomain.org/auth/callback` (and your Netlify address,
     e.g. `https://your-site.netlify.app/auth/callback`).
3. **Emails → SMTP Settings** (important): Supabase's built-in email can only
   send a few emails per hour. Turn on **custom SMTP** with Resend:
   host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API
   key, sender = an address on your verified domain.

### 3.4 Copy your keys
Supabase → **Project Settings → API Keys** (or **API**):
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / publishable key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to be public)
- **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY` (**SECRET!** Never
  put it in a browser file, a screenshot, or a GitHub commit.)

### 3.5 Email sending (Resend)
1. Sign up at <https://resend.com> (free).
2. **Domains → Add domain** and follow the steps (you need a domain; see §6).
3. **API Keys → Create** → that's `RESEND_API_KEY`.
4. Set `EMAIL_FROM` to something like `Detroit Learning Club <hello@yourdomain.org>`.

Without `RESEND_API_KEY`, emails are printed in the terminal instead of sent,
which is handy while testing.

---

## 4. Run it on your computer

You need **Node.js 22** (<https://nodejs.org>, choose "LTS") and **Git**.

```bash
git clone <your repo URL>
cd Tutoring-Site
npm install
cp .env.example .env.local      # then open .env.local and fill in the values
npm run dev
```

Open <http://localhost:3000>.

- **Before Supabase is set up**, the public pages still work with sample
  content. Logins say "not turned on yet."
- After you edit a file, the page reloads by itself.
- Stop the server with `Ctrl + C`.

`.env.local` is in `.gitignore`, so it never gets committed. `.env.example`
lists every setting with an explanation.

---

## 5. Put it on the internet (Netlify)

1. Push this code to GitHub (it's already a Git repo).
2. Go to <https://app.netlify.com> → **Add new site → Import an existing project**
   → pick your GitHub repo. Netlify reads `netlify.toml`, so the build settings
   are filled in for you.
3. Before the first deploy, open **Site configuration → Environment variables**
   and add everything from `.env.example`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (your final address, no
   slash at the end), `RESEND_API_KEY`, `EMAIL_FROM`, and `CRON_SECRET` (a long
   random string. You can make one at <https://1password.com/password-generator>).
4. Click **Deploy**. It takes about 3 minutes.
5. **Reminder emails:** `netlify/functions/reminders.mts` runs every hour on
   its own. You can check it under **Logs → Functions**.
6. Add the Netlify address to Supabase's **Redirect URLs** (§3.3).

Every time you push to the `main` branch, Netlify redeploys automatically.

---

## 6. Connect a custom domain

1. Buy a domain (about $12/year) from Cloudflare, Namecheap, or Porkbun.
   Something like `detroitlearningclub.org`.
2. Netlify → **Domain management → Add a domain** → follow the steps (either
   point your domain's nameservers to Netlify, or add the DNS records it shows).
   HTTPS turns on automatically.
3. Update `NEXT_PUBLIC_SITE_URL` in Netlify to the new address and redeploy.
4. Update **Site URL** and **Redirect URLs** in Supabase (§3.3).
5. Verify the same domain in Resend (§3.5) so emails don't go to spam.

---

## 7. Make the first admin and approve tutors

### First admin (do this once)
1. On your live site, click **Log in → Create a free account** and sign up
   normally (as a parent). Confirm your email.
2. In Supabase → **SQL Editor**, run (with your email):
   ```sql
   update public.profiles set role = 'admin', approved = true
   where email = 'you@yourdomain.org';
   ```
3. Log out and back in. You'll land on the **Admin dashboard**.

You can only make the *first* admin with SQL. After that, admins can make other
admins under **Users**.

### Approve a tutor
1. The tutor signs up and picks **"Tutor or volunteer"**. They see a "waiting
   for approval" page and **cannot see any students**.
2. You: **Admin → Users**. Pending tutors are at the top.
3. Make sure you know this person (interview, references, and any background
   check you decided on), then check **Approved** and click **Save**. They get an email.
4. The tutor fills in **My profile** (check "Show my profile on the public
   website") and **My hours**. Now families can book them.

---

## 8. Everyday how-tos

### Add a tutor
Have them apply on **Become a Tutor** (it goes to **Admin → Inbox**), talk with
them, then send them to **Create a free account → Tutor**, and approve them (§7).

### Edit the words on the site
| What | Where |
|---|---|
| Banner ("No sessions over winter break") | **Admin → Site content → Announcement banner** |
| FAQ, resources, testimonials | **Admin → Site content** |
| Business name, email, location, cancel window | `src/config/site.ts` |
| Headlines, page text, buttons, emails | `messages/en.json` (English) and `messages/es.json` (Spanish) |
| Privacy / Child Safety / Accessibility pages | `messages/*.json` → `privacy`, `safety`, `accessibility` |

In `messages/*.json`, only change the text **after** the colon, in quotes.
Don't change the names on the left. Words in `{curly braces}` are filled in
automatically, so keep them. After editing, run `npm run check-translations`
to make sure Spanish isn't missing anything.

> If you change `cancelWindowHours` in `site.ts`, also change it in the
> database: `update site_settings set value = '24' where key = 'cancel_window_hours';`

### Add a language (e.g. Arabic or Bengali)
1. Copy `messages/en.json` to `messages/ar.json` (or `bn.json`).
2. Translate the text on the right side of each line. Ask a fluent speaker to
   check it. Keep `{curly}` words as they are.
3. In `src/i18n/config.ts`, add it: `export const locales = ["en", "es", "ar"] as const;`
4. Run `npm run check-translations`, then `npm run dev`. The language appears in
   the switcher at the top. **Arabic automatically flips to right-to-left.**
   The layout uses "start/end" spacing, so it mirrors correctly.
5. In **Admin → Site content**, each FAQ, resource, and banner now has an
   Arabic box too.

### Create a quiz
**Tutor dashboard → Quizzes**:
- **Copy a sample:** in the *Quiz library*, click **Make a copy**, then edit it.
- **New quiz:** **+ New quiz** → title, subject, settings (instant feedback,
  retries, show answers, timer off by default) → add questions one by one.
  There are 7 types: multiple choice, pick-all, true/false, short answer,
  number (with allowed difference), fill in the blank (type `___` for each
  blank), and matching.
- **Math:** write it between dollar signs: `Solve $x + 7 = 15$`, `$\frac{3}{4}$`.
- **From a spreadsheet:** download `quiz-template.csv` from the quiz page, fill
  it in Google Sheets or Excel, **File → Download → CSV**, and upload it.
- **Assign it:** at the bottom of the quiz page, check students and save.
  Results show under **📊 Results**: each student's scores over time, plus
  which questions most kids miss.

Students get one question per screen, big buttons, a progress bar, **Read
aloud**, hints, gentle feedback, and automatic saving (they can stop and come
back later).

---

## 9. Tests

| Command | What it checks | Needs |
|---|---|---|
| `npm run typecheck` | No type errors | — |
| `npm test` | Quiz grading, CSV import, Detroit time zone, calendar files, badges/streaks | — |
| `npm run test:db` | **Database security**: tutors can't see other tutors' students, families can't see other families, students can't read answer keys or change scores, no double-booking, private files stay private (32 tests) | PostgreSQL 15+ installed (`initdb` on your PATH) |
| `npx playwright test e2e/public.spec.ts` | Every public page in EN + ES: **axe accessibility (WCAG 2.1 AA)**, no sideways scrolling at 360px, keyboard + skip link, menu, language switch, easier-reading mode, offline draft saving, 404, SEO, home page under 500 KB | `npx playwright install chromium` once |
| `npm run test:e2e` | All of the above **plus** the key user flows: booking a session, turning in an assignment, taking a quiz, and a tutor being blocked from another tutor's student | A **test** Supabase project (below) |

### Running the end-to-end user flows
Use a separate **test** Supabase project (or `npx supabase start` with Docker),
never your real one. The tests create users and delete them afterwards.
Run the migrations and `seed.sql` on it, then:

```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e
```

GitHub Actions (`.github/workflows/ci.yml`) runs everything on every push.
To include the user flows there, add repository secrets `TEST_SUPABASE_URL`,
`TEST_SUPABASE_ANON_KEY`, and `TEST_SUPABASE_SERVICE_ROLE_KEY`.

**Latest results (mobile, 360px wide):** Lighthouse Performance 96–99,
Accessibility 100, Best Practices 100, SEO 100. Home page ≈ 200 KB.

---

## Placeholder checklist

Search the code for `[PLACEHOLDER]` (and `[PENDIENTE]` in Spanish) to find them all.

- [ ] **Business name**: `src/config/site.ts` → `name`. Also update `EMAIL_FROM`, the `title` in `messages/*.json` if it's there, and regenerate `public/og-image.png` (1200×630 picture shown when the link is shared). Make it in Canva.
- [ ] **Tagline / headline**: `messages/en.json` and `es.json` → `home.headline`, `home.sub`
- [ ] **Business email**: `src/config/site.ts` → `email` (a shared address, never personal)
- [ ] **In-person location**: `src/config/site.ts` → `inPersonLocation` (a public place, never a home)
- [ ] **Map** (optional): `src/config/site.ts` → `mapEmbedUrl`
- [ ] **Our story**: `messages/*.json` → `about.story`
- [ ] **Tutor profiles**: each tutor fills in **My profile** (until then, two placeholder cards show)
- [ ] **Testimonials**: replace in **Admin → Site content** with *real* quotes (with permission), and uncheck "placeholder"
- [ ] **FAQ "What language do tutors speak?"**: `messages/*.json` → `how.faq` and **Admin → Site content → FAQ**
- [ ] **Child Safety → tutor checks**: describe your background-check/training process (`messages/*.json` → `safety.sections`)
- [ ] **Privacy Policy & Child Safety**: have a trusted adult / legal advisor review them, then remove the "DRAFT" note (`<LegalPage draft={false} />` in `src/app/[locale]/privacy/page.tsx` and `child-safety/page.tsx`)
- [ ] **Donate page**: add a real donation link when you have one (`src/app/[locale]/donate/page.tsx`)
- [ ] **Cancel window** (default 12 hours): `site.ts` **and** the `site_settings` table
- [ ] **Colors** (optional): `src/app/globals.css` → `@theme`. Re-check contrast if you change them.

**Tagline ideas:**
1. *"Free tutoring. Real help. Right here in Detroit."*
2. *"Every Detroit kid can learn. We'll help."*
3. *"Homework help and tutoring for K–12 — always free."*

---

## 11. Free-tier limits and what costs money

Limits change, so check each site's pricing page. Roughly:

| Service | Free tier | Watch out for |
|---|---|---|
| **Supabase** | 500 MB database, 1 GB file storage, 50,000 monthly users, 5 GB bandwidth | ⚠️ **Free projects pause after 1 week with no activity.** Unpause from the dashboard. Built-in auth email is limited to a few per hour, so use Resend SMTP (§3.3). No automatic backups on free; download a backup now and then (Database → Backups) |
| **Netlify** | Free plan with monthly credit limits for bandwidth, builds, and function runs | Lots of deploys use build credits. Big images use bandwidth (ours are small) |
| **Resend** | 3,000 emails/month, 100/day, 1 domain | Each booking ≈ 2–4 emails (confirm + reminder, family + tutor) |
| **Cloudflare Turnstile** (optional) | Free | — |

**Things that cost money:**
- A custom domain: ~$10–15 per year (the only thing you really need to buy).
- Supabase Pro ($25/month) if you outgrow the free tier or don't want pausing and want daily backups.
- More emails than Resend's free tier ($20/month for 50k).
- Online donations: payment processors take a % of each gift (no payment system is built in yet).

The site uses **no ad trackers, no Facebook pixel, and no analytics**. If you
want visitor counts later, pick a privacy-friendly option (Netlify Analytics,
Plausible, or Cloudflare Web Analytics).

---

## 12. Safety and privacy notes

- **COPPA** (U.S. law for kids under 13): parents create every child account,
  we collect almost nothing about kids, and parents can download or delete it
  all (**Parent dashboard → My family's data**). Have the Privacy Policy reviewed
  before launch.
- **No private messaging** between tutors and students. Communication is
  session notes (parents can read them) and email to parents.
- **Tutors only see their own students.** The database enforces this (Row Level
  Security in `supabase/migrations/…0002_security.sql`), not just the website.
  `tests/db/security.test.ts` proves it.
- **Files** (assignment worksheets, photos of homework) are in **private**
  storage. Links expire after 1 hour and only work for allowed people.
- **Spam protection** on public forms: hidden honeypot field + rate limiting.
  Cloudflare Turnstile is optional: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and
  `TURNSTILE_SECRET_KEY` (free at dash.cloudflare.com → Turnstile). The check then
  appears on every public form automatically.
- **Never commit `.env.local`** or paste the service role key anywhere public.
  If it leaks, rotate it in Supabase → Project Settings → API.
- If something feels wrong with a tutor or child, act first and ask questions
  later. In Michigan, report suspected abuse to Centralized Intake: **855-444-3911**.

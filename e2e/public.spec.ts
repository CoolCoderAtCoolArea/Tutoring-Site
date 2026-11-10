import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const publicPages = ["/", "/about", "/subjects", "/availability", "/how-it-works", "/resources", "/volunteer", "/contact", "/help", "/donate", "/privacy", "/child-safety", "/accessibility", "/login", "/login?as=student", "/signup", "/book", "/forgot-password"];

async function axe(page: Page) {
  const results = await new AxeBuilder({ page: page as never }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")})`);
}

test.describe("every public page (English and Spanish)", () => {
  for (const locale of ["", "/es"]) {
    for (const path of publicPages) {
      const url = `${locale}${path === "/" && locale ? "" : path}` || "/";
      test(`${url} — no accessibility violations, no sideways scrolling at 360px`, async ({ page }) => {
        await page.goto(url);
        await expect(page.locator("h1").first()).toBeVisible();
        expect(await axe(page)).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        await expect(page.locator("html")).toHaveAttribute("lang", locale ? "es" : "en");
      });
    }
  }
});

test("home: Book a Session button is visible without scrolling on a small phone", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("main").getByRole("link", { name: /Book a Session/ });
  await expect(cta).toBeInViewport();
  const box = await cta.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("language switcher keeps you on the same page", async ({ page }) => {
  await page.goto("/how-it-works");
  await page.getByRole("link", { name: "Español" }).click();
  await expect(page).toHaveURL(/\/es\/how-it-works$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cómo funciona");
  await page.getByRole("link", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How It Works");
});

test("easier-reading toggle makes text bigger and is remembered", async ({ page }) => {
  await page.goto("/");
  const size = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  const before = await size();
  expect(before).toBe(18);
  await page.getByRole("button", { name: /Easier reading/ }).click();
  expect(await size()).toBeGreaterThan(before);
  await page.reload();
  expect(await size()).toBeGreaterThan(before);
  await expect(page.getByRole("button", { name: /Easier reading: on/ })).toHaveAttribute("aria-pressed", "true");
});

test("mobile menu opens, closes with Escape, and returns focus", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Menu" });
  await button.click();
  await expect(page.locator("#mobile-menu").getByRole("link", { name: "About Us" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#mobile-menu")).toBeHidden();
  await expect(button).toBeFocused();
});

test("skip link jumps to the main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("contact form keeps what you typed if the page reloads (draft saving)", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel("Your name").fill("Test Parent");
  await page.getByLabel("Your message").fill("Do you have Saturday sessions?");
  await page.reload();
  await expect(page.getByLabel("Your message")).toHaveValue("Do you have Saturday sessions?");
  await expect(page.getByText("We brought back what you typed before.")).toBeVisible();
});

test("forms warn instead of failing when offline", async ({ page, context }) => {
  await page.goto("/help");
  await page.getByLabel("First name of the student").fill("Sam");
  await page.getByLabel("Parent or guardian email").fill("parent@example.com");
  await page.getByLabel("Grade").selectOption("4");
  await page.getByLabel("Subject").selectOption("math");
  await page.getByLabel("What are you stuck on?").fill("Long division");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Send for help" }).click();
  await expect(page.getByText(/You seem to be offline/)).toBeVisible();
  await context.setOffline(false);
  // What they typed is still there.
  await page.reload();
  await expect(page.getByLabel("What are you stuck on?")).toHaveValue("Long division");
});

test("friendly 404 page", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /can't find that page/ })).toBeVisible();
  expect(await axe(page)).toEqual([]);
});

test("SEO basics: title, description, structured data, sitemap, robots", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Detroit/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Detroit/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /og-image\.png/);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld["@type"]).toContain("EducationalOrganization");
  expect(ld.address.addressLocality).toBe("Detroit");
  expect((await request.get("/sitemap.xml")).ok()).toBe(true);
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /dashboard");
});

test("dashboards require login", async ({ page }) => {
  await page.goto("/dashboard/parent");
  await expect(page).toHaveURL(/\/login/);
});

test("home page stays light (under 500 KB transferred)", async ({ page }) => {
  let bytes = 0;
  page.on("response", async (r) => {
    const len = Number(r.headers()["content-length"] || 0);
    bytes += len || (await r.body().catch(() => Buffer.alloc(0))).length;
  });
  await page.goto("/", { waitUntil: "networkidle" });
  console.log(`home page transferred ≈ ${Math.round(bytes / 1024)} KB`);
  expect(bytes).toBeLessThan(500 * 1024);
});

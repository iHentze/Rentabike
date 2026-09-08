/**
 * Every screen on a phone, and nothing wider than the phone.
 *
 * The root clips sideways overflow (app.css), so a too-wide element cannot
 * be dragged into view any more — it is simply cut off. This walk finds
 * those before a customer does: every route, in every state that changes
 * the layout (menu open, calendar open, a rider with a bike, a found
 * booking, the counter), at 390 and 320 CSS pixels wide.
 *
 *   npm run dev            (with .dev.vars, ADMIN_PASSWORD=counter)
 *   node scripts/phone-sweep.mjs [http://localhost:5173]
 *
 * Exit code 1 when any element sticks out past the viewport.
 */
import { chromium, devices } from "playwright-core";
import { execSync } from "node:child_process";

const base = process.argv[2] ?? "http://localhost:5173";
const found = execSync("find /opt/pw-browsers -maxdepth 3 -type f -name chrome 2>/dev/null | head -1").toString().trim();
const exe = process.env.CHROME || found || undefined;
const browser = await chromium.launch({ executablePath: exe || undefined, args: ["--no-sandbox"] });
const Q = "from=2026-10-16&fromTime=10:00&to=2026-10-18&toTime=16:00&riders=2&pickup=shop&dropoff=shop";
let failures = 0;

for (const width of [390, 320]) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width, height: 844 } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  const settle = async () => {
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(150);
  };
  const clickAndWait = async (l) => {
    await Promise.all([page.waitForLoadState("networkidle"), l.click()]);
    await page.waitForTimeout(200);
  };
  const report = async (name) => {
    const r = await page.evaluate(() => {
      const vw = window.innerWidth;
      const wide = [...document.querySelectorAll("body *")]
        .filter((e) => {
          const b = e.getBoundingClientRect();
          if (b.width === 0) return false;
          if (!(b.right > vw + 1 || b.left < -1)) return false;
          // inside a horizontal scroller, or clipped by an ancestor (decorative glows), is fine
          for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
            const o = getComputedStyle(a);
            if (/(auto|scroll|hidden|clip)/.test(o.overflowX)) return false;
          }
          return true;
        })
        .slice(0, 5)
        .map((e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}.${String(e.className).split(" ").slice(0, 4).join(".")} [${Math.round(e.getBoundingClientRect().left)}…${Math.round(e.getBoundingClientRect().right)}]`);
      return { scrollWidth: document.documentElement.scrollWidth, vw, wide };
    });
    const ok = r.wide.length === 0 && r.scrollWidth <= r.vw;
    if (!ok) failures++;
    console.log(`${ok ? "ok  " : "WIDE"} ${width}px ${name.padEnd(34)} ${r.scrollWidth}/${r.vw}${r.wide.length ? "\n      " + r.wide.join("\n      ") : ""}`);
  };
  const go = async (path, name = path) => {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(150);
    await report(name);
  };

  await go("/");
  await page.locator('button[aria-label="Menu"], button:has-text("Menu"), [aria-controls="site-menu"]').first().click().catch(() => {});
  await page.waitForTimeout(200);
  await report("/ menu open");
  await page.keyboard.press("Escape");
  await page.locator("text=Pickup").first().click().catch(() => {});
  await page.waitForTimeout(200);
  await report("/ calendar open");
  await go("/bikes");
  const slug = await page.locator('a[href^="/bikes/"]').first().getAttribute("href");
  if (slug) await go(slug, "/bikes/:slug");
  await go("/choose");
  await go("/tours");
  const tour = await page.locator('a[href^="/tours/"]').first().getAttribute("href");
  if (tour) await go(tour, "/tours/:slug");
  await go("/tours/viewpoint-nordadalsskard?riders=2", "/tours/:slug riders=2");

  // the funnel with two riders, the second bike being the longest name in stock
  await go(`/riders?${Q}`, "/riders bike step");
  await page.fill('input[name="heightCm"]', "172");
  await page.getByRole("heading", { name: /Free for 172 cm/ }).waitFor();
  await clickAndWait(page.getByRole("button", { name: /^Give to/ }).last());
  await report("/riders extras step");
  await clickAndWait(page.getByRole("button", { name: /Yes — add a helmet/ }));
  await report("/riders extras, helmet added");
  await clickAndWait(page.getByRole("button", { name: /^Done — now|Continue to checkout/ }));
  await report("/riders rider 2 bike step");
  await page.fill('input[name="heightCm"]', "180");
  await page.getByRole("heading", { name: /Free for 180 cm/ }).waitFor();
  await clickAndWait(page.getByRole("button", { name: /^Give to/ }).first());
  await clickAndWait(page.getByRole("button", { name: /^No — / }));
  await report("/riders rider 2 extras");
  await clickAndWait(page.getByRole("button", { name: /Continue to checkout/ }));
  await report("/checkout");
  await page.fill('input[name="name"]', "Sweep Test");
  await page.fill('input[name="email"]', "sweep@example.fo");
  const card = page.locator('input[name="pay"][value="card"]');
  if (await card.count()) await card.check();
  await clickAndWait(page.getByRole("button", { name: /^Book/ }));
  if (page.url().includes("/pay/")) {
    await page.locator("[data-fake-epay], #epay-fields").first().waitFor({ timeout: 10000 }).catch(() => {});
    await report("/pay/:code");
    const code = page.url().split("/pay/")[1];
    await go(`/booked/${code}`, "/booked/:code (held)");
    await go(`/booking?code=${code}`, "/booking");
    await page.fill('input[name="email"]', "sweep@example.fo");
    await clickAndWait(page.getByRole("button", { name: "Find it" }));
    await report("/booking found");
  } else {
    await report("/booked/:code");
  }
  await go("/booked/NOPE00", "/booked 404");

  // the counter
  await go("/admin/login");
  await page.fill('input[name="name"]', "Sweep");
  await page.fill('input[name="password"]', "counter");
  await clickAndWait(page.getByRole("button", { name: "Log in" }));
  await report("/admin today");
  await go("/admin/bookings?when=all", "/admin/bookings");
  const first = await page.locator('a[href^="/admin/bookings/"]').first().getAttribute("href");
  if (first) await go(first, "/admin/bookings/:id");
  await go("/admin/stock");
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} screen(s) wider than the phone` : "\nnothing wider than the phone");
process.exit(failures ? 1 : 0);

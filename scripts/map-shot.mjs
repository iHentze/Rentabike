/**
 * Screenshots of /map at a desktop and a phone width, with a feature open.
 *
 *   npm run dev
 *   node scripts/map-shot.mjs [http://localhost:5173] [outDir]
 *
 * Tiles come from the open internet; where the browser has no route to them
 * the land stays flat green and the check is of our own layers and panels.
 */
import { chromium } from "playwright-core";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173";
const out = process.argv[3] ?? ".wrangler/shots";
mkdirSync(out, { recursive: true });
const found = execSync("find /opt/pw-browsers -maxdepth 3 -type f -name chrome 2>/dev/null | head -1").toString().trim();
const browser = await chromium.launch({ executablePath: process.env.CHROME || found || undefined, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });

const shots = [
  ["desktop", { width: 1280, height: 800 }, "/map"],
  ["desktop-tunnel", { width: 1280, height: 800 }, "/map?f=tunnel:E"],
  ["phone", { width: 400, height: 800 }, "/map"],
  ["phone-legend", { width: 400, height: 800 }, "/map", "legend"],
];

for (const [name, viewport, path, extra] of shots) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}${path}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__faroeMap?.loaded?.(), null, { timeout: 30000 }).catch(() => console.log(`${name}: map did not report loaded (tiles unreachable?)`));
  if (extra === "legend") await page.getByRole("button", { name: /Legend/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`${name}: ${out}/${name}.png${errors.length ? `\n  page errors: ${errors.join("; ")}` : ""}`);
  await ctx.close();
}
await browser.close();

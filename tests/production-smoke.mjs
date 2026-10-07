// Against a running local production server. Only public GETs; no account mutation.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import fs from "node:fs";
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3108";
for (const route of [
  "/dashboard",
  "/marketplace",
  "/marketplace/00000000-0000-4000-8000-000000000000",
  "/orders",
  "/orders/00000000-0000-4000-8000-000000000000",
  "/profile",
  "/settings",
  "/admin",
  "/admin/inventory",
  "/admin/users",
  "/admin/orders",
  "/admin/disputes",
  "/admin/audit",
]) {
  const response = await fetch(base + route, { redirect: "manual" });
  assert.equal(response.status, 307, route);
  assert.equal(
    new URL(response.headers.get("location"), base).pathname,
    "/login",
    route,
  );
  console.log(`PASS: ${route} redirects anonymous visitors to login`);
}
const unsubscribe = await fetch(base + "/unsubscribe?token=" + "a".repeat(64), {
  redirect: "manual",
});
assert.equal(unsubscribe.status, 200);
assert.equal(unsubscribe.headers.get("referrer-policy"), "no-referrer");
assert.match(unsubscribe.headers.get("cache-control"), /no-store/);
assert.match(unsubscribe.headers.get("x-robots-tag"), /noindex/);
console.log("PASS: public unsubscribe returns privacy headers without login");
fs.mkdirSync("artifacts/screenshots", { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
});
try {
  const page = await browser.newPage();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/", "/about", "/login", "/register"]) {
      await page.goto(base + route);
      await page.locator("main h1").waitFor();
      if (route === "/")
        await page.waitForFunction(
          () => !document.querySelector(".loading-state"),
          { timeout: 20000 },
        );
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForFunction(() =>
        Array.from(document.images).every((image) => image.complete),
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} overflow at ${width}`,
      );
      await page.screenshot({
        path: `artifacts/screenshots/${route === "/" ? "home" : route.slice(1)}-${width === 1440 ? "desktop" : "mobile"}-live.png`,
        fullPage: true,
      });
    }
  }
  console.log(
    "PASS: public pages render at desktop and mobile widths; live screenshots saved",
  );
} finally {
  await browser.close();
}

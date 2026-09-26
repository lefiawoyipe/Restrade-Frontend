import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { mockBackend } from "./fixtures";

const screenshots = path.resolve("artifacts/screenshots");
test.beforeAll(() => fs.mkdirSync(screenshots, { recursive: true }));

test("marketplace filters, sorts and persists saved selections", async ({
  page,
}) => {
  const requests = await mockBackend(page);
  await page.goto("/marketplace");
  await expect(page.locator(".product")).toHaveCount(6);
  await page.getByRole("button", { name: "Books", exact: true }).click();
  await expect(page.locator(".product")).toHaveCount(1);
  await expect(page.locator(".product")).toContainText("Reading bundle");
  await page
    .getByRole("button", { name: "Save Reading bundle", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unsave Reading bundle" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page.getByRole("button", { name: "Saved items", exact: true }).click();
  await expect(page.locator(".product")).toHaveCount(1);
  expect(
    requests.some((r) => r.path.endsWith("saved_items") && r.method === "POST"),
  ).toBeTruthy();
  await page.getByRole("button", { name: "All items", exact: true }).click();
  await page.getByLabel("Sort listings").selectOption("low");
  await expect(page.locator(".product").first()).toContainText(
    "Reading bundle",
  );
  await page.screenshot({
    path: path.join(screenshots, "marketplace-desktop-fixture.png"),
    fullPage: true,
  });
});

test("search includes products beyond the first API page", async ({ page }) => {
  const requests = await mockBackend(page, { manyProducts: true });
  await page.goto("/marketplace?q=Second%20page%20treasure");
  await expect(page.locator(".product")).toHaveCount(1);
  await expect(page.locator(".product")).toContainText("Second page treasure");
  expect(
    requests.filter((r) => r.path.endsWith("/products")).length,
  ).toBeGreaterThanOrEqual(2);
});

test("mobile marketplace keeps search and two columns; drawer restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page);
  await page.goto("/marketplace");
  await expect(page.locator(".product")).toHaveCount(6);
  await expect(page.getByLabel("Search marketplace")).toBeVisible();
  expect(
    await page
      .locator(".products")
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
      ),
  ).toBe(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  expect(
    await drawer.evaluate((el) => el.contains(document.activeElement)),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await page.screenshot({
    path: path.join(screenshots, "marketplace-mobile-fixture.png"),
    fullPage: true,
  });
});

test("receipt requires inspection acknowledgement and failed release never shows success", async ({
  page,
}) => {
  const requests = await mockBackend(page, { failRelease: true });
  await page.goto("/orders");
  await page
    .getByRole("button", { name: "Confirm receipt", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("GH₵ 2,800.00");
  await dialog.getByRole("button", { name: "Confirm & release funds" }).click();
  expect(
    requests.filter((r) => r.path.endsWith("release_escrow")),
  ).toHaveLength(0);
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Confirm & release funds" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Release rejected by server",
  );
  await expect(
    page.getByText("Receipt confirmed. Payment released to the seller."),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Not yet" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm receipt", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: path.join(screenshots, "orders-desktop-fixture.png"),
    fullPage: true,
  });
});

test("dispute sends reason and description to the supported RPC", async ({
  page,
}) => {
  const requests = await mockBackend(page);
  await page.goto("/orders");
  await page.getByRole("button", { name: "Report a problem" }).click();
  await page
    .getByRole("combobox", { name: "Reason", exact: true })
    .selectOption("Item not as described");
  await page
    .getByLabel("What happened?")
    .fill("The item differs from the description.");
  await page.getByRole("button", { name: "Submit dispute" }).click();
  await expect(page.getByRole("status")).toContainText("Dispute opened");
  expect(
    requests.find((r) => r.path.endsWith("/open_dispute"))?.body,
  ).toMatchObject({
    p_reason: "Item not as described",
    p_description: "The item differs from the description.",
  });
});

test("settings save persists across reload and profile shows real reputation", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/settings");
  await page.getByLabel("Marketplace updates").check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved");
  await page.reload();
  await expect(page.getByLabel("Marketplace updates")).toBeChecked();
  await page.screenshot({
    path: path.join(screenshots, "settings-desktop-fixture.png"),
    fullPage: true,
  });
  await page.goto("/profile");
  await expect(page.locator(".rating-big")).toContainText("4.7");
  await expect(page.getByText("No reviews yet")).toHaveCount(0);
  await page.screenshot({
    path: path.join(screenshots, "profile-desktop-fixture.png"),
    fullPage: true,
  });
});

test("query failures are not presented as empty listings or zero balance", async ({
  page,
}) => {
  await mockBackend(page, { failProducts: true });
  await page.goto("/marketplace");
  await expect(page.locator(".feedback[role=alert]")).toContainText(
    "Listings temporarily unavailable",
    { timeout: 20000 },
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByText("No items found.")).toHaveCount(0);
  await page.unrouteAll({ behavior: "wait" });
  await mockBackend(page, { failWallet: true });
  await page.goto("/dashboard");
  await expect(page.locator(".feedback[role=alert]")).toContainText(
    "Wallet unavailable",
    { timeout: 20000 },
  );
  await expect(page.locator(".balance")).toHaveCount(0);
});

test("admin must review a reason and confirm before resolving a case", async ({
  page,
}) => {
  const requests = await mockBackend(page, { admin: true });
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: "Review case" })).toBeVisible();
  await page.screenshot({
    path: path.join(screenshots, "admin-desktop-fixture.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Review case" }).click();
  await page
    .getByRole("combobox", { name: "Resolution", exact: true })
    .selectOption("buyer");
  await page
    .getByLabel("Decision reason")
    .fill("Evidence supports refunding the buyer.");
  await page.getByRole("button", { name: "Review decision" }).click();
  expect(
    requests.some((r) => r.path.endsWith("/resolve_dispute_with_note")),
  ).toBeFalsy();
  await page.getByRole("button", { name: "Confirm resolution" }).click();
  await expect(page.getByRole("status")).toContainText("Resolution recorded");
  expect(
    requests.find((r) => r.path.endsWith("/resolve_dispute_with_note"))?.body,
  ).toMatchObject({
    p_favor_buyer: true,
    p_note: "Evidence supports refunding the buyer.",
  });
});

test("listing sends supported fields and rejects unsupported photo types", async ({
  page,
}) => {
  const requests = await mockBackend(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sell an item", exact: true }).click();
  await page.getByLabel("Item title").fill("Useful lamp");
  await page.getByLabel("Price (GH₵)").fill("125.50");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Room essentials");
  await page
    .getByRole("combobox", { name: "Condition", exact: true })
    .selectOption("good");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Working lamp with a small scratch.");
  await page.getByLabel("Item photo").setInputFiles({
    name: "bad.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("GIF89a"),
  });
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page.locator(".feedback[role=alert]")).toContainText(
    "JPEG or PNG",
  );
  expect(
    requests.some((r) => r.path.endsWith("/products") && r.method === "POST"),
  ).toBeFalsy();
  await page.getByLabel("Item photo").setInputFiles([]);
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    requests.find((r) => r.path.endsWith("/products") && r.method === "POST")
      ?.body,
  ).toMatchObject({
    title: "Useful lamp",
    price: 125.5,
    condition: "good",
    category: "Room essentials",
  });
});

test("main screens fit desktop, tablet and narrow phone widths", async ({
  page,
}) => {
  await mockBackend(page);
  for (const width of [1440, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/",
      "/about",
      "/login",
      "/register",
      "/dashboard",
      "/profile",
      "/settings",
      "/orders",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBeTruthy();
      await expect(page.locator("main main")).toHaveCount(0);
      if ([1440, 390].includes(width))
        await page.screenshot({
          path: path.join(
            screenshots,
            `${route === "/" ? "home" : route.slice(1)}-${width === 1440 ? "desktop" : "mobile"}-fixture.png`,
          ),
          fullPage: true,
        });
    }
  }
});

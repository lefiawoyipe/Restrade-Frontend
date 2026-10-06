import { expect, test } from "@playwright/test";
import { mockBackend, products } from "./fixtures";
import { VersionTracker } from "../src/lib/version-tracker";

test("version reconciliation handles baseline races, bigint order and new topics", () => {
  const changes: string[] = [];
  const tracker = new VersionTracker((topic) => changes.push(topic));
  tracker.reconcile([{ topic: "marketplace", version: "9" }]);
  expect(changes).toEqual([]);
  tracker.event({ topic: "marketplace", version: "10" });
  tracker.event({ topic: "marketplace", version: "9" });
  tracker.reconcile([{ topic: "marketplace", version: "10" }]);
  expect(changes).toEqual(["marketplace"]);
  tracker.event({ topic: "user:new", version: "1" });
  tracker.event({ topic: "marketplace", version: "9007199254740993" });
  expect(changes).toEqual(["marketplace", "user:new", "marketplace"]);
  const raced: string[] = [];
  const baseline = new VersionTracker((topic) => raced.push(topic));
  baseline.event({ topic: "marketplace", version: 2 });
  baseline.reconcile([{ topic: "marketplace", version: 2 }]);
  expect(raced).toEqual(["marketplace"]);
});

test("recommendation consent defaults off, persists explicitly and never writes the table", async ({
  page,
}) => {
  const requests = await mockBackend(page);
  await page.goto("/settings");
  const toggle = page.getByRole("checkbox", {
    name: /Email me when new items/,
  });
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(
    page.getByText("Email preference saved. Delivery is pending setup."),
  ).toBeVisible();
  expect(
    requests.find((r) => r.path.endsWith("/set_recommendation_email"))?.body,
  ).toEqual({ p_enabled: true });
  expect(
    requests.some(
      (r) =>
        r.path.endsWith("/recommendation_preferences") && r.method !== "GET",
    ),
  ).toBe(false);
  await page.reload();
  await expect(toggle).toBeChecked();
});

test("failed consent leaves the toggle off and displays the error", async ({
  page,
}) => {
  await mockBackend(page, { failRecommendation: true });
  await page.goto("/settings");
  const toggle = page.getByRole("checkbox", {
    name: /Email me when new items/,
  });
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(page.getByText("Preference could not be saved")).toBeVisible();
});

test("unsubscribe requires explicit confirmation and strips its token from the URL", async ({
  page,
}) => {
  let calls = 0;
  await page.route("https://*.supabase.co/**", (route) => {
    expect(route.request().url()).toContain("/rpc/unsubscribe_recommendations");
    expect(route.request().postDataJSON()).toEqual({ p_token: "a".repeat(64) });
    calls++;
    return route.fulfill({ contentType: "application/json", body: "null" });
  });
  await page.goto(`/unsubscribe?token=${"a".repeat(64)}`);
  await expect(
    page.getByRole("button", { name: "Confirm unsubscribe" }),
  ).toBeEnabled();
  expect(calls).toBe(0);
  await expect(page).toHaveURL(/\/unsubscribe$/);
  await page.getByRole("button", { name: "Confirm unsubscribe" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your request has been processed",
  );
  expect(calls).toBe(1);
});

test("suspension disables new trades while keeping settlement access", async ({
  page,
}) => {
  await mockBackend(page, { suspended: true });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("button", { name: "Sell an item", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Top up test balance" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }).first(),
  ).toBeDisabled();
  await page.goto("/orders");
  await expect(
    page.getByRole("button", { name: "Confirm receipt", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Report a problem" }),
  ).toBeEnabled();
});

test("admin moderation needs a reason and confirmation and has no trading navigation", async ({
  page,
}) => {
  const requests = await mockBackend(page, { admin: true });
  await page.goto("/admin/inventory");
  await expect(
    page.getByRole("button", { name: "Sell an item", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Hide listing", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Violates listing rules");
  await page.getByRole("button", { name: "Review action" }).click();
  expect(requests.some((r) => r.path.endsWith("/admin_moderate_product"))).toBe(
    false,
  );
  await page.getByRole("button", { name: "Confirm hide listing" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    requests.find((r) => r.path.endsWith("/admin_moderate_product"))?.body,
  ).toMatchObject({ p_hidden: true, p_reason: "Violates listing rules" });
});

test("admin suspension excludes administrators and uses the guarded RPC", async ({
  page,
}) => {
  const requests = await mockBackend(page, { admin: true });
  await page.goto("/admin/users");
  await expect(
    page.getByRole("button", { name: "Suspend trading", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Suspend trading", exact: true })
    .click();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Repeated trading violations");
  await page.getByRole("button", { name: "Review action" }).click();
  await page.getByRole("button", { name: "Confirm suspend trading" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    requests.find((r) => r.path.endsWith("/admin_suspend_trading"))?.body,
  ).toMatchObject({
    p_suspended: true,
    p_reason: "Repeated trading violations",
  });
});

test("legacy uncategorized edits omit category and hidden listings cannot be edited", async ({
  page,
}) => {
  const requests = await mockBackend(page);
  await page.route("**/rest/v1/products?*", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        { ...products[0], category: null },
        { ...products[1], moderation_status: "hidden" },
      ]),
    });
  });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }).nth(1),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await expect(
    page.getByRole("combobox", { name: "Category", exact: true }),
  ).toHaveValue("");
  await page.getByLabel("Item title").fill("Updated legacy listing");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const update = requests.find(
    (r) => r.path.endsWith("/products") && r.method === "PATCH",
  );
  expect(update?.body?.title).toBe("Updated legacy listing");
  expect(update?.body).not.toHaveProperty("category");
  expect(update?.body).not.toHaveProperty("moderation_status");
});

test("marketplace query explicitly excludes hidden and ineligible sellers", async ({
  page,
}) => {
  await mockBackend(page);
  const queries: URL[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/rest/v1/products?"))
      queries.push(new URL(request.url()));
  });
  await page.goto("/marketplace");
  await expect(page.locator(".product")).toHaveCount(6);
  expect(queries[0].searchParams.get("status")).toBe("eq.available");
  expect(queries[0].searchParams.get("moderation_status")).toBe("eq.visible");
  expect(queries[0].searchParams.get("seller.is_admin")).toBe("not.is.true");
  expect(queries[0].searchParams.get("seller.is_suspended")).toBe("eq.false");
  expect(queries[0].searchParams.get("select")).toContain("!inner");
});

test("failed moderation retains the reason and audit stays read-only and paginated", async ({
  page,
}) => {
  const requests = await mockBackend(page, { admin: true });
  await page.route("**/rest/v1/rpc/admin_moderate_product", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ message: "Moderation could not be saved" }),
    }),
  );
  await page.goto("/admin/inventory");
  await page
    .getByRole("button", { name: "Hide listing", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Reason to retain after failure");
  await page.getByRole("button", { name: "Review action" }).click();
  await page.getByRole("button", { name: "Confirm hide listing" }).click();
  await expect(page.getByText("Moderation could not be saved")).toBeVisible();
  await expect(page.getByLabel("Reason", { exact: true })).toHaveValue(
    "Reason to retain after failure",
  );
  const offsets: string[] = [];
  await page.route("**/rest/v1/admin_audit_log?*", (route) => {
    const url = new URL(route.request().url());
    offsets.push(url.searchParams.get("offset") ?? "0");
    expect(url.searchParams.get("order")).toBe("created_at.desc,id.desc");
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        Array.from({ length: 26 }, (_, i) => ({
          id: `audit-${offsets.at(-1)}-${i}`,
          actor_id: "admin",
          target_id: "item",
          action: "moderate_product",
          reason: "Recorded reason",
          details: { hidden: true },
          created_at: "2026-10-05T12:00:00Z",
        })),
      ),
    });
  });
  await page.goto("/admin/audit");
  await expect(page.locator("article")).toHaveCount(25);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect.poll(() => offsets).toContain("25");
  expect(
    requests.some(
      (r) => r.path.endsWith("/admin_audit_log") && r.method !== "GET",
    ),
  ).toBe(false);
});

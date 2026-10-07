import { expect, test } from "@playwright/test";
import { mockBackend, order, uid, sellerId } from "./fixtures";

const detail = `/orders/${order.id}`;
test("pickup validates order binding and requires separate receipt acknowledgement", async ({
  page,
}) => {
  const requests = await mockBackend(page, { pickup: true });
  await page.goto(detail);
  await expect(
    page.getByRole("heading", { name: "Local pickup" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept item & release test funds" }),
  ).toHaveCount(0);
  await page.getByLabel("Paste pickup code or QR payload").fill(
    JSON.stringify({
      type: "restrade-pickup",
      order_id: "wrong-order",
      token: "a".repeat(64),
    }),
  );
  await page
    .getByRole("button", { name: "Review pickup confirmation" })
    .click();
  await expect(page.locator(".feedback[role=alert]")).toContainText(
    "does not match this order",
  );
  expect(requests.some((r) => r.path.endsWith("/confirm_pickup"))).toBeFalsy();
  await page.getByLabel("Paste pickup code or QR payload").fill("a".repeat(64));
  await page
    .getByRole("button", { name: "Review pickup confirmation" })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm received item" }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "I have received this item" })
    .check();
  await page.getByRole("button", { name: "Confirm received item" }).click();
  await expect(
    page.getByRole("button", { name: "Accept item & release test funds" }),
  ).toBeVisible();
  expect(
    requests.filter((r) => r.path.endsWith("/confirm_pickup")),
  ).toHaveLength(1);
  expect(requests.some((r) => r.path.endsWith("/release_escrow"))).toBeFalsy();
  await expect(
    page.getByText("Inspection deadline", { exact: false }).first(),
  ).toBeVisible();
});

test("seller generates QR locally, throttles replacement and forgets tokens on navigation", async ({
  page,
}) => {
  const requests = await mockBackend(page, { pickup: true, seller: true });
  await page.goto(detail);
  await page
    .getByRole("button", { name: "Ready for pickup / Show pickup code" })
    .click();
  await expect(page.getByAltText("Order-bound pickup QR code")).toHaveAttribute(
    "src",
    /^data:image\/png;base64,/,
  );
  await expect(page.getByLabel("Pickup code", { exact: true })).toHaveValue(
    "a".repeat(64),
  );
  await expect(
    page.getByRole("button", { name: "Replace pickup code" }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Ready for pickup / Show pickup code" }),
  ).toBeVisible();
  await expect(page.getByAltText("Order-bound pickup QR code")).toHaveCount(0);
  expect(
    requests.filter((r) => r.path.endsWith("/create_pickup_challenge")),
  ).toHaveLength(1);
});

test("expired pickup waits for server without a browser financial mutation or polling", async ({
  page,
}) => {
  const requests = await mockBackend(page, { pickup: true });
  await page.route("**/rest/v1/orders?**", (route) =>
    route.fulfill({
      json: [
        {
          ...order,
          workflow_version: 2,
          fulfillment_status: "awaiting_pickup",
          pickup_due_at: new Date(Date.now() - 1000).toISOString(),
        },
      ],
    }),
  );
  await page.goto(detail);
  await expect(page.getByText(/Deadline reached.*processing/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start QR scanner" }),
  ).toBeDisabled();
  const before = requests.length;
  await page.waitForTimeout(2500);
  expect(requests.length).toBe(before);
  expect(
    requests.some((r) => /release_escrow|confirm_pickup|refund/.test(r.path)),
  ).toBeFalsy();
});

test("snapshot and resolved case remain available after refund; cancelled pickup cannot be reviewed", async ({
  page,
}) => {
  await mockBackend(page);
  await page.route("**/rest/v1/orders?**", (route) =>
    route.fulfill({
      json: [
        {
          ...order,
          status: "refunded",
          workflow_version: 2,
          fulfillment_status: "cancelled",
          item_snapshot: {
            title: "Original purchased title",
            condition: "good",
            price: 2800,
          },
          product: { ...order.product, title: "Changed listing title" },
        },
      ],
    }),
  );
  await page.goto(detail);
  await expect(
    page.getByRole("heading", { name: "Original purchased title" }),
  ).toBeVisible();
  await expect(page.getByText("Changed listing title")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Leave a review" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Order history" }),
  ).toBeVisible();
});

test("evidence verification failure retries the same private path without another upload", async ({
  page,
}) => {
  const requests = await mockBackend(page, { pickup: true, disputed: true });
  const paths: string[] = [];
  let uploads = 0;
  await page.route(
    "**/storage/v1/object/dispute-evidence/**",
    async (route) => {
      expect(route.request().headers()["x-upsert"]).toBe("false");
      uploads++;
      await route.fulfill({ json: { Key: "uploaded" } });
    },
  );
  await page.route("**/functions/v1/verify-case-evidence", async (route) => {
    const body = route.request().postDataJSON();
    paths.push(body.object_path);
    expect(body.order_id).toBe(order.id);
    await route.fulfill(
      paths.length === 1
        ? { status: 503, json: { message: "Temporary verification failure" } }
        : {
            json: {
              evidence_id: "evidence-1",
              verified: true,
              sha256: "b".repeat(64),
            },
          },
    );
  });
  await page.goto(detail);
  await page.getByRole("button", { name: "View case and agreements" }).click();
  await page.getByLabel("Add evidence").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });
  await page
    .getByRole("button", { name: "Upload and verify evidence" })
    .click();
  await expect(page.locator(".feedback[role=alert]")).toContainText(
    "server verification failed",
  );
  await expect(
    page.getByRole("button", { name: "Upload and verify evidence" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry verification of uploaded file" })
    .click();
  await expect(page.locator(".feedback[role=status]")).toContainText(
    "Evidence verified by the server",
  );
  expect(uploads).toBe(1);
  expect(paths).toHaveLength(2);
  expect(paths[1]).toBe(paths[0]);
  expect(paths[0]).toMatch(new RegExp(`^${order.id}/${uid}/[a-f0-9-]+\\.png$`));
  expect(
    requests.some((r) =>
      /record_evidence_hash|register_case_evidence/.test(r.path),
    ),
  ).toBeFalsy();
});

test("only the other party can accept an offer and acceptance has a separate confirmation", async ({
  page,
}) => {
  const requests = await mockBackend(page, { pickup: true, disputed: true });
  const base = {
    order_id: order.id,
    outcome: "refund",
    state: "pending",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    created_at: new Date().toISOString(),
  };
  await page.route("**/rest/v1/settlement_offers?**", (route) =>
    route.fulfill({
      json: [
        { ...base, id: "own-offer", proposed_by: uid, terms: "My own offer" },
        {
          ...base,
          id: "other-offer",
          proposed_by: sellerId,
          terms: "Full refund without return",
        },
      ],
    }),
  );
  let accepted: unknown;
  await page.route("**/rest/v1/rpc/respond_settlement", (route) => {
    accepted = route.request().postDataJSON();
    return route.fulfill({ json: null });
  });
  await page.goto(detail);
  await page.getByRole("button", { name: "View case and agreements" }).click();
  await expect(
    page.getByRole("button", { name: "Review acceptance" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Review acceptance" }).click();
  expect(accepted).toBeUndefined();
  const confirmation = page.getByRole("group", { name: "Confirm settlement" });
  await expect(confirmation).toContainText("Full refund without return");
  await expect(confirmation).toContainText("2,800.00");
  await confirmation.getByRole("button", { name: "Confirm agreement" }).click();
  await expect
    .poll(() => accepted)
    .toEqual({ p_offer_id: "other-offer", p_accept: true });
  expect(requests.some((r) => r.path.endsWith("/release_escrow"))).toBeFalsy();
});

test("admin private queries wait for explicit audited access and expire without renewal", async ({
  page,
}) => {
  const requests = await mockBackend(page, { admin: true });
  await page.goto("/admin/disputes");
  await page.getByRole("button", { name: "Review case" }).click();
  const privateRead = (path: string) =>
    /\/(disputes|dispute_messages|case_evidence|settlement_offers|order_events)$/.test(
      path,
    ) || path.includes("/storage/");
  expect(requests.some((r) => privateRead(r.path))).toBeFalsy();
  await page
    .getByLabel("Case access purpose")
    .fill("Review the escalated dispute");
  await page.getByRole("button", { name: "Open case with audit" }).click();
  await expect(
    page.getByRole("heading", { name: "Case conversation" }),
  ).toBeVisible();
  const grant = requests.findIndex((r) => r.path.endsWith("/admin_open_case"));
  expect(requests.findIndex((r) => privateRead(r.path))).toBeGreaterThan(grant);
  await page.clock.install();
  await page.clock.fastForward(601000);
  await expect(
    page.getByRole("button", { name: "Reopen case with audit" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Case conversation" }),
  ).toHaveCount(0);
  expect(
    requests.filter((r) => r.path.endsWith("/admin_open_case")),
  ).toHaveLength(1);
});

test("return receipt is seller-only, requires confirmation and refunds through confirm_return", async ({
  page,
}) => {
  await mockBackend(page, { pickup: true, disputed: true, seller: true });
  await page.route("**/rest/v1/disputes?**", (route) =>
    route.fulfill({
      json: {
        order_id: order.id,
        stage: "return_pending",
        reason: "Return agreed",
        description: "Return for full refund",
        return_due_at: new Date(Date.now() + 3600000).toISOString(),
        resolved_at: null,
      },
    }),
  );
  let confirmed = 0;
  await page.route("**/rest/v1/rpc/confirm_return", (route) => {
    confirmed++;
    return route.fulfill({ json: null });
  });
  await page.goto(detail);
  await page.getByRole("button", { name: "View case and agreements" }).click();
  await page
    .getByRole("button", { name: "Confirm returned item received" })
    .click();
  expect(confirmed).toBe(0);
  await expect(
    page.getByRole("group", { name: "Confirm settlement" }),
  ).toContainText("refunds the full test-wallet amount");
  await page.getByRole("button", { name: "Confirm agreement" }).click();
  await expect.poll(() => confirmed).toBe(1);
});

test("a rejected pickup code never shows inspection or triggers a release", async ({
  page,
}) => {
  const requests = await mockBackend(page, { pickup: true });
  await page.route("**/rest/v1/rpc/confirm_pickup", (route) =>
    route.fulfill({
      status: 400,
      json: { message: "Pickup token expired or already consumed" },
    }),
  );
  await page.goto(detail);
  await page.getByLabel("Paste pickup code or QR payload").fill("a".repeat(64));
  await page
    .getByRole("button", { name: "Review pickup confirmation" })
    .click();
  await page
    .getByRole("checkbox", { name: "I have received this item" })
    .check();
  await page.getByRole("button", { name: "Confirm received item" }).click();
  await expect(page.locator(".feedback[role=alert]")).toContainText(
    "expired or already consumed",
  );
  await expect(
    page.getByRole("button", { name: "Accept item & release test funds" }),
  ).toHaveCount(0);
  expect(requests.some((r) => r.path.endsWith("/release_escrow"))).toBeFalsy();
});

test("admin locks prepared terms, freshly authenticates, and reconciles a committed decision after a lost response", async ({
  page,
}) => {
  const requests = await mockBackend(page, { admin: true });
  let executed = false;
  const calls: string[] = [];
  await page.route("**/rest/v1/rpc/execute_case_decision", (route) => {
    executed = true;
    calls.push("execute");
    return route.fulfill({ status: 504, json: { message: "Response lost" } });
  });
  await page.route("**/rest/v1/orders?**", async (route) => {
    if (!executed) return route.fallback();
    calls.push("reconcile-order");
    return route.fulfill({
      json: { status: "refunded", settled_at: new Date().toISOString() },
    });
  });
  await page.route("**/rest/v1/admin_audit_log?**", async (route) => {
    calls.push("reconcile-audit");
    return route.fulfill({
      json: [
        {
          id: "audit-1",
          action: "case_decision",
          details: { outcome: "refund" },
        },
      ],
    });
  });
  await page.goto("/admin/disputes");
  await page.getByRole("button", { name: "Review case" }).click();
  await page
    .getByLabel("Case access purpose")
    .fill("Review the escalated dispute");
  await page.getByRole("button", { name: "Open case with audit" }).click();
  await page
    .getByRole("combobox", { name: "Resolution", exact: true })
    .selectOption("refund");
  await page
    .getByLabel("Decision reason")
    .fill("Evidence supports a full refund.");
  await page.getByRole("button", { name: "Review decision" }).click();
  await page
    .getByRole("button", { name: "Prepare decision for fresh authentication" })
    .click();
  await expect(page.getByLabel("Decision reason")).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Resolution", exact: true }),
  ).toBeDisabled();
  expect(executed).toBeFalsy();
  await page.getByLabel("Fresh authenticator code").fill("123456");
  await page
    .getByRole("button", { name: "Verify and execute prepared decision" })
    .click();
  await expect(page.locator(".feedback[role=status]")).toContainText(
    "Test wallet refunded",
  );
  expect(calls[0]).toBe("execute");
  expect(calls.slice(1).sort()).toEqual(["reconcile-audit", "reconcile-order"]);
  const paths = requests.map((r) => r.path);
  expect(paths.findIndex((p) => p.endsWith("/challenge"))).toBeGreaterThan(
    paths.findIndex((p) => p.endsWith("/prepare_case_decision")),
  );
  expect(paths.findIndex((p) => p.endsWith("/verify"))).toBeGreaterThan(
    paths.findIndex((p) => p.endsWith("/challenge")),
  );
  await expect(
    page.getByRole("button", { name: "Verify and execute prepared decision" }),
  ).toHaveCount(0);
});

test("prepared admin decision expires and cannot execute using the old intent", async ({
  page,
}) => {
  const requests = await mockBackend(page, { admin: true });
  await page.goto("/admin/disputes");
  await page.getByRole("button", { name: "Review case" }).click();
  await page
    .getByLabel("Case access purpose")
    .fill("Review the escalated dispute");
  await page.getByRole("button", { name: "Open case with audit" }).click();
  await page
    .getByRole("combobox", { name: "Resolution", exact: true })
    .selectOption("release");
  await page
    .getByLabel("Decision reason")
    .fill("Evidence supports a full release.");
  await page.getByRole("button", { name: "Review decision" }).click();
  await page
    .getByRole("button", { name: "Prepare decision for fresh authentication" })
    .click();
  await expect(page.getByLabel("Fresh authenticator code")).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(301000);
  await expect(page.getByText(/five-minute intent expired/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verify and execute prepared decision" }),
  ).toBeDisabled();
  expect(
    requests.some(
      (r) =>
        r.path.endsWith("/execute_case_decision") ||
        r.path.endsWith("/challenge"),
    ),
  ).toBeFalsy();
});

test("pickup details and case controls fit narrow screens", async ({
  page,
}) => {
  await mockBackend(page, { pickup: true, disputed: true });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(detail);
  await expect(
    page.getByRole("heading", { name: "Study laptop", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "View case and agreements" }).click();
  await expect(
    page.getByRole("heading", { name: "Agreements and negotiation" }),
  ).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBeTruthy();
  await page.screenshot({
    path: "artifacts/screenshots/pickup-case-mobile-fixture.png",
    fullPage: true,
  });
});

import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";
import { mockBackend, products, uid } from "./fixtures";

async function versionSocket(page: Page) {
  let socket: WebSocketRoute;
  let topic = "",
    joinRef: string | null = null;
  let joins = 0;
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    socket = ws;
    ws.onMessage((message) => {
      const raw = JSON.parse(String(message));
      const [join, ref, name, event, payload] = Array.isArray(raw)
        ? raw
        : [raw.join_ref, raw.ref, raw.topic, raw.event, raw.payload];
      const send = (response: unknown) =>
        ws.send(
          JSON.stringify(
            Array.isArray(raw)
              ? [join, ref, name, "phx_reply", response]
              : { topic: name, event: "phx_reply", ref, payload: response },
          ),
        );
      if (event === "phx_join") {
        topic = name;
        joinRef = join;
        joins++;
        send({
          status: "ok",
          response: {
            postgres_changes: payload.config.postgres_changes.map(
              (filter: object, i: number) => ({ ...filter, id: i + 1 }),
            ),
          },
        });
      } else if (event === "heartbeat" || event === "phx_leave")
        send({ status: "ok", response: {} });
    });
  });
  return {
    joins: () => joins,
    disconnect() {
      socket.close({ code: 1001, reason: "Test reconnect" });
    },
    emit(version: number, scope = "marketplace", type = "UPDATE") {
      socket.send(
        JSON.stringify([
          joinRef,
          null,
          topic,
          "postgres_changes",
          {
            ids: [type === "INSERT" ? 1 : 2],
            data: {
              schema: "public",
              table: "data_versions",
              type,
              commit_timestamp: new Date().toISOString(),
              columns: [
                { name: "topic", type: "text" },
                { name: "version", type: "int8" },
              ],
              record: { topic: scope, version },
              old_record: {},
              errors: null,
            },
          },
        ]),
      );
    },
  };
}

test("realtime uses one connection, fixed windows and no idle reloads", async ({
  page,
}) => {
  const requests = await mockBackend(page);
  const socket = await versionSocket(page);
  await page.clock.install();
  await page.goto("/marketplace");
  await expect(page.locator(".product")).toHaveCount(6);
  await expect
    .poll(
      () => requests.filter((r) => r.path.endsWith("/data_versions")).length,
    )
    .toBe(1);
  expect(socket.joins()).toBe(1);
  const reads = () =>
    requests.filter((r) => r.path.endsWith("/products")).length;
  const initial = reads();
  await page.clock.fastForward(22000);
  expect(reads()).toBe(initial);
  await page.getByRole("button", { name: "Books", exact: true }).click();
  await page.getByLabel("Search marketplace").fill("keep my search");
  socket.emit(2);
  await page.clock.fastForward(4000);
  socket.emit(3);
  await page.clock.fastForward(2900);
  expect(reads()).toBe(initial);
  await page.clock.fastForward(200);
  await expect.poll(reads).toBe(initial + 1);
  await expect(page.getByLabel("Search marketplace")).toHaveValue(
    "keep my search",
  );
  await expect(
    page.getByRole("button", { name: "Books", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  socket.emit(4);
  await page.clock.fastForward(7100);
  await expect.poll(reads).toBe(initial + 2);
  await page.clock.fastForward(22000);
  expect(reads()).toBe(initial + 2);
});

test("changes during an in-flight fetch remain pending and failed reads retry on tab return", async ({
  page,
}) => {
  await mockBackend(page);
  const socket = await versionSocket(page);
  let reads = 0,
    release: (() => void) | undefined;
  await page.route("**/rest/v1/products?*", async (route) => {
    reads++;
    if (reads === 2)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    if (reads === 4)
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "Temporary refresh failure" }),
      });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        products.map((p, i) =>
          i === 0 ? { ...p, title: `Revision ${reads}` } : p,
        ),
      ),
    });
  });
  await page.clock.install();
  await page.goto("/marketplace");
  await expect(page.locator(".product")).toHaveCount(6);
  await expect.poll(socket.joins).toBe(1);
  socket.emit(2);
  await page.clock.fastForward(7100);
  await expect.poll(() => reads).toBe(2);
  socket.emit(3);
  await page.clock.fastForward(7100);
  expect(reads).toBe(2);
  release?.();
  await expect.poll(() => reads).toBe(3);
  await expect(page.locator(".product").first()).toContainText("Revision 3");
  socket.emit(4);
  await page.clock.fastForward(7100);
  await expect(
    page.getByRole("alert").filter({ hasText: "Temporary refresh failure" }),
  ).toBeVisible();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect.poll(() => reads).toBe(5);
  await expect(page.locator(".product").first()).toContainText("Revision 5");
});

test("reconnect compares counters and refreshes missed changes once", async ({
  page,
}) => {
  const requests = await mockBackend(page);
  const socket = await versionSocket(page);
  let version = 1;
  await page.route("**/rest/v1/data_versions?*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([{ topic: "marketplace", version }]),
    }),
  );
  await page.clock.install();
  await page.goto("/marketplace");
  await expect(page.locator(".product")).toHaveCount(6);
  await expect.poll(socket.joins).toBe(1);
  const initial = requests.filter((r) => r.path.endsWith("/products")).length;
  socket.disconnect();
  version = 2;
  await page.clock.fastForward(5000);
  await expect.poll(socket.joins).toBe(2);
  await page.clock.fastForward(7100);
  await expect
    .poll(() => requests.filter((r) => r.path.endsWith("/products")).length)
    .toBe(initial + 1);
  await page.clock.fastForward(20000);
  expect(requests.filter((r) => r.path.endsWith("/products")).length).toBe(
    initial + 1,
  );
});

test("tab return reconciles changed counters once and preserves unsaved settings", async ({
  page,
}) => {
  await mockBackend(page);
  await versionSocket(page);
  let version = 1,
    reads = 0,
    preferences = 0;
  await page.route("**/rest/v1/data_versions?*", (route) => {
    reads++;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([{ topic: `user:${uid}`, version }]),
    });
  });
  await page.route("**/rest/v1/notification_preferences?*", (route) => {
    preferences++;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ order_alerts: true, marketplace_updates: false }),
    });
  });
  await page.clock.install();
  await page.goto("/settings");
  await expect(
    page.getByRole("checkbox", { name: /Order updates/ }),
  ).toBeChecked();
  await expect.poll(() => reads).toBe(1);
  await page.getByRole("checkbox", { name: /Order updates/ }).uncheck();
  const before = preferences;
  version = 2;
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect.poll(() => reads).toBe(2);
  await page.clock.fastForward(7100);
  await expect.poll(() => preferences).toBe(before + 1);
  await expect(
    page.getByRole("checkbox", { name: /Order updates/ }),
  ).not.toBeChecked();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect.poll(() => reads).toBe(3);
  await page.clock.fastForward(7100);
  expect(preferences).toBe(before + 1);
});

test("insertions preserve a visible listing anchor and an open listing draft", async ({
  page,
}) => {
  await mockBackend(page);
  const socket = await versionSocket(page);
  let inserted = false;
  const extra = products
    .slice(0, 3)
    .map((p, i) => ({ ...p, id: `new-${i}`, title: `New listing ${i}` }));
  await page.route("**/rest/v1/products?*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(inserted ? [...extra, ...products] : products),
    }),
  );
  await page.clock.install();
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.goto("/marketplace");
  await expect(page.locator(".product")).toHaveCount(6);
  await page.locator(".product").nth(2).scrollIntoViewIfNeeded();
  const anchor = await page.locator(".product").evaluateAll((nodes) => {
    const node = nodes.find(
      (node) =>
        node.getBoundingClientRect().top >= 0 &&
        node.getBoundingClientRect().top < innerHeight,
    )!;
    return {
      id: node.getAttribute("data-product-id"),
      top: node.getBoundingClientRect().top,
    };
  });
  inserted = true;
  socket.emit(2, "marketplace", "INSERT");
  await page.clock.fastForward(7100);
  await expect(page.locator(".product")).toHaveCount(9);
  await page.clock.fastForward(32);
  const top = await page
    .locator(`[data-product-id="${anchor.id}"]`)
    .evaluate((node) => node.getBoundingClientRect().top);
  expect(Math.abs(top - anchor.top)).toBeLessThan(3);
  await page
    .getByRole("button", { name: "Sell an item", exact: true })
    .first()
    .click();
  await page.getByLabel("Item title").fill("Unfinished draft");
  socket.emit(3);
  await page.clock.fastForward(7100);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Item title")).toHaveValue("Unfinished draft");
});

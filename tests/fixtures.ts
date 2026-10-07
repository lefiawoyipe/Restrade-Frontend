import { type Page } from "@playwright/test";
export const uid = "11111111-1111-4111-8111-111111111111";
export const sellerId = "22222222-2222-4222-8222-222222222222";
export const profile = {
  id: uid,
  full_name: "Alex Student",
  campus: "Test campus",
  bio: null,
  total_reviews: 3,
  trust_score: 4.7,
  is_admin: false,
  is_suspended: false,
};
export const products = [
  "Study laptop",
  "Reading bundle",
  "Campus backpack",
  "Desk lamp",
  "Headphones",
  "Everyday shoes",
].map((title, index) => ({
  id: `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
  title,
  description: "Browser test listing",
  seller_id: sellerId,
  price: [2800, 90, 120, 160, 380, 250][index],
  image_url: "/images/campus-backpack.jpg",
  category: [
    "Electronics",
    "Books",
    "Fashion",
    "Room essentials",
    "Electronics",
    "Fashion",
  ][index],
  condition: "good",
  location: "Library",
  campus: "Test campus",
  status: "available",
  moderation_status: "visible",
  created_at: "2026-09-25T12:00:00Z",
  seller: { ...profile, id: sellerId, full_name: "Sam Seller" },
}));
export const order = {
  id: "44444444-4444-4444-8444-444444444444",
  buyer_id: uid,
  product_id: products[0].id,
  seller_id: sellerId,
  workflow_version: 1,
  fulfillment_status: "legacy",
  item_snapshot: {
    ...products[0],
    seller_name: "Sam Seller",
    source: "purchase",
  },
  pickup_due_at: null as string | null,
  handed_over_at: null as string | null,
  inspection_due_at: null as string | null,
  settled_at: null as string | null,
  amount: 2800,
  status: "escrow_funded",
  created_at: "2026-09-25T12:00:00Z",
  product: products[0],
  buyer: profile,
};
export async function mockBackend(
  page: Page,
  options: {
    pickup?: boolean;
    disputed?: boolean;
    seller?: boolean;
    admin?: boolean;
    suspended?: boolean;
    failRecommendation?: boolean;
    failProducts?: boolean;
    failWallet?: boolean;
    failRelease?: boolean;
    manyProducts?: boolean;
  } = {},
) {
  const saved = new Set<string>();
  const requests: {
    path: string;
    method: string;
    body: Record<string, unknown> | null;
  }[] = [];
  let preferences = {
    user_id: uid,
    order_alerts: true,
    marketplace_updates: false,
  };
  let emailEnabled = false;
  const currentOrder = {
    ...order,
    buyer_id: options.admin || options.seller ? sellerId : uid,
    seller_id: options.seller ? uid : sellerId,
    workflow_version: options.pickup ? 2 : 1,
    fulfillment_status: options.pickup ? "awaiting_pickup" : "legacy",
    pickup_due_at: options.pickup
      ? new Date(Date.now() + 3600000).toISOString()
      : null,
    status: options.admin || options.disputed ? "disputed" : order.status,
  };
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.invalid",
    factors: options.admin
      ? [
          {
            id: "factor-1",
            factor_type: "totp",
            status: "verified",
            friendly_name: "Test authenticator",
          },
        ]
      : [],
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: uid, exp: expires, role: "authenticated" })).toString("base64url")}.test-signature`;
  const session = {
    access_token: token,
    refresh_token: "test-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expires,
    user,
  };
  await page.context().addCookies([
    {
      name: "sb-ojfndtslmjtrbrmfepeg-auth-token",
      value:
        "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.route("https://*.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      method = req.method(),
      name = url.pathname.split("/").at(-1)!;
    let body;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    requests.push({ path: url.pathname, method, body });
    const json = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(value),
        headers: { "access-control-allow-origin": "*" },
      });
    if (method === "OPTIONS") return json({});
    if (url.pathname.includes("/auth/v1/user")) return json(user);
    if (name === "profiles") {
      if (url.searchParams.get("select") === "*") {
        const rows = [
          {
            ...profile,
            is_admin: Boolean(options.admin),
            is_suspended: Boolean(options.suspended),
          },
          { ...profile, id: sellerId, full_name: "Sam Seller" },
        ];
        if (!url.searchParams.has("id")) return json(rows);
      }
      return json({
        ...profile,
        is_admin: Boolean(options.admin),
        is_suspended: Boolean(options.suspended),
        ...(method === "PATCH" ? body : {}),
      });
    }
    if (name === "product_categories")
      return json(
        ["Electronics", "Books", "Fashion", "Room essentials"].map((name) => ({
          name,
        })),
      );
    if (name === "data_versions")
      return json([
        { topic: "marketplace", version: 1 },
        { topic: `user:${uid}`, version: 1 },
      ]);
    if (name === "recommendation_preferences")
      return json(emailEnabled ? { email_enabled: true } : null);
    if (name === "set_recommendation_email") {
      if (options.failRecommendation)
        return json({ message: "Preference could not be saved" }, 400);
      emailEnabled = Boolean(body.p_enabled);
      return json(null);
    }
    if (
      [
        "unsubscribe_recommendations",
        "admin_moderate_product",
        "admin_suspend_trading",
      ].includes(name)
    )
      return json(null);
    if (name === "admin_audit_log") return json([]);
    if (name === "products") {
      if (options.failProducts)
        return json({ message: "Listings temporarily unavailable" }, 503);
      if (method !== "GET") return json({ id: products[0].id });
      const items = options.manyProducts
        ? Array.from({ length: 501 }, (_, i) => ({
            ...products[0],
            id: `item-${i}`,
            title: i === 500 ? "Second page treasure" : `Item ${i}`,
          }))
        : products;
      const from = Number(url.searchParams.get("offset") || 0),
        limit = Number(url.searchParams.get("limit") || 500);
      if (url.searchParams.has("id"))
        return json(
          items.find(
            (p) => p.id === url.searchParams.get("id")?.replace("eq.", ""),
          ) ?? null,
        );
      return json(items.slice(from, from + limit));
    }
    if (name === "saved_items") {
      if (method === "POST") saved.add(body.product_id);
      if (method === "DELETE")
        saved.delete(
          url.searchParams.get("product_id")?.replace("eq.", "") || "",
        );
      return json([...saved].map((product_id) => ({ product_id })));
    }
    if (name === "wallets")
      return options.failWallet
        ? json({ message: "Wallet unavailable" }, 503)
        : json({ balance: 500 });
    if (name === "orders") {
      if (method === "HEAD")
        return route.fulfill({
          status: 200,
          headers: { "content-range": "0-0/1" },
        });
      return json(
        req.headers().accept?.includes("vnd.pgrst.object")
          ? currentOrder
          : [currentOrder],
      );
    }
    if (name === "reviews")
      return json(
        req.headers().accept?.includes("vnd.pgrst.object") ? null : [],
      );
    if (name === "notification_preferences") {
      if (method === "POST") preferences = { ...preferences, ...body };
      return json(preferences);
    }
    if (name === "notifications") return json([]);
    if (name === "release_escrow") {
      if (options.failRelease)
        return json({ message: "Release rejected by server" }, 400);
      currentOrder.status = "completed";
      return json(null);
    }
    if (name === "open_dispute") {
      currentOrder.status = "disputed";
      return json(null);
    }
    if (name === "get_pickup_workflow_config")
      return json({ enabled: Boolean(options.pickup) });
    if (name === "create_pickup_challenge")
      return json({
        order_id: order.id,
        token: "a".repeat(64),
        expires_at: new Date(Date.now() + 600000).toISOString(),
      });
    if (name === "confirm_pickup") {
      currentOrder.fulfillment_status = "inspection";
      currentOrder.handed_over_at = new Date().toISOString();
      currentOrder.inspection_due_at = new Date(
        Date.now() + 172800000,
      ).toISOString();
      return json(null);
    }
    const dispute = {
      order_id: order.id,
      reason: "Not as described",
      description: "Test case report",
      stage: options.admin ? "admin_review" : "negotiation",
      opened_at: order.created_at,
      negotiation_due_at: new Date(Date.now() + 3600000).toISOString(),
      resolved_at: null,
      resolution_note: null,
    };
    if (name === "admin_case_queue")
      return json([{ ...dispute, title: "Study laptop", amount: 2800 }]);
    if (name === "admin_open_case")
      return json({
        order: currentOrder,
        dispute,
        access_expires_at: new Date(Date.now() + 600000).toISOString(),
        reputation: [],
      });
    if (name === "prepare_case_decision")
      return json("55555555-5555-4555-8555-555555555555");
    if (name === "challenge")
      return json({ id: "challenge-1", expires_at: expires });
    if (name === "verify") return json(session);
    if (name === "execute_case_decision") {
      currentOrder.status = "refunded";
      return json(null);
    }
    if (["case_evidence", "settlement_offers"].includes(name)) return json([]);
    if (name === "disputes")
      return json(currentOrder.status === "disputed" ? dispute : null);
    if (
      name === "dispute_messages" ||
      name === "order_events" ||
      url.pathname.includes("/storage/")
    )
      return json([]);
    if (name === "resolve_dispute_with_note") return json(null);
    return json({ message: `Unmocked request: ${url.pathname}` }, 400);
  });
  return requests;
}

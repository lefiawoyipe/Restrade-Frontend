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
  amount: 2800,
  status: "escrow_funded",
  created_at: "2026-09-25T12:00:00Z",
  product: products[0],
  buyer: profile,
};
export async function mockBackend(
  page: Page,
  options: {
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
    buyer_id: options.admin ? sellerId : uid,
    status: options.admin ? "disputed" : order.status,
  };
  const user = {
    id: uid,
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.invalid",
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
    const body = req.postDataJSON();
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
    if (name === "orders") return json([currentOrder]);
    if (name === "reviews") return json([]);
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
    if (name === "disputes")
      return url.searchParams.get("resolved_at")
        ? json([])
        : json({
            order_id: order.id,
            reason: "Not as described",
            description: "Test case report",
            resolved_at: null,
            resolution_note: null,
          });
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

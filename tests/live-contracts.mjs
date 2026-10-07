// Read-only public API / anonymous denial smoke checks. No authenticated writes.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/, ""),
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const products = await client
  .from("products")
  .select(
    "id,category,condition,campus,location,moderation_status,seller:profiles!products_seller_id_fkey!inner(id,full_name,trust_score,total_reviews,campus,is_admin,is_suspended)",
  )
  .eq("status", "available")
  .eq("moderation_status", "visible")
  .not("seller.is_admin", "is", true)
  .eq("seller.is_suspended", false)
  .limit(1);
assert.equal(products.error, null, products.error?.message);
console.log(
  "PASS: public product fields and seller relationship are queryable",
);
const categories = await client.from("product_categories").select("name");
assert.equal(categories.error, null, categories.error?.message);
assert.deepEqual(categories.data.map((row) => row.name).sort(), [
  "Books",
  "Electronics",
  "Fashion",
  "Room essentials",
]);
console.log("PASS: canonical category contract is available");
const versions = await client.from("data_versions").select("topic,version");
assert.ok(
  versions.error || versions.data.length === 0,
  "Anonymous versions must not be readable",
);
console.log("PASS: version counters do not expose data to anonymous callers");
const invalidId = "00000000-0000-4000-8000-000000000000";
for (const [rpc, parameters] of [
  [
    "admin_moderate_product",
    {
      p_product_id: invalidId,
      p_hidden: true,
      p_reason: "Anonymous denial check",
    },
  ],
  [
    "admin_suspend_trading",
    {
      p_user_id: invalidId,
      p_suspended: true,
      p_reason: "Anonymous denial check",
    },
  ],
  ["set_recommendation_email", { p_enabled: false }],
  ["initiate_purchase", { p_product_id: invalidId }],
  ["release_escrow", { p_order_id: invalidId }],
  [
    "open_dispute",
    {
      p_order_id: invalidId,
      p_reason: "Contract check",
      p_description: "Anonymous denial check",
    },
  ],
  ["admin_case_queue", { p_limit: 1, p_offset: 0, p_resolved: false }],
  [
    "admin_open_case",
    { p_order_id: invalidId, p_reason: "Anonymous denial check" },
  ],
  [
    "prepare_case_decision",
    {
      p_order_id: invalidId,
      p_outcome: "refund",
      p_reason: "Anonymous denial check",
    },
  ],
  ["execute_case_decision", { p_intent_id: invalidId }],
  ["create_pickup_challenge", { p_order_id: invalidId }],
  ["confirm_pickup", { p_order_id: invalidId, p_token: "0".repeat(64) }],
  [
    "propose_settlement",
    {
      p_order_id: invalidId,
      p_outcome: "refund",
      p_terms: "Anonymous denial check",
    },
  ],
  ["respond_settlement", { p_offer_id: invalidId, p_accept: false }],
  ["confirm_return", { p_order_id: invalidId }],
  [
    "escalate_dispute",
    {
      p_order_id: invalidId,
      p_reason: "Anonymous denial check",
      p_urgent: true,
    },
  ],
  [
    "admin_request_case_info",
    { p_order_id: invalidId, p_message: "Anonymous denial check" },
  ],
]) {
  const result = await client.rpc(rpc, parameters);
  assert.ok(result.error, `${rpc} must reject anonymous callers`);
  assert.ok(
    ["42501", "PGRST301", "PGRST302"].includes(result.error.code),
    `${rpc}: expected authorization denial, got ${result.error.code}`,
  );
  console.log(`PASS: ${rpc} rejects unauthenticated requests`);
}

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
    "id,category,condition,campus,location,seller:profiles!products_seller_id_fkey(id,full_name,trust_score,total_reviews,campus)",
  )
  .eq("status", "available")
  .limit(1);
assert.equal(products.error, null, products.error?.message);
console.log(
  "PASS: public product fields and seller relationship are queryable",
);
const invalidId = "00000000-0000-4000-8000-000000000000";
for (const [rpc, parameters] of [
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
  [
    "resolve_dispute_with_note",
    {
      p_order_id: invalidId,
      p_favor_buyer: true,
      p_note: "Anonymous denial check",
    },
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

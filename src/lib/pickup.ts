import type { Json, Tables } from "./database.types";
import type { Order } from "./marketplace";
export type OrderRow = Tables<"orders">;
export type Dispute = Tables<"disputes">;
export type Offer = Tables<"settlement_offers">;
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Unexpected server response. Refresh before continuing.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
export function validLength(value: string, min: number, max: number) {
  return value.trim().length >= min && value.trim().length <= max;
}
export function snapshot(order: Pick<OrderRow, "item_snapshot">) {
  const value = order.item_snapshot;
  const data =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    title: text(data.title, "Purchase snapshot unavailable"),
    description: text(data.description),
    condition: text(data.condition, "Not recorded"),
    image: text(data.image_url) || null,
    seller: text(data.seller_name, "Seller"),
    source: text(data.source),
    price: typeof data.price === "number" ? data.price : null,
  };
}
export function parseOrder(value: unknown): Order {
  const row = record(value);
  const status = row.status;
  if (
    status !== null &&
    status !== "pending" &&
    status !== "escrow_funded" &&
    status !== "completed" &&
    status !== "disputed" &&
    status !== "refunded"
  )
    throw new Error("Unrecognized order status. No action was taken.");
  if (
    typeof row.amount !== "number" ||
    typeof row.workflow_version !== "number" ||
    !text(row.id) ||
    !text(row.buyer_id) ||
    !text(row.seller_id)
  )
    throw new Error("Order data is incomplete.");
  return {
    id: text(row.id),
    buyer_id: text(row.buyer_id),
    seller_id: text(row.seller_id),
    product_id: text(row.product_id),
    amount: row.amount,
    workflow_version: row.workflow_version,
    fulfillment_status: text(row.fulfillment_status),
    status,
    created_at: text(row.created_at) || null,
    updated_at: text(row.updated_at) || null,
    pickup_due_at: text(row.pickup_due_at) || null,
    inspection_due_at: text(row.inspection_due_at) || null,
    handed_over_at: text(row.handed_over_at) || null,
    settled_at: text(row.settled_at) || null,
    item_snapshot: (row.item_snapshot ?? {}) as Json,
    product: null,
  };
}
export function canAccept(order: OrderRow, userId: string, now: number) {
  return (
    order.buyer_id === userId &&
    order.status === "escrow_funded" &&
    (order.workflow_version === 1 ||
      (order.workflow_version === 2 &&
        order.fulfillment_status === "inspection" &&
        Boolean(order.handed_over_at) &&
        Boolean(order.inspection_due_at) &&
        Date.parse(order.inspection_due_at!) > now))
  );
}
export function canReport(order: OrderRow, userId: string, now: number) {
  return (
    order.buyer_id === userId &&
    order.status === "escrow_funded" &&
    (order.workflow_version === 1 ||
      (order.workflow_version === 2 &&
        ((order.fulfillment_status === "awaiting_pickup" &&
          Boolean(order.pickup_due_at) &&
          Date.parse(order.pickup_due_at!) > now) ||
          (order.fulfillment_status === "inspection" &&
            Boolean(order.inspection_due_at) &&
            Date.parse(order.inspection_due_at!) > now))))
  );
}
export function canReview(order: OrderRow, userId: string) {
  return (
    order.buyer_id === userId &&
    ["completed", "refunded"].includes(order.status ?? "") &&
    order.fulfillment_status !== "cancelled"
  );
}
export function pickupToken(raw: string, orderId: string) {
  const input = raw.trim();
  if (/^[a-fA-F0-9]{64}$/.test(input)) return input;
  let payload: Record<string, unknown>;
  try {
    payload = record(JSON.parse(input));
  } catch {
    throw new Error(
      "Paste a 64-character pickup code or scan a ResTrade pickup QR.",
    );
  }
  if (
    payload.type !== "restrade-pickup" ||
    payload.order_id !== orderId ||
    typeof payload.token !== "string" ||
    !/^[a-fA-F0-9]{64}$/.test(payload.token)
  )
    throw new Error("This pickup code does not match this order.");
  return payload.token;
}
export const outcomes: Record<string, string> = {
  refund: "Full test-wallet refund",
  release: "Full test-wallet release",
  return_refund: "Return item, then full refund",
  extend_24h: "Extend negotiation by 24 hours",
  admin_review: "Request arbitration together",
};

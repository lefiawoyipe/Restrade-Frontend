"use client";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  errorMessage,
  money,
  orderSelect,
  type Order,
} from "@/lib/marketplace";
import { canAccept, canReport, canReview, snapshot } from "@/lib/pickup";
import { useDataRefresh } from "@/lib/use-data-refresh";
import SiteShell, { useWorkspace } from "../components/SiteShell";
import OrderAction from "../components/OrderAction";
import { OrderTime, useNow } from "../components/OrderTime";
import {
  Feedback,
  LoadState,
  PageHeader,
  ProductImage,
  StatusBadge,
} from "../components/UI";
const size = 20;
function OrdersContent() {
  const { userId } = useWorkspace(),
    now = useNow(),
    sequence = useRef(0);
  const [orders, setOrders] = useState<Order[]>([]),
    [reviewed, setReviewed] = useState<string[]>([]),
    [view, setView] = useState("purchases"),
    [tab, setTab] = useState("All orders"),
    [oldest, setOldest] = useState(false),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [action, setAction] = useState<{ order: Order; kind: string } | null>(null);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    try {
      let query = supabase
        .from("orders")
        .select(orderSelect)
        .eq(view === "purchases" ? "buyer_id" : "seller_id", userId)
        .order("created_at", { ascending: oldest })
        .order("id", { ascending: oldest })
        .range(page * size, page * size + size);
      if (tab === "Active")
        query = query.in("status", ["pending", "escrow_funded"]);
      if (tab === "Completed") query = query.eq("status", "completed");
      if (tab === "Disputed") query = query.eq("status", "disputed");
      if (tab === "Refunded") query = query.eq("status", "refunded");
      const result = await query;
      if (result.error) throw result.error;
      const rows = result.data.slice(0, size) as unknown as Order[];
      const reviews = rows.length
        ? await supabase
            .from("reviews")
            .select("order_id")
            .eq("reviewer_id", userId)
            .in(
              "order_id",
              rows.map((o) => o.id),
            )
        : { data: [], error: null };
      if (reviews.error) throw reviews.error;
      if (request !== sequence.current) return;
      setOrders(rows);
      setReviewed(reviews.data.map((r) => r.order_id));
      setMore(result.data.length > size);
      setError("");
      return true;
    } catch (cause) {
      if (request === sequence.current) setError(errorMessage(cause));
      return false;
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [userId, view, tab, oldest, page]);
  useDataRefresh(load, ["personal", "marketplace"]);
  return (
    <>
      <PageHeader
        title="Your orders"
        description="Local pickup and test-wallet history."
        action={
          <label>
            View{" "}
            <select
              aria-label="Order role"
              value={view}
              onChange={(e) => {
                setView(e.target.value);
                setPage(0);
              }}
            >
              <option value="purchases">My purchases</option>
              <option value="sales">My sales</option>
            </select>
          </label>
        }
      />
      <div className="tabs">
        {["All orders", "Active", "Completed", "Disputed", "Refunded"].map(
          (value) => (
            <button
              key={value}
              className={`tab ${tab === value ? "active" : ""}`}
              onClick={() => {
                setTab(value);
                setPage(0);
              }}
            >
              {value}
            </button>
          ),
        )}
      </div>
      <label>
        Sort orders{" "}
        <select
          aria-label="Sort orders"
          value={oldest ? "oldest" : "newest"}
          onChange={(e) => {
            setOldest(e.target.value === "oldest");
            setPage(0);
          }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </label>
      <Feedback error={error} message={message} />
      <LoadState loading={loading} />
      {orders.map((order) => {
        const item = snapshot(order);
        return (
          <article className="order-card" key={order.id}>
            <div className="order-top">
              <div className="row">
                <ProductImage
                  className="thumb"
                  src={item.image}
                  title={item.title}
                />
                <div>
                  <small>
                    {order.id.slice(0, 8).toUpperCase()} ·{" "}
                    <OrderTime value={order.created_at} />
                  </small>
                  <h3>
                    <Link href={`/orders/${order.id}`}>{item.title}</Link>
                  </h3>
                  <p>{order.fulfillment_status.replaceAll("_", " ")}</p>
                </div>
              </div>
              <div className="order-amount">
                <strong>Test wallet · {money(order.amount)}</strong>
                <StatusBadge status={order.status} />
              </div>
            </div>
            {order.workflow_version === 1 && (
              <p className="note">
                Legacy order — no automatic pickup/inspection deadline.
              </p>
            )}
            <div className="order-bottom">
              <Link className="text-link" href={`/orders/${order.id}`}>
                Order details and case history
              </Link>
              <div className="row wrap">
                {canReport(order, userId, now) && (
                  <button
                    className="btn"
                    onClick={() => setAction({ order, kind: "dispute" })}
                  >
                    Report a problem
                  </button>
                )}
                {canAccept(order, userId, now) && (
                  <button
                    className="btn primary"
                    onClick={() => setAction({ order, kind: "receipt" })}
                  >
                    {order.workflow_version === 1
                      ? "Confirm receipt"
                      : "Accept item & release test funds"}
                  </button>
                )}
                {canReview(order, userId) && (
                  <button
                    className="btn"
                    disabled={reviewed.includes(order.id)}
                    onClick={() => setAction({ order, kind: "review" })}
                  >
                    {reviewed.includes(order.id)
                      ? "Review submitted"
                      : "Leave a review"}
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
      {!loading && !error && !orders.length && <p>No orders on this page.</p>}
      <div className="form-actions">
        <button
          className="btn"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous page
        </button>
        <span>Page {page + 1}</span>
        <button
          className="btn"
          disabled={!more}
          onClick={() => setPage((p) => p + 1)}
        >
          Next page
        </button>
      </div>
      {action && (
        <OrderAction
          order={orders.find((o) => o.id === action.order.id) ?? action.order}
          kind={action.kind}
          onClose={() => setAction(null)}
          onSuccess={() =>
            setMessage(
              action.kind === "dispute"
                ? "Dispute opened. Open order details to continue."
                : action.kind === "review"
                  ? "Review submitted."
                  : "Receipt confirmed. Test funds released to seller.",
            )
          }
        />
      )}
    </>
  );
}
export default function Orders() {
  return (
    <SiteShell>
      <OrdersContent />
    </SiteShell>
  );
}

"use client";
import { useDataRefresh } from "@/lib/use-data-refresh";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dateLabel,
  errorMessage,
  loadOrders,
  money,
  notifyDataChanged,
  type Order,
} from "@/lib/marketplace";
import SiteShell, { useWorkspace } from "../components/SiteShell";
import DisputeCasePanel from "../components/DisputeCasePanel";
import {
  Feedback,
  LoadState,
  Modal,
  PageHeader,
  ProductImage,
  StatusBadge,
} from "../components/UI";

function OrderAction({
  order,
  kind,
  onClose,
  onSuccess,
}: {
  order: Order;
  kind: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { userId } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const values = new FormData(event.currentTarget);
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      let result;
      if (kind === "receipt")
        result = await supabase.rpc("release_escrow", { p_order_id: order.id });
      else if (kind === "dispute") {
        const description = String(values.get("description")).trim();
        if (!description) throw new Error("Describe what happened.");
        result = await supabase.rpc("open_dispute", {
          p_order_id: order.id,
          p_reason: String(values.get("reason")),
          p_description: description,
        });
      } else
        result = await supabase.from("reviews").insert({
          order_id: order.id,
          reviewer_id: userId,
          seller_id: order.product?.seller_id,
          rating: Number(values.get("rating")),
          comment: String(values.get("comment")).trim(),
        });
      if (result.error) throw result.error;
      notifyDataChanged();
      onSuccess();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        kind === "receipt"
          ? "Received and checked your item?"
          : kind === "dispute"
            ? "Report a problem"
            : "How was your trade?"
      }
      description={
        kind === "receipt"
          ? `Confirming releases ${money(order.amount)} to the seller. Make sure the item matches its description first.`
          : order.product?.title || "Your order"
      }
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {kind === "receipt" ? (
            <label className="receipt-check">
              <input type="checkbox" required />I have received and inspected
              the item.
            </label>
          ) : kind === "dispute" ? (
            <div className="stack">
              <label className="field">
                Reason
                <select name="reason" required>
                  <option value="">Choose a reason</option>
                  <option>Item not as described</option>
                  <option>Item not received</option>
                  <option>Damaged or faulty item</option>
                  <option>Other issue</option>
                </select>
              </label>
              <label className="field">
                What happened?
                <textarea
                  name="description"
                  rows={4}
                  required
                  maxLength={5000}
                />
              </label>
              <p className="note">
                Funds stay held while the case is reviewed. After submitting,
                open the case to attach photos or documents and add responses.
              </p>
            </div>
          ) : (
            <div className="stack">
              <label className="field">
                Rating
                <select name="rating" required defaultValue="">
                  <option value="">Choose a rating</option>
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option value={r} key={r}>
                      {r} {r === 1 ? "star" : "stars"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Your review
                <textarea
                  name="comment"
                  rows={3}
                  maxLength={5000}
                  placeholder="Share helpful feedback about the trade."
                />
              </label>
            </div>
          )}
        </fieldset>
        <Feedback error={error} />
        <div className="form-actions">
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            {kind === "receipt" ? "Not yet" : "Cancel"}
          </button>
          <button className="btn primary" disabled={busy}>
            {busy
              ? "Submitting…"
              : kind === "receipt"
                ? "Confirm & release funds"
                : kind === "dispute"
                  ? "Submit dispute"
                  : "Submit review"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function OrdersContent() {
  const { userId } = useWorkspace();
  const [orders, setOrders] = useState<Order[]>([]),
    [reviewed, setReviewed] = useState<string[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [tab, setTab] = useState("All orders"),
    [view, setView] = useState("purchases"),
    [action, setAction] = useState<{ order: Order; kind: string } | null>(null),
    [caseOrder, setCaseOrder] = useState<Order | null>(null),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const activity = await loadOrders(),
        ids: string[] = [];
      for (let from = 0; ; from += 500) {
        const reviews = await supabase
          .from("reviews")
          .select("order_id")
          .eq("reviewer_id", userId)
          .order("order_id")
          .range(from, from + 499);
        if (reviews.error) throw reviews.error;
        ids.push(...reviews.data.map((r) => r.order_id));
        if (reviews.data.length < 500) break;
      }
      setOrders(activity);
      setReviewed(ids);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useDataRefresh(load);
  const visible = orders.filter(
    (o) =>
      (view === "purchases"
        ? o.buyer_id === userId
        : o.product?.seller_id === userId) &&
      (tab === "All orders" ||
        (tab === "Active" && ["pending", "escrow_funded"].includes(o.status)) ||
        (tab === "Completed" && o.status === "completed") ||
        (tab === "Disputed" && o.status === "disputed") ||
        (tab === "Refunded" && o.status === "refunded")),
  );
  return (
    <>
      <PageHeader
        title="Your orders"
        description="Know where your money is, and what happens next."
        action={
          <label className="small muted">
            View{" "}
            <select
              aria-label="Order role"
              className="role-select"
              value={view}
              onChange={(e) => setView(e.target.value)}
            >
              <option value="purchases">My purchases</option>
              <option value="sales">My sales</option>
            </select>
          </label>
        }
      />
      <div className="tabs" aria-label="Filter orders">
        {["All orders", "Active", "Completed", "Disputed", "Refunded"].map(
          (t) => (
            <button
              key={t}
              className={`tab ${tab === t ? "active" : ""}`}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      <Feedback message={message} />
      {loading || error ? (
        <LoadState loading={loading} error={error} retry={load} />
      ) : visible.length ? (
        visible.map((o) => (
          <article className="order-card" key={o.id}>
            <div className="order-top">
              <div className="row">
                <ProductImage
                  className="thumb"
                  src={o.product?.image_url || null}
                  title={o.product?.title || "Item"}
                />
                <div>
                  <small className="muted">
                    {o.id.slice(0, 8).toUpperCase()} · {dateLabel(o.created_at)}
                  </small>
                  <h3>{o.product?.title || "Item unavailable"}</h3>
                  <span className="small muted">
                    {view === "purchases"
                      ? `Seller: ${o.product?.seller?.full_name || "Unavailable"}`
                      : `Buyer: ${o.buyer?.full_name || "Unavailable"}`}{" "}
                    ·{" "}
                    {o.product?.location ||
                      o.product?.campus ||
                      "Collection area not provided"}
                  </span>
                </div>
              </div>
              <div className="order-amount">
                <strong>{money(o.amount)}</strong>
                <StatusBadge status={o.status} />
              </div>
            </div>
            {o.status === "escrow_funded" && (
              <div className="timeline">
                <div className="step done">
                  <strong>1. Payment held</strong>Your funds are in escrow
                </div>
                <div className="step">
                  <strong>2. Collect & inspect</strong>Arrange collection and
                  check the item
                </div>
                <div className="step">
                  <strong>3. Confirm receipt</strong>The buyer releases payment
                </div>
              </div>
            )}
            <div className="order-bottom">
              <p>
                {o.status === "escrow_funded"
                  ? "Only confirm after receiving and checking the item."
                  : o.status === "completed"
                    ? "Payment released. Your trade is complete."
                    : o.status === "refunded"
                      ? "Funds returned to the buyer."
                      : "Payment is held while the dispute is reviewed."}
              </p>
              <div className="row wrap">
                {o.status === "escrow_funded" && o.buyer_id === userId && (
                  <>
                    <button
                      className="btn"
                      onClick={() => setAction({ order: o, kind: "dispute" })}
                    >
                      Report a problem
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => setAction({ order: o, kind: "receipt" })}
                    >
                      Confirm receipt
                    </button>
                  </>
                )}
                {o.status === "completed" && o.buyer_id === userId && (
                  <button
                    className="btn"
                    disabled={reviewed.includes(o.id)}
                    onClick={() => setAction({ order: o, kind: "review" })}
                  >
                    {reviewed.includes(o.id)
                      ? "Review submitted"
                      : "Leave a review"}
                  </button>
                )}
                {["disputed", "refunded"].includes(o.status) && (
                  <button className="btn" onClick={() => setCaseOrder(o)}>
                    View case
                  </button>
                )}
              </div>
            </div>
          </article>
        ))
      ) : (
        <div className="empty">
          <h3>No orders here yet.</h3>
          <p>Your matching orders will appear here.</p>
          <Link className="btn primary" href="/marketplace">
            Browse marketplace
          </Link>
        </div>
      )}
      {action && (
        <OrderAction
          order={action.order}
          kind={action.kind}
          onSuccess={() =>
            setMessage(
              action.kind === "receipt"
                ? "Receipt confirmed. Payment released to the seller."
                : action.kind === "dispute"
                  ? "Dispute opened. Use View case to add evidence or responses."
                  : "Review submitted. Thank you for your feedback.",
            )
          }
          onClose={() => {
            setAction(null);
          }}
        />
      )}
      {caseOrder && (
        <DisputeCasePanel
          order={caseOrder}
          onClose={() => setCaseOrder(null)}
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

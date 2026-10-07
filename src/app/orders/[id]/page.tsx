"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  errorMessage,
  money,
  orderSelect,
  type Order,
} from "@/lib/marketplace";
import {
  canAccept,
  canReport,
  canReview,
  snapshot,
  type Dispute,
} from "@/lib/pickup";
import { useDataRefresh } from "@/lib/use-data-refresh";
import SiteShell, { useWorkspace } from "../../components/SiteShell";
import {
  Feedback,
  LoadState,
  PageHeader,
  ProductImage,
  StatusBadge,
} from "../../components/UI";
import { Deadline, OrderTime, useNow } from "../../components/OrderTime";
import PickupConfirmation from "../../components/PickupConfirmation";
import OrderAction from "../../components/OrderAction";
import OrderHistory from "../../components/OrderHistory";
import DisputeCasePanel from "../../components/DisputeCasePanel";
function Detail({ id }: { id: string }) {
  const { userId } = useWorkspace(),
    now = useNow();
  const [order, setOrder] = useState<Order | null>(null),
    [dispute, setDispute] = useState<Dispute | null>(null),
    [reviewed, setReviewed] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [action, setAction] = useState(""),
    [caseOpen, setCaseOpen] = useState(false);
  const load = useCallback(async () => {
    try {
      const [result, caseResult, review] = await Promise.all([
        supabase.from("orders").select(orderSelect).eq("id", id).maybeSingle(),
        supabase.from("disputes").select("*").eq("order_id", id).maybeSingle(),
        supabase
          .from("reviews")
          .select("id")
          .eq("order_id", id)
          .eq("reviewer_id", userId)
          .maybeSingle(),
      ]);
      if (result.error) throw result.error;
      if (caseResult.error) throw caseResult.error;
      if (review.error) throw review.error;
      setOrder(result.data as unknown as Order | null);
      setDispute(caseResult.data);
      setReviewed(Boolean(review.data));
      setError("");
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }, [id, userId]);
  useDataRefresh(load, ["personal", "marketplace"]);
  if (loading || (!order && error))
    return <LoadState loading={loading} error={error} retry={load} />;
  if (!order)
    return (
      <div className="empty">
        <h1>Order unavailable</h1>
        <Link href="/orders">Back to orders</Link>
      </div>
    );
  const item = snapshot(order),
    legacy = order.workflow_version === 1;
  const next =
    order.status === "disputed"
      ? dispute?.stage === "return_pending"
        ? "Seller: confirm the agreed return only after receiving the item."
        : dispute?.stage === "admin_review"
          ? "Administrator: review the escalated case."
          : "Buyer and seller: discuss the problem and review settlement proposals."
      : order.status === "escrow_funded"
        ? legacy
          ? "Buyer: inspect the item, then confirm receipt or report a problem."
          : order.fulfillment_status === "awaiting_pickup"
            ? "Seller: show a pickup code at handover. Buyer: confirm receipt to start inspection."
            : order.fulfillment_status === "inspection"
              ? "Buyer: inspect the item and accept it or report a problem before the deadline."
              : "Awaiting the server’s next recorded transition."
        : order.fulfillment_status === "cancelled"
          ? "Pickup expired. Test funds were refunded; this cancelled order cannot be reviewed."
          : "This order has reached a final outcome. Its history remains available.";
  return (
    <>
      <Link className="back" href="/orders">
        Back to orders
      </Link>
      <PageHeader title={item.title} description={`Order ${order.id}`} />
      <Feedback error={error} message={message} />
      <section className="panel">
        <div className="row">
          <ProductImage src={item.image} title={item.title} className="thumb" />
          <div>
            <strong>Test wallet · {money(order.amount)}</strong>
            <p>
              Buyer: {order.buyer?.full_name ?? order.buyer_id}
              <br />
              Seller at purchase: {item.seller} ({order.seller_id})
            </p>
            <StatusBadge status={order.status} />
          </div>
        </div>
        <p>Condition at purchase: {item.condition}</p>
        <p className="preserve-lines">{item.description}</p>
        {item.price !== null && (
          <p>Snapshot price: {money(item.price)} test wallet</p>
        )}
        {item.source === "legacy_backfill_current_listing" && (
          <p className="note">
            This legacy snapshot was reconstructed from the listing at migration
            time; it is not verified original purchase content.
          </p>
        )}
        <p className="small muted">
          Snapshot images reference the original URL; image bytes are not
          archived.
        </p>
      </section>
      {legacy ? (
        <p className="note">
          Legacy order — no automatic pickup/inspection deadline.
        </p>
      ) : (
        order.workflow_version !== 2 && (
          <p role="alert">
            Unsupported workflow version. Actions are unavailable; contact
            support.
          </p>
        )
      )}
      <section className="panel">
        <h2>Recorded milestones</h2>
        <p>
          Purchased: <OrderTime value={order.created_at} />
        </p>
        {order.handed_over_at && (
          <p>
            Pickup confirmed: <OrderTime value={order.handed_over_at} />
          </p>
        )}
        {dispute && (
          <p>
            Dispute opened: <OrderTime value={dispute.opened_at} />
          </p>
        )}
        {order.settled_at && (
          <p>
            Test-wallet settlement: <OrderTime value={order.settled_at} />
          </p>
        )}
        <p>Fulfillment: {order.fulfillment_status.replaceAll("_", " ")}</p>
        <h3>Next action</h3>
        <p>{next}</p>
        {!legacy &&
          order.status === "escrow_funded" &&
          order.fulfillment_status === "inspection" && (
            <Deadline
              value={order.inspection_due_at}
              label="Inspection deadline"
            />
          )}
        {dispute && !dispute.resolved_at && (
          <Deadline
            value={
              dispute.stage === "return_pending"
                ? dispute.return_due_at
                : dispute.stage === "negotiation"
                  ? dispute.negotiation_due_at
                  : null
            }
            label={
              dispute.stage === "return_pending"
                ? "Return deadline"
                : "Negotiation deadline"
            }
          />
        )}
        {dispute?.resolved_at && (
          <div className="note">
            <strong>
              {dispute.favor_buyer
                ? "Test wallet refunded"
                : "Test wallet released to seller"}
            </strong>
            <p className="preserve-lines">{dispute.resolution_note}</p>
            <OrderTime value={dispute.resolved_at} />
          </div>
        )}
        <div className="form-actions">
          {canReport(order, userId, now) && (
            <button className="btn" onClick={() => setAction("dispute")}>
              Report a problem
            </button>
          )}
          {canAccept(order, userId, now) && (
            <button
              className="btn primary"
              onClick={() => setAction("receipt")}
            >
              {legacy ? "Confirm receipt" : "Accept item & release test funds"}
            </button>
          )}
          {canReview(order, userId) && (
            <button
              className="btn"
              disabled={reviewed}
              onClick={() => setAction("review")}
            >
              {reviewed ? "Review submitted" : "Leave a review"}
            </button>
          )}
          {dispute && (
            <button className="btn" onClick={() => setCaseOpen(true)}>
              View case and agreements
            </button>
          )}
        </div>
      </section>
      <PickupConfirmation order={order} />
      <section className="panel">
        <OrderHistory order={order} />
      </section>
      {action && (
        <OrderAction
          order={order}
          kind={action}
          onClose={() => setAction("")}
          onSuccess={() =>
            setMessage(
              action === "dispute"
                ? "Dispute opened. Open the case to continue."
                : action === "review"
                  ? "Review submitted."
                  : "Test funds released to seller.",
            )
          }
        />
      )}
      {caseOpen && (
        <DisputeCasePanel order={order} onClose={() => setCaseOpen(false)} />
      )}
    </>
  );
}
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <SiteShell>
      <Detail key={id} id={id} />
    </SiteShell>
  );
}

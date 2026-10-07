"use client";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  errorMessage,
  money,
  notifyDataChanged,
  type Order,
} from "@/lib/marketplace";
import { outcomes, validLength, type Dispute, type Offer } from "@/lib/pickup";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { useWorkspace } from "./SiteShell";
import { Deadline, OrderTime, useNow } from "./OrderTime";
import { Feedback } from "./UI";
export default function CaseNegotiation({
  order,
  dispute,
}: {
  order: Order;
  dispute: Dispute;
}) {
  const { userId, profile } = useWorkspace(),
    now = useNow(),
    lock = useRef(false);
  const [offers, setOffers] = useState<Offer[]>([]),
    [outcome, setOutcome] = useState("refund"),
    [terms, setTerms] = useState(""),
    [reason, setReason] = useState(""),
    [urgent, setUrgent] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState<Offer | "return" | null>(null);
  const [page, setPage] = useState(0),
    [more, setMore] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    const result = await supabase
      .from("settlement_offers")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * 50, page * 50 + 50);
    if (current !== sequence.current) return false;
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    setOffers(result.data.slice(0, 50));
    setMore(result.data.length > 50);
    return true;
  }, [order.id, page]);
  useDataRefresh(load, ["personal", "admin"]);
  async function act(action: () => PromiseLike<{ error: unknown }>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (result.error) throw result.error;
      setConfirm(null);
      notifyDataChanged(["personal", "admin", "marketplace"]);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const participant =
    !profile.is_admin && [order.buyer_id, order.seller_id].includes(userId);
  const due =
    dispute.stage === "return_pending"
      ? dispute.return_due_at
      : dispute.negotiation_due_at;
  return (
    <section className="stack">
      <h3>Agreements and negotiation</h3>
      <p>
        Case stage: {dispute.stage.replaceAll("_", " ")}. Test funds remain held
        until a recorded settlement.
      </p>
      {!["resolved", "admin_review"].includes(dispute.stage) && (
        <Deadline
          value={due}
          label={
            dispute.stage === "return_pending"
              ? "Return deadline"
              : "Negotiation deadline"
          }
        />
      )}
      {offers.map((offer) => (
        <article className="case-message" key={offer.id}>
          <strong>
            {outcomes[offer.outcome] ?? `Unknown outcome: ${offer.outcome}`}
          </strong>
          <p>
            Test amount: {money(order.amount)} · {offer.state}
          </p>
          <p>
            Proposed by{" "}
            {offer.proposed_by === userId
              ? "you"
              : offer.proposed_by === order.buyer_id
                ? "buyer"
                : offer.proposed_by === order.seller_id
                  ? "seller"
                  : offer.proposed_by}
          </p>
          <p className="preserve-lines">{offer.terms}</p>
          <p>
            Expires: <OrderTime value={offer.expires_at} />
          </p>
          {participant &&
            dispute.stage === "negotiation" &&
            offer.state === "pending" &&
            offer.proposed_by !== userId &&
            Date.parse(offer.expires_at) > now &&
            outcomes[offer.outcome] && (
              <div className="form-actions">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    act(() =>
                      supabase.rpc("respond_settlement", {
                        p_offer_id: offer.id,
                        p_accept: false,
                      }),
                    )
                  }
                >
                  Reject proposal
                </button>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => setConfirm(offer)}
                >
                  Review acceptance
                </button>
              </div>
            )}
        </article>
      ))}
      <div className="form-actions">
        <button
          className="btn"
          disabled={page === 0 || busy}
          onClick={() => setPage((p) => p - 1)}
        >
          Newer proposals
        </button>
        <span>Proposal page {page + 1}</span>
        <button
          className="btn"
          disabled={!more || busy}
          onClick={() => setPage((p) => p + 1)}
        >
          Older proposals
        </button>
      </div>
      {participant &&
        dispute.stage === "negotiation" &&
        due &&
        Date.parse(due) > now && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!validLength(terms, 3, 2000)) {
                setError("Terms must contain 3–2000 trimmed characters.");
                return;
              }
              void act(() =>
                supabase.rpc("propose_settlement", {
                  p_order_id: order.id,
                  p_outcome: outcome,
                  p_terms: terms.trim(),
                }),
              );
            }}
          >
            <label className="field">
              Proposed outcome
              <select
                value={outcome}
                disabled={busy}
                onChange={(e) => setOutcome(e.target.value)}
              >
                {Object.entries(outcomes).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Full proposal terms
              <textarea
                aria-label="Full proposal terms"
                required
                minLength={3}
                maxLength={2000}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                disabled={busy}
              />
            </label>
            <p className="small">
              A new proposal replaces the previous pending proposal. Extensions
              are capped at seven days from case opening. No partial monetary
              settlements.
            </p>
            <button className="btn" disabled={busy}>
              Send proposal
            </button>
          </form>
        )}
      {participant &&
        dispute.stage === "return_pending" &&
        userId === order.seller_id &&
        due &&
        Date.parse(due) > now && (
          <button
            className="btn"
            disabled={busy}
            onClick={() => setConfirm("return")}
          >
            Confirm returned item received
          </button>
        )}
      {confirm && (
        <section className="note" role="group" aria-label="Confirm settlement">
          <strong>
            {confirm === "return"
              ? "Confirm you received the returned item"
              : outcomes[confirm.outcome]}
          </strong>
          <p className="preserve-lines">
            {confirm === "return"
              ? "This refunds the full test-wallet amount to the buyer."
              : confirm.terms}
          </p>
          <p>
            {money(order.amount)} in test funds.{" "}
            {confirm !== "return" &&
            ["refund", "release"].includes(confirm.outcome)
              ? "Acceptance moves test funds immediately."
              : confirm !== "return" && confirm.outcome === "return_refund"
                ? "A return agreement keeps funds held until receipt or arbitration; it is not carrier verification."
                : confirm !== "return"
                  ? "This changes the case deadline or review stage; funds remain held."
                  : "The full amount will be refunded immediately."}
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={() => setConfirm(null)}
          >
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={
              busy ||
              !participant ||
              !due ||
              Date.parse(due) <= now ||
              (confirm === "return"
                ? dispute.stage !== "return_pending" ||
                  userId !== order.seller_id
                : dispute.stage !== "negotiation" ||
                  confirm.proposed_by === userId) ||
              (confirm !== "return" &&
                (Date.parse(confirm.expires_at) <= now ||
                  !offers.some(
                    (o) => o.id === confirm.id && o.state === "pending",
                  )))
            }
            onClick={() =>
              act(() =>
                confirm === "return"
                  ? supabase.rpc("confirm_return", { p_order_id: order.id })
                  : supabase.rpc("respond_settlement", {
                      p_offer_id: confirm.id,
                      p_accept: true,
                    }),
              )
            }
          >
            Confirm agreement
          </button>
        </section>
      )}
      {participant &&
        ["negotiation", "return_pending"].includes(dispute.stage) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!validLength(reason, 10, 2000)) {
                setError("Explain the escalation in 10–2000 characters.");
                return;
              }
              void act(() =>
                supabase.rpc("escalate_dispute", {
                  p_order_id: order.id,
                  p_reason: reason.trim(),
                  p_urgent: urgent,
                }),
              );
            }}
          >
            <h4>Escalate to an administrator</h4>
            <p>
              Use urgent escalation for safety, fraud or coercion concerns.
              Ordinary deadlines escalate automatically; after expiry you may
              request review without the other party’s permission.
            </p>
            <label>
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                disabled={busy}
              />{" "}
              Urgent safety, fraud or coercion concern
            </label>
            <label className="field">
              Escalation explanation
              <textarea
                aria-label="Escalation explanation"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={10}
                maxLength={2000}
                disabled={busy}
              />
            </label>
            <button
              className="btn"
              disabled={busy || (!urgent && (!due || Date.parse(due) > now))}
            >
              Request admin review
            </button>
          </form>
        )}
      <Feedback error={error} />
    </section>
  );
}

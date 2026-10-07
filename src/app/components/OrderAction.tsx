"use client";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  errorMessage,
  money,
  notifyDataChanged,
  type Order,
} from "@/lib/marketplace";
import {
  canAccept,
  canReport,
  canReview,
  snapshot,
  validLength,
} from "@/lib/pickup";
import { useWorkspace } from "./SiteShell";
import { Feedback, Modal } from "./UI";
export default function OrderAction({
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
  const { userId, profile } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (profile.is_admin) {
      setError("Administrators cannot trade.");
      return;
    }
    if (kind === "receipt" && !canAccept(order, userId, Date.now())) {
      setError("This order is not ready for acceptance.");
      return;
    }
    if (kind === "dispute" && !canReport(order, userId, Date.now())) {
      setError("The reporting window is unavailable.");
      return;
    }
    if (kind === "review" && !canReview(order, userId)) {
      setError("This order is not eligible for review.");
      return;
    }
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
        if (
          !validLength(description, 3, 5000) ||
          !validLength(String(values.get("reason")), 3, 120)
        )
          throw new Error(
            "Enter a reason of 3-120 characters and details of 3-5000 characters.",
          );
        result = await supabase.rpc("open_dispute", {
          p_order_id: order.id,
          p_reason: String(values.get("reason")).trim(),
          p_description: description,
        });
      } else {
        if (!order.seller_id)
          throw new Error(
            "Seller information is unavailable. Refresh before reviewing.",
          );
        result = await supabase.from("reviews").insert({
          order_id: order.id,
          reviewer_id: userId,
          seller_id: order.seller_id,
          rating: Number(values.get("rating")),
          comment: String(values.get("comment")).trim(),
        });
      }
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
          ? `Confirming releases ${money(order.amount)} in test funds to the seller. Make sure the item matches its description first.`
          : snapshot(order).title
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
                  minLength={3}
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

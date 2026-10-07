"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  errorMessage,
  money,
  notifyDataChanged,
  type Order,
} from "@/lib/marketplace";
import { validLength } from "@/lib/pickup";
import { useNow } from "./OrderTime";
import { Feedback } from "./UI";
export default function CaseDecision({ order }: { order: Order }) {
  const now = useNow(),
    lock = useRef(false);
  const [outcome, setOutcome] = useState(""),
    [reason, setReason] = useState(""),
    [review, setReview] = useState(false),
    [intent, setIntent] = useState<{
      id: string;
      prepared: number;
      outcome: string;
      reason: string;
    } | null>(null),
    [factors, setFactors] = useState<{ id: string; label: string }[]>([]),
    [factor, setFactor] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState(false),
    [finished, setFinished] = useState(false);
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function reconcile() {
    const [current, audit] = await Promise.all([
      supabase
        .from("orders")
        .select("status,settled_at")
        .eq("id", order.id)
        .single(),
      supabase
        .from("admin_audit_log")
        .select("id,action,details,created_at")
        .eq("target_id", order.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (current.error || audit.error) {
      setUncertain(true);
      setError(
        "Decision status is not confirmed. Recheck the order and audit before attempting another decision.",
      );
      return "unknown";
    }
    setUncertain(false);
    if (
      current.data.status === "completed" ||
      current.data.status === "refunded"
    ) {
      setFinished(true);
      setIntent(null);
      setCode("");
      setMessage(
        current.data.status === "refunded"
          ? "Test wallet refunded."
          : "Test wallet released to seller.",
      );
      notifyDataChanged();
      return "settled";
    }
    setIntent(null);
    setReview(false);
    setCode("");
    return "unresolved";
  }
  const expired = intent && now >= intent.prepared + 300000;
  return (
    <section className="stack">
      <h3>Financial decision — test wallet</h3>
      <p>
        {money(order.amount)} in test funds. Review the evidence and exact
        outcome before proceeding.
      </p>
      {!finished && (
        <>
          <fieldset disabled={busy || Boolean(intent) || uncertain}>
            <label className="field">
              Resolution
              <select
                value={outcome}
                onChange={(e) => {
                  setOutcome(e.target.value);
                  setReview(false);
                }}
              >
                <option value="">Choose an outcome</option>
                <option value="refund">Full test refund</option>
                <option value="release">Full test release</option>
              </select>
            </label>
            <label className="field">
              Decision reason
              <textarea
                aria-label="Decision reason"
                minLength={3}
                maxLength={5000}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReview(false);
                }}
              />
            </label>
          </fieldset>
          {!intent && !uncertain && (
            <button
              className="btn"
              disabled={busy || !outcome || !validLength(reason, 3, 5000)}
              onClick={() => setReview(true)}
            >
              Review decision
            </button>
          )}
          {review && (
            <div className="note">
              <strong>
                {outcome === "refund"
                  ? "Full test refund to buyer"
                  : "Full test release to seller"}{" "}
                · {money(order.amount)}
              </strong>
              <p className="preserve-lines">{reason.trim()}</p>
              <p>
                This decision moves the full test-wallet amount and cannot be
                undone.
              </p>
            </div>
          )}
          {review && !intent && !uncertain && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  if (
                    !validLength(reason, 3, 5000) ||
                    !["refund", "release"].includes(outcome)
                  )
                    throw new Error(
                      "Choose an outcome and a reason of 3–5000 characters.",
                    );
                  const list = await supabase.auth.mfa.listFactors();
                  if (list.error) throw list.error;
                  if (!list.data.totp.length)
                    throw new Error(
                      "Set up a verified authenticator in Settings before preparing a decision.",
                    );
                  setFactors(
                    list.data.totp.map((f) => ({
                      id: f.id,
                      label: f.friendly_name ?? "Authenticator",
                    })),
                  );
                  setFactor(list.data.totp[0].id);
                  const result = await supabase.rpc("prepare_case_decision", {
                    p_order_id: order.id,
                    p_outcome: outcome,
                    p_reason: reason.trim(),
                  });
                  if (result.error) throw result.error;
                  setIntent({
                    id: result.data,
                    prepared: Date.now(),
                    outcome,
                    reason: reason.trim(),
                  });
                  setCode("");
                })
              }
            >
              Prepare decision for fresh authentication
            </button>
          )}
          {intent && (
            <div className="stack">
              <p>
                Prepared terms are locked. A fresh authenticator challenge must
                follow preparation; an existing signed-in MFA session is
                insufficient.
              </p>
              <label className="field">
                Authenticator
                <select
                  value={factor}
                  disabled={busy}
                  onChange={(e) => setFactor(e.target.value)}
                >
                  {factors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Fresh authenticator code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={code}
                  disabled={busy || Boolean(expired) || uncertain}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              {expired && (
                <p role="alert">
                  The five-minute intent expired. Prepare a new decision and
                  repeat authentication.
                </p>
              )}
              <button
                className="btn primary"
                disabled={
                  busy ||
                  uncertain ||
                  Boolean(expired) ||
                  now < intent.prepared + 1100 ||
                  !/^[0-9]{6}$/.test(code)
                }
                onClick={() =>
                  act(async () => {
                    if (
                      Date.now() < intent.prepared + 1100 ||
                      Date.now() >= intent.prepared + 300000
                    )
                      throw new Error(
                        "Prepare a fresh decision before verifying.",
                      );
                    const verified = await supabase.auth.mfa.challengeAndVerify(
                      { factorId: factor, code },
                    );
                    setCode("");
                    if (verified.error) throw verified.error;
                    const session = await supabase.auth.getSession();
                    if (session.error || !session.data.session)
                      throw new Error(
                        "Your refreshed authentication session is unavailable.",
                      );
                    try {
                      const result = await supabase.rpc(
                        "execute_case_decision",
                        { p_intent_id: intent.id },
                      );
                      if (result.error) throw result.error;
                      setFinished(true);
                      setMessage(
                        intent.outcome === "refund"
                          ? "Test wallet refunded."
                          : "Test wallet released to seller.",
                      );
                      setIntent(null);
                      notifyDataChanged();
                    } catch (cause) {
                      const status = await reconcile();
                      if (status === "unresolved")
                        setError(
                          `The order is still unresolved after checking its status and audit. ${errorMessage(cause)} Prepare a new intent and authenticate again.`,
                        );
                    }
                  })
                }
              >
                Verify and execute prepared decision
              </button>
              <button
                className="btn"
                disabled={busy || uncertain}
                onClick={() => {
                  setIntent(null);
                  setReview(false);
                  setCode("");
                }}
              >
                Change terms / prepare a new intent
              </button>
            </div>
          )}
          {uncertain && (
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  if ((await reconcile()) === "unresolved")
                    setMessage(
                      "Status checked. If the order remains unresolved, prepare a new intent and authenticate again.",
                    );
                })
              }
            >
              Recheck order and audit status
            </button>
          )}
        </>
      )}
      <Feedback error={error} message={message} />
      <Link className="text-link" href="/settings#admin-authenticator">
        Authenticator setup and recovery
      </Link>
    </section>
  );
}

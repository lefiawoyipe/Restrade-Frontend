"use client";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  errorMessage,
  money,
  notifyDataChanged,
  type Order,
} from "@/lib/marketplace";
import {
  parseOrder,
  record,
  snapshot,
  text,
  validLength,
  type Dispute,
} from "@/lib/pickup";
import type { Tables } from "@/lib/database.types";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { useWorkspace } from "./SiteShell";
import { Feedback, LoadState, Modal } from "./UI";
import { OrderTime, useNow } from "./OrderTime";
import CaseEvidence from "./CaseEvidence";
import CaseNegotiation from "./CaseNegotiation";
import CaseDecision from "./CaseDecision";
import OrderHistory from "./OrderHistory";

type Props = { order?: Order; orderId?: string; onClose: () => void };
export default function DisputeCasePanel({ order, orderId, onClose }: Props) {
  const { profile } = useWorkspace();
  const id = order?.id ?? orderId;
  if (!id) return null;
  return (
    <Modal
      title={`Case ${id.slice(0, 8).toUpperCase()}`}
      description="Review the recorded case information."
      onClose={onClose}
    >
      {profile.is_admin ? (
        <AdminAccess orderId={id} />
      ) : order ? (
        <CaseContent order={order} />
      ) : (
        <p>Order information unavailable.</p>
      )}
    </Modal>
  );
}
function AdminAccess({ orderId }: { orderId: string }) {
  const now = useNow(),
    lock = useRef(false);
  const [reason, setReason] = useState(""),
    [grant, setGrant] = useState<{
      order: Order;
      expires: string;
      reputation: unknown[];
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (grant && Date.parse(grant.expires) > now)
    return (
      <>
        <p className="note">
          Audited access expires <OrderTime value={grant.expires} />. Reopening
          requires a new access reason.
        </p>
        <details>
          <summary>Participant context</summary>
          <p>
            Counts are context, not guilt scores. New accounts and disputed
            trades do not prove misconduct.
          </p>
          {grant.reputation.map((entry, index) => {
            const data = record(entry);
            return (
              <div className="case-message" key={index}>
                <strong>
                  {text(data.user_id) === grant.order.buyer_id
                    ? "Buyer"
                    : "Seller"}
                </strong>
                <p>
                  Account created:{" "}
                  <OrderTime value={text(data.account_created_at)} />
                </p>
                <p>
                  {String(data.disputes ?? 0)} disputes and{" "}
                  {String(data.completed ?? 0)} completed trades across{" "}
                  {String(data.total_orders ?? 0)} total orders.
                </p>
              </div>
            );
          })}
        </details>
        <CaseContent key={grant.expires} order={grant.order} />
      </>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (lock.current) return;
        if (!validLength(reason, 3, 2000)) {
          setError("Enter an access purpose of 3–2000 characters.");
          return;
        }
        lock.current = true;
        setBusy(true);
        setError("");
        void (async () => {
          try {
            const result = await supabase.rpc("admin_open_case", {
              p_order_id: orderId,
              p_reason: reason.trim(),
            });
            if (result.error) throw result.error;
            const data = record(result.data),
              expires = text(data.access_expires_at);
            if (!Number.isFinite(Date.parse(expires)))
              throw new Error("Case access expiry was not returned.");
            setGrant({
              order: parseOrder(data.order),
              expires,
              reputation: Array.isArray(data.reputation) ? data.reputation : [],
            });
            notifyDataChanged(["admin"]);
          } catch (cause) {
            setError(errorMessage(cause));
          } finally {
            lock.current = false;
            setBusy(false);
          }
        })();
      }}
    >
      <p>
        {grant
          ? "Case access expired. Reopen explicitly to continue."
          : "Opening private case information is recorded in audit history. Only arbitration and resolved cases are available."}
      </p>
      <label className="field">
        Case access purpose
        <textarea
          aria-label="Case access purpose"
          required
          minLength={3}
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
        />
      </label>
      <Feedback error={error} />
      <button className="btn primary" disabled={busy}>
        {grant ? "Reopen case with audit" : "Open case with audit"}
      </button>
    </form>
  );
}
function CaseContent({ order }: { order: Order }) {
  const { profile, userId } = useWorkspace(),
    lock = useRef(false);
  const [dispute, setDispute] = useState<Dispute | null>(null),
    [messages, setMessages] = useState<
      (Tables<"dispute_messages"> & {
        author: { full_name: string | null } | null;
      })[]
    >([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [actionError, setActionError] = useState(""),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const [details, conversation] = await Promise.all([
        supabase
          .from("disputes")
          .select("*")
          .eq("order_id", order.id)
          .maybeSingle(),
        supabase
          .from("dispute_messages")
          .select(
            "*,author:profiles!dispute_messages_author_id_fkey(full_name)",
          )
          .eq("order_id", order.id)
          .order("created_at")
          .order("id")
          .range(page * 50, page * 50 + 50),
      ]);
      if (details.error) throw details.error;
      if (conversation.error) throw conversation.error;
      if (!details.data)
        throw new Error(
          "Case information is unavailable or access has expired.",
        );
      if (request !== sequence.current) return;
      setDispute(details.data);
      setMessages(conversation.data.slice(0, 50));
      setMore(conversation.data.length > 50);
      setError("");
      return true;
    } catch (cause) {
      if (request === sequence.current) setError(errorMessage(cause));
      return false;
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [order.id, page]);
  useDataRefresh(load, ["personal", "admin", "marketplace"]);
  if (loading || !dispute)
    return <LoadState loading={loading} error={error} retry={load} />;
  const party =
    !profile.is_admin && [order.buyer_id, order.seller_id].includes(userId);
  return (
    <div className="stack">
      <h3>
        {snapshot(order).title} · {money(order.amount)} test wallet
      </h3>
      <Feedback error={error} />
      <div className="note">
        <strong>{dispute.reason || "Buyer’s report"}</strong>
        <p className="preserve-lines">{dispute.description}</p>
        <p>Stage: {dispute.stage.replaceAll("_", " ")}</p>
      </div>
      <section>
        <h3>Case conversation</h3>
        {messages.map((m) => (
          <article className="case-message" key={m.id}>
            <strong>{m.author?.full_name ?? m.author_id}</strong>
            <p>
              <OrderTime value={m.created_at} />
            </p>
            <p className="preserve-lines">{m.body}</p>
          </article>
        ))}
        {!messages.length && <p>No responses yet.</p>}
        <div className="form-actions">
          <button
            className="btn"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Earlier messages
          </button>
          <span>Page {page + 1}</span>
          <button
            className="btn"
            disabled={!more}
            onClick={() => setPage((p) => p + 1)}
          >
            Later messages
          </button>
        </div>
      </section>
      {!dispute.resolved_at && (party || profile.is_admin) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (lock.current) return;
            if (!validLength(body, 3, profile.is_admin ? 2000 : 5000)) {
              setActionError(
                "Enter a message of at least 3 characters within the indicated limit.",
              );
              return;
            }
            lock.current = true;
            setBusy(true);
            setActionError("");
            void (async () => {
              try {
                const result = profile.is_admin
                  ? await supabase.rpc("admin_request_case_info", {
                      p_order_id: order.id,
                      p_message: body.trim(),
                    })
                  : await supabase.from("dispute_messages").insert({
                      order_id: order.id,
                      author_id: userId,
                      body: body.trim(),
                    });
                if (result.error) throw result.error;
                setBody("");
                notifyDataChanged(["personal", "admin"]);
              } catch (cause) {
                setActionError(errorMessage(cause));
              } finally {
                lock.current = false;
                setBusy(false);
              }
            })();
          }}
        >
          <label className="field">
            {profile.is_admin
              ? "Request further information"
              : "Add a response"}
            <textarea
              aria-label={
                profile.is_admin
                  ? "Request further information"
                  : "Add a response"
              }
              required
              minLength={3}
              maxLength={profile.is_admin ? 2000 : 5000}
              value={body}
              disabled={busy}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <button className="btn" disabled={busy}>
            {profile.is_admin
              ? "Send audited information request"
              : "Send response"}
          </button>
          <Feedback error={actionError} />
        </form>
      )}
      <CaseEvidence
        orderId={order.id}
        resolved={Boolean(dispute.resolved_at)}
      />
      <CaseNegotiation order={order} dispute={dispute} />
      <OrderHistory order={order} />
      {dispute.resolved_at && (
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
      {profile.is_admin &&
        !profile.is_suspended &&
        userId !== order.buyer_id &&
        userId !== order.seller_id &&
        dispute.stage === "admin_review" &&
        !dispute.resolved_at && <CaseDecision order={order} />}
    </div>
  );
}

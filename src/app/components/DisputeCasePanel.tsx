"use client";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dateLabel,
  errorMessage,
  money,
  notifyDataChanged,
  statusLabels,
  type Order,
} from "@/lib/marketplace";
import { useWorkspace } from "./SiteShell";
import { Feedback, LoadState, Modal } from "./UI";

interface Dispute {
  reason: string | null;
  description: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  favor_buyer: boolean | null;
}
interface Message {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
  author: { full_name: string } | null;
}
interface OrderEvent {
  id: string;
  status: string;
  created_at: string;
}
export default function DisputeCasePanel({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const { userId, profile } = useWorkspace();
  const [dispute, setDispute] = useState<Dispute | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [events, setEvents] = useState<OrderEvent[]>([]),
    [evidence, setEvidence] = useState<{ name: string; url: string }[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [actionError, setActionError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState(""),
    [note, setNote] = useState(""),
    [outcome, setOutcome] = useState(""),
    [confirm, setConfirm] = useState(false);
  const lock = useRef(false);
  const load = useCallback(async () => {
    try {
      const [details, folders] = await Promise.all([
        supabase
          .from("disputes")
          .select("*")
          .eq("order_id", order.id)
          .maybeSingle(),
        supabase.storage.from("dispute-evidence").list(order.id),
      ]);
      for (const result of [details, folders])
        if (result.error) throw result.error;
      if (!details.data)
        throw new Error(
          "Case details are unavailable. Refresh before taking any action.",
        );
      const conversation: Message[] = [],
        history: OrderEvent[] = [];
      for (let from = 0; ; from += 500) {
        const result = await supabase
          .from("dispute_messages")
          .select(
            "*,author:profiles!dispute_messages_author_id_fkey(full_name)",
          )
          .eq("order_id", order.id)
          .order("created_at")
          .order("id")
          .range(from, from + 499);
        if (result.error) throw result.error;
        conversation.push(...(result.data as unknown as Message[]));
        if (result.data.length < 500) break;
      }
      for (let from = 0; ; from += 500) {
        const result = await supabase
          .from("order_events")
          .select("*")
          .eq("order_id", order.id)
          .order("created_at")
          .order("id")
          .range(from, from + 499);
        if (result.error) throw result.error;
        history.push(...result.data);
        if (result.data.length < 500) break;
      }
      const paths: string[] = [];
      for (const folder of folders.data || []) {
        for (let offset = 0; ; offset += 100) {
          const files = await supabase.storage
            .from("dispute-evidence")
            .list(`${order.id}/${folder.name}`, { limit: 100, offset });
          if (files.error) throw files.error;
          paths.push(
            ...files.data
              .filter((file) => file.id)
              .map((file) => `${order.id}/${folder.name}/${file.name}`),
          );
          if (files.data.length < 100) break;
        }
      }
      const links = paths.length
        ? await supabase.storage
            .from("dispute-evidence")
            .createSignedUrls(paths, 600)
        : null;
      if (links?.error) throw links.error;
      setDispute(details.data);
      setMessages(conversation);
      setEvents(history);
      setEvidence(
        (links?.data || []).flatMap((item) =>
          item.signedUrl
            ? [
                {
                  name: item.path?.split("/").at(-1) || "Evidence",
                  url: item.signedUrl,
                },
              ]
            : [],
        ),
      );
      setError("");
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }, [order.id]);
  useDataRefresh(load, ["personal", "admin"]);
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError("");
    setSuccess("");
    try {
      await action();
      notifyDataChanged(["personal", "admin", "marketplace"]);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      file = new FormData(form).get("evidence") as File;
    if (
      !file?.size ||
      file.size > 10485760 ||
      !["image/jpeg", "image/png", "application/pdf"].includes(file.type)
    ) {
      setActionError("Choose a JPEG, PNG or PDF file up to 10 MB.");
      return;
    }
    await act(async () => {
      const extension =
        file.type === "application/pdf"
          ? "pdf"
          : file.type === "image/png"
            ? "png"
            : "jpg";
      const result = await supabase.storage
        .from("dispute-evidence")
        .upload(
          `${order.id}/${userId}/${crypto.randomUUID()}.${extension}`,
          file,
        );
      if (result.error) throw result.error;
      form.reset();
      setSuccess("Evidence uploaded securely.");
    });
  }
  return (
    <Modal
      title={`Case ${order.id.slice(0, 8).toUpperCase()}`}
      description={`${order.product?.title || "Item"} · ${money(order.amount)}`}
      busy={busy}
      onClose={onClose}
    >
      {loading || (error && !dispute) ? (
        <LoadState loading={loading} error={error} retry={load} />
      ) : (
        <div className="stack">
          <div className="note">
            <strong>
              Buyer’s report{dispute?.reason ? ` · ${dispute.reason}` : ""}
            </strong>
            <p className="preserve-lines">
              {dispute?.description ||
                "No detailed report was recorded for this case."}
            </p>
          </div>
          <section>
            <h3>Case conversation</h3>
            {messages.length ? (
              messages.map((m) => (
                <div className="case-message" key={m.id}>
                  <strong>{m.author?.full_name || "Participant"}</strong>
                  <small className="muted"> · {dateLabel(m.created_at)}</small>
                  <p className="preserve-lines">{m.body}</p>
                </div>
              ))
            ) : (
              <p className="small muted">No responses yet.</p>
            )}
          </section>
          <section>
            <h3>Evidence</h3>
            {evidence.length ? (
              <ul className="evidence-list">
                {evidence.map((file, i) => (
                  <li key={file.name}>
                    <a
                      className="text-link"
                      target="_blank"
                      rel="noreferrer"
                      href={file.url}
                    >
                      View attachment {i + 1} (
                      {file.name.split(".").at(-1)?.toUpperCase()})
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">No evidence has been uploaded.</p>
            )}
            <button
              type="button"
              className="text-link"
              onClick={load}
              disabled={busy}
            >
              Refresh attachments
            </button>
          </section>
          {dispute && !dispute.resolved_at && (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!body.trim()) {
                    setActionError("Enter a response.");
                    return;
                  }
                  void act(async () => {
                    const result = await supabase
                      .from("dispute_messages")
                      .insert({
                        order_id: order.id,
                        author_id: userId,
                        body: body.trim(),
                      });
                    if (result.error) throw result.error;
                    setBody("");
                    setSuccess("Response added.");
                  });
                }}
              >
                <label className="field">
                  Add a response
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    required
                    maxLength={5000}
                    rows={3}
                    disabled={busy}
                  />
                </label>
                <div className="form-actions">
                  <button className="btn" disabled={busy}>
                    Send response
                  </button>
                </div>
              </form>
              <form onSubmit={upload}>
                <label className="field">
                  Add evidence
                  <input
                    name="evidence"
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    required
                    disabled={busy}
                  />
                  <small>
                    Private to the case participants and administrators. Up to
                    10 MB.
                  </small>
                </label>
                <div className="form-actions">
                  <button className="btn" disabled={busy}>
                    Upload evidence
                  </button>
                </div>
              </form>
            </>
          )}
          <details>
            <summary>Order history</summary>
            {events.length ? (
              events.map((item) => (
                <p key={item.id}>
                  {dateLabel(item.created_at)} ·{" "}
                  {statusLabels[item.status] || item.status}
                </p>
              ))
            ) : (
              <p>No history recorded.</p>
            )}
          </details>
          {dispute?.resolved_at && (
            <div className="note">
              <strong>
                {dispute.favor_buyer
                  ? "Buyer refunded"
                  : "Payment released to seller"}
              </strong>
              <p className="preserve-lines">
                {dispute.resolution_note || "No resolution note recorded."}
              </p>
              <p>{dateLabel(dispute.resolved_at)}</p>
            </div>
          )}
          {profile.is_admin &&
            !profile.is_suspended &&
            order.buyer_id !== userId &&
            order.product?.seller_id !== userId &&
            order.status === "disputed" &&
            !dispute?.resolved_at && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (note.trim().length < 3 || note.trim().length > 5000) {
                    setActionError(
                      "Record a decision reason of 3?5000 characters.",
                    );
                    return;
                  }
                  setConfirm(true);
                }}
              >
                <label className="field">
                  Resolution
                  <select
                    required
                    value={outcome}
                    onChange={(event) => {
                      setOutcome(event.target.value);
                      setConfirm(false);
                    }}
                    disabled={busy}
                  >
                    <option value="">Choose a resolution</option>
                    <option value="buyer">Refund buyer</option>
                    <option value="seller">Release payment to seller</option>
                  </select>
                </label>
                <label className="field case-reason">
                  Decision reason
                  <textarea
                    required
                    maxLength={5000}
                    rows={3}
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setConfirm(false);
                    }}
                    disabled={busy}
                  />
                </label>
                {confirm ? (
                  <div className="note amber">
                    <strong>Confirm this decision?</strong>
                    <p>
                      {outcome === "buyer" ? "Refund buyer" : "Pay seller"} ·{" "}
                      {money(order.amount)}. This action cannot be undone.
                    </p>
                    <p className="preserve-lines">{note}</p>
                    <div className="form-actions">
                      <button
                        className="btn"
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirm(false)}
                      >
                        Go back
                      </button>
                      <button
                        className="btn primary"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          act(async () => {
                            const result = await supabase.rpc(
                              "resolve_dispute_with_note",
                              {
                                p_order_id: order.id,
                                p_favor_buyer: outcome === "buyer",
                                p_note: note.trim(),
                              },
                            );
                            if (result.error) throw result.error;
                            setSuccess(
                              "Resolution recorded. Funds transferred.",
                            );
                            setConfirm(false);
                          })
                        }
                      >
                        {busy ? "Resolving…" : "Confirm resolution"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="form-actions">
                    <button className="btn primary" disabled={busy}>
                      Review decision
                    </button>
                  </div>
                )}
              </form>
            )}
          <Feedback error={actionError} message={success} />
        </div>
      )}
    </Modal>
  );
}

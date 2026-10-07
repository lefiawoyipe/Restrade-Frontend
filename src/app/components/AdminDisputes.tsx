"use client";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage, money } from "@/lib/marketplace";
import { record, text } from "@/lib/pickup";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { PageHeader, Feedback, LoadState } from "./UI";
import { OrderTime } from "./OrderTime";
import DisputeCasePanel from "./DisputeCasePanel";
type Case = {
  id: string;
  stage: string;
  title: string;
  amount: number;
  opened: string;
  resolved: string | null;
  escalated: string | null;
};
export default function AdminDisputes() {
  const [rows, setRows] = useState<Case[]>([]),
    [history, setHistory] = useState(false),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [more, setMore] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const result = await supabase.rpc("admin_case_queue", {
        p_limit: 25,
        p_offset: page * 25,
        p_resolved: history,
      });
      if (result.error) throw result.error;
      if (!Array.isArray(result.data))
        throw new Error("Unexpected case queue response.");
      const data = result.data.map((value) => {
        const row = record(value);
        if (!text(row.order_id) || typeof row.amount !== "number")
          throw new Error("Incomplete case queue entry.");
        return {
          id: text(row.order_id),
          stage: text(row.stage),
          title: text(row.title, "Purchase snapshot unavailable"),
          amount: row.amount,
          opened: text(row.opened_at),
          resolved: text(row.resolved_at) || null,
          escalated: text(row.escalated_at) || null,
        };
      });
      if (request !== sequence.current) return;
      setRows(data);
      setMore(data.length === 25);
      setError("");
      return true;
    } catch (cause) {
      if (request === sequence.current) setError(errorMessage(cause));
      return false;
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [history, page]);
  useDataRefresh(load, ["admin"]);
  return (
    <>
      <PageHeader
        title="Dispute resolution"
        description="Audited review of escalated cases. Negotiation and return cases remain private to participants."
      />
      <div className="tabs">
        <button
          className={`tab ${!history ? "active" : ""}`}
          onClick={() => {
            setHistory(false);
            setPage(0);
          }}
        >
          Open cases
        </button>
        <button
          className={`tab ${history ? "active" : ""}`}
          onClick={() => {
            setHistory(true);
            setPage(0);
          }}
        >
          Resolution history
        </button>
      </div>
      <Feedback error={error} />
      <LoadState loading={loading} />
      <section className="panel">
        {rows.map((row) => (
          <article className="order-row" key={row.id}>
            <div>
              <strong>{row.title}</strong>
              <p>
                {row.id} · {money(row.amount)} test wallet
              </p>
              <p>
                {row.stage.replaceAll("_", " ")} · Opened{" "}
                <OrderTime value={row.opened} />
              </p>
              {row.escalated && (
                <p>
                  Escalated <OrderTime value={row.escalated} />
                </p>
              )}
              {row.resolved && (
                <p>
                  Resolved <OrderTime value={row.resolved} />
                </p>
              )}
            </div>
            <button className="btn" onClick={() => setSelected(row.id)}>
              {history ? "View decision" : "Review case"}
            </button>
          </article>
        ))}
        {!loading && !rows.length && !error && <p>No cases on this page.</p>}
      </section>
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
      {selected && (
        <DisputeCasePanel
          orderId={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

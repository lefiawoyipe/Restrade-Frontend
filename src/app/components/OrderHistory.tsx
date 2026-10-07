"use client";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";
import { errorMessage, type Order } from "@/lib/marketplace";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { OrderTime } from "./OrderTime";
import { Feedback } from "./UI";
type Event = Tables<"order_events"> & {
  actor: { full_name: string | null } | null;
};
export default function OrderHistory({ order }: { order: Order }) {
  const [events, setEvents] = useState<Event[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [error, setError] = useState("");
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    const result = await supabase
      .from("order_events")
      .select("*,actor:profiles!order_events_actor_id_fkey(full_name)")
      .eq("order_id", order.id)
      .order("created_at")
      .order("id")
      .range(page * 50, page * 50 + 50);
    if (request !== sequence.current) return;
    if (result.error) {
      setError(errorMessage(result.error));
      return false;
    }
    setEvents(result.data.slice(0, 50));
    setMore(result.data.length > 50);
    setError("");
    return true;
  }, [order.id, page]);
  useDataRefresh(load, ["personal", "admin", "marketplace"]);
  return (
    <section>
      <h3>Order history</h3>
      <Feedback error={error} />
      {events.map((event) => (
        <article className="case-message" key={event.id}>
          <strong>
            {(event.event_type || event.status).replaceAll("_", " ")}
          </strong>
          <p>
            <OrderTime value={event.created_at} /> ·{" "}
            {event.actor_id === null
              ? "System"
              : (event.actor?.full_name ??
                (event.actor_id === order.buyer_id
                  ? "Buyer"
                  : event.actor_id === order.seller_id
                    ? "Seller"
                    : `Administrator / ${event.actor_id}`))}
          </p>
          {event.details && (
            <details>
              <summary>Recorded details</summary>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {JSON.stringify(event.details, null, 2)}
              </pre>
            </details>
          )}
        </article>
      ))}
      {!error && !events.length && <p>No events recorded on this page.</p>}
      <div className="form-actions">
        <button
          className="btn"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Earlier history
        </button>
        <span>Page {page + 1}</span>
        <button
          className="btn"
          disabled={!more}
          onClick={() => setPage((p) => p + 1)}
        >
          Later history
        </button>
      </div>
    </section>
  );
}

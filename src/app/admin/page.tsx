"use client";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage, loadOrders, money, type Order } from "@/lib/marketplace";
import SiteShell, { useWorkspace } from "../components/SiteShell";
import DisputeCasePanel from "../components/DisputeCasePanel";
import { Icon, LoadState, PageHeader, StatusBadge } from "../components/UI";
function AdminContent() {
  const { profile } = useWorkspace();
  const [orders, setOrders] = useState<Order[]>([]),
    [resolved, setResolved] = useState<string[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Order | null>(null),
    [history, setHistory] = useState(false);
  const load = useCallback(async () => {
    if (!profile.is_admin) return;
    try {
      const activity = await loadOrders();
      const resolvedIds: string[] = [];
      for (let from = 0; ; from += 500) {
        const cases = await supabase
          .from("disputes")
          .select("order_id")
          .not("resolved_at", "is", null)
          .order("order_id")
          .range(from, from + 499);
        if (cases.error) throw cases.error;
        resolvedIds.push(...cases.data.map((d) => d.order_id));
        if (cases.data.length < 500) break;
      }
      setOrders(activity);
      setResolved(resolvedIds);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [profile.is_admin]);
  useDataRefresh(load);
  if (!profile.is_admin) return <p>Administrator access required.</p>;
  const open = orders.filter((o) => o.status === "disputed"),
    visible = history ? orders.filter((o) => resolved.includes(o.id)) : open;
  return (
    <>
      <PageHeader
        title="Dispute resolution"
        description="Review both sides before deciding where funds go."
      />
      {loading || error ? (
        <LoadState loading={loading} error={error} retry={load} />
      ) : (
        <>
          <div className="stats">
            {[
              ["Open disputes", open.length, "Awaiting a decision", "shield"],
              [
                "Funds on hold",
                money(open.reduce((sum, o) => sum + Number(o.amount), 0)),
                "Across open disputes",
                "wallet",
              ],
              [
                "Resolved disputes",
                resolved.length,
                "Recorded decisions",
                "check",
              ],
            ].map(([title, value, sub, icon]) => (
              <div className="stat" key={title}>
                <div className="row">
                  {title}
                  <Icon name={String(icon)} />
                </div>
                <strong>{value}</strong>
                <small>{sub}</small>
              </div>
            ))}
          </div>
          <div className="tabs">
            <button
              className={`tab ${!history ? "active" : ""}`}
              aria-pressed={!history}
              onClick={() => setHistory(false)}
            >
              Open cases
            </button>
            <button
              className={`tab ${history ? "active" : ""}`}
              aria-pressed={history}
              onClick={() => setHistory(true)}
            >
              Resolution history
            </button>
          </div>
          <section className="panel">
            <div className="panel-head">
              <h2>
                {history ? "Recorded resolutions" : "Needs your attention"}
              </h2>
            </div>
            {visible.length ? (
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Dispute queue"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Order / item</th>
                      <th>Buyer</th>
                      <th>Seller</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <strong>{o.id.slice(0, 8).toUpperCase()}</strong>
                          <br />
                          <span className="small muted">
                            {o.product?.title || "Item unavailable"}
                          </span>
                        </td>
                        <td>{o.buyer?.full_name || "Buyer"}</td>
                        <td>{o.product?.seller?.full_name || "Seller"}</td>
                        <td>{money(o.amount)}</td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td>
                          <button
                            className="btn"
                            onClick={() => setSelected(o)}
                          >
                            {history ? "View decision" : "Review case"}
                            <Icon name="arrow" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">
                <h3>
                  {history ? "No resolutions recorded." : "All caught up."}
                </h3>
                <p>
                  {history
                    ? "Resolved cases will appear here."
                    : "There are no open disputes to review."}
                </p>
              </div>
            )}
          </section>
        </>
      )}
      {selected && (
        <DisputeCasePanel order={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
export default function Admin() {
  return (
    <SiteShell>
      <AdminContent />
    </SiteShell>
  );
}

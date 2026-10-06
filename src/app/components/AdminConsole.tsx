"use client";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dateLabel,
  errorMessage,
  money,
  notifyDataChanged,
  orderSelect,
  productSelect,
  type Order,
  type Product,
  type Profile,
} from "@/lib/marketplace";
import type { Tables } from "@/lib/database.types";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { useWorkspace } from "./SiteShell";
import { Feedback, LoadState, Modal, PageHeader, StatusBadge } from "./UI";
import DisputeCasePanel from "./DisputeCasePanel";

type Section = "overview" | "inventory" | "users" | "orders" | "audit";
type Action = {
  kind: "product" | "user";
  id: string;
  label: string;
  enabled: boolean;
};
const pageSize = 25;
export default function AdminConsole({ section }: { section: Section }) {
  const { userId, profile } = useWorkspace();
  const [page, setPage] = useState(0),
    [more, setMore] = useState(false);
  const [products, setProducts] = useState<Product[]>([]),
    [users, setUsers] = useState<Profile[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [audit, setAudit] = useState<Tables<"admin_audit_log">[]>([]);
  const [counts, setCounts] = useState({
    products: 0,
    users: 0,
    orders: 0,
    disputes: 0,
  });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [action, setAction] = useState<Action | null>(null),
    [selected, setSelected] = useState<Order | null>(null);
  const active = profile.is_admin && !profile.is_suspended;
  const load = useCallback(async () => {
    if (!active) return;
    try {
      const from = page * pageSize,
        to = from + pageSize;
      if (section === "overview") {
        const results = await Promise.all([
          supabase
            .from("products")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true }),
          supabase.from("orders").select("id", { count: "exact", head: true }),
          supabase
            .from("disputes")
            .select("order_id", { count: "exact", head: true })
            .is("resolved_at", null),
        ]);
        for (const result of results) if (result.error) throw result.error;
        setCounts({
          products: results[0].count ?? 0,
          users: results[1].count ?? 0,
          orders: results[2].count ?? 0,
          disputes: results[3].count ?? 0,
        });
      } else if (section === "inventory") {
        const result = await supabase
          .from("products")
          .select(productSelect)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to);
        if (result.error) throw result.error;
        setProducts(result.data.slice(0, pageSize) as unknown as Product[]);
        setMore(result.data.length > pageSize);
      } else if (section === "users") {
        const result = await supabase
          .from("profiles")
          .select("*")
          .order("id")
          .range(from, to);
        if (result.error) throw result.error;
        setUsers(result.data.slice(0, pageSize));
        setMore(result.data.length > pageSize);
      } else if (section === "orders") {
        const result = await supabase
          .from("orders")
          .select(orderSelect)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to);
        if (result.error) throw result.error;
        setOrders(result.data.slice(0, pageSize) as unknown as Order[]);
        setMore(result.data.length > pageSize);
      } else {
        const result = await supabase
          .from("admin_audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to);
        if (result.error) throw result.error;
        setAudit(result.data.slice(0, pageSize));
        setMore(result.data.length > pageSize);
      }
      setError("");
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }, [active, page, section]);
  useDataRefresh(load, ["admin"]);
  if (!active) return <p>Active administrator access required.</p>;
  const choose = (next: Action) => setAction(next);
  return (
    <>
      <PageHeader
        title={
          section === "overview"
            ? "Administration overview"
            : section === "orders"
              ? "Orders and escrow"
              : section === "audit"
                ? "Audit history"
                : section[0].toUpperCase() + section.slice(1)
        }
        description="Review marketplace activity and recorded administrative decisions."
      />
      <LoadState loading={loading} error={error} retry={load} />
      {!loading && (
        <>
          {section === "overview" && (
            <div className="stats">
              {Object.entries(counts).map(([name, count]) => (
                <div className="stat" key={name}>
                  <div>{name === "disputes" ? "Open disputes" : name}</div>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          )}
          {section === "inventory" && (
            <section className="panel">
              {products.length ? (
                products.map((p) => (
                  <div className="order-row" key={p.id}>
                    <div>
                      <strong>{p.title}</strong>
                      <p>
                        {p.seller?.full_name ?? "Seller unavailable"} ·{" "}
                        {money(p.price)}
                      </p>
                      <StatusBadge status={p.status} />{" "}
                      <span className="badge neutral">
                        {p.moderation_status}
                      </span>
                    </div>
                    <button
                      className="btn"
                      onClick={() =>
                        choose({
                          kind: "product",
                          id: p.id,
                          label: p.title,
                          enabled: p.moderation_status !== "hidden",
                        })
                      }
                    >
                      {p.moderation_status === "hidden"
                        ? "Restore visibility"
                        : "Hide listing"}
                    </button>
                  </div>
                ))
              ) : (
                <p>No listings on this page.</p>
              )}
            </section>
          )}
          {section === "users" && (
            <section className="panel">
              {users.length ? (
                users.map((u) => (
                  <div className="order-row" key={u.id}>
                    <div>
                      <strong>{u.full_name ?? "Unnamed account"}</strong>
                      <p>{u.id}</p>
                      <span className="badge neutral">
                        {u.is_admin
                          ? "Administrator"
                          : u.is_suspended
                            ? "Trading suspended"
                            : "Active student"}
                      </span>
                    </div>
                    {!u.is_admin && u.id !== userId && (
                      <button
                        className="btn"
                        onClick={() =>
                          choose({
                            kind: "user",
                            id: u.id,
                            label: u.full_name ?? u.id,
                            enabled: !u.is_suspended,
                          })
                        }
                      >
                        {u.is_suspended ? "Restore trading" : "Suspend trading"}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p>No accounts on this page.</p>
              )}
            </section>
          )}
          {section === "orders" && (
            <section className="panel">
              {orders.length ? (
                orders.map((o) => (
                  <div className="order-row" key={o.id}>
                    <div>
                      <strong>{o.product?.title ?? "Item unavailable"}</strong>
                      <p>{o.id}</p>
                      <p>
                        Buyer: {o.buyer?.full_name ?? "Unavailable"} · Seller:{" "}
                        {o.product?.seller?.full_name ?? "Unavailable"}
                      </p>
                      <p>
                        {money(o.amount)} ·{" "}
                        {["escrow_funded", "disputed"].includes(o.status ?? "")
                          ? "Held in escrow"
                          : "Not currently held in escrow"}
                      </p>
                      <StatusBadge status={o.status} />
                      {o.product && (
                        <p>
                          Listing: {o.product.status} ·{" "}
                          {o.product.moderation_status}
                        </p>
                      )}
                    </div>
                    {["disputed", "refunded"].includes(o.status ?? "") && (
                      <button className="btn" onClick={() => setSelected(o)}>
                        View case
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p>No orders on this page.</p>
              )}
            </section>
          )}
          {section === "audit" && (
            <section className="panel">
              {audit.length ? (
                audit.map((row) => (
                  <article className="case-message" key={row.id}>
                    <strong>{row.action}</strong>
                    <p>
                      {dateLabel(row.created_at)} · {row.id}
                    </p>
                    <p>
                      Actor: {row.actor_id}
                      <br />
                      Target: {row.target_id}
                    </p>
                    <p className="preserve-lines">{row.reason}</p>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {JSON.stringify(row.details, null, 2)}
                    </pre>
                  </article>
                ))
              ) : (
                <p>No audit entries on this page.</p>
              )}
            </section>
          )}
          {section !== "overview" && (
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
          )}
        </>
      )}
      {action && (
        <ReasonDialog
          key={`${action.kind}:${action.id}`}
          action={action}
          onClose={() => setAction(null)}
        />
      )}
      {selected && (
        <DisputeCasePanel
          order={orders.find((o) => o.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function ReasonDialog({
  action,
  onClose,
}: {
  action: Action;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  const label =
    action.kind === "product"
      ? action.enabled
        ? "Hide listing"
        : "Restore visibility"
      : action.enabled
        ? "Suspend trading"
        : "Restore trading";
  async function submit() {
    if (lock.current) return;
    if (reason.trim().length < 3 || reason.trim().length > 2000) {
      setError("Enter a reason of 3–2000 characters.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result =
        action.kind === "product"
          ? await supabase.rpc("admin_moderate_product", {
              p_product_id: action.id,
              p_hidden: action.enabled,
              p_reason: reason.trim(),
            })
          : await supabase.rpc("admin_suspend_trading", {
              p_user_id: action.id,
              p_suspended: action.enabled,
              p_reason: reason.trim(),
            });
      if (result.error) throw result.error;
      notifyDataChanged(["admin", "marketplace"]);
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
      title={label}
      description={`${action.label} (${action.id})`}
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (reason.trim().length < 3 || reason.trim().length > 2000)
            setError("Enter a reason of 3–2000 characters.");
          else {
            setError("");
            setConfirm(true);
          }
        }}
      >
        <label className="field">
          Reason
          <textarea
            aria-label="Reason"
            required
            minLength={3}
            maxLength={2000}
            value={reason}
            disabled={busy}
            onChange={(e) => {
              setReason(e.target.value);
              setConfirm(false);
            }}
          />
        </label>
        <Feedback error={error} />
        {confirm && (
          <p className="note">
            Confirm {label.toLowerCase()} for {action.label}? Your reason will
            be recorded in audit history.
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          {confirm ? (
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={submit}
            >
              Confirm {label.toLowerCase()}
            </button>
          ) : (
            <button className="btn primary" disabled={busy}>
              Review action
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

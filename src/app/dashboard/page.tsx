"use client";
import { useDataRefresh } from "@/lib/use-data-refresh";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  errorMessage,
  loadOrders,
  loadProducts,
  money,
  notifyDataChanged,
  type Order,
  type Product,
} from "@/lib/marketplace";
import SiteShell, { useWorkspace } from "../components/SiteShell";
import ListingForm from "../components/ListingForm";
import {
  Feedback,
  Icon,
  LoadState,
  Modal,
  PageHeader,
  ProductImage,
  StatusBadge,
} from "../components/UI";

function DashboardContent() {
  const { userId, profile, sell } = useWorkspace();
  const [products, setProducts] = useState<Product[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [balance, setBalance] = useState<number | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [topUp, setTopUp] = useState(false),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(""),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState<Product | null>(null);
  const lock = useRef(false);
  const load = useCallback(async () => {
    try {
      const [inventory, activity, wallet] = await Promise.all([
        loadProducts(userId, true),
        loadOrders(),
        supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", userId)
          .single(),
      ]);
      if (wallet.error) throw wallet.error;
      setProducts(inventory);
      setOrders(activity.filter((o) => o.buyer_id === userId));
      setBalance(wallet.data.balance);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useDataRefresh(load);
  async function fund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const amount = Number(new FormData(event.currentTarget).get("amount"));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      setActionError("Enter an amount between GH₵ 0.01 and GH₵ 100,000.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setActionError("");
    try {
      const { error: failure } = await supabase.rpc("fund_wallet", {
        p_amount: amount,
      });
      if (failure) throw failure;
      setTopUp(false);
      setMessage(`${money(amount)} added to your test wallet.`);
      notifyDataChanged();
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const active = orders.filter((o) =>
    ["escrow_funded", "disputed"].includes(o.status),
  );
  return (
    <>
      <PageHeader
        title={`Hey ${profile.full_name?.split(" ")[0] || "there"}, welcome back.`}
        description="Here’s what’s happening with your campus trades."
        action={
          <Link className="btn primary" href="/marketplace">
            Explore marketplace <Icon name="arrow" />
          </Link>
        }
      />
      <Feedback message={message} />
      {loading || error ? (
        <LoadState loading={loading} error={error} retry={load} />
      ) : (
        <>
          <div className="stats">
            {[
              ["Your listings", products.length, "Items you’ve listed", "shop"],
              [
                "Active orders",
                active.length,
                "Ready for the next step",
                "box",
              ],
              [
                "Completed purchases",
                orders.filter((o) => o.status === "completed").length,
                "Trades wrapped up",
                "check",
              ],
            ].map(([label, count, sub, icon]) => (
              <div className="stat" key={label}>
                <div className="row">
                  {label}
                  <Icon name={String(icon)} />
                </div>
                <strong>{count}</strong>
                <small>{sub}</small>
              </div>
            ))}
          </div>
          <div className="grid-two">
            <section className="panel">
              <div className="panel-head">
                <h2>Recent orders</h2>
                <Link className="text-link" href="/orders">
                  View all <Icon name="arrow" />
                </Link>
              </div>
              {orders.length ? (
                orders.slice(0, 3).map((o) => (
                  <Link className="order-row" key={o.id} href="/orders">
                    <span className="row">
                      <ProductImage
                        src={o.product?.image_url || null}
                        title={o.product?.title || "Item"}
                        className="thumb"
                      />
                      <span>
                        <strong>
                          {o.product?.title || "Item unavailable"}
                        </strong>
                        <br />
                        <small>
                          {money(o.amount)} · {o.id.slice(0, 8)}
                        </small>
                      </span>
                    </span>
                    <StatusBadge status={o.status} />
                  </Link>
                ))
              ) : (
                <div className="empty">
                  <h3>Your first trade is waiting.</h3>
                  <p>Find something useful on the marketplace.</p>
                  <Link className="btn" href="/marketplace">
                    Browse items
                  </Link>
                </div>
              )}
            </section>
            <section className="panel wallet">
              <div className="row between">
                <h2>Test wallet</h2>
                <Icon name="wallet" />
              </div>
              <div className="balance">
                {balance === null ? "Unavailable" : money(balance)}
              </div>
              <small className="muted">Available test balance</small>
              <div className="wallet-held row between small">
                <span className="muted">Held in escrow</span>
                <strong>
                  {money(active.reduce((sum, o) => sum + Number(o.amount), 0))}
                </strong>
              </div>
              <button
                className="btn lime"
                onClick={() => {
                  setActionError("");
                  setTopUp(true);
                }}
              >
                <Icon name="plus" />
                Top up test balance
              </button>
              <p className="small muted wallet-note">
                Practice trading. No real money moves.
              </p>
            </section>
          </div>
          <section className="panel inventory-empty" id="inventory">
            <div className="panel-head">
              <h2>Your listings</h2>
              <button className="text-link" onClick={sell}>
                <Icon name="plus" />
                List an item
              </button>
            </div>
            {products.length ? (
              products.map((p) => (
                <div className="order-row" key={p.id}>
                  <div className="row">
                    <ProductImage
                      src={p.image_url}
                      title={p.title}
                      className="thumb"
                    />
                    <div>
                      <strong>{p.title}</strong>
                      <p className="small muted">{money(p.price)}</p>
                    </div>
                  </div>
                  <div className="row wrap">
                    <StatusBadge status={p.status} />
                    <button
                      className="btn"
                      disabled={p.status !== "available"}
                      onClick={() => setEditing(p)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">
                <h3>Your next sale starts here.</h3>
                <p>
                  That spare textbook or unused lamp could be someone’s next
                  great find.
                </p>
                <button className="btn primary" onClick={sell}>
                  <Icon name="plus" />
                  Create your first listing
                </button>
              </div>
            )}
          </section>
        </>
      )}
      {topUp && (
        <Modal
          title="Top up your test wallet"
          description="Add test funds to practice trading. No real money moves."
          onClose={() => setTopUp(false)}
          busy={busy}
        >
          <form onSubmit={fund}>
            <label className="field">
              Amount (GH₵)
              <input
                name="amount"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                required
                disabled={busy}
              />
            </label>
            <Feedback error={actionError} />
            <div className="form-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setTopUp(false)}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? "Adding funds…" : "Add test funds"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {editing && (
        <ListingForm
          userId={userId}
          campus={profile.campus}
          product={editing}
          onSaved={() => setMessage("Listing updated successfully.")}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
export default function Dashboard() {
  return (
    <SiteShell>
      <DashboardContent />
    </SiteShell>
  );
}

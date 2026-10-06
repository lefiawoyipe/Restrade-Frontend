"use client";
import { useDataRefresh } from "@/lib/use-data-refresh";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  conditions,
  dateLabel,
  errorMessage,
  requireTrader,
  initials,
  money,
  notifyDataChanged,
  productSelect,
  type Product,
} from "@/lib/marketplace";
import SiteShell, { useWorkspace } from "../../components/SiteShell";
import {
  Feedback,
  Icon,
  LoadState,
  Modal,
  ProductImage,
  StatusBadge,
} from "../../components/UI";

function Details() {
  const { id } = useParams<{ id: string }>(),
    { userId, profile } = useWorkspace();
  const [product, setProduct] = useState<Product | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [actionError, setActionError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [purchased, setPurchased] = useState(false);
  const lock = useRef(false);
  const load = useCallback(async () => {
    try {
      const result = await supabase
        .from("products")
        .select(productSelect)
        .eq("id", id)
        .maybeSingle();
      if (result.error) throw result.error;
      setProduct(result.data as unknown as Product | null);
      setError("");
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }, [id]);
  useDataRefresh(load, ["marketplace"]);
  async function purchase() {
    if (!product || lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError("");
    try {
      await requireTrader();
      if (
        product.moderation_status !== "visible" ||
        product.seller?.is_admin ||
        product.seller?.is_suspended
      )
        throw new Error("This listing is unavailable for purchase.");
      const result = await supabase.rpc("initiate_purchase", {
        p_product_id: product.id,
      });
      if (result.error) throw result.error;
      setPurchased(true);
      setConfirm(false);
      notifyDataChanged();
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (loading || (error && !product))
    return <LoadState loading={loading} error={error} retry={load} />;
  if (!product)
    return (
      <div className="empty">
        <h1>Listing unavailable</h1>
        <p>This item could not be found.</p>
        <Link href="/marketplace" className="btn">
          Back to marketplace
        </Link>
      </div>
    );
  const own = product.seller_id === userId;
  const available =
    product.status === "available" &&
    product.moderation_status === "visible" &&
    product.seller &&
    !product.seller.is_admin &&
    !product.seller.is_suspended;
  return (
    <>
      <Link href="/marketplace" className="back">
        <Icon name="back" />
        Back to marketplace
      </Link>
      <Feedback error={error} />
      <section className="product-detail">
        <div>
          <ProductImage
            src={product.image_url}
            title={product.title}
            className="detail-photo"
          />
          <div className="panel detail-description">
            <h2>About this item</h2>
            <p className="muted preserve-lines">
              {product.description || "No description provided."}
            </p>
          </div>
        </div>
        <div>
          <div className="row">
            <span className="badge neutral">
              {product.category || "Uncategorized"}
            </span>
            <StatusBadge status={product.status} />
            {product.moderation_status === "hidden" && (
              <span className="badge red">Hidden by moderation</span>
            )}
          </div>
          <h1>{product.title}</h1>
          <p className="small muted">Listed {dateLabel(product.created_at)}</p>
          <div className="price detail-price">{money(product.price)}</div>
          <div className="detail-specs">
            <div>
              <small>Condition</small>
              {conditions[product.condition || ""] || "Not provided"}
            </div>
            <div>
              <small>Collection area</small>
              {[product.location, product.campus].filter(Boolean).join(", ") ||
                "Ask the seller"}
            </div>
          </div>
          <div className="panel">
            <div className="row">
              <span className="avatar">
                {initials(product.seller?.full_name || "")}
              </span>
              <div>
                <strong>{product.seller?.full_name || "Seller"}</strong>
                <p className="small muted">
                  {product.seller && (product.seller.total_reviews ?? 0) > 0
                    ? `★ ${Number(product.seller.trust_score).toFixed(1)} · ${product.seller.total_reviews} reviews`
                    : "No reviews yet"}
                </p>
              </div>
            </div>
          </div>
          <div className="note detail-note">
            <strong>
              <Icon name="shield" /> How your payment works
            </strong>
            <p>
              Funds stay in escrow until you confirm receipt. Inspect the item
              first; report a problem if it differs from the listing.
            </p>
          </div>
          {purchased ? (
            <div className="feedback success" role="status">
              Purchase confirmed. Your funds are held in escrow.{" "}
              <Link className="text-link" href="/orders">
                View your order <Icon name="arrow" />
              </Link>
            </div>
          ) : (
            <button
              className="btn primary"
              disabled={
                own ||
                profile.is_suspended ||
                profile.is_admin ||
                product.status !== "available" ||
                product.moderation_status !== "visible" ||
                !product.seller ||
                product.seller.is_admin ||
                product.seller.is_suspended
              }
              onClick={() => {
                setActionError("");
                setConfirm(true);
              }}
            >
              {own
                ? "This is your listing"
                : profile.is_suspended
                  ? "Trading suspended"
                  : !available
                    ? "No longer available"
                    : "Buy with test escrow"}
              <Icon name="arrow" />
            </button>
          )}
          <p className="small muted detail-disclaimer">
            Uses your test wallet. No real payment.
          </p>
        </div>
      </section>
      {confirm && (
        <Modal
          title="Review your purchase"
          description="Your payment will be held until you receive and inspect the item."
          busy={busy}
          onClose={() => setConfirm(false)}
        >
          <div className="purchase-summary">
            <strong>{product.title}</strong>
            <span>{money(product.price)}</span>
          </div>
          <p className="note">
            Only confirm receipt after checking the item. You can report a
            problem while funds are held.
          </p>
          <Feedback error={actionError} />
          <div className="form-actions">
            <button
              className="btn"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Cancel
            </button>
            <button className="btn primary" disabled={busy} onClick={purchase}>
              {busy
                ? "Confirming…"
                : `Confirm purchase · ${money(product.price)}`}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export default function ProductDetails() {
  return (
    <SiteShell>
      <Details />
    </SiteShell>
  );
}

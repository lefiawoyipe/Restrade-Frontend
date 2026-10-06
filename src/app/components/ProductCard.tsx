"use client";
import Link from "next/link";
import { conditions, dateLabel, money, type Product } from "@/lib/marketplace";
import { Icon, ProductImage } from "./UI";
export default function ProductCard({
  product: p,
  saved,
  saving,
  onSave,
}: {
  product: Product;
  saved?: boolean;
  saving?: boolean;
  onSave?: () => void;
}) {
  return (
    <article data-product-id={p.id} className="product">
      <div className="product-photo">
        <Link href={`/marketplace/${p.id}`} aria-label={`View ${p.title}`}>
          <ProductImage src={p.image_url} title={p.title} />
        </Link>
        {p.condition && (
          <span className="condition">
            {conditions[p.condition] || p.condition}
          </span>
        )}
        {onSave && (
          <button
            className={`save ${saved ? "active" : ""}`}
            onClick={onSave}
            disabled={saving}
            aria-label={`${saved ? "Unsave" : "Save"} ${p.title}`}
            aria-pressed={Boolean(saved)}
          >
            <Icon name="heart" />
          </button>
        )}
      </div>
      <div className="product-body">
        <div className="product-meta">
          <span>{p.category || "Uncategorized"}</span>
          <span>{dateLabel(p.created_at)}</span>
        </div>
        <h3>
          <Link href={`/marketplace/${p.id}`}>{p.title}</Link>
        </h3>
        <div className="price">{money(p.price)}</div>
        <div className="product-foot">
          <span className="row">
            <Icon name="pin" />
            {p.location || p.campus || "Location not provided"}
          </span>
          <span className="rating">
            {p.seller && (p.seller.total_reviews ?? 0) > 0
              ? `★ ${Number(p.seller.trust_score).toFixed(1)}`
              : "No reviews yet"}{" "}
            · {p.seller?.full_name || "Seller"}
          </span>
        </div>
      </div>
    </article>
  );
}

"use client";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { Suspense, useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  categories,
  errorMessage,
  loadProducts,
  type Product,
} from "@/lib/marketplace";
import SiteShell, { useWorkspace } from "../components/SiteShell";
import ProductCard from "../components/ProductCard";
import { Feedback, Icon, LoadState, PageHeader } from "../components/UI";

function MarketplaceContent() {
  const { userId, sell } = useWorkspace(),
    params = useSearchParams(),
    search = params.get("q") || "";
  const [products, setProducts] = useState<Product[]>([]),
    [saved, setSaved] = useState<string[]>([]),
    [category, setCategory] = useState("All items"),
    [sort, setSort] = useState("recent"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [actionError, setActionError] = useState(""),
    [saving, setSaving] = useState<string[]>([]);
  const savingIds = useRef(new Set<string>());
  const load = useCallback(async () => {
    try {
      const items = await loadProducts(userId),
        savedIds: string[] = [];
      for (let from = 0; ; from += 500) {
        const result = await supabase
          .from("saved_items")
          .select("product_id")
          .eq("user_id", userId)
          .order("product_id")
          .range(from, from + 499);
        if (result.error) throw result.error;
        savedIds.push(...result.data.map((item) => item.product_id));
        if (result.data.length < 500) break;
      }
      setProducts(items);
      setSaved(savedIds);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useDataRefresh(load);
  async function toggle(id: string) {
    if (savingIds.current.has(id)) return;
    savingIds.current.add(id);
    setSaving([...savingIds.current]);
    setActionError("");
    try {
      const wasSaved = saved.includes(id);
      const result = wasSaved
        ? await supabase
            .from("saved_items")
            .delete()
            .eq("user_id", userId)
            .eq("product_id", id)
        : await supabase
            .from("saved_items")
            .insert({ user_id: userId, product_id: id });
      if (result.error) throw result.error;
      setSaved((current) =>
        wasSaved ? current.filter((item) => item !== id) : [...current, id],
      );
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      savingIds.current.delete(id);
      setSaving([...savingIds.current]);
    }
  }
  const visible = products
    .filter(
      (p) =>
        (category === "All items" ||
          (category === "Saved items"
            ? saved.includes(p.id)
            : p.category === category)) &&
        `${p.title} ${p.description} ${p.category || ""} ${p.location || ""} ${p.campus || ""} ${p.seller?.full_name || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : 0,
    );
  const tabs = [
    ...new Set([
      "All items",
      ...categories,
      ...products.map((p) => p.category).filter((c): c is string => Boolean(c)),
    ]),
  ];
  return (
    <>
      <PageHeader
        title="Marketplace"
        description="Good finds. Fair prices. Right here on campus."
        action={
          <button
            className="btn"
            onClick={() =>
              setCategory(
                category === "Saved items" ? "All items" : "Saved items",
              )
            }
            aria-pressed={category === "Saved items"}
          >
            <Icon name="heart" />
            Saved items
          </button>
        }
      />
      <section className="market-banner">
        <div>
          <div className="eyebrow">The campus circular</div>
          <h2>New semester. Smart finds.</h2>
          <p>Give pre-loved essentials a new chapter.</p>
        </div>
        <div className="banner-side">
          <span className="banner-stamp">
            Pass it<strong>ON.</strong>Keep it going
          </span>
          <button className="btn lime" onClick={sell}>
            List your first item <Icon name="arrow" />
          </button>
        </div>
      </section>
      <button className="btn primary mobile-sell" onClick={sell}>
        <Icon name="plus" />
        Sell an item
      </button>
      <nav className="category-row" aria-label="Product categories">
        {tabs.map((c, index) => (
          <button
            key={c}
            className={`category ${category === c ? "active" : ""}`}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            <Icon
              name={
                ["grid", "laptop", "book", "shirt", "lamp"][index] || "grid"
              }
            />
            {c}
          </button>
        ))}
      </nav>
      <Feedback error={actionError} />
      {loading || error ? (
        <LoadState loading={loading} error={error} retry={load} />
      ) : (
        <>
          <div className="filter-line">
            <h2>
              {search
                ? `Results for “${search}”`
                : category === "All items"
                  ? "Fresh on campus"
                  : category}
              <small>{visible.length} items</small>
            </h2>
            <label className="small muted">
              Sort:{" "}
              <select
                aria-label="Sort listings"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="recent">Newest first</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
              </select>
            </label>
          </div>
          <div className="products">
            {visible.length ? (
              visible.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  saved={saved.includes(p.id)}
                  saving={saving.includes(p.id)}
                  onSave={() => toggle(p.id)}
                />
              ))
            ) : (
              <div className="empty">
                <Icon name="search" />
                <h3>
                  {category === "Saved items"
                    ? "Your saved finds will appear here."
                    : "No items found."}
                </h3>
                <p>
                  {search
                    ? "Try another keyword or category."
                    : "Check back for new listings from your campus."}
                </p>
                <button
                  className="btn"
                  onClick={() => setCategory("All items")}
                >
                  Browse all categories
                </button>
              </div>
            )}
          </div>
        </>
      )}
      <p className="trust-line">
        <Icon name="shield" />
        Pay through escrow. Inspect your item before confirming receipt.
      </p>
    </>
  );
}
export default function Marketplace() {
  return (
    <SiteShell>
      <Suspense fallback={<LoadState loading />}>
        <MarketplaceContent />
      </Suspense>
    </SiteShell>
  );
}

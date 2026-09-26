"use client";
import { useDataRefresh } from "@/lib/use-data-refresh";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage, productSelect, type Product } from "@/lib/marketplace";
import ProductCard from "./components/ProductCard";
import {
  PublicFooter,
  PublicHeader,
  TradingSteps,
} from "./components/PublicLayout";
import { Icon, LoadState } from "./components/UI";
export default function Home() {
  const [products, setProducts] = useState<Product[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      let query = supabase
        .from("products")
        .select(productSelect)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(3);
      if (session) query = query.neq("seller_id", session.user.id);
      const result = await query;
      if (result.error) throw result.error;
      setProducts(result.data as unknown as Product[]);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useDataRefresh(load, false);
  return (
    <>
      <PublicHeader />
      <main className="public-page" id="main">
        <section className="hero">
          <div>
            <p className="eyebrow hero-eyebrow">
              Less spending. More student life.
            </p>
            <h1>
              Your campus.
              <br />
              Your next
              <br />
              <span>great find.</span>
            </h1>
            <p>
              From lecture-ready laptops to room essentials. Buy what you need
              and sell what you don’t, with students around you.
            </p>
            <div className="row wrap">
              <Link className="btn primary" href="/marketplace">
                Explore the marketplace <Icon name="arrow" />
              </Link>
              <Link className="btn" href="/dashboard">
                Sell an item
              </Link>
            </div>
            <p className="hero-trust">
              <Icon name="shield" />
              Clear prices. Seller reviews. Payment through escrow.
            </p>
          </div>
          <div className="hero-picture">
            <Image
              src="/images/campus-backpack.jpg"
              alt="A navy backpack, an illustration of everyday campus essentials"
              width={700}
              height={700}
              priority
            />
            <span className="hero-tag">
              Good things deserve a second semester.
            </span>
          </div>
        </section>
        <div className="panel-head">
          <h2>A better way to pass it on.</h2>
          <Link className="text-link" href="/about">
            How it works <Icon name="arrow" />
          </Link>
        </div>
        <TradingSteps />
        <section className="featured-listings">
          <div className="panel-head">
            <h2>A few campus finds</h2>
            <Link className="text-link" href="/marketplace">
              See all items <Icon name="arrow" />
            </Link>
          </div>
          {loading || error ? (
            <LoadState loading={loading} error={error} retry={load} />
          ) : (
            <div className="products">
              {products.length ? (
                products.map((p) => <ProductCard key={p.id} product={p} />)
              ) : (
                <div className="empty">
                  <h3>New finds are on their way.</h3>
                  <p>Be the first to give a useful item a new home.</p>
                  <Link className="btn primary" href="/dashboard">
                    List an item
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

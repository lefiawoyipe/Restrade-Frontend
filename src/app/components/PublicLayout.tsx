"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Brand } from "./SiteShell";

export function PublicHeader() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setSignedIn(Boolean(session)),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="public-header">
        <Brand />
        <nav aria-label="Public navigation">
          <Link href="/marketplace">Marketplace</Link>
          <Link className="about-nav" href="/about">
            About
          </Link>
          <Link
            className="btn primary"
            href={signedIn ? "/dashboard" : "/login"}
          >
            {signedIn ? "My workspace" : "Log in"}
          </Link>
        </nav>
      </header>
    </>
  );
}
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <Brand />
      <span>Good things deserve a second semester.</span>
      <Link href="/about">How ResTrade works</Link>
    </footer>
  );
}
export function TradingSteps() {
  return (
    <div className="feature-grid">
      {[
        [
          "1",
          "Find your next good thing.",
          "Explore listings, compare prices, and check the seller’s reviews before you commit.",
        ],
        [
          "2",
          "Keep payment in escrow.",
          "Your payment is held while you arrange collection and inspect the item.",
        ],
        [
          "3",
          "Check it. Confirm it. Enjoy it.",
          "Confirm receipt to release payment, or report a problem for review.",
        ],
      ].map(([number, title, description]) => (
        <article className="feature" key={number}>
          <span className="number">{number}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </article>
      ))}
    </div>
  );
}

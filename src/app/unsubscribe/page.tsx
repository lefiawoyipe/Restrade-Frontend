"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
export default function Unsubscribe() {
  const token = useRef("");
  const lock = useRef(false);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    token.current =
      new URLSearchParams(window.location.search).get("token") ?? token.current;
    setReady(/^[a-fA-F0-9]{64}$/.test(token.current));
    window.history.replaceState(null, "", "/unsubscribe");
  }, []);
  async function confirm() {
    if (lock.current || !ready) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const client = createClient<Database>(
        process.env
          .NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "")
          .replace(/\/rest\/v1$/, ""),
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        },
      );
      const { error } = await client.rpc("unsubscribe_recommendations", {
        p_token: token.current,
      });
      if (error) throw error;
      token.current = "";
      setDone(true);
    } catch {
      setError("We could not process your request. Please try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="page">
      <section className="panel settings-panel">
        <h1>Unsubscribe from saved-category emails</h1>
        {done ? (
          <p role="status">
            Your request has been processed. If this link matched a
            subscription, those emails are now turned off.
          </p>
        ) : (
          <>
            <p>Confirm below to stop saved-category recommendation emails.</p>
            {!ready && (
              <p>Open the complete unsubscribe link from your email.</p>
            )}
            <button
              className="btn primary"
              disabled={!ready || busy}
              onClick={confirm}
            >
              {busy ? "Processing…" : "Confirm unsubscribe"}
            </button>
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </section>
    </main>
  );
}

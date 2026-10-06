"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/marketplace";
import { PublicHeader } from "./PublicLayout";
import { Feedback, Icon } from "./UI";
export default function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter(),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget),
      email = String(data.get("email")).trim(),
      password = String(data.get("password"));
    try {
      if (register) {
        const full_name = String(data.get("name")).trim();
        if (!full_name) throw new Error("Enter your full name.");
        const result = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name } },
        });
        if (result.error) throw result.error;
        if (result.data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else
          setMessage(
            "Account created. Check your email for a verification link, then log in.",
          );
      } else {
        const result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (result.error) throw result.error;
        const requested = new URLSearchParams(window.location.search).get(
          "redirectedFrom",
        );
        const target =
          requested &&
          /^\/(dashboard|marketplace|orders|profile|settings|admin)(\/[^\\]*)?$/.test(
            requested,
          )
            ? requested
            : "/dashboard";
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin,is_suspended")
          .eq("id", result.data.user.id)
          .single();
        if (profileError) throw profileError;
        router.replace(
          profile.is_admin
            ? profile.is_suspended
              ? "/settings"
              : "/admin"
            : target,
        );
        router.refresh();
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PublicHeader />
      <main id="main" className="auth-layout">
        <section className="auth-art">
          <h2>
            A little less spending.
            <br />
            <span>A lot more possibility.</span>
          </h2>
          <p>Your next study essential could be just across campus.</p>
          <div className="auth-trust">
            <Icon name="shield" />
            Buy and sell with a clearer handoff.
          </div>
        </section>
        <section className="auth-form">
          <h1>
            {register ? "Make yourself at home." : "Good to have you back."}
          </h1>
          <p>
            {register
              ? "Create your ResTrade account."
              : "Log in to pick up where you left off."}
          </p>
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="stack">
              {register && (
                <label className="field">
                  Full name
                  <input
                    name="name"
                    required
                    autoComplete="name"
                    maxLength={70}
                    placeholder="Your full name"
                  />
                </label>
              )}
              <label className="field">
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                />
              </label>
              <label className="field">
                Password
                <input
                  type="password"
                  name="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength={register ? 8 : undefined}
                  required
                  aria-describedby={register ? "password-help" : undefined}
                />
                {register && (
                  <small id="password-help">At least 8 characters.</small>
                )}
              </label>
            </fieldset>
            <Feedback error={error} message={message} />
            <button className="btn primary" disabled={busy}>
              {busy ? "Please wait…" : register ? "Create account" : "Log in"}
              <Icon name="arrow" />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to ResTrade?"}{" "}
            <Link
              className="text-link"
              href={register ? "/login" : "/register"}
            >
              {register ? "Log in" : "Join the campus community"}
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}

"use client";
import { useCallback, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/marketplace";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { Feedback } from "./UI";
import { useWorkspace } from "./SiteShell";

export default function AdminMfa() {
  const { profile } = useWorkspace();
  const [factors, setFactors] = useState<{ id: string; label: string }[]>([]),
    [enrollment, setEnrollment] = useState<{
      id: string;
      qr: string;
      secret: string;
    } | null>(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  const load = useCallback(async () => {
    if (!profile.is_admin) return;
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setError(error.message);
      return false;
    }
    setFactors(
      data.totp.map((f) => ({
        id: f.id,
        label: f.friendly_name ?? "Authenticator",
      })),
    );
    return true;
  }, [profile.is_admin]);
  useDataRefresh(load, []);
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!profile.is_admin) return null;
  return (
    <section className="panel settings-panel">
      <h2>Administrator authenticator</h2>
      <p>
        A fresh authenticator code is required for every financial decision.
      </p>
      <ul>
        {factors.map((f) => (
          <li key={f.id}>{f.label} — verified</li>
        ))}
      </ul>
      {!enrollment ? (
        <button
          className="btn"
          disabled={busy}
          onClick={() =>
            act(async () => {
              const result = await supabase.auth.mfa.enroll({
                factorType: "totp",
                friendlyName: `ResTrade ${new Date().toISOString()}`,
              });
              if (result.error) throw result.error;
              setEnrollment({
                id: result.data.id,
                qr: await QRCode.toDataURL(result.data.totp.uri),
                secret: result.data.totp.secret,
              });
            })
          }
        >
          Set up authenticator
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              const result = await supabase.auth.mfa.challengeAndVerify({
                factorId: enrollment.id,
                code,
              });
              if (result.error) throw result.error;
              setEnrollment(null);
              setCode("");
              await load();
              setMessage("Authenticator verified.");
            });
          }}
        >
          {/* Local QR data only; no remote assets or analytics. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrollment.qr}
            width={220}
            height={220}
            alt="Scan with your authenticator app"
          />
          <p>
            Manual setup key:{" "}
            <code style={{ overflowWrap: "anywhere" }}>
              {enrollment.secret}
            </code>
          </p>
          <label className="field">
            Authenticator code
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={busy}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            Verify authenticator
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() =>
              act(async () => {
                const result = await supabase.auth.mfa.unenroll({
                  factorId: enrollment.id,
                });
                if (result.error) throw result.error;
                setEnrollment(null);
                setCode("");
              })
            }
          >
            Cancel setup
          </button>
        </form>
      )}
      <details>
        <summary>Lost access to your authenticator?</summary>
        <p>
          Use another registered authenticator if available. Otherwise contact
          the project owner for identity-verified account recovery. Financial
          decisions remain unavailable until an authenticator is restored; this
          application has no bypass.
        </p>
      </details>
      <Feedback error={error} message={message} />
    </section>
  );
}

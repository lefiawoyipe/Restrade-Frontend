"use client";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage, notifyDataChanged } from "@/lib/marketplace";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { useWorkspace } from "./SiteShell";
import { Feedback } from "./UI";
export default function RecommendationSettings() {
  const { userId, profile } = useWorkspace();
  const [enabled, setEnabled] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("recommendation_preferences")
      .select("email_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) setError(error.message);
    else if (!lock.current) {
      setEnabled(data?.email_enabled ?? false);
      setError("");
    }
    setLoading(false);
    return !error;
  }, [userId]);
  useDataRefresh(load, ["personal"]);
  async function change(value: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await supabase.rpc("set_recommendation_email", {
        p_enabled: value,
      });
      if (result.error) throw result.error;
      setEnabled(value);
      setMessage("Email preference saved. Delivery is pending setup.");
      notifyDataChanged(["personal"]);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel" id="recommendations">
      <h2>Saved-category emails</h2>
      <label className="toggle-row">
        <span>
          <strong>
            Email me when new items are listed in categories I’ve saved.
          </strong>
          <small>
            Saving an item establishes category interest; saving alone does not
            subscribe you to email. Emails match categories, not personalized
            predictions. Delivery is pending setup.
          </small>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={
            loading ||
            busy ||
            (!enabled && (profile.is_admin || profile.is_suspended))
          }
          onChange={(event) => void change(event.target.checked)}
        />
      </label>
      {(profile.is_admin || profile.is_suspended) && (
        <p className="small muted">
          Only active student accounts can enable these emails. You can always
          turn them off.
        </p>
      )}
      <Feedback error={error} message={message} />
      {error && (
        <button className="btn" disabled={busy} onClick={load}>
          Retry preference read
        </button>
      )}
    </section>
  );
}

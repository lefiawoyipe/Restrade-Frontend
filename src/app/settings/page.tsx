"use client";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { dateLabel, errorMessage, statusLabels } from "@/lib/marketplace";
import SiteShell, { useWorkspace } from "../components/SiteShell";
import { Feedback, LoadState, PageHeader } from "../components/UI";
import AdminMfa from "../components/AdminMfa";
import RecommendationSettings from "../components/RecommendationSettings";
import Link from "next/link";

function SettingsContent() {
  const { userId } = useWorkspace();
  const [orderAlerts, setOrderAlerts] = useState(true),
    [marketAlerts, setMarketAlerts] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [actionError, setActionError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [notifications, setNotifications] = useState<
      {
        id: string;
        status: string;
        created_at: string;
        read_at: string | null;
        message: string | null;
        event_type: string;
        order_id: string;
      }[]
    >([]);
  const lock = useRef(false);
  const dirty = useRef(false);
  const load = useCallback(async () => {
    try {
      const [prefs, updates] = await Promise.all([
        supabase
          .from("notification_preferences")
          .select("order_alerts,marketplace_updates")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("notifications")
          .select("id,status,created_at,read_at,message,event_type,order_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (prefs.error) throw prefs.error;
      if (updates.error) throw updates.error;
      if (!dirty.current) {
        setOrderAlerts(prefs.data?.order_alerts ?? true);
        setMarketAlerts(prefs.data?.marketplace_updates ?? false);
      }
      setNotifications(updates.data);
      setError("");
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useDataRefresh(load, ["personal"]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError("");
    setMessage("");
    try {
      const result = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: userId,
          order_alerts: orderAlerts,
          marketplace_updates: marketAlerts,
          updated_at: new Date().toISOString(),
        })
        .select("user_id")
        .single();
      if (result.error) throw result.error;
      dirty.current = false;
      setMessage("Preferences saved.");
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Settings"
        description="Choose which updates you want to receive."
      />
      <section id="admin-authenticator">
        <AdminMfa />
      </section>
      <RecommendationSettings />
      <Feedback error={error} />
      {error && (
        <button className="btn" onClick={load}>
          Retry settings read
        </button>
      )}
      {loading ? (
        <LoadState loading={loading} error={error} retry={load} />
      ) : (
        <>
          <form className="panel settings-panel" onSubmit={save}>
            <h2>Notifications</h2>
            <label className="toggle-row">
              <span>
                <strong>Order updates</strong>
                <small>
                  Get in-app updates when your order or escrow status changes.
                </small>
              </span>
              <input
                type="checkbox"
                checked={orderAlerts}
                disabled={busy}
                onChange={(e) => {
                  dirty.current = true;
                  setOrderAlerts(e.target.checked);
                  setMessage("");
                }}
              />
            </label>
            <label className="toggle-row">
              <span>
                <strong>Marketplace updates</strong>
                <small>
                  Save your preference for updates about new campus finds.
                </small>
              </span>
              <input
                type="checkbox"
                checked={marketAlerts}
                disabled={busy}
                onChange={(e) => {
                  dirty.current = true;
                  setMarketAlerts(e.target.checked);
                  setMessage("");
                }}
              />
            </label>
            <Feedback error={actionError} message={message} />
            <div className="form-actions">
              <button className="btn primary" disabled={busy}>
                {busy ? "Saving…" : "Save preferences"}
              </button>
            </div>
          </form>
          <div className="note settings-note">
            Your email address and wallet balance belong in your private
            account, not your public seller profile.
          </div>
          <section className="panel settings-panel updates-panel">
            <h2>Recent order updates</h2>
            {notifications.length ? (
              notifications.map((n) => (
                <div className="order-row" key={n.id}>
                  <Link href={`/orders/${n.order_id}`}>
                    <strong>
                      {n.message ||
                        statusLabels[n.status] ||
                        n.event_type ||
                        n.status}
                    </strong>
                    <p className="small muted">{dateLabel(n.created_at)}</p>
                  </Link>
                  {!n.read_at && (
                    <button
                      type="button"
                      className="text-link"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        const readAt = new Date().toISOString();
                        const result = await supabase
                          .from("notifications")
                          .update({ read_at: readAt })
                          .eq("id", n.id)
                          .eq("user_id", userId)
                          .select("id")
                          .single();
                        if (result.error) setActionError(result.error.message);
                        else
                          setNotifications((items) =>
                            items.map((item) =>
                              item.id === n.id
                                ? { ...item, read_at: readAt }
                                : item,
                            ),
                          );
                        setBusy(false);
                      }}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="small muted">No order updates yet.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
export default function SettingsPage() {
  return (
    <SiteShell>
      <SettingsContent />
    </SiteShell>
  );
}

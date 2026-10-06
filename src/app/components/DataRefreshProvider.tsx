"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  VersionTracker,
  type RefreshScope,
  type VersionRow,
} from "@/lib/version-tracker";
type Listener = {
  scopes: readonly RefreshScope[];
  refresh: () => void;
  retry: () => void;
};
const RefreshContext = createContext<Set<Listener> | null>(null);
export const useRefreshListeners = () => useContext(RefreshContext);
export default function DataRefreshProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/unsubscribe") return children;
  return <AuthenticatedRefresh>{children}</AuthenticatedRefresh>;
}
function AuthenticatedRefresh({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<string | null | undefined>(
    undefined,
  );
  const [reconnecting, setReconnecting] = useState(false);
  const { listeners } = useMemo(
    () => ({ identity, listeners: new Set<Listener>() }),
    [identity],
  );
  useEffect(() => {
    let active = true,
      authEvent = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authEvent = true;
      if (active) setIdentity(session?.user.id ?? null);
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (active && !authEvent) setIdentity(data.user?.id ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!identity) return;
    let active = true,
      reading = false,
      readAgain = false,
      subscribed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<RefreshScope>();
    const dispatch = (scopes: Set<RefreshScope>) => {
      for (const listener of listeners)
        if (listener.scopes.some((scope) => scopes.has(scope)))
          listener.refresh();
    };
    const tracker = new VersionTracker((topic) => {
      const scope =
        topic === "marketplace"
          ? "marketplace"
          : topic === "admin"
            ? "admin"
            : topic === `user:${identity}`
              ? "personal"
              : null;
      if (!scope || !active) return;
      pending.add(scope);
      if (timer === undefined)
        timer = setTimeout(() => {
          timer = undefined;
          const scopes = new Set(pending);
          pending.clear();
          dispatch(scopes);
        }, 7000);
    });
    const reconcile = async () => {
      if (reading) {
        readAgain = true;
        return;
      }
      reading = true;
      const { data, error } = await supabase
        .from("data_versions")
        .select("topic,version");
      reading = false;
      if (!active) return;
      setReconnecting(Boolean(error));
      if (!error) {
        tracker.reconcile(data ?? []);
        for (const listener of listeners) listener.retry();
      }
      if (readAgain) {
        readAgain = false;
        void reconcile();
      }
    };
    const onVersion = (payload: { new: unknown }) => {
      if (active) tracker.event(payload.new as VersionRow);
    };
    const channel = supabase
      .channel(`restrade-versions:${identity}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "data_versions" },
        onVersion,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "data_versions" },
        onVersion,
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          subscribed = true;
          void reconcile();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        )
          setReconnecting(true);
      });
    const visible = () => {
      if (subscribed && document.visibilityState === "visible")
        void reconcile();
    };
    const local = (event: Event) => {
      const scopes = (event as CustomEvent<RefreshScope[]>).detail ?? [
        "marketplace",
        "personal",
        "admin",
      ];
      dispatch(new Set(scopes));
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("restrade:data", local);
    return () => {
      active = false;
      clearTimeout(timer);
      pending.clear();
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("restrade:data", local);
      void supabase.removeChannel(channel);
    };
  }, [identity, listeners]);
  if (identity === undefined) return <p role="status">Loading your session…</p>;
  return (
    <RefreshContext.Provider key={identity ?? "guest"} value={listeners}>
      {identity && reconnecting && (
        <p
          role="status"
          className="note"
          style={{
            position: "fixed",
            bottom: 12,
            right: 12,
            zIndex: 50,
            maxWidth: 340,
          }}
        >
          Live updates are reconnecting. Changes may take longer to appear.
        </p>
      )}
      {children}
    </RefreshContext.Provider>
  );
}

"use client";
import { useEffect } from "react";
import { useRefreshListeners } from "@/app/components/DataRefreshProvider";
import type { RefreshScope } from "./version-tracker";
const all: readonly RefreshScope[] = ["marketplace", "personal", "admin"];

/** Schedule the initial external read, cancel it on unmount, and refresh after mutations. */
export function useDataRefresh(
  load: () => Promise<void | boolean>,
  scopes: readonly RefreshScope[] = all,
) {
  const listeners = useRefreshListeners();
  const scopeKey = scopes.join(",");
  useEffect(() => {
    let active = true,
      running = false,
      pending = false,
      failed = false;
    let requested = 0,
      satisfied = 0;
    const refresh = async () => {
      if (!active) return;
      if (running) {
        pending = true;
        return;
      }
      running = true;
      const revision = requested;
      const scroll = window.scrollY;
      const anchor = Array.from(
        document.querySelectorAll<HTMLElement>("[data-product-id]"),
      ).find((node) => {
        const top = node.getBoundingClientRect().top;
        return top >= 0 && top < window.innerHeight;
      });
      const top = anchor?.getBoundingClientRect().top;
      try {
        failed = (await load()) === false;
        if (!failed) satisfied = revision;
      } catch {
        failed = true;
      } finally {
        running = false;
        if (active && anchor && top !== undefined)
          requestAnimationFrame(() => {
            if (active && anchor.isConnected && window.scrollY === scroll)
              window.scrollBy(0, anchor.getBoundingClientRect().top - top);
          });
        if (active && pending) {
          pending = false;
          void refresh();
        }
      }
    };
    const listener = {
      scopes: scopeKey ? (scopeKey.split(",") as RefreshScope[]) : [],
      refresh: () => {
        requested++;
        void refresh();
      },
      retry: () => {
        if (!running && (failed || satisfied < requested)) void refresh();
      },
    };
    listeners?.add(listener);
    const timer = setTimeout(listener.refresh, 0);
    return () => {
      active = false;
      clearTimeout(timer);
      listeners?.delete(listener);
    };
  }, [load, listeners, scopeKey]);
}

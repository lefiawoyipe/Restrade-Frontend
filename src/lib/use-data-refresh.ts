"use client";
import { useEffect } from "react";

/** Schedule the initial external read, cancel it on unmount, and refresh after mutations. */
export function useDataRefresh(load: () => Promise<void>, subscribe = true) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    const refresh = () => {
      void load();
    };
    if (subscribe) window.addEventListener("restrade:data", refresh);
    return () => {
      window.clearTimeout(timer);
      if (subscribe) window.removeEventListener("restrade:data", refresh);
    };
  }, [load, subscribe]);
}

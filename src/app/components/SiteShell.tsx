"use client";
import { useDataRefresh } from "@/lib/use-data-refresh";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { errorMessage, initials, type Profile } from "@/lib/marketplace";
import { Feedback, Icon, LoadState } from "./UI";
import AdminShell from "./AdminShell";
import ListingForm from "./ListingForm";

interface Workspace {
  userId: string;
  profile: Profile;
  sell: () => void;
}
const Context = createContext<Workspace | null>(null);
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace is not ready");
  return value;
}
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="ResTrade home">
      <span className="brand-mark">r</span>
      <span>
        ResTrade<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
const mainLinks = [
  ["/dashboard", "Overview", "grid"],
  ["/marketplace", "Marketplace", "shop"],
  ["/orders", "Orders", "box"],
];
const accountLinks = [
  ["/profile", "My profile", "user"],
  ["/settings", "Settings", "settings"],
];

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    router = useRouter();
  const [account, setAccount] = useState<{
    userId: string;
    profile: Profile;
  } | null>(null);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [listing, setListing] = useState(false),
    [drawer, setDrawer] = useState(false),
    [query, setQuery] = useState(""),
    [message, setMessage] = useState(""),
    [logoutBusy, setLogoutBusy] = useState(false);
  const sidebar = useRef<HTMLElement>(null),
    menu = useRef<HTMLButtonElement>(null);
  const load = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        router.replace(`/login?redirectedFrom=${encodeURIComponent(pathname)}`);
        return;
      }
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;
      if (
        pathname.startsWith("/admin") &&
        (!data.is_admin || data.is_suspended)
      ) {
        router.replace(data.is_admin ? "/settings" : "/dashboard");
        return;
      }
      if (
        data.is_admin &&
        ["/dashboard", "/marketplace", "/orders"].some(
          (route) => pathname === route || pathname.startsWith(`${route}/`),
        )
      ) {
        router.replace(data.is_suspended ? "/settings" : "/admin");
        return;
      }
      setAccount({ userId: user.id, profile: data });
      setError("");
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);
  useDataRefresh(load, ["personal"]);
  useEffect(() => {
    if (!drawer) return;
    const opener = menu.current;
    const element = sidebar.current,
      prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.querySelector<HTMLElement>("a,button")?.focus();
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawer(false);
      if (event.key !== "Tab") return;
      const nodes = Array.from(
          element?.querySelectorAll<HTMLElement>("a,button") || [],
        ).filter((e) => e.getClientRects().length > 0),
        first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    const media = window.matchMedia("(min-width: 681px)"),
      resize = () => {
        if (media.matches) setDrawer(false);
      };
    document.addEventListener("keydown", keys);
    media.addEventListener("change", resize);
    return () => {
      document.body.style.overflow = prior;
      document.removeEventListener("keydown", keys);
      media.removeEventListener("change", resize);
      opener?.focus();
    };
  }, [drawer]);
  async function logout() {
    setLogoutBusy(true);
    const { error: failure } = await supabase.auth.signOut();
    if (failure) {
      setError(failure.message);
      setLogoutBusy(false);
    } else {
      router.replace("/login");
      router.refresh();
    }
  }
  const nav = (items: string[][]) =>
    items.map(([href, label, icon]) => (
      <Link
        key={href}
        href={href}
        className={`nav-link ${pathname === href || pathname.startsWith(`${href}/`) ? "active" : ""}`}
        aria-current={
          pathname === href || pathname.startsWith(`${href}/`)
            ? "page"
            : undefined
        }
        onClick={() => setDrawer(false)}
      >
        <Icon name={icon} />
        {label}
      </Link>
    ));
  if (!account)
    return (
      <div className="startup">
        <Brand />
        <LoadState loading={loading} error={error} retry={load} />
      </div>
    );
  return (
    <Context.Provider
      value={{
        ...account,
        sell: () => {
          if (!account.profile.is_admin && !account.profile.is_suspended)
            setListing(true);
        },
      }}
    >
      <a className="skip" href="#main">
        Skip to content
      </a>
      {drawer && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawer(false)}
          aria-hidden="true"
        />
      )}
      <aside
        ref={sidebar}
        className={`sidebar ${drawer ? "open" : ""}`}
        aria-label="Navigation"
        role={drawer ? "dialog" : undefined}
        aria-modal={drawer || undefined}
      >
        <Brand />
        <button
          className="drawer-close btn"
          onClick={() => setDrawer(false)}
          aria-label="Close navigation"
        >
          <Icon name="close" />
        </button>
        <div className="nav-label">Your campus, connected</div>
        {account.profile.is_admin ? (
          <AdminShell close={() => setDrawer(false)} />
        ) : (
          <nav aria-label="Main navigation">{nav(mainLinks)}</nav>
        )}
        <div className="nav-label">Your account</div>
        <nav aria-label="Account navigation">{nav(accountLinks)}</nav>
        <div className="side-bottom">
          <div className="protect-card">
            <Icon name="shield" />
            <br />
            <strong>A little more peace of mind.</strong>
            <p>
              Learn when your payment is held and when it reaches the seller.
            </p>
            <Link className="text-link" href="/about">
              How escrow works <Icon name="arrow" />
            </Link>
          </div>
          <Link className="nav-link" href="/">
            <Icon name="back" />
            Back to home
          </Link>
          <button
            className="nav-link logout"
            disabled={logoutBusy}
            onClick={logout}
          >
            <Icon name="logout" />
            {logoutBusy ? "Logging out…" : "Log out"}
          </button>
          <Link
            className="user-card"
            href="/profile"
            onClick={() => setDrawer(false)}
          >
            <span className="avatar">
              {initials(account.profile.full_name || "")}
            </span>
            <span>
              <strong>{account.profile.full_name || "Your account"}</strong>
              <br />
              <small className="muted">
                {account.profile.is_admin ? "Administrator" : "Student account"}
              </small>
            </span>
          </Link>
        </div>
      </aside>
      <div className="main-wrap" inert={drawer || undefined}>
        <header className="topbar">
          <button
            ref={menu}
            className="mobile-menu"
            aria-label="Open navigation"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <Icon name="menu" />
          </button>
          {!account.profile.is_admin && (
            <form
              className="search"
              onSubmit={(event) => {
                event.preventDefault();
                router.push(
                  `/marketplace?q=${encodeURIComponent(query.trim())}`,
                );
              }}
            >
              <Icon name="search" />
              <input
                name="query"
                aria-label="Search marketplace"
                placeholder="Search for your next campus find…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                className="search-submit"
                type="submit"
                aria-label="Search"
              >
                <Icon name="arrow" />
              </button>
            </form>
          )}
          <div className="top-actions">
            {account.profile.campus && (
              <span className="campus">
                <Icon name="pin" />
                {account.profile.campus}
              </span>
            )}
            {!account.profile.is_admin && (
              <button
                className="btn primary"
                disabled={account.profile.is_suspended}
                onClick={() => setListing(true)}
              >
                <Icon name="plus" />
                Sell an item
              </button>
            )}
            <Link className="avatar" href="/profile" aria-label="Your profile">
              {initials(account.profile.full_name || "")}
            </Link>
          </div>
        </header>
        <main id="main" className="page" tabIndex={-1}>
          <Feedback error={error} message={message} />
          {account.profile.is_suspended && (
            <p className="note amber">
              Trading is suspended on this account. You can still access
              existing orders, settlement and disputes.
            </p>
          )}
          {children}
        </main>
      </div>
      {listing &&
        !account.profile.is_admin &&
        !account.profile.is_suspended && (
          <ListingForm
            userId={account.userId}
            campus={account.profile.campus}
            onSaved={() =>
              setMessage(
                "Listing published. Your item is now available on the marketplace.",
              )
            }
            onClose={() => setListing(false)}
          />
        )}
    </Context.Provider>
  );
}

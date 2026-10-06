"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { statusLabels } from "@/lib/marketplace";

const paths: Record<string, string> = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  shop: "M3 9h18l-2-5H5L3 9z M4 9v11h16V9 M9 20v-7h6v7",
  box: "m12 3 9 5v9l-9 5-9-5V8l9-5z M12 13v9 M3 8l9 5 9-5 M7 5.8l9 5V15",
  user: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2",
  settings:
    "M4 7h16 M4 17h16 M12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M19 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  shield: "m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3z M8 12l3 3 5-6",
  search: "M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0 M16 16l5 5",
  pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  plus: "M12 5v14 M5 12h14",
  arrow: "M4 12h16 m-6-6 6 6-6 6",
  back: "M20 12H4 m6-6-6 6 6 6",
  heart: "M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-5 5 8 15 8 15S25 10 20 5z",
  laptop: "M5 4h14v12H5z M5 16l-3 4h20l-3-4",
  book: "M12 5C9 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 1z M12 5v16",
  shirt: "m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 4-8 4-8 0z",
  lamp: "m8 3-4 9h16l-4-9H8z M12 12v9 M7 21h10",
  wallet: "M3 5h18v15H3z M3 8V5l14-3v3 M21 11h-6v5h6",
  check: "m5 12 4 4L19 6",
  logout: "M9 4H4v16h5 M14 7l5 5-5 5 M8 12h13",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "m6 6 12 12 M18 6 6 18",
  image: "M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5",
};
export function Icon({ name }: { name: string }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] || paths.box} />
    </svg>
  );
}
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function StatusBadge({ status: value }: { status: string | null }) {
  const status = value ?? "Unknown";
  return (
    <span
      className={`badge ${["completed", "available"].includes(status) ? "green" : ["disputed"].includes(status) ? "red" : ["pending", "refunded"].includes(status) ? "amber" : ""}`}
    >
      {statusLabels[status] || status}
    </span>
  );
}
export function Feedback({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return (
    <>
      {error && (
        <p role="alert" className="feedback error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="feedback success">
          {message}
        </p>
      )}
    </>
  );
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: string;
  retry?: () => void;
}) {
  return loading ? (
    <div className="loading-state" role="status">
      Loading your workspace…
    </div>
  ) : error ? (
    <div className="empty">
      <h2>We couldn’t load this information.</h2>
      <Feedback error={error} />
      {retry && (
        <button className="btn primary" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  ) : null;
}
export function ProductImage({
  src,
  title,
  className = "",
}: {
  src: string | null;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <Image
      className={className}
      src={src}
      alt={title}
      width={720}
      height={480}
      unoptimized
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className={`image-fallback ${className}`}
      role="img"
      aria-label={`No image available for ${title}`}
    >
      <Icon name="image" />
      <span>No image available</span>
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <button
        type="button"
        className="close"
        aria-label="Close dialog"
        disabled={busy}
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      <h2 id={`${id}-title`}>{title}</h2>
      {description && <p id={`${id}-description`}>{description}</p>}
      {children}
    </dialog>
  );
}

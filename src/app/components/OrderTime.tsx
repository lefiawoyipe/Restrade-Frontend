"use client";
import { useEffect, useState } from "react";
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function OrderTime({ value }: { value: string | null }) {
  if (!value || !Number.isFinite(Date.parse(value)))
    return <span>Not recorded</span>;
  const date = new Date(value);
  return (
    <time dateTime={value} title={date.toISOString()} suppressHydrationWarning>
      {new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "long",
      }).format(date)}
    </time>
  );
}
export function Deadline({
  value,
  label,
}: {
  value: string | null;
  label: string;
}) {
  const now = useNow();
  if (!value) return null;
  const minutes = Math.ceil((Date.parse(value) - now) / 60000);
  return (
    <p className="note">
      <strong>{label}</strong>
      <br />
      <OrderTime value={value} />
      <br />
      <span suppressHydrationWarning>
        {minutes <= 0
          ? "Deadline reached — processing"
          : `${Math.floor(minutes / 60)}h ${minutes % 60}m remaining`}
      </span>
      <br />
      <small>
        Server deadlines are authoritative. Scheduled processing runs
        approximately once per minute.
      </small>
    </p>
  );
}

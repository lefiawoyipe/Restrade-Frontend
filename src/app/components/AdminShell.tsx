"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./UI";
export const adminSections = [
  "overview",
  "inventory",
  "users",
  "orders",
  "disputes",
  "audit",
] as const;
export default function AdminShell({ close }: { close: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration">
      {adminSections.map((section) => {
        const href = section === "overview" ? "/admin" : `/admin/${section}`;
        return (
          <Link
            key={section}
            href={href}
            onClick={close}
            className={`nav-link ${pathname === href ? "active" : ""}`}
            aria-current={pathname === href ? "page" : undefined}
          >
            <Icon name={section === "disputes" ? "shield" : "grid"} />
            {section === "orders"
              ? "Orders / escrow"
              : section === "audit"
                ? "Audit history"
                : section[0].toUpperCase() + section.slice(1)}
          </Link>
        );
      })}
    </nav>
  );
}

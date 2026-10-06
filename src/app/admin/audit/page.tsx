"use client";
import SiteShell from "@/app/components/SiteShell";
import AdminConsole from "@/app/components/AdminConsole";
export default function Page() {
  return (
    <SiteShell>
      <AdminConsole section="audit" />
    </SiteShell>
  );
}

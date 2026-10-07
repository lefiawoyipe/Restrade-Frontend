"use client";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";
import { errorMessage, notifyDataChanged } from "@/lib/marketplace";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { record } from "@/lib/pickup";
import { useWorkspace } from "./SiteShell";
import { Feedback } from "./UI";
import { OrderTime } from "./OrderTime";
type Evidence = Tables<"case_evidence"> & {
  case_evidence_hashes: Tables<"case_evidence_hashes"> | null;
  uploader: { full_name: string | null } | null;
};
export default function CaseEvidence({
  orderId,
  resolved,
}: {
  orderId: string;
  resolved: boolean;
}) {
  const { userId, profile } = useWorkspace();
  const [rows, setRows] = useState<Evidence[]>([]),
    [legacy, setLegacy] = useState<string[]>([]),
    [retryPath, setRetryPath] = useState(""),
    [links, setLinks] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  const load = useCallback(async () => {
    try {
      const collected: Evidence[] = [];
      for (let from = 0; ; from += 100) {
        const result = await supabase
          .from("case_evidence")
          .select(
            "*,case_evidence_hashes(*),uploader:profiles!case_evidence_uploader_id_fkey(full_name)",
          )
          .eq("order_id", orderId)
          .order("registered_at")
          .order("id")
          .range(from, from + 99);
        if (result.error) throw result.error;
        collected.push(...result.data);
        if (result.data.length < 100) break;
      }
      const paths: string[] = [];
      for (let offset = 0; ; offset += 100) {
        const folders = await supabase.storage
          .from("dispute-evidence")
          .list(orderId, { limit: 100, offset });
        if (folders.error) throw folders.error;
        for (const folder of folders.data) {
          for (let offset = 0; ; offset += 100) {
            const files = await supabase.storage
              .from("dispute-evidence")
              .list(`${orderId}/${folder.name}`, { limit: 100, offset });
            if (files.error) throw files.error;
            paths.push(
              ...files.data
                .filter((f) => f.id)
                .map((f) => `${orderId}/${folder.name}/${f.name}`),
            );
            if (files.data.length < 100) break;
          }
        }
        if (folders.data.length < 100) break;
      }
      setRows(collected);
      setLegacy(
        paths.filter(
          (path) => !collected.some((row) => row.object_path === path),
        ),
      );
      setError("");
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    }
  }, [orderId]);
  useDataRefresh(load, ["personal", "admin"]);
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function verify(path: string) {
    setRetryPath(path);
    const result = await supabase.functions.invoke("verify-case-evidence", {
      body: { order_id: orderId, object_path: path },
    });
    if (result.error)
      throw new Error(
        "File uploaded, but server verification failed. Retry verification without uploading again.",
      );
    const body = record(result.data);
    if (
      body.verified !== true ||
      typeof body.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/i.test(body.sha256)
    )
      throw new Error("Server verification is incomplete. Retry verification.");
    setRetryPath("");
    setMessage("Evidence verified by the server.");
    notifyDataChanged(["personal", "admin"]);
  }
  const download = (path: string) => (
    <div>
      <button
        className="text-link"
        disabled={busy}
        onClick={() =>
          act(async () => {
            const result = await supabase.storage
              .from("dispute-evidence")
              .createSignedUrl(path, 300);
            if (result.error) throw result.error;
            setLinks((current) => ({
              ...current,
              [path]: result.data.signedUrl,
            }));
          })
        }
      >
        {links[path] ? "Refresh download link" : "Get secure download link"}
      </button>
      {links[path] && (
        <p>
          <a
            className="text-link"
            href={links[path]}
            target="_blank"
            rel="noreferrer"
            download
          >
            Download attachment (link valid for five minutes)
          </a>
        </p>
      )}
    </div>
  );
  return (
    <section className="stack">
      <h3>Case evidence</h3>
      <p className="small muted">
        Server hashing records the bytes received, not when a photo was taken or
        whether its contents are true. File checks are not malware scanning.
      </p>
      {rows.map((row) => (
        <article className="case-message" key={row.id}>
          <strong>{row.uploader?.full_name ?? row.uploader_id}</strong>
          <p>
            Storage receipt: <OrderTime value={row.storage_created_at} />
            <br />
            Registered: <OrderTime value={row.registered_at} />
          </p>
          <p>
            {row.case_evidence_hashes
              ? "Server verified (SHA-256)"
              : "Unverified attachment"}
          </p>
          {row.case_evidence_hashes && (
            <details>
              <summary>Integrity record</summary>
              <code style={{ overflowWrap: "anywhere" }}>
                {row.case_evidence_hashes.sha256}
              </code>
              <p>
                Verified:{" "}
                <OrderTime value={row.case_evidence_hashes.verified_at} />
              </p>
            </details>
          )}
          {download(row.object_path)}
          {!profile.is_admin &&
            !resolved &&
            row.uploader_id === userId &&
            !row.case_evidence_hashes && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => act(() => verify(row.object_path))}
              >
                Retry verification
              </button>
            )}
        </article>
      ))}
      {legacy.map((path) => (
        <article className="case-message" key={path}>
          <strong>Unverified / legacy attachment</strong>
          <p className="small">
            Uploader path: {path.split("/")[1]}. Server receipt and registration
            metadata have not been verified.
          </p>
          {download(path)}
          {!profile.is_admin && !resolved && path.split("/")[1] === userId && (
            <button
              className="btn"
              disabled={busy}
              onClick={() => act(() => verify(path))}
            >
              Retry verification
            </button>
          )}
        </article>
      ))}
      {!rows.length && !legacy.length && <p>No registered attachments.</p>}
      {!profile.is_admin && !resolved && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              file = new FormData(form).get("evidence");
            void act(async () => {
              if (
                !(file instanceof File) ||
                file.size < 1 ||
                file.size > 10485760 ||
                !["image/jpeg", "image/png", "application/pdf"].includes(
                  file.type,
                )
              )
                throw new Error("Choose a JPEG, PNG or PDF file up to 10 MB.");
              const extension =
                file.type === "application/pdf"
                  ? "pdf"
                  : file.type === "image/png"
                    ? "png"
                    : "jpg";
              const path = `${orderId}/${userId}/${crypto.randomUUID()}.${extension}`;
              const result = await supabase.storage
                .from("dispute-evidence")
                .upload(path, file, { upsert: false });
              if (result.error) throw result.error;
              form.reset();
              setRetryPath(path);
              await verify(path);
            });
          }}
        >
          <label className="field">
            Add evidence
            <input
              type="file"
              name="evidence"
              accept="image/jpeg,image/png,application/pdf"
              required
              disabled={busy || Boolean(retryPath)}
            />
          </label>
          <button className="btn" disabled={busy || Boolean(retryPath)}>
            Upload and verify evidence
          </button>
        </form>
      )}
      {retryPath && (
        <button
          className="btn"
          disabled={busy}
          onClick={() => act(() => verify(retryPath))}
        >
          Retry verification of uploaded file
        </button>
      )}
      <Feedback error={error} message={message} />
    </section>
  );
}

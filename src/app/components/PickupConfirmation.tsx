"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { IScannerControls } from "@zxing/browser";
import { supabase } from "@/lib/supabase";
import { errorMessage, notifyDataChanged, type Order } from "@/lib/marketplace";
import { pickupToken, record, text } from "@/lib/pickup";
import { useWorkspace } from "./SiteShell";
import { Deadline, OrderTime, useNow } from "./OrderTime";
import { Feedback } from "./UI";
export default function PickupConfirmation({ order }: { order: Order }) {
  const { profile } = useWorkspace();
  if (
    profile.is_admin ||
    order.workflow_version !== 2 ||
    order.status !== "escrow_funded" ||
    order.fulfillment_status !== "awaiting_pickup"
  )
    return null;
  return <PickupControls key={order.id} order={order} />;
}
function PickupControls({ order }: { order: Order }) {
  const { userId } = useWorkspace(),
    now = useNow(),
    lock = useRef(false);
  const [challenge, setChallenge] = useState<{
      token: string;
      expires: string;
      qr: string;
    } | null>(null),
    [nextGenerate, setNextGenerate] = useState(0),
    [raw, setRaw] = useState(""),
    [reviewed, setReviewed] = useState(""),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    scanner = useRef<IScannerControls | null>(null),
    generation = useRef(0);
  function stop() {
    generation.current++;
    scanner.current?.stop();
    scanner.current = null;
    const stream = video.current?.srcObject;
    if (stream instanceof MediaStream)
      stream.getTracks().forEach((track) => track.stop());
    setScanning(false);
  }
  useEffect(() => {
    const element = video.current;
    const currentGeneration = generation;
    return () => {
      currentGeneration.current++;
      scanner.current?.stop();
      const stream = element?.srcObject;
      if (stream instanceof MediaStream)
        stream.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    if (!challenge) return;
    const timer = setTimeout(
      () => setChallenge(null),
      Math.max(0, Date.parse(challenge.expires) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [challenge]);
  useEffect(() => {
    if (!order.pickup_due_at) return;
    const timer = setTimeout(
      () => {
        generation.current++;
        scanner.current?.stop();
        setScanning(false);
        setRaw("");
        setReviewed("");
        setChallenge(null);
      },
      Math.max(0, Date.parse(order.pickup_due_at) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [order.pickup_due_at]);
  async function act(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function start() {
    setError("");
    setScanning(true);
    const current = ++generation.current;
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (current !== generation.current || !video.current) return;
      const controls = await new BrowserQRCodeReader().decodeFromVideoDevice(
        undefined,
        video.current,
        (result, _error, control) => {
          if (!result || current !== generation.current) return;
          control.stop();
          setScanning(false);
          try {
            setRaw(pickupToken(result.getText(), order.id));
            setReviewed("");
            setAck(false);
            setMessage("Code scanned. Review and confirm receipt separately.");
          } catch (cause) {
            setError(errorMessage(cause));
          }
        },
      );
      if (current !== generation.current) controls.stop();
      else scanner.current = controls;
    } catch {
      if (current === generation.current) {
        setScanning(false);
        setError(
          "Camera unavailable. Allow camera access over HTTPS, or paste the pickup code instead.",
        );
      }
    }
  }
  const expired =
    !order.pickup_due_at || Date.parse(order.pickup_due_at) <= now;
  return (
    <section className="panel stack">
      <h2>Local pickup</h2>
      <Deadline label="Pickup deadline" value={order.pickup_due_at} />
      <p>
        Pickup confirmation starts inspection; it does not release test funds. A
        code exchange is not proof of physical location.
      </p>
      {userId === order.seller_id && (
        <>
          <button
            className="btn primary"
            disabled={busy || expired || now < nextGenerate}
            onClick={() =>
              act(async () => {
                setChallenge(null);
                const result = await supabase.rpc("create_pickup_challenge", {
                  p_order_id: order.id,
                });
                if (result.error) throw result.error;
                const value = record(result.data),
                  token = pickupToken(text(value.token), order.id),
                  expires = text(value.expires_at);
                if (
                  value.order_id !== order.id ||
                  !Number.isFinite(Date.parse(expires))
                )
                  throw new Error("Invalid pickup challenge response.");
                setNextGenerate(Date.now() + 30000);
                const qr = await QRCode.toDataURL(
                  JSON.stringify({
                    type: "restrade-pickup",
                    order_id: order.id,
                    token,
                  }),
                );
                setChallenge({ token, expires, qr });
              })
            }
          >
            {challenge
              ? "Replace pickup code"
              : "Ready for pickup / Show pickup code"}
          </button>
          <p className="small">
            Codes last at most ten minutes. Replacement invalidates the old code
            and is allowed once every 30 seconds.
          </p>
          {challenge && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={challenge.qr}
                alt="Order-bound pickup QR code"
                width={240}
                height={240}
              />
              <label className="field">
                Pickup code
                <input
                  readOnly
                  value={challenge.token}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <p>
                Expires <OrderTime value={challenge.expires} />
              </p>
              <button
                className="btn"
                onClick={() =>
                  act(async () => {
                    await navigator.clipboard.writeText(challenge.token);
                    setMessage("Pickup code copied.");
                  })
                }
              >
                Copy pickup code
              </button>
            </>
          )}
        </>
      )}
      {userId === order.buyer_id && (
        <>
          <video
            ref={video}
            hidden={!scanning}
            autoPlay
            muted
            playsInline
            aria-label="Pickup QR scanner camera"
            style={{ maxWidth: "100%" }}
          />
          <div className="form-actions">
            <button
              className="btn"
              disabled={scanning || busy || expired}
              onClick={start}
            >
              Start QR scanner
            </button>
            {scanning && (
              <button className="btn" onClick={stop}>
                Stop QR scanner
              </button>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                setReviewed(pickupToken(raw, order.id));
                setAck(false);
                setError("");
                stop();
              } catch (cause) {
                setError(errorMessage(cause));
              }
            }}
          >
            <label className="field">
              Paste pickup code or QR payload
              <textarea
                aria-label="Paste pickup code or QR payload"
                autoComplete="off"
                spellCheck={false}
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setReviewed("");
                  setAck(false);
                }}
                disabled={busy || expired}
              />
            </label>
            <button className="btn" disabled={busy || expired || !raw.trim()}>
              Review pickup confirmation
            </button>
          </form>
          {reviewed && (
            <div className="note">
              <label>
                <input
                  type="checkbox"
                  checked={ack}
                  disabled={busy || expired}
                  onChange={(e) => setAck(e.target.checked)}
                />{" "}
                I have received this item. Start my 48-hour inspection period.
              </label>
              <button
                className="btn primary"
                disabled={busy || expired || !ack}
                onClick={() =>
                  act(async () => {
                    const result = await supabase.rpc("confirm_pickup", {
                      p_order_id: order.id,
                      p_token: reviewed,
                    });
                    if (result.error) throw result.error;
                    setRaw("");
                    setReviewed("");
                    setAck(false);
                    setMessage(
                      "Pickup confirmed. Test funds remain held during inspection.",
                    );
                    notifyDataChanged(["personal", "admin"]);
                  })
                }
              >
                Confirm received item
              </button>
            </div>
          )}
        </>
      )}
      <Feedback error={error} message={message} />
    </section>
  );
}

"use client";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  loadCategories,
  requireTrader,
  conditions,
  errorMessage,
  notifyDataChanged,
  type Product,
} from "@/lib/marketplace";
import { useDataRefresh } from "@/lib/use-data-refresh";
import { Feedback, Modal } from "./UI";

export default function ListingForm({
  userId,
  campus,
  product,
  onClose,
  onSaved,
}: {
  userId: string;
  campus?: string | null;
  product?: Product;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState("");
  const lock = useRef(false);
  const [categories, setCategories] = useState<string[]>([]);
  const load = useCallback(async () => {
    try {
      setCategories(await loadCategories());
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);
  useDataRefresh(load, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget),
      price = Number(form.get("price")),
      title = String(form.get("title")).trim(),
      description = String(form.get("description")).trim(),
      photo = form.get("photo") as File;
    if (
      !title ||
      !description ||
      !Number.isFinite(price) ||
      price <= 0 ||
      Math.abs(price * 100 - Math.round(price * 100)) > 0.00001
    ) {
      setError(
        "Enter a title, description and a positive price with up to two decimal places.",
      );
      return;
    }
    if (
      photo?.size &&
      (!["image/jpeg", "image/png"].includes(photo.type) ||
        photo.size > 10485760)
    ) {
      setError("Choose a JPEG or PNG image smaller than 10 MB.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    let uploaded: string | undefined;
    try {
      await requireTrader();
      if (product && product.moderation_status !== "visible")
        throw new Error("Hidden listings cannot be edited until restored.");
      const category = String(form.get("category") ?? "").trim();
      if (
        (!product || category || product.category) &&
        !categories.includes(category)
      )
        throw new Error("Choose a valid product category.");
      let image_url = product?.image_url || null;
      if (photo?.size) {
        setProgress("Uploading your photo…");
        uploaded = `${userId}/${crypto.randomUUID()}.${photo.type === "image/png" ? "png" : "jpg"}`;
        const upload = await supabase.storage
          .from("product-images")
          .upload(uploaded, photo);
        if (upload.error) throw upload.error;
        image_url = supabase.storage
          .from("product-images")
          .getPublicUrl(uploaded).data.publicUrl;
      }
      setProgress("Saving your listing…");
      const fields = {
        title,
        description,
        price,
        image_url,
        ...(category ? { category } : {}),
        condition: String(form.get("condition")) || null,
        campus: String(form.get("campus")).trim() || null,
        location: String(form.get("location")).trim() || null,
      };
      const result = product
        ? await supabase
            .from("products")
            .update(fields)
            .eq("id", product.id)
            .eq("seller_id", userId)
            .eq("status", "available")
            .select("id")
            .single()
        : await supabase
            .from("products")
            .insert({ ...fields, seller_id: userId, status: "available" })
            .select("id")
            .single();
      if (result.error) throw result.error;
      notifyDataChanged();
      onSaved?.();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      if (uploaded)
        await supabase.storage.from("product-images").remove([uploaded]);
    } finally {
      lock.current = false;
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <Modal
      title={product ? "Edit your listing" : "Pass something good on."}
      description="Give your item a clear title, an honest description and a fair price."
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset
          disabled={
            busy || (product && product.moderation_status !== "visible")
          }
        >
          <div className="form-grid">
            <label className="field full">
              Item title
              <input
                name="title"
                maxLength={120}
                required
                defaultValue={product?.title}
                placeholder="e.g. Blue study desk lamp"
              />
            </label>
            <label className="field">
              Price (GH₵)
              <input
                name="price"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={product?.price}
              />
            </label>
            <label className="field">
              Category
              <select
                name="category"
                aria-label="Category"
                defaultValue={product?.category || ""}
                required={!product || product.category !== null}
              >
                <option value="">Choose a category</option>
                {[
                  ...new Set([
                    ...categories,
                    ...(product?.category ? [product.category] : []),
                  ]),
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {product && !product.category && (
                <small>
                  Select a category to help buyers find this item. You may keep
                  this legacy listing uncategorized.
                </small>
              )}
            </label>
            <label className="field full">
              Condition
              <select
                name="condition"
                defaultValue={product?.condition || ""}
                required
              >
                <option value="">Choose a condition</option>
                {Object.entries(conditions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Campus
              <input
                name="campus"
                maxLength={120}
                defaultValue={product?.campus || campus || ""}
                placeholder="Your campus"
              />
            </label>
            <label className="field">
              Collection area
              <input
                name="location"
                maxLength={160}
                defaultValue={product?.location || ""}
                placeholder="e.g. Main library"
              />
            </label>
            <label className="field full">
              Description
              <textarea
                name="description"
                required
                rows={4}
                defaultValue={product?.description ?? ""}
                maxLength={5000}
              />
            </label>
            <label className="field full">
              Item photo
              <input type="file" name="photo" accept="image/jpeg,image/png" />
              <small>
                JPEG or PNG, up to 10 MB.
                {product?.image_url
                  ? " Leave empty to keep your current photo."
                  : ""}
              </small>
            </label>
          </div>
        </fieldset>
        <Feedback error={error} />
        {product?.moderation_status === "hidden" && (
          <p className="note">
            This listing is hidden. Editing is available after an administrator
            restores it.
          </p>
        )}
        {progress && (
          <p role="status" className="muted small">
            {progress}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={
              busy || (product && product.moderation_status !== "visible")
            }
          >
            {busy ? "Saving…" : product ? "Save changes" : "Publish listing"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

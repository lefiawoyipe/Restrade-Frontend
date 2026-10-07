import type { RefreshScope } from "./version-tracker";
import type { Tables } from "./database.types";
import { supabase } from "@/lib/supabase";

export const conditions: Record<string, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good condition",
  fair: "Pre-loved",
};
export const statusLabels: Record<string, string> = {
  pending: "Awaiting payment",
  escrow_funded: "Funds held in escrow",
  completed: "Completed",
  disputed: "Dispute under review",
  refunded: "Refunded",
  available: "Available",
  in_escrow: "In escrow",
  sold: "Sold",
};
export const money = (amount: number) =>
  `GH₵ ${Number(amount).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const dateLabel = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Date unavailable";
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase() || "R";
export const errorMessage = (error: unknown) =>
  error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "Something went wrong. Please try again.";
export type Profile = Tables<"profiles">;
export type Product = Tables<"products"> & { seller: Profile | null };
export type Order = Tables<"orders"> & {
  product: Product | null;
  buyer?: Pick<Profile, "id" | "full_name" | "campus"> | null;
};
export const productSelect =
  "*, seller:profiles!products_seller_id_fkey(id,full_name,campus,bio,trust_score,total_reviews,is_admin,is_suspended)";
export const orderSelect = `*, product:products!orders_product_id_fkey(${productSelect}), buyer:profiles!orders_buyer_id_fkey(id,full_name,campus)`;

// Read every page before local search/sorting: never silently search a capped API response.
export async function loadProducts(
  userId?: string,
  own = false,
): Promise<Product[]> {
  const items: Product[] = [];
  for (let from = 0; ; from += 500) {
    let query = supabase
      .from("products")
      .select(
        own
          ? productSelect
          : productSelect.replace(
              "!products_seller_id_fkey",
              "!products_seller_id_fkey!inner",
            ),
      )
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + 499);
    if (own && userId) query = query.eq("seller_id", userId);
    else {
      query = query
        .eq("status", "available")
        .eq("moderation_status", "visible")
        .not("seller.is_admin", "is", true)
        .eq("seller.is_suspended", false);
      if (userId) query = query.neq("seller_id", userId);
    }
    const { data, error } = await query;
    if (error) throw error;
    items.push(...(data as unknown as Product[]));
    if (data.length < 500) return items;
  }
}
// Dashboard only needs a bounded recent history; full history is server-paginated on /orders.
export async function loadOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(orderSelect)
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(20);
  if (error) throw error;
  return data as unknown as Order[];
}
export function notifyDataChanged(
  scopes: RefreshScope[] = ["marketplace", "personal", "admin"],
) {
  window.dispatchEvent(new CustomEvent("restrade:data", { detail: scopes }));
}

export async function requireTrader() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Sign in to continue.");
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin,is_suspended")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  if (data.is_admin || data.is_suspended)
    throw new Error("Only active student accounts can start new trades.");
}
export async function loadCategories() {
  const { data, error } = await supabase
    .from("product_categories")
    .select("name")
    .order("name");
  if (error) throw error;
  return data.map((row) => row.name);
}

import { supabase } from "@/lib/supabase";

export const categories = [
  "Electronics",
  "Books",
  "Fashion",
  "Room essentials",
];
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
export const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
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
export interface Profile {
  id: string;
  full_name: string;
  campus: string | null;
  bio: string | null;
  trust_score: number;
  total_reviews: number;
  is_admin: boolean;
}
export interface Product {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  image_url: string | null;
  status: string;
  created_at: string;
  category: string | null;
  condition: string | null;
  campus: string | null;
  location: string | null;
  seller: Profile | null;
}
export interface Order {
  id: string;
  buyer_id: string;
  product_id: string;
  amount: number;
  status: string;
  created_at: string;
  product: Product | null;
  buyer?: Profile | null;
}
export const productSelect =
  "*, seller:profiles!products_seller_id_fkey(id,full_name,campus,bio,trust_score,total_reviews,is_admin)";
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
      .select(productSelect)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + 499);
    if (own && userId) query = query.eq("seller_id", userId);
    else {
      query = query.eq("status", "available");
      if (userId) query = query.neq("seller_id", userId);
    }
    const { data, error } = await query;
    if (error) throw error;
    items.push(...(data as unknown as Product[]));
    if (data.length < 500) return items;
  }
}
export async function loadOrders(): Promise<Order[]> {
  const items: Order[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from("orders")
      .select(orderSelect)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + 499);
    if (error) throw error;
    items.push(...(data as unknown as Order[]));
    if (data.length < 500) return items;
  }
}
export function notifyDataChanged() {
  window.dispatchEvent(new Event("restrade:data"));
}

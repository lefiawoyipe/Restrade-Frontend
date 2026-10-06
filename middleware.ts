import type { Database } from "./src/lib/database.types";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/admin",
  "/dashboard",
  "/marketplace",
  "/orders",
  "/profile",
  "/settings",
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/unsubscribe") {
    const response = NextResponse.next({ request });
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirect = (url: URL) => {
    const destination = NextResponse.redirect(url);
    response.cookies
      .getAll()
      .forEach((cookie) => destination.cookies.set(cookie));
    return destination;
  };

  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectedFrom", pathname);
    return redirect(loginUrl);
  }

  if (!user) return response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin,is_suspended")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.is_admin === true;
  if (
    (!isAdmin || profile?.is_suspended) &&
    (pathname === "/admin" || pathname.startsWith("/admin/"))
  ) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = isAdmin ? "/settings" : "/dashboard";
    dashboardUrl.search = "";
    return redirect(dashboardUrl);
  }

  if (
    isAdmin &&
    ["/dashboard", "/marketplace", "/orders", "/login", "/register"].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  ) {
    const url = request.nextUrl.clone();
    url.pathname = profile?.is_suspended ? "/settings" : "/admin";
    url.search = "";
    return redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

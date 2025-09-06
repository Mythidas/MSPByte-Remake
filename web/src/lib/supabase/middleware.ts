import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const handleAuth = async (request: NextRequest) => {
  try {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_SUPABASE_API_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.getUser();
    const { data: user } = await supabase
      .from("users")
      .select("id,tenant_id,role_id")
      .eq("id", data.user?.id)
      .single();
    if (user) {
      await supabase.auth.admin.updateUserById(user.id, {
        app_metadata: {
          tenant_id: user.tenant_id,
          role_id: user.role_id,
        },
      });
    }

    // re-write landing page
    if (error && request.nextUrl.pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/landing-page";
      return NextResponse.rewrite(url);
    }

    // auth routes
    if (error && !request.nextUrl.pathname.startsWith("/auth")) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // redirect authed users
    if (request.nextUrl.pathname.includes("/auth") && !error) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return response;
  } catch {
    console.error("[Middleware] Failed to check auth");

    const url = request.nextUrl.clone();
    url.pathname = "/landing-page";
    return NextResponse.rewrite(url);
  }
};

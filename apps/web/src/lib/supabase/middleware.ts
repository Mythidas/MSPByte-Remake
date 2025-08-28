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
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    const { error } = await supabase.auth.getUser();

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

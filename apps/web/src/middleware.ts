import { NextRequest } from "next/server";
import { handleAuth } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await handleAuth(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

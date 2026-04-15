import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createClient();
  await supabase.auth.exchangeCodeForSession(code);

  return NextResponse.redirect(new URL("/dashboard", request.url));
}

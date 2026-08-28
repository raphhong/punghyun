import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_BASE } from "@/lib/admin/config";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 현재 경로를 헤더로 전달 (루트 레이아웃에서 어드민/마케팅 구분용)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const pass = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  // 어드민 경로만 보호. 공개 사이트는 그대로 통과.
  if (!pathname.startsWith(ADMIN_BASE)) return pass();

  // Supabase 미설정 시(로컬 초기 상태) 크래시 방지.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return pass();
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser()는 매 요청마다 Auth 서버로 네트워크 왕복이 발생.
  // getClaims()는 JWKS로 JWT를 로컬 검증(가능 시)하여 왕복을 없앰.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const loginPath = `${ADMIN_BASE}/login`;
  const isLogin = pathname === loginPath;

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    url.search = `?redirect=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = ADMIN_BASE;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};

import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

function roleHome(role: string) {
  if (role === "NOTE_AGENT") return "/dashboard/orders";
  if (role === "PACKAGING_AGENT") return "/dashboard/ready-to-ship";
  return "/dashboard";
}

function isAllowed(pathname: string, role: string) {
  if (role === "NOTE_AGENT") {
    return (
      pathname === "/dashboard/orders" ||
      pathname === "/dashboard/all-orders" ||
      pathname.startsWith("/dashboard/all-orders/")
    );
  }

  if (role === "PACKAGING_AGENT") {
    return (
      pathname === "/dashboard/ready-to-ship" ||
      pathname.startsWith("/dashboard/ready-to-ship/") ||
      pathname === "/dashboard/post-print-actions"
    );
  }

  return true;
}

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = String(token.role || "");
  const pathname = request.nextUrl.pathname;

  if (pathname === "/dashboard" && (role === "NOTE_AGENT" || role === "PACKAGING_AGENT")) {
    return NextResponse.redirect(new URL(roleHome(role), request.url));
  }

  if (!isAllowed(pathname, role)) {
    return NextResponse.redirect(new URL(roleHome(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

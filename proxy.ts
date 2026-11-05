import { NextResponse, type NextRequest } from "next/server";
import { desktopAPIAuthorized } from "./src/server/desktop-access.ts";
import { isAuthEnabled, SESSION_COOKIE_NAME, verifySessionToken } from "./src/server/auth.ts";

/**
 * Global application middleware:
 * 1. Checks desktop API secret header when running in Electron desktop mode.
 * 2. When LH_PASSWORD or LH_PASSWORD_FILE is configured, enforces session cookie
 *    authentication for pages and APIs, redirecting unauthenticated page requests
 *    to /login and returning 401 for API requests.
 */
export function proxy(request: NextRequest) {
	const { pathname, search } = request.nextUrl;

	// In desktop Electron mode, enforce desktop API capability on /api/*
	if (pathname.startsWith("/api/") && !desktopAPIAuthorized(request.headers)) {
		return NextResponse.json(
			{ error: "Desktop API access requires the trusted LearnHarness window." },
			{ status: 403, headers: { "Cache-Control": "no-store" } },
		);
	}

	// If password auth is disabled (default in desktop/dev mode), pass through
	if (!isAuthEnabled()) {
		return NextResponse.next();
	}

	// Public routes allowed without auth
	if (pathname === "/login" || pathname === "/api/auth/login") {
		// If user is already authenticated and visits /login, redirect to home
		if (pathname === "/login") {
			const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
			if (verifySessionToken(token)) {
				const redirectUrl = request.nextUrl.searchParams.get("redirect") || "/";
				return NextResponse.redirect(new URL(redirectUrl, request.url));
			}
		}
		return NextResponse.next();
	}

	// Verify session cookie
	const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
	if (verifySessionToken(token)) {
		return NextResponse.next();
	}

	// Unauthenticated request
	if (pathname.startsWith("/api/")) {
		return NextResponse.json(
			{ error: "Authentication required" },
			{ status: 401, headers: { "Cache-Control": "no-store" } },
		);
	}

	// Page request: redirect to /login
	const loginUrl = new URL("/login", request.url);
	if (pathname !== "/") {
		loginUrl.searchParams.set("redirect", `${pathname}${search}`);
	}
	return NextResponse.redirect(loginUrl);
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff|woff2|worklet\\.js)$).*)",
	],
};

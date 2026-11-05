import { NextResponse, type NextRequest } from "next/server";
import {
	createSessionToken,
	isAuthEnabled,
	SESSION_COOKIE_NAME,
	SESSION_MAX_AGE_SECONDS,
	verifyPassword,
	verifySessionToken,
} from "@/src/server/auth.ts";

export async function GET(request: NextRequest) {
	const enabled = isAuthEnabled();
	const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
	const authenticated = !enabled || verifySessionToken(token);
	return NextResponse.json({ enabled, authenticated });
}

export async function POST(request: NextRequest) {
	if (!isAuthEnabled()) {
		return NextResponse.json({ ok: true, message: "Authentication is not enabled" });
	}

	try {
		const body = (await request.json()) as { password?: string };
		const candidate = body.password ?? "";

		if (!verifyPassword(candidate)) {
			return NextResponse.json(
				{ ok: false, error: "Incorrect password" },
				{ status: 401 },
			);
		}

		const token = createSessionToken();
		const isHttps =
			request.nextUrl.protocol === "https:" ||
			request.headers.get("x-forwarded-proto") === "https";

		const response = NextResponse.json({ ok: true });
		response.cookies.set(SESSION_COOKIE_NAME, token, {
			httpOnly: true,
			secure: isHttps,
			sameSite: "lax",
			path: "/",
			maxAge: SESSION_MAX_AGE_SECONDS,
		});

		return response;
	} catch {
		return NextResponse.json(
			{ ok: false, error: "Invalid request payload" },
			{ status: 400 },
		);
	}
}

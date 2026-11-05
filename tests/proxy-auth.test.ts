import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy.ts";
import { createSessionToken, SESSION_COOKIE_NAME } from "../src/server/auth.ts";

describe("proxy middleware auth gates", () => {
	const origEnvPassword = process.env.LH_PASSWORD;
	const origSecret = process.env.LH_SESSION_SECRET;

	beforeEach(() => {
		delete process.env.LH_PASSWORD;
		delete process.env.LH_PASSWORD_FILE;
		delete process.env.LH_SESSION_SECRET;
	});

	afterEach(() => {
		if (origEnvPassword !== undefined) process.env.LH_PASSWORD = origEnvPassword;
		else delete process.env.LH_PASSWORD;
		if (origSecret !== undefined) process.env.LH_SESSION_SECRET = origSecret;
		else delete process.env.LH_SESSION_SECRET;
	});

	it("passes everything when auth is disabled", () => {
		const req = new NextRequest(new URL("http://localhost:3000/api/chats"));
		const res = proxy(req);
		assert.equal(res.status, 200);
	});

	it("blocks unauthenticated /api/* with 401 when auth is enabled", () => {
		process.env.LH_PASSWORD = "secret";
		const req = new NextRequest(new URL("http://localhost:3000/api/chats"));
		const res = proxy(req);
		assert.equal(res.status, 401);
	});

	it("redirects unauthenticated page request to /login with redirect query param", () => {
		process.env.LH_PASSWORD = "secret";
		const req = new NextRequest(new URL("http://localhost:3000/chat/123?tab=notes"));
		const res = proxy(req);
		assert.equal(res.status, 307);
		const location = res.headers.get("location");
		assert.ok(location);
		const url = new URL(location);
		assert.equal(url.pathname, "/login");
		assert.equal(url.searchParams.get("redirect"), "/chat/123?tab=notes");
	});

	it("allows public /login and /api/auth/login routes through", () => {
		process.env.LH_PASSWORD = "secret";

		const loginPageReq = new NextRequest(new URL("http://localhost:3000/login"));
		const loginPageRes = proxy(loginPageReq);
		assert.equal(loginPageRes.status, 200);

		const loginApiReq = new NextRequest(new URL("http://localhost:3000/api/auth/login"));
		const loginApiRes = proxy(loginApiReq);
		assert.equal(loginApiRes.status, 200);
	});

	it("allows requests through with a valid session cookie", () => {
		process.env.LH_PASSWORD = "secret";
		process.env.LH_SESSION_SECRET = "0123456789abcdef0123456789abcdef";

		const token = createSessionToken();
		const req = new NextRequest(new URL("http://localhost:3000/api/chats"), {
			headers: {
				cookie: `${SESSION_COOKIE_NAME}=${token}`,
			},
		});
		const res = proxy(req);
		assert.equal(res.status, 200);
	});
});

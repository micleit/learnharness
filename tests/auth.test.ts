import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
	createSessionToken,
	getExpectedPassword,
	isAuthEnabled,
	verifyPassword,
	verifySessionToken,
} from "../src/server/auth.ts";

describe("auth system (src/server/auth.ts)", () => {
	const origEnvPassword = process.env.LH_PASSWORD;
	const origEnvFile = process.env.LH_PASSWORD_FILE;
	const origSecret = process.env.LH_SESSION_SECRET;

	beforeEach(() => {
		delete process.env.LH_PASSWORD;
		delete process.env.LH_PASSWORD_FILE;
		delete process.env.LH_SESSION_SECRET;
	});

	afterEach(() => {
		if (origEnvPassword !== undefined) process.env.LH_PASSWORD = origEnvPassword;
		else delete process.env.LH_PASSWORD;
		if (origEnvFile !== undefined) process.env.LH_PASSWORD_FILE = origEnvFile;
		else delete process.env.LH_PASSWORD_FILE;
		if (origSecret !== undefined) process.env.LH_SESSION_SECRET = origSecret;
		else delete process.env.LH_SESSION_SECRET;
	});

	it("auth is disabled when no password or password file configured", () => {
		assert.equal(isAuthEnabled(), false);
		assert.equal(getExpectedPassword(), null);
		assert.equal(verifyPassword("anything"), true, "when disabled, all verify calls pass");
	});

	it("auth is enabled when LH_PASSWORD is set", () => {
		process.env.LH_PASSWORD = "supersecretpassword123";
		assert.equal(isAuthEnabled(), true);
		assert.equal(getExpectedPassword(), "supersecretpassword123");
		assert.equal(verifyPassword("supersecretpassword123"), true);
		assert.equal(verifyPassword("wrongpassword"), false);
		assert.equal(verifyPassword(""), false);
	});

	it("auth reads from LH_PASSWORD_FILE when set", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-auth-test-"));
		const passFile = path.join(tmpDir, "password.txt");
		fs.writeFileSync(passFile, "file-secret-password-xyz\n", "utf-8");

		process.env.LH_PASSWORD_FILE = passFile;
		assert.equal(isAuthEnabled(), true);
		assert.equal(getExpectedPassword(), "file-secret-password-xyz");
		assert.equal(verifyPassword("file-secret-password-xyz"), true);
		assert.equal(verifyPassword("wrong"), false);

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("creates and verifies valid session tokens", () => {
		process.env.LH_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
		const token = createSessionToken();
		assert.ok(token);
		assert.equal(verifySessionToken(token), true);
	});

	it("rejects tampered, expired, or malformed session tokens", () => {
		process.env.LH_SESSION_SECRET = "0123456789abcdef0123456789abcdef";
		assert.equal(verifySessionToken(null), false);
		assert.equal(verifySessionToken(""), false);
		assert.equal(verifySessionToken("not-a-token"), false);

		// Tampered signature
		const validToken = createSessionToken();
		const parts = validToken.split(".");
		const tampered = `${parts[0]}.${parts[1]}.badsignature`;
		assert.equal(verifySessionToken(tampered), false);

		// Expired timestamp
		const expiredTime = Date.now() - 10000;
		const expiredPayload = `${expiredTime}.${parts[1]}`;
		assert.equal(verifySessionToken(`${expiredPayload}.${parts[2]}`), false);
	});
});

/**
 * Server-side password authentication & session management.
 *
 * When LH_PASSWORD or LH_PASSWORD_FILE is configured, the server requires
 * authentication. Sessions are stored in an httpOnly signed cookie (lh_session)
 * valid for 30 days. When neither is configured, auth is disabled (retaining
 * desktop Electron and local dev behavior).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";

export const SESSION_COOKIE_NAME = "lh_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/** Cached password from LH_PASSWORD or LH_PASSWORD_FILE. */
let cachedPassword: string | null = null;
let cachedPasswordSource: string | null = null;

export function getExpectedPassword(): string | null {
	const envPassword = process.env.LH_PASSWORD?.trim();
	if (envPassword) return envPassword;

	const filePath = process.env.LH_PASSWORD_FILE?.trim();
	if (!filePath) return null;

	try {
		const stat = fs.statSync(filePath);
		const sourceKey = `${filePath}:${stat.mtimeMs}`;
		if (cachedPasswordSource === sourceKey && cachedPassword !== null) {
			return cachedPassword;
		}
		cachedPassword = fs.readFileSync(filePath, "utf-8").trim();
		cachedPasswordSource = sourceKey;
		return cachedPassword;
	} catch {
		return null;
	}
}

export function isAuthEnabled(): boolean {
	return getExpectedPassword() !== null;
}

/** Timing-safe password verification. */
export function verifyPassword(candidate: string): boolean {
	const expected = getExpectedPassword();
	if (!expected) return true; // Auth disabled = all pass

	const key = "learnharness-password-hmac";
	const candidateHash = createHmac("sha256", key).update(candidate).digest();
	const expectedHash = createHmac("sha256", key).update(expected).digest();

	return timingSafeEqual(candidateHash, expectedHash);
}

/** Session signing secret, auto-persisted in data/.session-secret if unset. */
let sessionSecret: string | null = null;

export function getSessionSecret(): string {
	if (sessionSecret) return sessionSecret;

	const envSecret = process.env.LH_SESSION_SECRET?.trim();
	if (envSecret && envSecret.length >= 32) {
		sessionSecret = envSecret;
		return sessionSecret;
	}

	const secretFile = path.join(PATHS.data, ".session-secret");
	try {
		if (fs.existsSync(secretFile)) {
			const stored = fs.readFileSync(secretFile, "utf-8").trim();
			if (stored.length >= 32) {
				sessionSecret = stored;
				return sessionSecret;
			}
		}
		fs.mkdirSync(PATHS.data, { recursive: true });
		const generated = randomBytes(32).toString("hex");
		fs.writeFileSync(secretFile, generated, { mode: 0o600 });
		sessionSecret = generated;
		return sessionSecret;
	} catch {
		// Fallback in-memory secret if directory is not writable
		sessionSecret = randomBytes(32).toString("hex");
		return sessionSecret;
	}
}

/** Create HMAC-SHA256 signed session token: <expiresAt>.<nonce>.<sig> */
export function createSessionToken(): string {
	const secret = getSessionSecret();
	const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
	const nonce = randomBytes(16).toString("hex");
	const payload = `${expiresAt}.${nonce}`;
	const signature = createHmac("sha256", secret).update(payload).digest("base64url");
	return `${payload}.${signature}`;
}

/** Verify HMAC-SHA256 session token and expiry. */
export function verifySessionToken(token: string | null | undefined): boolean {
	if (!token || typeof token !== "string") return false;

	const parts = token.split(".");
	if (parts.length !== 3) return false;

	const [expiresAtStr, nonce, suppliedSig] = parts;
	const expiresAt = Number.parseInt(expiresAtStr!, 10);
	if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
		return false; // Expired or malformed
	}

	const secret = getSessionSecret();
	const payload = `${expiresAtStr}.${nonce}`;
	const expectedSig = createHmac("sha256", secret).update(payload).digest("base64url");

	const actualBuffer = Buffer.from(suppliedSig!);
	const expectedBuffer = Buffer.from(expectedSig);

	if (actualBuffer.length !== expectedBuffer.length) return false;
	return timingSafeEqual(actualBuffer, expectedBuffer);
}

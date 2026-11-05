"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LhMark } from "@/components/lh-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const redirectUrl = searchParams.get("redirect") || "/";

	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!password.trim() || loading) return;

		setLoading(true);
		setError(null);

		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password }),
			});

			const data = (await res.json().catch(() => ({}))) as {
				ok?: boolean;
				error?: string;
			};

			if (!res.ok || !data.ok) {
				setError(data.error || "Incorrect password");
				setLoading(false);
				return;
			}

			// Successfully logged in — navigate to destination
			router.push(redirectUrl);
			router.refresh();
		} catch {
			setError("Failed to connect to server");
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-dvh flex-col items-center justify-center p-4">
			<div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-6 shadow-xl">
				<div className="flex flex-col items-center space-y-2 text-center">
					<div className="flex size-12 items-center justify-center rounded-lg bg-accent/40 p-2">
						<LhMark className="size-8" />
					</div>
					<h1 className="font-title text-2xl font-bold tracking-tight text-foreground">
						LearnHarness
					</h1>
					<p className="text-xs text-muted-foreground">
						Enter password to access this instance
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-1.5">
						<Input
							type="password"
							placeholder="Server password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							autoFocus
							disabled={loading}
							className="font-ui text-sm"
							aria-label="Server password"
							autoComplete="current-password"
						/>
						{error && (
							<p className="text-xs text-destructive font-medium" role="alert">
								{error}
							</p>
						)}
					</div>

					<Button
						type="submit"
						disabled={loading || !password.trim()}
						className="w-full cursor-pointer font-ui text-xs"
					>
						{loading ? "Signing in…" : "Sign In"}
					</Button>
				</form>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={<div className="min-h-dvh bg-background" />}>
			<LoginForm />
		</Suspense>
	);
}

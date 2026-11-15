import { env } from 'cloudflare:workers';

export type RateLimit = { allowed: boolean; retryAfter: number };

export async function hit(key: string, limit: number, windowSeconds: number): Promise<RateLimit> {
	const now = Date.now();
	const windowMs = windowSeconds * 1000;
	const [, upsert] = await env.DB.batch<{ count: number; reset_at: number }>([
		env.DB.prepare('DELETE FROM rate_limits WHERE reset_at <= ?').bind(now),
		env.DB.prepare(
			`INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2 + ?3)
			ON CONFLICT (key) DO UPDATE SET
				count = CASE WHEN reset_at <= ?2 THEN 1 ELSE count + 1 END,
				reset_at = CASE WHEN reset_at <= ?2 THEN ?2 + ?3 ELSE reset_at END
			RETURNING count, reset_at`
		).bind(key, now, windowMs)
	]);
	const row = upsert.results[0];
	return { allowed: row.count <= limit, retryAfter: Math.ceil((row.reset_at - now) / 1000) };
}

export function clientIp(request: Request) {
	return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

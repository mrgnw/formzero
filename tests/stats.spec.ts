import { readFileSync, readdirSync } from "node:fs";
import Database from "better-sqlite3";
import { expect, test } from "@playwright/test";
import { dailyCounts, submissionStats } from "../src/lib/server/stats.js";

const DAY = 24 * 60 * 60 * 1000;

function referenceStats(times: number[], now: number) {
	const between = (from: number, to = Infinity) => times.filter((t) => t >= from && t < to).length;
	const trend = (current: number, previous: number) =>
		previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);
	const thisWeek = between(now - 7 * DAY);
	const thisMonth = between(now - 30 * DAY);
	return {
		total: times.length,
		thisWeek,
		thisMonth,
		weekTrend: trend(thisWeek, between(now - 14 * DAY, now - 7 * DAY)),
		monthTrend: trend(thisMonth, between(now - 60 * DAY, now - 30 * DAY)),
	};
}

function referenceDays(times: number[], now: number) {
	return Array.from({ length: 30 }, (_, index) => {
		const date = new Date(now - (29 - index) * DAY);
		const startOfDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
		return {
			date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
			count: times.filter((t) => t >= startOfDay && t < startOfDay + DAY).length,
		};
	});
}

function d1(sqlite: Database.Database) {
	return {
		prepare(sql: string) {
			const statement = sqlite.prepare(sql);
			let params: unknown[] = [];
			const bound = {
				bind(...values: unknown[]) {
					params = values;
					return bound;
				},
				first: async () => statement.get(...params) ?? null,
				all: async () => ({ results: statement.all(...params) }),
			};
			return bound;
		},
	} as unknown as D1Database;
}

function database(times: number[]) {
	const sqlite = new Database(":memory:");
	for (const file of readdirSync("migrations").sort()) sqlite.exec(readFileSync(`migrations/${file}`, "utf8"));
	sqlite.prepare("INSERT INTO forms (id, name, created_at, updated_at) VALUES ('f', 'F', 0, 0), ('other', 'O', 0, 0)").run();
	const insert = sqlite.prepare("INSERT INTO submissions (id, form_id, data, created_at) VALUES (?, ?, '{}', ?)");
	times.forEach((time, index) => insert.run(`s${index}`, "f", time));
	insert.run("noise", "other", times[0] ?? 0);
	return d1(sqlite);
}

const nows = [
	Date.UTC(2026, 10, 15, 13, 37, 21, 123),
	Date.UTC(2026, 10, 15, 0, 0, 0, 0),
	Date.UTC(2026, 10, 15, 23, 59, 59, 999),
	Date.UTC(2024, 1, 29, 6, 0, 0, 0),
];

for (const now of nows) {
	test(`SQL stats and daily buckets match the JS computation at ${new Date(now).toISOString()}`, async () => {
		const date = new Date(now);
		const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
		const edges = [7, 14, 30, 60].flatMap((days) => [now - days * DAY - 1, now - days * DAY, now - days * DAY + 1]);
		const dayEdges = [0, 1, 15, 29, 30].flatMap((days) => [today - days * DAY - 1, today - days * DAY, today - days * DAY + 1]);
		const spread = Array.from({ length: 200 }, (_, index) => now - index * 7_777_777);
		const times = [...edges, ...dayEdges, ...spread, now, now + 1, today + DAY - 1, today + DAY, now + 90 * DAY, 0];

		const db = database(times);
		expect(await submissionStats(db, "f", now)).toEqual(referenceStats(times, now));
		expect(await dailyCounts(db, "f", now)).toEqual(referenceDays(times, now));
	});
}

test("an empty form has zero stats and thirty empty days", async () => {
	const now = nows[0];
	const db = database([]);
	expect(await submissionStats(db, "f", now)).toEqual(referenceStats([], now));
	expect(await dailyCounts(db, "f", now)).toEqual(referenceDays([], now));
});

import { expect, test } from "@playwright/test";
import { submissionsCsv } from "../src/lib/server/csv.js";
import { sqliteD1 } from "./sqlite";

const iso = (time: number) => new Date(time).toISOString();

test("rows inserted after the export starts are excluded from the header and the rows", async () => {
	const { db, insert } = sqliteD1();
	insert("b", "f", '{"old":"1"}', 1000);
	insert("a", "f", '{"old":"2"}', 2000);
	insert("x", "other", '{"other":"x"}', 5000);

	const stream = await submissionsCsv(db, "f");
	insert("c", "f", '{"late":"same time, later id"}', 2000);
	insert("d", "f", '{"late":"newer"}', 3000);
	const body = await new Response(stream).text();

	expect(body).toBe(`ID,Created At,old\na,${iso(2000)},2\nb,${iso(1000)},1`);
});

test("an empty form exports only the header", async () => {
	const { db } = sqliteD1();
	expect(await new Response(await submissionsCsv(db, "f")).text()).toBe("ID,Created At");
});

test("the header keeps at most 500 columns and each cell at most 32 KiB", async () => {
	const { db, insert } = sqliteD1();
	const keys = Array.from({ length: 600 }, (_, index) => `k${String(index).padStart(3, "0")}`);
	insert("wide", "f", JSON.stringify(Object.fromEntries(keys.map((key) => [key, key]))), 1000);
	insert("long", "f", JSON.stringify({ k000: "=".repeat(40_000), [`z${"x".repeat(40_000)}`]: "dropped" }), 2000);

	const [header, longRow, wideRow] = (await new Response(await submissionsCsv(db, "f")).text()).split("\n");
	expect(header).toBe(["ID", "Created At", ...keys.slice(0, 500)].join(","));
	const longCells = longRow.split(",");
	expect(longCells[2]).toBe(`'${"=".repeat(32 * 1024)}`);
	expect(longCells).toHaveLength(502);
	expect(wideRow.split(",")).toEqual(["wide", new Date(1000).toISOString(), ...keys.slice(0, 500)]);
});

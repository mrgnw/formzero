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

import { readFileSync, readdirSync } from "node:fs";
import Database from "better-sqlite3";

export function sqliteD1() {
	const sqlite = new Database(":memory:");
	for (const file of readdirSync("migrations").sort()) sqlite.exec(readFileSync(`migrations/${file}`, "utf8"));
	sqlite.prepare("INSERT INTO forms (id, name, created_at, updated_at) VALUES ('f', 'F', 0, 0), ('other', 'O', 0, 0)").run();
	const insertStatement = sqlite.prepare("INSERT INTO submissions (id, form_id, data, created_at) VALUES (?, ?, ?, ?)");
	const db = {
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
	return {
		db,
		insert: (id: string, formId: string, data: string, createdAt: number) => insertStatement.run(id, formId, data, createdAt),
	};
}

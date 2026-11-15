import { betterAuth } from "better-auth"
import { D1Dialect } from 'kysely-d1';

export function getAuth(env: Env) {
    return betterAuth({
        database: {
           type: "sqlite",
           dialect: new D1Dialect({ database: env.DB }),
        },
        secret: env.BETTER_AUTH_SECRET,
        emailAndPassword: {
            enabled: true
        }
    })
}

export async function getUserCount({ database }: { database: D1Database }): Promise<number> {
    const result = await database
        .prepare("SELECT COUNT(*) as count FROM user")
        .first<{ count: number }>();

    if (!result) {
        throw new Error("Failed to retrieve user count");
    }

    return result.count;
}

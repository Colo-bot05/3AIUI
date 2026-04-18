import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type DatabaseClient = ReturnType<typeof drizzle<typeof schema>>;

let cachedClient: DatabaseClient | null = null;

export function getDatabaseClient(): DatabaseClient | null {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return null;
  }

  if (cachedClient) {
    return cachedClient;
  }

  const sql = postgres(url, { max: 4, idle_timeout: 20 });
  cachedClient = drizzle(sql, { schema });
  return cachedClient;
}

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function runMigrationsAtStartup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrate] DATABASE_URL not set, skipping");
    return;
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(sql);
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[migrate] migrations applied");
  } catch (error) {
    console.error(
      "[migrate] failed:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    await sql.end();
  }
}

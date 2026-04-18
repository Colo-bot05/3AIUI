export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrationsAtStartup } = await import(
      "./lib/db/run-migrations"
    );
    await runMigrationsAtStartup();
  }
}

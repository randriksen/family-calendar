export async function register() {
  // Only run on server side, not in edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./src/lib/scheduler');
    // Initialize DB (import triggers schema init)
    await import('./src/lib/db');
    startScheduler();
  }
}

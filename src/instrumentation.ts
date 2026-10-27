export async function register() {
  // The `=== 'nodejs'` wrapping block is load-bearing: Next replaces
  // process.env.NEXT_RUNTIME with a literal per compilation, so this block is
  // provably dead in the edge build and webpack drops the better-sqlite3
  // import with it. An early `return` instead of a block defeats that and
  // breaks the build with "Can't resolve 'fs'".
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler');
    // Initialize DB (import triggers schema init)
    await import('./lib/db');
    startScheduler();
  }
}

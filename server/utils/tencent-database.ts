import pg from 'pg';
let pool: pg.Pool | undefined;
export function tencentDatabase() {
  if (!pool) {
    const connectionString = String(useRuntimeConfig().legacyDatabaseUrl || '');
    const url = new URL(connectionString);
    if (!['127.0.0.1','localhost'].includes(url.hostname) || !/^\/lycee_v2(?:_stage_\d+)?$/.test(url.pathname)) throw new Error('Local database guard failed');
    pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 10000, statement_timeout: 15000, options: '-c default_transaction_read_only=on' });
    pool.on('error', () => console.error('Local read database unavailable'));
  }
  return pool;
}

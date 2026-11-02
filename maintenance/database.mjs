import pg from 'pg';
export function localConnection(value=process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL){
  const url=new URL(value);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||!/^\/lycee_v2(?:_stage_\d+)?$/.test(url.pathname))throw new Error('Maintenance database guard failed');
  return value;
}
export function connection(){const client=new pg.Client({connectionString:localConnection(),connectionTimeoutMillis:10000,statement_timeout:120000});return client;}

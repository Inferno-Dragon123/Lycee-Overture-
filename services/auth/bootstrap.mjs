import pg from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { createLocalAuth,localAuthDatabaseUrl,configuredSiteOrigin,authMailTableSql } from './local-auth.js';
const pool=new pg.Pool({connectionString:localAuthDatabaseUrl(),max:1,connectionTimeoutMillis:10000});
try{
  const auth=createLocalAuth({database:pool,origin:configuredSiteOrigin(),secret:process.env.BETTER_AUTH_SECRET,validateSchema:false});
  const migrations=await getMigrations(auth.options);await migrations.runMigrations();
  await pool.query(authMailTableSql);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(191912,3)');
    const source=(await client.query('SELECT id::text,name,email,"emailVerified",image,"createdAt","updatedAt",role,banned,"banReason","banExpires" FROM neon_auth."user" ORDER BY id')).rows;
    const target=(await client.query('SELECT id,email FROM toolbox_auth_users FOR UPDATE')).rows;
    if(target.some(row=>!source.some(user=>row.id===user.id&&row.email.toLowerCase()===user.email.toLowerCase())))throw new Error('Unexpected local account before activation');
    for(const u of source)await client.query(`INSERT INTO toolbox_auth_users(id,name,email,"emailVerified",image,"createdAt","updatedAt",role,banned,"banReason","banExpires") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,"emailVerified"=excluded."emailVerified",image=excluded.image,role=excluded.role,banned=excluded.banned,"banReason"=excluded."banReason","banExpires"=excluded."banExpires"`,[u.id,u.name,u.email,u.emailVerified,u.image,u.createdAt,u.updatedAt,u.role,u.banned||false,u.banReason,u.banExpires]);
    await client.query('COMMIT');console.log(JSON.stringify({importedIdentities:source.length,idsPreserved:true}));
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}catch(error){console.error('Local auth bootstrap failed:',error.code||error.name);process.exitCode=1;}finally{await pool.end();}

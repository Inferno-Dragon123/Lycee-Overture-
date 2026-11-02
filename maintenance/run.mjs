import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { connection } from './database.mjs';
import { sourceFiles,publishWorkspace } from './publish-catalog.mjs';
const release=fileURLToPath(new URL('../',import.meta.url));
const workspace='/var/lib/lycee-v2-maintenance/work';
async function run(command,args){await new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd:workspace,stdio:'inherit',env:process.env});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Maintenance step failed')));
});}
async function restoreSources(){
  const client=connection();await client.connect();
  try{const rows=(await client.query('SELECT name,raw FROM toolbox_catalog_sources')).rows;
    for(const row of rows){if(!sourceFiles.includes(row.name))throw new Error('Unexpected catalog source');const target=path.join(workspace,row.name);await fs.mkdir(path.dirname(target),{recursive:true,mode:0o755});await fs.writeFile(target,row.raw,{mode:0o644});await fs.chmod(target,0o644);}
    if(rows.length!==sourceFiles.length)throw new Error('Incomplete catalog sources');
  }finally{await client.end();}
}
await fs.mkdir(workspace,{recursive:true,mode:0o755});
for(const name of ['scripts','lib','public'])await fs.cp(path.join(release,'maintenance/legacy',name),path.join(workspace,name),{recursive:true});
const modules=path.join(workspace,'node_modules');
await fs.lstat(modules).catch(async()=>{await fs.symlink('/opt/lycee-v2/current/node_modules',modules);});
await fs.writeFile(path.join(workspace,'package.json'),'{"type":"module"}\n',{mode:0o644});
await restoreSources();
const report={startedAt:new Date().toISOString(),cards:'pending',decks:'pending'};
let failed=false;
try{
  await run('/usr/bin/python3',['scripts/update_and_translate.py','--catalog','--no-git','--allow-missing-translations','--workers','2']);
  await run('/usr/bin/python3',['scripts/repair_cost_terms.py','--source-root',workspace,'--apply','--report','/var/lib/lycee-v2-maintenance/cost-corrections.json']);
  await run('/usr/local/bin/node',[path.join(release,'scripts/catalog/import.mjs'),workspace]);
  report.catalog=await publishWorkspace(workspace);for(const name of sourceFiles)await fs.chmod(path.join(workspace,name),0o644);report.cards='success';
}catch{failed=true;report.cards='failed';console.error('Card update failed; retaining the last published catalog and raw inputs.');await restoreSources();}
try{await run('/usr/local/bin/node',['scripts/sync-official-decks.js','--limit','100','--days','365','--pages','3']);report.decks='success';}
catch{failed=true;report.decks='failed';}
report.finishedAt=new Date().toISOString();await fs.writeFile('/var/lib/lycee-v2-maintenance/latest-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));if(failed)process.exitCode=1;

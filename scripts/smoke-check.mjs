// Explicit --write creates two zero-point demo results, one per mode. No load test.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const [target,...flags]=process.argv.slice(2);
if(!target){console.error('Aufruf: node scripts/smoke-check.mjs https://DEINE-DISTRIBUTION.cloudfront.net [--write]');process.exit(1);}
const url=new URL(target);
if(url.protocol!=='https:' && !(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))throw Error('HTTPS oder lokaler Testserver erforderlich.');
if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Nur die App-Basisadresse ohne Zugangsdaten oder Pfad angeben.');
if(flags.some(flag=>flag!=='--write'))throw Error('Unbekannte Option.');
const record={checkedAt:new Date().toISOString(),origin:url.origin,writes:flags.includes('--write'),checks:[],passed:false};
try{
 const page=await fetch(url,{signal:AbortSignal.timeout(15000)});assert.equal(page.status,200);assert.match(await page.text(),/Snake Arcade/);record.checks.push('Startseite erreichbar');
 for(const rules of ['classic','wrap']){
  const list=await fetch(new URL(`/api/scores?rules=${rules}`,url),{signal:AbortSignal.timeout(15000)});assert.equal(list.status,200);const data=await list.json();assert.equal(data.rules,rules);assert.ok(Array.isArray(data.scores)&&data.scores.length<=10);record.checks.push(`${rules}: Bestenliste erreichbar`);
  if(record.writes){
   const roundId=crypto.randomUUID();
   const post=score=>fetch(new URL('/api/scores',url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roundId,score,rules}),signal:AbortSignal.timeout(15000)});
   assert.equal((await post(0)).status,201);assert.equal((await post(0)).status,200);assert.equal((await post(1)).status,409);
   record.checks.push(`${rules}: Erstellen, Wiederholen und Konflikt geprüft`);
  }
 }
 record.passed=true;
}catch{record.error='Prüfung fehlgeschlagen; App, Einstellungen und Tabellenberechtigungen kontrollieren.';process.exitCode=1;}
await writeFile('smoke-result.local.json',JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record,null,2));

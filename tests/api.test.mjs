import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {LocalStore} from '../scripts/local-store.mjs';import {makeServer} from '../scripts/server.mjs';
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'snake-test-'));const store=new LocalStore(join(dir,'scores.json'));const server=makeServer(store);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});return {store,url:`http://127.0.0.1:${server.address().port}`};}
const post=(url,body,headers={})=>fetch(url+'/api/scores',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
test('Speichern, erneutes Senden und abweichendes Ergebnis',async t=>{const {url}=await setup(t),roundId=randomUUID();const responses=await Promise.all(Array.from({length:8},()=>post(url,{roundId,score:17})));assert.equal(responses.filter(r=>r.status===201).length,1);assert.equal(responses.filter(r=>r.status===200).length,7);assert.equal((await post(url,{roundId,score:18})).status,409);const list=await(await fetch(url+'/api/scores')).json();assert.equal(list.scores.length,1);assert.equal(list.scores[0].score,17);});
test('Ungültige und zu große Anfragen',async t=>{const {url}=await setup(t);for(const score of [-1,398,1.5,'10',null])assert.equal((await post(url,{roundId:randomUUID(),score})).status,400);assert.equal((await post(url,{roundId:'bad',score:2})).status,400);assert.equal((await post(url,{roundId:randomUUID(),score:2,name:'extra'})).status,400);assert.equal((await post(url,{x:'x'.repeat(3000)})).status,413);assert.equal((await post(url,{}, {'content-type':'text/plain'})).status,415);assert.equal((await fetch(url+'/api/scores',{method:'DELETE'})).status,405);});
test('Top 10 und Persistenz nach erneutem Öffnen',async t=>{const {url,store}=await setup(t);for(let i=0;i<12;i++)await post(url,{roundId:randomUUID(),score:i});const result=await new LocalStore(store.path).top();assert.deepEqual(result.map(x=>x.score),[11,10,9,8,7,6,5,4,3,2]);});
test('Spielmodi haben getrennte, persistente Bestenlisten und Eingabeprüfung',async t=>{
 const {url,store}=await setup(t),roundId=randomUUID();
 assert.equal((await post(url,{roundId,score:7})).status,201);
 assert.equal((await post(url,{roundId,score:19,rules:'wrap'})).status,201);
 assert.equal((await post(url,{roundId,score:19,rules:'wrap'})).status,200);
 assert.equal((await post(url,{roundId,score:20,rules:'wrap'})).status,409);
 assert.deepEqual((await (await fetch(url+'/api/scores')).json()).scores.map(e=>e.score),[7]);
 assert.deepEqual((await (await fetch(url+'/api/scores?rules=wrap')).json()).scores.map(e=>e.score),[19]);
 assert.deepEqual((await new LocalStore(store.path).top('wrap')).map(e=>e.score),[19]);
 assert.equal((await fetch(url+'/api/scores?rules=unknown')).status,400);
 assert.equal((await post(url,{roundId:randomUUID(),score:3,rules:'unknown'})).status,400);
});
test('Lokaler Server schützt Dateien und prüft Origin',async t=>{const {url}=await setup(t);assert.equal((await fetch(url+'/.data/scores.json')).status,404);assert.equal((await fetch(url+'/api/scores',{headers:{origin:'https://foreign.example'}})).status,403);const page=await fetch(url);assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);});

test('Arcade-Kürzel: exakt drei Großbuchstaben, sicherer Standard und Wiederholungen',async t=>{
 const {url}=await setup(t),roundId=randomUUID();
 const created=await post(url,{roundId,score:12,initials:'DOV'});assert.equal(created.status,201);assert.equal((await created.json()).entry.name,'DOV');
 const repeated=await post(url,{roundId,score:12,initials:'ABC'});assert.equal(repeated.status,200);assert.equal((await repeated.json()).entry.name,'DOV');
 for(const initials of ['AB','ABCD','A1B','abc','<X>',null,123])assert.equal((await post(url,{roundId:randomUUID(),score:1,initials})).status,400);
 const auto=await(await post(url,{roundId:randomUUID(),score:1})).json();assert.match(auto.entry.name,/^[A-Z]{3}$/);
});

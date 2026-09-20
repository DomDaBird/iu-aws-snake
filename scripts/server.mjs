import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {LocalStore} from './local-store.mjs';
const require=createRequire(import.meta.url),{handle}=require('../api/shared/handler.js');
const root=fileURLToPath(new URL('..',import.meta.url)),publicDir=resolve(root,'public');
const config=JSON.parse(await readFile(resolve(publicDir,'staticwebapp.config.json'),'utf8'));
export function makeServer(store=new LocalStore(resolve(root,'.data/scores.json'))){return http.createServer(async(req,res)=>{
 const send=(status,body,headers={})=>{res.writeHead(status,{...config.globalHeaders,...headers});res.end(body);};
 try{
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(403,'Origin not allowed');
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/api/scores'){
   let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>2048){send(413,JSON.stringify({error:'Anfrage zu groß.'}),{'Content-Type':'application/json'});return;}}
   const result=await handle({method:req.method,headers:req.headers,rawBody:raw,body:raw,query:Object.fromEntries(new URL(req.url,'http://localhost').searchParams)},store);
   return send(result.status,JSON.stringify(result.body),result.headers);
  }
  const routes={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/style.css':['style.css','text/css'],'/game.js':['game.js','text/javascript'],'/engine.js':['engine.js','text/javascript']};
  const file=routes[pathname];if(!file)return send(404,'Nicht gefunden');
  if(!['GET','HEAD'].includes(req.method))return send(405,'Methode nicht erlaubt',{Allow:'GET, HEAD'});
  return send(200,req.method==='HEAD'?'':await readFile(resolve(publicDir,file[0])),{'Content-Type':file[1]+'; charset=utf-8'});
 }catch{send(503,JSON.stringify({error:'Bestenliste vorübergehend nicht verfügbar.'}),{'Content-Type':'application/json'});}
});}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const port=Number(process.env.PORT||4173);makeServer().listen(port,'127.0.0.1',()=>console.log(`Snake: http://127.0.0.1:${port}`));}

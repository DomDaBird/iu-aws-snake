const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validate(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['roundId','score','rules','initials'].includes(key)))return false;
 return (body.initials===undefined||(typeof body.initials==='string'&&/^[A-Z]{3}$/.test(body.initials)))&&(body.rules===undefined||['classic','wrap'].includes(body.rules))&&typeof body.roundId==='string'&&UUID.test(body.roundId)&&Number.isInteger(body.score)&&body.score>=0&&body.score<=397;
}
async function handle(req,store){
 const reply=(status,body)=>({status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body});
 if(req.method==='GET'){const rules=req.query?.rules??'classic';if(!['classic','wrap'].includes(rules))return reply(400,{error:'Unbekannter Spielmodus.'});return reply(200,{scores:await store.top(rules),mode:store.mode,rules});}
 if(req.method!=='POST')return {...reply(405,{error:'Methode nicht erlaubt.'}),headers:{Allow:'GET, POST','Content-Type':'application/json'}};
 const type=req.headers?.['content-type']||'';
 if(!(type.split(';')[0].trim().toLowerCase()==='application/json'))return reply(415,{error:'JSON erforderlich.'});
 const raw=req.rawBody ?? JSON.stringify(req.body??null);
 if(Buffer.byteLength(raw)>2048)return reply(413,{error:'Anfrage zu groß.'});
 let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{return reply(400,{error:'Ungültiges JSON.'});}
 if(!validate(body))return reply(400,{error:'Ungültiges Spielergebnis.'});
 const entry={rules:body.rules??'classic',roundId:body.roundId.toLowerCase(),score:body.score,name:body.initials??[676,26,1].map(divisor=>String.fromCharCode(65+Math.floor(parseInt(body.roundId.slice(0,6),16)/divisor)%26)).join(''),createdAt:new Date().toISOString()};
 try{const result=await store.add(entry);return reply(result.duplicate?200:201,result);}
 catch(error){if(error.code==='CONFLICT')return reply(409,{error:'Diese Runde wurde bereits mit einem anderen Ergebnis gespeichert.'});if(error.code==='CAPACITY')return reply(503,{error:'Bestenliste ist voll.'});throw error;}
}
module.exports={handle,validate};

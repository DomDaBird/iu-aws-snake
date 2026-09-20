import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
export class LocalStore{
 mode='local';queue=Promise.resolve();
 constructor(path){this.path=path;}
 async read(){try{return JSON.parse(await readFile(this.path,'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
 async top(rules='classic'){await this.queue;return (await this.read()).filter(e=>(e.rules??'classic')===rules).sort((a,b)=>b.score-a.score||a.roundId.localeCompare(b.roundId)).slice(0,10);}
 add(entry){const work=this.queue.then(async()=>{const entries=await this.read(),old=entries.find(e=>e.roundId===entry.roundId&&(e.rules??'classic')===(entry.rules??'classic'));if(old){if(old.score!==entry.score)throw Object.assign(Error('Conflict'),{code:'CONFLICT'});return {entry:old,duplicate:true};}if(entries.length>=10000)throw Object.assign(Error('Capacity'),{code:'CAPACITY'});entries.push(entry);await mkdir(dirname(this.path),{recursive:true});await writeFile(this.path+'.tmp',JSON.stringify(entries,null,2));await rename(this.path+'.tmp',this.path);return {entry,duplicate:false};});this.queue=work.catch(()=>{});return work;}
}

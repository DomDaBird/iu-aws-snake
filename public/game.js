import {createGame,step,turn,DIRECTIONS,SIZE} from './engine.js';
const $=id=>document.getElementById(id), canvas=$('board'), ctx=canvas.getContext('2d');
let walls=true,game=createGame(),roundId=null,saving=false,saved=false,saveGeneration=0;
function draw(){
 ctx.fillStyle='#14241c';ctx.fillRect(0,0,600,600);
 ctx.strokeStyle='#1c3024';ctx.lineWidth=1;
 for(let n=1;n<SIZE;n++){ctx.beginPath();ctx.moveTo(n*30,0);ctx.lineTo(n*30,600);ctx.moveTo(0,n*30);ctx.lineTo(600,n*30);ctx.stroke();}
 game.snake.forEach(([x,y],i)=>{ctx.fillStyle=i?'#93bd76':'#d7ed8e';ctx.fillRect(x*30+2,y*30+2,26,26);});
 if(game.food){ctx.fillStyle='#ee9871';ctx.beginPath();ctx.arc(game.food[0]*30+15,game.food[1]*30+15,9,0,Math.PI*2);ctx.fill();}
 $('score').textContent=game.score;
 $('walls').textContent=walls?'Wände: AN':'Wände: AUS';$('walls').setAttribute('aria-pressed',String(walls));
 $('wall-hint').textContent=['running','paused'].includes(game.status)?'Moduswechsel setzt den aktuellen Run zurück.':walls?'Klassisch: Am Rand ist Schluss.':'Ohne Wände: Am Rand geht’s gegenüber weiter.';
 canvas.parentElement.classList.toggle('wrap',!walls);$('leader-rules').textContent=walls?'KLASSISCH':'OHNE WÄNDE';
 const labels={ready:'Bereit?',running:'Unterwegs',paused:'Pause',over:'Runde beendet',won:'Geschafft!'};
 $('state').textContent=labels[game.status];$('overlay').hidden=game.status==='running';
 $('overlay-title').textContent={ready:'Los geht’s.',paused:'Kurz durchatmen.',over:'Noch eine Runde?',won:'Alles eingesammelt!'}[game.status]||'';
 $('overlay-text').textContent=game.status==='ready'?(walls?'Futter schnappen. Wände meiden.':'Keine Wände. Keine Ausreden.'):game.status==='paused'?'Mit „Weiter“ oder Leertaste fortsetzen.':`${game.score} Punkte gesammelt.`;
 $('start').textContent=game.status==='ready'?'Spiel starten':'Neustart';$('pause').disabled=!['running','paused'].includes(game.status);$('pause').textContent=game.status==='paused'?'Weiter':'Pause';
 $('initials-field').hidden=!['over','won'].includes(game.status);$('initials').disabled=saving||saved;
 $('save').hidden=!['over','won'].includes(game.status);$('save').disabled=saving||saved;
 $('save').textContent=saved?'Gespeichert':saving?'Wird gespeichert …':'Ergebnis speichern';
}
function pause(){if(game.status==='running')game={...game,status:'paused'};else if(game.status==='paused')game={...game,status:'running'};draw();}
$('start').onclick=()=>{game={...createGame(Math.random,walls),status:'running'};roundId=crypto.randomUUID();saving=false;saved=false;saveGeneration++;$('message').textContent='';canvas.focus();draw();};
$('walls').onclick=()=>{walls=!walls;game=createGame(Math.random,walls);roundId=null;saving=false;saved=false;saveGeneration++;$('message').textContent='';draw();refresh();};
$('pause').onclick=()=>{pause();canvas.focus();};
$('initials').addEventListener('input',()=>{$('initials').value=$('initials').value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);});
document.addEventListener('keydown',event=>{
 if(event.target instanceof HTMLInputElement)return;
 if(event.target instanceof HTMLButtonElement && event.key===' ')return;
 if(DIRECTIONS[event.key]){event.preventDefault();game=turn(game,DIRECTIONS[event.key]);}
 if(event.key===' '){event.preventDefault();pause();}
});
function autoPause(){if(game.status==='running'){game={...game,status:'paused'};draw();}}
window.addEventListener('blur',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});
setInterval(()=>{if(game.status==='running'){game=step(game);draw();}},140);
async function request(path,options={}){const response=await fetch(path,{...options,signal:AbortSignal.timeout(7000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Die Bestenliste ist gerade nicht erreichbar.');return result;}
let refreshGeneration=0;
async function refresh(){const generation=++refreshGeneration;try{const data=await request(`/api/scores?rules=${walls?'classic':'wrap'}`);if(generation!==refreshGeneration)return;$('mode').hidden=true;$('mode').textContent='';$('leaders').replaceChildren();
 if(!data.scores.length){const row=document.createElement('li');row.className='empty';row.textContent='—';$('leaders').append(row);}
 data.scores.forEach(entry=>{const row=document.createElement('li'),name=document.createElement('span'),score=document.createElement('strong');name.className='initials';name.textContent=shortName(entry);score.textContent=entry.score;row.append(name,score);$('leaders').append(row);});
 }catch{if(generation===refreshGeneration){$('mode').hidden=false;$('mode').textContent='Highscores offline';}}}
function shortName(entry){if(/^[A-Z]{3}$/.test(entry.name))return entry.name;const value=parseInt(entry.roundId.slice(0,6),16);return [676,26,1].map(divisor=>String.fromCharCode(65+Math.floor(value/divisor)%26)).join('');}
$('refresh').onclick=refresh;
$('save').onclick=async()=>{if(saved||saving||!['over','won'].includes(game.status))return;const initials=$('initials').value.trim().toUpperCase();if(!/^[A-Z]{3}$/.test(initials)){$('message').textContent='Bitte drei Buchstaben eingeben.';$('initials').focus();return;}const generation=saveGeneration;saving=true;draw();try{const data=await request('/api/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({roundId,initials,score:game.score,rules:walls?'classic':'wrap'})});if(generation!==saveGeneration)return;saved=true;$('message').textContent=`Gespeichert: ${shortName(data.entry)}.`;await refresh();}catch(error){if(generation===saveGeneration)$('message').textContent='Speichern hat nicht geklappt. Du kannst es noch einmal versuchen.';}finally{if(generation===saveGeneration){saving=false;draw();}}};
draw();refresh();

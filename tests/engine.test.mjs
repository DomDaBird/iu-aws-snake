import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,step,turn,foodFor} from '../public/engine.js';
const running=()=>({...createGame(()=>0),status:'running'});
test('Wachstum und Punkte beim Fressen',()=>{const g=running();g.food=[11,10];const n=step(g,()=>0);assert.equal(n.score,1);assert.equal(n.snake.length,4);assert.ok(!n.snake.some(s=>s.join()===n.food.join()));assert.equal(g.snake.length,3);});
test('Gegenrichtung und mehrere Wechsel pro Tick werden verhindert',()=>{const g=running();assert.equal(turn(g,[-1,0]),g);const up=turn(g,[0,-1]);assert.equal(turn(up,[-1,0]),up);assert.deepEqual(step(up).snake[0],[10,9]);});
test('Rand- und Selbstkollision',()=>{const g=running();g.snake=[[19,10],[18,10],[17,10]];assert.equal(step(g).status,'over');g.snake=[[4,4],[5,4],[5,5],[4,5]];assert.equal(step(g).status,'over');});
test('Das freigegebene Schwanzfeld darf betreten werden',()=>{const g=running();g.snake=[[4,4],[4,5],[5,5],[5,4]];g.food=[0,0];assert.equal(step(g).status,'running');assert.deepEqual(step(g).snake[0],[5,4]);});
test('Pause verändert keinen Spielzustand',()=>{const g={...running(),status:'paused'};assert.equal(step(g),g);assert.equal(turn(g,[0,1]),g);});
test('Ohne Wände geht es an allen vier Rändern gegenüber weiter',()=>{
 for(const [head,direction,expected] of [[[19,10],[1,0],[0,10]],[[0,10],[-1,0],[19,10]],[[10,0],[0,-1],[10,19]],[[10,19],[0,1],[10,0]]]){
  const g={...createGame(()=>0,false),status:'running',snake:[head],direction,food:[5,5]};
  const n=step(g);assert.deepEqual(n.snake[0],expected);assert.equal(n.status,'running');assert.equal(n.score,0);
 }
});
test('Fressen und Selbstkollision funktionieren auch beim Randwechsel',()=>{
 const g={...createGame(()=>0,false),status:'running',snake:[[19,10],[18,10],[17,10]],food:[0,10]};
 const n=step(g);assert.equal(n.score,1);assert.equal(n.snake.length,4);assert.deepEqual(n.snake[0],[0,10]);
 assert.equal(step({...g,snake:[[19,10],[0,10],[1,10],[2,10]]}).status,'over');
});
test('Volles Feld endet als Sieg ohne Endlosschleife',()=>{const all=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++)all.push([x,y]);assert.equal(foodFor(all),null);const snake=[[18,19],...all.filter(([x,y])=>!(y===19&&(x===18||x===19)))];const g={...running(),snake,food:[19,19],score:396};const n=step(g);assert.equal(n.status,'won');assert.equal(n.score,397);assert.equal(n.snake.length,400);});

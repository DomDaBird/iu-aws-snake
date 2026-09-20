export const SIZE = 20;
export const DIRECTIONS = { ArrowUp: [0,-1], ArrowRight: [1,0], ArrowDown: [0,1], ArrowLeft: [-1,0] };
const same = (a,b) => a[0] === b[0] && a[1] === b[1];
export function foodFor(snake, random = Math.random) {
  const free = [];
  for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++) if(!snake.some(s=>same(s,[x,y]))) free.push([x,y]);
  return free.length ? free[Math.min(free.length-1,Math.floor(random()*free.length))] : null;
}
export function createGame(random = Math.random, walls = true) {
  const snake=[[10,10],[9,10],[8,10]];
  return {snake,walls,direction:[1,0],queued:null,food:foodFor(snake,random),score:0,status:'ready'};
}
export function turn(game, direction) {
  if(game.status!=='running' || game.queued || !direction) return game;
  if(same(direction,game.direction) || (direction[0]===-game.direction[0] && direction[1]===-game.direction[1])) return game;
  return {...game,queued:direction};
}
export function step(game, random = Math.random) {
  if(game.status!=='running') return game;
  const direction=game.queued || game.direction;
  const head=[game.snake[0][0]+direction[0],game.snake[0][1]+direction[1]];
  if(game.walls===false){head[0]=(head[0]+SIZE)%SIZE;head[1]=(head[1]+SIZE)%SIZE;}
  const eats=game.food && same(head,game.food);
  const body=eats ? game.snake : game.snake.slice(0,-1);
  if(head.some(v=>v<0 || v>=SIZE) || body.some(s=>same(s,head))) return {...game,direction,queued:null,status:'over'};
  const snake=[head,...game.snake]; if(!eats) snake.pop();
  const food=eats ? foodFor(snake,random) : game.food;
  return {...game,snake,direction,queued:null,food,score:game.score+(eats?1:0),status:food?'running':'won'};
}

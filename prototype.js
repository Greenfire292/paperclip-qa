const I18N = {
  'menu.run.title': 'Run',
  'menu.shop.title': 'Shop',
  'menu.rewards.title': 'Rewards',
  'menu.board.title': 'Board',
  'menu.bench.title': 'Bench',
  'menu.combatlog.title': 'Combat Log',
  'hud.phase.prep': 'Prep',
  'hud.phase.battle': 'Battle',
  'hud.phase.rewards': 'Rewards',
  'hud.phase.transition': 'Transition',
  'hud.shop.open': 'Open',
  'hud.shop.closed': 'Closed',
  'hud.event.unknown': 'Unknown combat event',
  'hud.events.fallback.no_data': 'No combat events were received; showing fallback state.',
  'hud.events.fallback.delayed': 'Combat events delayed; showing latest buffered state.',
  'hud.state.line': 'Round: {round} | Gold: {gold} | Crown: {crown}',
  'hud.readability.line': 'Phase: {phase} | Shop: {shop} | Synergy: {synergy}',
  'log.run.started': 'Run started. Protect the crown.',
  'log.need.unit': 'Need at least one placed unit.',
  'log.round.synergy': 'Round {round}{boss}. Synergy bonus: +{atk} atk / +{hp} hp.',
  'log.boss.tag': ' (Boss)',
  'log.defeated': '{name} defeated',
  'log.victory.gold': 'Victory. +{gold} gold.',
  'log.victory.boss': 'Boss defeated. Run clear.',
  'log.loss.crown': 'Loss. Crown -{dmg}.',
  'log.run.failed': 'Crown destroyed. Run failed.',
  'log.hit': 'T{tick}: {attacker} hits {target} for {value}'
};

function t(key, vars) {
  const template = I18N[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

const UNITS = [
  {name:'Squire', fam:'Guard', hp:36, atk:7, cost:2},
  {name:'Pikewall', fam:'Guard', hp:42, atk:5, cost:3},
  {name:'Ash Archer', fam:'Rangers', hp:24, atk:11, cost:3},
  {name:'Moss Scout', fam:'Rangers', hp:22, atk:9, cost:2},
  {name:'Hex Adept', fam:'Mystics', hp:20, atk:13, cost:4},
  {name:'Spark Monk', fam:'Mystics', hp:18, atk:10, cost:3},
  {name:'Wolfrider', fam:'Raiders', hp:28, atk:10, cost:3},
  {name:'Knife Dancer', fam:'Raiders', hp:20, atk:12, cost:3},
];
const FAMILIES = ['Bandits','Undead','Beasts'];
const enemyForRound = (round)=> {
  if (round === 4) return [{name:'Crown Eater (Boss)', hp:180, atk:16}];
  const fam = FAMILIES[(round-1)%FAMILIES.length];
  const n = 2 + round;
  return Array.from({length:n}, (_,i)=>({name:`${fam} ${i+1}`, hp:16 + round*6, atk:4 + round*2}));
};

const state = {
  run:false,
  round:0,
  gold:0,
  crown:40,
  board:Array(12).fill(null),
  bench:[],
  shop:[],
  rewards:[],
  inCombat:false,
  shopOpen:true,
  eventFeed:[]
};
const el = (id)=>document.getElementById(id);
const log = (tMsg, cls='')=> { const d = document.createElement('div'); d.textContent=tMsg; if (cls) d.className=cls; el('log').appendChild(d); el('log').scrollTop = el('log').scrollHeight; };
const copy = (u)=>JSON.parse(JSON.stringify(u));
const rng = (n)=>Math.floor(Math.random()*n);

function startRun(){ state.run=true; state.round=1; state.gold=10; state.crown=40; state.inCombat=false; state.shopOpen=true; state.eventFeed=[]; state.board.fill(null); state.bench=[]; log(t('log.run.started')); rollShop(); render(); }
function restart(){ el('log').innerHTML=''; startRun(); }
function rollShop(){ state.shop = Array.from({length:3}, ()=>copy(UNITS[rng(UNITS.length)])); state.shopOpen = true; render(); }
function buy(i){ const u=state.shop[i]; if(!u||state.gold<u.cost||state.bench.length>=8) return; state.gold-=u.cost; state.bench.push(copy(u)); state.shop[i]=null; render(); }
function placeFromBench(bi, ci){ if(state.board[ci]) return; state.board[ci]=state.bench.splice(bi,1)[0]; render(); }
function toggleCell(i){ if(state.board[i]) state.bench.push(state.board[i]), state.board[i]=null; render(); }
function synergyBonus(units){ const c = {}; units.forEach(u=>c[u.fam]=(c[u.fam]||0)+1); let atk=0,hp=0; for (const fam in c){ if(c[fam]>=2){ atk+=2; hp+=4; } if(c[fam]>=3){ atk+=3; hp+=6; } } return {atk,hp,counts:c}; }
function rewardChoices(){ return [
  {txt:'+6 Crown', apply:()=>state.crown+=6},
  {txt:'+4 Gold', apply:()=>state.gold+=4},
  {txt:'All placed units +2 ATK this round', apply:()=>state.board.forEach(u=>u&&(u.atk+=2))},
].sort(()=>Math.random()-0.5).slice(0,2); }

function addCombatEvent(type, message, payload, ts) {
  state.eventFeed.push({ type, message, payload: payload || null, ts });
}

function flushCombatEvents() {
  const nowMs = Date.now();
  const events = UIEventPipeline.processCombatEvents(state.eventFeed, nowMs);
  state.eventFeed = [];

  events.forEach((evt) => {
    const prefix = `[${new Date(evt.ts).toISOString().slice(11, 19)}]`;
    if (evt.type === 'fallback') {
      log(`${prefix} ${t(evt.message)}`, 'bad');
      return;
    }
    const payload = evt.payload || {};
    if (evt.message === 'log.hit') {
      log(`${prefix} ${t(evt.message, payload)}`);
      return;
    }
    log(`${prefix} ${t(evt.message, payload)}`, evt.type === 'defeat_enemy' ? 'good' : evt.type === 'defeat_ally' ? 'bad' : '');
  });
}

function combat(){
  const myUnits = state.board.filter(Boolean).map(copy);
  state.inCombat = true;
  state.shopOpen = false;

  if (!state.run || myUnits.length===0) {
    addCombatEvent('error', 'log.need.unit', null);
    flushCombatEvents();
    state.inCombat = false;
    render();
    return;
  }

  const enemies = enemyForRound(state.round).map(copy);
  const s = synergyBonus(myUnits);
  myUnits.forEach(u=>{u.atk+=s.atk; u.hp+=s.hp;});
  addCombatEvent('round_start', 'log.round.synergy', { round: state.round, boss: state.round === 4 ? t('log.boss.tag') : '', atk: s.atk, hp: s.hp });

  let tTick=1;
  while(myUnits.some(u=>u.hp>0)&&enemies.some(e=>e.hp>0)&&tTick<80){
    const a = myUnits.find(u=>u.hp>0), d = enemies.find(e=>e.hp>0);
    d.hp -= a.atk;
    addCombatEvent('hit', 'log.hit', { tick: tTick, attacker: a.name, target: d.name, value: a.atk });
    if(d.hp<=0) addCombatEvent('defeat_enemy', 'log.defeated', { name: d.name });

    const ea = enemies.find(e=>e.hp>0), md = myUnits.find(u=>u.hp>0);
    if(ea&&md){
      md.hp -= ea.atk;
      addCombatEvent('hit', 'log.hit', { tick: tTick, attacker: ea.name, target: md.name, value: ea.atk });
      if(md.hp<=0) addCombatEvent('defeat_ally', 'log.defeated', { name: md.name });
    }
    tTick++;
  }

  const win = enemies.every(e=>e.hp<=0);
  if (win){
    const g = state.round===4 ? 0 : 4 + state.round;
    state.gold += g;
    addCombatEvent('result', state.round===4 ? 'log.victory.boss' : 'log.victory.gold', { gold: g });
    if(state.round<4){ state.rewards = rewardChoices(); }
    state.round++;
  } else {
    const dmg = Math.max(2, enemies.filter(e=>e.hp>0).length*2);
    state.crown -= dmg;
    addCombatEvent('result', 'log.loss.crown', { dmg });
    if(state.crown<=0){ state.run=false; addCombatEvent('result', 'log.run.failed', null); }
  }

  flushCombatEvents();
  state.inCombat = false;
  render();
}

function pickReward(i){ const r=state.rewards[i]; if(!r) return; r.apply(); state.rewards=[]; rollShop(); render(); }

function formatSynergy(synergyCounts) {
  const entries = Object.entries(synergyCounts);
  if (entries.length === 0) return '-';
  return entries.map(([fam, count]) => `${fam}:${count}`).join(', ');
}

function render(){
  const vm = UIEventPipeline.buildHudViewModel(state);
  el('state').textContent = t('hud.state.line', { round: vm.round || '-', gold: vm.gold, crown: vm.crownHealth });
  el('hud-readability').textContent = t('hud.readability.line', {
    phase: t(vm.roundPhase),
    shop: t(vm.shopState),
    synergy: formatSynergy(vm.synergy)
  });

  el('shop').innerHTML=''; state.shop.forEach((u,i)=>{ const d=document.createElement('div'); d.className='shop-item'; d.innerHTML = u ? `<span>${u.name} (${u.fam}) ${u.cost}g</span><button>Buy</button>` : '<span>Sold</span>'; if(u) d.querySelector('button').onclick=()=>buy(i); el('shop').appendChild(d); });
  el('board').innerHTML=''; state.board.forEach((u,i)=>{ const c=document.createElement('button'); c.className='cell'+(u?' unit':''); c.textContent=u?`${u.name}\n${u.fam}\nHP${u.hp} ATK${u.atk}`:'(empty)'; c.onclick=()=>toggleCell(i); el('board').appendChild(c); });
  el('bench').innerHTML=''; state.bench.forEach((u,i)=>{ const b=document.createElement('button'); b.textContent=`${u.name} (${u.cost}g)`; b.onclick=()=>{ const cell = state.board.findIndex(x=>!x); if(cell>=0) placeFromBench(i, cell); }; el('bench').appendChild(b); });
  el('rewards').innerHTML=''; state.rewards.forEach((r,i)=>{ const b=document.createElement('button'); b.textContent=r.txt; b.onclick=()=>pickReward(i); el('rewards').appendChild(b); });
}

el('start').onclick=startRun;
el('restart').onclick=restart;
el('fight').onclick=combat;
el('reroll').onclick=()=>{ if(state.gold>=1){state.gold-=1; rollShop();} render(); };
render();

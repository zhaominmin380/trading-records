/* Official rule snapshots. Saved accounts keep their own editable copy. */
const RULE_SOURCES = {
  evaluation: 'https://help.tradeify.co/en/articles/12853921-select-evaluation-accounts',
  payout: 'https://help.tradeify.co/en/articles/12853966-select-flex-and-select-daily-payout-policies',
  drawdown: 'https://help.tradeify.co/en/articles/10495897-rules-trailing-max-drawdowns'
};
const RULE_CHECKED = '2026-10-19';
const RULE_CATALOG = {
  tradeify: {
    name: 'Tradeify',
    products: {select: {name: 'Select', sizes: {
      25000: {target:1500, drawdown:1000, evaluationMicro:10, startMicro:10, maxMicro:20, winningDayProfit:100, dailyLoss:500, dailyDrawdown:1000, buffer:1100, flexCap:1250, legacyFlexCap:1250, dailyCap:600, legacyDailyCap:600, scaleTiers:'1500:20'},
      50000: {target:3000, drawdown:2000, evaluationMicro:40, startMicro:20, maxMicro:40, winningDayProfit:150, dailyLoss:1000, dailyDrawdown:2000, buffer:2100, flexCap:2500, legacyFlexCap:3000, dailyCap:1250, legacyDailyCap:1000, scaleTiers:'1500:30,2000:40'},
      150000: {target:9000, drawdown:4500, evaluationMicro:120, startMicro:30, maxMicro:120, winningDayProfit:250, dailyLoss:1750, dailyDrawdown:3500, buffer:3600, flexCap:4500, legacyFlexCap:5000, dailyCap:2500, legacyDailyCap:2500, scaleTiers:'1500:40,2000:50,3000:80,4500:120'}
    }}}
  }
};
const RULE_NUMBERS = ['balance','target','daily','days','drawdown','consistencyLimit','startMicro','maxMicro','winningDays','winningDayProfit','buffer','payoutMin','payoutCap','payoutSharePercent','payoutCycleMultiplier','profitSplit','lockOffset'];
const NULLABLE_RULES = ['target','daily','drawdown','consistencyLimit','payoutMin','payoutCap','payoutSharePercent','payoutCycleMultiplier','profitSplit','lockOffset'];
RULE_CATALOG.tradeify.products.select.makeRules = tradeifySelectRules;
function presetRules(selection) {
  const product=RULE_CATALOG[selection.firm]?.products[selection.product];
  const row=product?.sizes[selection.size];
  if(!row||typeof product.makeRules!=='function')throw Error('找不到這組帳號規則');
  return product.makeRules(selection,row);
}
function tradeifySelectRules(selection,row) {
  const evaluation=selection.stage==='evaluation',daily=!evaluation&&selection.payoutPolicy==='daily',legacy=selection.payoutVersion==='legacy';
  return {
    balance:Number(selection.size),
    target:evaluation?(Number(selection.size)===50000&&selection.evaluationVersion==='legacy50k'?2500:row.target):null,
    daily:daily?row.dailyLoss:null,
    days:evaluation?(selection.consistencyOption==='addon'?2:3):0,
    drawdown:daily?row.dailyDrawdown:row.drawdown,drawdownMode:'eod',
    consistencyLimit:evaluation?(selection.consistencyOption==='addon'?50:40):null,
    startMicro:evaluation?row.evaluationMicro:row.startMicro,
    maxMicro:evaluation?row.evaluationMicro:row.maxMicro,
    winningDays:!evaluation&&!daily?5:0,winningDayProfit:!evaluation&&!daily?row.winningDayProfit:0,
    buffer:daily?row.buffer:0,payoutMin:evaluation?null:250,
    payoutCap:evaluation?null:daily?(legacy?row.legacyDailyCap:row.dailyCap):(legacy?row.legacyFlexCap:row.flexCap),
    payoutSharePercent:!evaluation&&!daily?50:null,payoutCycleMultiplier:daily?2:null,
    profitSplit:evaluation?null:90,lockOffset:evaluation?null:100,lockOnPayout:!evaluation,
    scaleTiers:evaluation?'':row.scaleTiers,checkedAt:RULE_CHECKED
  };
}
function defaultAccount(id='account-default') {
  const selection={firm:'tradeify',product:'select',size:50000,stage:'evaluation',payoutPolicy:'flex',payoutVersion:'current',evaluationVersion:'current',consistencyOption:'standard'};
  return {id,name:'Tradeify Select 50K · 考試',...selection,...presetRules(selection)};
}
function validAccount(account) {
  if(!account||typeof account.id!=='string'||!account.id||typeof account.name!=='string'||!account.name.trim()||account.name.length>80)return false;
  if(!RULE_CATALOG[account.firm]?.products[account.product]?.sizes[account.size]||!['evaluation','funded'].includes(account.stage))return false;
  if(!['flex','daily'].includes(account.payoutPolicy)||!['current','legacy'].includes(account.payoutVersion)||!['current','legacy50k'].includes(account.evaluationVersion)||!['standard','addon'].includes(account.consistencyOption))return false;
  if(!['eod','fixed','intraday'].includes(account.drawdownMode)||typeof account.lockOnPayout!=='boolean')return false;
  if(!RULE_NUMBERS.every(key=>NULLABLE_RULES.includes(key)&&account[key]===null||Number.isFinite(account[key])&&account[key]>=0))return false;
  if(account.balance<=0||account.startMicro<1||account.maxMicro<account.startMicro||!['days','startMicro','maxMicro','winningDays'].every(k=>Number.isInteger(account[k])))return false;
  if(['consistencyLimit','payoutSharePercent','profitSplit'].some(k=>account[k]!==null&&(account[k]<=0||account[k]>100)))return false;
  if(['target','daily','drawdown','payoutMin','payoutCap','payoutCycleMultiplier'].some(k=>account[k]!==null&&account[k]<=0))return false;
  if(account.payoutMin!==null&&account.payoutCap!==null&&account.payoutMin>account.payoutCap)return false;
  if(typeof account.scaleTiers!=='string'||account.scaleTiers.length>500)return false;
  const tiers=parseScaling(account.scaleTiers);
  return tiers!==null&&tiers.every(([profit,micro],i)=>micro>=account.startMicro&&micro<=account.maxMicro&&(i===0||profit>tiers[i-1][0]&&micro>=tiers[i-1][1]));
}
function parseScaling(text) {
  if(!text.trim())return [];
  const tiers=text.split(',').map(part=>part.trim().split(':').map(Number));
  return tiers.every(t=>t.length===2&&Number.isFinite(t[0])&&t[0]>0&&Number.isInteger(t[1])&&t[1]>0)?tiers:null;
}

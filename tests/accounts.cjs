const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const dist=path.join(__dirname,'../dist'),html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
function app(saved){
 const nodes={},events={},nav=[];
 function node(attrs={}){const handlers={},classes=new Set();let content='',value=attrs.value||'';return {type:attrs.type||'',name:attrs.name||'',dataset:{},checked:false,elements:{},style:{},firstChild:{textContent:''},classList:{add:c=>classes.add(c),toggle(c,force){if(force===undefined)force=!classes.has(c);force?classes.add(c):classes.delete(c)},contains:c=>classes.has(c)},get innerHTML(){return content},set innerHTML(text){content=text;if(attrs.tag==='select'){const options=[...text.matchAll(/<option value="([^"]*)"/g)].map(m=>m[1]);this.options=options;if(!options.includes(value))value=options[0]||''}},get value(){return value},set value(v){v=String(v);value=attrs.tag==='select'&&this.options&&!this.options.includes(v)?'':v},setAttribute(k,v){this[k]=v},addEventListener(k,fn){(handlers[k]??=[]).push(fn)},dispatch(k){for(const fn of handlers[k]||[])fn({target:this})},showModal(){this.open=true},close(){this.open=false},reset(){},focus(){}}}
 for(const m of html.matchAll(/<([\w]+)\b([^>]*)>/g)){const attrs={tag:m[1]};for(const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g))attrs[a[1]]=a[2];if(attrs.id)nodes['#'+attrs.id]=node(attrs);if(attrs['data-page']){const n=node(attrs);n.dataset.page=attrs['data-page'];nav.push(n)}}
 for(const m of html.matchAll(/<form id="([^"]+)"[^>]*>([\s\S]*?)<\/form>/g)){const f=nodes['#'+m[1]];for(const field of m[2].matchAll(/<(input|select|textarea)\b([^>]*)(?:>([\s\S]*?)<\/\1>)?/g)){const attrs={tag:field[1]};for(const a of field[2].matchAll(/([\w-]+)="([^"]*)"/g))attrs[a[1]]=a[2];if(!attrs.name)continue;const n=attrs.id?nodes['#'+attrs.id]:node(attrs);if(attrs.tag==='select')n.innerHTML=field[3]||'';f.elements[attrs.name]=n;}}
 nodes['.brand']=node();nodes['.toolbar']=node();
 const storage={};if(saved)storage['edgebook-v1']=JSON.stringify(saved);
 const context={document:{querySelector:s=>{if(!nodes[s])throw Error('Missing DOM selector '+s);return nodes[s]},querySelectorAll:s=>s==='[data-page]'?nav:[],addEventListener:(k,fn)=>events[k]=fn},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},location:{hash:'#overview'},window:{addEventListener:(k,fn)=>events[k]=fn},Date,console,setTimeout:()=>1,clearTimeout,crypto:{randomUUID:()=> 'generated-'+Math.random().toString(16).slice(2)},FormData:class{constructor(f){return Object.entries(f.elements).filter(([,el])=>el.type!=='checkbox').map(([k,el])=>[k,el.value])[Symbol.iterator]()}},confirm:()=>true};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(dist,'rules.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(dist,'app.js'),'utf8'),context);
 return {run:code=>vm.runInContext(code,context),nodes,storage,context,events};
}
const a=app();
a.context.assert=assert;
a.run(`
for(const size of [25000,50000,150000])for(const stage of ['evaluation','funded'])for(const payoutPolicy of ['flex','daily'])for(const payoutVersion of ['current','legacy']){
const account={...defaultAccount(),size,stage,payoutPolicy,payoutVersion};Object.assign(account,presetRules(account));assert.equal(validAccount(account),true,JSON.stringify(account));
if(stage==='evaluation'){assert.equal(account.daily,null);assert.equal(account.consistencyLimit,40);assert.equal(account.days,3);assert.equal(account.payoutCap,null)}else assert.equal(account.consistencyLimit,null);
}
assert.equal(presetRules({...defaultAccount(),size:50000,evaluationVersion:'legacy50k'}).target,2500);
assert.equal(presetRules({...defaultAccount(),consistencyOption:'addon'}).days,2);
assert.equal(presetRules({...defaultAccount(),size:25000}).maxMicro,10);
assert.equal(presetRules({...defaultAccount(),size:150000,stage:'funded',payoutPolicy:'daily'}).drawdown,3500);
assert.equal(presetRules({...defaultAccount(),stage:'funded',payoutPolicy:'flex',payoutVersion:'current'}).payoutCap,2500);
assert.equal(presetRules({...defaultAccount(),stage:'funded',payoutPolicy:'flex',payoutVersion:'legacy'}).payoutCap,3000);
assert.equal(presetRules({...defaultAccount(),stage:'funded',payoutPolicy:'daily',payoutVersion:'current'}).payoutCap,1250);
assert.equal(presetRules({...defaultAccount(),stage:'funded',payoutPolicy:'daily',payoutVersion:'legacy'}).payoutCap,1000);
openSettings(true);const f=$('#settingsForm');f.elements.name.value='Daily 150K';f.elements.stage.value='funded';f.elements.size.value='150000';f.elements.payoutPolicy.value='daily';applyPreset();
assert.equal(f.elements.daily.value,'1750');assert.equal(f.elements.buffer.value,'3600');assert.equal(f.elements.target.value,'');
f.elements.daily.value='1234';f.elements.payoutCap.value='2000';$('#settingsForm').onsubmit({preventDefault(){}});
assert.equal(state.accounts.length,2);assert.equal(activeAccount().daily,1234);assert.equal(activeAccount().payoutCap,2000);assert.equal(isCustomized(activeAccount()),true);assert.equal(state.accounts.find(a=>a.id==='account-default').daily,null);
openSettings();assert.equal(f.elements.daily.value,'1234');assert.equal(f.elements.payoutCap.value,'2000');
const secondId=state.activeAccountId;
const t={id:'t1',accountId:secondId,date:dateString(today),side:'long',qty:2,entry:25000,exit:25010,fee:4,note:'review',charts:[]};state.trades=[t];save();render();assert.ok($('#rows').innerHTML.includes('t1'));assert.ok($('#accountMetrics').innerHTML.includes('$1,234.00'));
state.activeAccountId='account-default';render();assert.ok(!$('#rows').innerHTML.includes('t1'));assert.ok($('#accountMetrics').innerHTML.includes('無限制'));
location.hash='#trade/t1';syncRoute();assert.equal(state.activeAccountId,secondId);assert.ok($('#detailContent').innerHTML.includes('Daily 150K'));assert.ok($('#detailContent').innerHTML.includes('36.00'));
assert.equal(validState({...state,trades:[{...t,accountId:'missing'}]}),false);
assert.equal(validAccount({...activeAccount(),daily:NaN}),false);assert.equal(validAccount({...activeAccount(),startMicro:200}),false);
assert.equal(validAccount({...activeAccount(),scaleTiers:'1500:1000'}),false);
openTrade();const tradeForm=$('#tradeForm');Object.entries({id:'',accountId:secondId,date:dateString(today),side:'long',qty:1,entry:100,exit:101,fee:0,note:'new trade'}).forEach(([k,v])=>tradeForm.elements[k].value=v);draftCharts=[{name:'chart.png',data:'data:image/png;base64,iVBORw0KGgo='}];tradeForm.onsubmit({preventDefault(){},target:tradeForm});
assert.equal(state.trades.length,2);assert.equal(state.trades[1].accountId,secondId);assert.equal(state.trades[1].charts.length,1);assert.equal(state.trades[1].strategy,undefined);
const originalSetter=localStorage.setItem,accountCount=state.accounts.length,activeBefore=state.activeAccountId;
openSettings(true);$('#settingsForm').elements.name.value='Quota test';localStorage.setItem=()=>{throw Error('quota')};$('#settingsForm').onsubmit({preventDefault(){}});assert.equal(state.accounts.length,accountCount);assert.equal(state.activeAccountId,activeBefore);localStorage.setItem=originalSetter;

`);
const persisted=JSON.parse(a.storage['edgebook-v1']);const b=app(persisted);assert.equal(b.run('state.accounts.length'),2);assert.equal(b.run('state.accounts.find(a=>a.name==="Daily 150K").daily'),1234);
const legacy={settings:{name:'Original',balance:50000,target:2500,daily:900,days:5},trades:[{id:'legacy-t',date:'2026-10-10',side:'long',qty:1,entry:100,exit:101,fee:0,strategy:'old',note:'old review'}]};const c=app(legacy);assert.equal(c.run('state.accounts[0].target'),2500);assert.equal(c.run('state.accounts[0].daily'),900);assert.equal(c.run('state.trades[0].accountId'),'account-legacy');assert.equal(c.run('state.trades[0].strategy'),'old');assert.equal(c.run('validState(state)'),true);assert.equal(c.run('state.accounts[0].drawdown'),null);
console.log('PASS: trade creation with account/images, storage-failure rollback, all preset combinations, versions, null limits, auto-fill, manual overrides, independent accounts, account-filtered metrics/trades, detail routing, persistence, invalid imports, legacy migration');

const roundTrip=app(persisted);assert.equal(roundTrip.run('state.trades[1].charts.length'),1);assert.equal(roundTrip.run('validState(state)'),true);
console.log('PASS: saved records and chart images survive reload');

a.run(`
const sample={id:'spec',date:dateString(today),side:'long',qty:1,entry:100,exit:100.25,fee:0,note:''};
for(const [symbol,expected] of [['NQ',5],['MNQ',0.5],['ES',12.5],['MES',1.25]]){
assert.equal(pnl({...sample,symbol}),expected);assert.equal(pnl({...sample,symbol,side:'short'}),-expected);assert.equal(validTrade({...sample,symbol}),true);
assert.equal(validTrade({...sample,symbol,exit:100.1}),false);
}
assert.equal(pnl({...sample,symbol:'GC',entry:2650.1,exit:2650.3,qty:2,fee:4}),36);
assert.equal(pnl({...sample,symbol:'GC',entry:2650.1,exit:2650.3,qty:2,fee:4,side:'short'}),-44);
assert.equal(validTrade({...sample,symbol:'GC',entry:2650.1,exit:2650.3}),true);
assert.equal(validTrade({...sample,symbol:'GC',exit:100.25}),false);
assert.equal(validTrade({...sample,symbol:'INVALID'}),false);assert.equal(validTrade({...sample,symbol:'toString'}),false);
assert.equal(pnl(sample),0.5);
openTrade();const form=$('#tradeForm');form.elements.symbol.value='GC';form.elements.entry.value='2650.1';form.elements.exit.value='2650.3';form.elements.qty.value='2';form.elements.fee.value='4';estimate();assert.equal(form.elements.entry.step,'0.1');assert.equal(form.elements.exit.step,'0.1');assert.equal($('#estimate').textContent,'+$36.00');assert.ok($('#contractSpec').textContent.includes('GC'));
form.elements.id.value='';form.elements.date.value=dateString(today);form.elements.side.value='long';form.elements.note.value='Gold trade';form.onsubmit({preventDefault(){},target:form});const gold=state.trades.find(t=>t.symbol==='GC');assert.ok(gold);openTrade(gold);assert.equal(form.elements.symbol.value,'GC');assert.equal(form.elements.entry.step,'0.1');
location.hash='#trade/'+gold.id;syncRoute();assert.ok($('#detailContent').innerHTML.includes('GC'));assert.ok($('#title').textContent.endsWith('GC'));
$('#symbolFilter').value='GC';render();assert.ok($('#rows').innerHTML.includes(gold.id));assert.ok(!$('#rows').innerHTML.includes('data-open="t1"'));
$('#symbolFilter').value='all';render();assert.ok($('#rows').innerHTML.includes('data-open="t1"'));
`);
assert.equal(c.run('state.trades[0].symbol'),'MNQ');
console.log('PASS: all instrument multipliers, long/short P&L, GC decimals, tick validation, selection/edit persistence, list filter, legacy MNQ migration');
const symbolsReload=app(JSON.parse(a.storage['edgebook-v1']));assert.equal(symbolsReload.run('state.trades.find(t=>t.symbol==="GC").entry'),2650.1);

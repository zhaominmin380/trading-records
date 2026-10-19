const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
// Preserve the storage key for existing accounts and trading records.
const KEY='edgebook-v1',today=new Date(),dateString=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const INSTRUMENTS=Object.freeze({
  NQ:{name:'E-mini Nasdaq-100',pointValue:20,tick:0.25},
  MNQ:{name:'Micro E-mini Nasdaq-100',pointValue:2,tick:0.25},
  ES:{name:'E-mini S&P 500',pointValue:50,tick:0.25},
  MES:{name:'Micro E-mini S&P 500',pointValue:5,tick:0.25},
  GC:{name:'Gold',pointValue:100,tick:0.1}
});
function tradeSymbol(t){return t.symbol===undefined?'MNQ':t.symbol}
function instrument(t){const symbol=tradeSymbol(t);return Object.hasOwn(INSTRUMENTS,symbol)?INSTRUMENTS[symbol]:null}
function validPrice(price,spec){return Number.isFinite(price)&&price>0&&Math.abs(price/spec.tick-Math.round(price/spec.tick))<1e-7}
let page='overview',range='month',month=new Date(today.getFullYear(),today.getMonth(),1);
let activeTradeId=null,draftCharts=[],uploadGeneration=0,uploading=false;
let state=normalizeState({trades:[],accounts:[defaultAccount()],activeAccountId:'account-default'});
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&validState(saved))state=normalizeState(saved)}catch{}
function activeAccount(){return state.accounts.find(a=>a.id===state.activeAccountId)}
function validState(data){
if(!data||!Array.isArray(data.trades)||!data.trades.every(validTrade)||new Set(data.trades.map(t=>t.id)).size!==data.trades.length)return false;
if(Array.isArray(data.accounts)){
const ids=new Set(data.accounts.map(a=>a?.id));return data.accounts.length>0&&data.accounts.every(validAccount)&&ids.size===data.accounts.length&&ids.has(data.activeAccountId)&&data.trades.every(t=>ids.has(t.accountId));
}
return data.settings&&typeof data.settings.name==='string'&&['balance','target','daily','days'].every(k=>Number.isFinite(data.settings[k])&&data.settings[k]>0);
}
function normalizeState(data){
if(Array.isArray(data.accounts))return {...data,version:2,trades:data.trades.map(t=>({...t,symbol:tradeSymbol(t)})),settings:data.accounts.find(a=>a.id===data.activeAccountId)};
const legacy={...defaultAccount('account-legacy'),...data.settings,drawdown:null,consistencyLimit:null,checkedAt:null};
return {version:2,accounts:[legacy],activeAccountId:legacy.id,settings:legacy,trades:data.trades.map(t=>({...t,accountId:legacy.id,symbol:tradeSymbol(t)}))};
}
function validTrade(t){return t&&typeof t.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)&&!isNaN(Date.parse(t.date))&&['long','short'].includes(t.side)&&Number.isInteger(t.qty)&&t.qty>0&&t.qty<=1000&&typeof tradeSymbol(t)==='string'&&!!instrument(t)&&['entry','exit'].every(k=>validPrice(t[k],instrument(t)))&&Number.isFinite(t.fee)&&t.fee>=0&&(t.strategy===undefined||typeof t.strategy==='string')&&typeof t.note==='string'&&(t.charts===undefined||(Array.isArray(t.charts)&&t.charts.length<=3&&t.charts.every(validChart)))}
function validChart(c){return c&&typeof c.name==='string'&&c.name.length<=200&&typeof c.data==='string'&&c.data.length<=1024100&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(c.data)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true}catch{toast('儲存失敗，請先匯出備份並檢查瀏覽器儲存空間。');return false}}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pnl=t=>{const spec=instrument(t);if(!spec)return NaN;const cents=Math.round(t.exit*100)-Math.round(t.entry*100);return Math.round((cents/100*(t.side==='long'?1:-1)*t.qty*spec.pointValue-t.fee)*100)/100};
const money=(n,sign=false)=>(n<0?'−':sign&&n>0?'+':'')+'$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function all(){return state.trades.filter(t=>t.accountId===state.activeAccountId)}function selected(){const prefix=dateString(month).slice(0,7);return all().filter(t=>range==='all'||t.date.startsWith(prefix)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))}
function toast(s){$('#toast').textContent=s;$('#toast').style.opacity=1;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').style.opacity=0,3500)}
function render(){state.settings=activeAccount();renderAccountSelectors();const trades=selected(),net=trades.reduce((s,t)=>s+pnl(t),0),wins=trades.filter(t=>pnl(t)>0),losses=trades.filter(t=>pnl(t)<0),days=new Set(trades.map(t=>t.date)).size;
const grouped={};trades.forEach(t=>grouped[t.date]=(grouped[t.date]||0)+pnl(t));const bestDay=Math.max(0,...Object.values(grouped)),consistency=net>0?bestDay/net*100:null;
$('#monthLabel').textContent=`${month.getFullYear()} 年 ${month.getMonth()+1} 月`;$('#calendarMonth').textContent=`${month.getFullYear()}.${String(month.getMonth()+1).padStart(2,'0')}`;
$('#stats').innerHTML=[['淨損益',money(net,true),`共 ${trades.length} 筆已平倉交易`,net>=0?'positive':'negative','↗'],['交易勝率',trades.length?`${(wins.length/trades.length*100).toFixed(1)}<small style="font-size:17px">%</small>`:'—',`${wins.length} 勝 / ${losses.length} 負 / ${trades.length-wins.length-losses.length} 平`,'','◎'],['每天平均交易次數',days?`${(trades.length/days).toFixed(1)}<small style="font-size:13px;margin-left:8px">筆／天</small>`:'—',`總交易筆數 ÷ 有交易的天數（${days} 天）`,'','⇄'],['交易一致性',consistency===null?'—':`${consistency.toFixed(1)}<small style="font-size:17px">%</small>`,consistency===null?'期間淨獲利大於 0 時顯示':'最高單日淨獲利 ÷ 總淨獲利 · 越低越分散','','▦']].map(([a,b,c,d,e])=>`<article class="stat"><div class="stat-label">${a}<span>${e}</span></div><div class="stat-value ${d}">${b}</div><div class="stat-foot">${c}</div></article>`).join('');
const settings=state.settings,allNet=all().reduce((s,t)=>s+pnl(t),0),allDays=new Set(all().map(t=>t.date)).size,todayNet=all().filter(t=>t.date===dateString(today)).reduce((s,t)=>s+pnl(t),0),dailyLoss=Math.max(0,-todayNet);
$('#accountName').textContent=settings.name;
$('#accountRuleBadge').textContent=accountLabel(settings)+(isCustomized(settings)?' · 自訂':'');
const accountDaily={};all().forEach(t=>accountDaily[t.date]=(accountDaily[t.date]||0)+pnl(t));
const accountBest=Math.max(0,...Object.values(accountDaily)),accountConsistency=allNet>0?accountBest/allNet*100:null;
const metrics=[['帳戶淨值',money(settings.balance+allNet),null]];
if(settings.target!==null)metrics.push(['考試獲利目標',money(allNet)+' / '+money(settings.target),allNet/settings.target*100]);
if(settings.days>0)metrics.push(['最低交易天數',allDays+' / '+settings.days+' 天',allDays/settings.days*100]);
metrics.push(['每日虧損限制',settings.daily===null?'無限制':money(dailyLoss)+' / '+money(settings.daily),settings.daily===null?null:dailyLoss/settings.daily*100]);
metrics.push(['最大回撤 · '+({eod:'收盤追蹤',fixed:'固定',intraday:'盤中追蹤'}[settings.drawdownMode]),settings.drawdown===null?'無':money(settings.drawdown),null]);
metrics.push(['一致性上限',settings.consistencyLimit===null?'不適用':(accountConsistency===null?'—':accountConsistency.toFixed(1)+'%')+' / '+settings.consistencyLimit+'%',null]);
metrics.push(['Micro 起始 / 最高口數',settings.startMicro+' / '+settings.maxMicro,null]);
if(settings.stage==='funded'){
if(settings.winningDays>0)metrics.push(['每輪獲利日條件',settings.winningDays+' 天，每天 ≥ '+money(settings.winningDayProfit),null]);
if(settings.payoutCap!==null)metrics.push(['單次出金上限',money(settings.payoutCap),null]);
if(settings.buffer>0)metrics.push(['出金安全墊',money(settings.buffer),null]);
}
$('#accountMetrics').innerHTML=metrics.map(([label,value,pct])=>'<div class="metric"><div><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>'+(pct===null?'':'<div class="bar"><i style="width:'+Math.min(100,Math.max(0,pct))+'%"></i></div>')+'</div>').join('');

const first=new Date(month.getFullYear(),month.getMonth(),1).getDay(),last=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();let html=['日','一','二','三','四','五','六'].map(d=>`<div class="weekday">${d}</div>`).join('');html+='<div class="day blank"></div>'.repeat(first);for(let d=1;d<=last;d++){const date=dateString(new Date(month.getFullYear(),month.getMonth(),d)),ts=all().filter(t=>t.date===date),value=ts.reduce((s,t)=>s+pnl(t),0);html+=`<div class="day ${ts.length?(value>=0?'gain':'loss'):''} ${date===dateString(today)?'today':''}">${d}${ts.length?`<small>${ts.length} 筆</small><strong class="${value>=0?'positive':'negative'}">${money(value,true)}</strong>`:''}</div>`}html+='<div class="day blank"></div>'.repeat((7-(first+last)%7)%7);$('#calendar').innerHTML=html;
const query=$('#search').value.trim().toLowerCase(),filtered=trades.slice().reverse().filter(t=>((!$('#symbolFilter').value||$('#symbolFilter').value==='all')||tradeSymbol(t)===$('#symbolFilter').value)&&(tradeSymbol(t)+t.note+t.date+t.side).toLowerCase().includes(query));$('#rows').innerHTML=filtered.map(t=>`<tr data-open="${esc(t.id)}" tabindex="0" aria-label="開啟 ${esc(t.date)} 的交易紀錄"><td><button class="record-link" data-view="${esc(t.id)}">${esc(t.date)} ↗</button></td><td>${esc(tradeSymbol(t))} <small class="direction ${t.side==='short'?'short':''}">${t.side==='long'?'↗ 做多':'↘ 做空'}</small></td><td>${t.qty}</td><td>${t.entry.toLocaleString()} <span style="color:#bdc6be">→</span> ${t.exit.toLocaleString()}</td><td class="${pnl(t)>=0?'positive':'negative'}">${money(pnl(t),true)}</td><td><button data-view="${esc(t.id)}">查看</button><button data-edit="${esc(t.id)}" aria-label="編輯交易">編輯</button><button data-delete="${esc(t.id)}" aria-label="刪除交易">×</button></td></tr>`).join('');$('#empty').classList.toggle('hidden',filtered.length>0);$('#empty').firstChild.textContent=trades.length?'沒有符合條件的交易。':'尚無交易紀錄';$('#count').textContent=`共 ${filtered.length} 筆交易`;
$('#overview').classList.toggle('hidden',page!=='overview');$('#accountInfo').classList.toggle('hidden',page!=='overview');
$('#calendarSection').classList.toggle('hidden',page!=='overview');
$('#tradesSection').classList.toggle('hidden',!['overview','trades'].includes(page));
$('#tradeDetail').classList.toggle('hidden',page!=='detail');
$('#tableTitle').textContent=page==='overview'?'最近交易':'交易紀錄';$('#viewAllTrades').classList.toggle('hidden',page!=='overview');
renderDetail();}

function openTrade(t){const f=$('#tradeForm');f.reset();uploadGeneration++;uploading=false;draftCharts=(t?.charts||[]).map(c=>({...c}));$('#chartFiles').value='';$('#uploadStatus').textContent='';renderChartPreviews();f.elements.id.value='';f.elements.accountId.value=t?.accountId||state.activeAccountId;f.elements.date.value=dateString(today);f.elements.symbol.value=t?tradeSymbol(t):'MNQ';if(t)Object.entries(t).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v});$('#formTitle').textContent=t?'編輯交易':'新增交易';estimate();$('#tradeDialog').showModal()}
function estimate(){const f=$('#tradeForm').elements,t={symbol:f.symbol.value,side:f.side.value,entry:+f.entry.value,exit:+f.exit.value,qty:+f.qty.value,fee:+f.fee.value},spec=instrument(t);if(!spec)return;for(const key of ['entry','exit']){f[key].step=String(spec.tick);f[key].min=String(spec.tick)}$('#contractSpec').textContent=t.symbol+' · 每點 '+money(spec.pointValue)+'／口 · 最小跳動 '+spec.tick+'（'+money(spec.pointValue*spec.tick)+'／口）';$('#estimate').textContent=money(pnl(t),true)}

$('#tradeForm').elements.symbol.addEventListener('change',estimate);
$('#tradeForm').addEventListener('input',estimate);$('#tradeForm').onsubmit=e=>{e.preventDefault();if(uploading){toast('圖片正在讀取，請稍候再儲存。');return}const data=Object.fromEntries(new FormData(e.target)),previous=state.trades.find(t=>t.id===data.id),t={...data,id:data.id||crypto.randomUUID(),charts:draftCharts.map(c=>({...c}))};if(previous?.strategy!==undefined)t.strategy=previous.strategy;['entry','exit','qty','fee'].forEach(k=>t[k]=Number(t[k]));if(!validTrade(t)||!state.accounts.some(a=>a.id===t.accountId)){toast('請確認帳號、日期、口數與價格；'+t.symbol+' 的價格須為 '+(instrument(t)?.tick||'有效最小跳動')+' 的倍數。');return}const old=state.trades,oldAccountId=state.activeAccountId;state.trades=old.filter(x=>x.id!==t.id).concat(t);state.activeAccountId=t.accountId;state.settings=activeAccount();if(!save()){state.trades=old;state.activeAccountId=oldAccountId;state.settings=activeAccount();return}month=new Date(Number(t.date.slice(0,4)),Number(t.date.slice(5,7))-1,1);$('#tradeDialog').close();navigate('trade/'+encodeURIComponent(t.id));render();toast('交易已儲存')};
$('#add').onclick=()=>openTrade();$('#emptyAdd').onclick=()=>openTrade();$$('.close,.cancel').forEach(b=>b.onclick=()=>b.closest('dialog').close());

function navigate(destination){const hash='#'+destination;if(location.hash===hash)syncRoute();else location.hash=hash}
function syncRoute(){const path=location.hash.slice(1);activeTradeId=path.startsWith('trade/')?decodeURIComponent(path.slice(6)):null;page=activeTradeId?'detail':path==='trades'?'trades':'overview';if(activeTradeId){const record=state.trades.find(t=>t.id===activeTradeId);if(record){state.activeAccountId=record.accountId;state.settings=activeAccount()}}updatePage();}
function updatePage(){
$$('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===(page==='detail'?'trades':page)));
const titles={overview:['交易總覽','交易總覽'],trades:['交易紀錄','交易紀錄'],detail:['交易紀錄 / 交易詳情','交易紀錄']};
$('#crumb').textContent=titles[page][0];$('#title').textContent=titles[page][1];
$('.toolbar').classList.toggle('hidden',page==='detail');$('#add').textContent='＋ 新增交易';render();}
$$('[data-page]').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
$('.brand').onclick=e=>{e.preventDefault();navigate('overview')};
$('#viewAllTrades').onclick=()=>navigate('trades');
$('#backTrades').onclick=()=>navigate('trades');
window.addEventListener('hashchange',syncRoute);
$$('[data-range]').forEach(b=>b.onclick=()=>{range=b.dataset.range;$$('[data-range]').forEach(x=>x.classList.toggle('selected',x===b));render()});$('#prevMonth').onclick=()=>{month.setMonth(month.getMonth()-1);render()};$('#nextMonth').onclick=()=>{month.setMonth(month.getMonth()+1);render()};$('#search').oninput=render;$('#symbolFilter').onchange=render;
document.addEventListener('click',e=>{const view=e.target.closest('[data-view]'),row=e.target.closest('[data-open]');if(view)navigate('trade/'+encodeURIComponent(view.dataset.view));else if(row&&!e.target.closest('button,a,input'))navigate('trade/'+encodeURIComponent(row.dataset.open));const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit)openTrade(all().find(t=>t.id===edit.dataset.edit));if(del){if(confirm('確定刪除這筆交易？此操作無法復原。')){const old=state.trades;state.trades=old.filter(t=>t.id!==del.dataset.delete);if(!save())state.trades=old;render()}}});
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify({...state,version:2},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`dspe-backup-${dateString(today)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已匯出你的實際紀錄與帳戶設定。')};

function renderDetail(){
if(page!=='detail')return;
const t=state.trades.find(t=>t.id===activeTradeId);
if(!t){$('#detailContent').innerHTML='<article class="card empty">找不到這筆交易。<p>請返回交易紀錄列表。</p></article>';return}
$('#title').textContent=t.date+' · '+tradeSymbol(t);
const result=pnl(t),side=t.side==='long'?'做多 Long':'做空 Short';
const field=(name,value,cls='')=>`<div class="info-field"><span>${name}</span><strong class="${cls}">${value}</strong></div>`;
const basic=`<article class="card detail-card"><div class="card-top"><div><h2>基本資訊</h2></div><button class="text-button" data-edit="${esc(t.id)}">編輯交易 ↗</button></div><div class="trade-result"><span>本筆淨損益</span><strong class="${result>=0?'positive':'negative'}">${money(result,true)}</strong><small>已扣除總手續費 ${money(t.fee)}</small></div><div class="info-grid">${field('帳號',esc(state.accounts.find(a=>a.id===t.accountId)?.name||activeAccount().name))}${field('交易日期',esc(t.date))}${field('交易商品',esc(tradeSymbol(t)))}${field('交易方向',side)}${field('交易口數',t.qty+' 口')}${field('進場價格',t.entry.toLocaleString())}${field('出場價格',t.exit.toLocaleString())}${field('交易圖表',(t.charts?.length||0)+' 張')}${field('價格變動',(t.exit-t.entry).toFixed(2)+' 點')}</div></article>`;
const chart=`<article class="card detail-card"><div class="card-top"><div><h2>交易圖表</h2></div><button class="text-button" data-edit="${esc(t.id)}">＋ 加入／管理圖表</button></div><div class="chart-gallery">${t.charts?.length?t.charts.map(c=>`<figure><a href="${c.data}" target="_blank" rel="noopener" aria-label="開啟完整圖表：${esc(c.name)}"><img src="${c.data}" alt="${esc(c.name)}"></a><figcaption>${esc(c.name)}</figcaption></figure>`).join(''):'<div class="empty">尚未加入圖表</div>'}</div></article>`;
const review=`<article class="card detail-card"><div class="card-top"><div><h2>交易檢討</h2></div><button class="text-button" data-edit="${esc(t.id)}">${t.note?'編輯檢討':'新增檢討'} ↗</button></div><div class="review-note">${t.note?esc(t.note):'尚無檢討'}</div></article>`;
$('#detailContent').innerHTML=basic+chart+review;
}

function renderChartPreviews(){
$('#chartPreviews').innerHTML=draftCharts.map((c,i)=>`<div class="chart-preview"><img src="${c.data}" alt="${esc(c.name)}"><span>${esc(c.name)}</span><button type="button" data-remove-chart="${i}" aria-label="移除圖表 ${esc(c.name)}">×</button></div>`).join('');
}
function readChart(file){return new Promise((resolve,reject)=>{
if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>750*1024){reject(Error('請選擇 PNG、JPG 或 WebP 圖片，每張不可超過 750 KB。'));return}
const reader=new FileReader();reader.onerror=()=>reject(Error('圖片讀取失敗，請重新選擇。'));
reader.onload=()=>{const image=new Image();image.onerror=()=>reject(Error('無法辨識這張圖片，請選擇有效的圖表圖片。'));image.onload=()=>{const chart={name:file.name.slice(0,200),data:reader.result};validChart(chart)?resolve(chart):reject(Error('圖片格式不支援。'))};image.src=reader.result};reader.readAsDataURL(file);
})}
$('#chartFiles').onchange=async e=>{
const input=e.target,files=[...input.files],generation=++uploadGeneration;
if(!files.length)return;
if(files.length+draftCharts.length>3){toast('每筆交易最多可加入 3 張圖表。');input.value='';return}
uploading=true;$('#uploadStatus').textContent='正在讀取圖表…';
try{const charts=await Promise.all(files.map(readChart));if(generation!==uploadGeneration)return;draftCharts.push(...charts);renderChartPreviews();$('#uploadStatus').textContent='圖表已加入，儲存交易後會一併保存。'}catch(error){if(generation===uploadGeneration){$('#uploadStatus').textContent=error.message;toast(error.message)}}finally{if(generation===uploadGeneration){uploading=false;input.value=''}}
};
$('#chartPreviews').addEventListener('click',e=>{const button=e.target.closest('[data-remove-chart]');if(!button)return;if(uploading){toast('請等待圖片讀取完成。');return}draftCharts.splice(Number(button.dataset.removeChart),1);renderChartPreviews();$('#uploadStatus').textContent='儲存交易後將更新圖表。'});
document.addEventListener('keydown',e=>{const row=e.target.closest('[data-open]');if(row&&e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();navigate('trade/'+encodeURIComponent(row.dataset.open))}});


function accountLabel(a){return (RULE_CATALOG[a.firm]?.name||a.firm)+' '+(RULE_CATALOG[a.firm]?.products[a.product]?.name||a.product)+' '+(a.size/1000)+'K · '+(a.stage==='evaluation'?'考試':a.payoutPolicy==='daily'?'Daily 出金':'Flex 出金')}
function isCustomized(a){if(!a.checkedAt)return true;try{const p=presetRules(a);return [...RULE_NUMBERS,'drawdownMode','lockOnPayout','scaleTiers'].some(k=>a[k]!==p[k])}catch{return true}}
function renderAccountSelectors(){
const options=state.accounts.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('');
const selector=$('#accountSelect');selector.innerHTML=options;selector.value=state.activeAccountId;
const tradeSelector=$('#tradeAccount'),previous=tradeSelector.value;tradeSelector.innerHTML=options;tradeSelector.value=state.accounts.some(a=>a.id===previous)?previous:state.activeAccountId;
}
function fillCatalogSelect(select,entries,selected){select.innerHTML=entries.map(([value,label])=>'<option value="'+esc(value)+'">'+esc(label)+'</option>').join('');select.value=String(selected);if(!select.value)select.value=String(entries[0][0])}
function fillCatalog(f,firm,product,size){
fillCatalogSelect(f.elements.firm,Object.entries(RULE_CATALOG).map(([id,item])=>[id,item.name]),firm);
const company=RULE_CATALOG[f.elements.firm.value];
fillCatalogSelect(f.elements.product,Object.entries(company.products).map(([id,item])=>[id,item.name]),product);
fillCatalogSelect(f.elements.size,Object.keys(company.products[f.elements.product.value].sizes).map(size=>[size,(Number(size)/1000)+'K']),size);
}
function accountSelection(f){return Object.fromEntries(['firm','product','size','stage','payoutPolicy','payoutVersion','evaluationVersion','consistencyOption'].map(k=>[k,k==='size'?Number(f.elements[k].value):f.elements[k].value]))}
function setRuleFields(account){const f=$('#settingsForm');Object.entries(account).forEach(([key,value])=>{const input=f.elements[key];if(!input)return;if(input.type==='checkbox')input.checked=!!value;else input.value=value===null?'':value});}
function applyPreset(){const f=$('#settingsForm'),selection=accountSelection(f);setRuleFields(presetRules(selection));f.dataset.checkedAt=RULE_CHECKED;updateRuleForm();}
function readAccountForm(){const f=$('#settingsForm'),selection=accountSelection(f);const account={id:f.elements.id.value||crypto.randomUUID(),name:f.elements.name.value.trim(),...selection,checkedAt:f.dataset.checkedAt||null};RULE_NUMBERS.forEach(k=>account[k]=f.elements[k].value.trim()===''&&NULLABLE_RULES.includes(k)?null:Number(f.elements[k].value));account.drawdownMode=f.elements.drawdownMode.value;account.lockOnPayout=f.elements.lockOnPayout.checked;account.scaleTiers=f.elements.scaleTiers.value.trim();return account;}
function updateRuleForm(){
const f=$('#settingsForm'),selection=accountSelection(f),evaluation=selection.stage==='evaluation';
$('#accountPayouts').classList.toggle('hidden',evaluation);
$('#evaluationVersionField').classList.toggle('hidden',!evaluation||selection.size!==50000);$('#consistencyOptionField').classList.toggle('hidden',!evaluation);
$('#payoutPolicyField').classList.toggle('hidden',evaluation);$('#payoutVersionField').classList.toggle('hidden',evaluation);
const p=presetRules(selection),keys=[...RULE_NUMBERS,'drawdownMode','lockOnPayout','scaleTiers'];
const custom=keys.some(k=>{const input=f.elements[k],value=input.type==='checkbox'?input.checked:RULE_NUMBERS.includes(k)?input.value===''&&NULLABLE_RULES.includes(k)?null:Number(input.value):input.value;return value!==p[k]});
$('#ruleStatus').textContent=custom?'已手動調整':('官方預設 · '+RULE_CHECKED);
$('#ruleWarning').textContent=evaluation&&selection.size===25000?'25K 考試口數的官方頁面有出入：預設採考試專頁的 10 Micro，請核對平台後調整。':'';
$('#ruleWarning').classList.toggle('hidden',!$('#ruleWarning').textContent);
$('#ruleNotes').textContent=evaluation?'一致性以最高單日淨獲利 ÷ 總淨獲利計算；超過上限需累積更多獲利。50% 方案僅適用已購買加購的帳號。':(selection.payoutPolicy==='flex'?'Flex 按目前餘額減起始資金的總獲利比例提領，不是只算本輪獲利。':'Daily 需保留安全墊，申請額受本輪獲利倍數、上限與最低金額限制。')+' 後續每輪須淨獲利為正，且前次申請已處理完畢。分潤前的申請額與實收金額不同；官方出金方案選定後不可切換。';
}
function openSettings(newAccount=false){
const f=$('#settingsForm'),a=newAccount?defaultAccount(''):activeAccount();f.reset();fillCatalog(f,a.firm,a.product,a.size);setRuleFields(a);f.dataset.checkedAt=a.checkedAt||'';$('#accountFormTitle').textContent=newAccount?'新增帳號':'帳號與規則';if(newAccount)f.elements.name.value='';updateRuleForm();$('#settingsDialog').showModal();
}
$('#settings').onclick=()=>openSettings();$('#editAccount').onclick=()=>openSettings();$('#newAccount').onclick=()=>openSettings(true);
$('#restorePreset').onclick=applyPreset;
$('#settingsForm').addEventListener('input',updateRuleForm);
for(const key of ['firm','product','size','stage','payoutPolicy','payoutVersion','evaluationVersion','consistencyOption'])$('#settingsForm').elements[key].addEventListener('change',()=>{const f=$('#settingsForm');if(key==='firm'||key==='product')fillCatalog(f,f.elements.firm.value,f.elements.product.value,f.elements.size.value);applyPreset()});
$('#settingsForm').onsubmit=e=>{
e.preventDefault();const account=readAccountForm();if(!validAccount(account)){toast('請檢查規則數值、口數上下限、升級門檻與出金金額。');return}
const previous=state;state={...state,accounts:state.accounts.filter(a=>a.id!==account.id).concat(account),activeAccountId:account.id,settings:account};
if(!save()){state=previous;return}$('#settingsDialog').close();if(page==='detail')navigate('overview');else render();toast('帳號已儲存');
};
$('#accountSelect').onchange=e=>{const previous=state.activeAccountId;state.activeAccountId=e.target.value;state.settings=activeAccount();if(!save()){state.activeAccountId=previous;state.settings=activeAccount()}if(page==='detail')navigate('overview');else render()};
syncRoute();

(function(){
'use strict';
var IFRAMED=(function(){try{return window.self!==window.top}catch(e){return true}})();
var KEY='counter-pos-v1';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var uid=function(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)};
var pad=function(n){return String(n).padStart(2,'0')};
var dkey=function(ts){var d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
var today=function(){return dkey(Date.now())};
var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var num=function(v){var n=parseFloat(String(v==null?'':v).replace(/,/g,''));return isFinite(n)?n:0};
var r0=function(n){return Math.round(n)};
function money(n){return (S.settings.currency||'Rs')+' '+r0(n).toLocaleString('en-US')}
function plain(n){return r0(n).toLocaleString('en-US')}
function tme(ts){var d=new Date(ts),h=d.getHours(),ap=h>=12?'PM':'AM';h=h%12||12;return h+':'+pad(d.getMinutes())+' '+ap}
function dfmt(ts){var d=new Date(ts);return pad(d.getDate())+' '+MON[d.getMonth()]+' '+d.getFullYear()}
function kfmt(k){var p=k.split('-');return pad(+p[2])+' '+MON[+p[1]-1]+' '+p[0]}
var METHOD={cash:'Cash',bank:'Card / Digital',credit:'Credit'};
var TAX_PRESETS={pra:{label:'PRA Sales Tax',cash:16,card:8},srb:{label:'SRB Sales Tax',cash:15,card:8},none:{label:'',cash:0,card:0}};
function applyTaxPreset(st,key){var p=TAX_PRESETS[key];st.settings.taxRegime=key;if(p){st.settings.taxCash=p.cash;st.settings.taxCard=p.card;st.settings.taxLabel=p.label}}
function taxName(label){return label||'Sales tax'}
var ROLE_TABS={owner:['bill','bills','credit','report','menu','settings'],cashier:['bill','bills']};
var ROLE_NAME={owner:'Owner',cashier:'Cashier'};
var ME=null,loginPick=null;
function can(tab){return !!ME&&ROLE_TABS[ME.role].indexOf(tab)>=0}
function hashPin(pin){
  try{if(window.crypto&&crypto.subtle)return crypto.subtle.digest('SHA-256',new TextEncoder().encode('sales-pos:'+pin)).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return ('0'+x.toString(16)).slice(-2)}).join('')})}catch(e){}
  return Promise.resolve('plain:'+pin);
}
function checkPin(u,pin){if(!u)return Promise.resolve(false);if(!u.pinHash)return Promise.resolve(pin===u.defPin);return hashPin(pin).then(function(h){return h===u.pinHash})}
var DEF_LOGIN={owner:['owner','owner123'],cashier:['cashier','cashier123']};
function userByName(n){n=String(n||'').trim().toLowerCase();for(var i=0;i<S.users.length;i++)if(String(S.users[i].username||'').toLowerCase()===n)return S.users[i];return null}
function userById(id){for(var i=0;i<S.users.length;i++)if(S.users[i].id===id)return S.users[i];return null}
function owner(){for(var i=0;i<S.users.length;i++)if(S.users[i].role==='owner')return S.users[i];return null}

/* ---------- storage: IndexedDB database on this computer (falls back to localStorage) ---------- */
var STORAGE_OK=true,DB=null,saving=false,saveAgain=false,BC=null;
try{BC=new BroadcastChannel('counter-pos')}catch(e){}
function idbOpen(){return new Promise(function(res,rej){
  try{var r=indexedDB.open('counter-pos',1);
    r.onupgradeneeded=function(){r.result.createObjectStore('kv')};
    r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)};r.onblocked=function(){rej(new Error('blocked'))};
  }catch(e){rej(e)}})}
function idbDo(mode,fn){return new Promise(function(res,rej){
  var tx=DB.transaction('kv',mode),req=fn(tx.objectStore('kv'));
  tx.oncomplete=function(){res(req&&req.result)};tx.onerror=tx.onabort=function(){rej(tx.error)}})}
function lsLoad(){try{var s=localStorage.getItem(KEY);return s?JSON.parse(s):null}catch(e){return null}}
function loadState(){
  if(!DB)return Promise.resolve(lsLoad());
  return idbDo('readonly',function(st){return st.get('state')}).then(function(v){return v||lsLoad()});
}
function save(){
  if(!DB){try{localStorage.setItem(KEY,JSON.stringify(S));STORAGE_OK=true}catch(e){STORAGE_OK=false}return}
  if(saving){saveAgain=true;return}
  saving=true;
  idbDo('readwrite',function(st){return st.put(S,'state')}).then(function(){
    saving=false;STORAGE_OK=true;if(BC)try{BC.postMessage('saved')}catch(e){}
    if(saveAgain){saveAgain=false;save()}
  },function(){saving=false;STORAGE_OK=false;renderHeader()});
}

function seed(){
  var cats=[['c1','Karahi & Handi'],['c2','BBQ'],['c3','Rice'],['c4','Bread'],['c5','Sides'],['c6','Drinks'],['c7','Dessert']].map(function(a){return {id:a[0],name:a[1]}});
  var items=[
    ['Chicken Karahi (Half)',1450,'c1'],['Chicken Karahi (Full)',2700,'c1'],['Mutton Karahi (Half)',2600,'c1'],['Chicken Handi (Half)',1500,'c1'],['Daal Mash',450,'c1'],
    ['Seekh Kebab (4 pcs)',850,'c2'],['Chicken Tikka (Leg)',420,'c2'],['Malai Boti (8 pcs)',1100,'c2'],['Reshmi Kebab (4 pcs)',900,'c2'],
    ['Chicken Biryani',450,'c3'],['Mutton Pulao',650,'c3'],['Plain Rice',250,'c3'],
    ['Roti',30,'c4'],['Naan',50,'c4'],['Roghni Naan',90,'c4'],['Garlic Naan',120,'c4'],
    ['Raita',120,'c5'],['Salad',150,'c5'],['Mint Chutney',60,'c5'],
    ['Soft Drink (345 ml)',120,'c6'],['Soft Drink (1.5 L)',280,'c6'],['Mineral Water (1.5 L)',130,'c6'],['Doodh Patti Chai',120,'c6'],['Sweet Lassi',220,'c6'],
    ['Kheer',250,'c7'],['Gulab Jamun (2 pcs)',180,'c7']
  ].map(function(a){return {id:uid(),name:a[0],price:a[1],catId:a[2],active:true,trackStock:false,stock:0,lowAt:5}});
  var stockSeed={'Soft Drink (345 ml)':[48,12],'Soft Drink (1.5 L)':[18,6],'Mineral Water (1.5 L)':[24,6],'Kheer':[12,4],'Gulab Jamun (2 pcs)':[4,5]};
  items.forEach(function(i){var s=stockSeed[i.name];if(s){i.trackStock=true;i.stock=s[0];i.lowAt=s[1]}});
  var st={settings:{name:'Sample Restaurant',address:'Shop 12, Main Road',phone:'0300-0000000',ntn:'',footer:'Thank you! Please visit again.',taxRegime:'pra',taxCash:16,taxCard:8,taxLabel:'PRA Sales Tax',taxRegNo:'',currency:'Rs',nextNo:1001,autoPrint:true},
    categories:cats,items:items,bills:[],customers:[{id:'cs1',name:'Ahmed Traders',phone:'0300-1234567',sample:true}],collections:[],stockMoves:[]};
  var byName={};items.forEach(function(i){byName[i.name]=i});
  function mk(lines,method,minsAgo,extra){
    var ls=lines.map(function(l){var i=byName[l[0]];return {itemId:i.id,name:i.name,price:i.price,qty:l[1]}});
    var sub=ls.reduce(function(a,l){return a+l.price*l.qty},0),disc=(extra&&extra.discount)||0,rate=method==='bank'?8:16,tax=Math.round((sub-disc)*rate/100),tot=sub-disc+tax;
    var b={id:uid(),no:st.settings.nextNo++,ts:Date.now()-minsAgo*60000,lines:ls,type:(extra&&extra.type)||'Dine-in',table:(extra&&extra.table)||'',
      subtotal:sub,discount:disc,taxRate:rate,tax:tax,taxLabel:'PRA Sales Tax',total:tot,method:method,received:method==='cash'?Math.ceil(tot/500)*500:0,customerId:method==='credit'?'cs1':'',ref:'',status:'paid',sample:true,user:'Cashier',userId:'u-cashier'};
    b.change=method==='cash'?b.received-tot:0;st.bills.push(b);
  }
  mk([['Chicken Karahi (Half)',1],['Naan',4],['Soft Drink (1.5 L)',1]],'cash',190,{table:'T2'});
  mk([['Chicken Biryani',3],['Raita',2],['Mineral Water (1.5 L)',1]],'bank',150,{type:'Takeaway'});
  mk([['Mutton Karahi (Half)',1],['Seekh Kebab (4 pcs)',1],['Roghni Naan',4],['Salad',1]],'credit',95,{table:'T5'});
  mk([['Doodh Patti Chai',4],['Gulab Jamun (2 pcs)',2]],'cash',40,{discount:40,table:'T1'});
  st.collections.push({id:uid(),ts:Date.now()-20*60000,customerId:'cs1',amount:2000,method:'cash',note:'Part payment',sample:true});
  return st;
}

var S=null;
function migrate(){
  if(!S.settings)S.settings={};
  ['bills','customers','collections','items','categories','stockMoves'].forEach(function(k){if(!Array.isArray(S[k]))S[k]=[]});
  if(!S.settings.taxRegime){if(num(S.settings.taxCash)||num(S.settings.taxCard))S.settings.taxRegime='custom';else applyTaxPreset(S,'pra')}
  if(S.settings.taxLabel==null)S.settings.taxLabel='';if(S.settings.taxRegNo==null)S.settings.taxRegNo='';
  S.items.forEach(function(i){if(i.trackStock==null)i.trackStock=false;if(i.stock==null)i.stock=0;if(i.lowAt==null)i.lowAt=5});
  if(!Array.isArray(S.users)||!S.users.length)S.users=[{id:'u-owner',name:'Owner',role:'owner',pinHash:''},{id:'u-cashier',name:'Cashier',role:'cashier',pinHash:''}];
  S.users.forEach(function(u){var d=DEF_LOGIN[u.role]||['user','user123'];if(!u.username)u.username=d[0];if(!u.pinHash&&(!u.defPin||/^[0-9]{4}$/.test(u.defPin)))u.defPin=d[1]});
}

/* ---------- ui state ---------- */
var ui={tab:'bill',cat:'all',q:'',billsDate:today(),billsQ:'',rFrom:today(),rTo:today()};
function newCart(){return {lines:[],type:'Dine-in',table:'',discount:'',method:'cash',received:'',ref:'',customerId:'',custName:'',custPhone:''}}
var cart=newCart();
function seedCart(){if(!S._seededCart&&S.items.length>19){cart.lines=[{itemId:S.items[9].id,name:S.items[9].name,price:S.items[9].price,qty:2},{itemId:S.items[19].id,name:S.items[19].name,price:S.items[19].price,qty:2}];cart.table='T3';S._seededCart=true;save()}}

function totals(c){
  var subtotal=c.lines.reduce(function(a,l){return a+l.price*l.qty},0);
  var discount=Math.max(0,Math.min(num(c.discount),subtotal));
  var rate=c.method==='bank'?num(S.settings.taxCard):num(S.settings.taxCash);
  var tax=r0((subtotal-discount)*rate/100);
  return {subtotal:subtotal,discount:discount,rate:rate,tax:tax,total:r0(subtotal-discount+tax)};
}
function custById(id){for(var i=0;i<S.customers.length;i++)if(S.customers[i].id===id)return S.customers[i];return null}
function balance(id){
  var due=S.bills.reduce(function(a,b){return a+(b.method==='credit'&&b.customerId===id&&b.status!=='void'?b.total:0)},0);
  var paid=S.collections.reduce(function(a,c){return a+(c.customerId===id?c.amount:0)},0);
  return due-paid;
}
function itemById(id){for(var i=0;i<S.items.length;i++)if(S.items[i].id===id)return S.items[i];return null}
function moveStock(it,change,reason,ref){it.stock=num(it.stock)+change;S.stockMoves.push({id:uid(),ts:Date.now(),itemId:it.id,name:it.name,change:change,after:it.stock,reason:reason,ref:ref||''})}
function lowItems(){return S.items.filter(function(i){return i.trackStock&&num(i.stock)<=num(i.lowAt)})}
function hasSamples(){return S.bills.some(function(b){return b.sample})||S.customers.some(function(c){return c.sample})||S.collections.some(function(c){return c.sample})||S.settings.name==='Sample Restaurant'}

/* ---------- header / banners ---------- */
function renderHeader(){
  $('#brand-name').textContent=S.settings.name||'Restaurant';
  $$('.tab').forEach(function(b){b.hidden=!can(b.dataset.v)});
  $('#who').innerHTML=ME?'<b>'+esc(ME.name)+'</b><span class="role">'+ROLE_NAME[ME.role]+'</span><button class="btn sm" data-act="lock">Lock</button>':'';
  var b='';
  if(!STORAGE_OK)b+='<div class="banner warn"><span>This browser is not saving data. Bills will be lost when the page closes. Check that site data is allowed for this page.</span></div>';
  if(hasSamples()&&ME&&ME.role==='owner')b+='<div class="banner"><span>You are looking at sample data: an example menu and four example bills.</span><button class="linkbtn" data-act="clear-samples">Remove sample bills</button><button class="linkbtn" data-act="tab" data-v="settings">Set restaurant name</button></div>';
  $('#banners').innerHTML=b;
  var lw=lowItems().length;$('#menu-badge').innerHTML=lw?'<span class="tabbadge" title="Items low on stock">'+lw+'</span>':'';
}
function tick(){var d=new Date();$('#clock').textContent=pad(d.getDate())+' '+MON[d.getMonth()]+' · '+tme(d)}

/* ---------- tabs ---------- */
function setTab(t){
  if(ui.tab==='menu'&&t!=='menu'&&draftCount()){
    openModal('<div class="modal-head"><h2>Save menu changes?</h2><button class="x" data-act="close" aria-label="Close">×</button></div><p>'+draftCount()+' item(s) in the menu have changes that are not saved yet.</p>'+
      '<div class="modal-actions"><button class="btn" data-act="menu-discard-go" data-v="'+t+'">Discard changes</button><button class="btn primary" data-act="menu-save-go" data-v="'+t+'">Save and continue</button></div>');
    return;
  }
  if(!can(t))t='bill';
  ui.tab=t;
  $$('.tab').forEach(function(b){if(b.dataset.v===t)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  $$('.view').forEach(function(v){v.hidden=v.id!=='v-'+t});
  renderView();
  window.scrollTo(0,0);
}
function renderView(){
  renderHeader();
  ({bill:renderPOS,bills:renderBills,credit:renderCredit,report:renderReport,menu:renderMenu,settings:renderSettings})[ui.tab]();
}

/* ---------- POS ---------- */
function visibleItems(){
  var q=ui.q.trim().toLowerCase();
  return S.items.filter(function(i){return i.active&&(ui.cat==='all'||i.catId===ui.cat)&&(!q||i.name.toLowerCase().indexOf(q)>=0)});
}
function renderPOS(){
  var cats='<button class="cat" data-act="cat" data-v="all" aria-pressed="'+(ui.cat==='all')+'">All</button>'+
    S.categories.map(function(c){return '<button class="cat" data-act="cat" data-v="'+esc(c.id)+'" aria-pressed="'+(ui.cat===c.id)+'">'+esc(c.name)+'</button>'}).join('');
  $('#cats').innerHTML=cats;
  renderItems();
  $('#cart-table').value=cart.table;
  $('#cart-discount').value=cart.discount;
  renderCart(true);
}
function renderItems(){
  var list=visibleItems(),inCart={};
  cart.lines.forEach(function(l){inCart[l.itemId]=(inCart[l.itemId]||0)+l.qty});
  $('#items').innerHTML=list.length?list.map(function(i){
    return '<button class="item" data-act="add" data-id="'+esc(i.id)+'"><span class="n">'+esc(i.name)+'</span>'+
      (i.trackStock?stockTag(num(i.stock)-(inCart[i.id]||0),i.lowAt):'')+
      '<span style="display:flex;justify-content:space-between;align-items:center;gap:6px"><span class="p">'+plain(i.price)+'</span>'+(inCart[i.id]?'<span class="q">×'+inCart[i.id]+'</span>':'')+'</span></button>';
  }).join(''):'<div class="empty" style="grid-column:1/-1">No items match. Add items in the Menu tab.</div>';
}
function stockTag(n,lowAt){return '<span class="stk'+(n<=0?' out':n<=num(lowAt)?' low':'')+'">'+(n<=0?'Out of stock':plain(n)+' left')+'</span>'}
function renderCart(full){
  $('#next-no').textContent='Bill #'+S.settings.nextNo;
  $$('#order-type button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.v===cart.type))});
  $$('#pay-method button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.v===cart.method))});
  $('#cart-lines').innerHTML=cart.lines.length?cart.lines.map(function(l,ix){
    return '<div class="line"><div><div class="nm">'+esc(l.name)+'</div><div class="each num">'+plain(l.price)+' each</div></div>'+
      '<div class="qty"><button data-act="dec" data-ix="'+ix+'" aria-label="One less '+esc(l.name)+'">−</button><span>'+l.qty+'</span><button data-act="inc" data-ix="'+ix+'" aria-label="One more '+esc(l.name)+'">+</button></div>'+
      '<div class="amt">'+plain(l.price*l.qty)+'</div></div>';
  }).join(''):'<div class="empty">Tap menu items to start a bill.</div>';
  renderSum();
  if(full)renderPayExtra();
  var sb=$('#save-btn');sb.textContent=(S.settings.autoPrint&&!IFRAMED)?'Save & print':'Save bill';
}
function renderSum(){
  var t=totals(cart);
  $('#cart-sum').innerHTML='<div><span>Subtotal</span><span class="num">'+plain(t.subtotal)+'</span></div>'+
    (t.discount?'<div><span>Discount</span><span class="num">−'+plain(t.discount)+'</span></div>':'')+
    (t.rate?'<div><span>'+esc(taxName(S.settings.taxLabel))+' '+t.rate+'%</span><span class="num">'+plain(t.tax)+'</span></div>':'')+
    '<div class="total"><span>Total</span><span class="num">'+money(t.total)+'</span></div>';
  var cr=num(S.settings.taxCard),ca=num(S.settings.taxCash);
  if(cart.method!=='bank'&&cart.lines.length&&cr<ca){
    var alt=totals({lines:cart.lines,discount:cart.discount,method:'bank'});
    $('#cart-sum').innerHTML+='<div class="taxhint">Paid by card or wallet: tax <b>'+cr+'%</b> instead of '+ca+'%, total <b class="num">'+money(alt.total)+'</b> (saves '+plain(t.total-alt.total)+')</div>';
  }
  renderChange();
}
function renderChange(){
  var el=$('#change-line');if(!el)return;
  var t=totals(cart),rec=num(cart.received);
  if(!cart.received){el.className='change';el.innerHTML='<span>Change</span><span class="num">—</span>';return}
  var ch=rec-t.total;
  el.className='change'+(ch<0?' short':'');
  el.innerHTML='<span>'+(ch<0?'Short by':'Change to return')+'</span><span class="num">'+money(Math.abs(ch))+'</span>';
}
function renderPayExtra(){
  var h='';
  if(cart.method==='cash'){
    h='<label class="field"><span>Cash received from customer</span><input id="cash-rec" inputmode="numeric" class="num" placeholder="Leave empty if exact" value="'+esc(cart.received)+'" autocomplete="off"></label>'+
      '<div class="quick"><button class="btn sm" data-act="rec" data-v="exact">Exact</button><button class="btn sm" data-act="rec" data-v="500">500</button><button class="btn sm" data-act="rec" data-v="1000">1,000</button><button class="btn sm" data-act="rec" data-v="5000">5,000</button></div>'+
      '<div class="change" id="change-line"></div>';
  }else if(cart.method==='bank'){
    h='<label class="field"><span>Card / transaction reference (optional)</span><input id="bank-ref" value="'+esc(cart.ref)+'" placeholder="e.g. last 4 digits or slip no." autocomplete="off"></label>';
  }else{
    var opts='<option value="">Choose customer…</option>'+S.customers.slice().sort(function(a,b){return a.name.localeCompare(b.name)}).map(function(c){
      return '<option value="'+esc(c.id)+'"'+(c.id===cart.customerId?' selected':'')+'>'+esc(c.name)+(c.phone?' · '+esc(c.phone):'')+'</option>'}).join('')+'<option value="__new"'+(cart.customerId==='__new'?' selected':'')+'>+ New customer</option>';
    h='<label class="field"><span>Bill goes on credit to</span><select id="cust-sel">'+opts+'</select></label>';
    if(cart.customerId==='__new')h+='<div class="row"><label class="field"><span>Name</span><input id="cust-name" value="'+esc(cart.custName)+'" autocomplete="off"></label><label class="field"><span>Phone</span><input id="cust-phone" value="'+esc(cart.custPhone)+'" inputmode="tel" autocomplete="off"></label></div>';
    else if(cart.customerId){h+='<p class="note">Already owes <b class="num">'+money(balance(cart.customerId))+'</b> before this bill.</p>'}
  }
  $('#pay-extra').innerHTML=h;
  renderChange();
}
function addItem(id){
  var it=S.items.find(function(i){return i.id===id});if(!it)return;
  var l=cart.lines.find(function(x){return x.itemId===id&&x.price===it.price});
  if(l)l.qty++;else cart.lines.push({itemId:it.id,name:it.name,price:it.price,qty:1});
  var inc=cart.lines.reduce(function(a,x){return a+(x.itemId===id?x.qty:0)},0);
  msg('#cart-msg',it.trackStock&&num(it.stock)-inc<0?it.name+' shows no stock left. Added anyway; update the stock in Menu & stock.':'');renderItems();renderCart(false);
}
function saveBill(){
  if(!cart.lines.length)return msg('#cart-msg','Add at least one item first.');
  var t=totals(cart),b={id:uid(),no:num(S.settings.nextNo)||1001,ts:Date.now(),lines:cart.lines.map(function(l){return {itemId:l.itemId,name:l.name,price:l.price,qty:l.qty}}),
    type:cart.type,table:cart.table.trim(),subtotal:t.subtotal,discount:t.discount,taxRate:t.rate,tax:t.tax,taxLabel:S.settings.taxLabel||'',total:t.total,method:cart.method,received:0,change:0,customerId:'',ref:'',status:'paid',user:ME?ME.name:'',userId:ME?ME.id:''};
  if(cart.method==='cash'){
    var rec=cart.received===''?t.total:num(cart.received);
    if(rec<t.total)return msg('#cart-msg','Cash received is less than the total. Enter the full amount or choose Credit.');
    b.received=rec;b.change=rec-t.total;
  }else if(cart.method==='bank'){b.ref=cart.ref.trim()}
  else{
    if(cart.customerId==='__new'){
      var nm=cart.custName.trim();if(!nm)return msg('#cart-msg','Enter the customer name for a credit bill.');
      var c={id:uid(),name:nm,phone:cart.custPhone.trim()};S.customers.push(c);b.customerId=c.id;
    }else if(cart.customerId&&custById(cart.customerId)){b.customerId=cart.customerId}
    else return msg('#cart-msg','Choose who this credit bill belongs to.');
  }
  b.lines.forEach(function(l){var it=itemById(l.itemId);if(it&&it.trackStock){moveStock(it,-l.qty,'Sale','Bill #'+b.no);l.stocked=true}});
  S.bills.push(b);S.settings.nextNo=b.no+1;save();
  var keepType=cart.type;cart=newCart();cart.type=keepType;
  renderPOS();renderHeader();
  msg('#cart-msg','Bill #'+b.no+' saved · '+money(b.total),true);
  showReceipt(b,true);
}
function msg(sel,text,ok){var el=$(sel);if(!el)return;el.textContent=text;el.className='msg'+(ok?' ok':'')}

/* ---------- receipt ---------- */
function receiptHTML(b){
  var s=S.settings,c=b.customerId?custById(b.customerId):null;
  var rows=b.lines.map(function(l){return '<tr><td colspan="3">'+esc(l.name)+'</td></tr><tr><td>&nbsp;&nbsp;'+l.qty+' × '+plain(l.price)+'</td><td></td><td style="text-align:right">'+plain(l.qty*l.price)+'</td></tr>'}).join('');
  var h='<div class="rcpt"><div class="shop">'+esc(s.name)+'</div>'+
    (s.address?'<div class="c">'+esc(s.address)+'</div>':'')+(s.phone?'<div class="c">Ph: '+esc(s.phone)+'</div>':'')+(s.ntn?'<div class="c">NTN: '+esc(s.ntn)+'</div>':'')+(b.tax&&s.taxRegNo?'<div class="c">Tax reg. no: '+esc(s.taxRegNo)+'</div>':'')+(b.tax?'<div class="c" style="font-weight:600;margin-top:4px">SALES TAX INVOICE</div>':'')+
    '<hr><table><tr><td>Bill # '+b.no+'</td><td style="text-align:right">'+dfmt(b.ts)+'</td></tr><tr><td>'+esc(b.type)+(b.table?' · '+esc(b.table):'')+'</td><td style="text-align:right">'+tme(b.ts)+'</td></tr></table>'+
    (b.status==='void'?'<div class="stamp">VOID</div>':'')+
    '<hr><table>'+rows+'</table><hr><table>'+
    '<tr><td>Subtotal</td><td style="text-align:right">'+plain(b.subtotal)+'</td></tr>'+
    (b.discount?'<tr><td>Discount</td><td style="text-align:right">-'+plain(b.discount)+'</td></tr>':'')+
    (b.taxRate?'<tr><td>'+esc(taxName(b.taxLabel))+' '+b.taxRate+'%</td><td style="text-align:right">'+plain(b.tax)+'</td></tr>':'')+
    '<tr class="big"><td>TOTAL '+esc(s.currency||'Rs')+'</td><td style="text-align:right">'+plain(b.total)+'</td></tr></table><hr><table>'+
    '<tr><td>Paid by</td><td style="text-align:right">'+METHOD[b.method]+'</td></tr>'+
    (b.user?'<tr><td>Served by</td><td style="text-align:right">'+esc(b.user)+'</td></tr>':'')+
    (b.method==='cash'?'<tr><td>Cash received</td><td style="text-align:right">'+plain(b.received)+'</td></tr><tr><td>Change</td><td style="text-align:right">'+plain(b.change)+'</td></tr>':'')+
    (b.method==='bank'&&b.ref?'<tr><td>Ref</td><td style="text-align:right">'+esc(b.ref)+'</td></tr>':'')+
    (c?'<tr><td>Customer</td><td style="text-align:right">'+esc(c.name)+'</td></tr><tr><td colspan="2">Amount payable later</td></tr>':'')+
    '</table><hr>'+(s.footer?'<div class="c">'+esc(s.footer)+'</div>':'')+'</div>';
  return h;
}
function printHTML(html){
  if(IFRAMED)return false;
  $('#print-area').innerHTML=html;
  try{window.print()}catch(e){}
  return true;
}
function printNote(){return IFRAMED?'<p class="note">Printing works when the POS runs on its own website or computer. This preview window cannot open the print dialog.</p>':''}
function showReceipt(b,fresh){
  var acts='';
  if(!IFRAMED)acts+='<button class="btn" data-act="print-bill" data-id="'+b.id+'">'+(fresh?'Print again':'Print')+'</button>';
  if(!fresh&&b.status!=='void'&&ME&&ME.role==='owner')acts+='<button class="btn danger" data-act="void-start" data-id="'+b.id+'">Void bill</button>';
  acts+='<button class="btn primary" data-act="close">'+(fresh?'Next bill':'Close')+'</button>';
  openModal('<div class="modal-head"><h2>'+(fresh?'Bill #'+b.no+' saved':'Bill #'+b.no)+'</h2><button class="x" data-act="close" aria-label="Close">×</button></div>'+
    (b.status==='void'?'<p class="msg">Voided'+(b.voidBy?' by '+esc(b.voidBy):'')+(b.voidApprovedBy?' (approved by '+esc(b.voidApprovedBy)+')':'')+(b.voidReason?': '+esc(b.voidReason):'')+'</p>':'')+
    '<div class="paper">'+receiptHTML(b)+'</div>'+printNote()+'<div id="void-box"></div><div class="modal-actions">'+acts+'</div>');
  if(fresh&&S.settings.autoPrint)printHTML(receiptHTML(b));
}

/* ---------- modal ---------- */
var lastFocus=null;
function openModal(html,wide){
  lastFocus=document.activeElement;
  var o=$('#overlay');o.innerHTML='<div class="modal'+(wide?' wide':'')+'" role="dialog" aria-modal="true">'+html+'</div>';o.hidden=false;
  var f=o.querySelector('input,select,.btn.primary');if(f)f.focus();
}
function closeModal(){var o=$('#overlay');o.hidden=true;o.innerHTML='';if(lastFocus&&lastFocus.focus)try{lastFocus.focus()}catch(e){}}

/* ---------- bills ---------- */
function renderBills(){
  $('#bills-date').value=ui.billsDate;$('#bills-q').value=ui.billsQ;
  var q=ui.billsQ.trim();
  var list=S.bills.filter(function(b){return q?String(b.no).indexOf(q)>=0:dkey(b.ts)===ui.billsDate}).sort(function(a,b){return b.ts-a.ts});
  if(!list.length){$('#bills-table').innerHTML='<div class="empty">'+(q?'No bill number matches '+esc(q)+'.':'No bills on '+kfmt(ui.billsDate)+'.')+'</div>';return}
  var tot=0;
  $('#bills-table').innerHTML='<table><thead><tr><th>Bill</th><th>'+(q?'Date / time':'Time')+'</th><th>Order</th><th class="r">Items</th><th class="r">Total</th><th>Payment</th><th></th></tr></thead><tbody>'+
    list.map(function(b){
      if(b.status!=='void')tot+=b.total;
      var c=b.customerId?custById(b.customerId):null;
      return '<tr class="'+(b.status==='void'?'void':'')+'"><td class="num">#'+b.no+'</td><td>'+(q?dfmt(b.ts)+' ':'')+tme(b.ts)+'</td><td>'+esc(b.type)+(b.table?' · '+esc(b.table):'')+'</td>'+
        '<td class="r num">'+b.lines.reduce(function(a,l){return a+l.qty},0)+'</td><td class="r num">'+plain(b.total)+'</td>'+
        '<td class="st">'+(b.status==='void'?'<span class="chip void">Void</span>':'<span class="chip '+b.method+'">'+METHOD[b.method]+'</span>'+(c?' <span class="note">'+esc(c.name)+'</span>':''))+'</td>'+
        '<td class="r"><button class="btn sm" data-act="view-bill" data-id="'+b.id+'">Open</button></td></tr>';
    }).join('')+'</tbody><tfoot><tr><td colspan="4">'+list.filter(function(b){return b.status!=='void'}).length+' bills</td><td class="r num">'+plain(tot)+'</td><td colspan="2"></td></tr></tfoot></table>';
}
function startVoid(id){
  $('#void-box').innerHTML='<div class="stack"><label class="field"><span>Reason for voiding (required)</span><input id="void-reason" placeholder="e.g. Customer cancelled order"></label>'+
    (ME&&ME.role!=='owner'?'<label class="field"><span>Owner PIN (needed to void)</span><input id="void-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></label>':'')+
    '<div class="modal-actions"><button class="btn danger" data-act="void-confirm" data-id="'+id+'">Confirm void</button></div><p class="msg" id="void-msg"></p></div>';
  $('#void-reason').focus();
}
function confirmVoid(id){
  if(!ME||ME.role!=='owner')return msg('#void-msg','Only the Owner can void a bill.');
  var reason=($('#void-reason').value||'').trim();if(!reason)return msg('#void-msg','Write a short reason so the owner can see why it was voided.');
  var b=S.bills.find(function(x){return x.id===id});if(!b)return;
  var pinEl=$('#void-pin');
  if(pinEl){checkPin(owner(),pinEl.value.trim()).then(function(ok){if(!ok)return msg('#void-msg','Owner PIN is not correct.');doVoid(b,reason,true)});return}
  doVoid(b,reason,false);
}
function doVoid(b,reason,approved){
  b.status='void';b.voidReason=reason;b.voidTs=Date.now();b.voidBy=ME?ME.name:'';if(approved)b.voidApprovedBy=(owner()||{}).name||'Owner';
  b.lines.forEach(function(l){var it=itemById(l.itemId);if(l.stocked&&it)moveStock(it,l.qty,'Void','Bill #'+b.no)});
  save();closeModal();renderView();
}

/* ---------- credit ---------- */
function renderCredit(){
  var rows=S.customers.map(function(c){
    var bills=S.bills.filter(function(b){return b.customerId===c.id&&b.method==='credit'&&b.status!=='void'});
    var cols=S.collections.filter(function(x){return x.customerId===c.id});
    var last=Math.max.apply(null,[0].concat(bills.map(function(b){return b.ts}),cols.map(function(x){return x.ts})));
    return {c:c,bal:balance(c.id),billed:bills.reduce(function(a,b){return a+b.total},0),paid:cols.reduce(function(a,x){return a+x.amount},0),last:last};
  }).sort(function(a,b){return b.bal-a.bal});
  if(!rows.length){$('#credit-table').innerHTML='<div class="empty">No credit customers yet. Choose “Credit” when saving a bill, or add a customer here.</div>';return}
  var total=rows.reduce(function(a,r){return a+r.bal},0);
  $('#credit-table').innerHTML='<table><thead><tr><th>Customer</th><th>Phone</th><th class="r">Billed on credit</th><th class="r">Received</th><th class="r">Balance due</th><th>Last activity</th><th></th></tr></thead><tbody>'+
    rows.map(function(r){return '<tr><td><b>'+esc(r.c.name)+'</b></td><td>'+esc(r.c.phone||'—')+'</td><td class="r num">'+plain(r.billed)+'</td><td class="r num">'+plain(r.paid)+'</td>'+
      '<td class="r num" style="color:'+(r.bal>0?'var(--credit)':'var(--muted)')+';font-weight:700">'+plain(r.bal)+'</td><td>'+(r.last?dfmt(r.last):'—')+'</td>'+
      '<td class="r" style="white-space:nowrap"><button class="btn sm" data-act="ledger" data-id="'+r.c.id+'">Ledger</button> <button class="btn sm primary" data-act="collect" data-id="'+r.c.id+'"'+(r.bal<=0?' disabled':'')+'>Receive payment</button></td></tr>'}).join('')+
    '</tbody><tfoot><tr><td colspan="4">Total receivable</td><td class="r num">'+plain(total)+'</td><td colspan="2"></td></tr></tfoot></table>';
}
function openCollect(id){
  var c=custById(id),bal=balance(id);
  openModal('<div class="modal-head"><h2>Payment from '+esc(c.name)+'</h2><button class="x" data-act="close" aria-label="Close">×</button></div>'+
    '<p class="note">Balance due: <b class="num">'+money(bal)+'</b></p>'+
    '<div class="row"><label class="field"><span>Amount received</span><input id="col-amt" inputmode="numeric" class="num" value="'+r0(bal)+'"></label>'+
    '<label class="field"><span>Received in</span><select id="col-method"><option value="cash">Cash</option><option value="bank">Card / Bank</option></select></label></div>'+
    '<label class="field"><span>Note (optional)</span><input id="col-note" placeholder="e.g. JazzCash, cheque no."></label><p class="msg" id="col-msg"></p>'+
    '<div class="modal-actions"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="collect-save" data-id="'+id+'">Save payment</button></div>');
}
function saveCollect(id){
  var amt=num($('#col-amt').value);if(amt<=0)return msg('#col-msg','Enter the amount received.');
  S.collections.push({id:uid(),ts:Date.now(),customerId:id,amount:r0(amt),method:$('#col-method').value,note:$('#col-note').value.trim(),user:ME?ME.name:''});
  save();closeModal();renderView();
}
function openLedger(id){
  var c=custById(id);
  var ev=S.bills.filter(function(b){return b.customerId===id&&b.method==='credit'&&b.status!=='void'}).map(function(b){return {ts:b.ts,d:'Bill #'+b.no,dr:b.total,cr:0}})
    .concat(S.collections.filter(function(x){return x.customerId===id}).map(function(x){return {ts:x.ts,d:'Payment · '+METHOD[x.method]+(x.note?' · '+x.note:''),dr:0,cr:x.amount}}))
    .sort(function(a,b){return a.ts-b.ts});
  var bal=0;
  openModal('<div class="modal-head"><h2>'+esc(c.name)+'</h2><button class="x" data-act="close" aria-label="Close">×</button></div>'+
    '<div class="tablewrap"><table><thead><tr><th>Date</th><th>Detail</th><th class="r">Billed</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead><tbody>'+
    (ev.length?ev.map(function(e){bal+=e.dr-e.cr;return '<tr><td>'+dfmt(e.ts)+'</td><td>'+esc(e.d)+'</td><td class="r num">'+(e.dr?plain(e.dr):'')+'</td><td class="r num">'+(e.cr?plain(e.cr):'')+'</td><td class="r num">'+plain(bal)+'</td></tr>'}).join(''):'<tr><td colspan="5">No activity yet.</td></tr>')+
    '</tbody></table></div><div class="modal-actions"><button class="btn primary" data-act="close">Close</button></div>',true);
}
function openAddCustomer(){
  openModal('<div class="modal-head"><h2>Add credit customer</h2><button class="x" data-act="close" aria-label="Close">×</button></div>'+
    '<label class="field"><span>Name</span><input id="ac-name"></label><label class="field"><span>Phone</span><input id="ac-phone" inputmode="tel"></label><p class="msg" id="ac-msg"></p>'+
    '<div class="modal-actions"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="add-customer-save">Add customer</button></div>');
}

/* ---------- report ---------- */
function inRange(ts){var k=dkey(ts);return k>=ui.rFrom&&k<=ui.rTo}
function inR(ts,from,to){var k=dkey(ts);return k>=from&&k<=to}
function report(from,to){
  from=from||ui.rFrom;to=to||ui.rTo;var inRange=function(ts){return inR(ts,from,to)};
  var bills=S.bills.filter(function(b){return inRange(b.ts)}),ok=bills.filter(function(b){return b.status!=='void'}),voids=bills.filter(function(b){return b.status==='void'});
  var sum=function(f){return ok.reduce(function(a,b){return a+f(b)},0)};
  var r={bills:ok,count:ok.length,voids:voids,gross:sum(function(b){return b.subtotal}),discount:sum(function(b){return b.discount}),tax:sum(function(b){return b.tax}),total:sum(function(b){return b.total}),
    by:{cash:0,bank:0,credit:0},types:{},items:{},rates:{},users:{}};
  r.net=r.gross-r.discount;
  ok.forEach(function(b){if(b.tax){var rk=String(b.taxRate);if(!r.rates[rk])r.rates[rk]={base:0,tax:0,n:0};r.rates[rk].base+=b.subtotal-b.discount;r.rates[rk].tax+=b.tax;r.rates[rk].n++}r.by[b.method]+=b.total;r.types[b.type]=(r.types[b.type]||0)+b.total;var un=b.user||'Not recorded';if(!r.users[un])r.users[un]={n:0,total:0,cash:0};r.users[un].n++;r.users[un].total+=b.total;if(b.method==='cash')r.users[un].cash+=b.total;
    b.lines.forEach(function(l){var k=l.name;if(!r.items[k])r.items[k]={qty:0,amt:0};r.items[k].qty+=l.qty;r.items[k].amt+=l.qty*l.price})});
  var cols=S.collections.filter(function(c){return inRange(c.ts)});
  r.colCash=cols.filter(function(c){return c.method==='cash'}).reduce(function(a,c){return a+c.amount},0);
  r.colBank=cols.filter(function(c){return c.method==='bank'}).reduce(function(a,c){return a+c.amount},0);
  r.drawer=r.by.cash+r.colCash;
  r.outstanding=S.customers.reduce(function(a,c){return a+Math.max(0,balance(c.id))},0);
  return r;
}
function renderReport(){
  $('#r-from').value=ui.rFrom;$('#r-to').value=ui.rTo;
  $('#report-range').textContent=ui.rFrom===ui.rTo?kfmt(ui.rFrom):kfmt(ui.rFrom)+' to '+kfmt(ui.rTo);
  var r=report(),T=r.total||1;
  var items=Object.keys(r.items).map(function(k){return {n:k,q:r.items[k].qty,a:r.items[k].amt}}).sort(function(a,b){return b.a-a.a});
  var h='<div class="stats">'+
    '<div class="stat"><div class="k">Total sales</div><div class="v">'+money(r.total)+'</div><div class="h">'+r.count+' bills'+(r.voids.length?' · '+r.voids.length+' voided':'')+'</div></div>'+
    '<div class="stat"><div class="k">Cash in drawer</div><div class="v">'+money(r.drawer)+'</div><div class="h">Cash sales + cash collected</div></div>'+
    '<div class="stat"><div class="k">Card / bank</div><div class="v">'+money(r.by.bank+r.colBank)+'</div><div class="h">Sales + bank collections</div></div>'+
    '<div class="stat"><div class="k">Receivable now</div><div class="v">'+money(r.outstanding)+'</div><div class="h">All customers, as of today</div></div></div>';
  h+='<div class="cols2"><div class="stack">';
  h+='<div class="panel"><h2>How sales were paid</h2><div class="split" role="img" aria-label="Cash '+plain(r.by.cash)+', card or bank '+plain(r.by.bank)+', credit '+plain(r.by.credit)+'">'+
    '<i style="width:'+(r.by.cash/T*100)+'%;background:var(--cash)"></i><i style="width:'+(r.by.bank/T*100)+'%;background:var(--bank)"></i><i style="width:'+(r.by.credit/T*100)+'%;background:var(--credit)"></i></div>'+
    '<div class="legend"><span><b style="background:var(--cash)"></b>Cash '+plain(r.by.cash)+'</span><span><b style="background:var(--bank)"></b>Card / bank '+plain(r.by.bank)+'</span><span><b style="background:var(--credit)"></b>Credit '+plain(r.by.credit)+'</span></div></div>';
  h+='<div class="panel"><h2>Accounting entries</h2><p class="sub">Summary journal for the period. Debits equal credits.</p><div class="tablewrap"><table><thead><tr><th></th><th>Account</th><th class="r">Debit</th><th class="r">Credit</th></tr></thead><tbody>'+
    '<tr><td class="dr">Dr</td><td>Cash in hand</td><td class="r num">'+plain(r.by.cash)+'</td><td></td></tr>'+
    '<tr><td class="dr">Dr</td><td>Bank (card / transfer)</td><td class="r num">'+plain(r.by.bank)+'</td><td></td></tr>'+
    '<tr><td class="dr">Dr</td><td>Accounts receivable</td><td class="r num">'+plain(r.by.credit)+'</td><td></td></tr>'+
    '<tr><td class="dr">Cr</td><td>&nbsp;&nbsp;Sales (after discount)</td><td></td><td class="r num">'+plain(r.net)+'</td></tr>'+
    (r.tax?'<tr><td class="dr">Cr</td><td>&nbsp;&nbsp;Sales tax payable'+(S.settings.taxLabel?' ('+esc(S.settings.taxLabel.replace(/ ?Sales Tax/i,''))+')':'')+'</td><td></td><td class="r num">'+plain(r.tax)+'</td></tr>':'')+
    '</tbody><tfoot><tr><td></td><td>Total</td><td class="r num">'+plain(r.total)+'</td><td class="r num">'+plain(r.net+r.tax)+'</td></tr></tfoot></table></div>'+
    ((r.colCash||r.colBank)?'<p class="sub" style="margin-top:12px">Credit collected in the period:</p><div class="tablewrap"><table><tbody>'+
      (r.colCash?'<tr><td class="dr">Dr</td><td>Cash in hand</td><td class="r num">'+plain(r.colCash)+'</td><td></td></tr>':'')+
      (r.colBank?'<tr><td class="dr">Dr</td><td>Bank</td><td class="r num">'+plain(r.colBank)+'</td><td></td></tr>':'')+
      '<tr><td class="dr">Cr</td><td>&nbsp;&nbsp;Accounts receivable</td><td></td><td class="r num">'+plain(r.colCash+r.colBank)+'</td></tr></tbody></table></div>':'')+'</div>';
  h+='<div class="panel"><h2>Bill summary</h2><div class="tablewrap"><table><tbody>'+
    '<tr><td>Gross sales (menu prices)</td><td class="r num">'+plain(r.gross)+'</td></tr><tr><td>Discounts given</td><td class="r num">−'+plain(r.discount)+'</td></tr>'+
    '<tr><td>Sales tax charged</td><td class="r num">'+plain(r.tax)+'</td></tr>'+
    Object.keys(r.rates).sort(function(a,b){return b-a}).map(function(k){var x=r.rates[k];return '<tr><td>&nbsp;&nbsp;at '+k+'% on '+plain(x.base)+' ('+x.n+' bills)</td><td class="r num">'+plain(x.tax)+'</td></tr>'}).join('')+'<tr><td><b>Total billed</b></td><td class="r num"><b>'+plain(r.total)+'</b></td></tr>'+
    Object.keys(r.types).map(function(k){return '<tr><td>'+esc(k)+'</td><td class="r num">'+plain(r.types[k])+'</td></tr>'}).join('')+
    (r.voids.length?'<tr><td>Voided bills ('+r.voids.length+') · not counted</td><td class="r num">'+plain(r.voids.reduce(function(a,b){return a+b.total},0))+'</td></tr>':'')+
    '</tbody></table></div></div>';
  h+='<div class="panel"><h2>Sales by user</h2><div class="tablewrap"><table><thead><tr><th>User</th><th class="r">Bills</th><th class="r">Cash taken</th><th class="r">Total sales</th></tr></thead><tbody>'+
    (Object.keys(r.users).length?Object.keys(r.users).map(function(k){var u=r.users[k];return '<tr><td>'+esc(k)+'</td><td class="r num">'+u.n+'</td><td class="r num">'+plain(u.cash)+'</td><td class="r num">'+plain(u.total)+'</td></tr>'}).join(''):'<tr><td colspan="4">No sales in this period.</td></tr>')+
    '</tbody></table></div></div>';
  h+='</div><div class="stack"><div class="panel"><h2>Item sales</h2><div class="tablewrap"><table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead><tbody>'+
    (items.length?items.map(function(i){return '<tr><td>'+esc(i.n)+'</td><td class="r num">'+i.q+'</td><td class="r num">'+plain(i.a)+'</td></tr>'}).join(''):'<tr><td colspan="3">No sales in this period.</td></tr>')+
    '</tbody></table></div></div>';
  h+='<div class="panel stack"><h2>Export</h2><p class="note">One Excel file with every bill, the items on each bill, item sales, credit payments, menu and stock for this period.</p><div class="row">'+
    (IFRAMED?'<button class="btn" data-act="csv-bills">Copy bills CSV</button><button class="btn" data-act="csv-items">Copy items CSV</button>':'<button class="btn primary" data-act="xlsx-range">Download Excel report</button>')+
    (IFRAMED?'':'<button class="btn" data-act="print-report">Print day-end slip</button>')+'</div>'+printNote()+'<p class="msg" id="export-msg"></p></div></div></div>';
  $('#report-body').innerHTML=h;
}
function reportSlip(){
  var r=report(),s=S.settings;
  var items=Object.keys(r.items).map(function(k){return {n:k,q:r.items[k].qty,a:r.items[k].amt}}).sort(function(a,b){return b.a-a.a});
  var row=function(a,b){return '<tr><td>'+a+'</td><td style="text-align:right">'+b+'</td></tr>'};
  return '<div class="rcpt"><div class="shop">'+esc(s.name)+'</div><div class="c">SALES REPORT</div><div class="c">'+(ui.rFrom===ui.rTo?kfmt(ui.rFrom):kfmt(ui.rFrom)+' – '+kfmt(ui.rTo))+'</div><div class="c">Printed '+dfmt(Date.now())+' '+tme(Date.now())+'</div><hr><table>'+
    row('Bills',r.count)+row('Gross sales',plain(r.gross))+row('Discounts','-'+plain(r.discount))+row('Sales tax',plain(r.tax))+Object.keys(r.rates).sort(function(a,b){return b-a}).map(function(k){return row('&nbsp;&nbsp;@'+k+'% on '+plain(r.rates[k].base),plain(r.rates[k].tax))}).join('')+'<tr class="big"><td>TOTAL</td><td style="text-align:right">'+plain(r.total)+'</td></tr></table><hr><table>'+
    row('Cash sales',plain(r.by.cash))+row('Card / bank sales',plain(r.by.bank))+row('Credit sales',plain(r.by.credit))+row('Credit collected (cash)',plain(r.colCash))+row('Credit collected (bank)',plain(r.colBank))+
    '<tr class="big"><td>CASH IN DRAWER</td><td style="text-align:right">'+plain(r.drawer)+'</td></tr></table>'+
    (Object.keys(r.users).length?'<hr><table>'+Object.keys(r.users).map(function(k){return row(esc(k)+' ('+r.users[k].n+')',plain(r.users[k].total))}).join('')+'</table>':'')+
    (r.voids.length?'<hr><table>'+row('Voided bills',r.voids.length)+row('Voided amount',plain(r.voids.reduce(function(a,b){return a+b.total},0)))+'</table>':'')+
    '<hr><table>'+items.map(function(i){return row(esc(i.n)+' ×'+i.q,plain(i.a))}).join('')+'</table><hr><div class="c">Signature: ____________</div></div>';
}
function csvCell(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function toCSV(rows){return rows.map(function(r){return r.map(csvCell).join(',')}).join('\r\n')}
function exportText(name,text,mime,msgSel){
  if(!IFRAMED){
    try{var blob=new Blob([text],{type:mime}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);msg(msgSel,'Downloaded '+name,true);return}catch(e){}
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){msg(msgSel,'Copied. Paste into Excel or a text file.',true)},function(){showText(name,text)});
  }else showText(name,text);
}
function showText(name,text){
  openModal('<div class="modal-head"><h2>'+esc(name)+'</h2><button class="x" data-act="close" aria-label="Close">×</button></div><p class="note">Select all and copy.</p>'+
    '<label class="field"><textarea id="txt-out" rows="12" style="font-family:var(--f-mono);font-size:12px" readonly>'+esc(text)+'</textarea></label><div class="modal-actions"><button class="btn primary" data-act="close">Done</button></div>',true);
  var t=$('#txt-out');if(t){t.focus();t.select()}
}
function billsCSV(){
  var rows=[['Bill no','Date','Time','Order type','Table/ref','Items','Subtotal','Discount','Tax rate %','Tax','Total','Payment','Customer','Status','Void reason']];
  S.bills.filter(function(b){return inRange(b.ts)}).sort(function(a,b){return a.ts-b.ts}).forEach(function(b){var c=b.customerId?custById(b.customerId):null;
    rows.push([b.no,dkey(b.ts),tme(b.ts),b.type,b.table,b.lines.map(function(l){return l.qty+'x '+l.name}).join('; '),b.subtotal,b.discount,b.taxRate||0,b.tax,b.total,METHOD[b.method],c?c.name:'',b.status==='void'?'Void':'Paid',b.voidReason||''])});
  return toCSV(rows);
}
function itemsCSV(){var r=report(),rows=[['Item','Qty','Amount']];Object.keys(r.items).sort().forEach(function(k){rows.push([k,r.items[k].qty,r.items[k].amt])});return toCSV(rows)}

/* ---------- Excel (.xlsx) writer: builds a real Excel file in the browser, no internet needed ---------- */
var CRC_T=(function(){var t=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){var c=0xFFFFFFFF;for(var i=0;i<b.length;i++)c=CRC_T[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zipBlob(files){
  var enc=new TextEncoder(),parts=[],central=[],off=0;
  files.forEach(function(f){
    var nm=enc.encode(f.name),d=enc.encode(f.text),crc=crc32(d);
    var h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,0,true);h.setUint16(12,0x21,true);
    h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),nm,d);
    var c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,0,true);c.setUint16(14,0x21,true);
    c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
    central.push(new Uint8Array(c.buffer),nm);
    off+=30+nm.length+d.length;
  });
  var cd=central.reduce(function(a,p){return a+p.length},0),e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cd,true);e.setUint32(16,off,true);
  return new Blob(parts.concat(central,[new Uint8Array(e.buffer)]),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function xesc(s){return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function colName(i){var s='';i++;while(i>0){var m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s}
function sheetXml(sh){
  var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>';
  sh.cols.forEach(function(c,i){x+='<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(c.w||14)+'" customWidth="1"/>'});
  x+='</cols><sheetData>';
  [sh.cols.map(function(c){return c.h})].concat(sh.rows).forEach(function(r,ri){
    x+='<row r="'+(ri+1)+'">';
    r.forEach(function(v,ci){if(v===''||v==null)return;var ref=colName(ci)+(ri+1);
      if(ri===0)x+='<c r="'+ref+'" t="inlineStr" s="1"><is><t>'+xesc(v)+'</t></is></c>';
      else if(typeof v==='number'&&isFinite(v))x+='<c r="'+ref+'"'+(sh.cols[ci]&&sh.cols[ci].n?' s="2"':'')+'><v>'+v+'</v></c>';
      else x+='<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xesc(v)+'</t></is></c>';
    });
    x+='</row>';
  });
  x+='</sheetData>';
  if(sh.rows.length&&sh.filter!==false)x+='<autoFilter ref="A1:'+colName(sh.cols.length-1)+(sh.rows.length+1)+'"/>';
  return x+'</worksheet>';
}
function workbook(sheets){
  var X='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',used={};
  var names=sheets.map(function(s){var n=s.name.replace(/[\[\]:*?\/\\]/g,' ').slice(0,31),b=n,k=2;while(used[n.toLowerCase()]){n=b.slice(0,28)+' '+k++}used[n.toLowerCase()]=1;return n});
  var files=[
    {name:'[Content_Types].xml',text:X+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
      sheets.map(function(s,i){return '<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'}).join('')+'</Types>'},
    {name:'_rels/.rels',text:X+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',text:X+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+
      names.map(function(n,i){return '<sheet name="'+xesc(n)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>'}).join('')+'</sheets>'+
      (function(){var d=sheets.map(function(s,i){return s.rows.length&&s.filter!==false?'<definedName name="_xlnm._FilterDatabase" localSheetId="'+i+'" hidden="1">\''+xesc(names[i].replace(/'/g,"''"))+'\'!$A$1:$'+colName(s.cols.length-1)+'$'+(s.rows.length+1)+'</definedName>':''}).join('');return d?'<definedNames>'+d+'</definedNames>':''})()+'</workbook>'},
    {name:'xl/_rels/workbook.xml.rels',text:X+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
      sheets.map(function(s,i){return '<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>'}).join('')+
      '<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/styles.xml',text:X+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'}
  ];
  sheets.forEach(function(s,i){files.push({name:'xl/worksheets/sheet'+(i+1)+'.xml',text:sheetXml(s)})});
  return zipBlob(files);
}
function downloadBlob(name,blob,msgSel){
  if(IFRAMED)return msg(msgSel,'Excel download works on the live site, not inside this preview.');
  try{var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000);msg(msgSel,'Downloaded '+name,true)}catch(e){msg(msgSel,'Could not create the file: '+e.message)}
}
function catName(id){for(var i=0;i<S.categories.length;i++)if(S.categories[i].id===id)return S.categories[i].name;return ''}
function menuSheet(){
  return {name:'Menu & stock',cols:[{h:'Item',w:30},{h:'Category',w:18},{h:'Price (Rs)',w:12,n:1},{h:'On menu',w:10},{h:'Track stock',w:12},{h:'In stock',w:10,n:1},{h:'Low-stock alert at',w:18,n:1}],
    rows:S.items.slice().sort(function(a,b){return catName(a.catId).localeCompare(catName(b.catId))||a.name.localeCompare(b.name)}).map(function(i){
      return [i.name,catName(i.catId),i.price,i.active?'Yes':'No',i.trackStock?'Yes':'No',i.trackStock?num(i.stock):'',i.trackStock?num(i.lowAt):'']})};
}
function allRange(){var ts=S.bills.map(function(b){return b.ts}).concat(S.collections.map(function(c){return c.ts}),S.stockMoves.map(function(m){return m.ts}));
  return ts.length?[dkey(Math.min.apply(null,ts)),today()]:[today(),today()]}
function exportXlsx(from,to,msgSel){
  var r=report(from,to),s=S.settings,inr=function(ts){return inR(ts,from,to)};
  var bills=S.bills.filter(function(b){return inr(b.ts)}).sort(function(a,b){return a.ts-b.ts});
  var sum=[['Restaurant',s.name],['Period',from===to?from:from+' to '+to],['Bills',r.count],['Gross sales (menu prices)',r.gross],['Discounts',r.discount],['Sales tax',r.tax]];
  Object.keys(r.rates).sort(function(a,b){return b-a}).forEach(function(k){sum.push(['  Tax at '+k+'% on '+plain(r.rates[k].base),r.rates[k].tax])});
  sum=sum.concat([['Total sales',r.total],['Cash sales',r.by.cash],['Card / digital sales',r.by.bank],['Credit sales',r.by.credit],['Credit collected in cash',r.colCash],['Credit collected by card / bank',r.colBank],
    ['Cash in drawer',r.drawer]]);sum=sum.concat(Object.keys(r.users).map(function(k){return ['Sales by '+k+' ('+r.users[k].n+' bills)',r.users[k].total]}));sum=sum.concat([['Receivable outstanding (today)',r.outstanding],['Voided bills',r.voids.length],['Voided amount',r.voids.reduce(function(a,b){return a+b.total},0)],['Exported',dfmt(Date.now())+' '+tme(Date.now())]]);
  var sheets=[
    {name:'Summary',filter:false,cols:[{h:'Item',w:36},{h:'Value',w:22,n:1}],rows:sum},
    {name:'Bills',cols:[{h:'Bill no',w:9},{h:'Date',w:12},{h:'Time',w:10},{h:'Order type',w:11},{h:'Table / ref',w:11},{h:'Payment',w:14},{h:'Customer',w:18},{h:'Subtotal',w:11,n:1},{h:'Discount',w:10,n:1},{h:'Tax %',w:8},{h:'Tax',w:9,n:1},{h:'Total',w:11,n:1},{h:'Cash received',w:13,n:1},{h:'Change',w:9,n:1},{h:'Card / txn ref',w:14},{h:'Status',w:8},{h:'Void reason',w:24},{h:'Served by',w:14},{h:'Voided by',w:14}],
      rows:bills.map(function(b){var c=b.customerId?custById(b.customerId):null;return [b.no,dkey(b.ts),tme(b.ts),b.type,b.table,METHOD[b.method],c?c.name:'',b.subtotal,b.discount,b.taxRate||0,b.tax,b.total,b.method==='cash'?b.received:'',b.method==='cash'?b.change:'',b.ref||'',b.status==='void'?'Void':'Paid',b.voidReason||'',b.user||'',b.status==='void'?(b.voidBy||'')+(b.voidApprovedBy?' (approved: '+b.voidApprovedBy+')':''):'']})},
    {name:'Bill items',cols:[{h:'Bill no',w:9},{h:'Date',w:12},{h:'Item',w:30},{h:'Qty',w:7,n:1},{h:'Price',w:10,n:1},{h:'Amount',w:11,n:1},{h:'Status',w:8}],
      rows:[].concat.apply([],bills.map(function(b){return b.lines.map(function(l){return [b.no,dkey(b.ts),l.name,l.qty,l.price,l.qty*l.price,b.status==='void'?'Void':'Paid']})}))},
    {name:'Item sales',cols:[{h:'Item',w:30},{h:'Qty sold',w:10,n:1},{h:'Amount',w:12,n:1}],
      rows:Object.keys(r.items).map(function(k){return [k,r.items[k].qty,r.items[k].amt]}).sort(function(a,b){return b[2]-a[2]})},
    {name:'Credit payments',cols:[{h:'Date',w:12},{h:'Time',w:10},{h:'Customer',w:22},{h:'Amount',w:12,n:1},{h:'Received in',w:14},{h:'Note',w:24},{h:'Taken by',w:14}],
      rows:S.collections.filter(function(c){return inr(c.ts)}).sort(function(a,b){return a.ts-b.ts}).map(function(c){var cu=custById(c.customerId);return [dkey(c.ts),tme(c.ts),cu?cu.name:'',c.amount,METHOD[c.method]||c.method,c.note||'',c.user||'']})},
    {name:'Customers',cols:[{h:'Customer',w:24},{h:'Phone',w:16},{h:'Balance due (today)',w:18,n:1}],
      rows:S.customers.map(function(c){return [c.name,c.phone||'',balance(c.id)]})},
    menuSheet(),
    {name:'Stock movements',cols:[{h:'Date',w:12},{h:'Time',w:10},{h:'Item',w:30},{h:'Change',w:9,n:1},{h:'Stock after',w:11,n:1},{h:'Reason',w:16},{h:'Reference / note',w:22}],
      rows:S.stockMoves.filter(function(m){return inr(m.ts)}).sort(function(a,b){return a.ts-b.ts}).map(function(m){return [dkey(m.ts),tme(m.ts),m.name,m.change,m.after,m.reason,m.ref||'']})}
  ];
  var safe=(s.name||'POS').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'')||'POS';
  downloadBlob(safe+'_sales_'+(from===to?from:from+'_to_'+to)+'.xlsx',workbook(sheets),msgSel);
}

/* ---------- menu & stock ---------- */
var menuDraft={},menuQ='',menuCat='all';
function draftCount(){return Object.keys(menuDraft).length}
function iv(i,f){var d=menuDraft[i.id];return d&&Object.prototype.hasOwnProperty.call(d,f)?d[f]:i[f]}
function catOpts(sel){return S.categories.map(function(c){return '<option value="'+esc(c.id)+'"'+(c.id===sel?' selected':'')+'>'+esc(c.name)+'</option>'}).join('')}
function renderMenu(){
  $('#cat-list').innerHTML=S.categories.map(function(c){
    var n=S.items.filter(function(i){return i.catId===c.id}).length;
    return '<div class="catrow"><input data-cat-name="'+esc(c.id)+'" value="'+esc(c.name)+'" aria-label="Category name"><span class="cnt">'+n+' items</span>'+
      '<button class="btn sm danger" data-act="del-cat" data-id="'+esc(c.id)+'"'+(n?' disabled title="Move or delete its items first"':'')+' aria-label="Delete category">×</button></div>';
  }).join('')||'<p class="note">No categories yet.</p>';
  var low=lowItems();
  $('#low-list').innerHTML=low.length?'<table><tbody>'+low.map(function(i){return '<tr><td>'+esc(i.name)+'</td><td class="r">'+stockTag(num(i.stock),i.lowAt)+'</td><td class="r"><button class="btn sm" data-act="restock" data-id="'+i.id+'">Update</button></td></tr>'}).join('')+'</tbody></table>':'<p class="note">Nothing is low on stock.</p>';
  var nc=$('#ni-cat'),cur=nc.value;nc.innerHTML=catOpts(cur||(S.categories[0]&&S.categories[0].id));
  $('#menu-cat').innerHTML='<option value="all">All categories</option>'+catOpts(menuCat);
  $('#menu-q').value=menuQ;
  renderItemTable();
  $('#xlsx-menu-btn').hidden=IFRAMED;
}
function renderItemTable(){
  var q=menuQ.trim().toLowerCase();
  var order={};S.categories.forEach(function(c,ix){order[c.id]=ix});
  var list=S.items.filter(function(i){return (menuCat==='all'||i.catId===menuCat)&&(!q||i.name.toLowerCase().indexOf(q)>=0)})
    .sort(function(a,b){return (order[a.catId]||0)-(order[b.catId]||0)||a.name.localeCompare(b.name)});
  $('#item-table').innerHTML=list.length?'<table><thead><tr><th>Item</th><th>Category</th><th class="r">Price (Rs)</th><th>On menu</th><th>Track stock</th><th class="r">In stock</th><th class="r">Alert at</th><th></th></tr></thead><tbody>'+
    list.map(function(i){var tr=iv(i,'trackStock');
      return '<tr data-row="'+i.id+'"'+(menuDraft[i.id]?' class="changed"':'')+'><td style="min-width:180px"><input data-item="'+i.id+'" data-f="name" value="'+esc(iv(i,'name'))+'" aria-label="Item name"></td>'+
      '<td style="min-width:130px"><select data-item="'+i.id+'" data-f="catId" aria-label="Category">'+catOpts(iv(i,'catId'))+'</select></td>'+
      '<td class="r"><input class="price" data-item="'+i.id+'" data-f="price" value="'+iv(i,'price')+'" inputmode="numeric" aria-label="Price"></td>'+
      '<td><input type="checkbox" class="toggle" data-item="'+i.id+'" data-f="active"'+(iv(i,'active')?' checked':'')+' aria-label="Show on menu"></td>'+
      '<td><input type="checkbox" class="toggle" data-item="'+i.id+'" data-f="trackStock"'+(tr?' checked':'')+' aria-label="Track stock"></td>'+
      '<td class="r" style="white-space:nowrap">'+(i.trackStock?stockTag(num(i.stock),i.lowAt)+' <button class="btn sm" data-act="restock" data-id="'+i.id+'">Update</button>':'<span class="note">'+(tr?'Save first':'Not tracked')+'</span>')+'</td>'+
      '<td class="r"><input class="price" style="max-width:70px" data-item="'+i.id+'" data-f="lowAt" value="'+iv(i,'lowAt')+'" inputmode="numeric" aria-label="Low stock alert level"'+(tr?'':' disabled')+'></td>'+
      '<td class="r"><button class="btn sm danger" data-act="del-item" data-id="'+i.id+'">Delete</button></td></tr>'}).join('')+'</tbody></table>':'<div class="empty">No items match. Add one above.</div>';
  renderSaveBar();
}
function renderSaveBar(){
  var n=draftCount();$('#menu-savebar').hidden=!n;
  if(n)$('#menu-savebar-text').textContent=n+(n===1?' item has':' items have')+' unsaved changes.';
}
function stageItem(el){
  var it=itemById(el.dataset.item);if(!it)return;var f=el.dataset.f,v;
  if(el.type==='checkbox')v=el.checked;
  else if(f==='price'||f==='lowAt'){v=r0(num(el.value));if(v<0)v=0}
  else if(f==='name'){v=el.value.trim();if(!v)return}
  else v=el.value;
  var d=menuDraft[it.id]||{};
  if(v===it[f])delete d[f];else d[f]=v;
  if(Object.keys(d).length)menuDraft[it.id]=d;else delete menuDraft[it.id];
  var row=el.closest('tr');if(row){row.classList.toggle('changed',!!menuDraft[it.id]);
    if(f==='trackStock'){var lw=row.querySelector('[data-f="lowAt"]');if(lw)lw.disabled=!v}}
  msg('#menu-msg','');renderSaveBar();
}
function saveMenuDraft(){
  var n=draftCount();
  Object.keys(menuDraft).forEach(function(id){var it=itemById(id),d=menuDraft[id];if(!it)return;
    Object.keys(d).forEach(function(f){it[f]=d[f]});
    if(d.trackStock===true&&it.stock==null)it.stock=0;});
  menuDraft={};save();return n;
}
function openBulkPrice(){
  openModal('<div class="modal-head"><h2>Change prices by %</h2><button class="x" data-act="close" aria-label="Close">×</button></div>'+
    '<p class="note">Use a minus sign to lower prices, for example −5. You will see the new prices in the table before anything is saved.</p>'+
    '<div class="row"><label class="field"><span>Change (%)</span><input id="bp-pct" inputmode="decimal" class="num" placeholder="e.g. 10"></label>'+
    '<label class="field"><span>Round to nearest</span><select id="bp-round"><option value="1">Rs 1</option><option value="5">Rs 5</option><option value="10" selected>Rs 10</option></select></label></div>'+
    '<label class="field"><span>Which items</span><select id="bp-cat"><option value="all">All items</option>'+catOpts('')+'</select></label><p class="msg" id="bp-msg"></p>'+
    '<div class="modal-actions"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="bulk-price-apply">Show new prices</button></div>');
}
function applyBulkPrice(){
  var p=num($('#bp-pct').value),rd=num($('#bp-round').value)||1,cat=$('#bp-cat').value;
  if(!p)return msg('#bp-msg','Enter a percentage, for example 10 or -5.');
  var n=0;
  S.items.forEach(function(i){if(cat!=='all'&&i.catId!==cat)return;var base=iv(i,'price');var np=Math.max(0,Math.round(base*(1+p/100)/rd)*rd);
    if(np!==base){var d=menuDraft[i.id]||{};if(np===i.price)delete d.price;else d.price=np;if(Object.keys(d).length)menuDraft[i.id]=d;else delete menuDraft[i.id];n++}});
  closeModal();menuCat=cat;renderMenu();
  msg('#menu-msg',n?n+' prices changed in the table. Check them, then press Save changes.':'No prices changed.',!!n);
}
function openRestock(id){
  var it=itemById(id);if(!it)return;
  openModal('<div class="modal-head"><h2>Stock: '+esc(it.name)+'</h2><button class="x" data-act="close" aria-label="Close">×</button></div>'+
    '<p>Now in stock: <b class="num">'+plain(num(it.stock))+'</b></p>'+
    '<label class="radio"><input type="radio" name="rs-mode" value="add" checked><span><b>New stock received</b><br><span class="note">Adds to what is already there.</span></span></label>'+
    '<label class="radio"><input type="radio" name="rs-mode" value="set"><span><b>Stock count</b><br><span class="note">You counted the shelf. Sets stock to exactly this number.</span></span></label>'+
    '<div class="row"><label class="field"><span>Quantity</span><input id="rs-qty" inputmode="numeric" class="num"></label><label class="field"><span>Note (optional)</span><input id="rs-note" placeholder="e.g. supplier, bill no."></label></div>'+
    '<p class="msg" id="rs-msg"></p><div class="modal-actions"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="restock-save" data-id="'+id+'">Save stock</button></div>');
}
function saveRestock(id){
  var it=itemById(id),mode=($('input[name="rs-mode"]:checked')||{}).value,raw=$('#rs-qty').value.trim(),q=r0(num(raw)),note=$('#rs-note').value.trim();
  if(raw===''||(mode==='add'&&q<=0)||q<0)return msg('#rs-msg',mode==='add'?'Enter how many came in.':'Enter the number you counted.');
  var change=mode==='add'?q:q-num(it.stock);
  moveStock(it,change,mode==='add'?'Stock received':'Stock count',note);
  save();closeModal();renderView();
  if(ui.tab==='menu')msg('#menu-msg',it.name+': stock is now '+plain(it.stock)+'.',true);
}

/* ---------- settings ---------- */
function renderSettings(){
  $$('[data-setting]').forEach(function(el){var k=el.dataset.setting;if(el.type==='checkbox')el.checked=!!S.settings[k];else el.value=S.settings[k]==null?'':S.settings[k]});
  $('#tax-regime').value=S.settings.taxRegime||'custom';
  $('#backup-btn').textContent=IFRAMED?'Copy backup':'Download backup';
  $('#xlsx-all-btn').hidden=IFRAMED;
  renderUsers();
  var info=(DB?'Database: this computer (browser database)':'Storage: basic browser storage')+' · '+S.bills.length+' bills · '+S.items.length+' menu items · '+S.stockMoves.length+' stock entries';
  $('#db-info').textContent=info;
  try{if(navigator.storage&&navigator.storage.estimate)navigator.storage.estimate().then(function(e){if(e&&e.usage!=null)$('#db-info').textContent=info+' · '+(e.usage/1048576).toFixed(1)+' MB used'})}catch(e){}
}

function renderUsers(){
  $('#user-list').innerHTML=S.users.map(function(u){
    return '<div class="user-row"><label>Display name<input data-user-name="'+u.id+'" value="'+esc(u.name)+'"></label><label>Username<input data-user-login="'+u.id+'" value="'+esc(u.username)+'" autocapitalize="none" spellcheck="false"></label><span class="role">'+ROLE_NAME[u.role]+'</span><button class="btn sm" data-act="pin-change" data-id="'+u.id+'">Change password</button></div>'+
      (u.pinHash?'':'<p class="note" style="margin:-4px 0 0">Still using the starting password. Change it before real use.</p>');
  }).join('');
}
function openPinChange(id){
  var u=userById(id);
  openModal('<div class="modal-head"><h2>New password for '+esc(u.name)+'</h2><button class="x" data-act="close" aria-label="Close">×</button></div>'+
    '<div class="row"><label class="field"><span>New password (at least 6 characters)</span><input id="pin-new" type="password" autocomplete="new-password"></label>'+
    '<label class="field"><span>Type it again</span><input id="pin-again" type="password" autocomplete="new-password"></label></div><p class="msg" id="pin-msg"></p>'+
    '<div class="modal-actions"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="pin-save" data-id="'+id+'">Save password</button></div>');
}
function savePin(id){
  var a=$('#pin-new').value,b=$('#pin-again').value,u=userById(id);
  if(a.length<6)return msg('#pin-msg','Use at least 6 characters.');
  if(a!==b)return msg('#pin-msg','The two passwords do not match.');
  hashPin(a).then(function(hs){u.pinHash=hs;delete u.defPin;save();closeModal();renderUsers();msg('#user-msg','Password changed for '+u.name+'.',true)});
}
/* ---------- login ---------- */
function showLogin(){
  ME=null;try{sessionStorage.removeItem('sales-pos-user')}catch(e){}
  $('#login-shop').textContent=S.settings.name||'Restaurant';
  var defs=S.users.filter(function(u){return !u.pinHash});
  $('#login-hint').textContent=defs.length?'Starting logins: '+defs.map(function(u){return ROLE_NAME[u.role]+' '+u.username+' / '+u.defPin}).join(', ')+'. The Owner should change them in Settings.':'';
  $('#login-user').value='';$('#login-pin').value='';msg('#login-msg','');
  $('#login').hidden=false;closeModal();
  setTimeout(function(){try{$('#login-user').focus()}catch(e){}},50);
}
function doLogin(){
  var u=userByName($('#login-user').value),pin=$('#login-pin').value;
  if(!$('#login-user').value.trim()||!pin)return msg('#login-msg','Enter your username and password.');
  checkPin(u,pin).then(function(ok){
    if(!ok){$('#login-pin').value='';return msg('#login-msg','Username or password is not correct.')}
    ME=u;try{sessionStorage.setItem('sales-pos-user',u.id)}catch(e){}
    $('#login').hidden=true;ui.q='';ui.cat='all';$('#q').value='';setTab('bill');
  });
}

/* ---------- armed (two-step) buttons ---------- */
function armed(btn){
  if(btn.dataset.armed)return true;
  btn.dataset.armed='1';var old=btn.textContent;btn.dataset.old=old;btn.textContent='Sure? Click again';
  setTimeout(function(){if(btn.isConnected){delete btn.dataset.armed;btn.textContent=btn.dataset.old}},3500);
  return false;
}

/* ---------- events ---------- */
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');
  if(!t){if(e.target.id==='overlay')closeModal();return}
  var a=t.dataset.act,v=t.dataset.v,id=t.dataset.id;
  switch(a){
    case 'tab':setTab(v);break;
    case 'cat':ui.cat=v;renderPOS();break;
    case 'add':addItem(id);break;
    case 'inc':cart.lines[+t.dataset.ix].qty++;renderItems();renderCart(false);break;
    case 'dec':var l=cart.lines[+t.dataset.ix];l.qty--;if(l.qty<=0)cart.lines.splice(+t.dataset.ix,1);renderItems();renderCart(false);break;
    case 'type':cart.type=v;renderCart(false);break;
    case 'method':cart.method=v;renderCart(true);break;
    case 'rec':cart.received=v==='exact'?String(totals(cart).total):v;$('#cash-rec').value=cart.received;renderChange();break;
    case 'clear-cart':if(!cart.lines.length||armed(t)){cart=newCart();renderPOS();msg('#cart-msg','')}break;
    case 'save-bill':saveBill();break;
    case 'close':closeModal();break;
    case 'print-bill':var pb=S.bills.find(function(b){return b.id===id});if(pb)printHTML(receiptHTML(pb));break;
    case 'view-bill':var vb=S.bills.find(function(b){return b.id===id});if(vb)showReceipt(vb,false);break;
    case 'void-start':startVoid(id);break;
    case 'void-confirm':confirmVoid(id);break;
    case 'collect':openCollect(id);break;
    case 'collect-save':saveCollect(id);break;
    case 'ledger':openLedger(id);break;
    case 'add-customer':openAddCustomer();break;
    case 'add-customer-save':var nm=$('#ac-name').value.trim();if(!nm)return msg('#ac-msg','Enter a name.');S.customers.push({id:uid(),name:nm,phone:$('#ac-phone').value.trim()});save();closeModal();renderView();break;
    case 'range':
      var d=new Date();
      if(v==='today'){ui.rFrom=ui.rTo=today()}
      else if(v==='yesterday'){d.setDate(d.getDate()-1);ui.rFrom=ui.rTo=dkey(d)}
      else{ui.rFrom=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-01';ui.rTo=today()}
      renderReport();break;
    case 'csv-bills':exportText('bills_'+ui.rFrom+'_to_'+ui.rTo+'.csv',billsCSV(),'text/csv','#export-msg');break;
    case 'csv-items':exportText('item_sales_'+ui.rFrom+'_to_'+ui.rTo+'.csv',itemsCSV(),'text/csv','#export-msg');break;
    case 'print-report':printHTML(reportSlip());break;
    case 'del-cat':if(armed(t)){S.categories=S.categories.filter(function(c){return c.id!==id});if(ui.cat===id)ui.cat='all';save();renderMenu()}break;
    case 'del-item':if(armed(t)){S.items=S.items.filter(function(i){return i.id!==id});delete menuDraft[id];cart.lines=cart.lines.filter(function(l){return l.itemId!==id});save();renderMenu()}break;
    case 'menu-save':var ns=saveMenuDraft();renderMenu();renderHeader();msg('#menu-msg','Saved '+ns+(ns===1?' item.':' items.'),true);break;
    case 'menu-discard':menuDraft={};renderMenu();msg('#menu-msg','Changes discarded.');break;
    case 'menu-save-go':saveMenuDraft();closeModal();setTab(v);break;
    case 'menu-discard-go':menuDraft={};closeModal();setTab(v);break;
    case 'bulk-price':openBulkPrice();break;
    case 'lock':if(ui.tab==='menu'&&draftCount()){setTab('bill');break}showLogin();break;
    case 'pin-change':openPinChange(id);break;
    case 'pin-save':savePin(id);break;
    case 'bulk-price-apply':applyBulkPrice();break;
    case 'restock':openRestock(id);break;
    case 'restock-save':saveRestock(id);break;
    case 'xlsx-range':exportXlsx(ui.rFrom,ui.rTo,'#export-msg');break;
    case 'xlsx-all':var ar=allRange();exportXlsx(ar[0],ar[1],'#data-msg');break;
    case 'xlsx-menu':downloadBlob('Menu_and_stock_'+today()+'.xlsx',workbook([menuSheet()]),'#menu-msg');break;
    case 'backup':exportText('pos_backup_'+today()+'.json',JSON.stringify(S,null,1),'application/json','#data-msg');break;
    case 'clear-samples':
      S.bills=S.bills.filter(function(b){return !b.sample});S.collections=S.collections.filter(function(c){return !c.sample});
      var used={};S.bills.forEach(function(b){if(b.customerId)used[b.customerId]=1});S.collections.forEach(function(c){used[c.customerId]=1});
      S.customers=S.customers.filter(function(c){return !c.sample||used[c.id]});
      if(!S.bills.length)S.settings.nextNo=1001;
      if(S.settings.name==='Sample Restaurant'){save();setTab('settings');msg('#data-msg','Sample bills removed. Now enter the restaurant name and address.',true);var f=$('[data-setting="name"]');f.focus();f.select();return}
      save();renderView();msg('#data-msg','Sample bills removed.',true);break;
    case 'erase-all':
      openModal('<div class="modal-head"><h2>Erase everything?</h2><button class="x" data-act="close" aria-label="Close">×</button></div><p>This deletes every bill, customer, payment and the whole menu from this computer. Take a backup first.</p>'+
        '<label class="field"><span>Type ERASE to confirm</span><input id="erase-word" autocomplete="off"></label><p class="msg" id="erase-msg"></p><div class="modal-actions"><button class="btn" data-act="close">Cancel</button><button class="btn danger" data-act="erase-confirm">Erase everything</button></div>');break;
    case 'erase-confirm':
      if($('#erase-word').value.trim().toUpperCase()!=='ERASE')return msg('#erase-msg','Type ERASE to confirm.');
      var keep=S.settings;S={settings:keep,users:S.users,categories:[],items:[],bills:[],customers:[],collections:[],stockMoves:[],_seededCart:true};menuDraft={};S.settings.nextNo=1001;cart=newCart();save();closeModal();setTab('menu');break;
    case 'restore-confirm':
      if(pendingRestore){S=pendingRestore;pendingRestore=null;migrate();menuDraft={};cart=newCart();save();closeModal();showLogin()}break;
  }
});
document.addEventListener('input',function(e){
  var el=e.target,id=el.id;
  if(id==='q'){ui.q=el.value;renderItems();return}
  if(id==='cart-table'){cart.table=el.value;return}
  if(id==='cart-discount'){cart.discount=el.value;renderSum();return}
  if(id==='cash-rec'){cart.received=el.value;renderChange();return}
  if(id==='bank-ref'){cart.ref=el.value;return}
  if(id==='cust-name'){cart.custName=el.value;return}
  if(id==='cust-phone'){cart.custPhone=el.value;return}
  if(id==='bills-q'){ui.billsQ=el.value;renderBills();return}
  if(id==='menu-q'){menuQ=el.value;renderItemTable();return}
  if(el.dataset.item&&el.type!=='checkbox'&&el.tagName==='INPUT'){stageItem(el);return}
  if(el.dataset.setting&&el.type!=='checkbox'){var k=el.dataset.setting;S.settings[k]=['taxCash','taxCard','nextNo'].indexOf(k)>=0?num(el.value):el.value;
    if((k==='taxCash'||k==='taxCard')&&S.settings.taxRegime!=='custom'){S.settings.taxRegime='custom';$('#tax-regime').value='custom'}
    save();renderHeader();return}
});
document.addEventListener('change',function(e){
  var el=e.target,id=el.id;
  if(id==='tax-regime'){if(el.value==='custom')S.settings.taxRegime='custom';else applyTaxPreset(S,el.value);save();renderSettings();msg('#data-msg','');return}
  if(id==='cust-sel'){cart.customerId=el.value;renderPayExtra();if(el.value==='__new'){var n=$('#cust-name');if(n)n.focus()}return}
  if(id==='bills-date'){ui.billsDate=el.value||today();ui.billsQ='';renderBills();return}
  if(id==='r-from'||id==='r-to'){ui.rFrom=$('#r-from').value||today();ui.rTo=$('#r-to').value||ui.rFrom;if(ui.rTo<ui.rFrom){var x=ui.rFrom;ui.rFrom=ui.rTo;ui.rTo=x}renderReport();return}
  if(el.dataset.setting&&el.type==='checkbox'){S.settings[el.dataset.setting]=el.checked;save();return}
  if(el.dataset.userName){var uu=userById(el.dataset.userName);if(uu&&el.value.trim()){uu.name=el.value.trim();if(ME&&ME.id===uu.id)ME=uu;save();renderHeader();msg('#user-msg','Name saved.',true)}return}
  if(el.dataset.userLogin){var ul=userById(el.dataset.userLogin),nv=el.value.trim().toLowerCase();
    if(!/^[a-z0-9._-]{3,20}$/.test(nv)){el.value=ul.username;return msg('#user-msg','Username: 3 to 20 letters or numbers, no spaces.')}
    var other=userByName(nv);if(other&&other.id!==ul.id){el.value=ul.username;return msg('#user-msg','That username is already used.')}
    ul.username=nv;el.value=nv;save();msg('#user-msg','Username saved.',true);return}
  if(el.dataset.catName){var c=S.categories.find(function(x){return x.id===el.dataset.catName});if(c&&el.value.trim()){c.name=el.value.trim();save()}renderMenu();return}
  if(el.dataset.item){stageItem(el);return}
  if(id==='menu-cat'){menuCat=el.value;renderItemTable();return}
  if(id==='restore-file'&&el.files&&el.files[0]){
    var rd=new FileReader();rd.onload=function(){
      try{var d=JSON.parse(rd.result);if(!d||!d.settings||!Array.isArray(d.items)||!Array.isArray(d.bills))throw new Error('x');
        ['bills','customers','collections','items','categories'].forEach(function(k){if(!Array.isArray(d[k]))d[k]=[]});
        pendingRestore=d;
        openModal('<div class="modal-head"><h2>Restore this backup?</h2><button class="x" data-act="close" aria-label="Close">×</button></div><p>The backup has <b>'+d.bills.length+'</b> bills and <b>'+d.items.length+'</b> menu items. It replaces everything currently on this computer.</p><div class="modal-actions"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="restore-confirm">Replace with backup</button></div>');
      }catch(err){msg('#data-msg','That file is not a POS backup. Choose a file named like pos_backup_2026-10-23.json.')}
      el.value='';
    };rd.readAsText(el.files[0]);
  }
});
var pendingRestore=null;
$('#login-form').addEventListener('submit',function(e){e.preventDefault();doLogin()});
$('#cat-form').addEventListener('submit',function(e){e.preventDefault();var v=$('#new-cat').value.trim();if(!v)return;S.categories.push({id:uid(),name:v});save();$('#new-cat').value='';renderMenu()});
$('#item-form').addEventListener('submit',function(e){
  e.preventDefault();var n=$('#ni-name').value.trim(),p=num($('#ni-price').value),c=$('#ni-cat').value;
  if(!n)return msg('#menu-msg','Enter the item name.');if(p<=0)return msg('#menu-msg','Enter a price above 0.');if(!c)return msg('#menu-msg','Add a category first.');
  var os=$('#ni-stock').value.trim(),ni={id:uid(),name:n,price:r0(p),catId:c,active:true,trackStock:os!=='',stock:0,lowAt:5};
  S.items.push(ni);if(os!=='')moveStock(ni,r0(num(os)),'Opening stock','');
  save();$('#ni-name').value='';$('#ni-price').value='';$('#ni-stock').value='';renderMenu();renderHeader();msg('#menu-msg','Added '+n,true);$('#ni-name').focus();
});
document.addEventListener('keydown',function(e){
  if(!$('#login').hidden)return;
  if(e.key==='Escape'&&!$('#overlay').hidden){closeModal();return}
  if(ui.tab!=='bill'||!$('#overlay').hidden)return;
  var typing=/INPUT|SELECT|TEXTAREA/.test(document.activeElement&&document.activeElement.tagName);
  if(e.key==='/'&&!typing){e.preventDefault();$('#q').focus();return}
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();saveBill();return}
  if(e.key==='Enter'&&document.activeElement&&document.activeElement.id==='q'){var v=visibleItems();if(v.length){addItem(v[0].id);$('#q').select()}}
});
if(BC)BC.onmessage=function(){loadState().then(function(st){if(st){S=st;migrate();if(ME){ME=userById(ME.id);if(!ME){showLogin();return}}renderView()}})};

/* ---------- boot ---------- */
function start(st){
  S=st||seed();migrate();save();seedCart();
  if(IFRAMED)$('#data-note').textContent='In this preview, data is stored only in your browser for this page. Excel download and backups work on the live site.';
  tick();setInterval(tick,30000);
  var sid=null;try{sid=sessionStorage.getItem('sales-pos-user')}catch(e){}
  ME=sid?userById(sid):null;
  if(ME){ui.tab='bill';setTab('bill')}else{renderHeader();showLogin()}
  window.__pos={get state(){return S},totals:totals,ready:true};
}
idbOpen().then(function(db){DB=db;try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}},function(){DB=null})
  .then(loadState).then(start,function(){DB=null;start(lsLoad())});
if(!IFRAMED&&'serviceWorker' in navigator&&location.protocol==='https:'){try{navigator.serviceWorker.register('sw.js').catch(function(){})}catch(e){}}
})();

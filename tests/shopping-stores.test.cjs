const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync(require('node:path').join(__dirname,'../stores.js'),'utf8');
function fixture(){
 const db=new Map(),events=[],context={
   window:{dispatchEvent:e=>events.push(e.type)},
   localStorage:{getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v)},
   crypto:{randomUUID:(()=>{let n=0;return ()=>'id-'+(++n)})()},
   Event:class Event{constructor(type){this.type=type}},
   confirm:()=>true,document:{getElementById:()=>null},Number,Date,
   Option:class Option{constructor(a,b){this.textContent=a;this.value=b}}
 };
 vm.runInNewContext(code,context);
 return {api:context.window.MyDayStores,db,events};
}
test('store creation is idempotent and updates are immutable',()=>{
 const {api}=fixture();
 const a=api.ensure('Home Hardware'),b=api.ensure(' home hardware ');
 assert.equal(a.id,b.id);
 api.update(a.id,{lat:49.7,lon:-112.8,enabled:true});
 assert.equal(api.read().length,1);
 assert.equal(api.read()[0].lat,49.7);
});
test('spoken store list targets a store and preserves other text',()=>{
 const {api}=fixture();
 api.ensure('Costco');
 const d=api.parseDestination('add coffee and paper towels to my Costco list');
 assert.equal(d.text,'add coffee and paper towels');
 assert.equal(d.storeName,'Costco');
 const generic=api.parseDestination('add milk to my shopping list');
 assert.equal(generic.storeName,null);
});
test('existing unassigned shopping items remain intact and deleting a store reassigns',()=>{
 const {api,db}=fixture();
 const s=api.ensure('Costco');
 db.set('running-tab-shopping-v1',JSON.stringify([{id:'old',name:'Milk',done:false},{id:'new',name:'Coffee',storeId:s.id,done:false}]));
 api.remove(s.id);
 assert.equal(api.read().length,0);
 const items=JSON.parse(db.get('running-tab-shopping-v1'));
 assert.equal(items.length,2);
 assert.equal(items[0].name,'Milk');
 assert.equal(items[1].storeId,null);
});

test('general shopping requests never inherit the selected store',()=>{
 const {api}=fixture();
 api.ensure('Home Hardware');
 const generic=api.parseDestination('add screws to my shopping list');
 assert.equal(generic.text,'add screws');
 assert.equal(generic.storeName,null);
 const named=api.parseDestination('add screws to my Home Hardware list');
 assert.equal(named.storeName,'Home Hardware');
 const noStore=api.parseDestination('buy milk');
 assert.equal(noStore.storeName,null);
 const index=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 assert.match(index,/fillSelect\(\$\('shoppingStore'\),'',dest\.storeName\)/);
});
test('store configuration is collapsible without hiding active shopping items',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 const panel=fs.readFileSync(require('node:path').join(__dirname,'../shopping-panel.js'),'utf8');
 assert.match(html,/<details class="shop-setup" id="shopSetupDetails">/);
 assert.match(panel,/details class="shop-store-tools"/);
 assert.match(panel,/openSettings/);
});

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../stores.js'),'utf8');
function fixture(){
 const db=new Map(),events=[],context={
  window:{dispatchEvent:e=>events.push(e.type),alert:()=>{}},
  localStorage:{getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v)},
  crypto:{randomUUID:(()=>{let n=0;return ()=>'id-'+(++n)})()},
  Event:class Event{constructor(type){this.type=type}},
  confirm:()=>true,document:{getElementById:()=>null},
  Number,Date,Option:class Option{constructor(text,value){this.text=text;this.value=value}}
 };
 vm.runInNewContext(code,context);
 return {api:context.window.MyDayStores,db,events};
}
const json=value=>JSON.parse(JSON.stringify(value));
test('store creation is idempotent and location properties stay intact',()=>{
 const {api}=fixture();
 const a=api.ensure('Home Hardware'),b=api.ensure(' home hardware ');
 assert.equal(a.id,b.id);
 api.update(a.id,{lat:49.7,lon:-112.8,enabled:true});
 assert.equal(api.read().length,1);
 assert.equal(api.read()[0].lat,49.7);
});
test('generic commands select no tags, even when named stores exist',()=>{
 const {api}=fixture();
 api.ensure('Costco');
 for(const phrase of ['add bread to my shopping list','add bread to my general shopping list','buy bread']){
  const value=api.parseDestination(phrase);
  assert.equal(value.storeName,null,phrase);
  assert.deepEqual(json(value.storeNames),[],phrase);
 }
 assert.equal(api.parseDestination('add bread to my shopping list').text,'add bread');
});
test('voice can add multiple named tags to a single item',()=>{
 const {api}=fixture();
 api.ensure('Costco');api.ensure('Local Grocery');
 const a=api.parseDestination('add bread to Costco and Local Grocery lists');
 assert.equal(a.text,'add bread');
 assert.deepEqual(json(a.storeNames),['Costco','Local Grocery']);
 const b=api.parseDestination('add plywood to Costco');
 assert.deepEqual(json(b.storeNames),['Costco']);
 const c=api.parseDestination('add bread to a Home Hardware list');
 assert.deepEqual(json(c.storeNames),['Home Hardware']);
});
test('old one-store records are read as a single tag without bulk migration',()=>{
 const {api,db}=fixture(),store=api.ensure('Home Hardware');
 const old={id:'a',name:'Glue',done:false,storeId:store.id};
 db.set('running-tab-shopping-v1',JSON.stringify([old]));
 assert.deepEqual(json(api.tags(old)),[store.id]);
 assert.equal(db.get('running-tab-shopping-v1'),JSON.stringify([old]));
 const updated=api.setTags(old,[store.id,'second',store.id]);
 assert.deepEqual(json(api.tags(updated)),[store.id,'second']);
 assert.equal(updated.storeId,null);
 assert.equal(old.storeId,store.id);
});
test('deleting one store only removes that tag and preserves other tags and items',()=>{
 const {api,db}=fixture();
 const home=api.ensure('Home Hardware'),other=api.ensure('Challenger');
 db.set('running-tab-shopping-v1',JSON.stringify([
  {id:'old',name:'Spray foam',done:false,storeId:home.id},
  {id:'multi',name:'Deck screws',done:false,storeIds:[home.id,other.id],storeId:null},
  {id:'untagged',name:'Milk',done:false}
 ]));
 api.remove(home.id);
 const updated=JSON.parse(db.get('running-tab-shopping-v1'));
 assert.equal(updated.length,3);
 assert.deepEqual(json(api.tags(updated[0])),[]);
 assert.deepEqual(json(api.tags(updated[1])),[other.id]);
 assert.deepEqual(json(api.tags(updated[2])),[]);
 assert.equal(api.read().length,1);
});
test('shopping page is one list with tag filters and controls',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const panel=fs.readFileSync(path.join(__dirname,'../shopping-panel.js'),'utf8');
 const view=fs.readFileSync(path.join(__dirname,'../view.js'),'utf8');
 assert.match(html,/id="shopFilters"/);
 assert.match(html,/id="shopStoreSettings"/);
 assert.match(html,/id="shoppingTagOptions"/);
 assert.doesNotMatch(html,/id="shoppingStore"/);
 assert.match(panel,/data-shop-edit-tags/);
 assert.match(panel,/data-shop-item-tag/);
 assert.match(panel,/const visible=pending\.filter\(matches\)/);
 assert.match(panel,/const visibleDone=finished\.filter\(matches\)/);
 assert.match(view,/openStore/);
});
test('Android geofencing and widget both understand tag arrays and legacy storeId',()=>{
 const geofence=fs.readFileSync(path.join(__dirname,'../android/app/src/main/java/ca/runningtab/widget/StoreGeofenceManager.java'),'utf8');
 const widget=fs.readFileSync(path.join(__dirname,'../android/app/src/main/java/ca/runningtab/widget/WidgetData.java'),'utf8');
 assert.match(geofence,/itemTagged/);
 assert.match(geofence,/optJSONArray\("storeIds"\)/);
 assert.match(widget,/optJSONArray\("storeIds"\)/);
 assert.match(widget,/Flat master list/);
});

test('store locations can be searched by name or address without manual coordinates',()=>{
 const panel=fs.readFileSync(path.join(__dirname,'../shopping-panel.js'),'utf8');
 const native=fs.readFileSync(path.join(__dirname,'../android/app/src/main/java/ca/runningtab/widget/MainActivity.java'),'utf8');
 assert.match(panel,/data-store-search/);
 assert.match(panel,/data-store-results/);
 assert.match(panel,/data-store-pick/);
 assert.match(panel,/searchStoreLocations/);
 assert.doesNotMatch(panel,/prompt\('Coordinates from Google Maps/);
 assert.match(native,/@JavascriptInterface public void searchStoreLocations/);
 assert.match(native,/getFromLocationName/);
 assert.match(native,/JSONObject.quote\(id\)/);
});

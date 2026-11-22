const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Repeat=require('../repeat.js');

function parser(){
 const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 const start=html.indexOf('const TodoParser=(()=>{'),end=html.indexOf('\nconst money=',start);
 assert.ok(start>=0&&end>start);
 const sandbox={window:{MyDayRepeat:Repeat},Date};
 vm.runInNewContext(html.slice(start,end)+'\nglobalThis.parsed=TodoParser;',sandbox);
 return sandbox.parsed;
}

test('actual To-Do parser turns spoken recurrence into a dated task',()=>{
 const p=parser();
 const friday=p.interpret('Remind me every Friday at 4 PM to submit my hours');
 assert.equal(friday.title,'Submit my hours');
 assert.equal(friday.remindTime,'16:00');
 assert.equal(friday.repeat.type,'weekly');
 assert.equal(friday.repeat.weekday,5);
 assert.equal(friday.dueType,'day');
 const monthly=p.interpret('Remind me on the first Monday of every month about the firefighters meeting');
 assert.equal(monthly.repeat.type,'monthly-weekday');
 assert.equal(monthly.repeat.weekday,1);
 assert.equal(monthly.repeat.week,1);
 const quarter=p.interpret('Remind me every three months to change the furnace filter');
 assert.equal(quarter.repeat.interval,3);
 assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(quarter.due));
 const oneTime=p.interpret('Remind me tomorrow to order supplies');
 assert.equal(oneTime.repeat,null);
});

test('spoken every-five-minutes-until-stopped means automatic reminders, not title text',()=>{
 const p=parser();
 const result=p.interpret('remind me to turn off my reminders every 5 minutes until I turn off my reminders');
 assert.equal(result.title,'Turn off my reminders');
 assert.equal(result.repeat.type,'minutes');
 assert.equal(result.repeat.interval,5);
 assert.equal(result.dueType,'day');
 assert.ok(/^([01]\d|2[0-3]):[0-5]\d$/.test(result.remindTime));
 const target=new Date(result.due+'T'+result.remindTime);
 assert.ok(target.getTime()>Date.now()&&target.getTime()-Date.now()<7*60*1000);
});

test('minute interval starts in five minutes and Done stops the nagging cycle',()=>{
 const start=Repeat.firstMinuteAlert(5,new Date(2026,10,20,11,35,20));
 assert.deepEqual(start,{due:'2026-11-20',time:'11:41'});
 const result=Repeat.complete({done:false,repeat:{type:'minutes',interval:5},due:start.due,remindTime:start.time},new Date(2026,10,20,11,41));
 assert.equal(result.done,true);
});

test('parses normal spoken recurrence schedules',()=>{
 const weekly=Repeat.extract('Remind me every Friday at 4 PM to submit my hours');
 assert.deepEqual(weekly.repeat,{type:'weekly',weekday:5});
 assert.equal(weekly.text,'Remind me at 4 PM to submit my hours');
 const monthly=Repeat.extract('Remind me on the first Monday of every month about the firefighters meeting');
 assert.deepEqual(monthly.repeat,{type:'monthly-weekday',week:1,weekday:1});
 const quarterly=Repeat.extract('Remind me every three months to change the furnace filter');
 assert.deepEqual(quarterly.repeat,{type:'months',interval:3});
});

test('weekly reminder today still schedules today if the time is in the future',()=>{
 assert.equal(Repeat.firstDue({type:'weekly',weekday:5},'16:00',new Date(2026,10,20,9,30)),'2026-11-20');
 assert.equal(Repeat.firstDue({type:'weekly',weekday:5},'08:00',new Date(2026,10,20,9,30)),'2026-11-27');
});

test('first Monday of each month honors actual weekday and month boundaries',()=>{
 const repeat={type:'monthly-weekday',week:1,weekday:1};
 assert.equal(Repeat.firstDue(repeat,'19:00',new Date(2026,10,20,10)),'2026-12-07');
 assert.equal(Repeat.next({repeat,due:'2026-12-07',remindTime:'19:00'},new Date(2026,11,7,19)),'2027-01-04');
});

test('three-month reminders preserve anchor date and do not drift in short months',()=>{
 const repeat={type:'months',interval:3,day:31};
 assert.equal(Repeat.firstDue(repeat,'08:00',new Date(2026,10,30,11)),'2027-02-28');
 assert.equal(Repeat.next({repeat,due:'2027-02-28',remindTime:'08:00'},new Date(2027,1,28,8)),'2027-05-31');
});

test('finishing a repeating occurrence does not mark future instances completed',()=>{
 const before={id:'1',title:'Change filter',repeat:{type:'weekly',weekday:5},dueType:'day',due:'2026-11-20',remindTime:'08:00',notify:true,done:false};
 const after=Repeat.complete(before,new Date(2026,10,20,12));
 assert.equal(after.due,'2026-11-27');
 assert.equal(after.done,false);
 assert.equal(after.completedOccurrences,1);
 assert.equal(before.due,'2026-11-20');
 const plain=Repeat.complete({...before,repeat:null},new Date(2026,10,20,12));
 assert.equal(plain.done,true);
});

test('late completion skips past occurrences, does not create many queued alerts',()=>{
 const prior={repeat:{type:'daily'},due:'2026-11-01',remindTime:'08:00'};
 assert.equal(Repeat.next(prior,new Date(2026,10,20,11)),'2026-11-21');
});

test('an ignored daily notification still has a next occurrence without tapping Done',()=>{
 const daily={done:false,repeat:{type:'daily'},dueType:'day',due:'2026-11-20',remindTime:'17:00'};
 assert.equal(Repeat.currentOrNext(daily,new Date(2026,10,20,16)),'2026-11-20');
 assert.equal(Repeat.currentOrNext(daily,new Date(2026,10,20,18)),'2026-11-21');
 assert.equal(Repeat.currentOrNext(daily,new Date(2026,10,21,18)),'2026-11-22');
 assert.equal(daily.due,'2026-11-20','the saved schedule anchor remains intact');
 const acknowledged=Repeat.complete(daily,new Date(2026,10,20,18));
 assert.equal(acknowledged.done,false);
 assert.equal(acknowledged.due,'2026-11-21');
});

test('unacknowledged weekly and monthly reminders display their next valid dates',()=>{
 const weekly={done:false,repeat:{type:'weekly',weekday:5},dueType:'day',due:'2026-11-20',remindTime:'17:00'};
 assert.equal(Repeat.currentOrNext(weekly,new Date(2026,10,20,18)),'2026-11-27');
 const monthly={done:false,repeat:{type:'monthly-weekday',week:1,weekday:1},dueType:'day',due:'2026-11-02',remindTime:'17:00'};
 assert.equal(Repeat.currentOrNext(monthly,new Date(2026,10,20,18)),'2026-12-07');
});

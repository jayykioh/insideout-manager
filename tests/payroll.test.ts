import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seed,reduceCommand,STAFF} from '../src/lib/demo';
import {calculatePeriod,periodBounds} from '../src/lib/payroll';
function worked(){
 const s=seed();
 s.shifts=[{id:crypto.randomUUID(),user_id:STAFF,started_at:'2026-09-10T01:00:00Z',ended_at:'2026-09-10T03:00:00Z',opening_cash:0,actual_cash:0,expected_cash:0,note:'',status:'submitted'}];
 return s;
}
test('effective rates split a single shift without retroactively changing earlier hours',()=>{
 const s=reduceCommand(worked(),{type:'pay_rule',payload:{user_id:STAFF,effective_at:'2026-09-10T02:00:00Z',hourly_rate:30000,bonus_percent:2}});
 assert.equal(calculatePeriod(s,'2026-09-10','2026-09-10').find(l=>l.user_id===STAFF)?.base,55000);
});
test('approved payroll freezes adjustments and prevents overlapping approval',()=>{
 const source=worked();
 const approved=reduceCommand(source,{type:'payroll_approve',payload:{start_date:'2026-09-10',end_date:'2026-09-10',adjustments:{[STAFF]:{amount:5000,note:'Allowance'}}}});
 assert.equal(approved.payroll_periods![0].lines.find(l=>l.user_id===STAFF)?.total,55000);
 assert.equal(source.payroll_periods?.length||0,0);
 assert.throws(()=>reduceCommand(approved,{type:'payroll_approve',payload:{start_date:'2026-09-10',end_date:'2026-09-11'}}));
 assert.throws(()=>reduceCommand(approved,{type:'attendance_correct',payload:{id:source.shifts[0].id,started_at:'2026-09-10T00:00:00Z',ended_at:'2026-09-10T03:00:00Z',reason:'Correction'}}));
});
test('payroll rejects unexplained adjustments and open shifts',()=>{
 const s=worked();
 assert.throws(()=>reduceCommand(s,{type:'payroll_approve',payload:{start_date:'2026-09-10',end_date:'2026-09-10',adjustments:{[STAFF]:{amount:1000,note:''}}}}));
 s.shifts[0].ended_at=null;s.shifts[0].status='open';
 assert.throws(()=>reduceCommand(s,{type:'payroll_approve',payload:{start_date:'2026-09-10',end_date:'2026-09-10'}}));
});
test('payroll ranges use Vietnam day boundaries and reject reverse ranges',()=>{
 assert.equal(new Date(periodBounds('2026-09-10','2026-09-10').from).toISOString(),'2026-09-09T17:00:00.000Z');
 assert.throws(()=>periodBounds('2026-09-11','2026-09-10'));
});
test('staff cannot approve payroll or deactivate another profile',()=>{
 const s=worked();s.user=s.members.find(m=>m.id===STAFF)!;
 assert.throws(()=>reduceCommand(s,{type:'payroll_approve',payload:{start_date:'2026-09-10',end_date:'2026-09-10'}}));
 assert.throws(()=>reduceCommand(s,{type:'member_status',payload:{id:s.members[0].id,active:false}}));
});

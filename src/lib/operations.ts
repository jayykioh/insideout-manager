import type {Snapshot,Command} from './types';
import {calculatePeriod,assertNoOverlap,effectiveRules,periodBounds} from './payroll';
export function operations(source:Snapshot,command:Command):Snapshot|null{
 const p=command.payload;
 if(!['pay_rule','payroll_approve','payroll_paid','attendance_correct','device_revoke','pin_reset','member_status','asset','preference','resolve_order'].includes(command.type))return null;
 const s=structuredClone(source),now=new Date().toISOString();
 if(command.type==='preference'){if(p.theme!=='dark'&&p.theme!=='light')throw Error('Giao diện không hợp lệ.');return s;}
 if(s.user.role!=='admin')throw Error('Chỉ quản lý được thực hiện thao tác này.');
 const id=String(p.id||'');const reason=String(p.reason||'').trim();
 if(command.type==='pay_rule'){
  const user=s.members.find(m=>m.id===p.user_id);const rate=Number(p.hourly_rate),bonus=Number(p.bonus_percent);const effective=new Date(String(p.effective_at)).toISOString();if(!user||!Number.isSafeInteger(rate)||rate<0||!Number.isFinite(bonus)||bonus<0||bonus>100)throw Error('Quy tắc lương không hợp lệ.');
  if((s.payroll_periods||[]).some(period=>Date.parse(effective)<periodBounds(period.start_date,period.end_date).to))throw Error('Không sửa quy tắc trong kỳ lương đã duyệt.');
  if(!(s.pay_rules||[]).some(r=>r.user_id===user.id))s.pay_rules=[...(s.pay_rules||[]),...effectiveRules(s,user.id)];
  if(s.pay_rules!.some(r=>r.user_id===user.id&&r.effective_at===effective))throw Error('Đã có quy tắc tại thời điểm này.');
  s.pay_rules!.push({id:crypto.randomUUID(),user_id:user.id,effective_at:effective,hourly_rate:rate,bonus_percent:bonus});user.hourly_rate=rate;
 }
 if(command.type==='payroll_approve'){
  const start=String(p.start_date),end=String(p.end_date);assertNoOverlap(s.payroll_periods||[],start,end);const bounds=periodBounds(start,end);
  if(s.shifts.some(sh=>!sh.ended_at&&Date.parse(sh.started_at)<bounds.to))throw Error('Cần đóng các ca trong kỳ trước khi duyệt lương.');
  const adjustments=(p.adjustments||{}) as Record<string,{amount:number;note:string}>;const lines=calculatePeriod(s,start,end).map(l=>{const adj=adjustments[l.user_id];if(adj&&(!Number.isSafeInteger(adj.amount)||Math.abs(adj.amount)>1000000000||(adj.amount!==0&&!adj.note?.trim())))throw Error('Khoản điều chỉnh cần số tiền hợp lệ và lý do.');const adjustment=adj?.amount||0;if(l.total+adjustment<0)throw Error('Lương thực nhận không được âm.');return {...l,adjustment,note:adj?.note||'',total:l.total+adjustment};});
  s.payroll_periods=[{id:crypto.randomUUID(),start_date:start,end_date:end,status:'approved',approved_at:now,paid_at:null,lines},...(s.payroll_periods||[])];
 }
 if(command.type==='payroll_paid'){const period=s.payroll_periods?.find(x=>x.id===id);if(!period)throw Error('Không tìm thấy kỳ lương.');period.status='paid';period.paid_at??=now;}
 if(command.type==='attendance_correct'){const sh=s.shifts.find(x=>x.id===id);if(!sh||!reason)throw Error('Chọn ca và nhập lý do điều chỉnh.');const start=new Date(String(p.started_at)).toISOString(),end=new Date(String(p.ended_at)).toISOString();if(Date.parse(end)<=Date.parse(start))throw Error('Giờ ra phải sau giờ vào.');if((s.payroll_periods||[]).some(period=>{const b=periodBounds(period.start_date,period.end_date);return Math.min(Date.parse(sh.started_at),Date.parse(start))<b.to&&Math.max(Date.parse(sh.ended_at||now),Date.parse(end))>b.from;}))throw Error('Ca liên quan tới kỳ lương đã duyệt.');sh.started_at=start;sh.ended_at=end;}
 if(command.type==='device_revoke'){const d=s.devices?.find(x=>x.id===id);if(!d)throw Error('Không tìm thấy thiết bị.');d.revoked_at=now;}
 if(command.type==='member_status'){const m=s.members.find(x=>x.id===id);if(!m||id===s.user.id)throw Error('Không thể thay đổi trạng thái tài khoản hiện tại.');m.active=!!p.active;}
 if(command.type==='pin_reset'&&!/^\d{4,6}$/.test(String(p.pin||'')))throw Error('PIN cần 4 đến 6 số.');
 if(command.type==='asset'){const url=String(p.url||'');if(!url.startsWith('data:image/'))throw Error('Ảnh không hợp lệ.');if(p.kind==='product'){const product=s.products.find(x=>x.id===id);if(!product)throw Error('Không tìm thấy sản phẩm.');product.image_url=url;}else{const m=s.members.find(x=>x.id===id);if(!m)throw Error('Không tìm thấy nhân viên.');m.avatar_url=url;}}
 if(command.type==='resolve_order')throw Error('Dữ liệu mẫu không có đơn chờ từ máy chủ.');
 s.audit.unshift({id:crypto.randomUUID(),action:command.type,actor_id:s.user.id,detail:reason||id||String(p.user_id||''),created_at:now});return s;
}

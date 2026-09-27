import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import type {SupabaseClient,User} from '@supabase/supabase-js';
import {hash} from 'bcryptjs';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {supabase} from './server';
type Context={client:SupabaseClient;user:User;member:{id:string;shop_id:string;role:string}};
const json=(value:unknown)=>NextResponse.json(value,{headers:{'Cache-Control':'no-store'}});
export async function operationsRoute(route:string,req:NextRequest,p:Record<string,unknown>,ctx:Context):Promise<NextResponse|null>{
 const {client,user,member}=ctx;
 if(!['devices','security/pin','payroll/preview','assets','backup'].includes(route))return null;
 if(member.role!=='admin')throw Error('FORBIDDEN');
 if(route==='devices'&&req.method==='GET'){const {data,error}=await supabase(undefined,true).from('device_sessions').select('id,label,expires_at,revoked_at').eq('shop_id',member.shop_id).order('expires_at',{ascending:false});if(error)throw error;return json(data);}
 if(route==='security/pin'&&req.method==='POST'){
  const input=z.object({id:z.uuid(),pin:z.string().regex(/^\d{4,6}$/),current_pin:z.string().regex(/^\d{4,6}$/)}).parse(p);
  const service=supabase(undefined,true);
  const verified=await service.rpc('verify_profile_pin',{p_shop:member.shop_id,p_user:user.id,p_pin:input.current_pin});
  if(verified.error||!verified.data?.ok)throw Error(verified.data?.message||'PIN quản lý chưa đúng.');
  const target=await client.from('members').select('id').eq('id',input.id).eq('shop_id',member.shop_id).single();if(target.error)throw Error('Không tìm thấy nhân viên.');
  const result=await service.from('staff_pins').upsert({user_id:input.id,shop_id:member.shop_id,hash:await hash(input.pin,12),attempt_count:0,window_start:new Date().toISOString(),locked_until:null,requires_unlock:false,changed_at:new Date().toISOString()});
  if(result.error)throw result.error;
  await service.from('audit_logs').insert({shop_id:member.shop_id,actor_id:user.id,action:'pin_reset',detail:input.id});return json({ok:true});
 }
 if(route==='payroll/preview'&&req.method==='POST'){const input=z.object({start_date:z.iso.date(),end_date:z.iso.date()}).parse(p);const {data,error}=await client.rpc('payroll_preview',{p_start:input.start_date,p_end:input.end_date});if(error)throw error;return json(data);}
 if(route==='assets'&&req.method==='POST'){
  const body=await req.formData();const kind=z.enum(['product','avatar']).parse(body.get('kind')),id=z.uuid().parse(body.get('id'));const file=body.get('file');
  if(!(file instanceof File)||file.size>5*1024*1024||file.size<12||!['image/webp','image/png','image/jpeg'].includes(file.type))throw Error('Ảnh không hợp lệ hoặc vượt 5 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());const valid=file.type==='image/webp'?String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP':file.type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!valid)throw Error('Nội dung tệp không phải định dạng ảnh được chọn.');
  const target=await client.from(kind==='product'?'products':'members').select('id').eq('id',id).eq('shop_id',member.shop_id).single();if(target.error)throw Error('Không tìm thấy đối tượng.');
  const service=supabase(undefined,true),bucket='shop-images';const ext=file.type==='image/webp'?'webp':file.type==='image/png'?'png':'jpg';const path=member.shop_id+'/'+kind+'/'+id+'/'+randomUUID()+'.'+ext;
  const uploaded=await service.storage.from(bucket).upload(path,bytes,{contentType:file.type,upsert:false,cacheControl:'31536000'});if(uploaded.error)throw uploaded.error;
  const url=service.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const updated=await client.rpc('manager_command',{p_type:'asset',p:{id,kind,url}});if(updated.error){await service.storage.from(bucket).remove([path]);throw updated.error;}return json({url});
 }
 if(route==='backup'&&req.method==='POST'){
  const {data,error}=await client.rpc('manager_state');if(error)throw error;
  const response=json({schema_version:2,exported_at:new Date().toISOString(),shop_id:member.shop_id,data});
  await supabase(undefined,true).from('audit_logs').insert({shop_id:member.shop_id,actor_id:user.id,action:'export',detail:'Operational JSON export'});
  response.headers.set('Content-Disposition','attachment; filename="insideout-export.json"');return response;
 }
 return null;
}

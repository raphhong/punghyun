"use server";
import { randomUUID } from "node:crypto";
import { shortRentalPublicAccess } from "@/lib/admin/short-rental-public-access";
import { uuid } from "@/lib/admin/short-rental-intake";
const failure = { error: "사진을 등록하지 못했습니다. 전용 링크·장비·파일 형식을 확인하세요." };
export async function createSevenDayPhoto(token:string, deviceId:string, extension:string) {
  if (!uuid(deviceId) || !["jpg","jpeg","png","webp"].includes(extension)) return failure;
  try {
    const {db,customer,devices}=await shortRentalPublicAccess(token);
    if(!devices.some(d=>d.id===deviceId))return failure;
    const path=`${customer.id}/seven-day/${deviceId}/${randomUUID()}.${extension}`;
    const result=await db.storage.from("customer-docs").createSignedUploadUrl(path);
    return result.error||!result.data?failure:{path:result.data.path,token:result.data.token};
  }catch{return failure;}
}
export async function recordSevenDayPhoto(token:string, deviceId:string, path:string) {
  if(!uuid(deviceId)||typeof path!=="string"||path.length>200)return failure;
  try {
    const {db,customer,devices}=await shortRentalPublicAccess(token);
    const directory=`${customer.id}/seven-day/${deviceId}`, file=path.slice(directory.length+1);
    if(!devices.some(d=>d.id===deviceId)||path!==`${directory}/${file}`||!/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/.test(file)||!uuid(file.split('.')[0]))return failure;
    const uploaded=await db.storage.from("customer-docs").list(directory,{search:file,limit:2});
    const item=uploaded.data?.find(i=>i.name===file);
    if(uploaded.error||!item||!item.metadata||!["image/jpeg","image/png","image/webp"].includes(item.metadata.mimetype)||!(item.metadata.size>0&&item.metadata.size<=10*1024*1024))return failure;
    const key=`seven_day_asset_${file.split('.')[0]}`;
    const previous=await db.from("customer_documents").select("file_path,device_id").eq("customer_id",customer.id).eq("doc_key",key).maybeSingle();
    if(previous.error)return failure;
    if(previous.data)return previous.data.file_path===path&&previous.data.device_id===deviceId?{ok:true as const}:failure;
    const result=await db.from("customer_documents").insert({customer_id:customer.id,device_id:deviceId,doc_key:key,category:"screening_3",checked:false,file_path:path,uploaded_at:new Date().toISOString()});
    return result.error?failure:{ok:true as const};
  }catch{return failure;}
}

"use client";
import {useState} from "react";
import {createBrowserClient} from "@/lib/supabase/client";
import {createSevenDayPhoto,recordSevenDayPhoto} from "@/app/seven-day/photo-actions";
export function SevenDayPhoto({token,deviceId,label}:{token:string;deviceId:string;label:string}) {
  const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  return <section className="space-y-2 rounded border p-3"><h3 className="font-medium">{label} — 변경된 자산 사진만 추가</h3><p className="text-sm">기존 사진이 유효하면 다시 제출하지 않아도 됩니다. 신분증·인감증명은 업로드하지 마세요. JPEG/PNG/WebP, 최대 10MB.</p><input aria-label={`${label} 자산 사진`} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/><button type="button" className="ph-button ph-button--secondary" disabled={busy||!file} onClick={async()=>{
    if(!file||file.size>10*1024*1024||!["image/jpeg","image/png","image/webp"].includes(file.type)){setMessage("10MB 이하 JPEG/PNG/WebP 사진을 선택하세요.");return;}
    setBusy(true);setMessage("");try{const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";const signed=await createSevenDayPhoto(token,deviceId,ext);if("error"in signed)throw Error(signed.error);const up=await createBrowserClient().storage.from("customer-docs").uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type});if(up.error)throw Error("사진 전송에 실패했습니다.");const saved=await recordSevenDayPhoto(token,deviceId,signed.path);if("error"in saved)throw Error(saved.error);setMessage("사진을 추가했습니다. 기존 사진은 유지하며 담당자가 확인합니다.");setFile(null);}catch(error){setMessage(error instanceof Error?error.message:"사진 추가 실패");}finally{setBusy(false);}
  }}>{busy?"추가 중…":"사진 추가"}</button><p role="status">{message}</p></section>;
}

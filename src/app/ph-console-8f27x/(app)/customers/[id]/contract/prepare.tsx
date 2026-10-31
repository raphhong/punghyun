'use client';
import Link from 'next/link';
import DocumentPreview from '@/components/admin/contract/DocumentPreview';
export default function Prepare({customerName,back}:{customerName:string;back:string}){return <div className="mx-auto max-w-2xl space-y-5"><Link href={back} className="text-sm text-navy-500">← 고객 상세</Link><h1 className="text-2xl font-bold text-navy-900">표준 계약 준비</h1><DocumentPreview customerName={customerName}/></div>;}

'use client';
import type {ContractSourceCatalog} from '@/lib/admin/contract-preparation';
import Link from 'next/link';
import DocumentPreview from '@/components/admin/contract/DocumentPreview';
export default function Prepare({customerName,customerId,customerDefaults={},sourceCatalog,back}:{customerName:string;customerId:string;customerDefaults?:Record<string,string>;sourceCatalog?:ContractSourceCatalog;back:string}){return <div className="mx-auto max-w-2xl space-y-5"><Link href={back} className="text-sm text-navy-500">← 고객 상세</Link><h1 className="text-2xl font-bold text-navy-900">표준 계약 준비</h1><DocumentPreview sourceCatalog={sourceCatalog} customerName={customerName} customerId={customerId} customerDefaults={customerDefaults}/></div>;}

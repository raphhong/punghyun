"use client";

import { MultiDocUpload } from "@/components/documents/MultiDocUpload";
import { salesCreateDocUploadUrl, salesRecordDocUpload } from "@/app/sales/actions";

export function SalesDocUpload({ customerId, docKey, category }: {
  customerId: string;
  docKey: string;
  category: string;
}) {
  return <MultiDocUpload label={docKey} signAction={(filename, metadata) => salesCreateDocUploadUrl(customerId, docKey, filename, metadata)} recordAction={(path, id) => salesRecordDocUpload(customerId, docKey, category, path, id)} />;
}

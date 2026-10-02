"use client";

import { MultiDocUpload } from "@/components/documents/MultiDocUpload";
import { createDocUploadUrl, recordDocUpload } from "@/app/ph-console-8f27x/(app)/customers/actions";

export function AdminDocUpload({ customerId, docKey, category }: {
  customerId: string;
  docKey: string;
  category: string;
}) {
  return <MultiDocUpload label={docKey} signAction={(filename, metadata) => createDocUploadUrl(customerId, docKey, filename, metadata)} recordAction={(path, id) => recordDocUpload(customerId, docKey, category, path, id)} />;
}

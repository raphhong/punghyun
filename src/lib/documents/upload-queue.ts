import { documentFileType, type UploadMetadata } from "./types";

export type UploadPhase = "queued" | "signing" | "uploading" | "recording" | "done" | "error";
export type QueuedUpload = {
  id: string;
  file: File;
  phase: UploadPhase;
  error?: string;
  path?: string;
  // A record failure must not cause a second storage upload on retry.
  uploaded?: boolean;
};
export type UploadOperations = {
  sign: (filename: string, metadata: UploadMetadata) => Promise<{ id: string; path: string; token: string } | { error: string }>;
  upload: (path: string, token: string, file: File, contentType: string) => Promise<{ error: { message: string } | null }>;
  record: (path: string, id: string) => Promise<{ ok: true } | { error: string }>;
};

/** Files retain their identity until explicitly removed from the local queue. */
export function queueFiles(files: File[], makeId: () => string = () => crypto.randomUUID()): QueuedUpload[] {
  return files.map((file) => ({ id: makeId(), file, phase: "queued" }));
}

/** One file finishes (including its record) before the next begins. */
export async function submitUploadQueue(
  queue: QueuedUpload[],
  operations: UploadOperations,
  onChange: () => void,
  shouldStop: () => boolean,
): Promise<void> {
  for (const item of queue) {
    if (shouldStop()) break;
    if (item.phase !== "queued" && item.phase !== "error") continue;
    item.error = undefined;
    try {
      const fileType = documentFileType(item.file.name, item.file.size, item.file.type);
      if ("error" in fileType) throw new Error(fileType.error);
      // Retry uncertain bytes by finalizing first. This works even if Storage
      // refuses to sign a fresh upload token for an object that already exists.
      if (item.path && !item.uploaded) {
        item.phase = "recording";
        onChange();
        const recovered = await operations.record(item.path, item.id);
        if ("ok" in recovered) {
          item.uploaded = true;
          item.phase = "done";
          onChange();
          continue;
        }
      }
      if (!item.uploaded || !item.path) {
        item.phase = "signing";
        onChange();
        const signed = await operations.sign(item.file.name, {
          id: item.id,
          size: item.file.size,
          type: item.file.type || "application/octet-stream",
        });
        if ("error" in signed) throw new Error(signed.error);
        if (signed.id !== item.id) throw new Error("파일 식별자가 일치하지 않습니다. 다시 시도해 주세요.");
        item.path = signed.path;
        item.phase = "uploading";
        onChange();
        let uploadError: string | undefined;
        try {
          const result = await operations.upload(signed.path, signed.token, item.file, fileType.contentType);
          uploadError = result.error?.message;
        } catch (error) {
          uploadError = error instanceof Error ? error.message : "파일 전송 응답을 받지 못했습니다.";
        }
        if (uploadError) {
          // The bytes may have arrived even if the browser lost the response.
          // Finalizing the same UUID is safe; never overwrite the object.
          const recovered = await operations.record(signed.path, item.id);
          if ("error" in recovered) throw new Error(`${uploadError} (${recovered.error})`);
          item.uploaded = true;
          item.phase = "done";
          onChange();
          continue;
        }
        item.uploaded = true;
      }
      item.phase = "recording";
      onChange();
      const recorded = await operations.record(item.path, item.id);
      if ("error" in recorded) throw new Error(recorded.error);
      item.phase = "done";
    } catch (error) {
      item.phase = "error";
      item.error = error instanceof Error ? error.message : "업로드에 실패했습니다. 다시 시도해 주세요.";
    }
    onChange();
  }
}

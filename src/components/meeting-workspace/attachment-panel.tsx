import type { ChangeEvent, RefObject } from "react";

import {
  MAX_ATTACHMENT_SIZE_BYTES,
} from "@/features/attachments/types";
import type { WorkspaceAttachmentItem } from "@/features/attachments/types";

import {
  formatFileSize,
  hasReadableAttachmentPreview,
  isHardAttachmentError,
} from "./shared";

export interface AttachmentPanelProps {
  attachments: WorkspaceAttachmentItem[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (attachmentId: string) => void;
}

export function AttachmentPanel({
  attachments,
  fileInputRef,
  onSelect,
  onRemove,
}: AttachmentPanelProps) {
  return (
    <div className="rounded-[1.5rem] border border-zinc-900/10 bg-white/75 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-title">Attachments</p>
          <h3 className="mt-2 text-sm font-semibold text-zinc-950">
            前提資料
          </h3>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full border border-zinc-900/10 bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
        >
          資料を追加
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.pptx,.xlsx,.md,.txt"
        onChange={onSelect}
        className="hidden"
      />
      <p className="mt-3 text-xs leading-6 text-zinc-500">
        pdf / docx / pptx / xlsx / md / txt を会議コンテキストとして添付できます。1ファイルあたり最大 {formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)} です。
      </p>

      {attachments.length > 0 ? (
        <div className="mt-4 space-y-3">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="rounded-2xl border border-zinc-900/10 bg-white px-4 py-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-950">
                    {attachment.filename}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                    <span>{attachment.extension}</span>
                    <span>{formatFileSize(attachment.size)}</span>
                    <span>
                      {attachment.status === "ready"
                        ? "ready"
                        : isHardAttachmentError(attachment.error)
                          ? "error"
                          : "no preview"}
                    </span>
                  </div>
                  {attachment.error && isHardAttachmentError(attachment.error) ? (
                    <p className="mt-2 text-xs leading-6 text-rose-600">
                      {attachment.error}
                    </p>
                  ) : (
                    <p className="mt-2 line-clamp-3 text-xs leading-6 text-zinc-600">
                      {attachment.error && !isHardAttachmentError(attachment.error)
                        ? "プレビューなし"
                        : hasReadableAttachmentPreview(attachment.excerpt)
                        ? attachment.excerpt
                        : "プレビューなし"}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(attachment.id)}
                  className="rounded-full border border-zinc-900/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-900/20 hover:bg-zinc-50"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-sm leading-7 text-zinc-500">
          添付した資料は、現在の会議の前提コンテキストとして使われます。
        </div>
      )}
    </div>
  );
}

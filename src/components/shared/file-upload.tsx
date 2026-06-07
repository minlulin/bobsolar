"use client";

import { ImageIcon, Loader2, Upload } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import {
  DOCUMENT_ALLOWED_MIME_TYPES,
  DOCUMENT_UPLOAD_MAX_BYTES,
  DOCUMENT_UPLOAD_MAX_MB,
} from "@/lib/domain/upload";
import { cn } from "@/lib/utils";

function normalizeImageMimeType(type: string): string {
  const raw = type.trim().toLowerCase();
  if (raw === "image/jpg" || raw === "image/pjpeg") return "image/jpeg";
  return raw;
}

export interface FileUploadProps {
  folder: string;
  onUploaded: (url: string) => void;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  folder,
  onUploaded,
  disabled,
  className,
}: FileUploadProps): React.JSX.Element {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const submit = React.useCallback(
    async (file: File): Promise<void> => {
      setErr(null);

      const allowed = new Set<string>(DOCUMENT_ALLOWED_MIME_TYPES);
      const normalizedType = normalizeImageMimeType(file.type);
      if (normalizedType && !allowed.has(normalizedType)) {
        setErr("JPEG, PNG, or WebP only.");
        return;
      }
      if (file.size > DOCUMENT_UPLOAD_MAX_BYTES) {
        setErr(`Max file size is ${DOCUMENT_UPLOAD_MAX_MB}MB.`);
        return;
      }

      setBusy(true);
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);

      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("folder", folder);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });
        const contentType = res.headers.get("content-type") ?? "";
        const body = contentType.includes("application/json")
          ? ((await res.json()) as { url?: string; error?: string })
          : ({ error: await res.text() } as { url?: string; error?: string });
        if (!res.ok || !body.url) {
          throw new Error(body.error || `Upload failed (${res.status})`);
        }

        URL.revokeObjectURL(localUrl);
        setPreview(body.url);

        onUploaded(body.url);
      } catch (e) {
        URL.revokeObjectURL(localUrl);
        setPreview(null);
        setErr(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [folder, onUploaded],
  );

  return (
    <div className={cn("space-y-3", className)}>
      <button
        type="button"
        onDragOver={(ev) => {
          ev.preventDefault();
        }}
        onDrop={(ev) => {
          ev.preventDefault();
          const f = ev.dataTransfer.files[0];
          if (f) void submit(f);
        }}
        className={cn(
          "border-border flex w-full min-w-0 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition hover:border-[hsl(var(--solar))/0.55]",
          disabled && "pointer-events-none opacity-50",
        )}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="text-muted-foreground mb-3 h-8 w-8" />
        <p className="text-sm font-medium wrap-break-word">Drop logo here or click to browse</p>
        <p className="text-muted-foreground mt-2 text-xs wrap-break-word whitespace-normal">
          PNG/JPEG/Webp — {DOCUMENT_UPLOAD_MAX_MB} MB max per upload burst
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={DOCUMENT_ALLOWED_MIME_TYPES.join(",")}
          disabled={disabled || busy}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void submit(f);
          }}
        />

        {busy && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <Loader2 className="text-solar h-4 w-4 animate-spin" />
            Uploading…
          </div>
        )}
      </button>

      {preview && !busy ? (
        <div className="border-border bg-muted/30 flex justify-center rounded-2xl border p-6">
          <div className="relative h-32 w-full max-w-[200px] overflow-hidden rounded-lg">
            <Image
              src={preview}
              alt="Preview"
              fill
              unoptimized
              sizes="200px"
              className="mx-auto block object-contain"
            />
            <span className="bg-background/70 text-muted-foreground absolute right-2 bottom-2 rounded-md px-2 py-0.5 text-[10px]">
              Preview
            </span>
          </div>
        </div>
      ) : null}

      {!preview && (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <ImageIcon className="h-3.5 w-3.5" />
          Logos sync to quotations PDF once saved.
        </div>
      )}

      {err ? <p className="text-destructive text-sm">{err}</p> : null}
    </div>
  );
}

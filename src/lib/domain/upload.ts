import { UPLOAD_MAX_SIZE_BYTES } from "./policies";

export const DOCUMENT_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedMimeType = (typeof DOCUMENT_ALLOWED_MIME_TYPES)[number];

export const DOCUMENT_UPLOAD_MAX_MB = UPLOAD_MAX_SIZE_BYTES / (1024 * 1024);

export const DOCUMENT_UPLOAD_MAX_BYTES = UPLOAD_MAX_SIZE_BYTES;

export function isAllowedMimeType(type: string): type is AllowedMimeType {
  return (DOCUMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(type);
}

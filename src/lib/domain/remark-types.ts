import { z } from "zod";
import { remarkTypeEnum } from "@/lib/db/schema";

export const REMARK_TYPES = remarkTypeEnum.enumValues;
export type RemarkType = (typeof remarkTypeEnum.enumValues)[number];
export const remarkTypeSchema = z.enum(REMARK_TYPES);

/** Icon map for remark types */
export const REMARK_TYPE_ICONS: Record<RemarkType, string> = {
  note: "🗒️",
  issue: "🚩",
  update: "📣",
};

/** UI label map for remark types */
export const REMARK_TYPE_LABELS: Record<RemarkType, string> = {
  note: "Field Note",
  issue: "Site Issue",
  update: "Stakeholder Update",
};

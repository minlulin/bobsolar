import { z } from "zod";
import { alertTypeEnum } from "@/lib/db/schema";

export const ALERT_TYPES = alertTypeEnum.enumValues;
export type AlertType = (typeof alertTypeEnum.enumValues)[number];
export const alertTypeSchema = z.enum(ALERT_TYPES);

/** UI label map for alert types */
export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  warranty_expiry: "Warranty Expiry",
  maintenance_due: "Preventive Upkeep",
  follow_up: "Client Follow-through",
};

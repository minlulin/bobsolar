import { z } from 'zod';
import { notificationTypeEnum } from '@/lib/db/schema';

export const NOTIFICATION_TYPES = notificationTypeEnum.enumValues;
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

/** UI label map for notification types */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  info: 'Information',
  warning: 'Warning',
  action: 'Action Required',
};

import { z } from "zod";
import { type ProjectStatus, projectStatusEnum } from "@/lib/db/schema";

export const PROJECT_STATUSES = projectStatusEnum.enumValues;

export const projectStatusSchema = z.enum(PROJECT_STATUSES);

/** Type guard for ProjectStatus */
export function isProjectStatus(status: string): status is ProjectStatus {
  return PROJECT_STATUSES.includes(status as ProjectStatus);
}

/** UI label map for project statuses */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  in_progress: "In Progress",
  on_hold: "On Hold",
  installation_completed: "Installation Completed",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Allowed status transitions for projects */
export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  planning: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["on_hold", "installation_completed", "cancelled"],
  on_hold: ["in_progress", "installation_completed", "cancelled"],
  installation_completed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** Check if a project status transition is valid */
export function canTransitionProjectStatus(from: ProjectStatus, to: ProjectStatus): boolean {
  if (from === to) return true;
  return PROJECT_STATUS_TRANSITIONS[from].includes(to);
}

/** Get list of permitted next statuses from current status */
export function permittedNextStatuses(from: ProjectStatus): ProjectStatus[] {
  return [...PROJECT_STATUS_TRANSITIONS[from]];
}

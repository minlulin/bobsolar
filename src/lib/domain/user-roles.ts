import { z } from "zod";
import { userRoleEnum } from "@/lib/db/schema";

export const USER_ROLES = userRoleEnum.enumValues;

export const userRoleSchema = z.enum(USER_ROLES);

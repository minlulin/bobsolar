import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addProjectCost,
  addProjectRemark,
  checkProjectCompletionOutstanding,
  consumeProjectInventory,
  convertQuotationToProject,
  createWarrantyAlertForProject,
  deleteProjectCost,
  deleteProjectRemark,
  getProject,
  getProjects,
  markProjectCompleted,
  updateProject,
} from "@/actions/project-actions";
import { createMutationHook } from "@/hooks/mutation-factory";
import { DEFAULT_PAGE_LIMIT } from "@/lib/domain/policies";
import { STALE_TIME } from "@/lib/query-config";
import {
  dashboardKeys,
  inventoryKeys,
  projectKeys,
  quotationKeys,
  warrantyKeys,
} from "@/lib/query-keys";
import type { ActionData } from "@/lib/utils/action-response";
import type { ProjectListFilter, UpdateProject } from "@/lib/validators/project";

export function useProjects(
  filters: Partial<ProjectListFilter> = {},
  initialData?: ActionData<Awaited<ReturnType<typeof getProjects>>>,
): ReturnType<typeof useQuery<ActionData<Awaited<ReturnType<typeof getProjects>>>>> {
  const full: ProjectListFilter = {
    scope: filters.scope ?? "active",
    status: filters.status,
    search: filters.search,
    year: filters.year ?? null,
    completedFrom: filters.completedFrom ?? null,
    completedTo: filters.completedTo ?? null,
    page: filters.page ?? 1,
    limit: filters.limit ?? DEFAULT_PAGE_LIMIT,
  };

  return useQuery({
    queryKey: projectKeys.list(full),
    queryFn: async () => {
      const res = await getProjects(full);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    ...(initialData ? { initialData } : {}),
    staleTime: STALE_TIME.SHORT,
  });
}

export function useProject(
  id: string,
): ReturnType<typeof useQuery<ActionData<Awaited<ReturnType<typeof getProject>>>>> {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const res = await getProject(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!id,
    staleTime: STALE_TIME.SHORT,
    retry: 2,
    retryDelay: 1000,
  });
}

export const useConvertToProject = createMutationHook({
  mutationFn: (raw: unknown) => convertQuotationToProject(raw),
  invalidateKeys: [projectKeys.all, quotationKeys.all, dashboardKeys.all, warrantyKeys.all],
  successMessage: "Project created",
  errorMessage: "Failed to convert quotation",
});

export function useUpdateProject(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof updateProject>>,
    Error,
    Parameters<typeof updateProject>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProject,
    onMutate: async (raw) => {
      const input = raw as UpdateProject;
      if (!input.status) return;
      const queryKey = projectKeys.detail(input.id);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      if (previous) {
        queryClient.setQueryData(queryKey, {
          ...previous,
          status: input.status,
        });
      }
      return { previous, queryKey };
    },
    onSuccess: async (res, _vars, context) => {
      if (!res.success) {
        if (context !== undefined) {
          queryClient.setQueryData(context.queryKey, context.previous);
        }
        toast.error(res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success("Project updated");
    },
    onError: (_err, _vars, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_data, _error, _vars, context) => {
      if (context !== undefined) {
        void queryClient.invalidateQueries({ queryKey: context.queryKey });
      }
    },
  });
}

export const useAddProjectCost = createMutationHook({
  mutationFn: (raw: unknown) => addProjectCost(raw),
  invalidateKeys: [projectKeys.all],
  successMessage: "Cost recorded",
  errorMessage: "Operation failed. Please try again.",
});

export const useDeleteProjectCost = createMutationHook({
  mutationFn: (costId: string) => deleteProjectCost(costId),
  invalidateKeys: [projectKeys.all],
  successMessage: "Cost removed",
  errorMessage: "Operation failed. Please try again.",
});

export const useConsumeProjectInventory = createMutationHook({
  mutationFn: (raw: unknown) => consumeProjectInventory(raw),
  invalidateKeys: [projectKeys.all, inventoryKeys.all],
  successMessage: "Inventory consumed",
  errorMessage: "Operation failed. Please try again.",
});

export const useAddProjectRemark = createMutationHook({
  mutationFn: (raw: unknown) => addProjectRemark(raw),
  invalidateKeys: [projectKeys.all],
  successMessage: "Posted",
  errorMessage: "Operation failed. Please try again.",
});

export const useDeleteProjectRemark = createMutationHook({
  mutationFn: (remarkId: string) => deleteProjectRemark(remarkId),
  invalidateKeys: [projectKeys.all],
  successMessage: "Remark removed",
  errorMessage: "Operation failed. Please try again.",
});

export const useMarkProjectCompleted = createMutationHook({
  mutationFn: (id: string) => markProjectCompleted(id),
  invalidateKeys: [projectKeys.all, warrantyKeys.all],
  successMessage: "Project marked complete",
  errorMessage: "Operation failed. Please try again.",
});

export function useCheckProjectCompletionOutstanding() {
  return useMutation({
    mutationFn: checkProjectCompletionOutstanding,
  });
}

export const useCreateProjectWarrantyAlert = createMutationHook({
  mutationFn: (raw: unknown) => createWarrantyAlertForProject(raw),
  invalidateKeys: [projectKeys.all, warrantyKeys.all],
  successMessage: "Alert added",
  errorMessage: "Operation failed. Please try again.",
});

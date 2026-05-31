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

export function useConvertToProject(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof convertQuotationToProject>>,
    Error,
    Parameters<typeof convertQuotationToProject>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: convertQuotationToProject,
    onSuccess: async (res) => {
      if (res.success) {
        await queryClient.invalidateQueries({ queryKey: projectKeys.all });
        await queryClient.invalidateQueries({ queryKey: quotationKeys.all });
        await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        await queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
        toast.success(`Project ${res.data.projectNumber} created`);
      } else {
        toast.error(res.error);
      }
    },
  });
}

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

export function useAddProjectCost(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof addProjectCost>>,
    Error,
    Parameters<typeof addProjectCost>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addProjectCost,
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success("Cost recorded");
    },
    onError: (error) => {
      toast.error(error.message ?? "Operation failed. Please try again.");
    },
  });
}

export function useDeleteProjectCost(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof deleteProjectCost>>,
    Error,
    Parameters<typeof deleteProjectCost>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProjectCost,
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success("Cost removed");
    },
    onError: (error) => {
      toast.error(error.message ?? "Operation failed. Please try again.");
    },
  });
}

export function useConsumeProjectInventory(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof consumeProjectInventory>>,
    Error,
    Parameters<typeof consumeProjectInventory>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: consumeProjectInventory,
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      toast.success("Inventory consumed");
    },
    onError: (error) => {
      toast.error(error.message ?? "Operation failed. Please try again.");
    },
  });
}

export function useDeleteProjectRemark(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof deleteProjectRemark>>,
    Error,
    Parameters<typeof deleteProjectRemark>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProjectRemark,
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success("Remark removed");
    },
    onError: (error) => {
      toast.error(error.message ?? "Operation failed. Please try again.");
    },
  });
}

export function useAddProjectRemark(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof addProjectRemark>>,
    Error,
    Parameters<typeof addProjectRemark>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addProjectRemark,
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success("Posted");
    },
    onError: (error) => {
      toast.error(error.message ?? "Operation failed. Please try again.");
    },
  });
}

export function useMarkProjectCompleted(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof markProjectCompleted>>,
    Error,
    Parameters<typeof markProjectCompleted>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markProjectCompleted,
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      await queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
      toast.success("Project marked complete");
    },
    onError: (error) => {
      toast.error(error.message ?? "Operation failed. Please try again.");
    },
  });
}

export function useCheckProjectCompletionOutstanding() {
  return useMutation({
    mutationFn: checkProjectCompletionOutstanding,
  });
}

export function useCreateProjectWarrantyAlert(): ReturnType<
  typeof useMutation<
    Awaited<ReturnType<typeof createWarrantyAlertForProject>>,
    Error,
    Parameters<typeof createWarrantyAlertForProject>[0]
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWarrantyAlertForProject,
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      await queryClient.invalidateQueries({ queryKey: warrantyKeys.all });
      toast.success("Alert added");
    },
    onError: (error) => {
      toast.error(error.message ?? "Operation failed. Please try again.");
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProjects,
  getProject,
  convertQuotationToProject,
  updateProject,
  addProjectCost,
  deleteProjectCost,
  addProjectRemark,
  deleteProjectRemark,
  markProjectCompleted,
  createWarrantyAlertForProject,
} from '@/actions/project-actions';
import type { ProjectListFilter } from '@/lib/validators/project';
import { toast } from 'sonner';
import {
  dashboardKeys,
  projectKeys,
  quotationKeys,
  warrantyKeys,
} from '@/lib/query-keys';

type ActionData<T> = T extends { data: infer D } ? D : never;

export function useProjects(
  filters: Partial<ProjectListFilter> = {},
  initialData?: ActionData<Awaited<ReturnType<typeof getProjects>>>,
): ReturnType<
  typeof useQuery<ActionData<Awaited<ReturnType<typeof getProjects>>>>
> {
  const full: ProjectListFilter = {
    scope: filters.scope ?? 'active',
    status: filters.status,
    search: filters.search,
    year: filters.year ?? null,
    completedFrom: filters.completedFrom ?? null,
    completedTo: filters.completedTo ?? null,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  };

  return useQuery({
    queryKey: projectKeys.list(full),
    queryFn: async () => {
      const res = await getProjects(full);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    ...(initialData ? { initialData } : {}),
    staleTime: 30 * 1000,
  });
}

export function useProject(
  id: string,
): ReturnType<
  typeof useQuery<ActionData<Awaited<ReturnType<typeof getProject>>>>
> {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const res = await getProject(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
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
    onError: () => {
      toast.error('Failed to create project');
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
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: projectKeys.all });
      toast.success('Project updated');
    },
    onError: () => {
      toast.error('Failed to update project');
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
      toast.success('Cost recorded');
    },
    onError: () => {
      toast.error('Failed to add cost');
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
      toast.success('Cost removed');
    },
    onError: () => {
      toast.error('Failed to remove cost');
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
      toast.success('Remark removed');
    },
    onError: () => {
      toast.error('Could not delete remark');
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
      toast.success('Posted');
    },
    onError: () => {
      toast.error('Failed to post remark');
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
      toast.success('Project marked complete');
    },
    onError: () => {
      toast.error('Could not complete project');
    },
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
      toast.success('Alert added');
    },
    onError: () => {
      toast.error('Failed to add alert');
    },
  });
}

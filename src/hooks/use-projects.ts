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

export function useProjects(filters: Partial<ProjectListFilter> = {}) {
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
    queryKey: ['projects', full],
    queryFn: async () => {
      const res = await getProjects(full);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 30 * 1000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      const res = await getProject(id);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!id,
    staleTime: 15 * 1000,
  });
}

export function useConvertToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: convertQuotationToProject,
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        toast.success(`Project ${res.data.projectNumber} created`);
      } else {
        toast.error(res.error);
      }
    },
    onError: () => toast.error('Failed to create project'),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProject,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
    },
    onError: () => toast.error('Failed to update project'),
  });
}

export function useAddProjectCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addProjectCost,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Cost recorded');
    },
    onError: () => toast.error('Failed to add cost'),
  });
}

export function useDeleteProjectCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProjectCost,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Cost removed');
    },
    onError: () => toast.error('Failed to remove cost'),
  });
}

export function useDeleteProjectRemark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProjectRemark,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Remark removed');
    },
    onError: () => toast.error('Could not delete remark'),
  });
}

export function useAddProjectRemark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addProjectRemark,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Posted');
    },
    onError: () => toast.error('Failed to post remark'),
  });
}

export function useMarkProjectCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markProjectCompleted,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['warranty'] });
      toast.success('Project marked complete');
    },
    onError: () => toast.error('Could not complete project'),
  });
}

export function useCreateProjectWarrantyAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWarrantyAlertForProject,
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['warranty'] });
      toast.success('Alert added');
    },
    onError: () => toast.error('Failed to add alert'),
  });
}

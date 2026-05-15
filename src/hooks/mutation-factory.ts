/**
 * Factory for creating standard CRUD mutation hooks with consistent
 * query invalidation and toast notification patterns.
 */
import {
  useMutation,
  useQueryClient,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
  type QueryKey,
} from '@tanstack/react-query';
import { toast } from 'sonner';

/** Mutation function that receives a single variables argument */
type ActionFn<TData, TVariables> = (variables: TVariables) => Promise<{
  success: boolean;
  data?: TData;
  error?: string;
}>;

export type MutationResponse<TData> = {
  success: boolean;
  data?: TData;
  error?: string;
};

export interface MutationFactoryOptions<TData, TVariables> {
  mutationFn: ActionFn<TData, TVariables>;
  invalidateKeys?: QueryKey[];
  successMessage?: string | ((data: TData) => string);
  errorMessage?: string;
  onMutate?: (
    variables: TVariables,
  ) => Promise<Record<string, unknown> | undefined>;
  onErrorRollback?: (context: Record<string, unknown> | undefined) => void;
}

export function createMutationHook<TData, TVariables>(
  options: MutationFactoryOptions<TData, TVariables>,
): () => UseMutationResult<MutationResponse<TData>, Error, TVariables> {
  const {
    mutationFn,
    invalidateKeys = [['_all']],
    successMessage = 'Operation completed successfully',
    errorMessage = 'Operation failed',
    onMutate,
    onErrorRollback,
  } = options;

  return function useGeneratedMutation(): UseMutationResult<
    MutationResponse<TData>,
    Error,
    TVariables
  > {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (variables: TVariables) => {
        return mutationFn(variables);
      },
      ...(onMutate
        ? {
            onMutate: async (
              variables: TVariables,
            ): Promise<Record<string, unknown> | undefined> => {
              return onMutate(variables);
            },
          }
        : {}),
      onSuccess: (response: MutationResponse<TData>) => {
        if (response.success) {
          Promise.all(
            invalidateKeys.map((key) =>
              queryClient.invalidateQueries({ queryKey: key }),
            ),
          ).catch(() => {});
          const msg: string =
            typeof successMessage === 'function' && response.data !== undefined
              ? successMessage(response.data)
              : (successMessage as string);
          toast.success(msg);
        } else {
          toast.error(response.error ?? errorMessage);
        }
      },
      onError: (_error: Error, _variables: TVariables, context: unknown) => {
        if (onErrorRollback && context) {
          onErrorRollback(context as Record<string, unknown> | undefined);
        }
        toast.error(errorMessage);
      },
    });
  };
}

export function createQueryHook<TData, TArgs extends unknown[]>(
  queryFn: (...args: TArgs) => Promise<{
    success: boolean;
    data?: TData;
    error?: string;
  }>,
  queryKeyFactory: (...args: TArgs) => QueryKey,
  options?: {
    staleTime?: number;
    enabled?: boolean | ((...args: TArgs) => boolean);
  },
) {
  const { staleTime = 30_000, enabled: enabledFn } = options ?? {};

  return function useGeneratedQuery(...args: TArgs): UseQueryResult<TData> {
    const isEnabled =
      typeof enabledFn === 'function'
        ? enabledFn(...args)
        : (enabledFn ?? true);

    return useQuery({
      queryKey: queryKeyFactory(...args),
      queryFn: async () => {
        const res = await queryFn(...args);
        if (!res.success) throw new Error(res.error ?? 'Request failed');
        return res.data as TData;
      },
      staleTime,
      ...(typeof enabledFn !== 'undefined' ? { enabled: isEnabled } : {}),
    });
  };
}

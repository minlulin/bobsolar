/**
 * Factory for creating standard CRUD mutation hooks with consistent
 * query invalidation and toast notification patterns.
 */
import {
  type QueryKey,
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { SolarMutationMeta } from "@/lib/mutation-meta";
import type { ActionResponse } from "@/lib/utils/action-response";

/** Mutation function that receives a single variables argument */
type ActionFn<TData, TVariables> = (variables: TVariables) => Promise<ActionResponse<TData>>;

export type MutationResponse<TData> = ActionResponse<TData>;

export interface MutationFactoryOptions<TData, TVariables, TContext = unknown> {
  mutationFn: ActionFn<TData, TVariables>;
  invalidateKeys?: QueryKey[];
  successMessage?: string | ((data: TData) => string);
  errorMessage?: string;
  onMutate?: (variables: TVariables) => Promise<TContext | undefined>;
  onErrorRollback?: (context: TContext | undefined) => void;
  /**
   * Mutation metadata. If `invalidates` is set, the MutationCache handler
   * will automatically invalidate those query keys on success — even for
   * hooks that don't use the factory.
   */
  meta?: SolarMutationMeta;
}

export function createMutationHook<TData, TVariables, TContext = unknown>(
  options: MutationFactoryOptions<TData, TVariables, TContext>,
): () => UseMutationResult<MutationResponse<TData>, Error, TVariables> {
  const {
    mutationFn,
    invalidateKeys = [],
    successMessage = "Operation completed successfully",
    errorMessage = "Operation failed",
    onMutate,
    onErrorRollback,
    meta,
  } = options;

  return function useGeneratedMutation(): UseMutationResult<
    MutationResponse<TData>,
    Error,
    TVariables
  > {
    return useMutation({
      mutationFn: async (variables: TVariables) => {
        return mutationFn(variables);
      },
      meta: {
        ...meta,
        invalidates: invalidateKeys.length > 0 ? invalidateKeys : meta?.invalidates,
      },
      ...(onMutate
        ? {
            onMutate: async (variables: TVariables): Promise<TContext | undefined> => {
              return onMutate(variables);
            },
          }
        : {}),
      onSuccess: (response: MutationResponse<TData>) => {
        if (response.success) {
          const msg: string =
            typeof successMessage === "function" && response.data !== undefined
              ? successMessage(response.data)
              : (successMessage as string);
          toast.success(msg);
        } else {
          toast.error(response.error ?? errorMessage);
        }
      },
      onError: (_error: Error, _variables: TVariables, context: unknown) => {
        if (onErrorRollback && context) {
          onErrorRollback(context as TContext | undefined);
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
    const isEnabled = typeof enabledFn === "function" ? enabledFn(...args) : (enabledFn ?? true);

    return useQuery({
      queryKey: queryKeyFactory(...args),
      queryFn: async () => {
        const res = await queryFn(...args);
        if (!res.success) throw new Error(res.error ?? "Request failed");
        if (res.data === undefined) throw new Error("Missing response data");
        return res.data;
      },
      staleTime,
      ...(typeof enabledFn !== "undefined" ? { enabled: isEnabled } : {}),
    });
  };
}

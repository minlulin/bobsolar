import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMutationHook } from "./mutation-factory";

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn((opts: Record<string, unknown>) => opts),
  useQuery: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const useMutationMock = vi.mocked(useMutation);

type TestData = { id: string };
type TestVars = { name: string };

function execHook<TData, TVars>(...args: Parameters<typeof createMutationHook<TData, TVars>>) {
  const hook = createMutationHook<TData, TVars>(...args);
  return hook();
}

describe("createMutationHook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a hook function", () => {
    const hook = createMutationHook<TestData, TestVars>({
      mutationFn: async () => ({ success: true as const, data: { id: "1" } }),
    });
    expect(typeof hook).toBe("function");
  });

  it("passes meta invalidates to useMutation", () => {
    const invalidateKeys = [["test"]];
    execHook<TestData, TestVars>({
      mutationFn: async () => ({ success: true as const, data: { id: "1" } }),
      invalidateKeys,
    });
    expect(useMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ invalidates: invalidateKeys }),
      }),
    );
  });

  it("calls toast.success on success response", () => {
    execHook<TestData, TestVars>({
      mutationFn: async () => ({ success: true as const, data: { id: "1" } }),
      successMessage: "All good",
    });
    const opts = useMutationMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const onSuccess = opts["onSuccess"] as (response: {
      success: boolean;
      data?: TestData;
    }) => void;
    onSuccess({ success: true, data: { id: "1" } });
    expect(toast.success).toHaveBeenCalledWith("All good");
  });

  it("does not call toast.success on failed response (mutationFn should throw)", () => {
    execHook<TestData, TestVars>({
      mutationFn: async () => ({ success: false as const, error: "nope" }),
      successMessage: "All good",
      errorMessage: "Fail msg",
    });
    const opts = useMutationMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const onSuccess = opts["onSuccess"] as (response: { success: boolean }) => void;
    onSuccess({ success: false });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("throws on logical failure in mutationFn", async () => {
    const hook = createMutationHook<TestData, TestVars>({
      mutationFn: async () => ({ success: false as const, error: "server error" }),
      errorMessage: "Fallback",
    });
    const opts = hook() as Record<string, unknown>;
    const mutationFn = opts["mutationFn"] as (vars: TestVars) => Promise<unknown>;
    await expect(mutationFn({ name: "test" })).rejects.toThrow("server error");
  });

  it("calls toast.error with server error message", () => {
    execHook<TestData, TestVars>({
      mutationFn: async () => ({ success: false as const, error: "fallback" }),
      errorMessage: "Fallback",
    });
    const opts = useMutationMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const onError = opts["onError"] as (error: Error) => void;
    onError(new Error("server error"));
    expect(toast.error).toHaveBeenCalledWith("server error");
  });

  it("calls toast.error with errorMessage fallback when error.message is empty", () => {
    execHook<TestData, TestVars>({
      mutationFn: async () => {
        throw new Error("");
      },
      errorMessage: "Fallback msg",
    });
    const opts = useMutationMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const onError = opts["onError"] as (error: Error) => void;
    onError(new Error(""));
    expect(toast.error).toHaveBeenCalledWith("Fallback msg");
  });

  it("calls onErrorRollback on error when context is provided", () => {
    const rollback = vi.fn();
    execHook<TestData, TestVars>({
      mutationFn: async () => {
        throw new Error("err");
      },
      errorMessage: "Fallback",
      onErrorRollback: rollback,
    });
    const opts = useMutationMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const onError = opts["onError"] as (error: Error, vars: TestVars, context: unknown) => void;
    onError(new Error("err"), { name: "test" }, { prev: "state" });
    expect(rollback).toHaveBeenCalledWith({ prev: "state" });
  });

  it("does not call onErrorRollback when context is undefined", () => {
    const rollback = vi.fn();
    execHook<TestData, TestVars>({
      mutationFn: async () => {
        throw new Error("err");
      },
      errorMessage: "Fallback",
      onErrorRollback: rollback,
    });
    const opts = useMutationMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const onError = opts["onError"] as (error: Error, vars: TestVars, context: unknown) => void;
    onError(new Error("err"), { name: "test" }, undefined);
    expect(rollback).not.toHaveBeenCalled();
  });

  it("calls onMutate when provided", async () => {
    const onMutate = vi.fn(async () => "ctx");
    execHook<TestData, TestVars>({
      mutationFn: async () => ({ success: true as const, data: { id: "1" } }),
      onMutate,
    });
    const opts = useMutationMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const onMutateFn = opts["onMutate"] as (vars: TestVars) => Promise<string>;
    const ctx = await onMutateFn({ name: "test" });
    expect(onMutate).toHaveBeenCalledWith({ name: "test" });
    expect(ctx).toBe("ctx");
  });

  it("uses function successMessage", () => {
    execHook<TestData, TestVars>({
      mutationFn: async () => ({ success: true as const, data: { id: "1" } }),
      successMessage: (data) => `Created ${data.id}`,
    });
    const opts = useMutationMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const onSuccess = opts["onSuccess"] as (response: { success: boolean; data: TestData }) => void;
    onSuccess({ success: true, data: { id: "1" } });
    expect(toast.success).toHaveBeenCalledWith("Created 1");
  });

  it("uses default successMessage when not provided", () => {
    execHook<TestData, TestVars>({
      mutationFn: async () => ({ success: true as const, data: { id: "1" } }),
    });
    const opts = useMutationMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const onSuccess = opts["onSuccess"] as (response: { success: boolean; data: TestData }) => void;
    onSuccess({ success: true, data: { id: "1" } });
    expect(toast.success).toHaveBeenCalledWith("Operation completed successfully");
  });
});

import { describe, expect, it } from "vitest";
import { errorResponse, successResponse } from "@/lib/utils/action-response";

describe("successResponse", () => {
  it("returns success with string data", () => {
    const result = successResponse("hello");
    expect(result).toEqual({ success: true, data: "hello" });
  });

  it("returns success with number data", () => {
    const result = successResponse(42);
    expect(result).toEqual({ success: true, data: 42 });
  });

  it("returns success with boolean data", () => {
    const result = successResponse(true);
    expect(result).toEqual({ success: true, data: true });
  });

  it("returns success with object data", () => {
    const obj = { id: 1, name: "test" };
    const result = successResponse(obj);
    expect(result).toEqual({ success: true, data: { id: 1, name: "test" } });
  });

  it("returns success with array data", () => {
    const arr = [1, 2, 3];
    const result = successResponse(arr);
    expect(result).toEqual({ success: true, data: [1, 2, 3] });
  });

  it("returns success with null data", () => {
    const result = successResponse(null);
    expect(result).toEqual({ success: true, data: null });
  });

  it("returns success with undefined data", () => {
    const result = successResponse(undefined);
    expect(result).toEqual({ success: true, data: undefined });
  });

  it("preserves success as literal true for type narrowing", () => {
    const result = successResponse("test");
    expect(result.success).toBe(true);
  });
});

describe("errorResponse", () => {
  it("returns failure with error message", () => {
    const result = errorResponse("something went wrong");
    expect(result).toEqual({ success: false, error: "something went wrong" });
  });

  it("returns failure with empty string error", () => {
    const result = errorResponse("");
    expect(result).toEqual({ success: false, error: "" });
  });

  it("handles long error messages", () => {
    const longError = "a".repeat(1000);
    const result = errorResponse(longError);
    expect(result).toEqual({ success: false, error: longError });
  });

  it("handles special characters in error messages", () => {
    const result = errorResponse('error: "not found" <file> & saved');
    expect(result).toEqual({
      success: false,
      error: 'error: "not found" <file> & saved',
    });
  });

  it("preserves success as literal false for type narrowing", () => {
    const result = errorResponse("fail");
    expect(result.success).toBe(false);
  });
});

describe("ActionResponse discriminated union", () => {
  it("allows narrowing on success true to access data", () => {
    const result = successResponse(99);
    expect(result.data).toBe(99);
  });

  it("allows narrowing on success false to access error", () => {
    const result = errorResponse("fail");
    expect(result.error).toBe("fail");
  });
});

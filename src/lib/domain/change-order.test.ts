import { describe, expect, it } from "vitest";
import {
  CHANGE_ORDER_STATUS_LABELS,
  CHANGE_ORDER_STATUS_TRANSITIONS,
  canTransitionChangeOrderStatus,
  isChangeOrderStatus,
  permittedNextChangeOrderStatuses,
} from "@/lib/domain/change-order";

describe("change-order domain transitions", () => {
  it("allows draft → approved and draft → rejected", () => {
    expect(canTransitionChangeOrderStatus("draft", "approved")).toBe(true);
    expect(canTransitionChangeOrderStatus("draft", "rejected")).toBe(true);
  });

  it("blocks draft → cancelled", () => {
    expect(canTransitionChangeOrderStatus("draft", "cancelled")).toBe(false);
  });

  it("allows approved → cancelled", () => {
    expect(canTransitionChangeOrderStatus("approved", "cancelled")).toBe(true);
  });

  it("blocks approved → rejected and approved → draft", () => {
    expect(canTransitionChangeOrderStatus("approved", "rejected")).toBe(false);
    expect(canTransitionChangeOrderStatus("approved", "draft")).toBe(false);
  });

  it("treats rejected and cancelled as terminal", () => {
    expect(canTransitionChangeOrderStatus("rejected", "draft")).toBe(false);
    expect(canTransitionChangeOrderStatus("rejected", "approved")).toBe(false);
    expect(canTransitionChangeOrderStatus("cancelled", "approved")).toBe(false);
    expect(canTransitionChangeOrderStatus("cancelled", "draft")).toBe(false);
  });

  it("allows same-status (idempotent) transitions", () => {
    expect(canTransitionChangeOrderStatus("draft", "draft")).toBe(true);
    expect(canTransitionChangeOrderStatus("approved", "approved")).toBe(true);
  });

  it("returns correct permitted next statuses", () => {
    expect(permittedNextChangeOrderStatuses("draft")).toEqual(["approved", "rejected"]);
    expect(permittedNextChangeOrderStatuses("approved")).toEqual(["cancelled"]);
    expect(permittedNextChangeOrderStatuses("rejected")).toEqual([]);
    expect(permittedNextChangeOrderStatuses("cancelled")).toEqual([]);
  });

  it("validates change order status type guard", () => {
    expect(isChangeOrderStatus("draft")).toBe(true);
    expect(isChangeOrderStatus("approved")).toBe(true);
    expect(isChangeOrderStatus("rejected")).toBe(true);
    expect(isChangeOrderStatus("cancelled")).toBe(true);
    expect(isChangeOrderStatus("pending")).toBe(false);
    expect(isChangeOrderStatus("")).toBe(false);
  });

  it("provides labels for all statuses", () => {
    expect(CHANGE_ORDER_STATUS_LABELS).toEqual({
      draft: "Draft",
      approved: "Approved",
      rejected: "Rejected",
      cancelled: "Cancelled",
    });
  });

  it("exposes the full transition map", () => {
    expect(CHANGE_ORDER_STATUS_TRANSITIONS).toEqual({
      draft: ["approved", "rejected"],
      approved: ["cancelled"],
      rejected: [],
      cancelled: [],
    });
  });
});

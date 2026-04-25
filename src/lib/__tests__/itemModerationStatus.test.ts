import { describe, expect, it } from "vitest";

import {
  buildItemStatusUpdatePayload,
  isAdminModerationStatus,
  validateModerationStatusInput,
} from "../itemModerationStatus";

describe("itemModerationStatus helpers", () => {
  it("accepts supported moderation statuses", () => {
    expect(isAdminModerationStatus("available")).toBe(true);
    expect(isAdminModerationStatus("rejected")).toBe(true);
    expect(isAdminModerationStatus("needs_edits")).toBe(true);
  });

  it("rejects unsupported moderation statuses", () => {
    expect(isAdminModerationStatus("under_review")).toBe(false);
    expect(isAdminModerationStatus("pending_review")).toBe(false);
  });

  it("requires a reason for rejected and needs_edits", () => {
    const rejected = validateModerationStatusInput("rejected", "   ");
    const needsEdits = validateModerationStatusInput("needs_edits", undefined);

    expect(rejected.ok).toBe(false);
    expect(needsEdits.ok).toBe(false);
  });

  it("allows available without a reason", () => {
    const result = validateModerationStatusInput("available", undefined);

    expect(result).toEqual({
      ok: true,
      status: "available",
      reason: null,
    });
  });

  it("builds rejected payload with timestamp and appeal increment", () => {
    const payload = buildItemStatusUpdatePayload({
      status: "rejected",
      reason: "Unsafe product",
      currentAppealCount: 2,
    });

    expect(payload.status).toBe("rejected");
    expect(payload.rejection_reason).toBe("Unsafe product");
    expect(payload.appeal_count).toBe(3);
    expect(payload.edited_since_rejection).toBe(false);
    expect(payload.edited_since_rejection_at).toBeNull();
    expect(typeof payload.rejected_at).toBe("string");
  });

  it("builds needs_edits payload with moderation note and latest flagged timestamp", () => {
    const payload = buildItemStatusUpdatePayload({
      status: "needs_edits",
      reason: "Please replace blurry image and clarify age range",
      currentAppealCount: 1,
    });

    expect(payload.status).toBe("needs_edits");
    expect(payload.rejection_reason).toBe(
      "Please replace blurry image and clarify age range",
    );
    expect(payload.rejected_at).toBeNull();
    expect(payload.edited_since_rejection).toBe(false);
    expect(payload.edited_since_rejection_at).toBeNull();
    expect(typeof payload.flagged_at).toBe("string");
  });

  it("builds available payload that clears moderation fields", () => {
    const payload = buildItemStatusUpdatePayload({
      status: "available",
      reason: null,
      currentAppealCount: 7,
    });

    expect(payload).toEqual({
      status: "available",
      flagged_at: null,
      rejected_at: null,
      rejection_reason: null,
      appealed_at: null,
      appeal_reason: null,
      edited_since_rejection: false,
      edited_since_rejection_at: null,
    });
  });
});

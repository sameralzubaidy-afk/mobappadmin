export const ALLOWED_MODERATION_STATUSES = [
  "rejected",
  "available",
  "needs_edits",
] as const;

export type AdminModerationStatus =
  (typeof ALLOWED_MODERATION_STATUSES)[number];

interface ValidationSuccess {
  ok: true;
  status: AdminModerationStatus;
  reason: string | null;
}

interface ValidationFailure {
  ok: false;
  error: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

interface BuildPayloadInput {
  status: AdminModerationStatus;
  reason: string | null;
  currentAppealCount: number;
}

export function isAdminModerationStatus(
  value: string,
): value is AdminModerationStatus {
  return (ALLOWED_MODERATION_STATUSES as readonly string[]).includes(value);
}

export function validateModerationStatusInput(
  rawStatus: string | undefined,
  rawReason: string | undefined,
): ValidationResult {
  if (!rawStatus || !isAdminModerationStatus(rawStatus)) {
    return {
      ok: false,
      error: "status must be one of: rejected, available, needs_edits",
    };
  }

  const reason = rawReason?.trim() || null;
  if ((rawStatus === "rejected" || rawStatus === "needs_edits") && !reason) {
    return {
      ok: false,
      error:
        "rejection_reason is required when status is rejected or needs_edits",
    };
  }

  return {
    ok: true,
    status: rawStatus,
    reason,
  };
}

export function buildItemStatusUpdatePayload(
  input: BuildPayloadInput,
): Record<string, unknown> {
  const nowIso = new Date().toISOString();

  if (input.status === "rejected") {
    return {
      status: "rejected",
      rejection_reason: input.reason,
      rejected_at: nowIso,
      appeal_count: input.currentAppealCount + 1,
      edited_since_rejection: false,
      edited_since_rejection_at: null,
    };
  }

  if (input.status === "needs_edits") {
    return {
      status: "needs_edits",
      rejection_reason: input.reason,
      rejected_at: null,
      edited_since_rejection: false,
      edited_since_rejection_at: null,
    };
  }

  return {
    status: "available",
    flagged_at: null,
    rejected_at: null,
    rejection_reason: null,
    appealed_at: null,
    appeal_reason: null,
    edited_since_rejection: false,
    edited_since_rejection_at: null,
  };
}

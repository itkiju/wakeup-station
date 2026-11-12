export type MedicationTimingStatus =
  | "early"
  | "on_time"
  | "late"
  | "missed";

export type MedicationTimingResult = {
  status: MedicationTimingStatus;
  differenceMinutes: number;
  shouldAdjustNextDose: boolean;
};

const FIVE_MINUTES = 5 * 60 * 1000;
const THREE_HOURS = 3 * 60 * 60 * 1000;

function validTime(date: Date): number {
  const time = date.getTime();

  if (!Number.isFinite(time)) {
    throw new Error("Invalid medication timestamp");
  }

  return time;
}

export function classifyMedicationTiming(
  scheduledAt: Date,
  actualAt: Date
): MedicationTimingResult {
  const differenceMs =
    validTime(actualAt) - validTime(scheduledAt);

  const differenceMinutes = differenceMs / 60000;

  if (differenceMs < 0) {
    return {
      status: "early",
      differenceMinutes,
      shouldAdjustNextDose: true,
    };
  }

  if (differenceMs < FIVE_MINUTES) {
    return {
      status: "on_time",
      differenceMinutes,
      shouldAdjustNextDose: false,
    };
  }

  if (differenceMs <= THREE_HOURS) {
    return {
      status: "late",
      differenceMinutes,
      shouldAdjustNextDose: true,
    };
  }

  return {
    status: "missed",
    differenceMinutes,
    shouldAdjustNextDose: false,
  };
}

export function calculateAdjustedNextDose(
  scheduledAt: Date,
  actualAt: Date,
  nextScheduledAt: Date
): Date | null {
  const scheduled = validTime(scheduledAt);
  const actual = validTime(actualAt);
  const nextScheduled = validTime(nextScheduledAt);

  if (nextScheduled <= scheduled) {
    throw new Error("Next dose must be after scheduled dose");
  }

  const timing = classifyMedicationTiming(
    scheduledAt,
    actualAt
  );

  if (timing.status === "missed") {
    return null;
  }

  if (!timing.shouldAdjustNextDose) {
    return new Date(nextScheduled);
  }

  return new Date(nextScheduled + (actual - scheduled));
}

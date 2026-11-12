import {
  calculateAdjustedNextDose,
} from "./medication-timing";

export type LinkedMedicationSchedule = {
  id: string;
  time: string;
  days: string[];
  medicationGroupId?: string | null;
};

export type CompletedMedicationRecord = {
  medicationId: string;
  scheduledAt: Date;
  takenAt: Date;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getSeoulParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function getSeoulScheduledDate(
  year: number,
  month: number,
  day: number,
  time: string
): Date {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("Invalid medication time");
  }

  const [hour, minute] = time.split(":").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day, hour - 9, minute)
  );
}

export function findNextLinkedMedicationAlert(
  schedules: LinkedMedicationSchedule[],
  completed: CompletedMedicationRecord,
  maxSearchDays = 14
): {
  medicationId: string;
  scheduledAt: Date;
  adjustedAt: Date;
} | null {
  const source = schedules.find(
    item => item.id === completed.medicationId
  );

  if (!source?.medicationGroupId) {
    return null;
  }

  if (!Number.isInteger(maxSearchDays) ||
      maxSearchDays < 1 ||
      maxSearchDays > 366) {
    throw new Error("Invalid search days");
  }

  const linked = schedules.filter(
    item =>
      item.medicationGroupId === source.medicationGroupId
  );

  // 실제로 연결된 일정이 2개 이상일 때만
  // 다음 알림 자동 보정을 적용한다.
  if (linked.length < 2) {
    return null;
  }

  const origin = getSeoulParts(completed.scheduledAt);

  let next:
    | { medicationId: string; scheduledAt: Date }
    | null = null;

  for (let offset = 0; offset <= maxSearchDays; offset++) {
    const dayUtc = new Date(
      Date.UTC(origin.year, origin.month - 1, origin.day + offset)
    );

    const weekday = WEEKDAYS[dayUtc.getUTCDay()];

    for (const item of linked) {
      if (!item.days.includes(weekday)) {
        continue;
      }

      const scheduledAt = getSeoulScheduledDate(
        dayUtc.getUTCFullYear(),
        dayUtc.getUTCMonth() + 1,
        dayUtc.getUTCDate(),
        item.time
      );

      if (scheduledAt <= completed.scheduledAt) {
        continue;
      }

      if (!next || scheduledAt < next.scheduledAt) {
        next = {
          medicationId: item.id,
          scheduledAt,
        };
      }
    }
  }

  if (!next) {
    return null;
  }

  const adjustedAt = calculateAdjustedNextDose(
    completed.scheduledAt,
    completed.takenAt,
    next.scheduledAt
  );

  return {
    medicationId: next.medicationId,
    scheduledAt: next.scheduledAt,
    adjustedAt: adjustedAt ?? next.scheduledAt,
  };
}

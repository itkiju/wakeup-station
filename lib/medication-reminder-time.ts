export type ReminderTimeInput = {
  originalTime: string;
  adjustedAt?: string | null;
  delayedUntil?: string | null;
  now: Date;
  serverReady: boolean;
  completed: boolean;
};

export type ReminderTimeResult = {
  time: string | null;
  source: "original" | "adjusted" | "delay" | "blocked";
};

const SEOUL_TIME_ZONE = "Asia/Seoul";

function seoulParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const fields: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") fields[part.type] = part.value;
  }
  return fields;
}

function dateKey(date: Date): string {
  const p = seoulParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function validReminderTime(
  value: string | null | undefined,
  today: string
): string | null {
  if (!value) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return null;
  if (dateKey(parsed) !== today) return null;

  const p = seoulParts(parsed);
  return `${p.hour}:${p.minute}`;
}

export function isMedicationReminderDue(
  reminderTime: string | null,
  now: Date,
  windowMinutes = 5
): boolean {
  if (!reminderTime || !Number.isFinite(now.getTime())) return false;
  const match = /^([01]\\d|2[0-3]):([0-5]\\d)$/.exec(reminderTime);
  if (!match || !Number.isFinite(windowMinutes) || windowMinutes <= 0) return false;
  const p = seoulParts(now);
  const currentSeconds = Number(p.hour) * 3600 + Number(p.minute) * 60 + now.getUTCSeconds();
  const scheduledSeconds = Number(match[1]) * 3600 + Number(match[2]) * 60;
  const elapsed = currentSeconds - scheduledSeconds;
  return elapsed >= 0 && elapsed < windowMinutes * 60;
}

export function resolveMedicationReminderTime(
  input: ReminderTimeInput
): ReminderTimeResult {
  if (!input.serverReady || input.completed) {
    return { time: null, source: "blocked" };
  }

  const today = dateKey(input.now);

  const delayTime = validReminderTime(
    input.delayedUntil,
    today
  );

  if (delayTime) {
    return { time: delayTime, source: "delay" };
  }

  const adjustedTime = validReminderTime(
    input.adjustedAt,
    today
  );

  if (adjustedTime) {
    return { time: adjustedTime, source: "adjusted" };
  }

  return {
    time: input.originalTime,
    source: "original",
  };
}

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

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function validReminderTime(
  value: string | null | undefined,
  today: string
): string | null {
  if (!value) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return null;
  if (dateKey(parsed) !== today) return null;

  return [
    String(parsed.getHours()).padStart(2, "0"),
    String(parsed.getMinutes()).padStart(2, "0"),
  ].join(":");
}

export function isMedicationReminderDue(
  reminderTime: string | null,
  now: Date,
  windowMinutes = 5
): boolean {
  if (!reminderTime) return false;

  const match = /^(\d{2}):(\d{2})$/.exec(reminderTime);
  if (!match) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return false;

  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, 0, 0);

  const elapsed = now.getTime() - scheduled.getTime();

  return elapsed >= 0 &&
    elapsed < windowMinutes * 60 * 1000;
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

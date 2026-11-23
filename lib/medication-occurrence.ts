/** Original Asia/Seoul medication occurrence date, independent of delayed alert time. */
const SEOUL = "Asia/Seoul";

function seoulDateKey(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid date");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) if (part.type !== "literal") values[part.type] = part.value;
  return `${values.year}-${values.month}-${values.day}`;
}

export function medicationOccurrenceDate(scheduledAt: Date): string {
  return seoulDateKey(scheduledAt);
}

export function effectiveMedicationAlert(
  scheduledAt: Date,
  adjustedAt?: Date | null,
  delayedUntil?: Date | null,
): { scheduledDate: string; alertAt: Date } {
  if (!Number.isFinite(scheduledAt.getTime())) throw new Error("Invalid scheduledAt");
  const alertAt = delayedUntil ?? adjustedAt ?? scheduledAt;
  if (!Number.isFinite(alertAt.getTime())) throw new Error("Invalid alertAt");
  return { scheduledDate: medicationOccurrenceDate(scheduledAt), alertAt };
}

export function isMedicationOccurrenceDueOn(
  scheduledAt: Date,
  now: Date,
  adjustedAt?: Date | null,
  delayedUntil?: Date | null,
): boolean {
  const result = effectiveMedicationAlert(scheduledAt, adjustedAt, delayedUntil);
  return seoulDateKey(result.alertAt) === seoulDateKey(now);
}

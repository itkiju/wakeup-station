import { NextResponse } from "next/server";
import { verifyDeviceContext } from "@/lib/device-auth";
import { getDatabase } from "@/lib/db";
import {
  findNextLinkedMedicationAlert,
  type LinkedMedicationSchedule,
} from "@/lib/medication-next-alert";

const SEOUL_TIME_ZONE = "Asia/Seoul";

function seoulDateKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function validDate(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date
    ? value
    : new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    const context = await verifyDeviceContext(token);

    if (!context) {
      return NextResponse.json(
        { error: "등록되지 않은 기기입니다." },
        { status: 401 }
      );
    }

    const sql = getDatabase();

    // 기존 복약 일정 및 K4 지연 정보 조회를 유지한다.
    const medications = await sql`
      SELECT
        s.medication_id,
        s.name,
        s.time,
        s.days,
        s.completed_dates,
        s.medication_group_id,
        d.delay_minutes,
        d.delayed_until
      FROM medication_group_schedules s
      LEFT JOIN medication_delays d
        ON d.sync_group_id = s.sync_group_id
        AND d.medication_id = s.medication_id
        AND d.scheduled_date =
          (NOW() AT TIME ZONE 'Asia/Seoul')::date
        -- 오늘의 K4 지연 기록은 알림 시각이 지나도 유지한다.
        -- 웹앱에서 지연 알림의 정확한 발생 시각을 판단한다.
      WHERE s.sync_group_id = ${context.syncGroupId}::uuid
      ORDER BY s.time, s.name
    `;

    // 완료된 복용 기록만 읽는다.
    // 과거 15일 이내 기록을 조회하여 다음 날/다음 주
    // 반복 일정까지 계산할 수 있도록 한다.
    const history = await sql`
      SELECT
        medication_id,
        scheduled_at,
        taken_at
      FROM medication_history
      WHERE sync_group_id = ${context.syncGroupId}::uuid
        AND status = 'completed'
        AND taken_at IS NOT NULL
        AND scheduled_at >= NOW() - INTERVAL '15 days'
      ORDER BY scheduled_at DESC, taken_at DESC
      LIMIT 500
    `;

    const versions = await sql`
      SELECT last_version
      FROM medication_group_sync_versions
      WHERE sync_group_id = ${context.syncGroupId}::uuid
      LIMIT 1
    `;

    const schedules: LinkedMedicationSchedule[] = medications.map(
      (item) => ({
        id: String(item.medication_id),
        time: String(item.time),
        days: Array.isArray(item.days)
          ? item.days.map(String)
          : [],
        medicationGroupId:
          typeof item.medication_group_id === "string"
            ? item.medication_group_id
            : null,
      })
    );

    const now = new Date();
    const todayKey = seoulDateKey(now);

    const adjustments = new Map<
      string,
      {
        sourceScheduledAt: Date;
        adjustedAt: Date;
      }
    >();

    for (const record of history) {
      const scheduledAt = validDate(record.scheduled_at);
      const takenAt = validDate(record.taken_at);

      if (!scheduledAt || !takenAt) {
        continue;
      }

      // 예정 시각이 미래인 비정상 완료 기록은 제외한다.
      if (scheduledAt > now) {
        continue;
      }

      // 과거 복용 기록의 예정 시각이 현재 일정과
      // 일치하지 않으면 자동 보정 대상에서 제외한다.
      const sourceSchedule = schedules.find(
        (item) => item.id === String(record.medication_id)
      );

      if (!sourceSchedule) {
        continue;
      }

      const scheduledTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: SEOUL_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(scheduledAt);

      if (sourceSchedule.time !== scheduledTime) {
        continue;
      }

      const result = findNextLinkedMedicationAlert(
        schedules,
        {
          medicationId: String(record.medication_id),
          scheduledAt,
          takenAt,
        }
      );

      if (!result) {
        continue;
      }

      // 이번 API는 오늘 발생할 알림만 보정한다.
      if (seoulDateKey(result.scheduledAt) !== todayKey) {
        continue;
      }

      const existing = adjustments.get(result.medicationId);

      // 동일한 다음 일정에 여러 기록이 연결되면
      // 가장 최근 예정 복용 기록을 우선한다.
      if (
        existing &&
        existing.sourceScheduledAt >= scheduledAt
      ) {
        continue;
      }

      adjustments.set(result.medicationId, {
        sourceScheduledAt: scheduledAt,
        adjustedAt: result.adjustedAt,
      });
    }

    const medicationsWithAdjustments = medications.map((item) => {
      const medicationId = String(item.medication_id);

      const completedDates = Array.isArray(item.completed_dates)
        ? item.completed_dates.map(String)
        : [];

      const alreadyCompleted = completedDates.includes(todayKey);

      const adjustment = alreadyCompleted
        ? undefined
        : adjustments.get(medicationId);

      return {
        ...item,
        // 기존 time 및 K4 delayed_until은 절대 변경하지 않는다.
        adjusted_reminder_at: adjustment
          ? adjustment.adjustedAt.toISOString()
          : null,
      };
    });

    return NextResponse.json(
      {
        success: true,
        medications: medicationsWithAdjustments,
        lastVersion: Number(versions[0]?.last_version ?? 0),
        syncGroupId: context.syncGroupId,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "digest" in error &&
      error.digest === "NEXT_PRERENDER_INTERRUPTED"
    ) {
      throw error;
    }

    console.error("공통 복약 일정 조회 실패:", error);

    return NextResponse.json(
      { error: "공통 복약 일정을 조회하지 못했습니다." },
      { status: 500 }
    );
  }
}

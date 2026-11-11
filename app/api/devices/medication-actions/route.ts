import { NextResponse } from "next/server";
import { verifyDeviceContext } from "@/lib/device-auth";
import { getDatabase } from "@/lib/db";

// POST /api/devices/medication-actions
// { "action": "taken", "medicationId": "..." }
// This first phase intentionally implements only TAKEN, not DELAY.
export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;
    const context = await verifyDeviceContext(token);
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const input = body as Record<string, unknown>;

    // DELAY: K4에서 선택한 약의 알림을 5/10/15분 연기
    if (input.action === "delay") {
      const medicationId = input.medicationId;
      const minutes = input.minutes;

      if (
        typeof medicationId !== "string" ||
        medicationId.length < 1 ||
        medicationId.length > 100 ||
        ![5, 10, 15].includes(Number(minutes)) ||
        typeof minutes !== "number"
      ) {
        return NextResponse.json(
          { error: "Invalid delay request" },
          { status: 400 }
        );
      }

      const sql = getDatabase();

      // 서울 날짜를 기준으로 오늘의 약만 처리한다.
      // 이미 복용 완료된 약은 연기할 수 없다.
      const result = await sql`
        INSERT INTO medication_delays (
          sync_group_id,
          medication_id,
          scheduled_date,
          delay_minutes,
          delayed_until
        )
        SELECT
          ${context.syncGroupId}::uuid,
          s.medication_id,
          (NOW() AT TIME ZONE 'Asia/Seoul')::date,
          ${minutes}::integer,
          NOW() + (${minutes}::integer * INTERVAL '1 minute')
        FROM medication_group_schedules s
        WHERE s.sync_group_id = ${context.syncGroupId}::uuid
          AND s.medication_id = ${medicationId}
          AND NOT (
            s.completed_dates ? TO_CHAR(
              NOW() AT TIME ZONE 'Asia/Seoul',
              'YYYY-MM-DD'
            )
          )
        ON CONFLICT (
          sync_group_id,
          medication_id,
          scheduled_date
        )
        DO UPDATE SET
          delay_minutes = EXCLUDED.delay_minutes,
          delayed_until = EXCLUDED.delayed_until,
          updated_at = NOW()
        RETURNING
          medication_id,
          delay_minutes,
          delayed_until
      `;

      if (result.length === 0) {
        return NextResponse.json(
          {
            error: "Medication not found or already completed"
          },
          { status: 409 }
        );
      }

      // 다른 기기가 변경 사항을 감지할 수 있도록
      // 공통 복약 동기화 버전을 갱신한다.
      const versions = await sql`
        INSERT INTO medication_group_sync_versions (
          sync_group_id,
          last_version,
          updated_at
        )
        VALUES (
          ${context.syncGroupId}::uuid,
          1,
          NOW()
        )
        ON CONFLICT (sync_group_id)
        DO UPDATE SET
          last_version =
            medication_group_sync_versions.last_version + 1,
          updated_at = NOW()
        RETURNING last_version
      `;

      return NextResponse.json(
        {
          success: true,
          action: "delay",
          medicationId: result[0].medication_id,
          delayMinutes: result[0].delay_minutes,
          delayedUntil: result[0].delayed_until,
          newVersion: Number(versions[0].last_version)
        },
        {
          headers: { "Cache-Control": "no-store" }
        }
      );
    }

    if (input.action !== "taken" ||
        typeof input.medicationId !== "string" ||
        input.medicationId.length < 1 || input.medicationId.length > 100) {
      return NextResponse.json({ error: "Invalid action or medicationId" }, { status: 400 });
    }

    const sql = getDatabase();
    const result = await sql`
      SELECT * FROM complete_medication_from_device(
        ${context.syncGroupId}::uuid,
        ${input.medicationId}::text
      )
    `;
    return NextResponse.json(
      { success: true, applied: result[0]?.applied === true,
        completedDate: result[0]?.completed_date,
        newVersion: Number(result[0]?.new_version) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Device medication action failed:", error);
    return NextResponse.json({ error: "Medication action failed" }, { status: 500 });
  }
}

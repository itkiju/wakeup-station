import { NextResponse } from "next/server";
import { verifyDeviceContext } from "@/lib/device-auth";
import { getDatabase } from "@/lib/db";


function getToken(request: Request) {
  const authorization = request.headers.get("authorization");

  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;
}

export async function GET(request: Request) {
  try {
    const context = await verifyDeviceContext(getToken(request));

    if (!context) {
      return NextResponse.json(
        { error: "등록되지 않은 기기입니다." },
        { status: 401 }
      );
    }

    const sql = getDatabase();

    const history = await sql`
      SELECT
        id,
        medication_id,
        scheduled_at,
        taken_at,
        status,
        source
      FROM medication_history
      WHERE sync_group_id = ${context.syncGroupId}::uuid
      ORDER BY scheduled_at DESC
      LIMIT 500
    `;

    return NextResponse.json(
      { success: true, history },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("복약 이력 조회 실패:", error);

    return NextResponse.json(
      { error: "복약 이력을 조회하지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const expectedOrigin = new URL(request.url).origin;

    if (origin !== expectedOrigin) {
      return NextResponse.json(
        { error: "허용되지 않은 요청입니다." },
        { status: 403 }
      );
    }

    const context = await verifyDeviceContext(getToken(request));

    if (!context) {
      return NextResponse.json(
        { error: "등록되지 않은 기기입니다." },
        { status: 401 }
      );
    }

    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "잘못된 요청입니다." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;

    const { medicationId, scheduledAt, status } = input;

    if (
      typeof medicationId !== "string" ||
      medicationId.length === 0 ||
      medicationId.length > 100 ||
      typeof scheduledAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(scheduledAt) ||
      !Number.isFinite(Date.parse(scheduledAt)) ||
      (status !== "completed" && status !== "cancelled")
    ) {
      return NextResponse.json(
        { error: "복약 이력 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const sql = getDatabase();

    // 현재 그룹에 실제로 등록된 복약 일정인지 확인
    const registered = await sql`
      SELECT medication_id
      FROM medication_group_schedules
      WHERE sync_group_id = ${context.syncGroupId}::uuid
        AND medication_id = ${medicationId}
      LIMIT 1
    `;

    if (registered.length === 0) {
      return NextResponse.json(
        { error: "등록되지 않은 복약 일정입니다." },
        { status: 404 }
      );
    }

    const history = await sql`
      INSERT INTO medication_history (
        sync_group_id,
        medication_id,
        scheduled_at,
        taken_at,
        status,
        source
      )
      VALUES (
        ${context.syncGroupId}::uuid,
        ${medicationId},
        ${scheduledAt}::timestamptz,
        CASE
          WHEN ${status} = 'completed' THEN NOW()
          ELSE NULL
        END,
        ${status},
        'app'
      )
      ON CONFLICT (
        sync_group_id,
        medication_id,
        scheduled_at
      )
      DO UPDATE SET
        status = EXCLUDED.status,
        taken_at = CASE
          WHEN EXCLUDED.status = 'completed'
          THEN CASE
            WHEN medication_history.status = 'completed'
            THEN medication_history.taken_at
            ELSE NOW()
          END
          ELSE NULL
        END,
        updated_at = NOW()
      RETURNING
        id,
        medication_id,
        scheduled_at,
        taken_at,
        status,
        source
    `;

    return NextResponse.json({
      success: true,
      history: history[0],
    });
  } catch (error) {
    console.error("복약 이력 저장 실패:", error);

    return NextResponse.json(
      { error: "복약 이력을 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}

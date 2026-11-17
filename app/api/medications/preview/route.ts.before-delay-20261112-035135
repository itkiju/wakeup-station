import { NextResponse } from "next/server";
import { verifyDeviceContext } from "@/lib/device-auth";
import { getDatabase } from "@/lib/db";

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

    const medications = await sql`
      SELECT
        medication_id,
        name,
        time,
        days,
        completed_dates
      FROM medication_group_schedules
      WHERE sync_group_id = ${context.syncGroupId}::uuid
      ORDER BY time, name
    `;

    const versions = await sql`
      SELECT last_version
      FROM medication_group_sync_versions
      WHERE sync_group_id = ${context.syncGroupId}::uuid
      LIMIT 1
    `;

    return NextResponse.json(
      {
        success: true,
        medications,
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

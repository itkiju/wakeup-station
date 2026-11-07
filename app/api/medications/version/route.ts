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

    const result = await sql`
      SELECT last_version
      FROM medication_group_sync_versions
      WHERE sync_group_id = ${context.syncGroupId}::uuid
      LIMIT 1
    `;

    const countResult = await sql`
      SELECT COUNT(*)::int AS count
      FROM medication_group_schedules
      WHERE sync_group_id = ${context.syncGroupId}::uuid
    `;

    return NextResponse.json({
      success: true,
      syncGroupId: context.syncGroupId,
      lastVersion: Number(result[0]?.last_version ?? 0),
      medicationCount: Number(countResult[0].count),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "digest" in error &&
      error.digest === "NEXT_PRERENDER_INTERRUPTED"
    ) {
      throw error;
    }

    console.error("그룹 동기화 버전 조회 실패:", error);

    return NextResponse.json(
      { error: "동기화 버전을 조회하지 못했습니다." },
      { status: 500 }
    );
  }
}

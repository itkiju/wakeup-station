import { NextResponse } from "next/server";
import { verifyDeviceToken } from "@/lib/device-auth";
import { getDatabase } from "@/lib/db";

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

    const authorization = request.headers.get("authorization");

    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    const deviceId = await verifyDeviceToken(token);

    if (!deviceId) {
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

    const medicationId = (
      body as Record<string, unknown>
    ).medicationId;

    if (
      typeof medicationId !== "string" ||
      medicationId.length === 0 ||
      medicationId.length > 100
    ) {
      return NextResponse.json(
        { error: "올바른 약 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const sql = getDatabase();

    const result = await sql`
      DELETE FROM medication_schedules
      WHERE device_id = ${deviceId}::uuid
        AND medication_id = ${medicationId}
      RETURNING medication_id
    `;

    return NextResponse.json({
      success: true,
      deletedCount: result.length,
    });
  } catch {
    console.error("복약 일정 삭제 실패");

    return NextResponse.json(
      { error: "복약 일정을 삭제하지 못했습니다." },
      { status: 500 }
    );
  }
}

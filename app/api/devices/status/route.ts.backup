import { NextResponse } from "next/server";
import { verifyDeviceContext } from "@/lib/device-auth";
import { getDatabase } from "@/lib/db";

export async function GET(request: Request) {
  try {
    // 1. 기기 인증
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

    // 2. 같은 동기화 그룹의 최신 센서 데이터 조회
    const sql = getDatabase();

    const result = await sql`
      SELECT
        t.device_id,
        t.temperature,
        t.humidity,
        t.lid_open,
        t.updated_at
      FROM device_telemetry AS t
      INNER JOIN device_registrations AS d
        ON d.id = t.device_id
      WHERE d.sync_group_id = ${context.syncGroupId}::uuid
      ORDER BY t.updated_at DESC
      LIMIT 1
    `;

    // 3. 센서 데이터가 없는 경우
    if (result.length === 0) {
      return NextResponse.json(
        {
          success: true,
          connected: false,
          temperature: null,
          humidity: null,
          lidOpen: null,
          lastSeen: null,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // 4. 마지막 수신 시간으로 연결 상태 판단
    const latest = result[0];
    const lastSeen = new Date(latest.updated_at);
    const elapsed = Date.now() - lastSeen.getTime();

    const connected = elapsed >= 0 && elapsed <= 90000;

    return NextResponse.json(
      {
        success: true,
        connected,
        temperature: Number(latest.temperature),
        humidity: Number(latest.humidity),
        lidOpen: latest.lid_open,
        lastSeen: lastSeen.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

  } catch (error) {
    // Next.js 16 사전 렌더링 중단 신호는 다시 전달
    if (
      error instanceof Error &&
      "digest" in error &&
      error.digest === "NEXT_PRERENDER_INTERRUPTED"
    ) {
      throw error;
    }

    console.error("기기 상태 조회 실패:", error);

    return NextResponse.json(
      { error: "기기 상태를 조회하지 못했습니다." },
      { status: 500 }
    );
  }
}

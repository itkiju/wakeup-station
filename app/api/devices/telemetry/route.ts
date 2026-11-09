import { NextResponse } from "next/server";
import { verifyDeviceContext } from "@/lib/device-auth";
import { getDatabase } from "@/lib/db";

// ========================================
// WakeUp Station Pro
// ESP32 Telemetry API
// ========================================

export async function POST(request: Request) {
  try {
    // 1. 기기 인증
    const authorization =
      request.headers.get("authorization");

    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    const context = await verifyDeviceContext(token);

    if (!context) {
      return NextResponse.json(
        { error: "인증되지 않은 기기입니다." },
        { status: 401 }
      );
    }

    // 2. JSON 데이터 확인
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "잘못된 요청 형식입니다." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;

    const { temperature, humidity, lidOpen } = input;

    // 3. 센서값 검증
    if (
      typeof temperature !== "number" ||
      !Number.isFinite(temperature) ||
      temperature < -40 ||
      temperature > 80 ||
      typeof humidity !== "number" ||
      !Number.isFinite(humidity) ||
      humidity < 0 ||
      humidity > 100 ||
      typeof lidOpen !== "boolean"
    ) {
      return NextResponse.json(
        { error: "센서 데이터가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // 4. Neon 데이터베이스 저장
    const sql = getDatabase();

    await sql`
      INSERT INTO device_telemetry (
        device_id,
        temperature,
        humidity,
        lid_open,
        updated_at
      )
      VALUES (
        ${context.deviceId}::uuid,
        ${temperature},
        ${humidity},
        ${lidOpen},
        NOW()
      )
      ON CONFLICT (device_id)
      DO UPDATE SET
        temperature = EXCLUDED.temperature,
        humidity = EXCLUDED.humidity,
        lid_open = EXCLUDED.lid_open,
        updated_at = NOW()
    `;

    // 5. 저장 성공 응답
    return NextResponse.json(
      {
        success: true,
        message: "센서 데이터 저장 성공",
        receivedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

  } catch (error) {
    console.error("Telemetry API error:", error);

    return NextResponse.json(
      { error: "센서 데이터 처리 실패" },
      { status: 500 }
    );
  }
}

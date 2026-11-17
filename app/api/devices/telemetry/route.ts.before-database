import { NextResponse } from "next/server";
import { verifyDeviceContext } from "@/lib/device-auth";


// ========================================
// WakeUp Station Pro
// ESP32 Sensor Telemetry API
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

    // 2. 요청 데이터 확인
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

    // 4. 수신 확인
    // 이번 단계에서는 DB에 저장하지 않음
    console.log("ESP32 telemetry received", {
      deviceId: context.deviceId,
      temperature,
      humidity,
      lidOpen,
    });

    return NextResponse.json(
      {
        success: true,
        deviceId: context.deviceId,
        receivedAt: new Date().toISOString(),
        message: "센서 데이터 수신 성공",
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

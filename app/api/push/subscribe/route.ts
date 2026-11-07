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
        { error: "구독 정보가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;
    const subscription = payload.subscription as Record<string, unknown>;
    const keys = subscription.keys;

    if (
      typeof subscription.endpoint !== "string" ||
      !subscription.endpoint.startsWith("https://") ||
      subscription.endpoint.length > 2048 ||
      typeof keys !== "object" ||
      keys === null ||
      !("p256dh" in keys) ||
      !("auth" in keys)
    ) {
      return NextResponse.json(
        { error: "구독 정보 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const pushKeys = keys as Record<string, unknown>;

    if (
      typeof pushKeys.p256dh !== "string" ||
      typeof pushKeys.auth !== "string" ||
      pushKeys.p256dh.length > 512 ||
      pushKeys.auth.length > 512
    ) {
      return NextResponse.json(
        { error: "구독 키가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const sql = getDatabase();

    const saved = await sql`
      INSERT INTO push_subscriptions
        (endpoint, p256dh, auth, device_id)
      VALUES
        (
          ${subscription.endpoint},
          ${pushKeys.p256dh},
          ${pushKeys.auth},
          ${deviceId}::uuid
        )
      ON CONFLICT (endpoint)
      DO UPDATE SET
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        updated_at = NOW()
      WHERE push_subscriptions.device_id =
            EXCLUDED.device_id
      RETURNING id
    `;

    if (saved.length === 0) {
      return NextResponse.json(
        { error: "다른 기기에 등록된 구독 정보입니다." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "푸시 구독 정보가 저장되었습니다.",
    });
  } catch (error) {
    console.error("푸시 구독 저장 실패:", error);

    return NextResponse.json(
      { error: "푸시 구독 정보를 저장할 수 없습니다." },
      { status: 500 }
    );
  }
}

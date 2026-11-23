import { NextResponse } from "next/server";
import { verifyDeviceContext } from "@/lib/device-auth";
import { getDatabase } from "@/lib/db";
import * as webpush from "web-push";

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

    // 5. 습도 경고 상태는 DB에 유지해 서버리스 요청 사이에도 누적합니다.
    // >=60% 5분 지속 시 경고, <55% 5분 지속 시 해제.
    const warningRows = await sql`
      INSERT INTO device_humidity_alerts (
        device_id, high_since, recovery_since, active, updated_at
      ) VALUES (
        ${context.deviceId}::uuid,
        CASE WHEN ${humidity} >= 60 THEN NOW() ELSE NULL END,
        CASE WHEN ${humidity} < 55 THEN NOW() ELSE NULL END,
        FALSE, NOW()
      )
      ON CONFLICT (device_id) DO UPDATE SET
        high_since = CASE
          WHEN ${humidity} >= 60 THEN COALESCE(device_humidity_alerts.high_since, NOW())
          ELSE NULL END,
        recovery_since = CASE
          WHEN ${humidity} < 55 THEN COALESCE(device_humidity_alerts.recovery_since, NOW())
          ELSE NULL END,
        active = CASE
          WHEN device_humidity_alerts.active
            AND ${humidity} < 55
            AND device_humidity_alerts.recovery_since <= NOW() - INTERVAL '5 minutes'
            THEN FALSE
          WHEN NOT device_humidity_alerts.active
            AND ${humidity} >= 60
            AND device_humidity_alerts.high_since <= NOW() - INTERVAL '5 minutes'
            THEN TRUE
          ELSE device_humidity_alerts.active END,
        updated_at = NOW()
      RETURNING active, (active AND notified_at IS NULL) AS needs_notification
    `;

    const warningActive = warningRows[0]?.active === true;
    if (warningActive && warningRows[0]?.needs_notification === true) {
      // 알림 중복 방지: 동시에 수신된 요청 중 한 요청만 전송 담당.
      const claimed = await sql`
        UPDATE device_humidity_alerts
        SET notified_at = NOW()
        WHERE device_id = ${context.deviceId}::uuid
          AND active = TRUE AND notified_at IS NULL
        RETURNING device_id
      `;
      if (claimed.length > 0) {
        try {
          const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          const privateKey = process.env.VAPID_PRIVATE_KEY;
          const subject = process.env.VAPID_SUBJECT;
          if (!publicKey || !privateKey || !subject) {
            throw new Error("VAPID configuration missing");
          }
          webpush.setVapidDetails(subject, publicKey, privateKey);
          const subscriptions = await sql`
            SELECT p.endpoint, p.p256dh, p.auth
            FROM push_subscriptions p
            JOIN device_registrations d ON d.id = p.device_id
            WHERE d.sync_group_id = ${context.syncGroupId}::uuid
              AND d.revoked_at IS NULL
          `;
          const payload = JSON.stringify({
            title: "⚠️ WakeUp Station Pro 습도 경고",
            body: "약통 내부 습도가 높습니다. 서늘하고 건조한 곳으로 옮기고 약품별 보관 지침을 확인하세요.",
            url: "/",
            tag: "humidity-warning",
          });
          await Promise.allSettled(subscriptions.map((sub) =>
            webpush.sendNotification({
              endpoint: String(sub.endpoint),
              keys: { p256dh: String(sub.p256dh), auth: String(sub.auth) },
            }, payload)
          ));
        } catch (pushError) {
          console.error("Humidity push dispatch failed:", pushError);
        }
      }
    }
    if (!warningActive) {
      // 정상 복귀 후에는 다음 경고 시 다시 알림을 보낼 수 있도록 초기화.
      await sql`
        UPDATE device_humidity_alerts
        SET notified_at = NULL
        WHERE device_id = ${context.deviceId}::uuid AND active = FALSE
      `;
    }

    // 6. 뚜껑 열림 시간 추적: 3분 연속 열림 시 경고, 닫히면 즉시 해제.
    // DB가 상태를 저장하므로 브라우저가 닫혀 있어도 동작합니다.
    const lidRows = await sql`
      INSERT INTO device_lid_alerts (device_id, opened_at, active, notified_at, updated_at)
      VALUES (
        ${context.deviceId}::uuid,
        CASE WHEN ${lidOpen} THEN NOW() ELSE NULL END,
        FALSE, NULL, NOW()
      )
      ON CONFLICT (device_id) DO UPDATE SET
        opened_at = CASE
          WHEN ${lidOpen} THEN COALESCE(device_lid_alerts.opened_at, NOW())
          ELSE NULL END,
        active = CASE
          WHEN NOT ${lidOpen} THEN FALSE
          WHEN device_lid_alerts.opened_at <= NOW() - INTERVAL '3 minutes' THEN TRUE
          ELSE device_lid_alerts.active END,
        notified_at = CASE
          WHEN NOT ${lidOpen} THEN NULL
          ELSE device_lid_alerts.notified_at END,
        updated_at = NOW()
      RETURNING active, (active AND notified_at IS NULL) AS needs_notification
    `;

    if (lidRows[0]?.active === true && lidRows[0]?.needs_notification === true) {
      // 동시 요청이 있어도 한 요청만 푸시 발송을 담당합니다.
      const claimedLid = await sql`
        UPDATE device_lid_alerts SET notified_at = NOW()
        WHERE device_id = ${context.deviceId}::uuid
          AND active = TRUE AND notified_at IS NULL
        RETURNING device_id
      `;
      if (claimedLid.length > 0) {
        try {
          const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          const privateKey = process.env.VAPID_PRIVATE_KEY;
          const subject = process.env.VAPID_SUBJECT;
          if (!publicKey || !privateKey || !subject) throw new Error("VAPID configuration missing");
          webpush.setVapidDetails(subject, publicKey, privateKey);
          const subscriptions = await sql`
            SELECT p.endpoint, p.p256dh, p.auth
            FROM push_subscriptions p
            JOIN device_registrations d ON d.id = p.device_id
            WHERE d.sync_group_id = ${context.syncGroupId}::uuid
              AND d.revoked_at IS NULL
          `;
          const payload = JSON.stringify({
            title: "⚠️ WakeUp Station Pro 뚜껑 열림",
            body: "약통 뚜껑이 3분 이상 열려 있습니다. 약품 보관을 위해 뚜껑을 닫아주세요.",
            url: "/",
            tag: "lid-open-warning",
          });
          const results = await Promise.allSettled(subscriptions.map((sub) =>
            webpush.sendNotification({
              endpoint: String(sub.endpoint),
              keys: { p256dh: String(sub.p256dh), auth: String(sub.auth) },
            }, payload)
          ));
          for (const result of results) {
            if (result.status === "rejected") console.error("Lid push failed:", result.reason);
          }
        } catch (pushError) {
          console.error("Lid push dispatch failed:", pushError);
        }
      }
    }

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

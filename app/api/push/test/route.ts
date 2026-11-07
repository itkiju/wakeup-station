import { NextResponse } from "next/server";
import * as webpush from "web-push";
import { getDatabase } from "@/lib/db";
import { verifyPushAdminSecret } from "@/lib/push-auth";


export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!verifyPushAdminSecret(token)) {
      return NextResponse.json(
        { error: "관리자 인증에 실패했습니다." },
        { status: 401 }
      );
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) {
      return NextResponse.json(
        { error: "VAPID 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const sql = getDatabase();

    const subscriptions = await sql`
      SELECT endpoint, p256dh, auth
      FROM push_subscriptions
      WHERE device_id IS NOT NULL
    `;

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: "등록된 아이폰 푸시 구독이 없습니다." },
        { status: 404 }
      );
    }

    const payload = JSON.stringify({
      title: "💊 WakeUp Station Pro",
      body: "아이폰 푸시 알림 테스트 성공!",
      url: "/",
    });

    let successCount = 0;
    let failureCount = 0;

    for (const row of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: String(row.endpoint),
            keys: {
              p256dh: String(row.p256dh),
              auth: String(row.auth),
            },
          },
          payload
        );

        successCount++;
      } catch (error) {
        failureCount++;
        console.error("개별 푸시 전송 실패");
      }
    }

    return NextResponse.json({
      success: successCount > 0,
      successCount,
      failureCount,
    });
  } catch (error) {
    console.error("테스트 푸시 API 오류");
    return NextResponse.json(
      { error: "테스트 알림을 발송하지 못했습니다." },
      { status: 500 }
    );
  }
}

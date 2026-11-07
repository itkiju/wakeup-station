import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { getDatabase } from "@/lib/db";
import { verifyPushAdminSecret } from "@/lib/push-auth";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(request.url).origin;

  if (origin && origin !== expectedOrigin) {
    return NextResponse.json(
      { error: "허용되지 않은 요청입니다." },
      { status: 403 }
    );
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!verifyPushAdminSecret(token)) {
    return NextResponse.json(
      { error: "관리자 인증이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const code = randomBytes(24).toString("base64url");

    const codeHash = createHash("sha256")
      .update(code)
      .digest("hex");

    const sql = getDatabase();

    const result = await sql`
      INSERT INTO device_registration_codes (
        code_hash,
        expires_at,
        sync_group_id
      )
      SELECT
        ${codeHash},
        NOW() + INTERVAL '10 minutes',
        id
      FROM sync_groups
      WHERE name = 'WakeUp Station 개인 그룹'
      RETURNING code_hash
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "공통 사용자 그룹을 찾을 수 없습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        code,
        expiresInSeconds: 600,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("등록 코드 발급 실패:", error);

    return NextResponse.json(
      { error: "등록 코드를 발급할 수 없습니다." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
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

    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "요청 형식이 잘못되었습니다." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;
    const code = input.code;
    const deviceName = input.deviceName;

    if (
      typeof code !== "string" ||
      !/^[A-Za-z0-9_-]{32}$/.test(code) ||
      typeof deviceName !== "string" ||
      deviceName.trim().length < 1 ||
      deviceName.trim().length > 50
    ) {
      return NextResponse.json(
        { error: "등록 코드 또는 기기 이름이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const codeHash = createHash("sha256")
      .update(code)
      .digest("hex");

    const deviceToken = randomBytes(32).toString("base64url");

    const tokenHash = createHash("sha256")
      .update(deviceToken)
      .digest("hex");

    const deviceId = randomUUID();
    const sql = getDatabase();

    const result = await sql`
      WITH consumed AS (
        UPDATE device_registration_codes
        SET used_at = NOW()
        WHERE code_hash = ${codeHash}
          AND used_at IS NULL
          AND expires_at > NOW()
          AND sync_group_id IS NOT NULL
        RETURNING sync_group_id
      )
      INSERT INTO device_registrations (
        id,
        device_name,
        token_hash,
        sync_group_id
      )
      SELECT
        ${deviceId}::uuid,
        ${deviceName.trim()},
        ${tokenHash},
        consumed.sync_group_id
      FROM consumed
      RETURNING id, sync_group_id
    `;

    if (result.length === 0) {
      return NextResponse.json(
        {
          error: "등록 코드가 만료되었거나 그룹에 연결되지 않았습니다.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        deviceId,
        deviceToken,
        syncGroupId: result[0].sync_group_id,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("기기 등록 실패:", error);

    return NextResponse.json(
      { error: "기기 등록 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

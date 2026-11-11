import { NextResponse } from "next/server";
import { verifyDeviceContext } from "@/lib/device-auth";
import { getDatabase } from "@/lib/db";


function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) return null;

  const match = /^Bearer\s+(\S+)$/i.exec(authorization);

  return match?.[1] ?? null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "인증 정보가 없습니다." },
        { status: 401 }
      );
    }

    const context = await verifyDeviceContext(token);

    if (!context) {
      return NextResponse.json(
        { error: "등록되지 않은 기기입니다." },
        { status: 401 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "JSON 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "요청 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;

    const { eventId, lidOpen, occurredAt } = input;

    if (
      !isUuid(eventId) ||
      typeof lidOpen !== "boolean" ||
      typeof occurredAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(occurredAt) ||
      !/(Z|[+-]\d{2}:\d{2})$/i.test(occurredAt) ||
      !Number.isFinite(Date.parse(occurredAt))
    ) {
      return NextResponse.json(
        { error: "개폐 이벤트 데이터가 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const eventTime = new Date(occurredAt);

    if (eventTime.getTime() > Date.now() + 300000) {
      return NextResponse.json(
        { error: "미래 시각의 이벤트는 저장할 수 없습니다." },
        { status: 400 }
      );
    }

    const sql = getDatabase();

    const inserted = await sql`
      INSERT INTO device_lid_events (
        device_id,
        sync_group_id,
        event_id,
        lid_open,
        occurred_at
      )
      VALUES (
        ${context.deviceId}::uuid,
        ${context.syncGroupId}::uuid,
        ${eventId}::uuid,
        ${lidOpen},
        ${eventTime.toISOString()}::timestamptz
      )
      ON CONFLICT (device_id, event_id)
      DO NOTHING
      RETURNING id
    `;

    return NextResponse.json(
      {
        success: true,
        saved: inserted.length > 0,
        duplicate: inserted.length === 0,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("개폐 이벤트 저장 실패:", error);

    return NextResponse.json(
      { error: "개폐 이벤트를 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "인증 정보가 없습니다." },
        { status: 401 }
      );
    }

    const context = await verifyDeviceContext(token);

    if (!context) {
      return NextResponse.json(
        { error: "등록되지 않은 기기입니다." },
        { status: 401 }
      );
    }

    const sql = getDatabase();

    const events = await sql`
      SELECT
        event_id,
        lid_open,
        occurred_at,
        received_at
      FROM device_lid_events
      WHERE sync_group_id = ${context.syncGroupId}::uuid
      ORDER BY occurred_at DESC, id DESC
      LIMIT 100
    `;

    return NextResponse.json(
      {
        success: true,
        count: events.length,
        events: events.map((event) => ({
          eventId: event.event_id,
          lidOpen: event.lid_open,
          occurredAt: event.occurred_at,
          receivedAt: event.received_at,
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("개폐 이벤트 조회 실패:", error);

    return NextResponse.json(
      { error: "개폐 이력을 조회하지 못했습니다." },
      { status: 500 }
    );
  }
}

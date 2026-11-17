import { NextResponse } from "next/server";
import { verifyDeviceContext } from "@/lib/device-auth";
import { getDatabase } from "@/lib/db";

const validDays = ["월", "화", "수", "목", "금", "토", "일"];

type MedicationInput = {
  id: string;
  name: string;
  time: string;
  days: string[];
  completedDates: string[];
};

function isMedication(value: unknown): value is MedicationInput {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    item.id.length <= 100 &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    item.name.length <= 200 &&
    typeof item.time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time) &&
    Array.isArray(item.days) &&
    item.days.length > 0 &&
    item.days.every(
      (day) => typeof day === "string" && validDays.includes(day)
    ) &&
    Array.isArray(item.completedDates) &&
    item.completedDates.every(
      (date) =>
        typeof date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(date)
    )
  );
}

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

    const context = await verifyDeviceContext(token);

    if (!context) {
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

    const input = body as Record<string, unknown>;
    const medications = input.medications;
    const expectedVersion = input.expectedVersion;

    if (
      !Array.isArray(medications) ||
      medications.length > 100 ||
      !medications.every(isMedication)
    ) {
      return NextResponse.json(
        { error: "복약 일정 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    if (
      typeof expectedVersion !== "number" ||
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 0
    ) {
      return NextResponse.json(
        { error: "동기화 기준 버전이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const ids = medications.map((item) => item.id);

    if (new Set(ids).size !== ids.length) {
      return NextResponse.json(
        { error: "중복된 복약 일정 ID가 있습니다." },
        { status: 400 }
      );
    }

    const snapshot = medications.map((medication) => ({
      id: medication.id,
      name: medication.name,
      time: medication.time,
      days: medication.days,
      completed_dates: medication.completedDates,
    }));

    const sql = getDatabase();

    const result = await sql`
      SELECT *
      FROM sync_medication_group_snapshot(
        ${context.syncGroupId}::uuid,
        ${expectedVersion}::bigint,
        ${JSON.stringify(snapshot)}::jsonb
      )
    `;

    const applied = result[0]?.applied === true;
    const newVersion = Number(result[0]?.new_version);

    return NextResponse.json({
      success: true,
      applied,
      newVersion,
      syncedCount: applied ? medications.length : undefined,
      conflict: !applied,
    });
  } catch (error) {
    console.error("그룹 복약 일정 동기화 실패:", error);

    return NextResponse.json(
      { error: "복약 일정을 동기화하지 못했습니다." },
      { status: 500 }
    );
  }
}

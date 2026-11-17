import { NextResponse } from "next/server";
import { verifyDeviceToken } from "@/lib/device-auth";
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

    const deviceId = await verifyDeviceToken(token);

    if (!deviceId) {
      return NextResponse.json(
        { error: "등록되지 않은 기기입니다." },
        { status: 401 }
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("medications" in body)
    ) {
      return NextResponse.json(
        { error: "복약 일정 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const medications = (body as { medications: unknown }).medications;

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

    const sql = getDatabase();

    for (const medication of medications) {
      await sql`
        INSERT INTO medication_schedules
          (
            device_id,
            medication_id,
            name,
            time,
            days,
            completed_dates
          )
        VALUES
          (
            ${deviceId}::uuid,
            ${medication.id},
            ${medication.name},
            ${medication.time},
            ${JSON.stringify(medication.days)}::jsonb,
            ${JSON.stringify(medication.completedDates)}::jsonb
          )
        ON CONFLICT (device_id, medication_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          time = EXCLUDED.time,
          days = EXCLUDED.days,
          completed_dates = EXCLUDED.completed_dates,
          updated_at = NOW()
      `;
    }

    return NextResponse.json({
      success: true,
      syncedCount: medications.length,
    });
  } catch {
    console.error("복약 일정 동기화 실패");

    return NextResponse.json(
      { error: "복약 일정을 저장하지 못했습니다." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { verifyDeviceContext } from "@/lib/device-auth";
import { getDatabase } from "@/lib/db";

// POST /api/devices/medication-actions
// { "action": "taken", "medicationId": "..." }
// This first phase intentionally implements only TAKEN, not DELAY.
export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;
    const context = await verifyDeviceContext(token);
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    if (input.action !== "taken" ||
        typeof input.medicationId !== "string" ||
        input.medicationId.length < 1 || input.medicationId.length > 100) {
      return NextResponse.json({ error: "Invalid action or medicationId" }, { status: 400 });
    }

    const sql = getDatabase();
    const result = await sql`
      SELECT * FROM complete_medication_from_device(
        ${context.syncGroupId}::uuid,
        ${input.medicationId}::text
      )
    `;
    return NextResponse.json(
      { success: true, applied: result[0]?.applied === true,
        completedDate: result[0]?.completed_date,
        newVersion: Number(result[0]?.new_version) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Device medication action failed:", error);
    return NextResponse.json({ error: "Medication action failed" }, { status: 500 });
  }
}

import "server-only";

import { createHash } from "node:crypto";
import { getDatabase } from "@/lib/db";

export type DeviceContext = {
  deviceId: string;
  syncGroupId: string;
};

export async function verifyDeviceContext(
  token: string | null
): Promise<DeviceContext | null> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const sql = getDatabase();

  const devices = await sql`
    SELECT id, sync_group_id
    FROM device_registrations
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
    LIMIT 1
  `;

  if (
    devices.length === 0 ||
    !devices[0].sync_group_id
  ) {
    return null;
  }

  return {
    deviceId: String(devices[0].id),
    syncGroupId: String(devices[0].sync_group_id),
  };
}

// 기존 푸시 API와의 호환성을 유지
export async function verifyDeviceToken(
  token: string | null
): Promise<string | null> {
  const context = await verifyDeviceContext(token);
  return context?.deviceId ?? null;
}

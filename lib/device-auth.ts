import "server-only";

import { createHash } from "node:crypto";
import { getDatabase } from "@/lib/db";

export async function verifyDeviceToken(
  token: string | null
): Promise<string | null> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const sql = getDatabase();

  const devices = await sql`
    SELECT id
    FROM device_registrations
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
    LIMIT 1
  `;

  if (devices.length === 0) {
    return null;
  }

  return String(devices[0].id);
}

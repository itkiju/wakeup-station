import "server-only";
import { timingSafeEqual } from "node:crypto";

export function verifyPushAdminSecret(
  providedSecret: string | null
): boolean {
  const expectedSecret = process.env.PUSH_ADMIN_SECRET;

  if (!expectedSecret || !providedSecret) {
    return false;
  }

  const expected = Buffer.from(expectedSecret);
  const provided = Buffer.from(providedSecret);

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}

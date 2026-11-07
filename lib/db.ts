import "server-only";
import { neon } from "@neondatabase/serverless";

export function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  }

  return neon(databaseUrl);
}

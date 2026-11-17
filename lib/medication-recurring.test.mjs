import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const tmp = fs.mkdtempSync(
  path.join(os.tmpdir(), "wakeup-recurring-")
);

try {
  const build = spawnSync("npx", [
    "--no-install", "tsc",
    "lib/medication-next-alert.ts",
    "lib/medication-timing.ts",
    "--target", "ES2022",
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--skipLibCheck",
    "--outDir", tmp
  ], { encoding: "utf8" });

  if (build.status !== 0) {
    throw new Error(build.stdout + build.stderr);
  }

  const require = createRequire(import.meta.url);
  const { findNextLinkedMedicationAlert } = require(
    path.join(tmp, "medication-next-alert.js")
  );

  const everyDay = ["월","화","수","목","금","토","일"];

  const dailySchedules = [
    {
      id: "morning",
      time: "09:00",
      days: everyDay,
      medicationGroupId: "group-a"
    },
    {
      id: "afternoon",
      time: "15:00",
      days: everyDay,
      medicationGroupId: "group-a"
    }
  ];

  const dailyResult = findNextLinkedMedicationAlert(
    dailySchedules,
    {
      medicationId: "afternoon",
      scheduledAt: new Date("2026-11-12T06:00:00Z"),
      takenAt: new Date("2026-11-12T06:30:00Z")
    }
  );

  assert.equal(dailyResult?.medicationId, "morning");
  assert.equal(
    dailyResult?.adjustedAt.toISOString(),
    "2026-11-13T00:30:00.000Z"
  );

  console.log("PASS: 다음 날 오전 일정 보정");

  const weeklySchedules = [
    {
      id: "morning",
      time: "09:00",
      days: ["목"],
      medicationGroupId: "group-b"
    },
    {
      id: "afternoon",
      time: "15:00",
      days: ["목"],
      medicationGroupId: "group-b"
    }
  ];

  const weeklyResult = findNextLinkedMedicationAlert(
    weeklySchedules,
    {
      medicationId: "afternoon",
      scheduledAt: new Date("2026-11-12T06:00:00Z"),
      takenAt: new Date("2026-11-12T06:30:00Z")
    }
  );

  assert.equal(weeklyResult?.medicationId, "morning");
  assert.equal(
    weeklyResult?.adjustedAt.toISOString(),
    "2026-11-19T00:30:00.000Z"
  );

  console.log("PASS: 다음 주 같은 요일 보정");

  const otherSchedules = [
    ...dailySchedules,
    {
      id: "other",
      time: "10:00",
      days: everyDay,
      medicationGroupId: "group-c"
    }
  ];

  const otherResult = findNextLinkedMedicationAlert(
    otherSchedules,
    {
      medicationId: "other",
      scheduledAt: new Date("2026-11-12T01:00:00Z"),
      takenAt: new Date("2026-11-12T01:30:00Z")
    }
  );

  assert.equal(otherResult, null);

  console.log("PASS: 연결되지 않은 다른 약 제외");
  console.log("\n반복 일정 테스트 3개 모두 통과!");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

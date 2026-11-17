import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const tmp = fs.mkdtempSync(
  path.join(os.tmpdir(), "wakeup-alert-test-")
);

try {
  const result = spawnSync(
    "npx",
    [
      "--no-install",
      "tsc",
      "lib/medication-next-alert.ts",
      "lib/medication-timing.ts",
      "--target",
      "ES2022",
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--skipLibCheck",
      "--outDir",
      tmp
    ],
    { encoding: "utf8" }
  );

  if (result.status !== 0) {
    throw new Error(result.stdout + result.stderr);
  }

  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const { findNextLinkedMedicationAlert } = require(
    path.join(tmp, "medication-next-alert.js")
  );

  const schedules = [
    {
      id: "morning",
      time: "09:00",
      days: ["월", "화", "수", "목", "금", "토", "일"],
      medicationGroupId: "group-a",
    },
    {
      id: "afternoon",
      time: "15:00",
      days: ["월", "화", "수", "목", "금", "토", "일"],
      medicationGroupId: "group-a",
    },
    {
      id: "other",
      time: "12:00",
      days: ["월", "화", "수", "목", "금", "토", "일"],
      medicationGroupId: "group-b",
    },
  ];

  const scheduledAt = new Date("2026-11-12T00:00:00Z");

  const cases = [
    ["08:40", "2026-11-12T05:40:00.000Z"],
    ["09:00", "2026-11-12T06:00:00.000Z"],
    ["09:03", "2026-11-12T06:00:00.000Z"],
    ["09:05", "2026-11-12T06:05:00.000Z"],
    ["09:30", "2026-11-12T06:30:00.000Z"],
    ["12:01", "2026-11-12T06:00:00.000Z"],
  ];

  for (const [time, expected] of cases) {
    const takenAt = new Date(
      `2026-11-12T${String(Number(time.slice(0,2)) - 9).padStart(2,"0")}:${time.slice(3)}:00Z`
    );

    const actualAt = new Date(
      Date.UTC(
        2026, 10, 12,
        Number(time.slice(0, 2)) - 9,
        Number(time.slice(3))
      )
    );

    const result = findNextLinkedMedicationAlert(
      schedules,
      { medicationId: "morning", scheduledAt, takenAt: actualAt }
    );

    assert.equal(result?.medicationId, "afternoon");
    assert.equal(result?.adjustedAt.toISOString(), expected);
    console.log("PASS:", time, "→", expected);
  }

  const unlinked = findNextLinkedMedicationAlert(
    schedules,
    { medicationId: "other", scheduledAt, takenAt: scheduledAt }
  );
  assert.equal(unlinked, null);
  console.log("PASS: 다른 약 그룹은 보정하지 않음");

  const nextDay = findNextLinkedMedicationAlert(
    schedules,
    {
      medicationId: "afternoon",
      scheduledAt: new Date("2026-11-12T06:00:00Z"),
      takenAt: new Date("2026-11-12T06:30:00Z")
    }
  );

  assert.equal(nextDay?.medicationId, "morning");
  assert.equal(
    nextDay?.adjustedAt.toISOString(),
    "2026-11-13T00:30:00.000Z"
  );
  console.log("PASS: 다음 날 오전 일정 보정");

  console.log("\n모든 자동 보정 테스트 통과!");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

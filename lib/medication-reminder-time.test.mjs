import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const source = fs.readFileSync(
  new URL("./medication-reminder-time.ts", import.meta.url),
  "utf8"
);

const temp = fs.mkdtempSync(
  path.join(os.tmpdir(), "wakeup-reminder-")
);

try {
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;

  const output = path.join(temp, "reminder.cjs");
  fs.writeFileSync(output, compiled);

  const { resolveMedicationReminderTime } = require(output);

  // 한국 시간 기준 테스트
  const now = new Date("2026-11-13T06:00:00+09:00");

  const base = {
    originalTime: "15:00",
    now,
    serverReady: true,
    completed: false
  };

  function check(name, input, expectedTime, expectedSource) {
    const result = resolveMedicationReminderTime({
      ...base,
      ...input
    });

    assert.equal(result.time, expectedTime);
    assert.equal(result.source, expectedSource);

    console.log("PASS:", name);
  }

  check("기본 시간", {}, "15:00", "original");

  check(
    "30분 늦은 복용",
    { adjustedAt: "2026-11-13T06:30:00Z" },
    "15:30",
    "adjusted"
  );

  check(
    "20분 빠른 복용",
    { adjustedAt: "2026-11-13T05:40:00Z" },
    "14:40",
    "adjusted"
  );

  check(
    "K4 지연 우선",
    {
      adjustedAt: "2026-11-13T06:30:00Z",
      delayedUntil: "2026-11-13T06:10:00Z"
    },
    "15:10",
    "delay"
  );

  check(
    "K4 시간이 지나도 유지",
    {
      now: new Date("2026-11-13T06:11:00+09:00"),
      delayedUntil: "2026-11-13T06:10:00Z"
    },
    "15:10",
    "delay"
  );

  check(
    "서버 실패 시 보류",
    { serverReady: false },
    null,
    "blocked"
  );

  check(
    "복용 완료 시 보류",
    { completed: true },
    null,
    "blocked"
  );

  check(
    "다른 날짜 보정 무시",
    { adjustedAt: "2026-11-14T06:30:00Z" },
    "15:00",
    "original"
  );

  console.log("\n알림 시간 계산 테스트 8개 통과!");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

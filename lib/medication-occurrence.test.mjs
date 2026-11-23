import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

test("K4 midnight delay preserves original scheduled date", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wakeup-occ-"));
  try {
    const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");
    execFileSync(process.execPath, [tsc, "--target", "ES2022", "--module", "commonjs", "--skipLibCheck", "--outDir", dir, "lib/medication-occurrence.ts"]);
    const require = createRequire(import.meta.url);
    const { effectiveMedicationAlert, isMedicationOccurrenceDueOn } = require(path.join(dir, "medication-occurrence.js"));
    const scheduled = new Date("2026-11-13T14:55:00Z");
    const delayed = new Date("2026-11-13T15:05:00Z");
    const result = effectiveMedicationAlert(scheduled, null, delayed);
    assert.equal(result.scheduledDate, "2026-11-13");
    assert.equal(result.alertAt.toISOString(), delayed.toISOString());
    assert.equal(isMedicationOccurrenceDueOn(scheduled, new Date("2026-11-13T15:02:00Z"), null, delayed), false);
    assert.equal(isMedicationOccurrenceDueOn(scheduled, new Date("2026-11-13T15:05:00Z"), null, delayed), true);
    assert.equal(isMedicationOccurrenceDueOn(scheduled, new Date("2026-11-13T15:09:59Z"), null, delayed), true);
    assert.equal(isMedicationOccurrenceDueOn(scheduled, new Date("2026-11-13T15:10:00Z"), null, delayed), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

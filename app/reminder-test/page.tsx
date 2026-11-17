"use client";

import { useState } from "react";
import {
  isMedicationReminderDue,
  resolveMedicationReminderTime,
} from "@/lib/medication-reminder-time";

const date = "2026-11-13";
const medicationId = "simulation-only";
const originalTime = "15:00";

type Scenario = {
  label: string;
  now: string;
  delayedUntil: string | null;
};

const scenarios: Scenario[] = [
  {
    label: "기본 알림 15:00",
    now: "15:00:00",
    delayedUntil: null,
  },
  {
    label: "2분 늦게 확인 15:02",
    now: "15:02:00",
    delayedUntil: null,
  },
  {
    label: "5분 경과 15:05",
    now: "15:05:00",
    delayedUntil: null,
  },
  {
    label: "K4 지연 알림 15:10",
    now: "15:10:00",
    delayedUntil: `${date}T15:10:00+09:00`,
  },
  {
    label: "K4 재지연 알림 15:20",
    now: "15:20:00",
    delayedUntil: `${date}T15:20:00+09:00`,
  },
];

export default function ReminderTestPage() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [scenario, setScenario] = useState<Scenario>(
    scenarios[0]
  );

  const now = new Date(`${date}T${scenario.now}+09:00`);

  const resolved = resolveMedicationReminderTime({
    originalTime,
    delayedUntil: scenario.delayedUntil,
    adjustedAt: null,
    now,
    serverReady: true,
    completed: false,
  });

  const alertKey =
    `${date}-${medicationId}-${resolved.source}-${resolved.time}`;

  const due = isMedicationReminderDue(resolved.time, now);
  const visible = due && !dismissed.includes(alertKey);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-bold">
          복약 알림 시뮬레이터
        </h1>

        <p className="text-sm text-slate-300">
          실제 서버, ESP32, 복용 기록과 연결되지 않는
          독립 테스트 페이지입니다.
        </p>

        <div className="grid gap-3">
          {scenarios.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setScenario(item)}
              className="rounded-xl border border-slate-600 p-3 text-left"
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className="rounded-2xl bg-slate-800 p-5">
          <p>가상 현재 시각: {scenario.now}</p>
          <p>적용 알림 시각: {resolved.time}</p>
          <p>알림 종류: {resolved.source}</p>
          <p>알림 허용 범위: {due ? "해당" : "해당 없음"}</p>
          <p>이미 닫은 알림: {
            dismissed.includes(alertKey) ? "예" : "아니요"
          }</p>
        </section>

        {visible ? (
          <section className="rounded-2xl border border-cyan-400 bg-slate-800 p-6">
            <h2 className="mb-3 text-xl font-bold">
              🔔 복용 시간이에요!
            </h2>
            <p className="mb-4">시뮬레이션 약</p>
            <button
              type="button"
              onClick={() =>
                setDismissed((prev) =>
                  prev.includes(alertKey)
                    ? prev
                    : [...prev, alertKey]
                )
              }
              className="rounded-xl bg-cyan-500 px-4 py-3 font-bold text-slate-950"
            >
              알림 닫기
            </button>
          </section>
        ) : (
          <section className="rounded-2xl bg-slate-800 p-5">
            현재 시나리오에서 표시할 알림이 없습니다.
          </section>
        )}

        <button
          type="button"
          onClick={() => {
            setDismissed([]);
            setScenario(scenarios[0]);
          }}
          className="rounded-xl border border-slate-500 px-4 py-3"
        >
          테스트 초기화
        </button>
      </div>
    </main>
  );
}

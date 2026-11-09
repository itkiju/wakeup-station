"use client";

import { useCallback, useEffect, useState } from "react";

type HistoryItem = {
  id: string;
  medication_id: string;
  scheduled_at: string;
  taken_at: string | null;
  status: string;
  source: string;
};

type Category = "early" | "onTime" | "late" | "veryLate";

function classify(item: HistoryItem): Category | null {
  if (item.status !== "completed" || !item.taken_at) {
    return null;
  }

  const scheduled = new Date(item.scheduled_at).getTime();
  const taken = new Date(item.taken_at).getTime();

  if (!Number.isFinite(scheduled) || !Number.isFinite(taken)) {
    return null;
  }

  const differenceMinutes = (taken - scheduled) / 60000;

  if (differenceMinutes < -5) return "early";
  if (differenceMinutes <= 5) return "onTime";
  if (differenceMinutes <= 180) return "late";

  return "veryLate";
}

const categoryLabels: Record<Category, string> = {
  early: "조기 복용",
  onTime: "정시 복용",
  late: "지연 복용",
  veryLate: "장기 지연 복용",
};

export default function MedicationAnalysis() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem(
        "wakeup-station-device-token"
      );

      if (!token) {
        throw new Error("먼저 기기를 등록해 주세요.");
      }

      const response = await fetch("/api/medications/history", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || data.success !== true) {
        throw new Error("복약 기록을 불러오지 못했습니다.");
      }

      if (!Array.isArray(data.history)) {
        throw new Error("복약 기록 형식이 올바르지 않습니다.");
      }

      setHistory(data.history);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const completed = history.filter(
    (item) => item.status === "completed" && item.taken_at
  );

  const counts: Record<Category, number> = {
    early: 0,
    onTime: 0,
    late: 0,
    veryLate: 0,
  };

  for (const item of completed) {
    const category = classify(item);
    if (category) counts[category]++;
  }

  const classifiedCount = Object.values(counts).reduce(
    (sum, count) => sum + count,
    0
  );

  const onTimeRate =
    classifiedCount > 0
      ? Math.round((counts.onTime / classifiedCount) * 100)
      : 0;

  const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <p className="text-sm tracking-widest text-cyan-400">
          WAKEUP STATION PRO
        </p>
        <h1 className="mt-2 text-3xl font-bold">복약 분석</h1>
        <p className="mt-2 text-sm text-slate-400">
          서버에 저장된 최근 복약 기록을 분석합니다.
        </p>
      </header>

      <button
        type="button"
        onClick={() => void loadHistory()}
        disabled={loading}
        className="rounded-xl border border-cyan-500/30 bg-slate-800 px-4 py-2 text-sm font-semibold text-cyan-300 disabled:opacity-50"
      >
        {loading ? "불러오는 중..." : "기록 새로고침"}
      </button>

      {error && (
        <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <section className="rounded-3xl border border-white/10 bg-[#172235] p-5">
              <p className="text-sm text-slate-400">기록된 복약 완료</p>
              <p className="mt-3 text-3xl font-bold">
                {completed.length}회
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#172235] p-5">
              <p className="text-sm text-slate-400">정시 복용 비율</p>
              <p className="mt-3 text-3xl font-bold text-cyan-400">
                {classifiedCount > 0 ? `${onTimeRate}%` : "—"}
              </p>
            </section>
          </div>

          <section className="rounded-3xl border border-white/10 bg-[#172235] p-5">
            <h2 className="mb-4 text-lg font-semibold">
              복약 시간 분석
            </h2>

            {(
              ["early", "onTime", "late", "veryLate"] as Category[]
            ).map((category) => (
              <div
                key={category}
                className="flex justify-between border-b border-white/10 py-3 last:border-0"
              >
                <span className="text-slate-300">
                  {categoryLabels[category]}
                </span>
                <strong>{counts[category]}회</strong>
              </div>
            ))}
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#172235] p-5">
            <h2 className="mb-4 text-lg font-semibold">
              최근 복약 기록
            </h2>

            {history.length === 0 ? (
              <p className="text-sm text-slate-400">
                아직 저장된 복약 기록이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {history.slice(0, 20).map((item) => {
                  const category = classify(item);

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-slate-800 p-4"
                    >
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold">
                          약 ID: {item.medication_id}
                        </span>
                        <span className="text-sm text-cyan-300">
                          {item.status === "cancelled"
                            ? "완료 취소"
                            : category
                              ? categoryLabels[category]
                              : item.status}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        예정: {dateFormatter.format(
                          new Date(item.scheduled_at)
                        )}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        실제: {item.taken_at
                          ? dateFormatter.format(
                              new Date(item.taken_at)
                            )
                          : "기록 없음"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <p className="text-xs leading-5 text-slate-500">
            정시 복용 비율은 저장된 완료 기록 중 정시 복용 비율입니다.
            전체 예정 횟수 대비 복약 달성률과는 다릅니다.
            서버는 최대 500건의 최근 기록을 제공합니다.
          </p>
        </>
      )}
    </div>
  );
}

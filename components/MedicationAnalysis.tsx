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

type MedicationInfo = {
  medication_id: string;
  name: string;
};

type Category = "early" | "onTime" | "late" | "veryLate";
type Period = "week" | "month";

const categoryLabels: Record<Category, string> = {
  early: "조기 복용",
  onTime: "정시 복용",
  late: "지연 복용",
  veryLate: "장기 지연 복용",
};

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function classify(item: HistoryItem): Category | null {
  if (item.status !== "completed" || !item.taken_at) {
    return null;
  }

  const scheduled = new Date(item.scheduled_at).getTime();
  const taken = new Date(item.taken_at).getTime();

  if (!Number.isFinite(scheduled) || !Number.isFinite(taken)) {
    return null;
  }

  const minutes = (taken - scheduled) / 60000;

  if (minutes < -5) return "early";
  if (minutes <= 5) return "onTime";
  if (minutes <= 180) return "late";

  return "veryLate";
}

function formatTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return "시간 확인 불가";

  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function MedicationAnalysis() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [medicationNames, setMedicationNames] = useState<
    Record<string, string>
  >({});

  const [period, setPeriod] = useState<Period>("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [today] = useState(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date().getMonth()
  );
  const [calendarYear, setCalendarYear] = useState(
    () => new Date().getFullYear()
  );
  const [selectedDate, setSelectedDate] = useState(
    () => getDateKey(new Date())
  );

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

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [historyResponse, previewResponse] = await Promise.all([
        fetch("/api/medications/history", {
          headers,
          cache: "no-store",
        }),
        fetch("/api/medications/preview", {
          headers,
          cache: "no-store",
        }),
      ]);

      const historyData = await historyResponse.json();

      if (
        !historyResponse.ok ||
        historyData.success !== true ||
        !Array.isArray(historyData.history)
      ) {
        throw new Error("복약 이력을 불러오지 못했습니다.");
      }

      setHistory(historyData.history);

      if (previewResponse.ok) {
        const previewData = await previewResponse.json();

        if (Array.isArray(previewData.medications)) {
          const names: Record<string, string> = {};

          for (const item of previewData.medications as MedicationInfo[]) {
            if (
              typeof item.medication_id === "string" &&
              typeof item.name === "string"
            ) {
              names[item.medication_id] = item.name;
            }
          }

          setMedicationNames(names);
        }
      }
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

  // 선택 기간: 오늘을 포함한 최근 7일 또는 30일
  const periodStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (period === "week" ? 6 : 29)
  );

  const periodEnd = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  );

  const filteredHistory = history.filter((item) => {
    const scheduled = new Date(item.scheduled_at);

    return (
      Number.isFinite(scheduled.getTime()) &&
      scheduled >= periodStart &&
      scheduled < periodEnd
    );
  });

  const completed = filteredHistory.filter(
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
      : null;

  // 캘린더에 표시할 날짜별 복약 기록
  const historyByDate: Record<string, HistoryItem[]> = {};

  for (const item of history) {
    const scheduled = new Date(item.scheduled_at);

    if (!Number.isFinite(scheduled.getTime())) continue;

    const key = getDateKey(scheduled);

    if (!historyByDate[key]) historyByDate[key] = [];

    historyByDate[key].push(item);
  }

  const firstDay = new Date(
    calendarYear,
    calendarMonth,
    1
  ).getDay();

  const daysInMonth = new Date(
    calendarYear,
    calendarMonth + 1,
    0
  ).getDate();

  const calendarCells = Array.from(
    { length: firstDay + daysInMonth },
    (_, index) =>
      index < firstDay ? null : index - firstDay + 1
  );

  const selectedHistory = historyByDate[selectedDate] ?? [];

  function changeMonth(amount: number) {
    const next = new Date(
      calendarYear,
      calendarMonth + amount,
      1
    );

    setCalendarYear(next.getFullYear());
    setCalendarMonth(next.getMonth());
    setSelectedDate(getDateKey(next));
  }

  function getMedicationName(id: string) {
    return medicationNames[id] ?? `약 ID: ${id}`;
  }

  function getDayStyle(items: HistoryItem[]) {
    const completedItems = items.filter(
      (item) => item.status === "completed" && item.taken_at
    );

    if (completedItems.length === 0) {
      return "bg-slate-800 text-slate-300";
    }

    const hasLate = completedItems.some((item) => {
      const category = classify(item);
      return category === "late" || category === "veryLate";
    });

    return hasLate
      ? "bg-amber-500/20 text-amber-300"
      : "bg-emerald-500/20 text-emerald-300";
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <p className="text-sm tracking-widest text-cyan-400">
          WAKEUP STATION PRO
        </p>
        <h1 className="mt-2 text-3xl font-bold">복약 분석</h1>
        <p className="mt-2 text-sm text-slate-400">
          복약 기록과 복용 시간을 확인하세요.
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
          <section className="rounded-3xl border border-white/10 bg-[#172235] p-5">
            <div className="mb-5 flex gap-2">
              {(["week", "month"] as Period[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`flex-1 rounded-xl px-4 py-3 font-semibold transition ${
                    period === value
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {value === "week" ? "주간" : "월간"}
                </button>
              ))}
            </div>

            <p className="mb-4 text-sm text-slate-400">
              {period === "week" ? "최근 7일" : "최근 30일"} 기준
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-800 p-4">
                <p className="text-sm text-slate-400">
                  기록된 복약 완료
                </p>
                <p className="mt-2 text-3xl font-bold">
                  {completed.length}회
                </p>
              </div>

              <div className="rounded-2xl bg-slate-800 p-4">
                <p className="text-sm text-slate-400">
                  정시 복용 비율
                </p>
                <p className="mt-2 text-3xl font-bold text-cyan-400">
                  {onTimeRate === null ? "—" : `${onTimeRate}%`}
                </p>
              </div>
            </div>

            <h2 className="mb-3 mt-6 text-lg font-semibold">
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
            <div className="mb-5 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="이전 달"
                onClick={() => changeMonth(-1)}
                className="rounded-xl bg-slate-800 px-3 py-2"
              >
                ‹
              </button>

              <h2 className="text-lg font-semibold">
                {calendarYear}년 {calendarMonth + 1}월
              </h2>

              <button
                type="button"
                aria-label="다음 달"
                onClick={() => changeMonth(1)}
                className="rounded-xl bg-slate-800 px-3 py-2"
              >
                ›
              </button>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
              {["일", "월", "화", "수", "목", "금", "토"].map(
                (day) => (
                  <span key={day}>{day}</span>
                )
              )}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} />;
                }

                const date = new Date(
                  calendarYear,
                  calendarMonth,
                  day
                );

                const key = getDateKey(date);
                const items = historyByDate[key] ?? [];
                const selected = key === selectedDate;
                const hasCompleted = items.some(
                  (item) =>
                    item.status === "completed" && item.taken_at
                );

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(key)}
                    aria-label={`${key} 복약 기록`}
                    aria-pressed={selected}
                    className={`flex aspect-square min-w-0 flex-col items-center justify-center rounded-xl text-sm ${
                      getDayStyle(items)
                    } ${
                      selected
                        ? "ring-2 ring-cyan-400"
                        : ""
                    }`}
                  >
                    <span>{day}</span>
                    {hasCompleted && (
                      <span className="text-xs">●</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
              <span className="text-emerald-300">
                ● 완료 기록
              </span>
              <span className="text-amber-300">
                ● 지연 완료 기록
              </span>
              <span>기록 없음 ≠ 미복용</span>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#172235] p-5">
            <h2 className="mb-4 text-lg font-semibold">
              {selectedDate} 복약 기록
            </h2>

            {selectedHistory.length === 0 ? (
              <p className="text-sm text-slate-400">
                이 날짜에 저장된 복약 기록이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedHistory.map((item) => {
                  const category = classify(item);

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-slate-800 p-4"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <strong>
                          {getMedicationName(item.medication_id)}
                        </strong>

                        <span className="text-sm text-cyan-300">
                          {item.status === "cancelled"
                            ? "완료 취소"
                            : category
                              ? categoryLabels[category]
                              : item.status}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        예정: {formatTime(item.scheduled_at)}
                      </p>

                      <p className="mt-1 text-sm text-slate-400">
                        실제: {item.taken_at
                          ? formatTime(item.taken_at)
                          : "기록 없음"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <p className="text-xs leading-5 text-slate-500">
            주간·월간 통계는 예정 시각이 해당 기간에 속하는
            저장된 이력을 기준으로 계산합니다.
            정시 복용 비율은 완료 기록 중 정시 복용 비율이며,
            전체 예정 횟수 대비 복약 달성률은 아닙니다.
            서버에서 최근 최대 500건을 조회하므로
            기록이 많으면 과거 통계가 일부 누락될 수 있습니다.
            복약 완료 시각은 앱에서 완료를 기록한 시각입니다.
          </p>
        </>
      )}
    </div>
  );
}

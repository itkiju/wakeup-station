
"use client";

import { useEffect, useState } from "react";

const weekDays = ["월", "화", "수", "목", "금", "토", "일"];

type Medication = {
  id: string;
  name: string;
  time: string;
  days: string[];
  completedDates: string[];
};

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isMedication(value: unknown): value is Medication {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.time === "string" &&
    Array.isArray(item.days) &&
    Array.isArray(item.completedDates)
  );
}

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);

  // 기상 알람 설정
  const [alarmTime, setAlarmTime] = useState("07:00");
  const [isAlarmOn, setIsAlarmOn] = useState(true);
  const [selectedDays, setSelectedDays] = useState<string[]>([
    "월", "화", "수", "목", "금",
  ]);

  // 복약 관리
  const [medications, setMedications] = useState<Medication[]>([]);
  const [newMedicationName, setNewMedicationName] = useState("");
  const [newMedicationTime, setNewMedicationTime] = useState("08:00");
  const [newMedicationDays, setNewMedicationDays] = useState<string[]>([
    "월", "화", "수", "목", "금", "토", "일",
  ]);

  // 복약 일정 수정
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null);
  const [editMedicationName, setEditMedicationName] = useState("");
  const [editMedicationTime, setEditMedicationTime] = useState("08:00");
  const [editMedicationDays, setEditMedicationDays] = useState<string[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);

  // 현재 시간 업데이트
  useEffect(() => {
    setNow(new Date());

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 저장된 설정 불러오기
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(
        "wakeup-station-settings"
      );

      if (savedSettings) {
        const settings = JSON.parse(savedSettings);

        if (typeof settings.alarmTime === "string") {
          setAlarmTime(settings.alarmTime);
        }

        if (typeof settings.isAlarmOn === "boolean") {
          setIsAlarmOn(settings.isAlarmOn);
        }

        if (Array.isArray(settings.selectedDays)) {
          setSelectedDays(
            settings.selectedDays.filter(
              (day: unknown): day is string =>
                typeof day === "string" && weekDays.includes(day)
            )
          );
        }

        if (Array.isArray(settings.medications)) {
          setMedications(
            settings.medications.filter(isMedication)
          );
        }
      }
    } catch (error) {
      console.error("설정을 불러오지 못했습니다.", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // 설정 변경 시 자동 저장
  useEffect(() => {
    if (!isLoaded) return;

    const settings = {
      alarmTime,
      isAlarmOn,
      selectedDays,
      medications,
    };

    try {
      localStorage.setItem(
        "wakeup-station-settings",
        JSON.stringify(settings)
      );
    } catch (error) {
      console.error("설정을 저장하지 못했습니다.", error);
    }
  }, [
    alarmTime,
    isAlarmOn,
    selectedDays,
    medications,
    isLoaded,
  ]);

  // 기상 알람 요일 선택
  function toggleDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((item) => item !== day)
        : [...prev, day]
    );
  }

  // 복약 요일 선택
  function toggleMedicationDay(day: string) {
    setNewMedicationDays((prev) =>
      prev.includes(day)
        ? prev.filter((item) => item !== day)
        : [...prev, day]
    );
  }

  // 수정할 약 선택
  function startEditMedication(medication: Medication) {
    setEditingMedicationId(medication.id);
    setEditMedicationName(medication.name);
    setEditMedicationTime(medication.time);
    setEditMedicationDays([...medication.days]);
  }

  // 수정 화면에서 요일 선택
  function toggleEditMedicationDay(day: string) {
    setEditMedicationDays((prev) =>
      prev.includes(day)
        ? prev.filter((item) => item !== day)
        : [...prev, day]
    );
  }

  // 수정 내용 저장
  function saveEditMedication() {
    if (!editMedicationName.trim()) {
      alert("약 이름을 입력해 주세요.");
      return;
    }

    if (editMedicationDays.length === 0) {
      alert("복용 요일을 하나 이상 선택해 주세요.");
      return;
    }

    setMedications((prev) =>
      prev.map((medication) =>
        medication.id === editingMedicationId
          ? {
              ...medication,
              name: editMedicationName.trim(),
              time: editMedicationTime,
              days: editMedicationDays,
            }
          : medication
      )
    );

    setEditingMedicationId(null);
  }

  // 수정 취소
  function cancelEditMedication() {
    setEditingMedicationId(null);
  }

  // 새로운 복약 일정 추가
  function addMedication() {
    if (!newMedicationName.trim()) {
      alert("약 이름을 입력해 주세요.");
      return;
    }

    if (newMedicationDays.length === 0) {
      alert("복용 요일을 하나 이상 선택해 주세요.");
      return;
    }

    const newMedication: Medication = {
      id: `${Date.now()}`,
      name: newMedicationName.trim(),
      time: newMedicationTime,
      days: newMedicationDays,
      completedDates: [],
    };

    setMedications((prev) => [...prev, newMedication]);

    setNewMedicationName("");
    setNewMedicationTime("08:00");
    setNewMedicationDays(weekDays);
  }

  // 복용 완료 상태 변경
  function toggleMedicationComplete(id: string) {
    if (!now) return;

    const today = getDateKey(now);

    setMedications((prev) =>
      prev.map((medication) => {
        if (medication.id !== id) return medication;

        const isCompleted =
          medication.completedDates.includes(today);

        return {
          ...medication,
          completedDates: isCompleted
            ? medication.completedDates.filter(
                (date) => date !== today
              )
            : [...medication.completedDates, today],
        };
      })
    );
  }

  // 복약 일정 삭제
  function deleteMedication(id: string) {
    const confirmed = window.confirm(
      "이 복약 일정을 삭제할까요?"
    );

    if (!confirmed) return;

    setMedications((prev) =>
      prev.filter((medication) => medication.id !== id)
    );

    if (editingMedicationId === id) {
      setEditingMedicationId(null);
    }
  }

  // 현재 날짜 및 시간
  const currentTime = now
    ? now.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "--:--:--";

  const currentDate = now
    ? now.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      })
    : "날짜를 불러오는 중";

  const today = now ? getDateKey(now) : "";

  const todayDay = now
    ? weekDays[(now.getDay() + 6) % 7]
    : "";

  const todayMedications = medications
    .filter((medication) => medication.days.includes(todayDay))
    .sort((a, b) => a.time.localeCompare(b.time));

  const completedCount = todayMedications.filter(
    (medication) => medication.completedDates.includes(today)
  ).length;

  return (
    <main className="min-h-screen bg-[#0b1220] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">

        {/* 상단 헤더 */}
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-cyan-400">
              SMART LIVING DEVICE
            </p>

            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              WakeUp Station{" "}
              <span className="text-cyan-400">Pro</span>
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              스마트 알람 · 스마트 약통 통합 관리
            </p>
          </div>

          <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
            ● 하드웨어 연결 대기
          </div>
        </header>

        {/* 현재 시간 */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-br from-[#172b46] to-[#111827] p-7 shadow-xl sm:p-10">
          <p className="text-sm text-slate-400">현재 시간</p>

          <h2 className="mt-3 text-5xl font-light tracking-tight sm:text-7xl">
            {currentTime}
          </h2>

          <p className="mt-4 text-slate-400">
            {currentDate}
          </p>
        </section>

        {/* 요약 카드 */}
        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

          <div className="rounded-2xl border border-white/10 bg-[#172235] p-5">
            <p className="text-sm text-slate-400">
              기상 알람
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {alarmTime}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              {isAlarmOn ? "알람 활성화" : "알람 비활성화"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#172235] p-5">
            <p className="text-sm text-slate-400">
              오늘의 복용 일정
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {completedCount}
              <span className="text-lg text-slate-400">
                {" "}/ {todayMedications.length}
              </span>
            </p>

            <p className="mt-2 text-xs text-slate-500">
              복용 완료
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#172235] p-5">
            <p className="text-sm text-slate-400">
              약통 상태
            </p>

            <p className="mt-3 text-3xl font-semibold">
              연결 대기
            </p>

            <p className="mt-2 text-xs text-slate-500">
              리드 스위치 연결 전
            </p>
          </div>

        </section>

        {/* 약통 환경 모니터링 */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-[#172235] p-6 sm:p-8">

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-cyan-400">
                ENVIRONMENT MONITORING
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                약통 내부 환경
              </h2>
            </div>

            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
              DHT11 연결 대기
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">

            <div className="rounded-2xl bg-[#0b1220] p-5">
              <p className="text-sm text-slate-400">
                🌡️ 온도
              </p>

              <p className="mt-4 text-3xl font-semibold">
                --.-<span className="text-lg text-slate-400"> °C</span>
              </p>

              <p className="mt-3 text-xs text-slate-500">
                센서 데이터 대기 중
              </p>
            </div>

            <div className="rounded-2xl bg-[#0b1220] p-5">
              <p className="text-sm text-slate-400">
                💧 습도
              </p>

              <p className="mt-4 text-3xl font-semibold">
                --<span className="text-lg text-slate-400"> %</span>
              </p>

              <p className="mt-3 text-xs text-slate-500">
                센서 데이터 대기 중
              </p>
            </div>

          </div>

          <p className="mt-5 text-xs text-slate-500">
            약통 내부에 설치된 DHT11 센서로 온도와 습도를 측정할 예정입니다.
          </p>

        </section>

        {/* 기상 알람 설정 */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-[#172235] p-6 sm:p-8">

          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-cyan-400">
                ALARM SETTINGS
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                기상 알람
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setIsAlarmOn(!isAlarmOn)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                isAlarmOn
                  ? "bg-cyan-500 text-white"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              {isAlarmOn ? "ON" : "OFF"}
            </button>
          </div>

          <div className="mb-7">
            <label
              htmlFor="alarmTime"
              className="mb-3 block text-sm text-slate-400"
            >
              알람 시간
            </label>

            <input
              id="alarmTime"
              type="time"
              value={alarmTime}
              onChange={(e) => setAlarmTime(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-white outline-none focus:border-cyan-400 block box-border min-w-0 max-w-full text-base"
            />
          </div>

          <div>
            <p className="mb-4 text-sm text-slate-400">
              반복 요일
            </p>

            <div className="flex flex-wrap gap-3">
              {weekDays.map((day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`h-11 w-11 rounded-full text-sm font-semibold transition ${
                    selectedDays.includes(day)
                      ? "bg-cyan-500 text-white"
                      : "border border-white/10 bg-[#0b1220] text-slate-400"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7 rounded-xl bg-[#0b1220] p-4 text-sm text-slate-400">
            {isAlarmOn
              ? `알람이 ${alarmTime}에 설정되어 있습니다.`
              : "알람이 꺼져 있습니다."}

            <p className="mt-1 text-xs">
              반복: {selectedDays.length > 0
                ? selectedDays.join(", ")
                : "없음"}
            </p>
          </div>

        </section>

        {/* 복약 관리 */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-[#172235] p-6 sm:p-8">

          <div className="mb-6">
            <p className="text-sm text-emerald-400">
              MEDICATION MANAGEMENT
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              복약 관리
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              약 복용 시간을 설정하고 복용 여부를 기록합니다.
            </p>
          </div>

          {/* 새로운 약 추가 */}
          <div className="rounded-2xl bg-[#0b1220] p-5">

            <h3 className="mb-5 font-semibold">
              + 복용 일정 추가
            </h3>

            <div className="mb-5">
              <label
                htmlFor="medicationName"
                className="mb-2 block text-sm text-slate-400"
              >
                약 이름
              </label>

              <input
                id="medicationName"
                type="text"
                value={newMedicationName}
                onChange={(e) =>
                  setNewMedicationName(e.target.value)
                }
                placeholder="예: 아침 영양제"
                className="w-full rounded-xl border border-white/10 bg-[#172235] px-4 py-3 text-white outline-none focus:border-emerald-400"
              />
            </div>

            <div className="mb-5">
              <label
                htmlFor="medicationTime"
                className="mb-2 block text-sm text-slate-400"
              >
                복용 시간
              </label>

              <input
                id="medicationTime"
                type="time"
                value={newMedicationTime}
                onChange={(e) =>
                  setNewMedicationTime(e.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-[#172235] px-4 py-3 text-white outline-none focus:border-emerald-400 block box-border min-w-0 max-w-full text-base"
              />
            </div>

            <div className="mb-6">
              <p className="mb-3 text-sm text-slate-400">
                복용 요일
              </p>

              <div className="flex flex-wrap gap-2">
                {weekDays.map((day) => (
                  <button
                    type="button"
                    key={day}
                    onClick={() => toggleMedicationDay(day)}
                    className={`h-10 w-10 rounded-full text-sm font-semibold transition ${
                      newMedicationDays.includes(day)
                        ? "bg-emerald-500 text-white"
                        : "border border-white/10 bg-[#172235] text-slate-400"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={addMedication}
              className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white transition hover:bg-emerald-400"
            >
              복용 일정 추가하기
            </button>

          </div>


          {/* ALL MEDICATION SCHEDULES */}
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">등록된 복용 일정</h3>
              <span className="text-sm text-slate-400">
                총 {medications.length}개
              </span>
            </div>

            {medications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                <p className="text-slate-400">
                  등록된 복용 일정이 없습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...medications]
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((medication) => (
                    <div
                      key={medication.id}
                      className="rounded-xl border border-white/10 bg-[#0b1220] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {medication.name}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {medication.time} · 매주{" "}
                            {medication.days.join(", ")}
                          </p>
                        </div>

                        <span className="rounded-lg bg-cyan-500/10 px-3 py-2 text-xs text-cyan-400">
                          등록 완료
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* 오늘의 복용 일정 */}
          <div className="mt-8">

            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">
                오늘의 복용 일정
              </h3>

              <span className="text-sm text-slate-400">
                {completedCount} / {todayMedications.length} 완료
              </span>
            </div>

            {todayMedications.length === 0 ? (

              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                <p className="text-slate-400">
                  오늘 등록된 복용 일정이 없습니다.
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  위에서 약 이름과 복용 시간을 추가해 주세요.
                </p>
              </div>

            ) : (

              <div className="space-y-3">
                {todayMedications.map((medication) => {

                  const completed =
                    medication.completedDates.includes(today);

                  return (
                    <div
                      key={medication.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0b1220] p-4"
                    >

                      {/* 약 정보 */}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {medication.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          {medication.time} · 매주{" "}
                          {medication.days.join(", ")}
                        </p>

                        <p className={`mt-2 text-xs ${
                          completed
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}>
                          {completed ? "✓ 복용 완료" : "복용 예정"}
                        </p>
                      </div>

                      {/* 일정 관리 버튼 */}
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">

                        <button
                          type="button"
                          onClick={() =>
                            toggleMedicationComplete(medication.id)
                          }
                          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                            completed
                              ? "bg-slate-700 text-slate-300"
                              : "bg-emerald-500 text-white"
                          }`}
                        >
                          {completed ? "완료 취소" : "복용 완료"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            startEditMedication(medication)
                          }
                          className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/20"
                        >
                          수정
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteMedication(medication.id)
                          }
                          className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                        >
                          삭제
                        </button>

                      </div>

                      {/* 수정 입력창 */}
                      {editingMedicationId === medication.id && (
                        <div className="mt-2 w-full basis-full rounded-xl border border-cyan-500/30 bg-[#172235] p-5">

                          <h4 className="mb-4 font-semibold text-cyan-400">
                            복약 일정 수정
                          </h4>

                          <label className="mb-2 block text-sm text-slate-400">
                            약 이름
                          </label>

                          <input
                            type="text"
                            value={editMedicationName}
                            onChange={(e) =>
                              setEditMedicationName(e.target.value)
                            }
                            className="mb-4 w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-white outline-none focus:border-cyan-400"
                          />

                          <label className="mb-2 block text-sm text-slate-400">
                            복용 시간
                          </label>

                          <input
                            type="time"
                            value={editMedicationTime}
                            onChange={(e) =>
                              setEditMedicationTime(e.target.value)
                            }
                            className="mb-5 w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-white outline-none focus:border-cyan-400 block box-border min-w-0 max-w-full text-base"
                          />

                          <p className="mb-3 text-sm text-slate-400">
                            복용 요일
                          </p>

                          <div className="mb-6 flex flex-wrap gap-2">
                            {weekDays.map((day) => (
                              <button
                                type="button"
                                key={day}
                                onClick={() =>
                                  toggleEditMedicationDay(day)
                                }
                                className={`h-10 w-10 rounded-full text-sm font-semibold transition ${
                                  editMedicationDays.includes(day)
                                    ? "bg-cyan-500 text-white"
                                    : "border border-white/10 bg-[#0b1220] text-slate-400"
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>

                          <div className="flex flex-wrap gap-2">

                            <button
                              type="button"
                              onClick={saveEditMedication}
                              className="flex-1 rounded-xl bg-cyan-500 py-3 font-semibold text-white hover:bg-cyan-400"
                            >
                              수정 완료
                            </button>

                            <button
                              type="button"
                              onClick={cancelEditMedication}
                              className="flex-1 rounded-xl bg-slate-700 py-3 font-semibold text-slate-300"
                            >
                              취소
                            </button>

                          </div>

                        </div>
                      )}

                    </div>
                  );
                })}
              </div>

            )}

          </div>

        </section>

        {/* 저장 상태 */}
        <p className="mb-5 text-center text-xs text-emerald-400">
          {isLoaded
            ? "✓ 알람 및 복약 설정 저장 완료"
            : "설정을 불러오는 중..."}
        </p>

        {/* 하단 정보 */}
        <footer className="mt-8 text-center text-xs text-slate-500">
          WAKEUP STATION PRO · SMART ALARM & MEDICATION SYSTEM
        </footer>

      </div>
    </main>
  );
}

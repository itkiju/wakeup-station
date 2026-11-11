"use client";
import { useDeviceStatus } from "./useDeviceStatus";
type Props = { variant: "header" | "card" | "settings" };
export default function DeviceConnectionStatus({ variant }: Props) {
  const { status, message } = useDeviceStatus();
  const connected = status?.connected === true;
  const hasData = status?.lastSeen != null;

  const label = connected
    ? "하드웨어 연결됨"
    : message
      ? message
      : hasData
        ? "하드웨어 연결 끊김"
        : "하드웨어 연결 대기";

  const color = connected
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    : "border-amber-500/30 bg-amber-500/10 text-amber-400";

  const lidLabel = connected
    ? status?.lidOpen === true
      ? "열림"
      : status?.lidOpen === false
        ? "닫힘"
        : "상태 확인 중"
    : "연결 대기";

  if (variant === "header") {
    return (
      <div
        className={`rounded-full border px-4 py-2 text-sm ${color}`}
        role="status"
      >
        ● {label}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#172235] p-5">
        <p className="text-sm text-slate-400">
          약통 상태
        </p>

        <p className="mt-3 text-3xl font-semibold">
          {lidLabel}
        </p>

        <p className="mt-2 text-xs text-slate-500">
          {connected
            ? "ESP32 리드 스위치 실시간 상태"
            : label}
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-[#172235] p-5">
      <h2 className="text-lg font-semibold">
        스마트 약통 연결
      </h2>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            WakeUp Station Pro
          </p>
          <p className="mt-1 text-xs text-slate-400">
            ESP32 · Vercel 서버 연결
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs ${color}`}
          role="status"
        >
          {label}
        </span>
      </div>

      {status && hasData && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-slate-400">온도</p>
            <p className="mt-1 font-semibold">
              {status.temperature == null
                ? "-"
                : `${status.temperature.toFixed(1)} °C`}
            </p>
          </div>

          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-slate-400">습도</p>
            <p className="mt-1 font-semibold">
              {status.humidity == null
                ? "-"
                : `${status.humidity.toFixed(1)} %`}
            </p>
          </div>

          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-slate-400">뚜껑 상태</p>
            <p className="mt-1 font-semibold">
              {connected ? lidLabel : "확인 불가"}
            </p>
          </div>

          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-slate-400">마지막 수신</p>
            <p className="mt-1 font-semibold">
              {status.lastSeen
                ? new Date(status.lastSeen).toLocaleTimeString(
                    "ko-KR",
                    { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                  )
                : "-"}
            </p>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        연결 상태는 약 5초 간격으로 확인합니다.
        기기 등록 및 Wi-Fi 설정은 기존 등록 절차를 사용합니다.
      </p>
    </section>
  );
}

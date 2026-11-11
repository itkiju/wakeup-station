"use client";
import { useDeviceStatus } from "./useDeviceStatus";
export default function DeviceStatusPanel() {
  const { status, message: rawMessage } = useDeviceStatus();
  const message = rawMessage || (status?.lastSeen ? "마지막 수신 데이터" : "센서 데이터가 아직 없습니다");
  const online = status?.connected === true;
  const hasData = status?.lastSeen != null;

  return (
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
        <span className={
          online
            ? "rounded-full bg-green-500/10 px-3 py-1 text-xs text-green-400"
            : "rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-400"
        }>
          {online ? "● ESP32 온라인" : "● ESP32 오프라인"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#0b1220] p-5">
          <p className="text-sm text-slate-400">🌡️ 온도</p>
          <p className="mt-4 text-3xl font-semibold">
            {status?.temperature == null
              ? "--.-"
              : status.temperature.toFixed(1)}
            <span className="text-lg text-slate-400"> °C</span>
          </p>
          <p className="mt-3 text-xs text-slate-500">
            {message}
          </p>
        </div>

        <div className="rounded-2xl bg-[#0b1220] p-5">
          <p className="text-sm text-slate-400">💧 습도</p>
          <p className="mt-4 text-3xl font-semibold">
            {status?.humidity == null
              ? "--"
              : status.humidity.toFixed(0)}
            <span className="text-lg text-slate-400"> %</span>
          </p>
          <p className="mt-3 text-xs text-slate-500">
            {message}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-[#0b1220] p-4">
        <div className="flex justify-between gap-3">
          <span className="text-sm text-slate-400">
            약통 뚜껑
          </span>
          <span className="text-sm font-semibold">
            {!hasData || status?.lidOpen == null
              ? "정보 없음"
              : status.lidOpen
                ? "열림"
                : "닫힘"}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {hasData && status?.lastSeen
            ? `마지막 수신: ${new Date(status.lastSeen).toLocaleString("ko-KR")}`
            : message}
        </p>
        {!online && hasData && (
          <p className="mt-2 text-xs text-amber-400">
            현재 연결되지 않아 마지막 측정값을 표시합니다.
          </p>
        )}
      </div>
    </section>
  );
}

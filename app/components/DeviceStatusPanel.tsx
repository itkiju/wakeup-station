"use client";
import { useDeviceStatus } from "./useDeviceStatus";
export default function DeviceStatusPanel() {
  const { status, message: rawMessage } = useDeviceStatus();
  const message = rawMessage || (status?.lastSeen ? "마지막 수신 데이터" : "센서 데이터가 아직 없습니다");
  const online = status?.connected === true;
  const hasData = status?.lastSeen != null;
  const humidity = status?.humidity;
  const warning = status?.humidityWarning === true;
  const caution = humidity != null && humidity >= 55;
  const lidWarning = status?.lidWarning === true;
  const lidOpenedAt = status?.lidOpenedAt;

  const environmentLabel = !online ? "최근 측정값 (기기 오프라인)" : warning ? "습도 경고" : caution ? "습도 주의" : "보관 환경 정상";

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

      {hasData && humidity != null && (
        <div role="status" aria-live="polite" className={`mt-5 rounded-2xl border p-4 ${warning ? "border-red-400/40 bg-red-500/10" : caution ? "border-amber-400/30 bg-amber-500/10" : "border-emerald-400/20 bg-emerald-500/5"}`}>
          <p className={`text-sm font-semibold ${warning ? "text-red-300" : caution ? "text-amber-300" : "text-emerald-300"}`}>
            {warning ? "⚠️ 약통 내부 습도가 높습니다" : caution ? "💧 습도 상승에 주의하세요" : "✓ 보관 환경 습도 정상"}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {warning
              ? "약통을 서늘하고 건조한 장소로 옮기고 약품별 보관 지침을 확인해 주세요."
              : caution
                ? "습도가 높아지고 있습니다. 습기 유입과 뚜껑 밀폐 상태를 확인해 주세요."
                : "현재 측정 습도는 설정된 주의 기준 미만입니다."}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {environmentLabel} · 60% 이상 5분 지속 시 경고 · 55% 미만 5분 유지 시 해제
          </p>
          {!online && <p className="mt-2 text-xs text-amber-300">현재 측정 중이 아니므로 이 상태는 과거 데이터입니다.</p>}
        </div>
      )}

      {hasData && status?.lidOpen === true && (
        <div role="status" aria-live="polite" className={`mt-5 rounded-2xl border p-4 ${lidWarning ? "border-red-400/40 bg-red-500/10" : "border-amber-400/30 bg-amber-500/10"}`}>
          <p className={`text-sm font-semibold ${lidWarning ? "text-red-300" : "text-amber-300"}`}>
            {lidWarning ? "⚠️ 약통 뚜껑이 3분 이상 열려 있습니다" : "🔓 약통 뚜껑이 열려 있습니다"}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {lidWarning ? "약품 보관을 위해 뚜껑을 닫아주세요. 알림 권한이 허용된 기기로 푸시 발송을 시도합니다." : "뚜껑이 3분 이상 열린 상태로 유지되면 경고가 발생합니다."}
          </p>
          {lidOpenedAt && <p className="mt-2 text-xs text-slate-400">열림 시작: {new Date(lidOpenedAt).toLocaleString("ko-KR")}</p>}
          {!online && <p className="mt-2 text-xs text-amber-300">ESP32 오프라인: 마지막으로 수신한 상태이며 현재 뚜껑 상태는 확인할 수 없습니다.</p>}
        </div>
      )}

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

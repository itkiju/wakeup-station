"use client";

import { useState } from "react";

const TOKEN_KEY = "wakeup-station-device-token";

export default function DeviceRegistration() {
  const [deviceName, setDeviceName] = useState("내 아이폰");
  const [registrationCode, setRegistrationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [registered, setRegistered] = useState(false);

  async function registerDevice() {
    if (!deviceName.trim() || !registrationCode.trim()) {
      setMessage("기기 이름과 등록 코드를 입력해 주세요.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/devices/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceName: deviceName.trim(),
          code: registrationCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.deviceToken) {
        throw new Error(data.error || "기기 등록에 실패했습니다.");
      }

      localStorage.setItem(TOKEN_KEY, data.deviceToken);
      window.dispatchEvent(
        new Event("wakeup-device-registered")
      );

      setRegistered(true);
      setRegistrationCode("");
      setMessage("기기 등록이 완료되었습니다!");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "기기 등록 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-6 rounded-3xl border border-cyan-500/20 bg-[#172235] p-5">
      <h2 className="mb-2 text-lg font-bold text-white">
        📱 기기 등록
      </h2>

      <p className="mb-4 text-sm text-slate-300">
        푸시 알림을 받기 위해 기기를 등록해 주세요.
      </p>

      {registered ? (
        <p className="rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-300">
          ✓ 기기 등록 완료
        </p>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            maxLength={50}
            placeholder="기기 이름"
            className="w-full rounded-2xl bg-slate-800 p-3 text-white"
          />

          <input
            type="text"
            value={registrationCode}
            onChange={(e) => setRegistrationCode(e.target.value)}
            placeholder="일회성 등록 코드"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-2xl bg-slate-800 p-3 text-white"
          />

          <button
            type="button"
            onClick={registerDevice}
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-500 px-4 py-3 font-bold text-slate-950 disabled:opacity-50"
          >
            {loading ? "등록 중..." : "기기 등록하기"}
          </button>
        </div>
      )}

      {message && (
        <p className="mt-3 text-sm text-cyan-200">
          {message}
        </p>
      )}
    </section>
  );
}

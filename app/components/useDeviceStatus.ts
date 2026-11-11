"use client";

import { useSyncExternalStore } from "react";

export type DeviceStatus = {
  success: boolean;
  connected: boolean;
  temperature: number | null;
  humidity: number | null;
  lidOpen: boolean | null;
  lastSeen: string | null;
};

type Snapshot = { status: DeviceStatus | null; message: string };
const INITIAL: Snapshot = { status: null, message: "연결 확인 중" };
let snapshot = INITIAL;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let inFlight = false;
let generation = 0;

function publish(value: Snapshot) {
  snapshot = value;
  listeners.forEach((listener) => listener());
}

async function refresh() {
  if (typeof document === "undefined" || document.hidden || inFlight) return;
  const token = localStorage.getItem("wakeup-station-device-token");
  if (!token) {
    publish({ status: null, message: "기기 등록이 필요합니다" });
    return;
  }
  inFlight = true;
  const current = generation;
  try {
    const response = await fetch("/api/devices/status", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(response.status === 401
        ? "기기 인증을 확인해 주세요"
        : "센서 정보를 불러올 수 없습니다");
    }
    const data: DeviceStatus = await response.json();
    if (current !== generation || localStorage.getItem("wakeup-station-device-token") !== token) return;
    publish(data.success
      ? { status: data, message: "" }
      : { status: null, message: "연결 상태 조회 실패" });
  } catch (error) {
    if (current !== generation) return;
    publish({ status: null, message: error instanceof Error ? error.message : "연결 확인 실패" });
  } finally {
    inFlight = false;
  }
}

function onVisibility() { if (!document.hidden) void refresh(); }
function onFocus() { void refresh(); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    timer = setInterval(() => void refresh(), 5000);
    void refresh();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      generation++;
    }
  };
}
export function useDeviceStatus() {
  return useSyncExternalStore(subscribe, () => snapshot, () => INITIAL);
}

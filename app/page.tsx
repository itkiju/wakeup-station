
"use client";
import DeviceStatusPanel from "./components/DeviceStatusPanel";

import DeviceConnectionStatus from "./components/DeviceConnectionStatus";

import DeviceRegistration from "@/components/DeviceRegistration";
import MedicationAnalysis from "@/components/MedicationAnalysis";

import { useEffect, useRef, useState } from "react";
import { resolveMedicationReminderTime, isMedicationReminderDue } from "@/lib/medication-reminder-time";

const weekDays = ["월", "화", "수", "목", "금", "토", "일"];

type Medication = {
  id: string;
  name: string;
  time: string;
  days: string[];
  completedDates: string[];
  medicationGroupId?: string;
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
    item.id.length > 0 &&
    item.id.length <= 100 &&
    typeof item.name === "string" &&
    item.name.trim().length > 0 &&
    item.name.length <= 200 &&
    typeof item.time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time) &&
    Array.isArray(item.days) &&
    item.days.length > 0 &&
    item.days.every(
      (day) => typeof day === "string" && weekDays.includes(day)
    ) &&
    (item.medicationGroupId === undefined ||
      (typeof item.medicationGroupId === "string" &&
        item.medicationGroupId.length > 0 &&
        item.medicationGroupId.length <= 100)) &&
    Array.isArray(item.completedDates) &&
    item.completedDates.every(
      (date) =>
        typeof date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(date)
    )
  );
}



function PushNotificationButton() {
  const [permission, setPermission] = useState("default");
  const [message, setMessage] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  async function enableNotifications() {
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setMessage("이 환경에서는 웹 푸시 알림을 지원하지 않습니다.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const deviceToken = localStorage.getItem(
        "wakeup-station-device-token"
      );

      if (!deviceToken) {
        setMessage("먼저 아이폰 기기 등록을 완료해 주세요.");
        return;
      }

      let currentPermission = Notification.permission;

      if (currentPermission === "default") {
        currentPermission = await Notification.requestPermission();
      }

      setPermission(currentPermission);

      if (currentPermission !== "granted") {
        setMessage("아이폰 설정에서 알림을 허용해 주세요.");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        setMessage("VAPID 공개 키가 설정되지 않았습니다.");
        return;
      }

      const padding = "=".repeat(
        (4 - (publicKey.length % 4)) % 4
      );

      const base64 = (publicKey + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

      const raw = window.atob(base64);

      const applicationServerKey = Uint8Array.from(
        raw,
        (char) => char.charCodeAt(0)
      );

      const registration = await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      // 기존 구독의 VAPID 공개 키가 변경되었다면 갱신
      if (subscription) {
        const existingKey = subscription.options.applicationServerKey;

        const matches =
          existingKey !== null &&
          existingKey.byteLength === applicationServerKey.byteLength &&
          Array.from(new Uint8Array(existingKey)).every(
            (value, index) => value === applicationServerKey[index]
          );

        if (!matches) {
          await subscription.unsubscribe();
          subscription = null;
        }
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${deviceToken}`,
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setMessage("기기 인증에 실패했습니다. 기기 등록 상태를 확인해 주세요.");
        } else {
          setMessage(`서버 연결에 실패했습니다. (HTTP ${response.status})`);
        }
        return;
      }

      setSubscribed(true);
      setMessage("아이폰 푸시 알림 서버 연결 완료!");
    } catch (error) {
      console.error("푸시 알림 설정 오류:", error);
      setMessage("푸시 알림 설정 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-6 rounded-3xl border border-cyan-500/20 bg-[#172235] p-5">
      <h2 className="mb-2 text-lg font-bold text-white">
        🔔 푸시 알림 설정
      </h2>

      <p className="mb-4 text-sm text-slate-300">
        아이폰에서 복용 알림을 받기 위한 설정입니다.
      </p>

      <button
        type="button"
        onClick={enableNotifications}
        disabled={loading || subscribed}
        className="w-full rounded-2xl bg-cyan-500 px-4 py-3 font-bold text-slate-950 disabled:opacity-50"
      >
        {loading
          ? "설정 중..."
          : subscribed
            ? "푸시 서버 연결 완료 ✓"
            : permission === "granted"
              ? "푸시 서버 연결하기"
              : "푸시 알림 활성화"}
      </button>

      {message && (
        <p className="mt-3 text-sm text-cyan-200">
          {message}
        </p>
      )}
    </section>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<
    "home" | "analysis" | "settings"
  >("home");

  // WakeUp Station Pro 서비스 워커 등록
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js")
      .then(() => {
        console.log("서비스 워커 등록 성공");
      })
      .catch((error) => {
        console.error("서비스 워커 등록 실패:", error);
      });
  }, []);

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
  const [editMedicationLinkId, setEditMedicationLinkId] = useState("");
  const [editMedicationTime, setEditMedicationTime] = useState("08:00");
  const [editMedicationDays, setEditMedicationDays] = useState<string[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isMedicationDataValid, setIsMedicationDataValid] =
    useState(false);

  // 기존 설정이 없는 신규 기기인지 구분
  const [isNewDevice, setIsNewDevice] = useState(false);

  // 공통 그룹 동기화 관리
  const syncVersionRef = useRef(0);
  const lastSyncedSnapshotRef = useRef("");
  const syncRequestRef = useRef<Promise<void>>(Promise.resolve());
  const [isSyncReady, setIsSyncReady] = useState(false);

  // MEDICATION ALERT FEATURE
  const [medicationAlert, setMedicationAlert] =
    useState<Medication | null>(null);
  const [activeMedicationAlertKey, setActiveMedicationAlertKey] =
    useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] =
    useState<string[]>([]);

  // 서버에서 계산한 자동 보정 및 K4 지연 알림 정보
  // 복약 일정과 분리하여 기존 1초 동기화에 영향을 주지 않는다.
  const [serverReminderTimes, setServerReminderTimes] = useState<
    Record<string, {
      adjustedAt: string | null;
      delayedUntil: string | null;
    }>
  >({});

  const [isReminderDataReady, setIsReminderDataReady] =
    useState(false);


  // 현재 시간 업데이트
  useEffect(() => {
    setNow(new Date());

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 서버 우선 초기화 및 공통 복약 일정 불러오기
  useEffect(() => {
    let cancelled = false;

    async function loadSettingsAndServer() {
      try {
        const savedSettings = localStorage.getItem(
          "wakeup-station-settings"
        );

        let localMedications: Medication[] = [];
        let localValid = false;

        if (savedSettings !== null) {
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

          if (
            Array.isArray(settings.medications) &&
            settings.medications.every(isMedication)
          ) {
            localMedications = settings.medications;
            localValid = true;
          }
        } else {
          setIsNewDevice(true);
        }

        if (localValid) {
          setMedications(localMedications);
          setIsMedicationDataValid(true);
        }

        const deviceToken = localStorage.getItem(
          "wakeup-station-device-token"
        );

        if (!deviceToken) {
          setIsMedicationDataValid(true);
          setIsSyncReady(false);
          return;
        }

        const response = await fetch("/api/medications/preview", {
          headers: {
            Authorization: `Bearer ${deviceToken}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`서버 조회 실패: ${response.status}`);
        }

        const result = await response.json();

        if (!Array.isArray(result.medications)) {
          throw new Error("서버 복약 데이터 형식이 올바르지 않습니다.");
        }

        const serverMedications: Medication[] =
          result.medications.map((item: Record<string, unknown>) => ({
            id: String(item.medication_id),
            name: item.name,
            time: item.time,
            days: item.days,
            completedDates: item.completed_dates,
            ...(typeof item.medication_group_id === "string" &&
              item.medication_group_id.length > 0
              ? { medicationGroupId: item.medication_group_id }
              : {}),
          }));

        if (!serverMedications.every(isMedication)) {
          throw new Error("서버 복약 데이터 검증에 실패했습니다.");
        }

        if (cancelled) return;

        const serverVersion = Number(result.lastVersion);

        if (
          !Number.isSafeInteger(serverVersion) ||
          serverVersion < 0
        ) {
          throw new Error("서버 동기화 버전이 올바르지 않습니다.");
        }

        syncVersionRef.current = serverVersion;

        localStorage.setItem(
          "wakeup-station-sync-version",
          String(serverVersion)
        );

        // 완전히 비어 있는 신규 그룹에 한해서만 기존 로컬 일정 가져오기
        if (
          serverVersion === 0 &&
          serverMedications.length === 0 &&
          localValid &&
          localMedications.length > 0
        ) {
          setMedications(localMedications);
          lastSyncedSnapshotRef.current = JSON.stringify([]);
        } else {
          // 기존 그룹의 데이터는 서버를 기준으로 사용
          setMedications(serverMedications);
          lastSyncedSnapshotRef.current =
            JSON.stringify(serverMedications);
        }

        setIsNewDevice(false);
        setIsMedicationDataValid(true);
        setIsSyncReady(true);

        console.log("공통 복약 일정 불러오기 완료", {
          version: serverVersion,
          count: serverMedications.length,
        });
      } catch (error) {
        console.error("초기 데이터 불러오기 실패:", error);
        setIsSyncReady(false);

        // 서버 확인 실패 시 기존 로컬 데이터는 보존하고
        // 서버 동기화는 보류한다.
        if (!cancelled && !isMedicationDataValid) {
          setIsMedicationDataValid(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    }

    function handleDeviceRegistered() {
      setIsSyncReady(false);
      void loadSettingsAndServer();
    }

    void loadSettingsAndServer();

    window.addEventListener(
      "wakeup-device-registered",
      handleDeviceRegistered
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        "wakeup-device-registered",
        handleDeviceRegistered
      );
    };
  }, []);

  // 설정 변경 시 자동 저장
  useEffect(() => {
    if (!isLoaded || !isMedicationDataValid) return;

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
    isMedicationDataValid,
  ]);

  // 공통 그룹 자동 동기화 및 다른 기기 변경사항 확인
  useEffect(() => {
    if (!isLoaded || !isMedicationDataValid || !isSyncReady) return;

    let cancelled = false;

    const deviceToken = localStorage.getItem(
      "wakeup-station-device-token"
    );

    if (!deviceToken) return;

    function convertServerMedications(items: unknown): Medication[] {
      if (!Array.isArray(items)) {
        throw new Error("서버 복약 데이터 형식 오류");
      }

      const converted = items.map((item: Record<string, unknown>) => ({
        id: String(item.medication_id),
        name: item.name,
        time: item.time,
        days: item.days,
        completedDates: item.completed_dates,
        ...(typeof item.medication_group_id === "string" &&
          item.medication_group_id.length > 0
          ? { medicationGroupId: item.medication_group_id }
          : {}),
      }));

      if (!converted.every(isMedication)) {
        throw new Error("서버 복약 데이터 검증 실패");
      }

      return converted;
    }

    async function fetchServerData() {
      const response = await fetch("/api/medications/preview", {
        headers: {
          Authorization: `Bearer ${deviceToken}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`서버 조회 실패: ${response.status}`);
      }

      return response.json();
    }

    async function syncLatest() {
      const snapshot = JSON.stringify(medications);

      if (snapshot === lastSyncedSnapshotRef.current) return;

      const previousRequest = syncRequestRef.current;

      const nextRequest = previousRequest
        .catch(() => {})
        .then(async () => {
          if (cancelled) return;

          const currentSnapshot = JSON.stringify(medications);

          if (currentSnapshot === lastSyncedSnapshotRef.current) return;

          try {
            const response = await fetch("/api/medications/sync", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${deviceToken}`,
              },
              body: JSON.stringify({
                medications,
                expectedVersion: syncVersionRef.current,
              }),
            });

            if (!response.ok) {
              throw new Error(`동기화 실패: HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.applied === true) {
              syncVersionRef.current = result.newVersion;

              localStorage.setItem(
                "wakeup-station-sync-version",
                String(result.newVersion)
              );

              lastSyncedSnapshotRef.current = currentSnapshot;

              console.log("공통 복약 일정 저장 완료", result.newVersion);
              return;
            }

            // 버전 충돌: 서버의 최신 데이터로 복구
            const latest = await fetchServerData();

            if (cancelled) return;

            const serverMedications =
              convertServerMedications(latest.medications);

            syncVersionRef.current = Number(latest.lastVersion);

            lastSyncedSnapshotRef.current =
              JSON.stringify(serverMedications);

            localStorage.setItem(
              "wakeup-station-sync-version",
              String(syncVersionRef.current)
            );

            setMedications(serverMedications);

            console.warn("동기화 충돌: 서버 최신 데이터 적용");
          } catch (error) {
            console.error("그룹 동기화 실패:", error);
          }
        });

      syncRequestRef.current = nextRequest;
      await nextRequest;
    }

    async function refreshFromServer() {
      if (cancelled) return;

      try {
        const latest = await fetchServerData();

        if (cancelled) return;

        const serverVersion = Number(latest.lastVersion);

        if (
          !Number.isSafeInteger(serverVersion) ||
          serverVersion <= syncVersionRef.current
        ) {
          return;
        }

        // 로컬에 아직 서버에 반영되지 않은 수정이 있다면
        // 덮어쓰지 않고 저장 요청에 충돌 검사를 맡긴다.
        if (
          JSON.stringify(medications) !==
          lastSyncedSnapshotRef.current
        ) {
          return;
        }

        const serverMedications =
          convertServerMedications(latest.medications);

        syncVersionRef.current = serverVersion;

        lastSyncedSnapshotRef.current =
          JSON.stringify(serverMedications);

        localStorage.setItem(
          "wakeup-station-sync-version",
          String(serverVersion)
        );

        setMedications(serverMedications);

        console.log("다른 기기의 변경사항 반영 완료");
      } catch (error) {
        console.error("공통 일정 확인 실패:", error);
      }
    }

    void syncLatest();

    const syncTimer = window.setInterval(() => {
      void syncLatest();
    }, 1000);

    const refreshTimer = window.setInterval(() => {
      void refreshFromServer();
    }, 5000);

    function handleOnline() {
      void refreshFromServer().then(() => syncLatest());
    }

    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.clearInterval(syncTimer);
      window.clearInterval(refreshTimer);
      window.removeEventListener("online", handleOnline);
    };
  }, [medications, isLoaded, isMedicationDataValid, isSyncReady]);

  // 아이폰 로컬 데이터와 서버 데이터 비교 (읽기 전용)
  async function checkDeviceSyncStatus() {
    const deviceToken = localStorage.getItem(
      "wakeup-station-device-token"
    );

    if (!deviceToken) {
      alert("기기 등록 정보가 없습니다. 먼저 기기를 등록해 주세요.");
      return;
    }

    try {
      const response = await fetch("/api/medications/preview", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${deviceToken}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        alert(`서버 데이터를 확인하지 못했습니다. (HTTP ${response.status})`);
        return;
      }

      const result: unknown = await response.json();

      if (
        typeof result !== "object" ||
        result === null ||
        !("medications" in result) ||
        !Array.isArray(result.medications)
      ) {
        alert("서버 응답 형식이 올바르지 않습니다.");
        return;
      }

      const serverMedications = result.medications as Array<{
        medication_id: string;
        name: string;
        time: string;
      }>;

      const localText = medications.length
        ? medications.map((item) => `${item.name} (${item.time})`).join("\\n")
        : "없음";

      const serverText = serverMedications.length
        ? serverMedications.map((item) => `${item.name} (${item.time})`).join("\\n")
        : "없음";

      const localIds = new Set(medications.map((item) => item.id));
      const serverIds = new Set(
        serverMedications.map((item) => item.medication_id)
      );

      const sameIds =
        localIds.size === serverIds.size &&
        [...localIds].every((id) => serverIds.has(id));

      alert(
        `📱 로컬 복약 일정 (${medications.length}개)\\n${localText}` +
        `\\n\\n☁️ 서버 복약 일정 (${serverMedications.length}개)\\n${serverText}` +
        `\\n\\n${sameIds ? "일정 ID 일치" : "⚠️ 로컬과 서버의 일정 ID가 다릅니다."}` +
        "\\n\n이 화면에서는 데이터를 변경하지 않습니다."
      );
    } catch (error) {
      console.error("복약 일정 비교 실패:", error);
      alert("네트워크 오류로 서버 데이터를 조회하지 못했습니다.");
    }
  }

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
    const linkedMedication = medications.find(
      (item) =>
        item.id !== medication.id &&
        medication.medicationGroupId !== undefined &&
        item.medicationGroupId === medication.medicationGroupId
    );
    setEditMedicationLinkId(linkedMedication?.id ?? "");
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

    if (!editingMedicationId) return;

    setMedications((prev) => {
      const current = prev.find(
        (item) => item.id === editingMedicationId
      );

      if (!current) return prev;

      const target = prev.find(
        (item) => item.id === editMedicationLinkId
      );

      const oldGroupId = current.medicationGroupId;

      if (!target) {
        return prev.map((item) =>
          item.id === editingMedicationId
            ? {
                ...item,
                name: editMedicationName.trim(),
                time: editMedicationTime,
                days: [...editMedicationDays],
                medicationGroupId: undefined,
              }
            : item
        );
      }

      const newGroupId =
        target.medicationGroupId ||
        current.medicationGroupId ||
        crypto.randomUUID();

      return prev.map((item) => {
        const belongsToTargetGroup =
          target.medicationGroupId !== undefined &&
          item.medicationGroupId === target.medicationGroupId;

        const belongsToCurrentGroup =
          oldGroupId !== undefined &&
          item.medicationGroupId === oldGroupId;

        if (item.id === editingMedicationId) {
          return {
            ...item,
            name: editMedicationName.trim(),
            time: editMedicationTime,
            days: [...editMedicationDays],
            medicationGroupId: newGroupId,
          };
        }

        if (
          item.id === target.id ||
          belongsToTargetGroup ||
          belongsToCurrentGroup
        ) {
          return {
            ...item,
            medicationGroupId: newGroupId,
          };
        }

        return item;
      });
    });

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

    if (!isMedicationDataValid && !isNewDevice) {
      alert("기존 복약 데이터를 확인할 수 없어 약 추가를 보류합니다.");
      return;
    }

    if (isNewDevice) {
      const existingToken = localStorage.getItem(
        "wakeup-station-device-token"
      );

      if (existingToken) {
        alert("기존 등록 기기의 서버 데이터를 먼저 확인해야 합니다.");
        return;
      }

      setIsMedicationDataValid(true);
      setIsNewDevice(false);
    }

    setMedications((prev) => [...prev, newMedication]);

    setNewMedicationName("");
    setNewMedicationTime("08:00");
    setNewMedicationDays(weekDays);
  }

  // 복약 이력 저장 중 중복 요청 방지
  const medicationHistoryPendingRef = useRef(new Set<string>());

  // 복약 완료 및 취소 기록을 Neon에 저장
  async function toggleMedicationComplete(id: string): Promise<boolean> {
    if (!now) return false;

    const today = getDateKey(now);
    const medication = medications.find((item) => item.id === id);

    if (!medication) return false;

    const requestKey = `${today}-${id}`;

    if (medicationHistoryPendingRef.current.has(requestKey)) {
      return false;
    }

    const token = localStorage.getItem("wakeup-station-device-token");

    if (!token) {
      alert("기기 등록이 필요합니다.");
      return false;
    }

    const isCompleted = medication.completedDates.includes(today);
    const scheduledDate = new Date(`${today}T${medication.time}:00`);

    if (Number.isNaN(scheduledDate.getTime())) {
      alert("복약 예정 시각이 올바르지 않습니다.");
      return false;
    }

    medicationHistoryPendingRef.current.add(requestKey);

    try {
      const response = await fetch("/api/medications/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          medicationId: id,
          scheduledAt: scheduledDate.toISOString(),
          status: isCompleted ? "cancelled" : "completed",
        }),
      });

      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(result.error || "복약 이력 저장 실패");
      }

      setMedications((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;

          return {
            ...item,
            completedDates: isCompleted
              ? item.completedDates.filter((date) => date !== today)
              : item.completedDates.includes(today)
                ? item.completedDates
                : [...item.completedDates, today],
          };
        })
      );

      console.log("복약 이력 저장 성공:", medication.name);
      return true;
    } catch (error) {
      console.error("복약 이력 저장 오류:", error);
      alert("복약 이력을 저장하지 못했습니다. 다시 시도해 주세요.");
      return false;
    } finally {
      medicationHistoryPendingRef.current.delete(requestKey);
    }
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


  // 서버의 자동 보정 시간 및 K4 지연 정보를 별도로 조회한다.
  useEffect(() => {
    if (!isLoaded || !isSyncReady) return;

    let cancelled = false;
    let inFlight = false;

    async function refreshReminderTimes() {
      if (inFlight) return;

      const deviceToken = localStorage.getItem(
        "wakeup-station-device-token"
      );

      if (!deviceToken) {
        setIsReminderDataReady(false);
        return;
      }

      inFlight = true;

      try {
        const response = await fetch("/api/medications/preview", {
          headers: {
            Authorization: `Bearer ${deviceToken}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `알림 시간 조회 실패: HTTP ${response.status}`
          );
        }

        const result = await response.json();

        if (!Array.isArray(result.medications)) {
          throw new Error("알림 데이터 형식 오류");
        }

        const nextTimes: Record<string, {
          adjustedAt: string | null;
          delayedUntil: string | null;
        }> = {};

        for (const item of result.medications) {
          const id = String(item.medication_id);

          nextTimes[id] = {
            adjustedAt:
              typeof item.adjusted_reminder_at === "string"
                ? item.adjusted_reminder_at
                : null,
            delayedUntil:
              typeof item.delayed_until === "string"
                ? item.delayed_until
                : null,
          };
        }

        if (cancelled) return;

        setServerReminderTimes(nextTimes);
        setIsReminderDataReady(true);
      } catch (error) {
        if (cancelled) return;

        console.error("알림 시간 동기화 실패:", error);
        setIsReminderDataReady(false);
      } finally {
        inFlight = false;
      }
    }

    void refreshReminderTimes();

    const timer = window.setInterval(() => {
      void refreshReminderTimes();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isLoaded, isSyncReady]);

  // K4 지연 > 자동 보정 > 기존 복약 시간 순서로 알림 표시
  useEffect(() => {
    if (
      !now ||
      !isLoaded ||
      !isReminderDataReady ||
      medicationAlert
    ) {
      return;
    }

    const todayKey = getDateKey(now);
    const currentHour = String(now.getHours()).padStart(2, "0");
    const currentMinute = String(now.getMinutes()).padStart(2, "0");
    const timeKey = `${currentHour}:${currentMinute}`;

    let nextAlertKey: string | null = null;

    const medication = medications.find((item) => {
      const day = weekDays[(now.getDay() + 6) % 7];
      const reminder = serverReminderTimes[item.id];

      // 서버 데이터에 해당 약이 없다면 알림을 보류한다.
      if (!reminder) return false;

      const resolved = resolveMedicationReminderTime({
        originalTime: item.time,
        adjustedAt: reminder.adjustedAt,
        delayedUntil: reminder.delayedUntil,
        now,
        serverReady: isReminderDataReady,
        completed: item.completedDates.includes(todayKey),
      });

      const alertKey =
        `${todayKey}-${item.id}-${resolved.source}-${resolved.time}`;

      const shouldAlert =
        item.days.includes(day) &&
        isMedicationReminderDue(resolved.time, now) &&
        !dismissedAlerts.includes(alertKey);

      if (shouldAlert) {
        nextAlertKey = alertKey;
      }

      return shouldAlert;
    });

    if (medication && nextAlertKey) {
      setActiveMedicationAlertKey(nextAlertKey);
      setMedicationAlert(medication);
    }
  }, [
    now,
    medications,
    isLoaded,
    isReminderDataReady,
    medicationAlert,
    dismissedAlerts,
    serverReminderTimes,
  ]);

  function dismissMedicationAlert() {
    if (!medicationAlert || !now) return;

    if (activeMedicationAlertKey) {
      setDismissedAlerts((prev) =>
        prev.includes(activeMedicationAlertKey)
          ? prev
          : [...prev, activeMedicationAlertKey]
      );
    }

    setActiveMedicationAlertKey(null);
    setMedicationAlert(null);
  }

  async function completeMedicationAlert() {
    if (!medicationAlert || !now) return;

    const medication = medications.find(
      (item) => item.id === medicationAlert.id
    );

    if (!medication) return;

    if (medication.completedDates.includes(getDateKey(now))) {
      dismissMedicationAlert();
      return;
    }

    const saved = await toggleMedicationComplete(medicationAlert.id);

    if (saved) {
      dismissMedicationAlert();
    }
  }

  const completedCount = todayMedications.filter(
    (medication) => medication.completedDates.includes(today)
  ).length;

  return (

    <>
      {medicationAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-500/30 bg-[#172235] p-6 text-white shadow-2xl">
            <p className="mb-2 text-sm font-semibold text-cyan-400">
              WAKEUP STATION PRO
            </p>

            <h2 className="mb-4 text-2xl font-bold">
              🔔 복용 시간이에요!
            </h2>

            <p className="mb-2 text-lg font-semibold">
              {medicationAlert.name}
            </p>

            <p className="mb-6 text-sm text-slate-300">
              설정한 복용 시간 {medicationAlert.time}이 되었어요.
              약을 복용해 주세요.
            </p>

            <button
              type="button"
              onClick={completeMedicationAlert}
              className="mb-3 w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white"
            >
              복용 완료
            </button>

            <button
              type="button"
              onClick={dismissMedicationAlert}
              className="w-full rounded-xl bg-slate-700 py-3 font-semibold text-slate-200"
            >
              나중에
            </button>
          </div>
        </div>
      )}

    <main className="min-h-screen bg-[#0b1220] px-5 py-8 pb-28 text-white sm:px-8">
      <DeviceRegistration />

      {activeTab === "settings" && (
        <div className="mx-auto max-w-2xl space-y-5">
          <header className="mb-6">
            <p className="text-sm tracking-widest text-cyan-400">
              WAKEUP STATION PRO
            </p>
            <h1 className="mt-2 text-3xl font-bold">설정</h1>
            <p className="mt-2 text-slate-400">
              기기 연결과 알림을 관리합니다.
            </p>
          </header>

          <section className="rounded-3xl border border-white/10 bg-[#172235] p-5">
            <h2 className="mb-4 text-lg font-semibold">기기 관리</h2>
            <button
              type="button"
              onClick={checkDeviceSyncStatus}
              className="w-full rounded-2xl border border-cyan-500/30 bg-slate-800 px-4 py-3 font-semibold text-cyan-300"
            >
              기기 연결 상태 확인
            </button>
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#172235] p-5">
            <h2 className="mb-4 text-lg font-semibold">푸시 알림</h2>
            <PushNotificationButton />
          </section>

          <DeviceConnectionStatus variant="settings" />
        </div>
      )}

      {activeTab === "analysis" && (
        <MedicationAnalysis />
      )}
      <div
        className="mx-auto max-w-5xl"
        style={{ display: activeTab === "home" ? "block" : "none" }}
      >

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

          <DeviceConnectionStatus variant="header" />
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

          <DeviceConnectionStatus variant="card" />

        </section>

        {/* 약통 환경 모니터링 */}
        <DeviceStatusPanel />

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

                        <button
                          type="button"
                          onClick={() => startEditMedication(medication)}
                          className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMedication(medication.id)}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20"
                        >
                          삭제
                        </button>
                      </div>

                      {/* ALL SCHEDULE EDIT FORM */}
                      {editingMedicationId === medication.id && (
                        <div className="mt-5 rounded-xl border border-cyan-500/30 bg-[#172235] p-4">
                          <h4 className="mb-4 font-semibold text-cyan-400">
                            복용 일정 수정
                          </h4>

                          <label className="mb-2 block text-sm text-slate-400">
                            약 이름
                          </label>
                          <input
                            type="text"
                            value={editMedicationName}
                            onChange={(e) => setEditMedicationName(e.target.value)}
                            className="mb-4 w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-white"
                          />


                            <label className="mb-2 block text-sm text-slate-400">
                              같은 약 연결
                            </label>
                            <select
                              value={editMedicationLinkId}
                              onChange={(e) => setEditMedicationLinkId(e.target.value)}
                              className="mb-4 w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-white"
                            >
                              <option value="">연결하지 않음</option>
                              {medications
                                .filter((item) => item.id !== editingMedicationId)
                                .map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name} ({item.time})
                                  </option>
                                ))}
                            </select>

                          <label className="mb-2 block text-sm text-slate-400">
                            복용 시간
                          </label>
                          <input
                            type="time"
                            value={editMedicationTime}
                            onChange={(e) => setEditMedicationTime(e.target.value)}
                            className="mb-5 block box-border w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-base text-white"
                          />

                          <p className="mb-3 text-sm text-slate-400">
                            복용 요일
                          </p>
                          <div className="mb-6 flex flex-wrap gap-2">
                            {weekDays.map((day) => (
                              <button
                                type="button"
                                key={day}
                                onClick={() => toggleEditMedicationDay(day)}
                                className={`h-10 w-10 rounded-full text-sm font-semibold ${
                                  editMedicationDays.includes(day)
                                    ? "bg-cyan-500 text-white"
                                    : "border border-white/10 bg-[#0b1220] text-slate-400"
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveEditMedication}
                              className="flex-1 rounded-xl bg-cyan-500 py-3 font-semibold text-white"
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
                              같은 약 연결
                            </label>
                            <select
                              value={editMedicationLinkId}
                              onChange={(e) => setEditMedicationLinkId(e.target.value)}
                              className="mb-4 w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-white"
                            >
                              <option value="">연결하지 않음</option>
                              {medications
                                .filter((item) => item.id !== editingMedicationId)
                                .map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name} ({item.time})
                                  </option>
                                ))}
                            </select>

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
          {!isLoaded
              ? "설정을 불러오는 중..."
              : isMedicationDataValid
                ? "복약 설정 로컬 저장 활성화"
                : "복약 데이터 보호 중 · 저장 보류"}
        </p>

        {/* 하단 정보 */}
        <footer className="mt-8 text-center text-xs text-slate-500">
          WAKEUP STATION PRO · SMART ALARM & MEDICATION SYSTEM
        </footer>

      </div>
    
      <nav
        aria-label="앱 메뉴"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#111827]/95 px-4 py-3 backdrop-blur"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          {([
            ["home", "⌂", "홈"],
            ["analysis", "▥", "복약 분석"],
            ["settings", "⚙", "설정"],
          ] as const).map(([tab, icon, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? "page" : undefined}
              className={`rounded-2xl px-2 py-2 text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "text-slate-400"
              }`}
            >
              <span className="block text-xl">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </main>
    </>
  );
}

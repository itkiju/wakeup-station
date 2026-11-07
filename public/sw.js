self.addEventListener("install", () => {
  console.log("WakeUp Station 서비스 워커 설치 완료");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    console.error("푸시 데이터 오류:", error);
  }

  const title = data.title || "WakeUp Station Pro";
  const options = {
    body: data.body || "복용 시간을 확인해 주세요.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "medication-reminder",
    data: {
      url: "/",
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.openWindow("/")
  );
});

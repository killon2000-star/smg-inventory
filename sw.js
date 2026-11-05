// 홈 화면 설치용 (자료는 저장하지 않고 항상 최신 화면을 받습니다)
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
// 앱 화면(index.html)은 항상 서버에서 새로 받아 옛 버전이 남지 않게 (안 되면 평소대로)
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') e.respondWith(fetch(e.request, { cache: 'no-cache' }).catch(() => fetch(e.request)));
});

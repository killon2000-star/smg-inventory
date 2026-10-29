// 홈 화면 설치용 (자료는 저장하지 않고 항상 최신 화면을 받습니다)
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

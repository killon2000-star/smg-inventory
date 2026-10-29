# SMG 재고관리

SMG 홀딩스 각 매장(SMG STORE_수원, BOX CAFE, SMG MUSEUM_홍대, CAFE 오마케) 재고·입출고·매출 관리 웹앱.

- 화면: `index.html`, `app.js` (휴대폰·태블릿·PC)
- 로그인·데이터: Firebase (구글 로그인, Firestore) — `config.js`, `firebase.js`
- 보안 규칙: `firestore.rules` (Firebase 콘솔 › Firestore › 규칙에 붙여넣기)
- 재고·매출·정산 자료는 이 저장소에 없습니다. Firebase에만 저장되고, 승인된 사용자만 볼 수 있습니다.

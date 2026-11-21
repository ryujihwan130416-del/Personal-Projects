# Pingo

Pingo는 채팅, 피드, 실시간 미니게임이 있는 데모 메신저 웹앱입니다. 아케이드/캔디 느낌의 독자적인 테마(라이트·다크)를 쓰며, 모바일과 데스크톱을 모두 지원합니다. UI 기본 언어는 영어이고, 프로필에서 한국어로 바꿀 수 있습니다. 문자열은 `src/i18n/`에 모여 있습니다.

앱 이름은 `src/firebase/config.ts`의 `APP_NAME` 상수 하나입니다. 바꾸면 화면 제목과 헤더가 같이 바뀝니다.

이 저장소는 **Firebase Local Emulator Suite**만 사용합니다. 실제 Firebase 프로젝트는 건드리지 않습니다.

## 필요한 것

- Node.js 20+
- Java 21+ (에뮬레이터용. macOS는 Temurin/OpenJDK)
- 통화 데모용(선택): `coturn`. 일반 PC에서는 Google STUN만으로도 되는 경우가 많고, 호스트 ICE 후보가 안 나오는 환경에서는 로컬 TURN이 필요합니다.

## 실행

```bash
cd DMApp
npm install
npm run demo
```

`npm run demo`가 하는 일:

1. 로컬 TURN(`coturn`, `turnserver.conf`, `127.0.0.1:3478`, 계정 `demo`/`demo`)을 켭니다. `coturn`이 없으면 해당 프로세스만 실패하고 나머지는 그대로 뜹니다.
2. Auth, Firestore, Storage, Realtime Database 에뮬레이터를 켭니다.
3. 데모 계정·대화를 넣습니다 (`scripts/seed.mjs`).
4. Vite 개발 서버를 [http://127.0.0.1:5173](http://127.0.0.1:5173)에서 엽니다.

에뮬레이터 UI: [http://127.0.0.1:4000](http://127.0.0.1:4000)

따로 실행하려면:

```bash
npm run emulators   # 터미널 1
npm run seed        # 에뮬레이터가 뜬 뒤
npm run dev         # 터미널 2
```

### 데모 계정

비밀번호는 모두 `demo1234`입니다.

| 이름 | 아이디 | 이메일 |
|------|--------|--------|
| Mina | @mina | mina@demo.local |
| Jun | @jun | jun@demo.local |
| Soyeon | @soyeon | soyeon@demo.local |
| Haru | @haru | haru@demo.local |

로그인 화면에서 계정을 눌러 바로 들어갈 수 있습니다. Mina↔Jun 대화, Soyeon→Mina 메시지 요청, 세 명이 있는 「Weekend hangout」 그룹, 샘플 게시물과 리더보드가 미리 들어 있습니다.

두 브라우저(또는 시크릿 창)에 다른 계정으로 로그인하면 실시간 메시지, 입력 중, 읽음, 통화를 확인할 수 있습니다.

## 기능

- 이메일 가입/로그인. 가입 시 고유 `@아이디`와 이름 설정. Google 버튼은 에뮬레이터용으로 안내만 합니다.
- 프로필 사진(Storage), 이름, 아이디, 소개, 링크. 사진을 누르면 크게 보입니다. 프로필 편집.
- 아이디 검색 후 1:1 대화 시작. 그룹 만들기.
- 받은 메시지함: 마지막 메시지, 시간, 안 읽은 수, 온라인 초록 점.
- 요청함: 처음 메시지를 보낸 사람은 수락 전까지 요청함에 들어갑니다.
- 대화: 글·사진, 답장(오른쪽 스와이프 또는 길게 누르기), 하트(두 번 탭), 읽음, 입력 중(RTDB), 접속/마지막 활동(RTDB), 전송 취소, 대화 테마 색.
- 차단·신고. 차단하면 메시지가 가려지고 상대는 보낼 수 없습니다.
- WebRTC 음성/영상 통화. Firestore로 offer/answer/ICE를 주고받습니다. 앱이 열려 있을 때 수신 벨 UI, 음소거·카메라·종료. STUN은 Google 공개 서버, TURN은 `src/firebase/config.ts`에 자리만 있습니다.

- 하단 탭(모바일) / 사이드 레일(데스크톱): Chats, Feed, Games, Profile.
- 피드: 글·사진(최대 4장), 팔로우한 사람·대화 상대의 글, 좋아요, 댓글, 프로필 그리드, 내 글 삭제.
- 게임 로비: 방 만들기, 코드로 참가, 모드(솔로 / 1v1 / 파티 3–8인), 리더보드. 채팅에서 게임 초대 시 결과가 메시지로 남습니다.
- 게임: 틱택토, 사목(Connect Four), 가위바위보, 반응속도, 퀴즈 레이스, 2048 레이스, 스네이크(최대 6인), 지뢰찾기 레이스, 캐치마인드(그림 맞히기), 영어 끝말잇기(Word chain).
- 캘린더: 월간·일 일정, 개인 일정, 채팅에서 「Plan」으로 공유 일정과 RSVP, 홈/프로필의 다가오는 일정, 시작 임박 알림 토스트.


## 실제 Firebase 프로젝트 (Lumen)

로컬 데모(`npm run demo`)는 계속 에뮬레이터만 사용합니다. 프로덕션은 기존 Lumen 프로젝트 `lumen-fcf2f` 안에 **Pingo 전용 리소스만** 씁니다. 기본 Lumen 호스팅, Turbo Racer 사이트, `turboracer` Firestore, 기본 RTDB 규칙은 건드리지 않습니다.

프로덕션은 `lumen-fcf2f`의 기존 `turboracer` Firestore와 기본 RTDB를 쓰되, 데이터는 `dmly/app/...`와 `/dmly/...` 네임스페이스에만 둡니다. 호스팅은 `pingo-messenger`(https://pingo-messenger.web.app)입니다. 사진/아바타는 Firestore에 압축 data URL로 저장합니다.

프로덕션 빌드: `VITE_USE_EMULATORS=false` (`npm run build:prod`). 막힌 네트워크에서 통화가 안 되면 `iceServers`에 TURN 서버가 필요합니다(지금은 공개 STUN만 사용).

## 테스트

에뮬레이터와 `npm run dev`가 켜진 상태에서:

```bash
npm run test:e2e
```

Playwright(헤드리스 Chrome, 가짜 카메라/마이크)가 Mina·Jun·Soyeon으로 로그인해 기존 채팅 흐름, 피드(글/좋아요/댓글), 틱택토, 가위바위보, 3인 반응속도 파티, 통화 연결을 확인하고 `shots/`에 스크린샷을 남깁니다.

## 보안 규칙

- 사용자는 자기 프로필만 수정할 수 있고, 아이디는 가입 후 바꿀 수 없습니다.
- 대화 멤버만 메시지와 채팅 미디어를 읽고 씁니다.
- `chats/{id}.blockedUids`에 있는 사용자는 메시지를 만들 수 없습니다.
- 요청을 수락/거절하는 것은 요청을 보낸 사람이 아닙니다.

## 제한

- Google 로그인은 에뮬레이터에서 동작하지 않아 버튼만 있습니다.
- 통화는 앱이 열려 있을 때만 수신됩니다(푸시/백그라운드 벨 없음).
- 실제 서비스에서는 `src/firebase/config.ts`의 TURN 주석을 자기 서버로 바꾸세요. 데모는 로컬 `coturn`을 쓸 수 있습니다.
- 일부 환경(샌드박스 등)에서는 호스트 ICE 후보가 나오지 않아, STUN만으로는 통화가 연결되지 않을 수 있습니다. 그때는 `npm run turn`을 함께 실행하세요.
- 그룹 통화는 아직 없습니다. 1:1만 지원합니다.
- 아이디 변경, 메시지 예약, 한 번 보면 사라지는 사진, 음성 메시지는 없습니다.

---

# Pingo (English)

Pingo is a demo messenger with chats, a social feed, and realtime minigames. It uses a distinctive arcade/candy theme (light and dark), works on mobile and desktop, and talks only to the **Firebase Local Emulator Suite** (demo project id `demo-dmapp`). The app name lives in one constant: `APP_NAME` in `src/firebase/config.ts`.

The UI is **English by default**. Strings live in `src/i18n/en.ts` (with optional Korean in `src/i18n/ko.ts`). Switch language from the profile header (한 / EN). The word-chain game always uses an English dictionary, even when the UI is Korean.

## Run

```bash
cd DMApp
npm install
npm run demo
```

That starts a local TURN server (`coturn`, `127.0.0.1:3478`, user/pass `demo`/`demo`) if installed, boots Auth / Firestore / Storage / RTDB emulators, seeds demo data, and opens Vite at [http://127.0.0.1:5173](http://127.0.0.1:5173). Emulator UI: [http://127.0.0.1:4000](http://127.0.0.1:4000).

Or run them separately: `npm run emulators`, then `npm run seed`, then `npm run dev`.

### Demo accounts

Password for all accounts: `demo1234`.

| Name | Username | Email |
|------|----------|--------|
| Mina | @mina | mina@demo.local |
| Jun | @jun | jun@demo.local |
| Soyeon | @soyeon | soyeon@demo.local |
| Haru | @haru | haru@demo.local |

The login screen can fill a demo account in one tap. Seed data includes a Mina↔Jun chat, a Soyeon→Mina message request, the “Weekend hangout” group, sample posts, and a leaderboard.

## Features

- Email sign-up / login, unique username, profile photo, bio, and link.
- 1:1 and group chats: text, photos, reply, hearts, read receipts, typing, presence, unsend, theme color, block/report.
- WebRTC voice/video (Google STUN + optional local coturn TURN). 1:1 only, while the app is open.
- Feed: text + photos, follow, likes, comments, profile grid, delete your own posts.
- Games lobby: create a room, join by code, invite from a chat, mode picker (solo / 1v1 / party of 3–8), leaderboard.
- Games: tic-tac-toe, Connect Four, rock-paper-scissors, reaction race, trivia race, 2048 race, Snake (up to 6), minesweeper race, draw & guess, and English word chain.
- Calendar: month + day agenda, personal events, shared events from a chat Plan button with Going/Maybe/No RSVP, upcoming events on home and profile, and an in-app reminder toast when an event starts soon.
- Playwright suite (`npm run test:e2e`) covers chat flows, feed, a full tic-tac-toe, RPS, a 3-player reaction game, and a call. Screenshots land in `shots/`.

This repo never creates, modifies, or deploys a real Firebase project. To point at a real project later, follow the Korean section “실제 Firebase 프로젝트에 연결하려면”.

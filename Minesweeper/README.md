# FIELD — 지뢰찾기

레벨(초급 / 중급 / 고급)을 고르고 지뢰를 피하는 웹·Android 게임입니다.

## 실행

```bash
cd Minesweeper
npm install
npm run dev
```

Vite가 출력하는 주소(기본 http://localhost:5173)를 엽니다.

`npm run build`로 `dist/`를 만들고, `npm run typecheck`로 타입을 검사합니다.

## 조작

- 데스크톱: 좌클릭으로 열기, 우클릭으로 깃발
- 모바일: 탭으로 열기(또는 깃발 모드), 길게 눌러 깃발
- 첫 클릭은 항상 안전합니다

## Android APK

`Minesweeper.apk`는 같은 게임을 Android WebView로 감싼 디버그 빌드입니다. Android 6 이상이 필요합니다.

1. `Minesweeper.apk`를 폰으로 복사하거나, 웹의 **APK 다운로드** 버튼을 누릅니다.
2. 설치를 허용한 뒤 앱을 실행합니다.

웹 변경 후 APK를 다시 만들려면:

```bash
cd Minesweeper
export ANDROID_HOME="$HOME/android-sdk"
npm run apk
cp android/app/build/outputs/apk/debug/app-debug.apk Minesweeper.apk
cp Minesweeper.apk public/Minesweeper.apk
```

# 서랍

미니 검색 엔진 웹 앱입니다. 샘플 문서와 직접 넣은 글을 브라우저에서 BM25로 검색합니다.

## 실행

```bash
cd SearchEngine
npm install
npm run preview
```

브라우저에서 [http://127.0.0.1:5173](http://127.0.0.1:5173) 를 엽니다.

개발 모드:

```bash
npm run dev
```

## 기능

- 샘플 문서 검색
- 제목·본문 직접 추가 (브라우저 localStorage)
- 샘플로 초기화

URL을 따라가며 모으는 로컬 크롤 서버는 `SearchEngineServer/` 에 있습니다.

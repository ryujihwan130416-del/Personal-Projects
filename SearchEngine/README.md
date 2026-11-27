# 서랍

미니 검색 엔진입니다. 샘플 문서와 직접 넣은 글을 BM25로 검색합니다.

## 웹 앱으로 열기 (Publish / Vite)

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

## 로컬 Python 서버 (URL 크롤 포함)

```bash
cd SearchEngine
python3 -m pip install -r requirements.txt
python3 server.py
```

브라우저에서 [http://127.0.0.1:8765](http://127.0.0.1:8765) 를 엽니다. 아래에 URL을 넣으면 페이지를 모아 색인에 더합니다.

## 동작

| 모드 | 내용 |
| --- | --- |
| Vite / Publish | 샘플 + 브라우저에 넣은 글 검색 (크롤 없음) |
| Python 로컬 | URL 크롤 · robots.txt · 역색인 · BM25 |

호스팅 앱에서는 임의 URL 요청(크롤)을 쓰지 않습니다.

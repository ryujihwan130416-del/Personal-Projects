# 서랍 로컬 크롤 서버

로컬에서만 쓰는 URL 크롤·색인 API입니다. 호스팅 앱(`SearchEngine/`)과는 별도입니다.

```bash
cd SearchEngineServer
python3 -m pip install -r requirements.txt
python3 server.py
```

브라우저에서 [http://127.0.0.1:8765](http://127.0.0.1:8765) 를 엽니다.

퍼블리시하지 마세요. 임의 URL을 가져오므로 공개 호스팅에는 올리지 않습니다.

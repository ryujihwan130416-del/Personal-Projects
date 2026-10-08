# Netlify에 올리는 Lumen

이 폴더는 앱과 같은 화면입니다. 그래프가 먼저 열리고, 설정의 Privacy policy에 있는 Learn more로 검색 화면이 나옵니다.

## GitHub 저장소를 Netlify에 연결

1. Netlify에서 **Add new site** → **Import an existing project** → GitHub를 고릅니다.
2. 이 저장소를 선택합니다.
3. 브랜치는 이 폴더가 있는 브랜치로 둡니다.
4. 저장소 맨 위의 `netlify.toml`이 빌드 명령과 배포 폴더(`netlify`)를 이미 지정합니다. 칸을 비워 두면 Netlify가 그 파일을 읽습니다.
5. Deploy를 누릅니다.

폴더만 올리고 싶다면 Netlify의 **Deploy manually**에 이 `netlify` 폴더를 끌어다 놓으면 됩니다. 빌드 명령은 필요 없습니다.

## API 키

키는 저장소에 들어 있지 않습니다. 사이트에서 **Add API key**에 넣습니다. 키를 웹사이트 주소로 제한했다면 `https://사이트이름.netlify.app/*` 를 허용해야 합니다.

# 🪙 KidsRich Class Economy (키즈리치 학급 화폐 경제 교육 시스템)

초등·중등 학급을 위한 실시간 학급 화폐 경제 교육 웹 애플리케이션입니다.  
학생들의 현금 지갑, 은행 예금 저축, 모의 주식 투자, 학급 상점 쿠폰, 라운드 시나리오 및 국세청 벌금/상금 기능을 제공합니다.

---

## 🚀 빠른 시작 (개발 환경 실행)

```bash
# 1. 패키지 설치
npm install

# 2. 로컬 개발 서버 실행 (포트 3000)
npm run dev

# 3. 배포용 빌드
npm run build
```

---

## 📦 영구 무료 운영을 위한 3단계 세팅 가이드 (GitHub + Vercel + Firebase)

구글의 **Firebase Spark 무료 플랜**과 **Vercel 무료 호스팅**을 사용하면 학교 예산 0원으로 평생 영구 운영할 수 있습니다.

### 1단계: 개인 Firebase 프로젝트 생성 (약 3분 소요)

1. [Firebase Console](https://console.firebase.google.com/)에 선생님 개인 구글 계정으로 로그인합니다.
2. **[프로젝트 추가]** 클릭 ➔ 프로젝트 이름 입력 (예: `my-class-economy`) ➔ Google 애널리틱스는 해제 후 생성.
3. 좌측 메뉴 **빌드(Build)** ➔ **Firestore Database** 클릭:
   * **[데이터베이스 만들기]** 클릭
   * 위치(Region): `asia-northeast3` (서울) 선택
   * 보안 규칙 시작 모드: **테스트 모드** 선택 후 생성 완료.
4. 상단 **[규칙(Rules)]** 탭 클릭 ➔ 아래 보안 규칙을 그대로 붙여넣고 **[게시]** 클릭:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /teachers/{teacherId} {
      allow read, write: if true;
    }

    match /classes/{classCode} {
      allow read, write: if true;

      match /students/{studentId} {
        allow read, write: if true;
      }

      match /transactions/{txId} {
        allow read, write: if true;
      }
    }
  }
}
```

5. 좌측 상단 톱니바퀴 ➔ **[프로젝트 설정]** ➔ 아래쪽 **[내 앱]** 섹션에서 웹 아이콘(`</>`) 클릭:
   * 앱 닉네임 입력 후 등록
   * 화면에 표시되는 `firebaseConfig` 객체 값을 확인합니다.

---

### 2단계: 환경 변수 설정

프로젝트 루트의 `.env.example`을 복사하여 `.env.local` 파일을 만들거나, Vercel 환경 변수에 아래 값을 입력합니다:

```env
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="my-class-economy.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="my-class-economy"
VITE_FIREBASE_STORAGE_BUCKET="my-class-economy.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abcdef..."
```

*(또는 프로젝트 루트의 `firebase-applet-config.json`에 위 값들을 그대로 입력해도 즉시 인식됩니다.)*

---

### 3단계-A: GitHub Pages로 바로 무료 배포 (별도 사이트 가입 불필요)

> ⚠️ GitHub 무료 계정의 GitHub Pages는 저장소가 **`Public`** 상태여야 무료로 사용할 수 있습니다.

1. 본 소스 코드를 본인의 **GitHub 저장소(`Public`)**에 Push합니다. (이 저장소에는 이미 `.github/workflows/deploy.yml` 자동 배포 파일이 포함되어 있습니다.)
2. GitHub 저장소 상단 **[Settings]** ➔ 좌측 **[Secrets and variables]** ➔ **[Actions]** 클릭:
   * **[Variables]** (또는 **[Secrets]**) 탭에서 위 `VITE_FIREBASE_*` 6개 값을 각각 등록합니다.
3. GitHub 저장소 좌측 **[Pages]** 클릭:
   * **Build and deployment** ➔ **Source**를 **`GitHub Actions`**로 선택합니다.
4. 저장소 상단 **[Actions]** 탭 ➔ **`Deploy to GitHub Pages`** 선택 ➔ **[Run workflow]**를 누르면 1~2분 뒤 `https://본인아이디.github.io/저장소이름/` 주소로 자동 배포됩니다!

---

### 3단계-B: Vercel로 1클릭 무료 배포 (Private 비공개 저장소 사용 시 권장)

1. 이 소스 코드를 본인의 **GitHub 저장소**(`Private` 가능)에 Push합니다.
2. [Vercel](https://vercel.com/) 접속 ➔ GitHub으로 로그인.
3. **[Add New...]** ➔ **[Project]** ➔ GitHub의 `kidrichschool` 저장소 선택.
4. **Environment Variables**에 위 Firebase 설정값 6개를 입력합니다.
5. **[Deploy]** 버튼 클릭 ➔ 1분 만에 `https://my-kidsrich.vercel.app` 형태의 평생 무료 웹사이트가 완성됩니다!

---

### 4단계: 기존 학생 데이터 복원

1. 기존 AI Studio 앱의 선생님 관리자 화면 ➔ **[전체 백업 (JSON)]** 버튼을 눌러 백업 파일 다운로드.
2. 새 Vercel 사이트에 교사로 로그인 ➔ **[백업 복원]** 버튼 클릭 후 다운받았던 `.json` 파일 선택.
3. 전체 학생들의 자산, 주식, 예약 시나리오, 라운드 상태가 선생님의 개인 Firebase로 100% 복원됩니다!

---

## 👩‍🏫 다른 선생님께 앱 배포·공유하기

### 방법 1: 현재 배포된 웹 주소 공유 (가장 간편 · 학급 데이터 완전 분리)
1. 동료 선생님께 배포된 앱 주소(`https://...vercel.app`)를 공유합니다.
2. 동료 선생님이 첫 화면에서 **[교사 전용] ➔ [교사 회원가입]**을 진행하면, 선생님만의 고유 학급 코드(예: `C-48291`)가 자동 생성되며 다른 반 데이터와 **100% 독립 분리**됩니다.
3. 학급 개설 후 관리자 화면 상단 또는 기본 설정의 **[학생 초대 링크 복사]**를 클릭하여 학생들에게 전달하면 `?class=C-XXXXX` 파라미터를 통해 학급 코드가 자동 입력된 로그인 화면으로 즉시 연결됩니다.

### 방법 2: 학교·교사별 완전 독립 서버 운영 (할당량 완전 분리 권장)
* 전교 여러 학급이 동시에 사용할 경우, 각 선생님이 본 저장소를 **GitHub Fork**한 뒤 **Vercel + 개인 Google 계정의 무료 Firebase 프로젝트**를 연결하면 일일 무료 읽기/쓰기 한도를 학급마다 100% 독립적으로 확보할 수 있습니다.

---

## ✨ 주요 업그레이드 기능 요약
* **최대 15개 주식 종목 등록**: 학급 경제 규모에 맞춰 최대 15개 종목까지 상장 및 실시간 시세 조정 지원
* **원천적 잔액 무결성 보장**: 모든 입·출금, 주식 매매, 상점 구매, 송금, 리밸런싱, 부채 상환 및 정산/벌금 처리에 Firestore 원자적 트랜잭션(`runTransaction`) 및 단조 증가 버전 가드(`balanceVersion`) 적용
* **다음 시나리오 예약 & 자동 실행**: 최대 5개 라운드까지 예금 이자율·예약 주가·뉴스 속보를 400ms 자동 저장하고, 지정 일시 도달 시 자동으로 다음 라운드로 전환


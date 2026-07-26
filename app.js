/* ═══════════════════════════════════════════
   ToyTools — Integrated SPA + Firebase
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  // ═══════════════════ FIREBASE CONFIG ═══════════════════
  // ⚠️ Firebase Console에서 프로젝트 생성 후 아래 값을 교체하세요.
  const FIREBASE_CONFIG = {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
  };

  const TOSS_CLIENT_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq'; // 토스페이먼츠 테스트 키
  const ADMIN_PASSWORD = 'dir1234!';
  const ADMIN_SESSION_KEY = 'toytools_admin_session';

  // ═══════════════════ STATE ═══════════════════
  let firebaseApp = null;
  let auth = null;
  let db = null;
  let firebaseReady = false;
  let currentUser = null;
  let userProfile = null;
  let isAdmin = false;
  let boardFilter = 'all';
  let boardView = 'LIST';
  let viewingPostId = null;
  let currentBoardId = null;
  let boards = [];
  let posts = [];
  let postsUnsubscribe = null;
  let selectedChargeAmount = 0;
  let tossPayments = null;
  let toymarketTab = 'skins';
  let resourcesTab = 'download';
  let writeAttachments = [];

  const WRITE_MAX_IMAGE_SIZE = 2 * 1024 * 1024;
  const WRITE_MAX_IMAGES = 8;

  const CAT_CLASS = {
    '잡담': 'cat-chat',
    '스킨자랑': 'cat-skin',
    '건의/버그': 'cat-bug',
    '자랑거리': 'cat-brag',
    '공지': 'cat-notice',
  };

  const DEFAULT_BOARDS = [
    { id: 'free', name: '자유게시판', categories: ['잡담', '스킨자랑', '건의/버그', '자랑거리'], order: 1 },
    { id: 'qna', name: '질문답변', categories: ['질문', '답변'], order: 2 },
    { id: 'notice', name: '공지사항', categories: ['공지'], order: 0 },
  ];

  const TOYS = [
    { icon: '🎬', title: '쇼츠 메이커', desc: '영상 클립을 자동으로 쇼츠 포맷으로 변환. 드래그 앤 드롭만으로 OK!', tag: '영상', accent: '#FF6B9D' },
    { icon: '🕷️', title: '초고속 크롤러', desc: '웹 데이터를 장난감처럼 쉽게 수집. 복잡한 설정은 이제 그만.', tag: '데이터', accent: '#00D4FF' },
    { icon: '🛡️', title: '디스크 가디언', desc: '디스크 용량을 실시간 모니터링하고 불필요한 파일을 척척 정리.', tag: '유틸', accent: '#7BED9F' },
    { icon: '🖼️', title: 'WPC 변환기', desc: 'Windows Photo Cache를 일반 이미지로 빠르게 변환하는 마법 상자.', tag: '이미지', accent: '#FF9F43' },
  ];

  const DEVLOGS = [
    { id: 1, emoji: '🏗️', title: 'ToyTools v1.0 — 디지털 장난감 공장, 드디어 문을 엽니다', date: '2026-07-15', views: 1284, comments: 23, from: '#FFE0EC', to: '#E0F7FF', body: '안녕하세요, ToyTools 디렉터입니다!\n\n드디어 v1.0 정식 출시를 앞두고 있습니다.\n\n이번 버전에 포함된 내장 장난감:\n• 쇼츠 메이커\n• 초고속 크롤러\n• 디스크 가디언\n• WPC 변환기\n\n모두 무설치 포터블 .exe로 제공됩니다.' },
    { id: 2, emoji: '🎨', title: '스킨 제작기 비하인드 — 3세대 스킨팩은 어떻게 탄생했나', date: '2026-07-08', views: 892, comments: 15, from: '#F3E8FF', to: '#FFE0EC', body: '3세대 스킨팩(곰인형, 롤리팝, 레트로 아케이드)을 만들면서 가장 중요하게 생각한 건 "키치하지만 촌스럽지 않게"였습니다.' },
    { id: 3, emoji: '🔧', title: '개발 현황 #12 — 크롤러 속도 3배 개선', date: '2026-06-28', views: 567, comments: 8, from: '#E0F7FF', to: '#D1FAE5', body: '초고속 크롤러의 핵심 엔진을 전면 개편했습니다. 수집 속도 3배 향상, 메모리 40% 감소.' },
    { id: 4, emoji: '💡', title: '왜 "장난감"인가? — ToyTools 철학 이야기', date: '2026-06-10', views: 1103, comments: 31, from: '#FEF3C7', to: '#FFE0EC', body: '"도구는 어렵다"는 고정관념을 깨고 싶었습니다. ToyTools는 장난감 상자에서 꺼내 드는 것처럼 직관적이어야 합니다.' },
    { id: 5, emoji: '🖥️', title: 'toy-tools.com 웹사이트 제작 시작!', date: '2026-07-20', views: 42, comments: 3, from: '#FFE0EC', to: '#F3E8FF', body: '회원가입, 캐시 충전, 관리자 모드까지 통합 시스템 구축을 시작합니다!' },
    { id: 6, emoji: '🍭', title: '롤리팝 스킨팩 티저', date: '2026-05-22', views: 734, comments: 19, from: '#FFE0EC', to: '#FEF3C7', body: '파스텔 그라데이션 + 둥근 모서리 + 쫀득한 버튼 애니메이션이 특징입니다.' },
  ];

  const SKINS = [
    { id: 'bear', emoji: '🎨', name: 'Midnight Studio', gen: 'Pro Theme', price: 3000, desc: 'VS Code 스타일 다크 테마. 눈의 피로를 줄이는 딥 슬레이트 팔레트.', bg: 'linear-gradient(135deg, #1e293b, #0f172a)' },
    { id: 'lollipop', emoji: '✨', name: 'Neon Drift', gen: 'Pro Theme', price: 5000, desc: '인디고-바이올렛 네온 액센트. 모던 SaaS 감성의 프리미엄 스킨.', bg: 'linear-gradient(135deg, #312e81, #6366f1)' },
    { id: 'arcade', emoji: '⚡', name: 'Steel Blue IDE', gen: 'Pro Theme', price: 7000, desc: '스틸 블루 기반 프로페셔널 워크스페이스 테마.', bg: 'linear-gradient(135deg, #0c4a6e, #1e3a5f)' },
  ];

  const MINIGAMES = [
    { id: 'pixel-runner', emoji: '🎮', name: 'Pixel Runner', tag: 'Mini Game', price: 2000, desc: '업무 휴식용 레트로 러너. ToyTools 트레이에서 바로 실행.', bg: 'linear-gradient(135deg, #1a1a2e, #4c1d95)' },
    { id: 'code-puzzle', emoji: '🧩', name: 'Code Puzzle', tag: 'Mini Game', price: 1500, desc: '로직 퍼즐로 사고를 환기시키는 미니 브레인 게임.', bg: 'linear-gradient(135deg, #134e4a, #115e59)' },
    { id: 'focus-timer', emoji: '⏱️', name: 'Focus Timer Rush', tag: 'Mini Game', price: 1000, desc: '포모도로 + 미니 챌린지. 생산성과 재미를 동시에.', bg: 'linear-gradient(135deg, #7c2d12, #9a3412)' },
  ];

  const EXTENSIONS = [
    { id: 'batch-renamer', emoji: '📁', name: 'Batch Renamer Pro', tag: 'Extension', price: 4000, desc: '대량 파일 이름 일괄 변경. 정규식 규칙 지원.', bg: 'linear-gradient(135deg, #1e3a5f, #0f172a)' },
    { id: 'api-tester', emoji: '🔌', name: 'REST API Tester', tag: 'Extension', price: 6000, desc: 'Postman 대체 경량 API 테스터. 히스토리 자동 저장.', bg: 'linear-gradient(135deg, #312e81, #1e1b4b)' },
    { id: 'markdown-studio', emoji: '📝', name: 'Markdown Studio', tag: 'Extension', price: 3500, desc: '실시간 프리뷰 마크다운 에디터. PDF보내기 지원.', bg: 'linear-gradient(135deg, #3f3f46, #18181b)' },
  ];

  const CHANGELOG = [
    { version: 'v1.0.0', date: '2026-07-26', notes: '정식 출시 — 쇼츠 메이커, 크롤러, 디스크 가디언, WPC 변환기 포함. 토이마켓 및 개발자센터 오픈.' },
    { version: 'v0.9.2', date: '2026-07-15', notes: '베타 9.2 — 크롤러 속도 3배 개선, 메모리 최적화, 다크 테마 스킨 3종 추가.' },
    { version: 'v0.9.0', date: '2026-06-28', notes: '베타 9.0 — ToyTools Studio UI 전면 개편, 포터블 .exe 배포 시작.' },
  ];

  const FAQ_ITEMS = [
    { q: 'ToyTools는 무료인가요?', a: '네, 핵심 유틸리티는 100% 무료입니다. 토이마켓의 스킨·미니게임·확장팩은 캐시로 구매할 수 있습니다.' },
    { q: 'Windows 외 OS를 지원하나요?', a: '현재 Windows 10/11만 공식 지원합니다. macOS/Linux 버전은 로드맵에 포함되어 있습니다.' },
    { q: '설치 없이 사용할 수 있나요?', a: '네, 포터블 .exe 형태로 제공됩니다. USB에 넣어 어디서든 실행할 수 있습니다.' },
    { q: '캐시 환불이 가능한가요?', a: '디지털 콘텐츠 특성상 구매 후 환불은 제한적이며, 관련 법령에 따라 처리됩니다.' },
    { q: '확장팩을 직접 등록하려면?', a: '개발자센터에서 등록 신청서를 제출하세요. 심사 후 토이마켓에 배포됩니다.' },
  ];

  const GUIDE_STEPS = [
    { title: '다운로드 & 실행', desc: '자료실에서 ToyTools v1.0 .exe를 다운로드하고 더블클릭으로 실행하세요. 설치 과정이 없습니다.' },
    { title: '장난감 선택', desc: '메인 화면에서 쇼츠 메이커, 크롤러 등 원하는 유틸리티를 클릭해 바로 사용을 시작합니다.' },
    { title: '계정 연동', desc: '회원가입 후 로그인하면 캐시 충전, 토이마켓 구매, 클라우드 설정 동기화를 이용할 수 있습니다.' },
    { title: '토이마켓 탐색', desc: '스킨 팩으로 UI를 커스터마이즈하고, 미니게임과 확장 팩으로 워크플로우를 확장하세요.' },
    { title: '커뮤니티 활용', desc: '자유게시판에서 피드백을 남기고, 자료실 FAQ에서 궁금한 점을 확인하세요.' },
  ];

  const TERMS_HTML = `
    <h3>제1조 (목적)</h3>
    <p>본 약관은 ToyTools(이하 "서비스")가 제공하는 웹사이트 및 클라이언트 애플리케이션 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
    <h3>제2조 (서비스의 제공)</h3>
    <p>서비스는 디지털 도구 소프트웨어, 커뮤니티 게시판, 스킨 마켓 등을 무료 또는 유료 캐시를 통해 제공합니다.</p>
    <h3>제3조 (이용자의 의무)</h3>
    <ul><li>타인의 권리를 침해하는 게시물을 작성하지 않습니다.</li><li>서비스를 불법적인 목적으로 이용하지 않습니다.</li><li>계정 정보를 타인과 공유하지 않습니다.</li></ul>
    <h3>제4조 (캐시 및 결제)</h3>
    <p>유료 캐시는 스킨 마켓 구매에 사용되며, 충전 후 환불은 관련 법령에 따릅니다. 미성년자의 결제는 법정대리인의 동의가 필요합니다.</p>
    <h3>제5조 (책임 제한)</h3>
    <p>서비스는 "있는 그대로" 제공되며, 천재지변, 시스템 장애 등 불가항력적 사유로 인한 손해에 대해 책임을 지지 않습니다.</p>
    <h3>제6조 (약관 변경)</h3>
    <p>본 약관은 필요 시 변경될 수 있으며, 변경 시 웹사이트를 통해 공지합니다.</p>
  `;

  const PRIVACY_HTML = `
    <h3>1. 수집하는 개인정보 항목</h3>
    <p>회원가입 시: 이메일, 닉네임, 비밀번호(암호화 저장). 서비스 이용 시: IP 주소, 접속 로그, 결제 기록.</p>
    <h3>2. 개인정보의 수집 및 이용 목적</h3>
    <ul><li>회원 식별 및 서비스 제공</li><li>캐시 충전 및 스킨 구매 처리</li><li>커뮤니티 운영 및 부정 이용 방지</li><li>고객 문의 응대</li></ul>
    <h3>3. 개인정보의 보유 및 파기</h3>
    <p>회원 탈퇴 시 즉시 파기하며, 관련 법령에 따라 일정 기간 보관이 필요한 정보는 해당 기간 동안 보관 후 파기합니다.</p>
    <h3>4. 개인정보의 제3자 제공</h3>
    <p>원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 단, 결제 처리를 위해 PG사(토스페이먼츠 등)에 필요 최소한의 정보가 제공될 수 있습니다.</p>
    <h3>5. 이용자의 권리</h3>
    <p>이용자는 언제든지 개인정보 열람, 정정, 삭제를 요청할 수 있습니다. 문의: privacy@toy-tools.com</p>
    <h3>6. 개인정보 보호책임자</h3>
    <p>ToyTools 개인정보 보호책임자 — privacy@toy-tools.com</p>
  `;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ═══════════════════ INIT ═══════════════════
  async function init() {
    lucide.createIcons();
    initFirebase();
    initTossPayments();
    initTermsContent();
    bindModals();
    bindAuthUI();
    bindChargeUI();
    bindAdminUI();
    renderToyCards();
    renderDevLogs();
    renderToyMarket();
    renderResources();
    bindToyMarketTabs();
    bindResourcesTabs();
    bindDeveloperCenter();
    bindFooterNav();
    bindNavigation();
    bindMobileMenu();
    bindBoardEvents();
    bindDevlogModal();
    bindDownloadBtn();
    handleHashRoute();
    window.addEventListener('hashchange', handleHashRoute);

    isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
    updateAdminUI();

    await loadBoards();
    if (boards.length > 0) {
      selectBoard(boards[0].id);
    }
  }

  // ═══════════════════ FIREBASE ═══════════════════
  function initFirebase() {
    if (typeof firebase === 'undefined' || FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') {
      console.warn('[ToyTools] Firebase 미설정 — 로컬 모드로 동작합니다.');
      updateAuthUI(null);
      return;
    }
    try {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      firebaseReady = true;

      auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
          await loadUserProfile(user.uid);
        } else {
          userProfile = null;
        }
        updateAuthUI(user);
        renderToyMarket();
        updateDeveloperDashboard();
      });
    } catch (err) {
      console.error('[ToyTools] Firebase 초기화 실패:', err);
      showToast('Firebase 연결에 실패했습니다.');
    }
  }

  function initTossPayments() {
    if (typeof TossPayments !== 'undefined' && TOSS_CLIENT_KEY) {
      try {
        tossPayments = TossPayments(TOSS_CLIENT_KEY);
      } catch (_) { /* ignore */ }
    }
  }

  // ═══════════════════ AUTH ═══════════════════
  async function signUp(email, password, nickname) {
    if (!firebaseReady) throw new Error('Firebase가 설정되지 않았습니다.');
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).set({
      uid: cred.user.uid,
      email,
      nickname,
      cash: 0,
      ownedSkins: ['default'],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return cred.user;
  }

  async function signIn(email, password) {
    if (!firebaseReady) throw new Error('Firebase가 설정되지 않았습니다.');
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  }

  async function signOut() {
    if (auth) await auth.signOut();
    userProfile = null;
    updateAuthUI(null);
  }

  async function loadUserProfile(uid) {
    if (!db) return;
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      userProfile = { id: uid, ...doc.data() };
    } else {
      userProfile = { id: uid, nickname: '유저', cash: 0, ownedSkins: ['default'] };
    }
    updateAuthUI(currentUser);
  }

  function updateAuthUI(user) {
    const guestEls = [$('#auth-guest'), $('#mobile-auth-guest')];
    const userEls = [$('#auth-user'), $('#mobile-auth-user')];

    if (user && userProfile) {
      guestEls.forEach((el) => el?.classList.add('hidden'));
      userEls.forEach((el) => el?.classList.remove('hidden'));
      const nick = userProfile.nickname || '유저';
      const cash = (userProfile.cash || 0).toLocaleString();
      ['#header-nickname', '#mobile-nickname'].forEach((s) => { const el = $(s); if (el) el.textContent = nick; });
      ['#header-cash', '#mobile-cash'].forEach((s) => { const el = $(s); if (el) el.textContent = `${cash}P`; });
    } else {
      guestEls.forEach((el) => el?.classList.remove('hidden'));
      userEls.forEach((el) => el?.classList.add('hidden'));
    }
  }

  function bindAuthUI() {
    const openLogin = () => openModal('modal-login');
    const openSignup = () => openModal('modal-signup');

    $('#btn-login')?.addEventListener('click', openLogin);
    $('#btn-signup')?.addEventListener('click', openSignup);
    $('#btn-login-mobile')?.addEventListener('click', openLogin);
    $('#btn-signup-mobile')?.addEventListener('click', openSignup);
    $('#switch-to-signup')?.addEventListener('click', () => { closeAllModals(); openSignup(); });
    $('#switch-to-login')?.addEventListener('click', () => { closeAllModals(); openLogin(); });
    $('#btn-logout')?.addEventListener('click', () => signOut().then(() => showToast('로그아웃되었습니다.')));
    $('#btn-logout-mobile')?.addEventListener('click', () => signOut().then(() => showToast('로그아웃되었습니다.')));
    $('#btn-mypage')?.addEventListener('click', openMyPage);
    $('#btn-mypage-mobile')?.addEventListener('click', openMyPage);

    $('#login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await signIn($('#login-email').value.trim(), $('#login-password').value);
        closeAllModals();
        showToast('로그인되었습니다.');
        e.target.reset();
      } catch (err) {
        showToast(getAuthErrorMessage(err));
      }
    });

    $('#signup-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = $('#signup-password').value;
      const pw2 = $('#signup-password2').value;
      if (pw !== pw2) { showToast('비밀번호가 일치하지 않습니다.'); return; }
      try {
        await signUp($('#signup-email').value.trim(), pw, $('#signup-nickname').value.trim());
        closeAllModals();
        showToast('회원가입이 완료되었습니다.');
        e.target.reset();
      } catch (err) {
        showToast(getAuthErrorMessage(err));
      }
    });
  }

  function getAuthErrorMessage(err) {
    const code = err.code || '';
    const map = {
      'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
      'auth/invalid-email': '올바른 이메일 형식이 아닙니다.',
      'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
      'auth/user-not-found': '등록되지 않은 이메일입니다.',
      'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
      'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    };
    return map[code] || err.message || '인증 오류가 발생했습니다.';
  }

  function openMyPage() {
    if (!currentUser || !userProfile) { showToast('로그인이 필요합니다.'); return; }
    $('#mypage-nickname').textContent = userProfile.nickname || '-';
    $('#mypage-email').textContent = userProfile.email || currentUser.email || '-';
    $('#mypage-cash').textContent = `${(userProfile.cash || 0).toLocaleString()}P`;
    const skinsEl = $('#mypage-skins');
    if (skinsEl) {
      const owned = userProfile.ownedSkins || ['default'];
      skinsEl.innerHTML = owned.map((id) => {
        const skin = SKINS.find((s) => s.id === id);
        return `<span class="skin-owned-badge">${skin ? skin.emoji + ' ' + skin.name : '🎨 ' + id}</span>`;
      }).join('') || '<span class="text-sm text-gray-400">기본 스킨</span>';
    }
    openModal('modal-mypage');
  }

  // ═══════════════════ CASH & PAYMENT ═══════════════════
  function bindChargeUI() {
    $('#btn-open-charge')?.addEventListener('click', () => {
      closeAllModals();
      selectedChargeAmount = 0;
      updateChargeSelection();
      openModal('modal-charge');
    });

    $$('.charge-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedChargeAmount = Number(btn.dataset.amount);
        updateChargeSelection();
      });
    });

    $('#btn-pay-test')?.addEventListener('click', () => processCharge(true));
    $('#btn-pay-toss')?.addEventListener('click', () => processCharge(false));
  }

  function updateChargeSelection() {
    $$('.charge-option').forEach((btn) => {
      btn.classList.toggle('selected', Number(btn.dataset.amount) === selectedChargeAmount);
    });
    const sel = $('#charge-selected');
    if (sel) sel.textContent = selectedChargeAmount ? `${selectedChargeAmount.toLocaleString()}P` : '0P';
    $('#btn-pay-test').disabled = !selectedChargeAmount;
    $('#btn-pay-toss').disabled = !selectedChargeAmount;
  }

  async function processCharge(isTest) {
    if (!currentUser || !userProfile) { showToast('로그인이 필요합니다.'); return; }
    if (!selectedChargeAmount) return;

    if (isTest) {
      await addCash(selectedChargeAmount);
      closeAllModals();
      showToast(`테스트 결제 완료: +${selectedChargeAmount.toLocaleString()}P`);
      return;
    }

    if (!tossPayments) {
      showToast('토스페이먼츠 SDK가 로드되지 않았습니다. 테스트 결제를 이용해 주세요.');
      return;
    }

    const orderId = `toytools_${currentUser.uid}_${Date.now()}`;
    try {
      await tossPayments.requestPayment('카드', {
        amount: selectedChargeAmount,
        orderId,
        orderName: `ToyTools 캐시 ${selectedChargeAmount.toLocaleString()}P`,
        customerName: userProfile.nickname || 'ToyTools 유저',
        successUrl: `${window.location.origin}${window.location.pathname}?payment=success&amount=${selectedChargeAmount}&orderId=${orderId}`,
        failUrl: `${window.location.origin}${window.location.pathname}?payment=fail`,
      });
    } catch (err) {
      if (err.code === 'USER_CANCEL') {
        showToast('결제가 취소되었습니다.');
      } else {
        showToast('결제 요청 실패: ' + (err.message || '알 수 없는 오류'));
      }
    }
  }

  async function addCash(amount) {
    if (!db || !currentUser) return;
    const ref = db.collection('users').doc(currentUser.uid);
    await ref.update({ cash: firebase.firestore.FieldValue.increment(amount) });
    await loadUserProfile(currentUser.uid);
    openMyPage();
  }

  function handlePaymentCallback() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      const amount = Number(params.get('amount')) || 0;
      if (amount && currentUser) {
        addCash(amount).then(() => showToast(`결제 완료! +${amount.toLocaleString()}P`));
      }
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    } else if (params.get('payment') === 'fail') {
      showToast('결제에 실패했습니다.');
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }

  // ═══════════════════ SKIN PURCHASE ═══════════════════
  async function buySkin(skinId) {
    if (!currentUser || !userProfile) { showToast('로그인 후 구매할 수 있습니다.'); return; }
    const skin = SKINS.find((s) => s.id === skinId);
    if (!skin) return;
    if ((userProfile.ownedSkins || []).includes(skinId)) {
      showToast('이미 보유한 스킨입니다.');
      return;
    }
    if ((userProfile.cash || 0) < skin.price) {
      showToast(`캐시가 부족합니다. (필요: ${skin.price.toLocaleString()}P)`);
      return;
    }
    if (!db) { showToast('Firebase 연결이 필요합니다.'); return; }

    const ref = db.collection('users').doc(currentUser.uid);
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.data();
      if ((data.cash || 0) < skin.price) throw new Error('잔액 부족');
      if ((data.ownedSkins || []).includes(skinId)) throw new Error('이미 보유');
      tx.update(ref, {
        cash: data.cash - skin.price,
        ownedSkins: firebase.firestore.FieldValue.arrayUnion(skinId),
      });
    });
    await loadUserProfile(currentUser.uid);
    renderToyMarket();
    showToast(`${skin.name} 구매가 완료되었습니다.`);
  }

  // ═══════════════════ BOARDS (FIRESTORE) ═══════════════════
  async function loadBoards() {
    if (firebaseReady && db) {
      const snap = await db.collection('boards').orderBy('order').get();
      if (!snap.empty) {
        boards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } else {
        await seedDefaultBoards();
        boards = [...DEFAULT_BOARDS];
      }
    } else {
      boards = [...DEFAULT_BOARDS];
    }
    renderBoardTabs();
    if (isAdmin) window.SuperAdmin?.renderPanel();
  }

  async function seedDefaultBoards() {
    const batch = db.batch();
    DEFAULT_BOARDS.forEach((b) => {
      const ref = db.collection('boards').doc(b.id);
      batch.set(ref, { name: b.name, categories: b.categories, order: b.order });
    });
    await batch.commit();
    await seedDefaultPosts();
  }

  async function seedDefaultPosts() {
    const defaults = [
      { boardId: 'free', nick: '장난감초보', pw: '1234', cat: '잡담', title: 'ToyTools 처음 써봤는데 진짜 쉽네요 ㅋㅋ', body: '쇼츠 메이커 써봤는데 드래그만 하면 끝!', views: 156, isNotice: false, comments: [{ nick: '익명', body: '인정 ㅋㅋ', time: '2026-07-18 14:32' }] },
      { boardId: 'free', nick: '스킨덕후', pw: '1234', cat: '스킨자랑', title: '[자랑] 곰인형 스킨 커스텀 완성', body: '진짜 귀여움 ㅠㅠ', views: 243, isNotice: false, comments: [] },
      { boardId: 'notice', nick: '관리자', pw: '', cat: '공지', title: '📢 ToyTools v1.0 출시 예정 안내', body: '곧 정식 출시됩니다. 많은 관심 부탁드립니다!', views: 512, isNotice: true, comments: [] },
    ];
    for (const p of defaults) {
      await db.collection('posts').add({
        ...p,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        date: formatDate(new Date()),
      });
    }
  }

  function resetBoardState() {
    boardView = 'LIST';
    viewingPostId = null;
    closeWriteModal();
    setBoardView('LIST');
  }

  function setBoardView(view) {
    boardView = view;
    const listEl = $('#board-list-view');
    const detailEl = $('#board-detail-view');
    if (listEl) listEl.classList.toggle('hidden', view !== 'LIST');
    if (detailEl) detailEl.classList.toggle('hidden', view !== 'DETAIL');
    if (view === 'LIST') {
      viewingPostId = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function openWriteModal() {
    if (currentBoardId === 'notice') {
      showToast('공지사항은 관리자만 작성할 수 있습니다.');
      return;
    }
    const modal = $('#modal-board-write');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    loadWriteDraft();
    lucide.createIcons();
    $('#write-nick')?.focus();
  }

  function closeWriteModal() {
    const modal = $('#modal-board-write');
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    const anyOpen = [...document.querySelectorAll('.modal')].some((m) => !m.classList.contains('hidden'));
    if (!anyOpen) document.body.style.overflow = '';
    $('#board-write-form')?.reset();
    clearWriteAttachments();
  }

  function clearWriteAttachments() {
    writeAttachments = [];
    const preview = $('#write-image-preview');
    if (preview) {
      preview.innerHTML = '';
      preview.classList.add('hidden');
    }
    $('#write-drop-zone')?.classList.remove('drag-over');
  }

  function syncWriteAttachmentsFromBody() {
    const body = $('#write-body')?.value || '';
    const regex = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;
    writeAttachments = [];
    let m;
    while ((m = regex.exec(body)) !== null) {
      writeAttachments.push({
        id: `img_${writeAttachments.length}_${Date.now()}`,
        name: m[1] || '이미지',
        dataUrl: m[2],
        markdown: m[0],
      });
    }
    renderWriteImagePreviews();
  }

  function renderWriteImagePreviews() {
    const container = $('#write-image-preview');
    if (!container) return;
    if (writeAttachments.length === 0) {
      container.innerHTML = '';
      container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');
    container.innerHTML = writeAttachments.map((att) => `
      <div class="write-preview-item" data-att-id="${att.id}">
        <img src="${att.dataUrl}" alt="${escapeHtml(att.name)}" />
        <button type="button" class="write-preview-remove" data-remove-att="${att.id}" aria-label="이미지 삭제">×</button>
      </div>
    `).join('');
    container.querySelectorAll('[data-remove-att]').forEach((btn) => {
      btn.addEventListener('click', () => removeWriteAttachment(btn.dataset.removeAtt));
    });
  }

  function removeWriteAttachment(id) {
    const att = writeAttachments.find((a) => a.id === id);
    if (att?.markdown) {
      const ta = $('#write-body');
      if (ta) ta.value = ta.value.replace(att.markdown, '');
    }
    writeAttachments = writeAttachments.filter((a) => a.id !== id);
    renderWriteImagePreviews();
  }

  function insertImageMarkdown(dataUrl, name) {
    const ta = $('#write-body');
    if (!ta) return '';
    const safeName = name.replace(/[\[\]]/g, '');
    const markdown = `\n![${safeName}](${dataUrl})\n`;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, start) + markdown + ta.value.slice(end);
    const pos = start + markdown.length;
    ta.selectionStart = ta.selectionEnd = pos;
    ta.focus();
    return markdown;
  }

  async function addWriteImages(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'));
    if (!files.length) {
      showToast('이미지 파일만 첨부할 수 있습니다.');
      return;
    }
    if (writeAttachments.length + files.length > WRITE_MAX_IMAGES) {
      showToast(`이미지는 최대 ${WRITE_MAX_IMAGES}장까지 첨부할 수 있습니다.`);
      return;
    }

    for (const file of files) {
      if (file.size > WRITE_MAX_IMAGE_SIZE) {
        showToast(`"${file.name}" — 이미지는 2MB 이하만 가능합니다.`);
        continue;
      }
      const dataUrl = await readFileAsDataUrl(file);
      const markdown = insertImageMarkdown(dataUrl, file.name);
      writeAttachments.push({
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        dataUrl,
        markdown,
      });
    }
    renderWriteImagePreviews();
    lucide.createIcons();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function saveWriteDraft() {
    if (!currentBoardId) return;
    const draft = {
      nick: $('#write-nick')?.value || '',
      pw: $('#write-pw')?.value || '',
      cat: $('#write-cat')?.value || '',
      title: $('#write-title')?.value || '',
      body: $('#write-body')?.value || '',
      savedAt: Date.now(),
    };
    localStorage.setItem(`toytools_draft_${currentBoardId}`, JSON.stringify(draft));
    showToast('임시저장되었습니다.');
  }

  function loadWriteDraft() {
    clearWriteAttachments();
    if (!currentBoardId) return;
    try {
      const raw = localStorage.getItem(`toytools_draft_${currentBoardId}`);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.nick != null) $('#write-nick').value = d.nick;
      if (d.pw != null) $('#write-pw').value = d.pw;
      if (d.cat != null && $('#write-cat')) $('#write-cat').value = d.cat;
      if (d.title != null) $('#write-title').value = d.title;
      if (d.body != null) $('#write-body').value = d.body;
      syncWriteAttachmentsFromBody();
    } catch (_) { /* ignore */ }
  }

  function clearWriteDraft() {
    if (currentBoardId) {
      localStorage.removeItem(`toytools_draft_${currentBoardId}`);
    }
  }

  function bindWriteImageEvents() {
    const input = $('#write-image-input');
    const dropZone = $('#write-drop-zone');
    const attachBtn = $('#btn-attach-image');

    attachBtn?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', (e) => {
      if (e.target.files?.length) addWriteImages(e.target.files);
      e.target.value = '';
    });

    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (evt === 'drop' && e.dataTransfer?.files?.length) {
          addWriteImages(e.dataTransfer.files);
        }
        dropZone.classList.remove('drag-over');
      });
    });
  }

  function selectBoard(boardId) {
    currentBoardId = boardId;
    const board = boards.find((b) => b.id === boardId);
    if (board) {
      const title = $('#board-section-title');
      if (title) title.textContent = board.name;
      renderCategoryFilters(board.categories || []);
      updateWriteCategorySelect(board.categories || []);
    }
    renderBoardTabs();
    resetBoardState();
    updateBoardWriteButton();
    subscribePosts(boardId);
  }

  function updateBoardWriteButton() {
    const btn = $('#btn-board-write');
    if (btn) btn.classList.toggle('hidden', currentBoardId === 'notice');
  }

  function subscribePosts(boardId) {
    if (postsUnsubscribe) postsUnsubscribe();
    if (!firebaseReady || !db) {
      posts = getLocalPosts(boardId);
      renderBoard();
      return;
    }
    postsUnsubscribe = db.collection('posts')
      .where('boardId', '==', boardId)
      .onSnapshot((snap) => {
        posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        posts.sort((a, b) => {
          if (a.isNotice && !b.isNotice) return -1;
          if (!a.isNotice && b.isNotice) return 1;
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });
        renderBoard();
        if (isAdmin) window.SuperAdmin?.renderPanel();
      }, () => {
        posts = getLocalPosts(boardId);
        renderBoard();
      });
  }

  function getLocalPosts(boardId) {
    try {
      const raw = localStorage.getItem(`toytools_posts_${boardId}`);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    if (boardId === 'free') {
      return [
        { id: 'local1', boardId: 'free', nick: '장난감초보', pw: '1234', cat: '잡담', title: 'ToyTools 처음 써봤는데 진짜 쉽네요', body: '드래그만 하면 끝!', date: '2026-07-18', views: 156, comments: [] },
      ];
    }
    return [];
  }

  function saveLocalPosts() {
    if (currentBoardId) {
      localStorage.setItem(`toytools_posts_${currentBoardId}`, JSON.stringify(posts));
    }
  }

  function renderBoardTabs() {
    const container = $('#board-tabs');
    if (!container) return;
    container.innerHTML = boards.map((b) => `
      <button class="board-tab${b.id === currentBoardId ? ' active' : ''}" data-board="${b.id}">${escapeHtml(b.name)}</button>
    `).join('');
    container.querySelectorAll('.board-tab').forEach((btn) => {
      btn.addEventListener('click', () => selectBoard(btn.dataset.board));
    });
  }

  function renderCategoryFilters(categories) {
    const container = $('#board-filters');
    if (!container) return;
    container.innerHTML = `<button class="board-filter active" data-cat="all">전체</button>` +
      categories.map((c) => `<button class="board-filter" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
    boardFilter = 'all';
    bindCategoryFilters();
  }

  function bindCategoryFilters() {
    $$('.board-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.board-filter').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        boardFilter = btn.dataset.cat;
        renderBoard();
      });
    });
  }

  function updateWriteCategorySelect(categories) {
    const sel = $('#write-cat');
    if (!sel) return;
    sel.innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function renderBoard() {
    const filtered = boardFilter === 'all' ? posts : posts.filter((p) => p.cat === boardFilter);
    const tbody = $('#board-tbody');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">게시글이 없습니다.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((p, i) => {
      const catClass = CAT_CLASS[p.cat] || 'cat-chat';
      const commentCount = (p.comments || []).length;
      return `
        <tr data-id="${p.id}">
          <td class="hidden sm:table-cell text-gray-400 text-center">${p.isNotice ? '📌' : filtered.length - i}</td>
          <td class="hidden md:table-cell"><span class="cat-tag ${catClass}">${escapeHtml(p.cat)}</span></td>
          <td>
            ${p.isNotice ? '<span class="post-notice-badge">공지</span>' : ''}
            <span class="md:hidden cat-tag ${catClass} mr-1">${escapeHtml(p.cat)}</span>
            <span class="font-medium ${p.isNotice ? 'text-indigo-400' : 'text-gray-200'}">${escapeHtml(p.title)}</span>
            ${commentCount > 0 ? `<span class="text-indigo-400 text-xs ml-1">[${commentCount}]</span>` : ''}
          </td>
          <td class="hidden sm:table-cell text-gray-500">${escapeHtml(p.nick)}</td>
          <td class="hidden md:table-cell text-gray-400 text-xs">${(p.date || '').slice(5)}</td>
          <td class="hidden lg:table-cell text-gray-400 text-center">${p.views || 0}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach((row) => {
      row.addEventListener('click', () => openPostDetail(row.dataset.id));
    });
  }

  async function openPostDetail(id) {
    const post = posts.find((p) => p.id === id);
    if (!post) return;

    if (firebaseReady && db) {
      await db.collection('posts').doc(id).update({ views: firebase.firestore.FieldValue.increment(1) });
    } else {
      post.views = (post.views || 0) + 1;
      saveLocalPosts();
    }
    viewingPostId = id;

    const content = $('#board-detail-content');
    if (!content) return;

    const catClass = CAT_CLASS[post.cat] || 'cat-chat';
    const adminBtns = isAdmin ? `
      <button class="admin-delete-btn" id="admin-delete-post"><i data-lucide="trash-2" class="w-3 h-3"></i> 관리자 삭제 (글)</button>
    ` : '';

    content.innerHTML = `
      <span class="cat-tag ${catClass}">${escapeHtml(post.cat)}</span>
      ${post.isNotice ? '<span class="post-notice-badge ml-1">공지</span>' : ''}
      <h2 class="board-post-title mt-2">${escapeHtml(post.title)}</h2>
      <div class="board-post-meta">
        <span>${escapeHtml(post.nick)}</span>
        <span>${post.date || ''}</span>
        <span>조회 ${(post.views || 0) + 1}</span>
      </div>
      <div class="board-post-body">${renderPostBody(post.body)}</div>
      ${adminBtns}
    `;
    lucide.createIcons();

    $('#admin-delete-post')?.addEventListener('click', () => adminDeletePost(id));

    renderComments(post);
    setBoardView('DETAIL');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderComments(post) {
    const list = $('#comment-list');
    const count = $('#comment-count');
    const comments = post.comments || [];
    if (count) count.textContent = comments.length;
    if (!list) return;

    if (comments.length === 0) {
      list.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">아직 댓글이 없습니다.</p>';
      return;
    }

    list.innerHTML = comments.map((c, idx) => `
      <div class="comment-item" data-idx="${idx}">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="comment-nick">${escapeHtml(c.nick)}</span>
            <span class="comment-time">${c.time || ''}</span>
            ${isAdmin ? `<button class="admin-comment-del text-xs text-red-500 font-bold ml-auto" data-idx="${idx}">삭제</button>` : ''}
          </div>
          <p class="text-gray-400">${escapeHtml(c.body)}</p>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.admin-comment-del').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        adminDeleteComment(post.id, Number(btn.dataset.idx));
      });
    });
  }

  function bindBoardEvents() {
    $('#btn-board-write')?.addEventListener('click', openWriteModal);
    bindWriteImageEvents();

    $('#btn-write-draft')?.addEventListener('click', saveWriteDraft);

    $$('[data-close-board-write]').forEach((el) => {
      el.addEventListener('click', closeWriteModal);
    });

    $$('[data-board-back]').forEach((btn) => {
      btn.addEventListener('click', () => setBoardView('LIST'));
    });

    $('#board-write-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nick = $('#write-nick').value.trim() || '익명';
      const pw = $('#write-pw').value;
      const cat = $('#write-cat').value;
      const title = $('#write-title').value.trim();
      const body = $('#write-body').value.trim();
      if (window.SuperAdmin?.isNickMuted(nick)) {
        showToast('게시글 작성이 제한된 사용자입니다. (Mute/블랙리스트)');
        return;
      }
      if (!title || !body || !pw) { showToast('모든 필드를 입력해 주세요.'); return; }

      const postData = {
        boardId: currentBoardId,
        nick, pw, cat, title, body,
        date: formatDate(new Date()),
        views: 0,
        isNotice: false,
        comments: [],
        createdAt: firebaseReady ? firebase.firestore.FieldValue.serverTimestamp() : Date.now(),
      };

      if (firebaseReady && db) {
        await db.collection('posts').add(postData);
      } else {
        postData.id = 'local_' + Date.now();
        posts.unshift(postData);
        saveLocalPosts();
        renderBoard();
      }
      closeWriteModal();
      clearWriteDraft();
      showToast('게시글이 등록되었습니다.');
    });

    $('#comment-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!viewingPostId) return;
      const nick = $('#comment-nick').value.trim() || '익명';
      const body = $('#comment-body').value.trim();
      if (!body) return;

      const comment = { nick, body, time: formatDateTime(new Date()) };

      if (firebaseReady && db) {
        const ref = db.collection('posts').doc(viewingPostId);
        await ref.update({ comments: firebase.firestore.FieldValue.arrayUnion(comment) });
      } else {
        const post = posts.find((p) => p.id === viewingPostId);
        if (post) {
          if (!post.comments) post.comments = [];
          post.comments.push(comment);
          saveLocalPosts();
          renderComments(post);
        }
      }
      $('#comment-body').value = '';
      showToast('댓글이 등록되었습니다!');
    });
  }

  // ═══════════════════ ADMIN ═══════════════════
  function bindAdminUI() {
    $('#admin-key-btn')?.addEventListener('click', () => {
      if (isAdmin) {
        navigateTo('admin');
      } else {
        openModal('modal-admin-login');
      }
    });

    $('#admin-login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const pw = $('#admin-password').value;
      if (pw === ADMIN_PASSWORD) {
        isAdmin = true;
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        closeAllModals();
        updateAdminUI();
        navigateTo('admin');
        showToast('슈퍼 관리자 모드가 활성화되었습니다.');
        e.target.reset();
      } else {
        showToast('비밀번호가 올바르지 않습니다.');
      }
    });
  }

  function updateAdminUI() {
    const show = isAdmin ? 'remove' : 'add';
    $('#admin-nav-link')?.classList[show]('hidden');
    $('#admin-mobile-nav')?.classList[show]('hidden');
    if (isAdmin) window.SuperAdmin?.renderPanel();
  }

  async function adminCreateBoard(name) {
    const id = 'board_' + Date.now();
    const newBoard = { name, categories: ['일반'], order: boards.length + 1 };
    if (firebaseReady && db) {
      await db.collection('boards').doc(id).set(newBoard);
    } else {
      boards.push({ id, ...newBoard });
    }
    await loadBoards();
    showToast(`게시판 "${name}" 생성 완료`);
  }

  async function adminPostNotice({ boardId, title, body, pin = true }) {
    if (!title || !body) return;
    const postData = {
      boardId,
      nick: '관리자',
      pw: '',
      cat: '공지',
      title,
      body,
      date: formatDate(new Date()),
      views: 0,
      isNotice: true,
      pinned: pin,
      comments: [],
      createdAt: firebaseReady ? firebase.firestore.FieldValue.serverTimestamp() : Date.now(),
    };
    if (firebaseReady && db) {
      await db.collection('posts').add(postData);
    } else {
      const raw = localStorage.getItem(`toytools_posts_${boardId}`);
      const list = raw ? JSON.parse(raw) : [];
      list.unshift({ id: 'notice_' + Date.now(), ...postData });
      localStorage.setItem(`toytools_posts_${boardId}`, JSON.stringify(list));
      if (boardId === currentBoardId) {
        posts = list;
        renderBoard();
      }
    }
    showToast('공지사항이 등록되었습니다.');
  }

  function adminDeletePostsByNick(nick) {
    const q = nick.trim().toLowerCase();
    boards.forEach((b) => {
      try {
        const raw = localStorage.getItem(`toytools_posts_${b.id}`);
        if (!raw) return;
        const list = JSON.parse(raw).filter((p) => (p.nick || '').toLowerCase() !== q);
        localStorage.setItem(`toytools_posts_${b.id}`, JSON.stringify(list));
      } catch (_) { /* ignore */ }
    });
    if (currentBoardId) {
      posts = posts.filter((p) => (p.nick || '').toLowerCase() !== q);
      saveLocalPosts();
      renderBoard();
    }
    showToast(`"${nick}" 닉네임의 게시글이 삭제되었습니다.`);
  }

  async function adminDeleteBoard(boardId) {
    if (!confirm('이 게시판을 삭제하시겠습니까?')) return;
    if (firebaseReady && db) {
      await db.collection('boards').doc(boardId).delete();
      const postSnap = await db.collection('posts').where('boardId', '==', boardId).get();
      const batch = db.batch();
      postSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } else {
      boards = boards.filter((b) => b.id !== boardId);
      localStorage.removeItem(`toytools_posts_${boardId}`);
    }
    await loadBoards();
    if (currentBoardId === boardId && boards.length > 0) selectBoard(boards[0].id);
    showToast('게시판이 삭제되었습니다.');
  }

  async function adminDeletePost(postId, boardId) {
    const bid = boardId || currentBoardId;
    if (firebaseReady && db) {
      await db.collection('posts').doc(postId).delete();
    } else if (bid === currentBoardId) {
      posts = posts.filter((p) => p.id !== postId);
      saveLocalPosts();
      renderBoard();
    } else {
      try {
        const raw = localStorage.getItem(`toytools_posts_${bid}`);
        if (raw) {
          const list = JSON.parse(raw).filter((p) => p.id !== postId);
          localStorage.setItem(`toytools_posts_${bid}`, JSON.stringify(list));
        }
      } catch (_) { /* ignore */ }
    }
    if (viewingPostId === postId) {
      viewingPostId = null;
      setBoardView('LIST');
    }
    showToast('게시글이 삭제되었습니다.');
  }

  async function adminDeleteComment(postId, commentIdx) {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const comments = [...(post.comments || [])];
    comments.splice(commentIdx, 1);

    if (firebaseReady && db) {
      await db.collection('posts').doc(postId).update({ comments });
    } else {
      post.comments = comments;
      saveLocalPosts();
      renderComments(post);
    }
    showToast('댓글이 삭제되었습니다.');
  }

  // ═══════════════════ TERMS ═══════════════════
  function initTermsContent() {
    const terms = $('#terms-content');
    const privacy = $('#privacy-content');
    if (terms) terms.innerHTML = TERMS_HTML;
    if (privacy) privacy.innerHTML = PRIVACY_HTML;
  }

  function bindModals() {
    $$('[data-close-modal]').forEach((el) => {
      el.addEventListener('click', closeAllModals);
    });
    $$('.modal-close').forEach((el) => {
      el.addEventListener('click', closeAllModals);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllModals();
    });

    $('#link-terms')?.addEventListener('click', () => openModal('modal-terms'));
    $('#link-privacy')?.addEventListener('click', () => openModal('modal-privacy'));
    $('#link-terms-footer')?.addEventListener('click', () => openModal('modal-terms'));
    $('#link-privacy-footer')?.addEventListener('click', () => openModal('modal-privacy'));
    $$('[data-open-terms]').forEach((el) => el.addEventListener('click', () => openModal('modal-terms')));
    $$('[data-open-privacy]').forEach((el) => el.addEventListener('click', () => openModal('modal-privacy')));
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      lucide.createIcons();
    }
  }

  function closeAllModals() {
    $$('.modal').forEach((m) => m.classList.add('hidden'));
    document.body.style.overflow = '';
    $('#board-write-form')?.reset();
    clearWriteAttachments();
  }

  // ═══════════════════ NAVIGATION ═══════════════════
  const VALID_SECTIONS = ['home', 'toys', 'devlog', 'board', 'toymarket', 'developer', 'resources', 'admin'];
  const HASH_ALIASES = { skins: 'toymarket' };

  function parseHash() {
    const raw = window.location.hash.replace('#', '') || 'home';
    const [section, subtab] = raw.split('.');
    const resolved = HASH_ALIASES[section] || section;
    return { section: resolved, subtab };
  }

  function buildHash(section, subtab) {
    if (!section || section === 'home') return '';
    return subtab ? `${section}.${subtab}` : section;
  }

  function navigateTo(section, subtab) {
    if (section === 'admin' && !isAdmin) {
      openModal('modal-admin-login');
      return;
    }
    $$('.section').forEach((el) => el.classList.remove('active'));
    const target = document.getElementById(section);
    if (target) target.classList.add('active');

    $$('.nav-pill').forEach((el) => {
      el.classList.toggle('active', el.dataset.section === section);
    });

    const newHash = buildHash(section, subtab);
    const currentRaw = window.location.hash.replace('#', '');
    if (newHash !== currentRaw) {
      window.location.hash = newHash;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    closeMobileMenu();
    if (section !== 'board') {
      resetBoardState();
    } else if (boardView === 'DETAIL') {
      setBoardView('LIST');
    }

    if (section === 'toymarket' && subtab) {
      setToyMarketTab(subtab, false);
    } else if (section === 'toymarket') {
      renderToyMarket();
    }
    if (section === 'resources' && subtab) {
      setResourcesTab(subtab, false);
    } else if (section === 'resources') {
      renderResourcesPanels();
    }
    if (section === 'developer') {
      updateDeveloperDashboard();
    }
    if (section === 'admin' && isAdmin) {
      const tabs = ['overview', 'marketplace', 'community', 'downloads', 'users', 'developers', 'settings'];
      const tab = subtab && tabs.includes(subtab) ? subtab : 'overview';
      window.SuperAdmin?.setTab(tab, false);
    }
  }

  function handleHashRoute() {
    const { section, subtab } = parseHash();
    if (!VALID_SECTIONS.includes(section)) {
      navigateTo('home');
      return;
    }
    navigateTo(section, subtab);
  }

  function bindNavigation() {
    $$('.nav-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        if (section) navigateTo(section);
      });
    });
  }

  function bindFooterNav() {
    $$('[data-footer-nav]').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.footerNav));
    });
    $('#footer-contact-btn')?.addEventListener('click', () => {
      navigateTo('resources', 'qna');
      setTimeout(() => $('#contact-email')?.focus(), 300);
    });
    $('#resources-download-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('ToyTools v1.0 다운로드 준비 중입니다.');
    });
  }

  function bindMobileMenu() {
    $('#mobile-menu-btn')?.addEventListener('click', () => {
      $('#mobile-nav')?.classList.toggle('hidden');
    });
  }

  function closeMobileMenu() {
    $('#mobile-nav')?.classList.add('hidden');
  }

  // ═══════════════════ RENDER HELPERS ═══════════════════
  function renderToyCards() {
    const container = $('#toy-cards');
    if (!container) return;
    container.innerHTML = TOYS.map((t) => `
      <div class="toy-card" style="--card-accent:${t.accent}">
        <span class="toy-card-icon">${t.icon}</span>
        <h3 class="toy-card-title">${escapeHtml(t.title)}</h3>
        <p class="toy-card-desc">${escapeHtml(t.desc)}</p>
        <span class="toy-card-tag">${escapeHtml(t.tag)}</span>
      </div>
    `).join('');
  }

  function renderDevLogs() {
    const container = $('#devlog-list');
    if (!container) return;
    container.innerHTML = DEVLOGS.map((d) => `
      <article class="devlog-card" data-id="${d.id}">
        <div class="devlog-card-thumb" style="--thumb-from:${d.from};--thumb-to:${d.to}">${d.emoji}</div>
        <div class="devlog-card-body">
          <h3 class="devlog-card-title">${escapeHtml(d.title)}</h3>
          <div class="devlog-card-meta">
            <span>📅 ${d.date}</span>
            <span>👁 ${d.views.toLocaleString()}</span>
            <span>💬 ${d.comments}</span>
          </div>
        </div>
      </article>
    `).join('');
    container.querySelectorAll('.devlog-card').forEach((card) => {
      card.addEventListener('click', () => openDevlogModal(Number(card.dataset.id)));
    });
  }

  function openDevlogModal(id) {
    const post = DEVLOGS.find((d) => d.id === id);
    if (!post) return;
    const body = $('#devlog-modal-body');
    if (!body) return;
    body.innerHTML = `
      <div class="text-4xl mb-4">${post.emoji}</div>
      <h2 class="text-xl sm:text-2xl font-semibold text-white mb-3">${escapeHtml(post.title)}</h2>
      <div class="flex flex-wrap gap-4 text-sm text-gray-400 mb-6">
        <span>📅 ${post.date}</span>
        <span>👁 ${post.views.toLocaleString()}</span>
        <span>💬 ${post.comments}</span>
      </div>
      <div class="board-post-body text-base leading-relaxed">${escapeHtml(post.body)}</div>
    `;
    openModal('devlog-modal');
  }

  function bindDevlogModal() {
    const modal = $('#devlog-modal');
    if (!modal) return;
    modal.querySelector('.modal-backdrop')?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.querySelector('.modal-close')?.addEventListener('click', () => modal.classList.add('hidden'));
  }

  function renderSkinCards() { renderToyMarket(); }

  function bindToyMarketTabs() {
    $$('[data-toymarket-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setToyMarketTab(btn.dataset.toymarketTab));
    });
  }

  function setToyMarketTab(tab, updateHash = true) {
    toymarketTab = tab;
    $$('[data-toymarket-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.toymarketTab === tab);
    });
    renderToyMarket();
    if (updateHash) {
      const h = buildHash('toymarket', tab === 'skins' ? null : tab);
      if (window.location.hash.replace('#', '') !== h) window.location.hash = h;
    }
  }

  function renderToyMarket() {
    const container = $('#toymarket-grid');
    if (!container) return;

    let items;
    let buyType;
    if (toymarketTab === 'games') {
      buyType = 'game';
      items = window.SuperAdmin?.getMarketCatalog('game') || MINIGAMES;
    } else if (toymarketTab === 'extensions') {
      buyType = 'extension';
      items = window.SuperAdmin?.getMarketCatalog('extension') || EXTENSIONS;
    } else {
      buyType = 'skin';
      items = window.SuperAdmin?.getMarketCatalog('skin') || SKINS;
    }

    const owned = userProfile?.ownedSkins || [];
    const ownedKey = userProfile?.ownedItems || [];

    container.innerHTML = items.map((item) => {
      const ownedCheck = buyType === 'skin'
        ? owned.includes(item.id)
        : ownedKey.includes(item.id);
      const genLabel = item.gen || item.tag || '';
      return `
        <div class="market-card">
          <div class="market-card-preview" style="background:${item.bg}">${item.emoji}</div>
          <div class="market-card-body">
            <span class="market-card-tag">${escapeHtml(genLabel)}</span>
            <h3 class="market-card-name">${escapeHtml(item.name)}</h3>
            <p class="market-card-desc">${escapeHtml(item.desc)}</p>
            <p class="market-card-price">${item.price.toLocaleString()}P</p>
            ${ownedCheck
              ? '<span class="skin-owned-label">보유 중</span>'
              : `<button class="toy-btn-3d toy-btn-3d-sm skin-buy-btn justify-center" data-buy-type="${buyType}" data-buy-id="${item.id}">구매하기</button>`
            }
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-buy-id]').forEach((btn) => {
      btn.addEventListener('click', () => buyMarketItem(btn.dataset.buyType, btn.dataset.buyId));
    });
    lucide.createIcons();
  }

  async function buyMarketItem(type, itemId) {
    if (type === 'skin') {
      return buySkin(itemId);
    }
    if (!currentUser || !userProfile) {
      showToast('로그인 후 구매할 수 있습니다.');
      return;
    }
    const catalog = type === 'game' ? MINIGAMES : EXTENSIONS;
    const item = catalog.find((i) => i.id === itemId);
    if (!item) return;
    const owned = userProfile.ownedItems || [];
    if (owned.includes(itemId)) {
      showToast('이미 보유한 아이템입니다.');
      return;
    }
    if ((userProfile.cash || 0) < item.price) {
      showToast(`캐시가 부족합니다. (필요: ${item.price.toLocaleString()}P)`);
      return;
    }
    if (!db) {
      userProfile.cash -= item.price;
      if (!userProfile.ownedItems) userProfile.ownedItems = [];
      userProfile.ownedItems.push(itemId);
      updateAuthUI(currentUser);
      renderToyMarket();
      showToast(`${item.name} 구매가 완료되었습니다.`);
      return;
    }
    const ref = db.collection('users').doc(currentUser.uid);
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.data();
      const items = data.ownedItems || [];
      if ((data.cash || 0) < item.price) throw new Error('잔액 부족');
      if (items.includes(itemId)) throw new Error('이미 보유');
      tx.update(ref, {
        cash: data.cash - item.price,
        ownedItems: firebase.firestore.FieldValue.arrayUnion(itemId),
      });
    });
    await loadUserProfile(currentUser.uid);
    renderToyMarket();
    showToast(`${item.name} 구매가 완료되었습니다.`);
  }

  function bindResourcesTabs() {
    $$('[data-resources-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setResourcesTab(btn.dataset.resourcesTab));
    });
    $('#contact-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = $('#contact-email')?.value?.trim();
      const subject = $('#contact-subject')?.value?.trim();
      const body = $('#contact-body')?.value?.trim();
      if (window.SuperAdmin) {
        window.SuperAdmin.addInquiry({ email, subject, body });
      }
      showToast('문의가 접수되었습니다. 1~2 영업일 내 답변드립니다.');
      e.target.reset();
    });
  }

  function setResourcesTab(tab, updateHash = true) {
    resourcesTab = tab;
    $$('[data-resources-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.resourcesTab === tab);
    });
    renderResourcesPanels();
    if (updateHash) {
      const h = buildHash('resources', tab === 'download' ? null : tab);
      if (window.location.hash.replace('#', '') !== h) window.location.hash = h;
    }
  }

  function renderResources() {
    renderChangelog();
    renderFAQ();
    renderGuide();
    renderResourcesPanels();
  }

  function renderResourcesPanels() {
    const panels = { download: '#resources-download', qna: '#resources-qna', guide: '#resources-guide' };
    Object.entries(panels).forEach(([key, sel]) => {
      const el = $(sel);
      if (el) el.classList.toggle('hidden', key !== resourcesTab);
    });
  }

  function renderChangelog() {
    const container = $('#changelog-list');
    if (!container) return;
    const data = window.SuperAdmin?.getChangelog() || CHANGELOG;
    container.innerHTML = data.map((c) => `
      <div class="changelog-item">
        <div><span class="changelog-version">${escapeHtml(c.version)}</span><span class="changelog-date">${c.date}</span></div>
        <p class="changelog-notes">${escapeHtml(c.notes)}</p>
      </div>
    `).join('');
  }

  function renderFAQ() {
    const container = $('#faq-accordion');
    if (!container) return;
    const data = window.SuperAdmin?.getFaq() || FAQ_ITEMS;
    container.innerHTML = data.map((f, i) => `
      <div class="faq-item" data-faq="${i}">
        <button type="button" class="faq-question">
          <span>${escapeHtml(f.q)}</span>
          <i data-lucide="chevron-down" class="faq-chevron w-4 h-4"></i>
        </button>
        <div class="faq-answer">${escapeHtml(f.a)}</div>
      </div>
    `).join('');
    container.querySelectorAll('.faq-question').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const wasOpen = item.classList.contains('open');
        container.querySelectorAll('.faq-item').forEach((el) => el.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });
    lucide.createIcons();
  }

  function renderGuide() {
    const container = $('#guide-content');
    if (!container) return;
    container.innerHTML = GUIDE_STEPS.map((s, i) => `
      <div class="guide-step">
        <span class="guide-step-num">${i + 1}</span>
        <div>
          <p class="guide-step-title">${escapeHtml(s.title)}</p>
          <p class="guide-step-desc">${escapeHtml(s.desc)}</p>
        </div>
      </div>
    `).join('');
  }

  function bindDeveloperCenter() {
    $('#dev-submit-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentUser) {
        showToast('로그인 후 등록 신청이 가능합니다.');
        openModal('modal-login');
        return;
      }
      const itemType = $('#dev-item-type')?.value;
      const name = $('#dev-item-name')?.value?.trim();
      const desc = $('#dev-item-desc')?.value?.trim();
      const url = $('#dev-item-url')?.value?.trim();
      if (window.SuperAdmin) {
        window.SuperAdmin.addDevSubmission({
          itemType,
          type: itemType,
          name,
          desc,
          url,
          nick: userProfile?.nickname || currentUser?.email,
          email: currentUser?.email,
        });
      }
      showToast('등록 신청이 접수되었습니다. 심사 후 연락드립니다.');
      e.target.reset();
    });
    $$('.doc-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        showToast('API 문서는 docs.toy-tools.com 오픈 시 제공됩니다.');
      });
    });
    updateDeveloperDashboard();
  }

  function updateDeveloperDashboard() {
    const loggedIn = !!currentUser;
    const month = loggedIn ? '₩124,500' : '₩0';
    const total = loggedIn ? '₩892,000' : '₩0';
    const count = loggedIn ? '3' : '0';
    const m = $('#dev-revenue-month');
    const t = $('#dev-revenue-total');
    const c = $('#dev-creations-count');
    if (m) m.textContent = month;
    if (t) t.textContent = total;
    if (c) c.textContent = count;
  }

  function bindDownloadBtn() {
    const handleDownload = (e) => {
      e.preventDefault();
      window.SuperAdmin?.incrementDownloadCount();
      const info = window.SuperAdmin?.getDownloadInfo?.();
      if (info?.url && info.url !== '#') {
        window.open(info.url, '_blank');
      }
      showToast(`${info?.version || 'ToyTools v1.0'} 다운로드를 시작합니다.`);
    };
    $('#download-btn')?.addEventListener('click', handleDownload);
    $('#resources-download-btn')?.addEventListener('click', handleDownload);
    const btn = $('#download-btn');
    if (btn) {
      btn.addEventListener('mousedown', () => btn.classList.add('pressed'));
      btn.addEventListener('mouseup', () => btn.classList.remove('pressed'));
      btn.addEventListener('mouseleave', () => btn.classList.remove('pressed'));
    }
  }

  // ═══════════════════ UTILS ═══════════════════
  function escapeHtml(str) {
    const el = document.createElement('div');
    el.textContent = str;
    return el.innerHTML;
  }

  function isSafeImageSrc(src) {
    return /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(src)
      || /^https:\/\/[^\s"'<>]+$/i.test(src);
  }

  function renderPostBody(body) {
    if (!body) return '';
    const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let html = '';
    let last = 0;
    let m;
    while ((m = imgRe.exec(body)) !== null) {
      html += escapeHtml(body.slice(last, m.index)).replace(/\n/g, '<br>');
      const alt = escapeHtml(m[1]);
      const src = m[2];
      if (isSafeImageSrc(src)) {
        const safeSrc = src.replace(/"/g, '&quot;');
        html += `<img src="${safeSrc}" alt="${alt}" class="post-inline-img" loading="lazy" />`;
      } else {
        html += escapeHtml(m[0]);
      }
      last = m.index + m[0].length;
    }
    html += escapeHtml(body.slice(last)).replace(/\n/g, '<br>');
    return html;
  }

  function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatDateTime(d) {
    return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function showToast(msg) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
    const anyOpen = [...document.querySelectorAll('.modal')].some((m) => !m.classList.contains('hidden'));
    if (!anyOpen) document.body.style.overflow = '';
  }

  // ── Bridge for Super Admin Dashboard ──
  window.ToyToolsBridge = {
    $, $$, escapeHtml, showToast, formatDate, formatDateTime,
    navigateTo,
    openModal,
    closeModal,
    isAdmin: () => isAdmin,
    getBoards: () => boards,
    getChangelogDefault: () => CHANGELOG,
    getFaqDefault: () => FAQ_ITEMS,
    SKINS, MINIGAMES, EXTENSIONS,
    adminPostNotice,
    adminCreateBoard,
    adminDeleteBoard,
    adminDeletePost,
    adminDeletePostsByNick,
    renderToyMarket,
    renderResources,
  };

  // ── Boot ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init().then(handlePaymentCallback));
  } else {
    init().then(handlePaymentCallback);
  }
})();

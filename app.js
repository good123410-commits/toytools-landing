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
  let viewingPostId = null;
  let currentBoardId = null;
  let boards = [];
  let posts = [];
  let postsUnsubscribe = null;
  let selectedChargeAmount = 0;
  let tossPayments = null;

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
    { id: 'bear', emoji: '🧸', name: '곰인형 스킨팩', gen: '3세대', price: 3000, desc: '따뜻한 브라운 톤과 봉제 인형 텍스처.', bg: 'linear-gradient(135deg, #D4A574, #8B6914)' },
    { id: 'lollipop', emoji: '🍭', name: '롤리팝 스킨팩', gen: '3세대', price: 5000, desc: '파스텔 그라데이션과 캔디 컬러.', bg: 'linear-gradient(135deg, #FF6B9D, #FFE566, #00D4FF)' },
    { id: 'arcade', emoji: '👾', name: '레트로 아케이드 스킨팩', gen: '3세대', price: 7000, desc: '네온 픽셀 아트와 CRT 스캔라인.', bg: 'linear-gradient(135deg, #1a1a2e, #9B5DE5, #00D4FF)' },
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
    renderSkinCards();
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
        renderSkinCards();
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
      ['#header-cash', '#mobile-cash'].forEach((s) => { const el = $(s); if (el) el.textContent = `💰 ${cash}P`; });
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
        showToast('로그인 성공! 🧸');
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
        showToast('회원가입 완료! 환영합니다 🎉');
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
      showToast(`🧪 테스트 결제 완료! +${selectedChargeAmount.toLocaleString()}P`);
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
    renderSkinCards();
    showToast(`${skin.name} 구매 완료! 🎉`);
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
    renderAdminBoardList();
    updateAdminNoticeBoardSelect();
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
    subscribePosts(boardId);
    viewingPostId = null;
    $('#board-detail')?.classList.add('hidden');
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
        if (isAdmin) renderAdminRecentPosts();
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
            <span class="font-medium ${p.isNotice ? 'text-toy-purple' : 'text-gray-800'}">${escapeHtml(p.title)}</span>
            ${commentCount > 0 ? `<span class="text-toy-pink text-xs ml-1">[${commentCount}]</span>` : ''}
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

    const detail = $('#board-detail');
    const content = $('#board-detail-content');
    if (!detail || !content) return;

    const catClass = CAT_CLASS[post.cat] || 'cat-chat';
    const adminBtns = isAdmin ? `
      <button class="admin-delete-btn" id="admin-delete-post"><i data-lucide="trash-2" class="w-3 h-3"></i> 관리자 삭제 (글)</button>
    ` : '';

    content.innerHTML = `
      <span class="cat-tag ${catClass}">${escapeHtml(post.cat)}</span>
      ${post.isNotice ? '<span class="post-notice-badge ml-1">공지</span>' : ''}
      <h2 class="board-post-title mt-2">${escapeHtml(post.title)}</h2>
      <div class="board-post-meta">
        <span>✏️ ${escapeHtml(post.nick)}</span>
        <span>📅 ${post.date || ''}</span>
        <span>👁 ${(post.views || 0) + 1}</span>
      </div>
      <div class="board-post-body">${escapeHtml(post.body)}</div>
      ${adminBtns}
    `;
    lucide.createIcons();

    $('#admin-delete-post')?.addEventListener('click', () => adminDeletePost(id));

    renderComments(post);
    detail.classList.remove('hidden');
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          <p class="text-gray-700">${escapeHtml(c.body)}</p>
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
    $('#board-write-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nick = $('#write-nick').value.trim() || '익명';
      const pw = $('#write-pw').value;
      const cat = $('#write-cat').value;
      const title = $('#write-title').value.trim();
      const body = $('#write-body').value.trim();
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
      e.target.reset();
      showToast('게시글이 등록되었습니다! 🎉');
    });

    $('#board-back-btn')?.addEventListener('click', () => {
      viewingPostId = null;
      $('#board-detail')?.classList.add('hidden');
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
        showToast('👑 관리자 모드 활성화');
        e.target.reset();
      } else {
        showToast('비밀번호가 올바르지 않습니다.');
      }
    });

    $('#admin-board-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#admin-board-name').value.trim();
      if (!name) return;
      const id = 'board_' + Date.now();
      const newBoard = { name, categories: ['일반'], order: boards.length + 1 };

      if (firebaseReady && db) {
        await db.collection('boards').doc(id).set(newBoard);
      } else {
        boards.push({ id, ...newBoard });
      }
      await loadBoards();
      $('#admin-board-name').value = '';
      showToast(`게시판 "${name}" 생성 완료`);
    });

    $('#admin-notice-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const boardId = $('#admin-notice-board').value;
      const title = $('#admin-notice-title').value.trim();
      const body = $('#admin-notice-body').value.trim();
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
        comments: [],
        createdAt: firebaseReady ? firebase.firestore.FieldValue.serverTimestamp() : Date.now(),
      };

      if (firebaseReady && db) {
        await db.collection('posts').add(postData);
      } else {
        if (boardId === currentBoardId) {
          posts.unshift({ id: 'notice_' + Date.now(), ...postData });
          saveLocalPosts();
          renderBoard();
        }
      }
      e.target.reset();
      showToast('📢 공지사항이 등록되었습니다.');
    });
  }

  function updateAdminUI() {
    const show = isAdmin ? 'remove' : 'add';
    $('#admin-nav-link')?.classList[show]('hidden');
    $('#admin-mobile-nav')?.classList[show]('hidden');
    if (isAdmin) renderAdminBoardList();
  }

  function renderAdminBoardList() {
    const container = $('#admin-board-list');
    if (!container) return;
    container.innerHTML = boards.map((b) => `
      <div class="admin-board-item">
        <span>📋 ${escapeHtml(b.name)} <span class="text-gray-400 text-xs">(${b.id})</span></span>
        ${b.id !== 'notice' ? `<button data-delete-board="${b.id}">삭제</button>` : '<span class="text-xs text-gray-400">기본</span>'}
      </div>
    `).join('') || '<p class="text-sm text-gray-400">게시판이 없습니다.</p>';

    container.querySelectorAll('[data-delete-board]').forEach((btn) => {
      btn.addEventListener('click', () => adminDeleteBoard(btn.dataset.deleteBoard));
    });
  }

  function updateAdminNoticeBoardSelect() {
    const sel = $('#admin-notice-board');
    if (!sel) return;
    sel.innerHTML = boards.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  }

  function renderAdminRecentPosts() {
    const container = $('#admin-recent-posts');
    if (!container || !isAdmin) return;
    const recent = posts.slice(0, 10);
    container.innerHTML = recent.map((p) => `
      <div class="admin-board-item">
        <span class="truncate flex-1 mr-2">${p.isNotice ? '📢' : '💬'} ${escapeHtml(p.title)}</span>
        <button data-admin-del-post="${p.id}">삭제</button>
      </div>
    `).join('') || '<p class="text-sm text-gray-400">게시글이 없습니다.</p>';

    container.querySelectorAll('[data-admin-del-post]').forEach((btn) => {
      btn.addEventListener('click', () => adminDeletePost(btn.dataset.adminDelPost));
    });
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

  async function adminDeletePost(postId) {
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return;
    if (firebaseReady && db) {
      await db.collection('posts').doc(postId).delete();
    } else {
      posts = posts.filter((p) => p.id !== postId);
      saveLocalPosts();
      renderBoard();
    }
    viewingPostId = null;
    $('#board-detail')?.classList.add('hidden');
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
  }

  // ═══════════════════ NAVIGATION ═══════════════════
  function navigateTo(section) {
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

    if (section !== (window.location.hash.replace('#', '') || 'home')) {
      window.location.hash = section === 'home' ? '' : section;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    closeMobileMenu();
    viewingPostId = null;
    $('#board-detail')?.classList.add('hidden');

    if (section === 'admin' && isAdmin) {
      renderAdminBoardList();
      renderAdminRecentPosts();
    }
  }

  function handleHashRoute() {
    const hash = window.location.hash.replace('#', '') || 'home';
    const valid = ['home', 'toys', 'devlog', 'board', 'skins', 'admin'];
    navigateTo(valid.includes(hash) ? hash : 'home');
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
      <h2 class="font-display text-xl sm:text-2xl text-toy-brown mb-3">${escapeHtml(post.title)}</h2>
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

  function renderSkinCards() {
    const container = $('#skin-cards');
    if (!container) return;
    const owned = userProfile?.ownedSkins || [];
    container.innerHTML = SKINS.map((s) => {
      const hasOwned = owned.includes(s.id);
      return `
        <div class="skin-card">
          <div class="skin-card-preview" style="background:${s.bg}">${s.emoji}</div>
          <div class="skin-card-info">
            <h3 class="skin-card-name">${escapeHtml(s.name)}</h3>
            <span class="skin-card-gen">${s.gen}</span>
            <p class="skin-card-desc">${escapeHtml(s.desc)}</p>
            <p class="text-sm font-bold text-toy-pink mt-2">${s.price.toLocaleString()}P</p>
            ${hasOwned
              ? '<span class="skin-owned-label">✅ 보유 중</span>'
              : `<button class="toy-btn-3d toy-btn-3d-sm skin-buy-btn justify-center" data-buy-skin="${s.id}">구매하기</button>`
            }
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-buy-skin]').forEach((btn) => {
      btn.addEventListener('click', () => buySkin(btn.dataset.buySkin));
    });
  }

  function bindDownloadBtn() {
    const btn = $('#download-btn');
    if (!btn) return;
    btn.addEventListener('mousedown', () => btn.classList.add('pressed'));
    btn.addEventListener('mouseup', () => btn.classList.remove('pressed'));
    btn.addEventListener('mouseleave', () => btn.classList.remove('pressed'));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('🧸 ToyTools v1.0 다운로드 준비 중입니다!');
    });
  }

  // ═══════════════════ UTILS ═══════════════════
  function escapeHtml(str) {
    const el = document.createElement('div');
    el.textContent = str;
    return el.innerHTML;
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

  // ── Boot ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init().then(handlePaymentCallback));
  } else {
    init().then(handlePaymentCallback);
  }
})();

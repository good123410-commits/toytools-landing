/* ═══════════════════════════════════════════
   ToyTools — Main Application (SPA)
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  // ── State ──
  let boardFilter = 'all';
  let viewingPostId = null;

  const STORAGE_KEY = 'toytools_board';

  const CAT_CLASS = {
    '잡담': 'cat-chat',
    '스킨자랑': 'cat-skin',
    '건의/버그': 'cat-bug',
    '자랑거리': 'cat-brag',
  };

  // ── Mock Data: Toys ──
  const TOYS = [
    {
      icon: '🎬',
      title: '쇼츠 메이커',
      desc: '영상 클립을 자동으로 쇼츠 포맷으로 변환. 드래그 앤 드롭만으로 OK!',
      tag: '영상',
      accent: '#FF6B9D',
    },
    {
      icon: '🕷️',
      title: '초고속 크롤러',
      desc: '웹 데이터를 장난감처럼 쉽게 수집. 복잡한 설정은 이제 그만.',
      tag: '데이터',
      accent: '#00D4FF',
    },
    {
      icon: '🛡️',
      title: '디스크 가디언',
      desc: '디스크 용량을 실시간 모니터링하고 불필요한 파일을 척척 정리.',
      tag: '유틸',
      accent: '#7BED9F',
    },
    {
      icon: '🖼️',
      title: 'WPC 변환기',
      desc: 'Windows Photo Cache를 일반 이미지로 빠르게 변환하는 마법 상자.',
      tag: '이미지',
      accent: '#FF9F43',
    },
  ];

  // ── Mock Data: Dev Logs ──
  const DEVLOGS = [
    {
      id: 1,
      emoji: '🏗️',
      title: 'ToyTools v1.0 — 디지털 장난감 공장, 드디어 문을 엽니다',
      date: '2026-07-15',
      views: 1284,
      comments: 23,
      from: '#FFE0EC',
      to: '#E0F7FF',
      body: `안녕하세요, ToyTools 디렉터입니다!\n\n드디어 v1.0 정식 출시를 앞두고 있습니다. "AI가 판치는 세상에서 가장 아날로그한 디지털 도구"라는 컨셉으로 1년 넘게 달려왔는데, 이제 여러분 손에 쥐어드릴 때가 왔습니다.\n\n이번 버전에 포함된 내장 장난감:\n• 쇼츠 메이커 — 영상 클립 자동 변환\n• 초고속 크롤러 — 원클릭 웹 데이터 수집\n• 디스크 가디언 — 용량 관리 & 정리\n• WPC 변환기 — 캐시 이미지 추출\n\n모두 무설치 포터블 .exe로 제공됩니다. Windows 10/11에서 바로 실행하세요!`,
    },
    {
      id: 2,
      emoji: '🎨',
      title: '스킨 제작기 비하인드 — 3세대 스킨팩은 어떻게 탄생했나',
      date: '2026-07-08',
      views: 892,
      comments: 15,
      from: '#F3E8FF',
      to: '#FFE0EC',
      body: `3세대 스킨팩(곰인형, 롤리팝, 레트로 아케이드)을 만들면서 가장 중요하게 생각한 건 "키치하지만 촌스럽지 않게"였습니다.\n\n80-90년대 장난감 가게의 따뜻한 느낌을 현대적인 UI 인터랙션과 결합했어요. 스킨 제작기를 통해 여러분도 직접 나만의 스킨을 만들 수 있습니다.\n\n다음 업데이트에서 스킨 마켓 공유 기능도 추가할 예정이니 기대해 주세요!`,
    },
    {
      id: 3,
      emoji: '🔧',
      title: '개발 현황 #12 — 크롤러 속도 3배 개선 & 메모리 최적화',
      date: '2026-06-28',
      views: 567,
      comments: 8,
      from: '#E0F7FF',
      to: '#D1FAE5',
      body: `이번 스프린트에서 초고속 크롤러의 핵심 엔진을 전면 개편했습니다.\n\n주요 변경사항:\n• 비동기 파이프라인 도입 → 수집 속도 3배 향상\n• 메모리 사용량 40% 감소\n• 대용량 사이트 크롤링 시 안정성 개선\n• UI에 실시간 진행률 바 추가\n\n베타 테스터 분들 감사합니다. 건의해 주신 피드백이 큰 도움이 됐어요!`,
    },
    {
      id: 4,
      emoji: '💡',
      title: '왜 "장난감"인가? — ToyTools 철학 이야기',
      date: '2026-06-10',
      views: 1103,
      comments: 31,
      from: '#FEF3C7',
      to: '#FFE0EC',
      body: `"도구는 어렵다"는 고정관념을 깨고 싶었습니다.\n\nToyTools의 모든 기능은 장난감 상자에서 꺼내 드는 것처럼 직관적이어야 합니다. 설치도, 설정도, 매뉴얼도 최소화 — 그냥 켜고 바로 놀면 됩니다.\n\n이 웹사이트도 같은 철학으로 만들었어요. 개발일지로 만드는 이야기를 나누고, 자유게시판에서 익명으로 수다 떨고, 스킨 마켓에서 꾸미고.\n\n여러분의 놀이터가 되길 바랍니다. 🧸`,
    },
    {
      id: 5,
      emoji: '🖥️',
      title: 'toy-tools.com 웹사이트 제작 시작! — 커뮤니티 놀이터 오픈',
      date: '2026-07-20',
      views: 42,
      comments: 3,
      from: '#FFE0EC',
      to: '#F3E8FF',
      body: `드디어 공식 웹사이트 toy-tools.com의 메인 코드 작성을 시작합니다!\n\n이 사이트는 단순한 제품 소개 페이지가 아니라:\n• 📝 디렉터의 개발일지 블로그\n• 💬 디시 스타일 익명 자유게시판\n• 🎨 스킨 마켓 프리뷰\n\n이 모든 게 결합된 "유저 놀이터 커뮤니티 사이트"입니다.\n\n레트로 장난감 가게 감성 + 80-90년대 키치 디자인 + 현대적 인터랙션. 곧 만나요!`,
    },
    {
      id: 6,
      emoji: '🍭',
      title: '롤리팝 스킨팩 티저 — 달콤한 UI가 온다',
      date: '2026-05-22',
      views: 734,
      comments: 19,
      from: '#FFE0EC',
      to: '#FEF3C7',
      body: `3세대 스킨팩 중 가장 화제인 "롤리팝" 스킨의 티저를 공개합니다!\n\n파스텔 그라데이션 + 둥근 모서리 + 쫀득한 버튼 애니메이션이 특징이에요. 마치 90년대 캔디 가게에 들어간 듯한 느낌!\n\n정식 출시는 v1.0과 함께합니다. 어떤 스킨이 가장 기대되시나요? 자유게시판에 남겨주세요!`,
    },
  ];

  // ── Mock Data: Skins ──
  const SKINS = [
    {
      emoji: '🧸',
      name: '곰인형 스킨팩',
      gen: '3세대',
      desc: '따뜻한 브라운 톤과 봉제 인형 텍스처. 포근한 느낌의 클래식 스킨.',
      bg: 'linear-gradient(135deg, #D4A574, #8B6914)',
    },
    {
      emoji: '🍭',
      name: '롤리팝 스킨팩',
      gen: '3세대',
      desc: '파스텔 그라데이션과 캔디 컬러. 달콤하고 키치한 90년대 감성.',
      bg: 'linear-gradient(135deg, #FF6B9D, #FFE566, #00D4FF)',
    },
    {
      emoji: '👾',
      name: '레트로 아케이드 스킨팩',
      gen: '3세대',
      desc: '네온 픽셀 아트와 CRT 스캔라인. 80년대 오락실로 타임슬립!',
      bg: 'linear-gradient(135deg, #1a1a2e, #9B5DE5, #00D4FF)',
    },
  ];

  // ── Default Board Posts ──
  function getDefaultPosts() {
    return [
      {
        id: 1,
        nick: '장난감초보',
        pw: '1234',
        cat: '잡담',
        title: 'ToyTools 처음 써봤는데 진짜 쉽네요 ㅋㅋ',
        body: '쇼츠 메이커 써봤는데 드래그만 하면 끝이더라고요. 이런 거 찾고 있었는데 감사합니다!',
        date: '2026-07-18',
        views: 156,
        comments: [
          { nick: '익명', body: '인정 ㅋㅋ 나도 어제 처음 써봤는데', time: '2026-07-18 14:32' },
          { nick: '스킨덕후', body: '롤리팝 스킨이랑 같이 쓰면 더 예쁨', time: '2026-07-18 15:01' },
        ],
      },
      {
        id: 2,
        nick: '스킨덕후',
        pw: '1234',
        cat: '스킨자랑',
        title: '[자랑] 곰인형 스킨 커스텀 완성했습니다',
        body: '스킨 제작기로 곰인형 베이스에 제만의 컬러 조합 넣었어요. 스크린샷 첨부는 못하지만 진짜 귀여움 ㅠㅠ',
        date: '2026-07-17',
        views: 243,
        comments: [
          { nick: 'ㅇㅇ', body: '오 대박 부럽다', time: '2026-07-17 20:15' },
        ],
      },
      {
        id: 3,
        nick: '버그헌터',
        pw: '1234',
        cat: '건의/버그',
        title: '크롤러에서 특정 사이트 크롤링 시 멈춤 현상',
        body: '네이버 블로그 크롤링할 때 50페이지 넘어가면 가끔 멈추는데 확인 부탁드립니다. Win11 환경이에요.',
        date: '2026-07-16',
        views: 89,
        comments: [],
      },
      {
        id: 4,
        nick: '자랑하는고양이',
        pw: '1234',
        cat: '자랑거리',
        title: 'ToyTools로 만든 쇼츠 100만뷰 달성!',
        body: '쇼츠 메이커 덕분에 유튜브 쇼츠 채널 운영이 훨씬 쉬워졌어요. 3개월 만에 100만뷰 찍었습니다 감사합니다 🎉',
        date: '2026-07-14',
        views: 512,
        comments: [
          { nick: '익명', body: '대박 축하드려요!!', time: '2026-07-14 09:22' },
          { nick: '장난감초보', body: '나도 열심히 해봐야지', time: '2026-07-14 11:05' },
          { nick: 'ㅇㅇ', body: '채널 링크 있나요?', time: '2026-07-14 12:30' },
        ],
      },
    ];
  }

  // ── Storage helpers ──
  function loadPosts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    const defaults = getDefaultPosts();
    savePosts(defaults);
    return defaults;
  }

  function savePosts(posts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  }

  // ── DOM refs ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ═══════════════════ INIT ═══════════════════
  function init() {
    lucide.createIcons();
    renderToyCards();
    renderDevLogs();
    renderSkinCards();
    renderBoard();
    bindNavigation();
    bindMobileMenu();
    bindBoardEvents();
    bindDevlogModal();
    bindDownloadBtn();
    handleHashRoute();
    window.addEventListener('hashchange', handleHashRoute);
  }

  // ═══════════════════ NAVIGATION (SPA) ═══════════════════
  function navigateTo(section) {
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
  }

  function handleHashRoute() {
    const hash = window.location.hash.replace('#', '') || 'home';
    const valid = ['home', 'toys', 'devlog', 'board', 'skins'];
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

  // ═══════════════════ RENDER: TOYS ═══════════════════
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

  // ═══════════════════ RENDER: DEV LOGS ═══════════════════
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
      card.addEventListener('click', () => {
        openDevlogModal(Number(card.dataset.id));
      });
    });
  }

  function openDevlogModal(id) {
    const post = DEVLOGS.find((d) => d.id === id);
    if (!post) return;
    const modal = $('#devlog-modal');
    const body = $('#devlog-modal-body');
    if (!modal || !body) return;

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

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function bindDevlogModal() {
    const modal = $('#devlog-modal');
    if (!modal) return;
    modal.querySelector('.modal-backdrop')?.addEventListener('click', closeDevlogModal);
    modal.querySelector('.modal-close')?.addEventListener('click', closeDevlogModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDevlogModal();
    });
  }

  function closeDevlogModal() {
    $('#devlog-modal')?.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ═══════════════════ RENDER: SKINS ═══════════════════
  function renderSkinCards() {
    const container = $('#skin-cards');
    if (!container) return;
    container.innerHTML = SKINS.map((s) => `
      <div class="skin-card">
        <div class="skin-card-preview" style="background:${s.bg}">${s.emoji}</div>
        <div class="skin-card-info">
          <h3 class="skin-card-name">${escapeHtml(s.name)}</h3>
          <span class="skin-card-gen">${s.gen}</span>
          <p class="skin-card-desc">${escapeHtml(s.desc)}</p>
        </div>
      </div>
    `).join('');
  }

  // ═══════════════════ BOARD ═══════════════════
  function renderBoard() {
    const posts = loadPosts();
    const filtered = boardFilter === 'all'
      ? posts
      : posts.filter((p) => p.cat === boardFilter);

    const tbody = $('#board-tbody');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">게시글이 없습니다. 첫 글을 작성해 보세요!</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map((p, i) => {
      const catClass = CAT_CLASS[p.cat] || 'cat-chat';
      const commentCount = (p.comments || []).length;
      return `
        <tr data-id="${p.id}">
          <td class="hidden sm:table-cell text-gray-400 text-center">${filtered.length - i}</td>
          <td class="hidden md:table-cell"><span class="cat-tag ${catClass}">${escapeHtml(p.cat)}</span></td>
          <td>
            <span class="md:hidden cat-tag ${catClass} mr-1">${escapeHtml(p.cat)}</span>
            <span class="font-medium text-gray-800">${escapeHtml(p.title)}</span>
            ${commentCount > 0 ? `<span class="text-toy-pink text-xs ml-1">[${commentCount}]</span>` : ''}
          </td>
          <td class="hidden sm:table-cell text-gray-500">${escapeHtml(p.nick)}</td>
          <td class="hidden md:table-cell text-gray-400 text-xs">${p.date.slice(5)}</td>
          <td class="hidden lg:table-cell text-gray-400 text-center">${p.views}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach((row) => {
      row.addEventListener('click', () => openPostDetail(Number(row.dataset.id)));
    });
  }

  function openPostDetail(id) {
    const posts = loadPosts();
    const post = posts.find((p) => p.id === id);
    if (!post) return;

    post.views = (post.views || 0) + 1;
    savePosts(posts);
    viewingPostId = id;

    const detail = $('#board-detail');
    const content = $('#board-detail-content');
    if (!detail || !content) return;

    const catClass = CAT_CLASS[post.cat] || 'cat-chat';
    content.innerHTML = `
      <span class="cat-tag ${catClass}">${escapeHtml(post.cat)}</span>
      <h2 class="board-post-title mt-2">${escapeHtml(post.title)}</h2>
      <div class="board-post-meta">
        <span>✏️ ${escapeHtml(post.nick)}</span>
        <span>📅 ${post.date}</span>
        <span>👁 ${post.views}</span>
      </div>
      <div class="board-post-body">${escapeHtml(post.body)}</div>
    `;

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
      list.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>';
      return;
    }

    list.innerHTML = comments.map((c) => `
      <div class="comment-item">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="comment-nick">${escapeHtml(c.nick)}</span>
            <span class="comment-time">${c.time}</span>
          </div>
          <p class="text-gray-700">${escapeHtml(c.body)}</p>
        </div>
      </div>
    `).join('');
  }

  function bindBoardEvents() {
    $$('.board-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.board-filter').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        boardFilter = btn.dataset.cat;
        renderBoard();
      });
    });

    $('#board-write-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nick = $('#write-nick').value.trim() || '익명';
      const pw = $('#write-pw').value;
      const cat = $('#write-cat').value;
      const title = $('#write-title').value.trim();
      const body = $('#write-body').value.trim();

      if (!title || !body || !pw) {
        showToast('모든 필드를 입력해 주세요.');
        return;
      }

      const posts = loadPosts();
      const newId = posts.reduce((max, p) => Math.max(max, p.id), 0) + 1;
      posts.unshift({
        id: newId,
        nick,
        pw,
        cat,
        title,
        body,
        date: formatDate(new Date()),
        views: 0,
        comments: [],
      });
      savePosts(posts);
      renderBoard();
      e.target.reset();
      showToast('게시글이 등록되었습니다! 🎉');
    });

    $('#board-back-btn')?.addEventListener('click', () => {
      viewingPostId = null;
      $('#board-detail')?.classList.add('hidden');
    });

    $('#comment-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!viewingPostId) return;

      const nick = $('#comment-nick').value.trim() || '익명';
      const body = $('#comment-body').value.trim();
      if (!body) return;

      const posts = loadPosts();
      const post = posts.find((p) => p.id === viewingPostId);
      if (!post) return;

      if (!post.comments) post.comments = [];
      post.comments.push({ nick, body, time: formatDateTime(new Date()) });
      savePosts(posts);
      renderComments(post);
      $('#comment-body').value = '';
      showToast('댓글이 등록되었습니다!');
    });
  }

  // ═══════════════════ DOWNLOAD BUTTON ═══════════════════
  function bindDownloadBtn() {
    const btn = $('#download-btn');
    if (!btn) return;

    btn.addEventListener('mousedown', () => btn.classList.add('pressed'));
    btn.addEventListener('mouseup', () => btn.classList.remove('pressed'));
    btn.addEventListener('mouseleave', () => btn.classList.remove('pressed'));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('🧸 ToyTools v1.0 다운로드 준비 중입니다! 곧 만나요~');
    });
  }

  // ═══════════════════ UTILS ═══════════════════
  function escapeHtml(str) {
    const el = document.createElement('div');
    el.textContent = str;
    return el.innerHTML;
  }

  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDateTime(d) {
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${formatDate(d)} ${h}:${min}`;
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
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

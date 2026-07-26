/**
 * ToyTools Super Admin Dashboard
 * Requires window.ToyToolsBridge from app.js
 */
(function () {
  const KEYS = {
    market: 'toytools_sadmin_market',
    users: 'toytools_sadmin_users',
    inquiries: 'toytools_sadmin_inquiries',
    payouts: 'toytools_sadmin_payouts',
    settings: 'toytools_sadmin_settings',
    blacklist: 'toytools_sadmin_blacklist',
    muted: 'toytools_sadmin_muted',
    changelog: 'toytools_sadmin_changelog',
    faq: 'toytools_sadmin_faq',
    download: 'toytools_sadmin_download',
    downloadsToday: 'toytools_downloads_today',
    devSubmissions: 'toytools_dev_submissions',
  };

  let B = null;
  let currentTab = 'overview';
  let marketFilter = 'all';
  let marketStatus = 'all';
  let communityBoard = 'all';
  let userFilter = 'all';
  let userSearch = '';
  let payoutFilter = 'pending';
  let pendingConfirm = null;

  function init() {
    B = window.ToyToolsBridge;
    if (!B) return;
    bindNav();
    bindModals();
    if (B.isAdmin()) renderPanel();
  }

  function bindNav() {
    document.querySelectorAll('[data-sadmin-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setTab(btn.dataset.sadminTab));
    });
    document.querySelector('.sadmin-sidebar-exit')?.addEventListener('click', (e) => {
      e.preventDefault();
      B.navigateTo('home');
    });
  }

  function bindModals() {
    document.querySelectorAll('[data-sadmin-confirm-cancel]').forEach((el) => {
      el.addEventListener('click', closeConfirm);
    });
    document.getElementById('sadmin-confirm-ok')?.addEventListener('click', () => {
      const fn = pendingConfirm;
      closeConfirm();
      if (fn) fn();
    });
    document.querySelectorAll('[data-sadmin-user-close]').forEach((el) => {
      el.addEventListener('click', () => B.closeModal('modal-sadmin-user'));
    });
    document.querySelectorAll('[data-sadmin-item-close]').forEach((el) => {
      el.addEventListener('click', () => B.closeModal('modal-sadmin-item'));
    });
  }

  function setTab(tab, updateHash = true) {
    currentTab = tab;
    document.querySelectorAll('[data-sadmin-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.sadminTab === tab);
    });
    renderPanel();
    if (updateHash) B.navigateTo('admin', tab === 'overview' ? null : tab);
    lucide.createIcons();
  }

  function renderPanel() {
    const el = document.getElementById('sadmin-content');
    if (!el) return;
    const renderers = {
      overview: renderOverview,
      marketplace: renderMarketplace,
      community: renderCommunity,
      downloads: renderDownloads,
      users: renderUsers,
      developers: renderDevelopers,
      settings: renderSettings,
    };
    (renderers[currentTab] || renderOverview)(el);
    lucide.createIcons();
  }

  // ── Storage helpers ──
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function getMarketItems() {
    let items = load(KEYS.market, null);
    if (!items) {
      items = [];
      const add = (list, type) => list.forEach((i) => {
        items.push({
          id: i.id,
          type,
          name: i.name,
          desc: i.desc,
          price: i.price,
          emoji: i.emoji,
          bg: i.bg,
          tag: i.gen || i.tag || '',
          status: 'approved',
          active: true,
          creator: 'ToyTools',
          submittedAt: Date.now(),
        });
      });
      add(B.SKINS, 'skin');
      add(B.MINIGAMES, 'game');
      add(B.EXTENSIONS, 'extension');
      save(KEYS.market, items);
    }
    return items;
  }

  function saveMarketItems(items) {
    save(KEYS.market, items);
    B.renderToyMarket?.();
  }

  function getUsers() {
    let users = load(KEYS.users, null);
    if (!users) {
      users = [
        { id: 'u1', nick: '장난감초보', email: 'demo1@toy-tools.com', cash: 12500, status: 'normal', joinedAt: '2026-06-15', role: 'user' },
        { id: 'u2', nick: '스킨마스터', email: 'creator@toy-tools.com', cash: 48200, status: 'normal', joinedAt: '2026-05-20', role: 'creator' },
        { id: 'u3', nick: '악성유저99', email: 'bad@example.com', cash: 0, status: 'banned', joinedAt: '2026-07-01', role: 'user' },
        { id: 'u4', nick: '탈퇴회원', email: 'left@example.com', cash: 0, status: 'withdrawn', joinedAt: '2026-04-10', role: 'user' },
      ];
      save(KEYS.users, users);
    }
    return users;
  }

  function saveUsers(users) {
    save(KEYS.users, users);
  }

  function getStats() {
    const users = getUsers();
    const market = getMarketItems();
    const posts = getAllPosts();
    const pendingMarket = market.filter((i) => i.status === 'pending').length;
    const totalCoins = users.filter((u) => u.status === 'normal').reduce((s, u) => s + (u.cash || 0), 0);
    const dl = load(KEYS.downloadsToday, { date: B.formatDate(new Date()), count: 42 });
    const today = B.formatDate(new Date());
    if (dl.date !== today) {
      dl.date = today;
      dl.count = Math.floor(Math.random() * 30) + 15;
      save(KEYS.downloadsToday, dl);
    }
    return {
      totalUsers: users.filter((u) => u.status !== 'withdrawn').length,
      newPosts: posts.filter((p) => (p.date || '').startsWith(today.slice(0, 7))).length,
      pendingReview: pendingMarket + getDevSubmissions().filter((s) => s.status === 'pending').length,
      totalCoins,
      dailyDownloads: dl.count,
    };
  }

  function getAllPosts() {
    const boards = B.getBoards();
    let all = [];
    boards.forEach((b) => {
      try {
        const raw = localStorage.getItem(`toytools_posts_${b.id}`);
        if (raw) {
          JSON.parse(raw).forEach((p) => all.push({ ...p, boardId: b.id, boardName: b.name }));
        }
      } catch (_) { /* ignore */ }
    });
    all.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const tb = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return tb - ta;
    });
    return all;
  }

  function getDevSubmissions() {
    return load(KEYS.devSubmissions, []);
  }

  function getInquiries() {
    return load(KEYS.inquiries, []);
  }

  function getPayouts() {
    let payouts = load(KEYS.payouts, null);
    if (!payouts) {
      payouts = [
        { id: 'pay1', nick: '스킨마스터', email: 'creator@toy-tools.com', amount: 50000, coins: 50000, status: 'pending', requestedAt: '2026-07-25' },
        { id: 'pay2', nick: '크리에이터A', email: 'a@example.com', amount: 12000, coins: 12000, status: 'approved', requestedAt: '2026-07-20' },
      ];
      save(KEYS.payouts, payouts);
    }
    return payouts;
  }

  function getBlacklist() {
    return load(KEYS.blacklist, []);
  }

  function getMuted() {
    return load(KEYS.muted, []);
  }

  function getChangelog() {
    return load(KEYS.changelog, B.getChangelogDefault());
  }

  function getFaq() {
    return load(KEYS.faq, B.getFaqDefault());
  }

  function getDownloadInfo() {
    return load(KEYS.download, {
      version: 'v1.0.0',
      url: '#',
      notes: 'Windows 10/11 · 포터블 .exe · 무설치',
    });
  }

  function getSettings() {
    return load(KEYS.settings, {
      maintenance: false,
      registrationOpen: true,
      marketOpen: true,
      notice: '',
    });
  }

  // ── Confirm modal ──
  function confirmAction({ title, message, danger = false, onConfirm }) {
    document.getElementById('sadmin-confirm-title').textContent = title;
    document.getElementById('sadmin-confirm-message').textContent = message;
    const okBtn = document.getElementById('sadmin-confirm-ok');
    okBtn.textContent = danger ? '위험 작업 실행' : '확인';
    okBtn.className = danger ? 'sadmin-btn-danger justify-center' : 'sadmin-btn sadmin-btn-primary justify-center';
    pendingConfirm = onConfirm;
    B.openModal('modal-sadmin-confirm');
  }

  function closeConfirm() {
    pendingConfirm = null;
    B.closeModal('modal-sadmin-confirm');
  }

  // ── Overview ──
  function renderOverview(el) {
    const stats = getStats();
    const posts = getAllPosts().slice(0, 5);
    const pending = [
      ...getMarketItems().filter((i) => i.status === 'pending').map((i) => ({ type: 'market', label: `[마켓] ${i.name}`, id: i.id })),
      ...getDevSubmissions().filter((s) => s.status === 'pending').map((s) => ({ type: 'dev', label: `[개발자] ${s.name}`, id: s.id })),
      ...getInquiries().filter((q) => !q.answered).map((q) => ({ type: 'inquiry', label: `[문의] ${q.subject}`, id: q.id })),
    ].slice(0, 8);

    el.innerHTML = `
      <div class="sadmin-page-head">
        <h1 class="sadmin-page-title">개요 / 통계</h1>
        <p class="sadmin-page-desc">서비스 핵심 지표 및 긴급 처리 항목</p>
      </div>
      <div class="sadmin-stats">
        <div class="sadmin-stat-card"><span class="sadmin-stat-label">총 가입 유저</span><div class="sadmin-stat-value accent">${stats.totalUsers.toLocaleString()}</div></div>
        <div class="sadmin-stat-card"><span class="sadmin-stat-label">이번 달 게시물</span><div class="sadmin-stat-value">${stats.newPosts}</div></div>
        <div class="sadmin-stat-card"><span class="sadmin-stat-label">검수 대기</span><div class="sadmin-stat-value">${stats.pendingReview}</div></div>
        <div class="sadmin-stat-card"><span class="sadmin-stat-label">토이코인 유통량</span><div class="sadmin-stat-value">${stats.totalCoins.toLocaleString()}P</div></div>
        <div class="sadmin-stat-card"><span class="sadmin-stat-label">일일 다운로드</span><div class="sadmin-stat-value">${stats.dailyDownloads}</div></div>
      </div>
      <div class="sadmin-grid-2">
        <div class="sadmin-card">
          <h3 class="sadmin-card-title"><i data-lucide="file-text" class="w-4 h-4"></i> 최근 게시글</h3>
          <div class="sadmin-urgent-list">
            ${posts.length ? posts.map((p) => `
              <div class="sadmin-urgent-item">
                <span><span class="text-gray-500 text-xs">${B.escapeHtml(p.boardName || '')}</span> ${B.escapeHtml(p.title)}</span>
                <span class="text-xs text-gray-500">${p.date || ''}</span>
              </div>
            `).join('') : '<p class="sadmin-empty">게시글이 없습니다.</p>'}
          </div>
        </div>
        <div class="sadmin-card">
          <h3 class="sadmin-card-title"><i data-lucide="alert-triangle" class="w-4 h-4"></i> 검수 / 문의 대기</h3>
          <div class="sadmin-urgent-list">
            ${pending.length ? pending.map((p) => `
              <div class="sadmin-urgent-item urgent">
                <span>${B.escapeHtml(p.label)}</span>
                <button type="button" class="sadmin-btn sadmin-btn-primary" data-goto="${p.type}">처리</button>
              </div>
            `).join('') : '<p class="sadmin-empty">대기 항목이 없습니다.</p>'}
          </div>
        </div>
      </div>
    `;
    el.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const map = { market: 'marketplace', dev: 'developers', inquiry: 'downloads' };
        setTab(map[btn.dataset.goto] || 'overview');
      });
    });
  }

  // ── Marketplace ──
  function renderMarketplace(el) {
    let items = getMarketItems();
    if (marketFilter !== 'all') items = items.filter((i) => i.type === marketFilter);
    if (marketStatus !== 'all') items = items.filter((i) => i.status === marketStatus);

    const typeLabel = { skin: '스킨 팩', game: '미니게임', extension: '확장 팩' };

    el.innerHTML = `
      <div class="sadmin-page-head">
        <h1 class="sadmin-page-title">토이마켓 관리</h1>
        <p class="sadmin-page-desc">스킨 / 미니게임 / 확장팩 검수 및 노출 통제</p>
      </div>
      <div class="sadmin-subtabs" id="sadmin-market-type">
        <button type="button" class="sadmin-subtab${marketFilter === 'all' ? ' active' : ''}" data-mf="all">전체</button>
        <button type="button" class="sadmin-subtab${marketFilter === 'skin' ? ' active' : ''}" data-mf="skin">스킨 팩</button>
        <button type="button" class="sadmin-subtab${marketFilter === 'game' ? ' active' : ''}" data-mf="game">미니게임</button>
        <button type="button" class="sadmin-subtab${marketFilter === 'extension' ? ' active' : ''}" data-mf="extension">확장 팩</button>
      </div>
      <div class="sadmin-subtabs" id="sadmin-market-status">
        <button type="button" class="sadmin-subtab${marketStatus === 'all' ? ' active' : ''}" data-ms="all">전체 상태</button>
        <button type="button" class="sadmin-subtab${marketStatus === 'pending' ? ' active' : ''}" data-ms="pending">대기중</button>
        <button type="button" class="sadmin-subtab${marketStatus === 'approved' ? ' active' : ''}" data-ms="approved">승인됨</button>
        <button type="button" class="sadmin-subtab${marketStatus === 'rejected' ? ' active' : ''}" data-ms="rejected">반려됨</button>
      </div>
      <div class="sadmin-table-wrap">
        <table class="sadmin-table">
          <thead>
            <tr>
              <th>썸네일</th><th>이름</th><th>카테고리</th><th>가격</th><th>크리에이터</th><th>상태</th><th>노출</th><th>관리</th>
            </tr>
          </thead>
          <tbody>
            ${items.length ? items.map((item) => `
              <tr data-item-id="${item.id}">
                <td><div class="sadmin-item-thumb" style="background:${item.bg || '#1e293b'}">${item.emoji || '📦'}</div></td>
                <td><strong>${B.escapeHtml(item.name)}</strong><br><span class="text-xs text-gray-500">${B.escapeHtml((item.desc || '').slice(0, 40))}…</span></td>
                <td>${typeLabel[item.type] || item.type}</td>
                <td>${(item.price || 0).toLocaleString()}P</td>
                <td>${B.escapeHtml(item.creator || '-')}</td>
                <td><span class="sadmin-status sadmin-status-${item.status}">${statusLabel(item.status)}</span></td>
                <td>
                  <label class="sadmin-toggle" title="활성화/숨기기">
                    <input type="checkbox" data-toggle-active="${item.id}" ${item.active ? 'checked' : ''} ${item.status !== 'approved' ? 'disabled' : ''} />
                    <span class="sadmin-toggle-slider"></span>
                  </label>
                </td>
                <td>
                  <div class="sadmin-actions">
                    ${item.status === 'pending' ? `
                      <button type="button" class="sadmin-btn sadmin-btn-primary" data-approve="${item.id}">승인</button>
                      <button type="button" class="sadmin-btn" data-reject="${item.id}">반려</button>
                    ` : ''}
                    <button type="button" class="sadmin-btn" data-edit-item="${item.id}">수정</button>
                    <button type="button" class="sadmin-btn" data-dl-item="${item.id}">파일</button>
                    <button type="button" class="sadmin-btn" data-del-item="${item.id}">삭제</button>
                  </div>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="8" class="sadmin-empty">항목이 없습니다.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    el.querySelectorAll('[data-mf]').forEach((btn) => {
      btn.addEventListener('click', () => { marketFilter = btn.dataset.mf; renderMarketplace(el); });
    });
    el.querySelectorAll('[data-ms]').forEach((btn) => {
      btn.addEventListener('click', () => { marketStatus = btn.dataset.ms; renderMarketplace(el); });
    });
    el.querySelectorAll('[data-toggle-active]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const items = getMarketItems();
        const item = items.find((i) => i.id === inp.dataset.toggleActive);
        if (item) { item.active = inp.checked; saveMarketItems(items); B.showToast(item.active ? '노출 활성화' : '노출 숨김'); }
      });
    });
    el.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.addEventListener('click', () => updateMarketStatus(btn.dataset.approve, 'approved'));
    });
    el.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.addEventListener('click', () => confirmAction({
        title: '아이템 반려',
        message: '이 아이템을 반려 처리하시겠습니까?',
        danger: true,
        onConfirm: () => updateMarketStatus(btn.dataset.reject, 'rejected'),
      }));
    });
    el.querySelectorAll('[data-edit-item]').forEach((btn) => {
      btn.addEventListener('click', () => openItemEdit(btn.dataset.editItem));
    });
    el.querySelectorAll('[data-del-item]').forEach((btn) => {
      btn.addEventListener('click', () => confirmAction({
        title: '아이템 강제 삭제',
        message: '이 마켓 아이템을 영구 삭제합니다. 계속하시겠습니까?',
        danger: true,
        onConfirm: () => {
          saveMarketItems(getMarketItems().filter((i) => i.id !== btn.dataset.delItem));
          B.showToast('아이템이 삭제되었습니다.');
          renderMarketplace(el);
        },
      }));
    });
    el.querySelectorAll('[data-dl-item]').forEach((btn) => {
      btn.addEventListener('click', () => B.showToast('검수 파일 다운로드 준비 중입니다.'));
    });
  }

  function statusLabel(s) {
    return { pending: '대기중', approved: '승인됨', rejected: '반려됨' }[s] || s;
  }

  function updateMarketStatus(id, status) {
    const items = getMarketItems();
    const item = items.find((i) => i.id === id);
    if (item) {
      item.status = status;
      if (status === 'approved') item.active = true;
      saveMarketItems(items);
      B.showToast(status === 'approved' ? '승인되었습니다.' : '반려되었습니다.');
      renderPanel();
    }
  }

  function openItemEdit(id) {
    const item = getMarketItems().find((i) => i.id === id);
    if (!item) return;
    const form = document.getElementById('sadmin-item-form');
    form.innerHTML = `
      <div><label class="form-label">제목</label><input type="text" id="sadmin-item-name" class="form-input" value="${B.escapeHtml(item.name)}" /></div>
      <div><label class="form-label">가격 (P)</label><input type="number" id="sadmin-item-price" class="form-input" value="${item.price || 0}" /></div>
      <div><label class="form-label">설명</label><textarea id="sadmin-item-desc" class="form-input min-h-[80px]">${B.escapeHtml(item.desc || '')}</textarea></div>
      <div><label class="form-label">썸네일 (이모지)</label><input type="text" id="sadmin-item-emoji" class="form-input" value="${item.emoji || ''}" maxlength="4" /></div>
      <button type="submit" class="toy-btn-3d toy-btn-3d-sm w-full justify-center mt-2">저장</button>
    `;
    form.onsubmit = (e) => {
      e.preventDefault();
      item.name = document.getElementById('sadmin-item-name').value.trim();
      item.price = Number(document.getElementById('sadmin-item-price').value) || 0;
      item.desc = document.getElementById('sadmin-item-desc').value.trim();
      item.emoji = document.getElementById('sadmin-item-emoji').value.trim();
      const items = getMarketItems();
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) items[idx] = item;
      saveMarketItems(items);
      B.closeModal('modal-sadmin-item');
      B.showToast('아이템이 수정되었습니다.');
      renderPanel();
    };
    B.openModal('modal-sadmin-item');
  }

  // ── Community ──
  function renderCommunity(el) {
    const boards = B.getBoards();
    let posts = getAllPosts();
    if (communityBoard !== 'all') posts = posts.filter((p) => p.boardId === communityBoard);
    const blacklist = getBlacklist();
    const muted = getMuted();

    el.innerHTML = `
      <div class="sadmin-page-head">
        <h1 class="sadmin-page-title">커뮤니티 관리</h1>
        <p class="sadmin-page-desc">게시판 · 게시글 · 댓글 · 공지 · 블랙리스트 통합 관리</p>
      </div>
      <div class="sadmin-grid-2">
        <div class="sadmin-card">
          <h3 class="sadmin-card-title"><i data-lucide="megaphone" class="w-4 h-4"></i> 공지사항 등록</h3>
          <form id="sadmin-notice-form" class="space-y-3">
            <select id="sadmin-notice-board" class="form-input">${boards.map((b) => `<option value="${b.id}">${B.escapeHtml(b.name)}</option>`).join('')}</select>
            <input type="text" id="sadmin-notice-title" class="form-input" placeholder="공지 제목" maxlength="80" required />
            <textarea id="sadmin-notice-body" class="form-input min-h-[80px]" placeholder="공지 본문" required></textarea>
            <label class="flex items-center gap-2 text-sm text-gray-400"><input type="checkbox" id="sadmin-notice-pin" checked /> 상단 고정</label>
            <button type="submit" class="toy-btn-3d toy-btn-3d-sm w-full justify-center">공지 등록</button>
          </form>
        </div>
        <div class="sadmin-card">
          <h3 class="sadmin-card-title"><i data-lucide="shield-ban" class="w-4 h-4"></i> 블랙리스트 / Mute</h3>
          <form id="sadmin-ban-form" class="flex gap-2 mb-3">
            <input type="text" id="sadmin-ban-nick" class="form-input flex-1" placeholder="닉네임 입력" maxlength="20" />
            <button type="submit" class="sadmin-btn sadmin-btn-danger">블랙리스트</button>
            <button type="button" id="sadmin-mute-btn" class="sadmin-btn">Mute</button>
          </form>
          <div class="text-xs text-gray-500 mb-2">블랙리스트: ${blacklist.length}명 · Mute: ${muted.length}명</div>
          <div class="sadmin-urgent-list">
            ${[...blacklist.map((n) => ({ n, t: 'black' })), ...muted.map((n) => ({ n, t: 'mute' }))].map((x) => `
              <div class="sadmin-urgent-item">
                <span>${B.escapeHtml(x.n)} <span class="sadmin-status sadmin-status-banned">${x.t === 'black' ? 'BL' : 'MUTE'}</span></span>
                <button type="button" class="sadmin-btn" data-unban="${B.escapeHtml(x.n)}" data-type="${x.t}">해제</button>
              </div>
            `).join('') || '<p class="sadmin-empty text-xs">등록된 제재 없음</p>'}
          </div>
        </div>
      </div>
      <div class="sadmin-subtabs">
        <button type="button" class="sadmin-subtab${communityBoard === 'all' ? ' active' : ''}" data-cb="all">전체</button>
        ${boards.map((b) => `<button type="button" class="sadmin-subtab${communityBoard === b.id ? ' active' : ''}" data-cb="${b.id}">${B.escapeHtml(b.name)}</button>`).join('')}
      </div>
      <div class="sadmin-filters">
        <input type="text" id="sadmin-post-search" class="form-input sadmin-search" placeholder="닉네임으로 유저 글 검색…" />
        <button type="button" id="sadmin-bulk-del" class="sadmin-btn sadmin-btn-danger">선택 유저 글 일괄삭제</button>
      </div>
      <div class="sadmin-table-wrap">
        <table class="sadmin-table">
          <thead><tr><th>게시판</th><th>제목</th><th>닉네임</th><th>날짜</th><th>댓글</th><th>관리</th></tr></thead>
          <tbody id="sadmin-posts-tbody">
            ${renderPostsRows(posts)}
          </tbody>
        </table>
      </div>
    `;

    el.querySelectorAll('[data-cb]').forEach((btn) => {
      btn.addEventListener('click', () => { communityBoard = btn.dataset.cb; renderCommunity(el); });
    });
    document.getElementById('sadmin-notice-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      B.adminPostNotice({
        boardId: document.getElementById('sadmin-notice-board').value,
        title: document.getElementById('sadmin-notice-title').value.trim(),
        body: document.getElementById('sadmin-notice-body').value.trim(),
        pin: document.getElementById('sadmin-notice-pin').checked,
      });
      e.target.reset();
      renderCommunity(el);
    }, { once: true });
    document.getElementById('sadmin-ban-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nick = document.getElementById('sadmin-ban-nick').value.trim();
      if (!nick) return;
      const list = getBlacklist();
      if (!list.includes(nick)) { list.push(nick); save(KEYS.blacklist, list); }
      B.showToast(`${nick} 블랙리스트 등록`);
      renderCommunity(el);
    }, { once: true });
    document.getElementById('sadmin-mute-btn')?.addEventListener('click', () => {
      const nick = document.getElementById('sadmin-ban-nick').value.trim();
      if (!nick) return;
      const list = getMuted();
      if (!list.includes(nick)) { list.push(nick); save(KEYS.muted, list); }
      B.showToast(`${nick} Mute 처리`);
      renderCommunity(el);
    }, { once: true });
    el.querySelectorAll('[data-unban]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nick = btn.dataset.unban;
        if (btn.dataset.type === 'black') save(KEYS.blacklist, getBlacklist().filter((n) => n !== nick));
        else save(KEYS.muted, getMuted().filter((n) => n !== nick));
        renderCommunity(el);
      });
    });
    bindPostActions(el);
    document.getElementById('sadmin-post-search')?.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const filtered = q ? posts.filter((p) => (p.nick || '').toLowerCase().includes(q)) : posts;
      document.getElementById('sadmin-posts-tbody').innerHTML = renderPostsRows(filtered);
      bindPostActions(el);
    });
    document.getElementById('sadmin-bulk-del')?.addEventListener('click', () => {
      const q = document.getElementById('sadmin-post-search')?.value.trim();
      if (!q) { B.showToast('닉네임을 검색창에 입력하세요.'); return; }
      confirmAction({
        title: '유저 글 일괄 삭제',
        message: `"${q}" 닉네임의 모든 게시글을 삭제합니다.`,
        danger: true,
        onConfirm: () => { B.adminDeletePostsByNick(q); renderCommunity(el); },
      });
    });
  }

  function renderPostsRows(posts) {
    if (!posts.length) return '<tr><td colspan="6" class="sadmin-empty">게시글이 없습니다.</td></tr>';
    return posts.slice(0, 50).map((p) => `
      <tr>
        <td>${B.escapeHtml(p.boardName || p.boardId)}</td>
        <td>${p.isNotice ? '📌 ' : ''}${B.escapeHtml(p.title)}</td>
        <td>${B.escapeHtml(p.nick)}</td>
        <td>${p.date || ''}</td>
        <td>${(p.comments || []).length}</td>
        <td>
          <div class="sadmin-actions">
            <button type="button" class="sadmin-btn" data-view-post="${p.id}" data-board="${p.boardId}">열람</button>
            <button type="button" class="sadmin-btn" data-del-post="${p.id}" data-board="${p.boardId}">삭제</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function bindPostActions(el) {
    el.querySelectorAll('[data-del-post]').forEach((btn) => {
      btn.addEventListener('click', () => confirmAction({
        title: '게시글 강제 삭제',
        message: '이 게시글을 즉시 삭제합니다.',
        danger: true,
        onConfirm: () => { B.adminDeletePost(btn.dataset.delPost, btn.dataset.board); renderPanel(); },
      }));
    });
    el.querySelectorAll('[data-view-post]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const posts = getAllPosts();
        const p = posts.find((x) => x.id === btn.dataset.viewPost);
        if (p) alert(`[비밀글 열람]\n\n제목: ${p.title}\n닉네임: ${p.nick}\n비밀번호: ${p.pw || '(없음)'}\n\n${p.body}`);
      });
    });
  }

  // ── Downloads & Docs ──
  function renderDownloads(el) {
    const changelog = getChangelog();
    const faq = getFaq();
    const inquiries = getInquiries();
    const dl = getDownloadInfo();

    el.innerHTML = `
      <div class="sadmin-page-head">
        <h1 class="sadmin-page-title">자료실 / 가이드 관리</h1>
        <p class="sadmin-page-desc">앱 다운로드, changelog, FAQ, 1:1 문의 관리</p>
      </div>
      <div class="sadmin-card">
        <h3 class="sadmin-card-title"><i data-lucide="download" class="w-4 h-4"></i> 앱 다운로드 관리</h3>
        <form id="sadmin-dl-form" class="grid sm:grid-cols-2 gap-3">
          <div><label class="form-label">버전</label><input type="text" id="sadmin-dl-ver" class="form-input" value="${B.escapeHtml(dl.version)}" /></div>
          <div><label class="form-label">.exe 다운로드 URL</label><input type="url" id="sadmin-dl-url" class="form-input" value="${B.escapeHtml(dl.url)}" placeholder="https://..." /></div>
          <div class="sm:col-span-2"><label class="form-label">설명</label><input type="text" id="sadmin-dl-notes" class="form-input" value="${B.escapeHtml(dl.notes)}" /></div>
          <button type="submit" class="toy-btn-3d toy-btn-3d-sm justify-center sm:col-span-2">저장</button>
        </form>
      </div>
      <div class="sadmin-grid-2">
        <div class="sadmin-card">
          <h3 class="sadmin-card-title"><i data-lucide="list" class="w-4 h-4"></i> 업데이트 로그</h3>
          <form id="sadmin-changelog-add" class="flex flex-col gap-2 mb-3">
            <input type="text" id="sadmin-cl-ver" class="form-input" placeholder="버전 (v1.0.1)" />
            <textarea id="sadmin-cl-notes" class="form-input min-h-[60px]" placeholder="업데이트 내용"></textarea>
            <button type="submit" class="sadmin-btn sadmin-btn-primary">로그 추가</button>
          </form>
          <div class="sadmin-urgent-list">
            ${changelog.map((c, i) => `
              <div class="sadmin-urgent-item">
                <span><strong>${B.escapeHtml(c.version)}</strong> ${B.escapeHtml(c.notes)}</span>
                <button type="button" class="sadmin-btn" data-del-cl="${i}">삭제</button>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="sadmin-card">
          <h3 class="sadmin-card-title"><i data-lucide="help-circle" class="w-4 h-4"></i> FAQ 관리</h3>
          <form id="sadmin-faq-add" class="flex flex-col gap-2 mb-3">
            <input type="text" id="sadmin-faq-q" class="form-input" placeholder="질문" />
            <textarea id="sadmin-faq-a" class="form-input min-h-[60px]" placeholder="답변"></textarea>
            <button type="submit" class="sadmin-btn sadmin-btn-primary">FAQ 추가</button>
          </form>
          <div class="sadmin-urgent-list">
            ${faq.map((f, i) => `
              <div class="sadmin-urgent-item">
                <span>${B.escapeHtml(f.q)}</span>
                <button type="button" class="sadmin-btn" data-del-faq="${i}">삭제</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="sadmin-card">
        <h3 class="sadmin-card-title"><i data-lucide="mail" class="w-4 h-4"></i> 1:1 문의 (${inquiries.filter((q) => !q.answered).length}건 미답변)</h3>
        <div class="sadmin-table-wrap">
          <table class="sadmin-table">
            <thead><tr><th>이메일</th><th>제목</th><th>내용</th><th>상태</th><th>관리</th></tr></thead>
            <tbody>
              ${inquiries.length ? inquiries.map((q) => `
                <tr>
                  <td>${B.escapeHtml(q.email)}</td>
                  <td>${B.escapeHtml(q.subject)}</td>
                  <td class="text-xs max-w-[200px] truncate">${B.escapeHtml(q.body)}</td>
                  <td><span class="sadmin-status ${q.answered ? 'sadmin-status-approved' : 'sadmin-status-pending'}">${q.answered ? '답변완료' : '대기'}</span></td>
                  <td><button type="button" class="sadmin-btn sadmin-btn-primary" data-reply-inq="${q.id}">답변</button></td>
                </tr>
              `).join('') : '<tr><td colspan="5" class="sadmin-empty">문의가 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('sadmin-dl-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      save(KEYS.download, {
        version: document.getElementById('sadmin-dl-ver').value.trim(),
        url: document.getElementById('sadmin-dl-url').value.trim(),
        notes: document.getElementById('sadmin-dl-notes').value.trim(),
      });
      B.renderResources?.();
      B.showToast('다운로드 정보가 저장되었습니다.');
    }, { once: true });
    document.getElementById('sadmin-changelog-add')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const list = getChangelog();
      list.unshift({
        version: document.getElementById('sadmin-cl-ver').value.trim(),
        date: B.formatDate(new Date()),
        notes: document.getElementById('sadmin-cl-notes').value.trim(),
      });
      save(KEYS.changelog, list);
      B.renderResources?.();
      renderDownloads(el);
    }, { once: true });
    el.querySelectorAll('[data-del-cl]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const list = getChangelog();
        list.splice(Number(btn.dataset.delCl), 1);
        save(KEYS.changelog, list);
        B.renderResources?.();
        renderDownloads(el);
      });
    });
    document.getElementById('sadmin-faq-add')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const list = getFaq();
      list.push({
        q: document.getElementById('sadmin-faq-q').value.trim(),
        a: document.getElementById('sadmin-faq-a').value.trim(),
      });
      save(KEYS.faq, list);
      B.renderResources?.();
      renderDownloads(el);
    }, { once: true });
    el.querySelectorAll('[data-del-faq]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const list = getFaq();
        list.splice(Number(btn.dataset.delFaq), 1);
        save(KEYS.faq, list);
        B.renderResources?.();
        renderDownloads(el);
      });
    });
    el.querySelectorAll('[data-reply-inq]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reply = prompt('관리자 답변을 입력하세요:');
        if (!reply) return;
        const list = getInquiries();
        const item = list.find((q) => q.id === btn.dataset.replyInq);
        if (item) { item.answered = true; item.reply = reply; item.repliedAt = B.formatDate(new Date()); }
        save(KEYS.inquiries, list);
        B.showToast('답변이 등록되었습니다.');
        renderDownloads(el);
      });
    });
  }

  // ── Users ──
  function renderUsers(el) {
    let users = getUsers();
    if (userFilter !== 'all') users = users.filter((u) => u.status === userFilter);
    if (userSearch) {
      const q = userSearch.toLowerCase();
      users = users.filter((u) => (u.nick || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
    }

    el.innerHTML = `
      <div class="sadmin-page-head">
        <h1 class="sadmin-page-title">유저 / 토이코인 관리</h1>
        <p class="sadmin-page-desc">회원 조회, 코인 조율, 계정 제어</p>
      </div>
      <div class="sadmin-filters">
        <input type="text" id="sadmin-user-search" class="form-input sadmin-search" placeholder="닉네임 / 이메일 검색…" value="${B.escapeHtml(userSearch)}" />
        <button type="button" class="sadmin-subtab${userFilter === 'all' ? ' active' : ''}" data-uf="all">전체</button>
        <button type="button" class="sadmin-subtab${userFilter === 'normal' ? ' active' : ''}" data-uf="normal">정상</button>
        <button type="button" class="sadmin-subtab${userFilter === 'banned' ? ' active' : ''}" data-uf="banned">정지</button>
        <button type="button" class="sadmin-subtab${userFilter === 'withdrawn' ? ' active' : ''}" data-uf="withdrawn">탈퇴</button>
      </div>
      <div class="sadmin-table-wrap">
        <table class="sadmin-table">
          <thead><tr><th>닉네임</th><th>이메일</th><th>토이코인</th><th>가입일</th><th>상태</th><th>관리</th></tr></thead>
          <tbody>
            ${users.map((u) => `
              <tr>
                <td><strong>${B.escapeHtml(u.nick)}</strong></td>
                <td>${B.escapeHtml(u.email)}</td>
                <td>${(u.cash || 0).toLocaleString()}P</td>
                <td>${u.joinedAt || '-'}</td>
                <td><span class="sadmin-status sadmin-status-${u.status === 'normal' ? 'normal' : 'banned'}">${userStatusLabel(u.status)}</span></td>
                <td><button type="button" class="sadmin-btn sadmin-btn-primary" data-user-detail="${u.id}">상세</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('sadmin-user-search')?.addEventListener('input', (e) => {
      userSearch = e.target.value;
      renderUsers(el);
    });
    el.querySelectorAll('[data-uf]').forEach((btn) => {
      btn.addEventListener('click', () => { userFilter = btn.dataset.uf; renderUsers(el); });
    });
    el.querySelectorAll('[data-user-detail]').forEach((btn) => {
      btn.addEventListener('click', () => openUserModal(btn.dataset.userDetail));
    });
  }

  function userStatusLabel(s) {
    return { normal: '정상', banned: '정지', withdrawn: '탈퇴' }[s] || s;
  }

  function openUserModal(userId) {
    const user = getUsers().find((u) => u.id === userId);
    if (!user) return;
    const body = document.getElementById('sadmin-user-modal-body');
    const postCount = getAllPosts().filter((p) => p.nick === user.nick).length;
    body.innerHTML = `
      <h2 class="text-lg font-semibold text-white mb-4">${B.escapeHtml(user.nick)} <span class="sadmin-status sadmin-status-${user.status === 'normal' ? 'normal' : 'banned'}">${userStatusLabel(user.status)}</span></h2>
      <dl class="sadmin-user-detail">
        <dt>이메일</dt><dd>${B.escapeHtml(user.email)}</dd>
        <dt>가입일</dt><dd>${user.joinedAt || '-'}</dd>
        <dt>보유 토이코인</dt><dd>${(user.cash || 0).toLocaleString()}P</dd>
        <dt>활동 (게시글)</dt><dd>${postCount}건</dd>
        <dt>역할</dt><dd>${user.role || 'user'}</dd>
      </dl>
      <div class="flex flex-wrap gap-2 mt-6 pt-4 border-t border-white/10">
        <button type="button" class="sadmin-btn sadmin-btn-primary" id="sadmin-coin-add">코인 지급</button>
        <button type="button" class="sadmin-btn" id="sadmin-coin-sub">코인 차감</button>
        <button type="button" class="sadmin-btn" id="sadmin-user-ban">${user.status === 'banned' ? '정지 해제' : '계정 정지'}</button>
        <button type="button" class="sadmin-btn" id="sadmin-user-withdraw">탈퇴 처리</button>
        <button type="button" class="sadmin-btn" id="sadmin-user-pw">비밀번호 초기화 메일</button>
      </div>
    `;
    document.getElementById('sadmin-coin-add')?.addEventListener('click', () => {
      const amt = Number(prompt('지급할 코인 (P):', '1000'));
      if (!amt || amt <= 0) return;
      adjustUserCoin(userId, amt);
    });
    document.getElementById('sadmin-coin-sub')?.addEventListener('click', () => {
      const amt = Number(prompt('차감할 코인 (P):', '500'));
      if (!amt || amt <= 0) return;
      adjustUserCoin(userId, -amt);
    });
    document.getElementById('sadmin-user-ban')?.addEventListener('click', () => {
      confirmAction({
        title: user.status === 'banned' ? '정지 해제' : '계정 정지',
        message: user.status === 'banned' ? '이 계정의 정지를 해제합니다.' : '이 계정을 일시 정지합니다.',
        danger: user.status !== 'banned',
        onConfirm: () => {
          const users = getUsers();
          const u = users.find((x) => x.id === userId);
          if (u) u.status = u.status === 'banned' ? 'normal' : 'banned';
          saveUsers(users);
          B.closeModal('modal-sadmin-user');
          B.showToast('계정 상태가 변경되었습니다.');
          renderPanel();
        },
      });
    });
    document.getElementById('sadmin-user-withdraw')?.addEventListener('click', () => {
      confirmAction({
        title: '영구 탈퇴 처리',
        message: '이 계정을 탈퇴 처리합니다. 복구가 어렵습니다.',
        danger: true,
        onConfirm: () => {
          const users = getUsers();
          const u = users.find((x) => x.id === userId);
          if (u) u.status = 'withdrawn';
          saveUsers(users);
          B.closeModal('modal-sadmin-user');
          B.showToast('탈퇴 처리되었습니다.');
          renderPanel();
        },
      });
    });
    document.getElementById('sadmin-user-pw')?.addEventListener('click', () => {
      B.showToast(`비밀번호 초기화 메일이 ${user.email}로 발송되었습니다. (시뮬레이션)`);
    });
    B.openModal('modal-sadmin-user');
  }

  function adjustUserCoin(userId, delta) {
    const users = getUsers();
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    u.cash = Math.max(0, (u.cash || 0) + delta);
    saveUsers(users);
    B.showToast(`${delta > 0 ? '지급' : '차감'} 완료: ${Math.abs(delta).toLocaleString()}P`);
    openUserModal(userId);
  }

  // ── Developers & Payouts ──
  function renderDevelopers(el) {
    const subs = getDevSubmissions();
    const payouts = getPayouts().filter((p) => payoutFilter === 'all' || p.status === payoutFilter);

    el.innerHTML = `
      <div class="sadmin-page-head">
        <h1 class="sadmin-page-title">개발자센터 / 정산 관리</h1>
        <p class="sadmin-page-desc">크리에이터 신청 검수 및 코인 정산 처리</p>
      </div>
      <div class="sadmin-card">
        <h3 class="sadmin-card-title"><i data-lucide="package" class="w-4 h-4"></i> 크리에이터 등록 신청</h3>
        <div class="sadmin-table-wrap">
          <table class="sadmin-table">
            <thead><tr><th>유형</th><th>이름</th><th>신청자</th><th>URL</th><th>상태</th><th>관리</th></tr></thead>
            <tbody>
              ${subs.length ? subs.map((s) => `
                <tr>
                  <td>${B.escapeHtml(s.type || '-')}</td>
                  <td>${B.escapeHtml(s.name)}</td>
                  <td>${B.escapeHtml(s.nick || s.email || '-')}</td>
                  <td class="text-xs truncate max-w-[120px]">${B.escapeHtml(s.url || '-')}</td>
                  <td><span class="sadmin-status sadmin-status-${s.status || 'pending'}">${statusLabel(s.status || 'pending')}</span></td>
                  <td>
                    <div class="sadmin-actions">
                      ${(s.status || 'pending') === 'pending' ? `
                        <button type="button" class="sadmin-btn sadmin-btn-primary" data-approve-sub="${s.id}">승인</button>
                        <button type="button" class="sadmin-btn" data-reject-sub="${s.id}">반려</button>
                      ` : '-'}
                    </div>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="6" class="sadmin-empty">신청 내역이 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div class="sadmin-subtabs">
        <button type="button" class="sadmin-subtab${payoutFilter === 'pending' ? ' active' : ''}" data-pf="pending">대기</button>
        <button type="button" class="sadmin-subtab${payoutFilter === 'approved' ? ' active' : ''}" data-pf="approved">승인</button>
        <button type="button" class="sadmin-subtab${payoutFilter === 'rejected' ? ' active' : ''}" data-pf="rejected">거절</button>
        <button type="button" class="sadmin-subtab${payoutFilter === 'all' ? ' active' : ''}" data-pf="all">전체</button>
      </div>
      <div class="sadmin-card">
        <h3 class="sadmin-card-title"><i data-lucide="wallet" class="w-4 h-4"></i> 정산 신청</h3>
        <div class="sadmin-table-wrap">
          <table class="sadmin-table">
            <thead><tr><th>닉네임</th><th>이메일</th><th>코인</th><th>환전액</th><th>신청일</th><th>상태</th><th>관리</th></tr></thead>
            <tbody>
              ${payouts.map((p) => `
                <tr>
                  <td>${B.escapeHtml(p.nick)}</td>
                  <td>${B.escapeHtml(p.email)}</td>
                  <td>${(p.coins || 0).toLocaleString()}P</td>
                  <td>₩${(p.amount || 0).toLocaleString()}</td>
                  <td>${p.requestedAt || ''}</td>
                  <td><span class="sadmin-status sadmin-status-${p.status}">${statusLabel(p.status)}</span></td>
                  <td>
                    ${p.status === 'pending' ? `
                      <div class="sadmin-actions">
                        <button type="button" class="sadmin-btn sadmin-btn-primary" data-approve-pay="${p.id}">승인</button>
                        <button type="button" class="sadmin-btn" data-reject-pay="${p.id}">거절</button>
                      </div>
                    ` : '-'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    el.querySelectorAll('[data-pf]').forEach((btn) => {
      btn.addEventListener('click', () => { payoutFilter = btn.dataset.pf; renderDevelopers(el); });
    });
    el.querySelectorAll('[data-approve-sub]').forEach((btn) => {
      btn.addEventListener('click', () => updateSubmission(btn.dataset.approveSub, 'approved'));
    });
    el.querySelectorAll('[data-reject-sub]').forEach((btn) => {
      btn.addEventListener('click', () => updateSubmission(btn.dataset.rejectSub, 'rejected'));
    });
    el.querySelectorAll('[data-approve-pay]').forEach((btn) => {
      btn.addEventListener('click', () => updatePayout(btn.dataset.approvePay, 'approved'));
    });
    el.querySelectorAll('[data-reject-pay]').forEach((btn) => {
      btn.addEventListener('click', () => confirmAction({
        title: '정산 거절',
        message: '이 정산 신청을 거절합니다.',
        danger: true,
        onConfirm: () => updatePayout(btn.dataset.rejectPay, 'rejected'),
      }));
    });
  }

  function updateSubmission(id, status) {
    const subs = getDevSubmissions();
    const s = subs.find((x) => x.id === id);
    if (s) {
      s.status = status;
      save(KEYS.devSubmissions, subs);
      if (status === 'approved') {
        const items = getMarketItems();
        items.push({
          id: 'sub_' + id,
          type: s.itemType === 'extension' ? 'extension' : s.itemType === 'game' ? 'game' : 'skin',
          name: s.name,
          desc: s.desc || '',
          price: 3000,
          emoji: '📦',
          bg: 'linear-gradient(135deg, #312e81, #1e1b4b)',
          status: 'approved',
          active: true,
          creator: s.nick || s.email || 'Creator',
          submittedAt: s.submittedAt || Date.now(),
        });
        saveMarketItems(items);
      }
      B.showToast(status === 'approved' ? '신청이 승인되었습니다.' : '신청이 반려되었습니다.');
      renderPanel();
    }
  }

  function updatePayout(id, status) {
    const payouts = getPayouts();
    const p = payouts.find((x) => x.id === id);
    if (p) { p.status = status; save(KEYS.payouts, payouts); }
    B.showToast(status === 'approved' ? '정산이 승인되었습니다.' : '정산이 거절되었습니다.');
    renderPanel();
  }

  // ── Settings ──
  function renderSettings(el) {
    const s = getSettings();
    el.innerHTML = `
      <div class="sadmin-page-head">
        <h1 class="sadmin-page-title">시스템 설정</h1>
        <p class="sadmin-page-desc">서비스 전역 설정 및 점검 모드</p>
      </div>
      <div class="sadmin-card">
        <h3 class="sadmin-card-title"><i data-lucide="sliders" class="w-4 h-4"></i> 전역 스위치</h3>
        <div class="space-y-4">
          <label class="flex items-center justify-between gap-4">
            <span class="text-sm text-gray-300">점검 모드 (Maintenance)</span>
            <label class="sadmin-toggle"><input type="checkbox" id="sadmin-set-maint" ${s.maintenance ? 'checked' : ''} /><span class="sadmin-toggle-slider"></span></label>
          </label>
          <label class="flex items-center justify-between gap-4">
            <span class="text-sm text-gray-300">회원가입 허용</span>
            <label class="sadmin-toggle"><input type="checkbox" id="sadmin-set-reg" ${s.registrationOpen ? 'checked' : ''} /><span class="sadmin-toggle-slider"></span></label>
          </label>
          <label class="flex items-center justify-between gap-4">
            <span class="text-sm text-gray-300">토이마켓 오픈</span>
            <label class="sadmin-toggle"><input type="checkbox" id="sadmin-set-market" ${s.marketOpen ? 'checked' : ''} /><span class="sadmin-toggle-slider"></span></label>
          </label>
          <div>
            <label class="form-label">전체 공지 배너</label>
            <textarea id="sadmin-set-notice" class="form-input min-h-[80px]" placeholder="사이트 상단에 표시할 공지">${B.escapeHtml(s.notice || '')}</textarea>
          </div>
          <button type="button" id="sadmin-save-settings" class="toy-btn-3d toy-btn-3d-sm">설정 저장</button>
        </div>
      </div>
      <div class="sadmin-card">
        <h3 class="sadmin-card-title"><i data-lucide="layout-grid" class="w-4 h-4"></i> 게시판 관리</h3>
        <form id="sadmin-board-form" class="flex gap-2 mb-3">
          <input type="text" id="sadmin-board-name" class="form-input flex-1" placeholder="새 게시판 이름" maxlength="30" />
          <button type="submit" class="sadmin-btn sadmin-btn-primary">추가</button>
        </form>
        <div id="sadmin-board-list" class="sadmin-urgent-list">
          ${B.getBoards().map((b) => `
            <div class="sadmin-urgent-item">
              <span>${B.escapeHtml(b.name)} <span class="text-xs text-gray-500">(${b.id})</span></span>
              ${!['free', 'qna', 'notice'].includes(b.id) ? `<button type="button" class="sadmin-btn" data-del-board="${b.id}">삭제</button>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('sadmin-save-settings')?.addEventListener('click', () => {
      save(KEYS.settings, {
        maintenance: document.getElementById('sadmin-set-maint').checked,
        registrationOpen: document.getElementById('sadmin-set-reg').checked,
        marketOpen: document.getElementById('sadmin-set-market').checked,
        notice: document.getElementById('sadmin-set-notice').value.trim(),
      });
      B.showToast('시스템 설정이 저장되었습니다.');
    });
    document.getElementById('sadmin-board-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('sadmin-board-name').value.trim();
      if (name) B.adminCreateBoard(name);
      renderSettings(el);
    });
    el.querySelectorAll('[data-del-board]').forEach((btn) => {
      btn.addEventListener('click', () => confirmAction({
        title: '게시판 삭제',
        message: '이 게시판을 삭제합니다.',
        danger: true,
        onConfirm: () => { B.adminDeleteBoard(btn.dataset.delBoard); renderSettings(el); },
      }));
    });
  }

  // ── Public API ──
  window.SuperAdmin = {
    init,
    setTab,
    renderPanel,
    getMarketItems,
    getMarketCatalog(type) {
      const map = { skin: 'skin', game: 'game', extension: 'extension', skins: 'skin', games: 'game', extensions: 'extension' };
      const t = map[type] || type;
      return getMarketItems().filter((i) => i.type === t && i.status === 'approved' && i.active !== false);
    },
    isNickMuted(nick) {
      return getMuted().includes(nick) || getBlacklist().includes(nick);
    },
    isNickBlacklisted(nick) {
      return getBlacklist().includes(nick);
    },
    addDevSubmission(data) {
      const subs = getDevSubmissions();
      subs.unshift({ ...data, id: 'sub_' + Date.now(), status: 'pending', submittedAt: Date.now() });
      save(KEYS.devSubmissions, subs);
    },
    addInquiry(data) {
      const list = getInquiries();
      list.unshift({ ...data, id: 'inq_' + Date.now(), answered: false, createdAt: Date.now() });
      save(KEYS.inquiries, list);
    },
    getChangelog,
    getFaq,
    getDownloadInfo,
    incrementDownloadCount() {
      const dl = load(KEYS.downloadsToday, { date: B.formatDate(new Date()), count: 0 });
      const today = B.formatDate(new Date());
      if (dl.date !== today) { dl.date = today; dl.count = 0; }
      dl.count += 1;
      save(KEYS.downloadsToday, dl);
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

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
    toysHome: 'toytools_home_toys',
    devlogs: 'toytools_devlogs',
    landing: 'toytools_landing',
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
  const FS = () => window.FirebaseStore;

  async function init() {
    B = window.ToyToolsBridge;
    if (!B) return;
    if (FS()) await FS().waitReady();
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
    document.querySelectorAll('[data-sadmin-toy-close]').forEach((el) => {
      el.addEventListener('click', () => B.closeModal('modal-sadmin-toy'));
    });
    document.querySelectorAll('[data-sadmin-devlog-close]').forEach((el) => {
      el.addEventListener('click', () => B.closeModal('modal-sadmin-devlog'));
    });
  }

  function requireAdmin() {
    if (!B?.isAdmin?.()) {
      B.showToast('슈퍼관리자 권한이 필요합니다.');
      return false;
    }
    return true;
  }

  function getHomeToys() {
    if (FS()) return FS().getHomeToys();
    return load(KEYS.toysHome, B.getToysDefault?.().map((t, i) => ({
      id: `local_toy_${i}`,
      icon: t.icon,
      title: t.title,
      desc: t.desc,
      tag: t.tag,
      accent: t.accent,
      downloadUrl: '',
      downloadStatus: 'available',
      order: i,
      active: true,
    })) || []);
  }

  function getDevlogs() {
    if (FS()) return FS().getDevlogs();
    return load(KEYS.devlogs, B.getDevlogsDefault?.().map((d) => ({
      id: String(d.id),
      emoji: d.emoji,
      title: d.title,
      author: 'ToyTools',
      category: '개발 비하인드',
      body: d.body,
      date: d.date,
      views: d.views || 0,
      comments: d.comments || 0,
      from: d.from,
      to: d.to,
      published: true,
    })) || []);
  }

  async function saveHomeToysLocal(items) {
    save(KEYS.toysHome, items);
    B.renderToyCards?.();
  }

  async function saveDevlogsLocal(items) {
    save(KEYS.devlogs, items);
    B.renderDevLogs?.();
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

  async function renderPanel() {
    const el = document.getElementById('sadmin-content');
    if (!el) return;
    if (FS()) await FS().waitReady();
    el.innerHTML = '<p class="sadmin-empty">데이터 동기화 중…</p>';
    const renderers = {
      overview: renderOverview,
      landing: renderLandingSettings,
      toys: renderToysManagement,
      devlogs: renderDevlogsManagement,
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

  // ── Storage helpers (FirebaseStore 우선, localStorage 폴백) ──
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
    if (FS()) return FS().getMarket();
    let items = load(KEYS.market, null);
    if (!items) {
      items = [];
      const add = (list, type) => list.forEach((i) => {
        items.push({
          id: i.id, type, name: i.name, desc: i.desc, price: i.price,
          emoji: i.emoji, bg: i.bg, tag: i.gen || i.tag || '',
          status: 'approved', active: true, creator: 'ToyTools', submittedAt: Date.now(),
        });
      });
      add(B.SKINS, 'skin');
      add(B.MINIGAMES, 'game');
      add(B.EXTENSIONS, 'extension');
      save(KEYS.market, items);
    }
    return items;
  }

  async function saveMarketItems(items) {
    if (FS()) await FS().saveMarketItems(items);
    else { save(KEYS.market, items); }
    B.renderToyMarket?.();
  }

  function getUsers() {
    if (FS()) return FS().getUsers();
    let users = load(KEYS.users, null);
    if (!users) {
      users = [
        { id: 'u1', nick: '장난감초보', email: 'demo1@toy-tools.com', cash: 12500, status: 'normal', joinedAt: '2026-06-15', role: 'user' },
        { id: 'u2', nick: '스킨마스터', email: 'creator@toy-tools.com', cash: 48200, status: 'normal', joinedAt: '2026-05-20', role: 'creator' },
      ];
      save(KEYS.users, users);
    }
    return users;
  }

  async function saveUsers(users) {
    if (!FS()) save(KEYS.users, users);
  }

  function getStats() {
    const users = getUsers();
    const market = getMarketItems();
    const posts = getAllPosts();
    const pendingMarket = market.filter((i) => i.status === 'pending').length;
    const totalCoins = users.filter((u) => u.status === 'normal').reduce((s, u) => s + (u.cash || 0), 0);
    const dl = FS() ? FS().getDailyDownloads() : load(KEYS.downloadsToday, { date: B.formatDate(new Date()), count: 42 });
    const today = B.formatDate(new Date());
    if (!FS() && dl.date !== today) {
      dl.date = today;
      dl.count = Math.floor(Math.random() * 30) + 15;
      save(KEYS.downloadsToday, dl);
    }
    return {
      totalUsers: users.filter((u) => u.status !== 'withdrawn').length,
      newPosts: posts.filter((p) => (p.date || '').startsWith(today.slice(0, 7))).length,
      pendingReview: pendingMarket + getDevSubmissions().filter((s) => s.status === 'pending').length,
      totalCoins,
      dailyDownloads: dl.count || 0,
    };
  }

  function getAllPosts() {
    if (FS()) return FS().getPosts(B);
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
    return FS() ? FS().getDevSubmissions() : load(KEYS.devSubmissions, []);
  }

  function getInquiries() {
    return FS() ? FS().getInquiries() : load(KEYS.inquiries, []);
  }

  function getPayouts() {
    if (FS()) return FS().getPayouts();
    let payouts = load(KEYS.payouts, null);
    if (!payouts) {
      payouts = [
        { id: 'pay1', nick: '스킨마스터', email: 'creator@toy-tools.com', amount: 50000, coins: 50000, status: 'pending', requestedAt: '2026-07-25' },
      ];
      save(KEYS.payouts, payouts);
    }
    return payouts;
  }

  function getBlacklist() {
    return FS() ? FS().getBlacklist() : load(KEYS.blacklist, []);
  }

  function getMuted() {
    return FS() ? FS().getMuted() : load(KEYS.muted, []);
  }

  function getChangelog() {
    return FS() ? FS().getChangelog() : load(KEYS.changelog, B.getChangelogDefault());
  }

  function getFaq() {
    return FS() ? FS().getFaq() : load(KEYS.faq, B.getFaqDefault());
  }

  function getDownloadInfo() {
    return FS() ? FS().getDownload() : load(KEYS.download, {
      version: 'v1.0.0', url: '#', notes: 'Windows 10/11 · 포터블 .exe · 무설치',
    });
  }

  function getSettings() {
    return FS() ? FS().getSettings() : load(KEYS.settings, {
      maintenance: false, registrationOpen: true, marketOpen: true, notice: '',
    });
  }

  async function persistConfig(partial) {
    if (FS()) await FS().saveConfig(partial);
    else {
      if (partial.settings) save(KEYS.settings, partial.settings);
      if (partial.download) save(KEYS.download, partial.download);
      if (partial.blacklist) save(KEYS.blacklist, partial.blacklist);
      if (partial.muted) save(KEYS.muted, partial.muted);
      if (partial.changelog) save(KEYS.changelog, partial.changelog);
      if (partial.faq) save(KEYS.faq, partial.faq);
      if (partial.dailyDownloads) save(KEYS.downloadsToday, partial.dailyDownloads);
    }
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
                <td>${B.escapeHtml(item.author || item.creator || '-')}</td>
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
      inp.addEventListener('change', async () => {
        const items = getMarketItems();
        const item = items.find((i) => i.id === inp.dataset.toggleActive);
        if (item) {
          item.active = inp.checked;
          if (FS()) await FS().upsertMarketItem(item);
          else await saveMarketItems(items);
          B.showToast(item.active ? '노출 활성화' : '노출 숨김');
        }
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
        onConfirm: async () => {
          if (FS()) await FS().deleteMarketItem(btn.dataset.delItem);
          else await saveMarketItems(getMarketItems().filter((i) => i.id !== btn.dataset.delItem));
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

  async function updateMarketStatus(id, status) {
    const items = getMarketItems();
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const approved = status === 'approved';
    if (FS()?.updateStoreToyReview) {
      await FS().updateStoreToyReview(id, { approved, status });
    } else {
      item.status = status;
      item.approved = approved;
      if (approved) item.active = true;
      if (FS()) await FS().upsertMarketItem(item);
      else await saveMarketItems(items);
    }
    B.showToast(status === 'approved' ? '승인되었습니다.' : '반려되었습니다.');
    renderPanel();
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
    form.onsubmit = async (e) => {
      e.preventDefault();
      item.name = document.getElementById('sadmin-item-name').value.trim();
      item.price = Number(document.getElementById('sadmin-item-price').value) || 0;
      item.desc = document.getElementById('sadmin-item-desc').value.trim();
      item.emoji = document.getElementById('sadmin-item-emoji').value.trim();
      if (FS()) await FS().upsertMarketItem(item);
      else {
        const items = getMarketItems();
        const idx = items.findIndex((i) => i.id === id);
        if (idx >= 0) items[idx] = item;
        await saveMarketItems(items);
      }
      B.closeModal('modal-sadmin-item');
      B.showToast('아이템이 수정되었습니다.');
      renderPanel();
    };
    B.openModal('modal-sadmin-item');
  }

  // ── Home Toys (장난감 소개) ──
  function renderToysManagement(el) {
    if (!requireAdmin()) {
      el.innerHTML = '<p class="sadmin-empty">슈퍼관리자 권한이 필요합니다.</p>';
      return;
    }
    const toys = getHomeToys();

    el.innerHTML = `
      <div class="sadmin-page-head sadmin-page-head-row">
        <div>
          <h1 class="sadmin-page-title">장난감 관리</h1>
          <p class="sadmin-page-desc">ToyTools 소개 → 장난감 카드 CRUD (Firestore: toys) — #toys 섹션 실시간 반영</p>
        </div>
        <button type="button" class="sadmin-btn sadmin-btn-primary" id="sadmin-toy-add">+ 장난감 등록</button>
      </div>
      <div class="sadmin-card">
        <div class="sadmin-table-wrap">
          <table class="sadmin-table">
            <thead>
              <tr><th>아이콘</th><th>제목</th><th>태그</th><th>설명</th><th>다운로드</th><th>관리</th></tr>
            </thead>
            <tbody>
              ${toys.length ? toys.map((t) => `
                <tr>
                  <td class="text-2xl">${t.icon || '🧩'}</td>
                  <td><strong>${B.escapeHtml(t.title)}</strong></td>
                  <td><span class="sadmin-tag">${B.escapeHtml(t.tag || '-')}</span></td>
                  <td class="text-sm text-gray-400 max-w-[220px] truncate">${B.escapeHtml(t.desc || '')}</td>
                  <td><span class="sadmin-status sadmin-status-${t.downloadStatus === 'available' ? 'approved' : 'pending'}">${B.escapeHtml(t.downloadStatus || 'available')}</span></td>
                  <td>
                    <div class="sadmin-actions">
                      <button type="button" class="sadmin-btn" data-edit-toy="${B.escapeHtml(t.id)}">수정</button>
                      <button type="button" class="sadmin-btn sadmin-btn-danger" data-del-toy="${B.escapeHtml(t.id)}">삭제</button>
                    </div>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="6" class="sadmin-empty">등록된 장난감이 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `
    document.getElementById('sadmin-toy-add')?.addEventListener('click', () => openToyEdit(null));
    el.querySelectorAll('[data-edit-toy]').forEach((btn) => {
      btn.addEventListener('click', () => openToyEdit(btn.dataset.editToy));
    });
    el.querySelectorAll('[data-del-toy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.delToy;
        confirmAction({
          title: '장난감 삭제',
          message: '이 장난감 카드를 삭제합니다. 메인 페이지에서도 즉시 제거됩니다.',
          danger: true,
          onConfirm: async () => {
            try {
              if (FS()) await FS().deleteHomeToy(id);
              else {
                await saveHomeToysLocal(getHomeToys().filter((t) => t.id !== id));
              }
              B.showToast('장난감이 삭제되었습니다.');
              renderPanel();
            } catch (err) {
              B.showToast(err.message || '삭제에 실패했습니다.');
            }
          },
        });
      });
    });
  }

  function openToyEdit(id) {
    if (!requireAdmin()) return;
    const item = id ? getHomeToys().find((t) => t.id === id) : null;
    const form = document.getElementById('sadmin-toy-form');
    if (!form) return;
    form.innerHTML = `
      <div><label class="form-label">장난감 이름</label><input type="text" id="sadmin-toy-title" class="form-input" value="${B.escapeHtml(item?.title || '')}" required /></div>
      <div><label class="form-label">설명</label><textarea id="sadmin-toy-desc" class="form-input min-h-[80px]" required>${B.escapeHtml(item?.desc || '')}</textarea></div>
      <div class="grid sm:grid-cols-2 gap-3">
        <div><label class="form-label">태그</label><input type="text" id="sadmin-toy-tag" class="form-input" value="${B.escapeHtml(item?.tag || '')}" placeholder="영상, 데이터, 유틸…" /></div>
        <div><label class="form-label">대표 아이콘 (Emoji)</label><input type="text" id="sadmin-toy-icon" class="form-input" value="${B.escapeHtml(item?.icon || '🧩')}" maxlength="4" /></div>
      </div>
      <div class="grid sm:grid-cols-2 gap-3">
        <div><label class="form-label">액센트 색상</label><input type="text" id="sadmin-toy-accent" class="form-input" value="${B.escapeHtml(item?.accent || '#6366F1')}" placeholder="#6366F1" /></div>
        <div><label class="form-label">표시 순서</label><input type="number" id="sadmin-toy-order" class="form-input" value="${item?.order ?? getHomeToys().length}" min="0" /></div>
      </div>
      <div class="grid sm:grid-cols-2 gap-3">
        <div><label class="form-label">다운로드 링크</label><input type="url" id="sadmin-toy-download" class="form-input" value="${B.escapeHtml(item?.downloadUrl || '')}" placeholder="https://..." /></div>
        <div><label class="form-label">다운로드 상태</label>
          <select id="sadmin-toy-status" class="form-input">
            <option value="available"${(item?.downloadStatus || 'available') === 'available' ? ' selected' : ''}>available</option>
            <option value="beta"${item?.downloadStatus === 'beta' ? ' selected' : ''}>beta</option>
            <option value="coming_soon"${item?.downloadStatus === 'coming_soon' ? ' selected' : ''}>coming_soon</option>
          </select>
        </div>
      </div>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="sadmin-toy-active" ${item?.active !== false ? 'checked' : ''} /> 메인 페이지에 노출</label>
      <button type="submit" class="toy-btn-3d toy-btn-3d-sm w-full justify-center mt-2">${item ? '수정 저장' : '등록'}</button>
    `;

    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!requireAdmin()) return;
      const payload = {
        id: item?.id,
        title: document.getElementById('sadmin-toy-title').value.trim(),
        desc: document.getElementById('sadmin-toy-desc').value.trim(),
        tag: document.getElementById('sadmin-toy-tag').value.trim(),
        icon: document.getElementById('sadmin-toy-icon').value.trim() || '🧩',
        accent: document.getElementById('sadmin-toy-accent').value.trim() || '#6366F1',
        order: Number(document.getElementById('sadmin-toy-order').value) || 0,
        downloadUrl: document.getElementById('sadmin-toy-download').value.trim(),
        downloadStatus: document.getElementById('sadmin-toy-status').value,
        active: document.getElementById('sadmin-toy-active').checked,
      };
      try {
        if (FS()) await FS().upsertHomeToy(payload);
        else {
          const list = [...getHomeToys()];
          const newId = payload.id || `local_toy_${Date.now()}`;
          const mapped = { ...payload, id: newId };
          const idx = list.findIndex((t) => t.id === newId);
          if (idx >= 0) list[idx] = mapped;
          else list.push(mapped);
          await saveHomeToysLocal(list);
        }
        B.closeModal('modal-sadmin-toy');
        B.showToast(item ? '장난감이 수정되었습니다.' : '장난감이 등록되었습니다.');
        renderPanel();
      } catch (err) {
        B.showToast(err.message || '저장에 실패했습니다.');
      }
    };
    B.openModal('modal-sadmin-toy');
  }

  // ── Devlogs (개발일지) ──
  function renderDevlogsManagement(el) {
    if (!requireAdmin()) {
      el.innerHTML = '<p class="sadmin-empty">슈퍼관리자 권한이 필요합니다.</p>';
      return;
    }
    const logs = getDevlogs();

    el.innerHTML = `
      <div class="sadmin-page-head sadmin-page-head-row">
        <div>
          <h1 class="sadmin-page-title">개발일지 관리</h1>
          <p class="sadmin-page-desc">ToyTools 소개 → 개발일지 서브탭 CRUD (Firestore: devlogs)</p>
        </div>
        <button type="button" class="sadmin-btn sadmin-btn-primary" id="sadmin-devlog-add">+ 개발일지 작성</button>
      </div>
      <div class="sadmin-card">
        <div class="sadmin-table-wrap">
          <table class="sadmin-table">
            <thead>
              <tr><th>작성일</th><th>제목</th><th>카테고리</th><th>작성자</th><th>관리</th></tr>
            </thead>
            <tbody>
              ${logs.length ? logs.map((d) => `
                <tr>
                  <td>${B.escapeHtml(d.date || '-')}</td>
                  <td>${d.emoji || '📝'} ${B.escapeHtml(d.title)}</td>
                  <td>${B.escapeHtml(d.category || '-')}</td>
                  <td>${B.escapeHtml(d.author || 'ToyTools')}</td>
                  <td>
                    <div class="sadmin-actions">
                      <button type="button" class="sadmin-btn" data-edit-devlog="${B.escapeHtml(d.id)}">수정</button>
                      <button type="button" class="sadmin-btn sadmin-btn-danger" data-del-devlog="${B.escapeHtml(d.id)}">삭제</button>
                    </div>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="5" class="sadmin-empty">등록된 개발일지가 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('sadmin-devlog-add')?.addEventListener('click', () => openDevlogEdit(null));
    el.querySelectorAll('[data-edit-devlog]').forEach((btn) => {
      btn.addEventListener('click', () => openDevlogEdit(btn.dataset.editDevlog));
    });
    el.querySelectorAll('[data-del-devlog]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.delDevlog;
        confirmAction({
          title: '개발일지 삭제',
          message: '이 개발일지를 삭제합니다. 메인 페이지에서도 즉시 제거됩니다.',
          danger: true,
          onConfirm: async () => {
            try {
              if (FS()) await FS().deleteDevlog(id);
              else await saveDevlogsLocal(getDevlogs().filter((d) => d.id !== id));
              B.showToast('개발일지가 삭제되었습니다.');
              renderPanel();
            } catch (err) {
              B.showToast(err.message || '삭제에 실패했습니다.');
            }
          },
        });
      });
    });
  }

  function openDevlogEdit(id) {
    if (!requireAdmin()) return;
    const item = id ? getDevlogs().find((d) => d.id === id) : null;
    const form = document.getElementById('sadmin-devlog-form');
    if (!form) return;
    form.innerHTML = `
      <div><label class="form-label">일지 제목</label><input type="text" id="sadmin-devlog-title" class="form-input" value="${B.escapeHtml(item?.title || '')}" required /></div>
      <div class="grid sm:grid-cols-2 gap-3">
        <div><label class="form-label">작성자</label><input type="text" id="sadmin-devlog-author" class="form-input" value="${B.escapeHtml(item?.author || 'ToyTools')}" /></div>
        <div><label class="form-label">작성일</label><input type="date" id="sadmin-devlog-date" class="form-input" value="${B.escapeHtml(item?.date || B.formatDate(new Date()))}" /></div>
      </div>
      <div class="grid sm:grid-cols-3 gap-3">
        <div><label class="form-label">카테고리</label><input type="text" id="sadmin-devlog-category" class="form-input" value="${B.escapeHtml(item?.category || '개발 비하인드')}" placeholder="v1.0 업데이트, 개발 비하인드…" /></div>
        <div><label class="form-label">아이콘 (Emoji)</label><input type="text" id="sadmin-devlog-emoji" class="form-input" value="${B.escapeHtml(item?.emoji || '📝')}" maxlength="4" /></div>
        <div><label class="form-label">표시 순서</label><input type="number" id="sadmin-devlog-order" class="form-input" value="${item?.order ?? getDevlogs().length}" min="0" /></div>
      </div>
      <div class="grid sm:grid-cols-2 gap-3">
        <div><label class="form-label">썸네일 From 색</label><input type="text" id="sadmin-devlog-from" class="form-input" value="${B.escapeHtml(item?.from || '#FFE0EC')}" /></div>
        <div><label class="form-label">썸네일 To 색</label><input type="text" id="sadmin-devlog-to" class="form-input" value="${B.escapeHtml(item?.to || '#E0F7FF')}" /></div>
      </div>
      <div><label class="form-label">본문 (텍스트/마크다운)</label><textarea id="sadmin-devlog-body" class="form-input min-h-[160px]" required>${B.escapeHtml(item?.body || '')}</textarea></div>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="sadmin-devlog-published" ${item?.published !== false ? 'checked' : ''} /> 메인 페이지에 게시</label>
      <button type="submit" class="toy-btn-3d toy-btn-3d-sm w-full justify-center mt-2">${item ? '수정 저장' : '등록'}</button>
    `;

    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!requireAdmin()) return;
      const payload = {
        id: item?.id,
        title: document.getElementById('sadmin-devlog-title').value.trim(),
        author: document.getElementById('sadmin-devlog-author').value.trim() || 'ToyTools',
        date: document.getElementById('sadmin-devlog-date').value || B.formatDate(new Date()),
        category: document.getElementById('sadmin-devlog-category').value.trim() || '기타',
        emoji: document.getElementById('sadmin-devlog-emoji').value.trim() || '📝',
        order: Number(document.getElementById('sadmin-devlog-order').value) || 0,
        from: document.getElementById('sadmin-devlog-from').value.trim() || '#FFE0EC',
        to: document.getElementById('sadmin-devlog-to').value.trim() || '#E0F7FF',
        body: document.getElementById('sadmin-devlog-body').value.trim(),
        views: item?.views || 0,
        comments: item?.comments || 0,
        published: document.getElementById('sadmin-devlog-published').checked,
      };
      try {
        if (FS()) await FS().upsertDevlog(payload);
        else {
          const list = [...getDevlogs()];
          const newId = payload.id || `local_devlog_${Date.now()}`;
          const mapped = { ...payload, id: newId };
          const idx = list.findIndex((d) => d.id === newId);
          if (idx >= 0) list[idx] = mapped;
          else list.push(mapped);
          await saveDevlogsLocal(list);
        }
        B.closeModal('modal-sadmin-devlog');
        B.showToast(item ? '개발일지가 수정되었습니다.' : '개발일지가 등록되었습니다.');
        renderPanel();
      } catch (err) {
        B.showToast(err.message || '저장에 실패했습니다.');
      }
    };
    B.openModal('modal-sadmin-devlog');
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
    document.getElementById('sadmin-ban-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nick = document.getElementById('sadmin-ban-nick').value.trim();
      if (!nick) return;
      const list = [...getBlacklist()];
      if (!list.includes(nick)) list.push(nick);
      await persistConfig({ blacklist: list });
      B.showToast(`${nick} 블랙리스트 등록`);
      renderCommunity(el);
    }, { once: true });
    document.getElementById('sadmin-mute-btn')?.addEventListener('click', async () => {
      const nick = document.getElementById('sadmin-ban-nick').value.trim();
      if (!nick) return;
      const list = [...getMuted()];
      if (!list.includes(nick)) list.push(nick);
      await persistConfig({ muted: list });
      B.showToast(`${nick} Mute 처리`);
      renderCommunity(el);
    }, { once: true });
    el.querySelectorAll('[data-unban]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const nick = btn.dataset.unban;
        if (btn.dataset.type === 'black') await persistConfig({ blacklist: getBlacklist().filter((n) => n !== nick) });
        else await persistConfig({ muted: getMuted().filter((n) => n !== nick) });
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

    document.getElementById('sadmin-dl-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await persistConfig({
        download: {
          version: document.getElementById('sadmin-dl-ver').value.trim(),
          url: document.getElementById('sadmin-dl-url').value.trim(),
          notes: document.getElementById('sadmin-dl-notes').value.trim(),
        },
      });
      B.renderResources?.();
      B.showToast('다운로드 정보가 저장되었습니다.');
    }, { once: true });
    document.getElementById('sadmin-changelog-add')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const list = [...getChangelog()];
      list.unshift({
        version: document.getElementById('sadmin-cl-ver').value.trim(),
        date: B.formatDate(new Date()),
        notes: document.getElementById('sadmin-cl-notes').value.trim(),
      });
      await persistConfig({ changelog: list });
      B.renderResources?.();
      renderDownloads(el);
    }, { once: true });
    el.querySelectorAll('[data-del-cl]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const list = [...getChangelog()];
        list.splice(Number(btn.dataset.delCl), 1);
        await persistConfig({ changelog: list });
        B.renderResources?.();
        renderDownloads(el);
      });
    });
    document.getElementById('sadmin-faq-add')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const list = [...getFaq()];
      list.push({
        q: document.getElementById('sadmin-faq-q').value.trim(),
        a: document.getElementById('sadmin-faq-a').value.trim(),
      });
      await persistConfig({ faq: list });
      B.renderResources?.();
      renderDownloads(el);
    }, { once: true });
    el.querySelectorAll('[data-del-faq]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const list = [...getFaq()];
        list.splice(Number(btn.dataset.delFaq), 1);
        await persistConfig({ faq: list });
        B.renderResources?.();
        renderDownloads(el);
      });
    });
    el.querySelectorAll('[data-reply-inq]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const reply = prompt('관리자 답변을 입력하세요:');
        if (!reply) return;
        if (FS()) {
          await FS().updateInquiry(btn.dataset.replyInq, {
            answered: true, reply, repliedAt: B.formatDate(new Date()),
          });
        } else {
          const list = getInquiries();
          const item = list.find((q) => q.id === btn.dataset.replyInq);
          if (item) { item.answered = true; item.reply = reply; item.repliedAt = B.formatDate(new Date()); }
          save(KEYS.inquiries, list);
        }
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
        onConfirm: async () => {
          const users = getUsers();
          const u = users.find((x) => x.id === userId);
          if (u) u.status = u.status === 'banned' ? 'normal' : 'banned';
          if (FS()) await FS().updateUser(userId, { status: u?.status });
          else await saveUsers(users);
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
        onConfirm: async () => {
          const users = getUsers();
          const u = users.find((x) => x.id === userId);
          if (u) u.status = 'withdrawn';
          if (FS()) await FS().updateUser(userId, { status: 'withdrawn' });
          else await saveUsers(users);
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

  async function adjustUserCoin(userId, delta) {
    const users = getUsers();
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    const newCash = Math.max(0, (u.cash || 0) + delta);
    if (FS()) await FS().updateUser(userId, { cash: newCash });
    else {
      u.cash = newCash;
      await saveUsers(users);
    }
    B.showToast(`${delta > 0 ? '지급' : '차감'} 완료: ${Math.abs(delta).toLocaleString()}P`);
    openUserModal(userId);
  }

  function getStoreToyExtensions() {
    if (FS()?.getToys) {
      return FS().getToys().filter((t) => t.type === 'extension');
    }
    return getMarketItems().filter((t) => t.type === 'extension');
  }

  // ── Developers & Payouts ──
  function renderDevelopers(el) {
    const extensions = getStoreToyExtensions();
    const pendingExtensions = extensions.filter((t) => t.status === 'pending' || (t.approved !== true && t.status !== 'rejected'));
    const payouts = getPayouts().filter((p) => payoutFilter === 'all' || p.status === payoutFilter);

    el.innerHTML = `
      <div class="sadmin-page-head">
        <h1 class="sadmin-page-title">개발자센터 / 정산 관리</h1>
        <p class="sadmin-page-desc">store_toys 확장팩 검수 및 코인 정산 처리 (실시간)</p>
      </div>
      <div class="sadmin-card">
        <h3 class="sadmin-card-title"><i data-lucide="puzzle" class="w-4 h-4"></i> 확장팩 검수 (store_toys)</h3>
        <div class="sadmin-table-wrap">
          <table class="sadmin-table">
            <thead><tr><th>이름</th><th>카테고리</th><th>가격</th><th>등록자</th><th>상태</th><th>관리</th></tr></thead>
            <tbody>
              ${extensions.length ? extensions.map((ext) => `
                <tr>
                  <td><strong>${B.escapeHtml(ext.name)}</strong><br><span class="text-xs text-gray-500">${B.escapeHtml((ext.description || ext.desc || '').slice(0, 50))}</span></td>
                  <td>${B.escapeHtml(ext.category || '-')}</td>
                  <td>${(ext.price || 0).toLocaleString()}P</td>
                  <td>${B.escapeHtml(ext.author || ext.creator || '-')}</td>
                  <td><span class="sadmin-status sadmin-status-${ext.status || 'pending'}">${statusLabel(ext.status || 'pending')}</span></td>
                  <td>
                    <div class="sadmin-actions">
                      ${(ext.status === 'pending' || ext.approved !== true) && ext.status !== 'rejected' ? `
                        <button type="button" class="sadmin-btn sadmin-btn-primary" data-approve-ext="${B.escapeHtml(ext.id)}">승인</button>
                        <button type="button" class="sadmin-btn" data-reject-ext="${B.escapeHtml(ext.id)}">반려</button>
                      ` : '-'}
                    </div>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="6" class="sadmin-empty">등록된 확장팩이 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
        ${pendingExtensions.length ? `<p class="text-xs text-amber-400 mt-2">승인 대기 ${pendingExtensions.length}건</p>` : ''}
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
    el.querySelectorAll('[data-approve-ext]').forEach((btn) => {
      btn.addEventListener('click', () => updateMarketStatus(btn.dataset.approveExt, 'approved'));
    });
    el.querySelectorAll('[data-reject-ext]').forEach((btn) => {
      btn.addEventListener('click', () => confirmAction({
        title: '확장팩 반려',
        message: '이 확장팩을 반려 처리합니다.',
        danger: true,
        onConfirm: () => updateMarketStatus(btn.dataset.rejectExt, 'rejected'),
      }));
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

  async function updateSubmission(id, status) {
    const subs = getDevSubmissions();
    const s = subs.find((x) => x.id === id);
    if (!s) return;
    if (FS()) await FS().updateDevSubmission(id, { status });
    else {
      s.status = status;
      save(KEYS.devSubmissions, subs);
    }
    if (status === 'approved') {
      const newItem = {
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
      };
      if (FS()) await FS().upsertMarketItem(newItem);
      else {
        const items = getMarketItems();
        items.push(newItem);
        await saveMarketItems(items);
      }
    }
    B.showToast(status === 'approved' ? '신청이 승인되었습니다.' : '신청이 반려되었습니다.');
    renderPanel();
  }

  async function updatePayout(id, status) {
    if (FS()) await FS().updatePayout(id, { status });
    else {
      const payouts = getPayouts();
      const p = payouts.find((x) => x.id === id);
      if (p) { p.status = status; save(KEYS.payouts, payouts); }
    }
    B.showToast(status === 'approved' ? '정산이 승인되었습니다.' : '정산이 거절되었습니다.');
    renderPanel();
  }

  // ── Landing CMS (메인 히어로) ──
  function getLandingConfig() {
    if (FS()) return FS().getLanding();
    return load(KEYS.landing, FS()?.getDefaultLanding?.() || {
      badge: 'v1.0 정식 출시 예정',
      titleLine1: 'AI가 판치는 세상,',
      titleAccent: '가장 가볍고 강력한',
      titleLine2: '개발자·업무용 유틸리티 공장',
      description: '',
      descriptionHighlight: '클릭 한 번',
      ctaLabel: 'ToyTools v1.0 무료 다운로드',
      platformNote: 'Windows 10/11 • 포터블 .exe • 무설치',
      mediaType: 'mockup',
      mediaUrl: '',
      mediaHtml: '',
      stats: [
        { value: '4+', label: '내장 유틸리티' },
        { value: '3', label: '프로 테마' },
        { value: '∞', label: '워크플로우' },
        { value: '0₩', label: '기본 무료' },
      ],
    });
  }

  function renderLandingSettings(el) {
    if (!requireAdmin()) {
      el.innerHTML = '<p class="sadmin-empty">슈퍼관리자 권한이 필요합니다.</p>';
      return;
    }
    const cfg = getLandingConfig();
    const stats = cfg.stats || [];

    el.innerHTML = `
      <div class="sadmin-page-head">
        <h1 class="sadmin-page-title">랜딩페이지 설정</h1>
        <p class="sadmin-page-desc">메인 히어로 섹션 CMS — Firestore <code>settings/landing</code> 실시간 반영</p>
      </div>

      <form id="sadmin-landing-form" class="space-y-6">
        <div class="sadmin-card">
          <h3 class="sadmin-card-title"><i data-lucide="type" class="w-4 h-4"></i> 텍스트 콘텐츠</h3>
          <div class="grid lg:grid-cols-2 gap-4 mt-4">
            <div><label class="form-label">배지 텍스트</label><input type="text" id="landing-badge" class="form-input" value="${B.escapeHtml(cfg.badge || '')}" /></div>
            <div><label class="form-label">CTA 버튼 라벨</label><input type="text" id="landing-cta" class="form-input" value="${B.escapeHtml(cfg.ctaLabel || '')}" /></div>
            <div><label class="form-label">메인 타이틀 1행</label><input type="text" id="landing-title1" class="form-input" value="${B.escapeHtml(cfg.titleLine1 || '')}" /></div>
            <div><label class="form-label">메인 타이틀 강조</label><input type="text" id="landing-title-accent" class="form-input" value="${B.escapeHtml(cfg.titleAccent || '')}" /></div>
            <div class="lg:col-span-2"><label class="form-label">메인 타이틀 2행</label><input type="text" id="landing-title2" class="form-input" value="${B.escapeHtml(cfg.titleLine2 || '')}" /></div>
            <div class="lg:col-span-2"><label class="form-label">서브 설명글</label><textarea id="landing-desc" class="form-input min-h-[100px]">${B.escapeHtml(cfg.description || '')}</textarea></div>
            <div><label class="form-label">설명 강조 키워드</label><input type="text" id="landing-desc-highlight" class="form-input" value="${B.escapeHtml(cfg.descriptionHighlight || '')}" placeholder="클릭 한 번" /></div>
            <div><label class="form-label">플랫폼 안내</label><input type="text" id="landing-platform" class="form-input" value="${B.escapeHtml(cfg.platformNote || '')}" /></div>
          </div>
        </div>

        <div class="sadmin-card">
          <h3 class="sadmin-card-title"><i data-lucide="image" class="w-4 h-4"></i> 우측 비주얼 미디어</h3>
          <div class="grid lg:grid-cols-2 gap-4 mt-4">
            <div>
              <label class="form-label">미디어 타입</label>
              <select id="landing-media-type" class="form-input">
                <option value="mockup"${cfg.mediaType === 'mockup' ? ' selected' : ''}>기본 IDE 미리보기</option>
                <option value="image"${cfg.mediaType === 'image' ? ' selected' : ''}>이미지 URL</option>
                <option value="video"${cfg.mediaType === 'video' ? ' selected' : ''}>비디오 URL</option>
                <option value="html"${cfg.mediaType === 'html' ? ' selected' : ''}>코드 미리보기 HTML</option>
              </select>
            </div>
            <div id="landing-media-url-wrap">
              <label class="form-label">미디어 URL</label>
              <input type="url" id="landing-media-url" class="form-input" value="${B.escapeHtml(cfg.mediaUrl || '')}" placeholder="https://..." />
            </div>
            <div id="landing-media-upload-wrap" class="lg:col-span-2">
              <label class="form-label">파일 업로드 (이미지/비디오)</label>
              <input type="file" id="landing-media-file" class="form-input" accept="image/*,video/*" />
              <p class="text-xs text-gray-500 mt-1">업로드 시 URL 필드에 자동 반영됩니다. (Firebase Storage: landing/)</p>
            </div>
            <div id="landing-media-html-wrap" class="lg:col-span-2 hidden">
              <label class="form-label">코드 미리보기 HTML</label>
              <textarea id="landing-media-html" class="form-input min-h-[160px] font-mono text-xs" placeholder="&lt;motion.div class=&quot;hero-custom-preview&quot;&gt;...&lt;/motion.div&gt;">${B.escapeHtml(cfg.mediaHtml || '')}</textarea>
            </div>
          </div>
        </div>

        <div class="sadmin-card">
          <h3 class="sadmin-card-title"><i data-lucide="bar-chart-3" class="w-4 h-4"></i> 하단 수치 스탯 카드</h3>
          <div class="grid sm:grid-cols-2 gap-4 mt-4">
            ${[0, 1, 2, 3].map((i) => `
              <div class="sadmin-landing-stat-row">
                <span class="text-xs text-gray-500 mb-2 block">카드 ${i + 1}</span>
                <div class="grid grid-cols-2 gap-2">
                  <input type="text" id="landing-stat-value-${i}" class="form-input" value="${B.escapeHtml(stats[i]?.value || '')}" placeholder="숫자" />
                  <input type="text" id="landing-stat-label-${i}" class="form-input" value="${B.escapeHtml(stats[i]?.label || '')}" placeholder="라벨" />
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <button type="submit" class="toy-btn-3d toy-btn-3d-sm">랜딩 설정 저장</button>
      </form>
    `;

    const mediaTypeEl = document.getElementById('landing-media-type');
    const urlWrap = document.getElementById('landing-media-url-wrap');
    const uploadWrap = document.getElementById('landing-media-upload-wrap');
    const htmlWrap = document.getElementById('landing-media-html-wrap');

    function syncMediaFields() {
      const type = mediaTypeEl?.value || 'mockup';
      urlWrap?.classList.toggle('hidden', type === 'mockup' || type === 'html');
      uploadWrap?.classList.toggle('hidden', type === 'mockup' || type === 'html');
      htmlWrap?.classList.toggle('hidden', type !== 'html');
    }
    mediaTypeEl?.addEventListener('change', syncMediaFields);
    syncMediaFields();

    document.getElementById('sadmin-landing-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!requireAdmin()) return;

      const submitBtn = e.target.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        let mediaUrl = document.getElementById('landing-media-url')?.value?.trim() || '';
        const mediaFile = document.getElementById('landing-media-file')?.files?.[0];
        const mediaType = mediaTypeEl?.value || 'mockup';

        if (mediaFile && (mediaType === 'image' || mediaType === 'video')) {
          const uid = B.getCurrentUser?.()?.uid || 'admin';
          if (FS()?.uploadLandingMedia) {
            mediaUrl = await FS().uploadLandingMedia(mediaFile, uid);
          } else {
            throw new Error('Firebase Storage 업로드를 사용할 수 없습니다.');
          }
        }

        const payload = {
          badge: document.getElementById('landing-badge')?.value?.trim(),
          titleLine1: document.getElementById('landing-title1')?.value?.trim(),
          titleAccent: document.getElementById('landing-title-accent')?.value?.trim(),
          titleLine2: document.getElementById('landing-title2')?.value?.trim(),
          description: document.getElementById('landing-desc')?.value?.trim(),
          descriptionHighlight: document.getElementById('landing-desc-highlight')?.value?.trim(),
          ctaLabel: document.getElementById('landing-cta')?.value?.trim(),
          platformNote: document.getElementById('landing-platform')?.value?.trim(),
          mediaType,
          mediaUrl,
          mediaHtml: document.getElementById('landing-media-html')?.value || '',
          stats: [0, 1, 2, 3].map((i) => ({
            value: document.getElementById(`landing-stat-value-${i}`)?.value?.trim() || '',
            label: document.getElementById(`landing-stat-label-${i}`)?.value?.trim() || '',
          })),
        };

        if (FS()) await FS().saveLanding(payload);
        else {
          save(KEYS.landing, payload);
          B.renderHero?.();
        }
        B.showToast('랜딩페이지 설정이 저장되었습니다.');
      } catch (err) {
        console.error('[SuperAdmin] 랜딩 설정 저장 실패:', err);
        B.showToast(err.message || '저장에 실패했습니다.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
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

    document.getElementById('sadmin-save-settings')?.addEventListener('click', async () => {
      await persistConfig({
        settings: {
          maintenance: document.getElementById('sadmin-set-maint').checked,
          registrationOpen: document.getElementById('sadmin-set-reg').checked,
          marketOpen: document.getElementById('sadmin-set-market').checked,
          notice: document.getElementById('sadmin-set-notice').value.trim(),
        },
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
      if (FS()) FS().addDevSubmission(data);
      else {
        const subs = getDevSubmissions();
        subs.unshift({ ...data, id: 'sub_' + Date.now(), status: 'pending', submittedAt: Date.now() });
        save(KEYS.devSubmissions, subs);
      }
    },
    addInquiry(data) {
      if (FS()) FS().addInquiry(data);
      else {
        const list = getInquiries();
        list.unshift({ ...data, id: 'inq_' + Date.now(), answered: false, createdAt: Date.now() });
        save(KEYS.inquiries, list);
      }
    },
    getChangelog,
    getFaq,
    getDownloadInfo,
    incrementDownloadCount() {
      if (FS()) FS().incrementDownloadCount(B.formatDate);
      else {
        const dl = load(KEYS.downloadsToday, { date: B.formatDate(new Date()), count: 0 });
        const today = B.formatDate(new Date());
        if (dl.date !== today) { dl.date = today; dl.count = 0; }
        dl.count += 1;
        save(KEYS.downloadsToday, dl);
      }
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

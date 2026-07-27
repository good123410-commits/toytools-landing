/**
 * ToyTools Firestore Data Store
 * Firebase 연동 시 실시간 동기화, 미설정 시 localStorage 폴백
 */
(function () {
  'use strict';

  const LS = {
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
    extensions: 'toytools_extensions',
    toysHome: 'toytools_home_toys',
    devlogs: 'toytools_devlogs',
    landing: 'toytools_landing',
  };

  let bridge = null;
  let db = null;
  let fs = null;
  let ready = false;
  let readyResolve = null;
  const readyPromise = new Promise((r) => { readyResolve = r; });

  const COL = { skins: 'store_skins', toys: 'store_toys' };
  const DEFAULT_BG = 'linear-gradient(135deg, #1e293b, #0f172a)';

  const unsub = [];
  const cache = {
    skins: [],
    toys: [],
    market: [],
    users: [],
    posts: [],
    inquiries: [],
    payouts: [],
    devSubmissions: [],
    extensions: [],
    homeToys: [],
    devlogs: [],
    settings: { maintenance: false, registrationOpen: true, marketOpen: true, notice: '' },
    download: { version: 'v1.0.0', url: '#', notes: 'Windows 10/11 · 포터블 .exe · 무설치' },
    blacklist: [],
    muted: [],
    changelog: [],
    faq: [],
    dailyDownloads: { date: '', count: 0 },
    landing: null,
  };

  function buildDefaultLanding() {
    return {
      badge: 'v1.0 정식 출시 예정',
      titleLine1: 'AI가 판치는 세상,',
      titleAccent: '가장 가볍고 강력한',
      titleLine2: '개발자·업무용 유틸리티 공장',
      description: '복잡한 오픈소스 설정, 무거운 IDE, 끝없는 CLI.\nToyTools는 클릭 한 번으로 끝나는 프로급 생산성 스택입니다.',
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
    };
  }

  function mergeLanding(data) {
    const defaults = buildDefaultLanding();
    if (!data) return { ...defaults };
    return {
      ...defaults,
      ...data,
      stats: Array.isArray(data.stats) && data.stats.length
        ? data.stats.map((s, i) => ({
          value: s?.value ?? defaults.stats[i]?.value ?? '',
          label: s?.label ?? defaults.stats[i]?.label ?? '',
        }))
        : defaults.stats,
    };
  }

  function lsLoad(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function lsSave(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function fmtDate(d) {
    if (!d) return '-';
    const dt = d.toDate ? d.toDate() : new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  function pick(data, ...keys) {
    for (const k of keys) {
      if (data[k] != null && data[k] !== '') return data[k];
    }
    return undefined;
  }

  function normalizeToyType(data) {
    const packType = normalizeProductPackType(data);
    if (packType === 'skin') return 'skin';
    if (packType === 'game') return 'game';
    const raw = String(pick(data, 'type', 'itemType', 'toyType') || '').toLowerCase();
    if (raw.includes('extension') || raw.includes('확장')) return 'extension';
    if (raw.includes('game') || raw.includes('mini') || raw.includes('미니')) return 'game';
    if (raw.includes('skin') || raw.includes('스킨')) return 'skin';
    if (pick(data, 'code_body', 'codeBody', 'package_url', 'packageUrl')) return 'extension';
    return 'game';
  }

  function normalizeProductPackType(data) {
    const raw = String(pick(data, 'pack_type', 'packType') || '').toLowerCase();
    if (raw === 'extension' || raw === 'skin' || raw === 'game') return raw;
    if (raw === 'script' || raw === 'package') {
      const type = String(pick(data, 'type', 'itemType') || '').toLowerCase();
      if (type === 'skin') return 'skin';
      if (type === 'game') return 'game';
      return 'extension';
    }
    const type = String(pick(data, 'type', 'itemType') || '').toLowerCase();
    if (type === 'skin') return 'skin';
    if (type === 'game') return 'game';
    return 'extension';
  }

  function normalizeDeliveryType(data) {
    const raw = String(pick(data, 'delivery_type', 'deliveryType') || '').toLowerCase();
    if (raw === 'script' || raw === 'package') return raw;
    const legacyPack = String(pick(data, 'pack_type', 'packType') || '').toLowerCase();
    if (legacyPack === 'script' || legacyPack === 'package') return legacyPack;
    return pick(data, 'package_url', 'packageUrl') ? 'package' : 'script';
  }

  function productEmoji(packType) {
    return { extension: '🧩', skin: '🎨', game: '🎮' }[packType] || '📦';
  }

  const DANGEROUS_CODE_PATTERNS = [
    { pattern: /\bos\.system\s*\(/, label: 'os.system' },
    { pattern: /\bos\.popen\s*\(/, label: 'os.popen' },
    { pattern: /\bos\.remove\s*\(/, label: 'os.remove' },
    { pattern: /\bos\.unlink\s*\(/, label: 'os.unlink' },
    { pattern: /\bos\.rmdir\s*\(/, label: 'os.rmdir' },
    { pattern: /\bshutil\.rmtree\s*\(/, label: 'shutil.rmtree' },
    { pattern: /\bsubprocess\.(call|Popen|run|check_output|check_call)\s*\(/, label: 'subprocess 실행' },
    { pattern: /\bwinreg\./, label: 'winreg (레지스트리 수정)' },
    { pattern: /\bctypes\.windll\b/, label: 'ctypes.windll' },
    { pattern: /\beval\s*\(/, label: 'eval()' },
    { pattern: /\bexec\s*\(/, label: 'exec()' },
    { pattern: /\b__import__\s*\(/, label: '__import__()' },
    { pattern: /\bpickle\.loads?\s*\(/, label: 'pickle 역직렬화' },
    { pattern: /\bsocket\.(socket|create_connection)\s*\(/, label: 'socket 연결' },
    { pattern: /\brequests\.(get|post|put|delete|request)\s*\(/, label: '외부 HTTP 요청' },
  ];

  function scanPythonCode(code) {
    const source = String(code || '');
    if (!source.trim()) {
      return { safe: false, matches: ['코드가 비어 있습니다.'] };
    }
    const matches = [];
    DANGEROUS_CODE_PATTERNS.forEach(({ pattern, label }) => {
      if (pattern.test(source)) matches.push(label);
    });
    return { safe: matches.length === 0, matches };
  }

  function buildSecurityScanError(matches) {
    const list = (matches || []).slice(0, 8).join(', ');
    const extra = (matches || []).length > 8 ? ' 외 추가 항목' : '';
    return new Error(`보안 검사에 실패했습니다. 위험 키워드가 감지되어 업로드가 차단되었습니다: ${list}${extra}`);
  }

  async function scanZipPackage(file) {
    if (!file?.name?.toLowerCase().endsWith('.zip')) {
      throw new Error('.zip 패키지 파일만 업로드할 수 있습니다.');
    }
    if (typeof JSZip === 'undefined') {
      throw new Error('ZIP 검사 모듈을 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
    }
    const zip = await JSZip.loadAsync(file);
    const pyEntries = Object.keys(zip.files).filter((name) => {
      const entry = zip.files[name];
      return entry && !entry.dir && name.toLowerCase().endsWith('.py');
    });
    if (!pyEntries.length) {
      return { safe: true, matches: [], scannedFiles: 0 };
    }
    const allMatches = new Set();
    for (const name of pyEntries) {
      const content = await zip.files[name].async('string');
      const result = scanPythonCode(content);
      if (!result.safe) {
        result.matches.forEach((m) => allMatches.add(`${name}: ${m}`));
      }
    }
    const matches = [...allMatches];
    return { safe: matches.length === 0, matches, scannedFiles: pyEntries.length };
  }

  function mapSkin(id, data) {
    return {
      id,
      _collection: COL.skins,
      type: 'skin',
      name: pick(data, 'name', 'title') || '스킨',
      desc: pick(data, 'desc', 'description') || '',
      price: Number(pick(data, 'price', 'point', 'points', 'cost') || 0),
      emoji: pick(data, 'emoji', 'icon') || '🎨',
      bg: pick(data, 'bg', 'background', 'backgroundGradient', 'thumbnailBg') || DEFAULT_BG,
      gen: pick(data, 'gen', 'tag', 'category', 'label') || 'Pro Theme',
      tag: pick(data, 'tag', 'gen', 'category', 'label') || '',
      status: pick(data, 'status') || 'approved',
      active: data.active !== false && data.enabled !== false && data.isActive !== false,
      creator: pick(data, 'creator', 'author', 'createdBy') || 'ToyTools',
      submittedAt: data.submittedAt || data.createdAt || null,
      _raw: data,
    };
  }

  function mapToy(id, data) {
    const type = normalizeToyType(data);
    const packType = normalizeProductPackType(data);
    const deliveryType = normalizeDeliveryType(data);
    const approved = data.approved === true;
    const status = pick(data, 'status') || (approved ? 'approved' : 'pending');
    const title = pick(data, 'title', 'name') || '토이';
    return {
      id,
      _collection: COL.toys,
      type,
      name: title,
      title,
      desc: pick(data, 'desc', 'description') || '',
      description: pick(data, 'description', 'desc') || '',
      price: Number(pick(data, 'price', 'point', 'points', 'cost') || 0),
      category: pick(data, 'category', 'tag', 'label') || '',
      emoji: pick(data, 'emoji', 'icon') || productEmoji(packType),
      bg: pick(data, 'bg', 'background', 'backgroundGradient', 'thumbnailBg') || DEFAULT_BG,
      tag: pick(data, 'tag', 'gen', 'category', 'label') || (type === 'extension' ? 'Extension' : type === 'skin' ? 'Skin' : 'Mini Game'),
      gen: pick(data, 'gen', 'tag', 'category', 'label') || '',
      status,
      approved,
      active: data.active !== false && data.enabled !== false && data.isActive !== false,
      author: pick(data, 'author', 'creator', 'createdBy') || 'ToyTools',
      authorUid: pick(data, 'authorUid', 'authorId', 'uid') || '',
      pack_type: packType,
      delivery_type: deliveryType,
      code_body: pick(data, 'code_body', 'codeBody', 'content') || '',
      package_url: pick(data, 'package_url', 'packageUrl', 'download_url', 'downloadUrl') || '',
      entry_point: pick(data, 'entry_point', 'entryPoint') || 'main.py',
      fileUrl: pick(data, 'fileUrl', 'downloadUrl', 'url') || '',
      fileName: pick(data, 'fileName', 'filename') || '',
      creator: pick(data, 'creator', 'author', 'createdBy') || 'ToyTools',
      submittedAt: data.submittedAt || data.createdAt || null,
      createdAt: data.createdAt || null,
      _raw: data,
    };
  }

  function getExtensionItems() {
    return cache.toys.filter((t) => t.type === 'extension');
  }

  function mergeMarketCache() {
    cache.market = [...cache.skins, ...cache.toys];
  }

  function mapHomeToy(id, data) {
    return {
      id,
      icon: pick(data, 'icon', 'emoji') || '🧩',
      title: pick(data, 'title', 'name') || '장난감',
      desc: pick(data, 'desc', 'description') || '',
      tag: pick(data, 'tag', 'category') || '',
      accent: pick(data, 'accent', 'color') || '#6366F1',
      downloadUrl: pick(data, 'downloadUrl', 'downloadLink', 'url') || '',
      downloadStatus: pick(data, 'downloadStatus', 'status') || 'available',
      order: Number(data.order ?? 0),
      active: data.active !== false,
      createdAt: data.createdAt || null,
      updatedAt: data.updatedAt || null,
    };
  }

  function mapDevlog(id, data) {
    return {
      id,
      emoji: pick(data, 'emoji', 'icon') || '📝',
      title: pick(data, 'title') || '제목 없음',
      author: pick(data, 'author', 'writer') || 'ToyTools',
      category: pick(data, 'category', 'cat') || '기타',
      body: pick(data, 'body', 'content') || '',
      date: pick(data, 'date') || (data.createdAt ? fmtDate(data.createdAt) : '-'),
      views: Number(data.views ?? 0),
      comments: Number(data.comments ?? 0),
      from: pick(data, 'from', 'thumbFrom') || '#FFE0EC',
      to: pick(data, 'to', 'thumbTo') || '#E0F7FF',
      order: Number(data.order ?? 0),
      published: data.published !== false,
      createdAt: data.createdAt || null,
    };
  }

  function sortHomeToys() {
    cache.homeToys.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function sortDevlogs() {
    cache.devlogs.sort((a, b) => {
      const da = a.date || '';
      const db_ = b.date || '';
      if (da !== db_) return db_.localeCompare(da);
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }

  function buildDefaultHomeToys(B) {
    return (B.getToysDefault?.() || []).map((t, i) => mapHomeToy(`toy_${i + 1}`, {
      ...t,
      order: i,
      downloadUrl: '',
      downloadStatus: 'available',
      active: true,
    }));
  }

  function buildDefaultDevlogs(B) {
    return (B.getDevlogsDefault?.() || []).map((d, i) => mapDevlog(String(d.id ?? i + 1), {
      emoji: d.emoji,
      title: d.title,
      author: 'ToyTools',
      category: '개발 비하인드',
      body: d.body,
      date: d.date,
      views: d.views || 0,
      comments: d.comments || 0,
      thumbFrom: d.from,
      thumbTo: d.to,
      order: i,
      published: true,
    }));
  }

  function assertAdmin() {
    if (!bridge?.isAdmin?.()) {
      throw new Error('슈퍼관리자 권한이 필요합니다.');
    }
  }

  function skinToFirestore(item) {
    const raw = item._raw || {};
    return {
      ...raw,
      name: item.name,
      desc: item.desc,
      price: item.price,
      emoji: item.emoji,
      bg: item.bg,
      gen: item.gen || item.tag,
      tag: item.tag || item.gen,
      status: item.status || 'approved',
      active: item.active !== false,
      creator: item.creator || 'ToyTools',
      submittedAt: item.submittedAt || raw.submittedAt || Date.now(),
    };
  }

  function toyToFirestore(item) {
    const raw = item._raw || {};
    const status = item.status || raw.status || (item.approved ? 'approved' : 'pending');
    const packType = item.pack_type || raw.pack_type || normalizeProductPackType(item);
    const title = item.title || item.name || raw.title || raw.name || '';
    return {
      ...raw,
      title,
      name: title,
      desc: item.desc || item.description,
      description: item.description || item.desc || '',
      price: item.price,
      emoji: item.emoji || productEmoji(packType),
      bg: item.bg,
      type: item.type || packType,
      itemType: item.type || packType,
      category: item.category || item.tag || raw.category || '',
      tag: item.tag || item.gen || item.category,
      status,
      approved: item.approved === true || status === 'approved',
      active: item.active !== false,
      author: item.author || item.creator || raw.author || 'ToyTools',
      authorUid: item.authorUid || raw.authorUid || '',
      pack_type: packType,
      delivery_type: item.delivery_type || raw.delivery_type || normalizeDeliveryType(item),
      code_body: item.code_body || raw.code_body || '',
      package_url: item.package_url || raw.package_url || '',
      entry_point: item.entry_point || raw.entry_point || 'main.py',
      fileUrl: item.fileUrl || raw.fileUrl || '',
      fileName: item.fileName || raw.fileName || '',
      creator: item.creator || item.author || 'ToyTools',
      submittedAt: item.submittedAt || raw.submittedAt || Date.now(),
    };
  }

  function mapUser(id, data) {
    return {
      id,
      nick: data.nickname || data.nick || '유저',
      email: data.email || '',
      cash: data.cash || 0,
      status: data.status || 'normal',
      joinedAt: data.createdAt ? fmtDate(data.createdAt) : (data.joinedAt || '-'),
      role: data.role || 'user',
      ownedSkins: data.ownedSkins || [],
      ownedItems: data.ownedItems || [],
    };
  }

  function buildDefaultMarket(B) {
    const items = [];
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
    return items;
  }

  function loadLocalCache(B) {
    const fallbackMarket = lsLoad(LS.market, null) || buildDefaultMarket(B);
    cache.skins = fallbackMarket.filter((i) => i.type === 'skin').map((i) => mapSkin(i.id, i));
    cache.toys = fallbackMarket.filter((i) => i.type !== 'skin').map((i) => mapToy(i.id, i));
    mergeMarketCache();
    if (!lsLoad(LS.market, null)) lsSave(LS.market, cache.market);

    cache.users = lsLoad(LS.users, null) || [
      { id: 'u1', nick: '장난감초보', email: 'demo1@toy-tools.com', cash: 12500, status: 'normal', joinedAt: '2026-06-15', role: 'user' },
      { id: 'u2', nick: '스킨마스터', email: 'creator@toy-tools.com', cash: 48200, status: 'normal', joinedAt: '2026-05-20', role: 'creator' },
    ];
    if (!lsLoad(LS.users, null)) lsSave(LS.users, cache.users);

    cache.inquiries = lsLoad(LS.inquiries, []);
    cache.payouts = lsLoad(LS.payouts, null) || [
      { id: 'pay1', nick: '스킨마스터', email: 'creator@toy-tools.com', amount: 50000, coins: 50000, status: 'pending', requestedAt: '2026-07-25' },
    ];
    if (!lsLoad(LS.payouts, null)) lsSave(LS.payouts, cache.payouts);

    cache.devSubmissions = lsLoad(LS.devSubmissions, []);
    cache.homeToys = lsLoad(LS.toysHome, null) || buildDefaultHomeToys(B);
    if (!lsLoad(LS.toysHome, null)) lsSave(LS.toysHome, cache.homeToys);
    cache.devlogs = lsLoad(LS.devlogs, null) || buildDefaultDevlogs(B);
    if (!lsLoad(LS.devlogs, null)) lsSave(LS.devlogs, cache.devlogs);
    sortHomeToys();
    sortDevlogs();
    cache.settings = lsLoad(LS.settings, cache.settings);
    cache.download = lsLoad(LS.download, cache.download);
    cache.blacklist = lsLoad(LS.blacklist, []);
    cache.muted = lsLoad(LS.muted, []);
    cache.changelog = lsLoad(LS.changelog, B.getChangelogDefault());
    cache.faq = lsLoad(LS.faq, B.getFaqDefault());
    cache.dailyDownloads = lsLoad(LS.downloadsToday, { date: B.formatDate(new Date()), count: 42 });
    cache.landing = mergeLanding(lsLoad(LS.landing, null));
    cache.posts = [];
  }

  function applyConfigDoc(data) {
    if (!data) return;
    if (data.settings) cache.settings = { ...cache.settings, ...data.settings };
    if (data.download) cache.download = { ...cache.download, ...data.download };
    if (data.blacklist) cache.blacklist = data.blacklist;
    if (data.muted) cache.muted = data.muted;
    if (data.changelog) cache.changelog = data.changelog;
    if (data.faq) cache.faq = data.faq;
    if (data.dailyDownloads) cache.dailyDownloads = data.dailyDownloads;
  }

  function notify() {
    bridge?.onDataChange?.();
  }

  async function seedIfEmpty() {
    if (!ready || !db) return;

    const configRef = db.collection('config').doc('site');
    const configSnap = await configRef.get();
    if (!configSnap.exists) {
      await configRef.set({
        settings: cache.settings,
        download: cache.download,
        blacklist: [],
        muted: [],
        changelog: bridge.getChangelogDefault(),
        faq: bridge.getFaqDefault(),
        dailyDownloads: { date: bridge.formatDate(new Date()), count: 0 },
      });
    }

    const toysSnap = await db.collection('toys').limit(1).get();
    if (toysSnap.empty) {
      const batch = db.batch();
      buildDefaultHomeToys(bridge).forEach((t) => {
        batch.set(db.collection('toys').doc(t.id), {
          title: t.title,
          desc: t.desc,
          tag: t.tag,
          icon: t.icon,
          accent: t.accent,
          downloadUrl: t.downloadUrl || '',
          downloadStatus: t.downloadStatus || 'available',
          order: t.order,
          active: true,
          createdAt: fs.FieldValue.serverTimestamp(),
          updatedAt: fs.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    const devlogsSnap = await db.collection('devlogs').limit(1).get();
    if (devlogsSnap.empty) {
      const batch = db.batch();
      buildDefaultDevlogs(bridge).forEach((d) => {
        batch.set(db.collection('devlogs').doc(d.id), {
          title: d.title,
          author: d.author,
          category: d.category,
          emoji: d.emoji,
          body: d.body,
          date: d.date,
          views: d.views,
          comments: d.comments,
          thumbFrom: d.from,
          thumbTo: d.to,
          order: d.order,
          published: true,
          createdAt: fs.FieldValue.serverTimestamp(),
          updatedAt: fs.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    const landingRef = db.collection('settings').doc('landing');
    const landingSnap = await landingRef.get();
    if (!landingSnap.exists) {
      await landingRef.set({
        ...buildDefaultLanding(),
        updatedAt: fs.FieldValue.serverTimestamp(),
      });
    }
  }

  function startListeners() {
    unsub.forEach((fn) => fn());
    unsub.length = 0;

    unsub.push(
      db.collection(COL.skins).onSnapshot((snap) => {
        cache.skins = snap.docs.map((d) => mapSkin(d.id, d.data()));
        mergeMarketCache();
        notify();
      }, (err) => {
        console.error('[FirebaseStore] store_skins 구독 실패:', err);
      }),
      db.collection(COL.toys).onSnapshot((snap) => {
        cache.toys = snap.docs.map((d) => mapToy(d.id, d.data()));
        mergeMarketCache();
        notify();
      }, (err) => {
        console.error('[FirebaseStore] store_toys 구독 실패:', err);
      }),
      db.collection('users').onSnapshot((snap) => {
        cache.users = snap.docs.map((d) => mapUser(d.id, d.data()));
        notify();
      }, (err) => {
        console.warn('[FirebaseStore] users 구독 실패 — 로그인 또는 규칙을 확인하세요:', err);
      }),
      db.collection('posts').onSnapshot((snap) => {
        const boards = bridge.getBoards();
        const boardMap = Object.fromEntries(boards.map((b) => [b.id, b.name]));
        cache.posts = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            boardName: boardMap[data.boardId] || data.boardId,
          };
        });
        cache.posts.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || a.createdAt || 0;
          const tb = b.createdAt?.toMillis?.() || b.createdAt || 0;
          return tb - ta;
        });
        notify();
      }),
      db.collection('inquiries').orderBy('createdAt', 'desc').onSnapshot((snap) => {
        cache.inquiries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        notify();
      }, () => {
        db.collection('inquiries').onSnapshot((snap) => {
          cache.inquiries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          notify();
        });
      }),
      db.collection('dev_submissions').onSnapshot((snap) => {
        cache.devSubmissions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        notify();
      }),
      db.collection('payouts').onSnapshot((snap) => {
        cache.payouts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        notify();
      }),
      db.collection('config').doc('site').onSnapshot((doc) => {
        applyConfigDoc(doc.exists ? doc.data() : null);
        notify();
      }),
      db.collection('toys').onSnapshot((snap) => {
        cache.homeToys = snap.docs.map((d) => mapHomeToy(d.id, d.data()));
        sortHomeToys();
        notify();
      }, (err) => {
        console.error('[FirebaseStore] toys 구독 실패:', err);
      }),
      db.collection('devlogs').onSnapshot((snap) => {
        cache.devlogs = snap.docs.map((d) => mapDevlog(d.id, d.data()));
        sortDevlogs();
        notify();
      }, (err) => {
        console.error('[FirebaseStore] devlogs 구독 실패:', err);
      }),
      db.collection('settings').doc('landing').onSnapshot((doc) => {
        cache.landing = mergeLanding(doc.exists ? doc.data() : null);
        notify();
      }, (err) => {
        console.error('[FirebaseStore] settings/landing 구독 실패:', err);
      }),
    );
  }

  async function init(B) {
    bridge = B;
    loadLocalCache(B);

    if (!B.isFirebaseReady()) {
      ready = false;
      readyResolve?.();
      return false;
    }

    db = B.getDb();
    fs = B.getFirestore();
    ready = true;

    try {
      await seedIfEmpty();
      startListeners();
    } catch (err) {
      console.error('[FirebaseStore] 초기화 실패:', err);
      ready = false;
    }

    readyResolve?.();
    return ready;
  }

  async function waitReady() {
    await readyPromise;
  }

  async function saveConfig(partial) {
    if (partial.settings) cache.settings = { ...cache.settings, ...partial.settings };
    if (partial.download) cache.download = { ...cache.download, ...partial.download };
    if (partial.blacklist) cache.blacklist = partial.blacklist;
    if (partial.muted) cache.muted = partial.muted;
    if (partial.changelog) cache.changelog = partial.changelog;
    if (partial.faq) cache.faq = partial.faq;
    if (partial.dailyDownloads) cache.dailyDownloads = partial.dailyDownloads;

    if (ready && db) {
      await db.collection('config').doc('site').set(partial, { merge: true });
    } else {
      if (partial.settings) lsSave(LS.settings, cache.settings);
      if (partial.download) lsSave(LS.download, cache.download);
      if (partial.blacklist) lsSave(LS.blacklist, cache.blacklist);
      if (partial.muted) lsSave(LS.muted, cache.muted);
      if (partial.changelog) lsSave(LS.changelog, cache.changelog);
      if (partial.faq) lsSave(LS.faq, cache.faq);
      if (partial.dailyDownloads) lsSave(LS.downloadsToday, cache.dailyDownloads);
    }
    notify();
  }

  function resolveCollection(item) {
    if (item._collection) return item._collection;
    return item.type === 'skin' ? COL.skins : COL.toys;
  }

  async function upsertMarketItem(item) {
    const collection = resolveCollection(item);
    const payload = collection === COL.skins ? skinToFirestore(item) : toyToFirestore(item);
    const mapped = collection === COL.skins ? mapSkin(item.id, payload) : mapToy(item.id, payload);

    if (collection === COL.skins) {
      const idx = cache.skins.findIndex((i) => i.id === item.id);
      if (idx >= 0) cache.skins[idx] = mapped;
      else cache.skins.push(mapped);
    } else {
      const idx = cache.toys.findIndex((i) => i.id === item.id);
      if (idx >= 0) cache.toys[idx] = mapped;
      else cache.toys.push(mapped);
    }
    mergeMarketCache();

    if (ready && db) {
      await db.collection(collection).doc(item.id).set(payload, { merge: true });
    } else {
      lsSave(LS.market, cache.market);
    }
    notify();
  }

  async function deleteMarketItem(id) {
    const existing = cache.market.find((i) => i.id === id);
    const collection = existing ? resolveCollection(existing) : COL.toys;
    cache.skins = cache.skins.filter((i) => i.id !== id);
    cache.toys = cache.toys.filter((i) => i.id !== id);
    mergeMarketCache();
    if (canWriteFirestore()) {
      await getFirestore().collection(collection).doc(id).delete();
    } else {
      lsSave(LS.market, cache.market);
    }
    notify();
  }

  async function deleteStoreToy(id) {
    cache.toys = cache.toys.filter((t) => t.id !== id);
    mergeMarketCache();
    if (canWriteFirestore()) {
      await getFirestore().collection(COL.toys).doc(id).delete();
    } else {
      lsSave(LS.market, cache.market);
    }
    notify();
  }

  async function saveMarketItems(items) {
    cache.skins = items.filter((i) => i.type === 'skin').map((i) => mapSkin(i.id, i));
    cache.toys = items.filter((i) => i.type !== 'skin').map((i) => mapToy(i.id, i));
    mergeMarketCache();
    if (ready && db) {
      const batch = db.batch();
      items.forEach((item) => {
        const collection = resolveCollection(item);
        const payload = collection === COL.skins ? skinToFirestore(item) : toyToFirestore(item);
        batch.set(db.collection(collection).doc(item.id), payload, { merge: true });
      });
      await batch.commit();
    } else {
      lsSave(LS.market, cache.market);
    }
    notify();
  }

  async function updateUser(uid, data) {
    const u = cache.users.find((x) => x.id === uid);
    if (u) Object.assign(u, data);

    if (ready && db) {
      const patch = {};
      if (data.cash != null) patch.cash = data.cash;
      if (data.status) patch.status = data.status;
      if (data.nick) patch.nickname = data.nick;
      await db.collection('users').doc(uid).update(patch);
    } else {
      lsSave(LS.users, cache.users);
    }
    notify();
  }

  async function addInquiry(data) {
    const item = {
      ...data,
      answered: false,
      createdAt: ready && fs ? fs.FieldValue.serverTimestamp() : Date.now(),
    };
    if (ready && db) {
      await db.collection('inquiries').add(item);
    } else {
      cache.inquiries.unshift({ ...item, id: 'inq_' + Date.now() });
      lsSave(LS.inquiries, cache.inquiries);
      notify();
    }
  }

  async function updateInquiry(id, data) {
    if (ready && db) {
      await db.collection('inquiries').doc(id).update(data);
    } else {
      const item = cache.inquiries.find((q) => q.id === id);
      if (item) Object.assign(item, data);
      lsSave(LS.inquiries, cache.inquiries);
      notify();
    }
  }

  async function addDevSubmission(data) {
    const item = {
      ...data,
      status: 'pending',
      submittedAt: ready && fs ? fs.FieldValue.serverTimestamp() : Date.now(),
    };
    if (ready && db) {
      await db.collection('dev_submissions').add(item);
    } else {
      cache.devSubmissions.unshift({ ...item, id: 'sub_' + Date.now() });
      lsSave(LS.devSubmissions, cache.devSubmissions);
      notify();
    }
  }

  const UPLOAD_TIMEOUT_MS = 120000;
  const EXTENSION_STORAGE_TIMEOUT_MS = 6000;
  const PACKAGE_STORAGE_TIMEOUT_MS = 120000;
  const EXT_STORAGE_SKIP_KEY = 'toytools_skip_ext_storage';
  const MAX_SCRIPT_BYTES = 5 * 1024 * 1024;
  const MAX_PACKAGE_BYTES = 50 * 1024 * 1024;

  function shouldTryExtensionStorage() {
    try {
      if (sessionStorage.getItem(EXT_STORAGE_SKIP_KEY) === '1') return false;
      // Firebase Storage 미설정/CORS 환경 대응: 기본은 Firestore 인라인 저장
      if (localStorage.getItem('toytools_ext_storage_enabled') !== '1') return false;
    } catch (_) { /* ignore */ }
    return !!bridge?.getStorage?.();
  }

  function markExtensionStorageSkipped(reason) {
    try {
      sessionStorage.setItem(EXT_STORAGE_SKIP_KEY, '1');
    } catch (_) { /* ignore */ }
    console.warn('[FirebaseStore] Storage 업로드 건너뜀 — Firestore 인라인 저장 사용:', reason || 'CORS/네트워크');
  }

  function getFirestore() {
    return db || bridge?.getDb?.() || null;
  }

  function canWriteFirestore() {
    const firestore = getFirestore();
    return !!(firestore && bridge?.isFirebaseReady?.());
  }

  function withTimeout(promise, ms, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  async function uploadPackageFile(file, uid) {
    const storage = bridge?.getStorage?.();
    if (!storage) {
      throw new Error('패키지 업로드를 위해 Firebase Storage 설정이 필요합니다.');
    }
    if (!file?.name?.toLowerCase().endsWith('.zip')) {
      throw new Error('.zip 패키지 파일만 업로드할 수 있습니다.');
    }
    if (file.size > MAX_PACKAGE_BYTES) {
      throw new Error('패키지 파일은 50MB 이하여야 합니다.');
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `extension_packages/${uid}/${Date.now()}_${safeName}`;
    const ref = storage.ref(path);
    try {
      const uploadTask = ref.put(file, {
        contentType: 'application/zip',
        customMetadata: { uploadedBy: uid, packType: 'package' },
      });
      const snapshot = await withTimeout(
        uploadTask,
        PACKAGE_STORAGE_TIMEOUT_MS,
        '패키지 Storage 업로드 시간 초과'
      );
      return await snapshot.ref.getDownloadURL();
    } catch (err) {
      console.error('[FirebaseStore] uploadPackageFile 실패:', path, err);
      throw new Error(err.message || '패키지 업로드에 실패했습니다.');
    }
  }

  async function uploadExtensionFile(file, uid) {
    if (!shouldTryExtensionStorage()) {
      return null;
    }
    const storage = bridge?.getStorage?.();
    if (!storage) {
      console.warn('[FirebaseStore] Storage 인스턴스 없음 — Firestore 인라인 저장으로 전환합니다.');
      return null;
    }
    if (!file?.name?.toLowerCase().endsWith('.py')) {
      const err = new Error('.py 파일만 업로드할 수 있습니다.');
      console.error('[FirebaseStore] uploadExtensionFile:', err);
      throw err;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `extensions/${uid}/${Date.now()}_${safeName}`;
    const ref = storage.ref(path);
    try {
      const uploadTask = ref.put(file, {
        contentType: 'text/x-python',
        customMetadata: { uploadedBy: uid },
      });
      const snapshot = await withTimeout(
        uploadTask,
        EXTENSION_STORAGE_TIMEOUT_MS,
        'Storage 업로드 시간 초과'
      );
      return await snapshot.ref.getDownloadURL();
    } catch (err) {
      console.error('[FirebaseStore] uploadExtensionFile 실패:', path, err);
      markExtensionStorageSkipped(err?.message || 'upload failed');
      return null;
    }
  }

  async function addCreatorProduct(data) {
    try {
      const productType = ['extension', 'skin', 'game'].includes(data.productType)
        ? data.productType
        : 'extension';
      const deliveryType = data.deliveryType === 'package' ? 'package' : 'script';
      const entryPoint = (data.entryPoint || 'main.py').trim() || 'main.py';
      const title = (data.title || data.name || '').trim();
      const description = data.desc || data.description || '';
      const item = {
        title,
        name: title,
        category: data.category || '',
        description,
        desc: description,
        price: Number(data.price) || 0,
        pack_type: productType,
        delivery_type: deliveryType,
        entry_point: entryPoint,
        approved: false,
        status: 'pending',
        author: data.author || '',
        authorUid: data.authorUid || '',
        type: productType,
        itemType: productType,
        active: false,
        emoji: productEmoji(productType),
        tag: data.category || productType,
        createdAt: ready && fs ? fs.FieldValue.serverTimestamp() : Date.now(),
      };
      if (deliveryType === 'script') {
        item.code_body = data.codeBody || '';
        item.package_url = '';
      } else {
        item.code_body = '';
        item.package_url = data.packageUrl || '';
      }
      if (data.fileUrl) item.fileUrl = data.fileUrl;
      if (data.fileName) item.fileName = data.fileName;

      if (canWriteFirestore()) {
        const docRef = await getFirestore().collection(COL.toys).add(item);
        const mapped = mapToy(docRef.id, item);
        cache.toys.push(mapped);
        mergeMarketCache();
        notify();
        return docRef.id;
      }
      const idPrefix = productType === 'skin' ? 'skin' : (productType === 'game' ? 'game' : 'ext');
      const id = `${idPrefix}_${Date.now()}`;
      const mapped = mapToy(id, item);
      cache.toys.push(mapped);
      mergeMarketCache();
      lsSave(LS.market, cache.market);
      notify();
      return id;
    } catch (err) {
      console.error('[FirebaseStore] addCreatorProduct 실패:', err);
      throw err;
    }
  }

  async function addExtensionPack(data) {
    return addCreatorProduct({
      ...data,
      productType: data.productType || 'extension',
      deliveryType: data.deliveryType || (data.packType === 'package' ? 'package' : 'script'),
      title: data.title || data.name,
    });
  }

  async function updateStoreToyReview(id, { approved, status }) {
    const nextStatus = status || (approved ? 'approved' : 'rejected');
    const patch = {
      approved: approved === true,
      status: nextStatus,
      active: approved === true,
      updatedAt: fs ? fs.FieldValue.serverTimestamp() : Date.now(),
    };
    const idx = cache.toys.findIndex((t) => t.id === id);
    if (idx >= 0) {
      const merged = { ...cache.toys[idx]._raw, ...cache.toys[idx], ...patch };
      cache.toys[idx] = mapToy(id, merged);
    } else {
      const marketItem = cache.market.find((m) => m.id === id && m.type !== 'skin');
      if (marketItem) {
        const merged = { ...marketItem._raw, ...marketItem, ...patch };
        cache.toys.push(mapToy(id, merged));
      }
    }
    mergeMarketCache();
    if (canWriteFirestore()) {
      await getFirestore().collection(COL.toys).doc(id).update(patch);
    } else {
      lsSave(LS.market, cache.market);
    }
    notify();
  }

  async function uploadCreatorProduct({
    title,
    name,
    category,
    desc,
    price,
    productType = 'extension',
    deliveryType = 'script',
    codeBody = '',
    file,
    packageFile,
    entryPoint = 'main.py',
    author,
    uid,
  }) {
    if (!uid) {
      const err = new Error('로그인이 필요합니다.');
      console.error('[FirebaseStore] uploadCreatorProduct:', err);
      throw err;
    }

    const normalizedProductType = ['extension', 'skin', 'game'].includes(productType)
      ? productType
      : 'extension';
    const normalizedDeliveryType = deliveryType === 'package' ? 'package' : 'script';
    const normalizedTitle = String(title || name || '').trim();
    const normalizedEntryPoint = String(entryPoint || 'main.py').trim() || 'main.py';

    if (!normalizedTitle) {
      throw new Error('상품 이름을 입력해 주세요.');
    }
    if (!category) {
      throw new Error('카테고리를 선택해 주세요.');
    }

    try {
      if (normalizedDeliveryType === 'package') {
        if (!packageFile) {
          throw new Error('.zip 패키지 파일을 첨부해 주세요.');
        }
        if (!packageFile.name?.toLowerCase().endsWith('.zip')) {
          throw new Error('.zip 패키지 파일만 업로드할 수 있습니다.');
        }
        if (packageFile.size > MAX_PACKAGE_BYTES) {
          throw new Error('패키지 파일은 50MB 이하여야 합니다.');
        }

        const zipScan = await scanZipPackage(packageFile);
        if (!zipScan.safe) {
          throw buildSecurityScanError(zipScan.matches);
        }

        const packageUrl = await uploadPackageFile(packageFile, uid);
        const productId = await addCreatorProduct({
          title: normalizedTitle,
          category,
          desc,
          price,
          productType: normalizedProductType,
          deliveryType: 'package',
          packageUrl,
          entryPoint: normalizedEntryPoint,
          fileName: packageFile.name,
          author,
          authorUid: uid,
        });
        return {
          id: productId,
          storageMode: 'package',
          productType: normalizedProductType,
          deliveryType: 'package',
        };
      }

      let resolvedCodeBody = String(codeBody || '').trim();
      let fileName = 'main.py';

      if (file) {
        if (!file.name?.toLowerCase().endsWith('.py')) {
          throw new Error('.py 파일만 업로드할 수 있습니다.');
        }
        if (file.size > MAX_SCRIPT_BYTES) {
          throw new Error('스크립트 파일은 5MB 이하여야 합니다.');
        }
        fileName = file.name || fileName;
        resolvedCodeBody = await readFileAsText(file);
      }

      if (!resolvedCodeBody.trim()) {
        throw new Error('파이썬 코드를 입력하거나 .py 파일을 첨부해 주세요.');
      }
      if (resolvedCodeBody.length > 900000) {
        throw new Error('코드가 너무 깁니다(약 900KB 이하). 패키지(.zip) 업로드를 이용해 주세요.');
      }

      const codeScan = scanPythonCode(resolvedCodeBody);
      if (!codeScan.safe) {
        throw buildSecurityScanError(codeScan.matches);
      }

      let fileUrl = '';
      if (file) {
        try {
          fileUrl = await uploadExtensionFile(file, uid) || '';
        } catch (storageErr) {
          console.error('[FirebaseStore] Storage 업로드 실패:', storageErr);
          markExtensionStorageSkipped(storageErr?.message);
          fileUrl = '';
        }
      }

      const storageMode = fileUrl ? 'storage' : 'inline';
      if (!fileUrl) {
        console.info('[FirebaseStore] Firestore 인라인(code_body) 저장으로 진행합니다.');
      }

      const scriptEntryPoint = normalizedEntryPoint || fileName || 'main.py';
      const productId = await addCreatorProduct({
        title: normalizedTitle,
        category,
        desc,
        price,
        productType: normalizedProductType,
        deliveryType: 'script',
        fileUrl,
        codeBody: resolvedCodeBody,
        fileName,
        entryPoint: scriptEntryPoint,
        author,
        authorUid: uid,
      });

      return {
        id: productId,
        storageMode,
        productType: normalizedProductType,
        deliveryType: 'script',
      };
    } catch (err) {
      console.error('[FirebaseStore] uploadCreatorProduct 실패:', err);
      throw err;
    }
  }

  async function uploadExtensionPack({
    name,
    title,
    category,
    desc,
    price,
    productType = 'extension',
    packType,
    deliveryType,
    codeBody = '',
    file,
    packageFile,
    entryPoint = 'main.py',
    author,
    uid,
  }) {
    const resolvedDelivery = deliveryType || (packType === 'package' ? 'package' : 'script');
    return uploadCreatorProduct({
      title: title || name,
      category,
      desc,
      price,
      productType,
      deliveryType: resolvedDelivery,
      codeBody,
      file,
      packageFile,
      entryPoint,
      author,
      uid,
    });
  }

  function getCreatorProductsByUid(uid) {
    if (!uid) return [];
    return cache.toys.filter((t) => t.authorUid === uid);
  }

  function getExtensionsByUid(uid) {
    return getCreatorProductsByUid(uid).filter((t) => t.type === 'extension');
  }

  function getStoreToysByUid(uid) {
    return getCreatorProductsByUid(uid);
  }

  async function updateDevSubmission(id, data) {
    if (ready && db) {
      await db.collection('dev_submissions').doc(id).update(data);
    } else {
      const s = cache.devSubmissions.find((x) => x.id === id);
      if (s) Object.assign(s, data);
      lsSave(LS.devSubmissions, cache.devSubmissions);
      notify();
    }
  }

  async function updatePayout(id, data) {
    if (ready && db) {
      await db.collection('payouts').doc(id).update(data);
    } else {
      const p = cache.payouts.find((x) => x.id === id);
      if (p) Object.assign(p, data);
      lsSave(LS.payouts, cache.payouts);
      notify();
    }
  }

  async function upsertHomeToy(item) {
    assertAdmin();
    const id = item.id || `toy_${Date.now()}`;
    const payload = {
      title: item.title || '',
      desc: item.desc || '',
      tag: item.tag || '',
      icon: item.icon || '🧩',
      accent: item.accent || '#6366F1',
      downloadUrl: item.downloadUrl || '',
      downloadStatus: item.downloadStatus || 'available',
      order: Number(item.order ?? cache.homeToys.length),
      active: item.active !== false,
      updatedAt: ready && fs ? fs.FieldValue.serverTimestamp() : Date.now(),
    };
    if (!item.id && ready && fs) {
      payload.createdAt = fs.FieldValue.serverTimestamp();
    }
    const mapped = mapHomeToy(id, { ...item, ...payload });
    const idx = cache.homeToys.findIndex((t) => t.id === id);
    if (idx >= 0) cache.homeToys[idx] = mapped;
    else cache.homeToys.push(mapped);
    sortHomeToys();

    if (ready && db) {
      await db.collection('toys').doc(id).set(payload, { merge: true });
    } else {
      lsSave(LS.toysHome, cache.homeToys);
      notify();
    }
  }

  async function deleteHomeToy(id) {
    assertAdmin();
    cache.homeToys = cache.homeToys.filter((t) => t.id !== id);
    if (ready && db) {
      await db.collection('toys').doc(id).delete();
    } else {
      lsSave(LS.toysHome, cache.homeToys);
      notify();
    }
  }

  async function upsertDevlog(item) {
    assertAdmin();
    const id = item.id || `devlog_${Date.now()}`;
    const payload = {
      title: item.title || '',
      author: item.author || 'ToyTools',
      category: item.category || '기타',
      emoji: item.emoji || '📝',
      body: item.body || '',
      date: item.date || bridge.formatDate(new Date()),
      views: Number(item.views ?? 0),
      comments: Number(item.comments ?? 0),
      thumbFrom: item.from || item.thumbFrom || '#FFE0EC',
      thumbTo: item.to || item.thumbTo || '#E0F7FF',
      order: Number(item.order ?? cache.devlogs.length),
      published: item.published !== false,
      updatedAt: ready && fs ? fs.FieldValue.serverTimestamp() : Date.now(),
    };
    if (!item.id && ready && fs) {
      payload.createdAt = fs.FieldValue.serverTimestamp();
    }
    const mapped = mapDevlog(id, payload);
    const idx = cache.devlogs.findIndex((d) => d.id === id);
    if (idx >= 0) cache.devlogs[idx] = mapped;
    else cache.devlogs.push(mapped);
    sortDevlogs();

    if (ready && db) {
      await db.collection('devlogs').doc(id).set(payload, { merge: true });
    } else {
      lsSave(LS.devlogs, cache.devlogs);
      notify();
    }
  }

  async function saveLanding(data) {
    assertAdmin();
    const payload = mergeLanding(data);
    cache.landing = payload;
    if (ready && db) {
      await db.collection('settings').doc('landing').set({
        ...payload,
        updatedAt: fs ? fs.FieldValue.serverTimestamp() : Date.now(),
      }, { merge: true });
    } else {
      lsSave(LS.landing, payload);
      notify();
    }
  }

  async function uploadLandingMedia(file, uid) {
    const storage = bridge?.getStorage?.();
    if (!storage || !ready) {
      const err = new Error('Firebase Storage가 설정되지 않았습니다.');
      console.error('[FirebaseStore] uploadLandingMedia:', err);
      throw err;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `landing/${uid || 'admin'}_${Date.now()}_${safeName}`;
    const ref = storage.ref(path);
    try {
      const uploadTask = ref.put(file, {
        contentType: file.type || 'application/octet-stream',
        customMetadata: { uploadedBy: uid || 'admin' },
      });
      const snapshot = await withTimeout(
        uploadTask,
        UPLOAD_TIMEOUT_MS,
        '미디어 업로드 시간이 초과되었습니다.'
      );
      return await snapshot.ref.getDownloadURL();
    } catch (err) {
      console.error('[FirebaseStore] uploadLandingMedia 실패:', path, err);
      throw err;
    }
  }

  async function deleteDevlog(id) {
    assertAdmin();
    cache.devlogs = cache.devlogs.filter((d) => d.id !== id);
    if (ready && db) {
      await db.collection('devlogs').doc(id).delete();
    } else {
      lsSave(LS.devlogs, cache.devlogs);
      notify();
    }
  }

  async function incrementDownloadCount(formatDate) {
    const today = formatDate(new Date());
    if (cache.dailyDownloads.date !== today) {
      cache.dailyDownloads = { date: today, count: 0 };
    }
    cache.dailyDownloads.count += 1;

    if (ready && db) {
      await db.collection('config').doc('site').set({
        dailyDownloads: cache.dailyDownloads,
      }, { merge: true });
    } else {
      lsSave(LS.downloadsToday, cache.dailyDownloads);
    }
  }

  function getLocalPosts(B) {
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

  window.FirebaseStore = {
    init,
    waitReady,
    isReady: () => ready,
    getMarket: () => cache.market,
    getSkins: () => cache.skins,
    getToys: () => cache.toys,
    getUsers: () => cache.users,
    getPosts: (B) => (ready ? cache.posts : getLocalPosts(B)),
    getInquiries: () => cache.inquiries,
    getPayouts: () => cache.payouts,
    getDevSubmissions: () => cache.devSubmissions,
    getExtensions: () => getExtensionItems(),
    getExtensionsByUid,
    getCreatorProductsByUid,
    getStoreToysByUid,
    getHomeToys: () => cache.homeToys,
    getDevlogs: () => cache.devlogs,
    getSettings: () => cache.settings,
    getDownload: () => cache.download,
    getBlacklist: () => cache.blacklist,
    getMuted: () => cache.muted,
    getChangelog: () => cache.changelog,
    getFaq: () => cache.faq,
    getDailyDownloads: () => cache.dailyDownloads,
    getLanding: () => cache.landing || mergeLanding(null),
    getDefaultLanding: buildDefaultLanding,
    saveLanding,
    uploadLandingMedia,
    saveConfig,
    upsertMarketItem,
    deleteMarketItem,
    deleteStoreToy,
    saveMarketItems,
    updateUser,
    addInquiry,
    updateInquiry,
    addDevSubmission,
    updateDevSubmission,
    uploadExtensionPack,
    uploadCreatorProduct,
    addExtensionPack,
    addCreatorProduct,
    scanPythonCode,
    scanZipPackage,
    updateStoreToyReview,
    upsertHomeToy,
    deleteHomeToy,
    upsertDevlog,
    deleteDevlog,
    updatePayout,
    incrementDownloadCount,
  };
})();

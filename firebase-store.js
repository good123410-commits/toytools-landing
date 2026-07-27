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
    settings: { maintenance: false, registrationOpen: true, marketOpen: true, notice: '' },
    download: { version: 'v1.0.0', url: '#', notes: 'Windows 10/11 · 포터블 .exe · 무설치' },
    blacklist: [],
    muted: [],
    changelog: [],
    faq: [],
    dailyDownloads: { date: '', count: 0 },
  };

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
    const raw = String(pick(data, 'type', 'itemType', 'category', 'toyType') || '').toLowerCase();
    if (raw.includes('extension') || raw.includes('확장')) return 'extension';
    if (raw.includes('game') || raw.includes('mini') || raw.includes('미니')) return 'game';
    return 'game';
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
    return {
      id,
      _collection: COL.toys,
      type,
      name: pick(data, 'name', 'title') || '토이',
      desc: pick(data, 'desc', 'description') || '',
      price: Number(pick(data, 'price', 'point', 'points', 'cost') || 0),
      emoji: pick(data, 'emoji', 'icon') || '📦',
      bg: pick(data, 'bg', 'background', 'backgroundGradient', 'thumbnailBg') || DEFAULT_BG,
      tag: pick(data, 'tag', 'gen', 'category', 'label') || (type === 'extension' ? 'Extension' : 'Mini Game'),
      gen: pick(data, 'gen', 'tag', 'category', 'label') || '',
      status: pick(data, 'status') || 'approved',
      active: data.active !== false && data.enabled !== false && data.isActive !== false,
      creator: pick(data, 'creator', 'author', 'createdBy') || 'ToyTools',
      submittedAt: data.submittedAt || data.createdAt || null,
      _raw: data,
    };
  }

  function mergeMarketCache() {
    cache.market = [...cache.skins, ...cache.toys];
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
    return {
      ...raw,
      name: item.name,
      desc: item.desc,
      price: item.price,
      emoji: item.emoji,
      bg: item.bg,
      type: item.type,
      itemType: item.type,
      tag: item.tag || item.gen,
      status: item.status || 'approved',
      active: item.active !== false,
      creator: item.creator || 'ToyTools',
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
    cache.settings = lsLoad(LS.settings, cache.settings);
    cache.download = lsLoad(LS.download, cache.download);
    cache.blacklist = lsLoad(LS.blacklist, []);
    cache.muted = lsLoad(LS.muted, []);
    cache.changelog = lsLoad(LS.changelog, B.getChangelogDefault());
    cache.faq = lsLoad(LS.faq, B.getFaqDefault());
    cache.dailyDownloads = lsLoad(LS.downloadsToday, { date: B.formatDate(new Date()), count: 42 });
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
    if (ready && db) {
      await db.collection(collection).doc(id).delete();
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
    getSettings: () => cache.settings,
    getDownload: () => cache.download,
    getBlacklist: () => cache.blacklist,
    getMuted: () => cache.muted,
    getChangelog: () => cache.changelog,
    getFaq: () => cache.faq,
    getDailyDownloads: () => cache.dailyDownloads,
    saveConfig,
    upsertMarketItem,
    deleteMarketItem,
    saveMarketItems,
    updateUser,
    addInquiry,
    updateInquiry,
    addDevSubmission,
    updateDevSubmission,
    updatePayout,
    incrementDownloadCount,
  };
})();

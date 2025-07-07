(function () {
  const GITHUB_URL = 'https://raw.githubusercontent.com/ksh8741/poongtoo/main/data/2025-07-07.json';
  const MIN_STARS = 400;

  let bigDonors = [];
  let alreadyAlerted = new Set();

  // GitHub에서 큰손 목록 불러오기
  async function loadBigDonors() {
    try {
      const res = await fetch(GITHUB_URL);
      const data = await res.json();
      bigDonors = data
        .filter(d => d.stars >= MIN_STARS)
        .map(d => d.id?.replace(/\(.*?\)/, ''))
        .filter(Boolean);
      console.log('[SOOP-Ext] 🎯 필터된 큰손 ID 목록:', bigDonors);
    } catch (e) {
      console.warn('[SOOP-Ext] ⚠ 큰손 목록 불러오기 실패:', e);
    }
  }

  const $ = sel => document.querySelector(sel);

  const waitEl = (sel, t = 10_000) => new Promise((ok, bad) => {
    const s = performance.now();
    (function loop () {
      const el = $(sel);
      if (el) return ok(el);
      if (performance.now() - s > t) return bad(`❌ ${sel} 없음`);
      requestAnimationFrame(loop);
    })();
  });

  const waitPage = (ms = 6_000) =>
    new Promise(r => setTimeout(r, ms));

  const waitFullList = async (ms = 10_000, idle = 1_000) => {
    let last = 0, stable = 0, start = performance.now();
    while (performance.now() - start < ms) {
      const data = window.liveView?.Chat?.chatUserListLayer?.userListSeparatedByGrade;
      const now  = data ? Object.values(data).flat().length : 0;

      if (now === last) {
        stable += 200;
        if (stable >= idle) break;
      } else {
        stable = 0;
        last   = now;
      }
      await new Promise(r => setTimeout(r, 200));
    }
  };

  async function runDetection() {
    try {
      const btn   = await waitEl('#setbox_viewer a');
      const panel = await waitEl('#list_viewer');
      console.log('[SOOP-Ext] ✅ 버튼·패널 확보');

      const holder  = document.createElement('div');
      const parent  = panel.parentElement;
      const dispBak = panel.style.display;

      parent.replaceChild(holder, panel);
      panel.style.display = 'none';
      document.body.appendChild(panel);

      btn.click();
      console.log('[SOOP-Ext] 🔓 패널 열림 – 목록 로딩 중…');

      await waitFullList();
      btn.click();
      await new Promise(r => setTimeout(r, 120));

      panel.style.display = dispBak;
      parent.replaceChild(panel, holder);
      console.log('[SOOP-Ext] 📴 패널 복구 완료 – 데이터 추출');

      const store = window.liveView?.Chat?.chatUserListLayer?.userListSeparatedByGrade;
      if (!store) return console.warn('[SOOP-Ext] ⚠ 유저 리스트 없음');

      let all = [];

      for (const [_, list] of Object.entries(store)) {
        if (!Array.isArray(list)) continue;

        list.forEach(u => {
          if (u.type !== 'add') return;
          const rawId    = u.id ?? '';
          const nickname = u.nickname ?? rawId.replace(/\(.*?\)$/, '');
          const user_id  = (u.user_id ?? rawId).replace(/\(.*?\)$/, '');
          all.push({ nickname, user_id });
        });
      }

      for (const viewer of all) {
        if (bigDonors.includes(viewer.user_id) && !alreadyAlerted.has(viewer.user_id)) {
          alreadyAlerted.add(viewer.user_id);
          alert(`🚨 큰손 입장 감지: ${viewer.nickname} (${viewer.user_id})`);
        }
      }

    } catch (e) {
      console.warn('[SOOP-Ext] ⚠ 오류:', e);
    }
  }

  (async () => {
    await loadBigDonors();   // 큰손 목록 먼저 불러오기
    await waitPage();        // 최초 대기
    runDetection();          // 1회 실행
    setInterval(runDetection, 10_000);  // 🔁 반복 실행
  })();
})();

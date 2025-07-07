(function () {
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
  
    let alreadyAlerted = false;
  
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
  
        let all   = [];
        let total = 0;
  
        for (const [grade, list] of Object.entries(store)) {
          if (!Array.isArray(list)) continue;
          console.log(`[SOOP-Ext] ✅ 등급 ${grade} – 인원: ${list.length}`);
          total += list.length;
  
          list.forEach(u => {
            if (u.type !== 'add') return;
            const rawId    = u.id ?? '';
            const nickname = u.nickname ?? rawId.replace(/\(.*?\)$/, '');
            const user_id  = (u.user_id ?? rawId).replace(/\(.*?\)$/, '');
            all.push({ nickname, user_id });
            console.log(`   👤 ${nickname} (${user_id})`);
          });
        }
        console.log(`[SOOP-Ext] 📊 전체 시청자 수: ${total}`);
  
        if (!alreadyAlerted && all.some(v => v.user_id === 'boskk67')) {
          alreadyAlerted = true;
          alert('🚨 boskk67 님이 입장했습니다!');
        }
  
      } catch (e) {
        console.warn('[SOOP-Ext] ⚠ 오류:', e);
      }
    }
  
    (async () => {
      await waitPage();    // 최초 1회만
      runDetection();      // 1회 실행
      setInterval(runDetection, 10_000);  // 🔁 10초마다 반복 실행
    })();
  
  })();
  
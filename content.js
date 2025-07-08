(function () {
  'use strict';
  const STORAGE_KEY = 'poong_donation_by_date';
  const POS_KEY = 'poong_ui_position';

  (function migrateToChromeStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
  
      const parsed = JSON.parse(raw);
  
      chrome.storage.local.get(STORAGE_KEY, res => {
        if (res && res[STORAGE_KEY]) {
          console.log('[Poong] 🔍 이미 존재함, 불필요');
          return;
        }
  
        chrome.storage.local.set({ [STORAGE_KEY]: parsed }, () => {
          console.log('[Poong] ✅ 마이그레이션 완료');
  
          // ✅ 마이그레이션 완료 후 확인
          chrome.storage.local.get(STORAGE_KEY, r => {
            if (r && r[STORAGE_KEY]) {
              console.log('[Poong] 🔍 chrome.storage.local에 저장된 내용:', r[STORAGE_KEY]);
            } else {
              console.warn('[Poong] ❌ chrome.storage.local에 값 없음');
            }
          });
        });
      });
    } catch (e) {
      console.warn('[Poong] ⚠ 마이그레이션 실패:', e);
    }
  })();

  const today = new Date();
  const nowY = today.getFullYear();
  const nowM = today.getMonth() + 1;
  const nowD = today.getDate();

  async function clickMoreUntilDone() {
    while (true) {
      const btn = [...document.querySelectorAll('button')].find(el => el.textContent.includes('더보기') && el.offsetParent !== null);
      if (!btn || btn.disabled || btn.style.display === 'none') break;
      btn.click();
      await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  function getCurrentDate() {
    const inp = document.querySelector('input.react-datepicker-ignore-onclickoutside, .react-datepicker__input-container input');
    if (inp && inp.value.trim()) return inp.value.trim();
  
    const spans = [...document.querySelectorAll('.react-dropdown-select-content span')];
    if (spans.length >= 2) {
      const y = spans[0].innerText.trim();
      const m = spans[1].innerText.trim().padStart(2, '0');
      if (/^\d{4}$/.test(y) && /^\d{2}$/.test(m)) return `${y}.${m}`;
    }
  
    const m3 = document.body.innerText.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (m3) return `${m3[1]}.${m3[2]}.${m3[3]}`;
  
    return 'Unknown';
  }

  function sortedKeys(obj) {
    const daily = [];
    const monthly = [];
  
    for (const key of Object.keys(obj)) {
      if (/\s/.test(key)) continue; // ✅ 띄어쓰기 포함된 키는 무시
  
      if (/^\d{4}\.\d{2}\.\d{2}$/.test(key)) {
        daily.push(key);
      } else if (/^\d{4}\.\d{2}$/.test(key)) {
        monthly.push(key);
      }
    }
  
    daily.sort((a, b) => new Date(b) - new Date(a));
    monthly.sort((a, b) => new Date(b) - new Date(a));
  
    return [...daily, ...monthly];
  }

  function extractPoongData() {
    const rows = document.querySelectorAll('li.row');
    const dataMap = {};
  
    rows.forEach((row) => {
      const href = row.querySelector('a.post')?.getAttribute('href') || '';
      const rawId = href.split('/').pop();
      const userId = rawId.replace(/\(\d+\)$/, '').trim();
      const nickEls = row.querySelectorAll('span.nick');
      const nickname = nickEls[0]?.innerText.trim() || '';
      const cols = row.querySelectorAll('div.col');
      const totalStars = parseInt((cols[0]?.innerText || '0').replace(/,/g, '')) || 0;
  
      const topBJRaw = nickEls[1]?.innerText || '';
      const topBJ = topBJRaw
        .replace(/live/gi, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
  
      const timesRaw = cols[1]?.innerText.trim() || '0';
      const bjsRaw   = cols[2]?.innerText.trim() || '0';
      const totalTimes = /^\d/.test(timesRaw) ? parseInt(timesRaw) : 0;
      const totalBJs   = /^\d/.test(bjsRaw)   ? parseInt(bjsRaw)   : 0;
  
      if (!dataMap[userId]) {
        dataMap[userId] = {
          userId,
          nickname,
          totalStars,
          totalTimes,
          totalBJs,
          topBJ
        };
      } else {
        dataMap[userId].totalStars += totalStars;
        dataMap[userId].totalTimes += totalTimes;
        dataMap[userId].totalBJs   += totalBJs;
      }
    });
  
    // ⭐ 정렬 + 순위(rank) 부여
    const result = Object.values(dataMap)
      .sort((a, b) => b.totalStars - a.totalStars)
      .map((item, i) => ({
        ...item,
        rank: i + 1,
        totalStars: item.totalStars.toLocaleString(),  // ← 콤마 처리
        totalTimes: item.totalTimes.toLocaleString(),
        totalBJs: item.totalBJs.toLocaleString()
      }));
    
    return result;
  }

  function renderRows(list, keyword = '', minStar = 0) {
    return list.filter(d => {
      const stars = d.totalStars ?? '';
      const cleanStars = typeof stars === 'string' ? stars.replace(/,/g, '') : '';
      return (!keyword || d.userId.includes(keyword) || d.nickname.includes(keyword) || d.topBJ.includes(keyword)) &&
             (!minStar || parseInt(cleanStars) >= minStar);
    }).map(d => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="text-align:center;">${d.rank ?? ''}</td>
        <td><a href="https://bj.afreecatv.com/${d.userId ?? ''}" target="_blank" style="color:#0369a1;text-decoration:underline;">${d.userId ?? ''}</a></td>
        <td style="font-weight:bold">${d.nickname ?? ''}</td>
        <td style="font-weight:bold">${d.totalStars ?? ''}</td>
        <td>${d.totalTimes ?? ''}</td>
        <td>${d.totalBJs ?? ''}</td>
        <td>${d.topBJ ?? ''}</td>
      </tr>`).join('');
  }

  function getStorageSize() {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEY, res => {
        const obj = res[STORAGE_KEY] || {};
        const byteSize = new Blob([JSON.stringify(obj)]).size;
        const kb = (byteSize / 1024).toFixed(1);
        resolve(kb);
      });
    });
  }

  function filterAndSortKeys(data) {
    return Object.keys(data)
      .sort((a, b) => b.localeCompare(a));
  }

  function makeDraggable(panel, header) {
    let down = false, ox = 0, oy = 0;
    header.addEventListener('mousedown', e => {
      down = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
      e.preventDefault();
    });
    document.addEventListener('mouseup', () => {
      if (down) {
        localStorage.setItem(POS_KEY, JSON.stringify({ x: panel.offsetLeft, y: panel.offsetTop }));
      }
      down = false;
    });
    document.addEventListener('mousemove', e => {
      if (!down) return;
      panel.style.left = `${e.clientX - ox}px`;
      panel.style.top = `${e.clientY - oy}px`;
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
    });
  }

  async function renderPoongUI(allData, selectedDate) {
    const old = document.getElementById('poong-ui');
    if (old) old.remove();
    const list = allData[selectedDate] || [];
    const pos = JSON.parse(localStorage.getItem(POS_KEY) || '{}');
  
    const box = document.createElement('div');
    box.id = 'poong-ui';
    box.style = `
      position:fixed; top:${pos.y||100}px; left:${pos.x||100}px; width:900px; height:600px;
      background:linear-gradient(to bottom right, #f8fafc, #e2e8f0); border:1px solid #cbd5e1;
      border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.2); z-index:999999;
      display:flex; flex-direction:column; font-family:'Segoe UI', sans-serif;`;  

      box.innerHTML = `
      <style>
        /* ── 전체 톤 & 폰트 */
        #poong-ui{font-family:"Pretendard","Segoe UI",sans-serif;color:#111827}
    
        /* 상단/하단 둥근 모서리 */
        #poong-header{background:#fff;color:#111827;border-bottom:1px solid #e5e7eb;
          box-shadow:0 1px 4px rgba(0,0,0,.05);border-top-left-radius:12px;border-top-right-radius:12px}
        #poong-ui>div:last-child{border-bottom-left-radius:12px;border-bottom-right-radius:12px}
    
        /* 버튼 공통 */
        #poong-ui button{font-size:13px;border:none;border-radius:8px;cursor:pointer;transition:.15s}
    
        /* 입력 */
        #poong-ui input,#poong-ui select{border:1px solid #d1d5db;border-radius:8px;
          padding:6px 10px;background:#f9fafb;transition:.2s}
        #poong-ui input:focus,#poong-ui select:focus{border-color:#2563eb;outline:none;background:#fff}
    
        /* 표 */
        #poong-ui table{width:100%;border-collapse:collapse;font-size:13px;background:#fff;
          border-radius:12px;overflow:hidden}
        #poong-ui thead{background:#f3f4f6}
        #poong-ui th{padding:10px 6px;font-weight:600;color:#475569;position:sticky;top:0;z-index:1;background:#f3f4f6}
        #poong-ui td{padding:10px 6px;border-bottom:1px solid #f1f5f9}
        #poong-ui tr:hover td{background:#f9fafb}
        #poong-ui td:nth-child(3),#poong-ui td:nth-child(4){font-weight:600}
        #poong-ui a{color:#2563eb;text-decoration:none}
        #poong-ui a:hover{text-decoration:underline}
      </style>
    
      <!-- ────────────── 헤더 ────────────── -->
      <div id="poong-header"
          style="position:relative;padding:14px 20px;display:flex;align-items:center;cursor:move;">
        <span style="font-size:18px;font-weight:700;">🐷 요닝 큰손감지기</span>

        <!-- 용량 표시: 오른쪽으로 붙이되 X 보다 약간 왼쪽 -->
        <span id="storage-size"
              style="margin-left:auto; margin-right:40px; margin-top:-10wpx;
                    font-size:12px; color:#6b7280;">
          계산 중...
        </span>

        <!-- X 버튼: 항상 우측 상단 고정 -->
        <button id="poong-close"
                style="position:absolute;top:10px;right:20px;background:none;border:none;
                      font-size:18px;cursor:pointer;">✕</button>
      </div>
    
      <!-- ────────────── 툴바 ────────────── -->
      <div style="padding:14px 20px;display:flex;align-items:center;gap:8px;background:#f8fafc;">
        <!-- 📅 날짜 버튼 -->
        <button id="date-label" style="height:32px;padding:0 14px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;display:flex;align-items:center;gap:4px;font-size:14px;">
          📅 날짜
        </button>
    
        <!-- 날짜 드롭박스 + 화살표 -->
        <div style="display:flex;align-items:center;gap:6px;">
          <select id="date-select" style="height:32px;width:110px;min-width:120px;max-width:110px;padding:4px 10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;appearance:auto;"></select>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <button id="date-up"   style="height:15px;width:24px;font-size:10px;border:1px solid #d1d5db;border-radius:4px;background:#fff;cursor:pointer;">▲</button>
            <button id="date-down" style="height:15px;width:24px;font-size:10px;border:1px solid #d1d5db;border-radius:4px;background:#fff;cursor:pointer;">▼</button>
          </div>
        </div>
    
        <!-- 갱신 / 삭제 -->
        <button id="refresh-btn" title="갱신"
          style="height:32px;width:32px;border-radius:8px;border:1px solid #2563eb;background:#fff;color:#2563eb;font-size:16px;">
          ♻️
        </button>
        <button id="erase-btn" title="삭제"
          style="height:32px;width:32px;margin-left:6px;border-radius:8px;border:1px solid #ef4444;background:#fff;color:#ef4444;font-size:16px;">
          🗑️
        </button>
        
        <!-- 내보내기 & 불러오기 아이콘 버튼 -->
        <button id="export-btn" title="내보내기"
          style="height:32px;width:32px;margin-left:6px;border-radius:8px;border:1px solid #22c55e;background:#fff;color:#22c55e;font-size:16px;">
          💾
        </button>
        <button id="import-btn" title="불러오기"
          style="height:32px;width:32px;margin-left:4px;border-radius:8px;border:1px solid #0ea5e9;background:#fff;color:#0ea5e9;font-size:16px;">
          📂
        </button>

        <button id="reset-btn" title="초기화"
          style="height:32px;width:32px;margin-left:4px;border-radius:8px;border:1px solid #ef4444;background:#fff;color:#ef4444;font-size:16px;">
          🔄
        </button>
        
        <!-- 오른쪽 영역 (auto로 밀어냄) -->
        <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
          <!-- ❔ 도움말 -->
          <div id="filter-help-wrap" style="position:relative;display:inline-block;">
            <button class="poong-help-btn-main" style="
              width:25px;height:25px;font-size:15px;font-weight:bold;
              border-radius:50%;border:1px solid #d1d5db;background:#f9fafb;color:#6b7280;
              cursor:default;line-height:1;">?</button>
            <div class="poong-help-tooltip-main" style="
              visibility:hidden;opacity:0;transition:all 0.2s;
              position:absolute;top:30px;left:0;
              background:#1f2937;color:#fff;font-size:13px;line-height:1.5;
              padding:10px 14px;border-radius:8px;min-width:200px;max-width:280px;
              box-shadow:0 4px 12px rgba(0,0,0,0.2);white-space:normal;z-index:10000;">
              기간별 합산 및 필터 기능 사용 시<br>데이터 로딩으로 인해 일시적으로<br>렉이 발생할 수 있습니다.
            </div>
          </div>
    
          <!-- ★ 필터 -->
          <input id="filter-star" type="number" placeholder="★" style="height:32px;width:120px;padding:0 10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;">
    
          <!-- 닉네임 필터 -->
          <input id="filter-key" placeholder="닉네임 / ID / BJ" style="height:32px;width:160px;padding:0 10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;">
        </div>
      </div>
    
      <!-- ────────────── 테이블 영역 ────────────── -->
      <div style="flex:1;padding:0 20px 20px;overflow:auto;">
        <table>
          <thead>
            <tr>
              <th style="width:48px;">순위</th>
              <th style="width:140px;">ID</th>
              <th style="width:140px;">닉네임</th>
              <th style="width:90px;">별풍선</th>
              <th style="width:70px;">횟수</th>
              <th style="width:70px;">방송</th>
              <th style="width:110px;">애청 스트리머</th>
            </tr>
          </thead>
          <tbody id="poong-table-body">${renderRows(list)}</tbody>
        </table>
      </div>
    `;

    setTimeout(() => {
      const btn = document.querySelector('.poong-help-btn-main');
      const tooltip = document.querySelector('.poong-help-tooltip-main');
      if (!btn || !tooltip) return;
      const wrap = btn.parentElement;
      wrap.onmouseenter = () => { tooltip.style.visibility='visible'; tooltip.style.opacity='1'; };
      wrap.onmouseleave = () => { tooltip.style.visibility='hidden'; tooltip.style.opacity='0'; };
    }, 200);
      
    // 날짜 변경 함수
    function changeDate(offset) {
      const select = document.getElementById('date-select');
      const options = Array.from(select.options);
      const currentIndex = select.selectedIndex;
      const newIndex = currentIndex + offset;
      if (newIndex >= 0 && newIndex < options.length) {
        select.selectedIndex = newIndex;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    document.body.appendChild(box);
    getStorageSize().then(size => {
      const el = document.getElementById('storage-size');
      if (el) el.textContent = `${size} KB`;
    });
    // 🔼🔽 화살표 클릭 → 날짜 이동
    document.getElementById('date-up')?.addEventListener('click', () => changeDate(-1));
    document.getElementById('date-down')?.addEventListener('click', () => changeDate(1));

    // 📅 날짜 버튼 클릭 → 모달 띄우기
    document.getElementById('date-label')?.addEventListener('click', () => {
      const prev = document.getElementById('date-modal');
      if (prev) return; // ← 이미 있으면 제거 (안 열리는 버그 방지)

      const style = document.createElement('style');
      style.textContent = `
      .titlebar {
        font-weight: bold;
        font-size: 20px;
        background: #f87171;
        color: white;
        padding: 12px 20px;
        cursor: move;
        border-top-left-radius: 16px;
        border-top-right-radius: 16px;
        margin: -24px -24px 16px -24px;  /* ← 모달 안쪽 여백을 뚫고 상단에 맞게 배치 */
      }
    
      #date-modal .tooltip-msg {
        visibility: hidden;
        opacity: 0;
        transition: opacity 0.3s;
      }
    
      #date-modal div:hover > .tooltip-msg {
        visibility: visible !important;
        opacity: 1 !important;
      }
    `;
      document.head.appendChild(style);
    
      const modal = document.createElement('div');
      modal.id = 'date-modal';
        modal.style = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        padding: 24px;
        z-index: 9999999;
        width: 440px;
        font-family: 'Pretendard', sans-serif;
        cursor: move;
      `;
    
      modal.innerHTML = `
        <style>
          #date-modal button {
            font-size: 14px;
            padding: 10px 16px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
          }
          #date-modal .range-btn {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
          }
          #date-modal #cancel-range {
            background: #e5e7eb;
            color: #111827;
          }
          #date-modal #confirm-range {
            background: #2563eb;
            color: white;
          }
        </style>
      
        <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; gap:10px;">
            <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
              <label for="range-start" style="font-size:12px; color:#6b7280;">시작일</label>
              <input type="date" id="range-start" style="padding:10px 12px; border:1px solid #d1d5db; border-radius:8px;">
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
              <label for="range-end" style="font-size:12px; color:#6b7280;">종료일</label>
              <input type="date" id="range-end" style="padding:10px 12px; border:1px solid #d1d5db; border-radius:8px;">
            </div>
          </div>
        </div>
      
        <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:16px;">
          <button class="range-btn" data-range="1" style="flex:1;">하루</button>
          <button class="range-btn" data-range="7" style="flex:1;">일주일</button>
          <button class="range-btn" data-range="30" style="flex:1;">한달</button>
          <button class="range-btn" data-range="365" style="flex:1;">일년</button>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button id="cancel-range">취소</button>
          <button id="confirm-range">적용</button>
        </div>
        <!-- ❔ 도움말 아이콘 -->
        <div style="position: absolute; bottom: 12px; left: 16px;">
          <div style="position: relative; display: inline-block;">
            <div style="
              width: 26px; height: 26px;
              border-radius: 50%;
              background: #f3f4f6;
              border: 1px solid #d1d5db;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              font-weight: bold;
              color: #6b7280;
              cursor: default;
            ">?</div>
            <div style="
              visibility: hidden;
              opacity: 0;
              width: max-content;
              max-width: 240px;
              background-color: #374151;
              color: #f9fafb;
              text-align: left;
              border-radius: 8px;
              padding: 10px 14px;
              position: absolute;
              z-index: 1;
              bottom: 34px;
              left: 0;
              font-size: 13px;
              line-height: 1.4;
              transition: opacity 0.3s;
              pointer-events: none;
            " class="tooltip-msg">
              두 달 이전의 데이터는 월별 1일만 선택 가능합니다.<br>
              선택 후 데이터 로딩에 지연이 발생할 수 있습니다.
            </div>
          </div>
        </div>
      `;
      /* ---------- 타이틀바 만들고 맨 위에 넣기 ---------- */
      const titlebar = document.createElement('div');
      titlebar.className = 'titlebar';
      titlebar.textContent = '📅 기간 선택';
      modal.insertBefore(titlebar, modal.firstChild);

      document.body.appendChild(modal);  // ✅ 모달을 화면에 붙이고

      // ★ 날짜 제약 설정 ── 여기부터
      (() => {
        /* 공용 포매터 */
        const fmt = d => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${dd}`;
        };
      
        /* KST 오늘 0시 */
        const now   = new Date();
        const utc   = now.getTime() + now.getTimezoneOffset() * 60000;
        const today = new Date(utc + 9 * 60 * 60 * 1000);   // KST
        today.setHours(0, 0, 0, 0);
      
        /* 한계 계산 */
        const oldestAllowed   = new Date(today.getFullYear(), today.getMonth() - 13, 1); // 13개월 전 1일
        const prevMonthFirst  = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const thisMonthFirst  = new Date(today.getFullYear(), today.getMonth(),     1);
      
        /* 입력 box */
        const startInput = modal.querySelector('#range-start');
        const endInput   = modal.querySelector('#range-end');
      
        /* 기본 min / max */
        [startInput, endInput].forEach(inp => {
          inp.min = fmt(oldestAllowed);
          inp.max = fmt(today);
        });
      
        /* “저저번달은 1일만” 규칙 + 미래/13 개월 초과 방지 */
        function validateAndClamp(inp) {
          if (!inp.value) return;
      
          const [y, m, d] = inp.value.split('-').map(Number);
          const kstDate   = new Date(y, m - 1, d);   // KST 자정 기준
      
          /* ① 미래 차단 */
          if (kstDate > today) {
            alert('미래 날짜는 선택할 수 없습니다');
            inp.value = '';
            return;
          }
      
          /* ② 13개월 초과 차단 */
          if (kstDate < oldestAllowed) {
            alert('13개월을 초과한 날짜는 선택할 수 없습니다');
            inp.value = '';
            return;
          }
      
          /* ③ 저저번달이면 1일로 강제 */
          if (kstDate < prevMonthFirst && kstDate.getDate() !== 1) {
            kstDate.setDate(1);
            inp.value = fmt(kstDate);
          }
        }
      
        startInput.addEventListener('change', () => {
          validateAndClamp(startInput);
          /* 종료일은   start 이상만 허용 */
          if (startInput.value) endInput.min = startInput.value;
        });
      
        endInput.addEventListener('change', () => {
          validateAndClamp(endInput);
        });
      
        /* 달력 열릴 때마다 min/max 재설정 (저저번달 1일만 노출) */
        [startInput, endInput].forEach(inp => {
          inp.addEventListener('focus', () => {
            const [y, m] = fmt(today).split('-').map(Number);
      
            /* 기본값: 전체 허용 */
            inp.min = fmt(oldestAllowed);
            inp.max = fmt(today);
      
            /* 달력이 저저번달 페이지로 열리면 그 달의 1일만 선택 */
            const shownYear  = Number(inp.value.slice(0, 4)) || y;
            const shownMonth = Number(inp.value.slice(5, 7)) || m;
            const shownFirst = new Date(shownYear, shownMonth - 1, 1);
      
            if (shownFirst < prevMonthFirst) {
              const only  = fmt(shownFirst);
              inp.min = inp.max = only;
            }
          });
        });
      })();
      // ★ 날짜 제약 설정 ── 여기까지

      // ✅ 곧바로 아래에 드래그 기능 부착
      let drag = false, dx = 0, dy = 0;

      modal.addEventListener('mousedown', e => {
        if (!e.target.classList.contains('titlebar')) return;
        drag = true;
        dx = e.clientX - modal.offsetLeft;
        dy = e.clientY - modal.offsetTop;
      });
      
      document.addEventListener('mousemove', e => {
        if (!drag) return;
        modal.style.left = e.clientX - dx + 'px';
        modal.style.top = e.clientY - dy + 'px';
      });
      
      document.addEventListener('mouseup', () => drag = false);

      // 버튼 날짜 자동 채우기
      modal.querySelectorAll('.range-btn').forEach(btn => {
        btn.onclick = () => {
          const days = parseInt(btn.dataset.range);
      
          // ✅ 한국시간 (KST, UTC+9) 기준으로 "정확한 날짜" 계산
          const nowUTC = new Date(Date.now() + 9 * 60 * 60 * 1000); // KST 보정
          const today = new Date(nowUTC.getFullYear(), nowUTC.getMonth(), nowUTC.getDate()); // 오전 0시 기준
      
          const start = new Date(today);
          start.setDate(start.getDate() - days + 1);
      
          const format = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dd}`;
          };
      
          modal.querySelector('#range-start').value = format(start);
          modal.querySelector('#range-end').value = format(today);
        };
      });
    
      // 적용 클릭
      modal.querySelector('#confirm-range').onclick = () => {
        const start = modal.querySelector('#range-start').value;
        const end   = modal.querySelector('#range-end').value;
        if (!start || !end) return alert('날짜를 모두 입력하세요');
      
        let startDate = new Date(start);
        let endDate = new Date(end);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      
        if (startDate > endDate) return alert('시작일은 종료일보다 앞서야 합니다');
      
        let dayKeys = Object.keys(allData)
          .filter(k => {
            const clean = k.replace(/\s/g, '');
            const parts = clean.split('.');
            if (parts.length < 2) return false;
            const y = parseInt(parts[0]), m = parseInt(parts[1]), d = parts[2] ? parseInt(parts[2]) : 1;
            if (!y || !m) return false;
            const date = new Date(y, m - 1, d);
            return date >= startDate && date <= endDate;
          })
          .sort((a, b) => new Date(a.replace(/\./g, '-')) - new Date(b.replace(/\./g, '-'))); // 최신 닉네임 판단용
      
        const map = new Map();
        const latestNicknameMap = new Map(); // ID 기준 → 최신 닉네임 저장
        const latestTopBJMap    = new Map();
      
        dayKeys.forEach(k => {
          const rows = allData[k] || [];
          rows.forEach(row => {
            const rawId = row.userId;
            const normalizedId = rawId.replace(/\(\d+\)$/, '').replace(/\s/g, '');
        
            if (!map.has(normalizedId)) {
              map.set(normalizedId, {
                ...row,
                userId: normalizedId, // ID는 정규화
                totalStars: (row.totalStars || '0').toString().replace(/,/g, '').toLocaleString(),
                totalTimes: (row.totalTimes || '0').toString(),
                totalBJs: (row.totalBJs || '0').toString(),
              });
              latestNicknameMap.set(normalizedId, row.nickname);
              if (row.topBJ) latestTopBJMap.set(normalizedId, row.topBJ);
            } else {
              const existing = map.get(normalizedId);
        
              existing.totalStars = (
                +((existing.totalStars || '0').toString().replace(/,/g, '')) +
                +((row.totalStars || '0').toString().replace(/,/g, ''))
              ).toLocaleString();
        
              existing.totalTimes = (
                +(existing.totalTimes || 0) + +(row.totalTimes || 0)
              ).toString();
        
              existing.totalBJs = (
                +(existing.totalBJs || 0) + +(row.totalBJs || 0)
              ).toString();
        
              latestNicknameMap.set(normalizedId, row.nickname);
              if (row.topBJ) latestTopBJMap.set(normalizedId, row.topBJ);
            }
          });
        });
      
        const mergedArr = Array.from(map.entries())
          .map(([id, data]) => ({
            ...data,
            userId: id,
            nickname: latestNicknameMap.get(id),
            topBJ:    latestTopBJMap.get(id) || '(알수없음)'
          }))
          .sort((a, b) => parseInt(b.totalStars.replace(/,/g, '')) -
                         parseInt(a.totalStars.replace(/,/g, '')))
          .map((r, i) => ({ ...r, rank: i + 1 }));
      
        const newData = { ...allData };
        newData['__merged__'] = mergedArr;           // ✅ '데이터 합산'으로 저장
        renderPoongUI(newData, '__merged__');
        modal.remove();
      };
      // 취소
      modal.querySelector('#cancel-range').onclick = () => modal.remove();
    
    });
    const header = box.querySelector('#poong-header');
    makeDraggable(box, header);
    
    document.getElementById('poong-close').onclick = () => box.remove();

    // ✅ 날짜 드롭다운 다시 채우기
    const dateSelect   = document.getElementById('date-select');
    const sortedDates  = sortedKeys(allData);

    dateSelect.innerHTML = '';

    const makeOpt = (val, label, sel = false) => {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = label;
      if (sel) o.selected = true;
      return o;
    };

    // ── 1) -선택- 옵션: 항상 맨 위 ─────────────
    dateSelect.appendChild(makeOpt('', '-선택-', !selectedDate));

    // ── 2) 일별 & 월별 날짜 ─────────────
    sortedDates.forEach(dateKey => {
      if (dateKey === '__merged__') return; // 별도로 처리
      const label = dateKey.replace('.json', '');
      const opt = makeOpt(dateKey, label, dateKey === selectedDate);
      dateSelect.appendChild(opt);
    });

    // ── 3) 합산 ──────────────
    if (allData['__merged__']) {
      dateSelect.appendChild(makeOpt('__merged__', '데이터 합산', selectedDate === '__merged__'));
    }

    // ✅ 이벤트
    dateSelect.addEventListener('change', e => renderPoongUI(allData, e.target.value));
    
    const refresh = async () => {
      await clickMoreUntilDone();                   // 페이지 “더보기” 모두 클릭
    
      const rawDate = getCurrentDate();             // ex) "2025.07.08"
      const d = rawDate.replace(/\s/g, '');         // 혹시 모를 공백 제거
    
      const rawData = extractPoongData();
      let newData;
    
      if (/^\d{4}\.\d{2}$/.test(d)) {               // 월별: 최소 정보만 저장
        newData = rawData.map((r, i) => ({
          rank: i + 1,
          userId: r.userId,
          nickname: r.nickname,
          topBJ: r.topBJ,
        }));
      } else {                                      // 일별: 전체 정보 저장
        newData = rawData.map((r, i) => ({
          rank: i + 1,
          userId: r.userId,
          nickname: r.nickname,
          totalStars: r.totalStars || '',
          totalTimes: r.totalTimes || '',
          totalBJs:  r.totalBJs  || '',
          topBJ: r.topBJ,
        }));
      }
    
      /* ── chrome.storage.local 에 병합 저장 ── */
      const store = await new Promise(r =>
        chrome.storage.local.get(STORAGE_KEY, res => r(res[STORAGE_KEY] || {}))
      );
      store[d] = newData;                            // 공백 없는 키로 저장
    
      chrome.storage.local.set({ [STORAGE_KEY]: store }, () => {
        renderPoongUI(store, d);                     // 공백 없는 키로 UI 렌더링
      });
    };
    
    document.getElementById('refresh-btn').onclick = refresh;

    document.getElementById('erase-btn').onclick = () => {
      chrome.storage.local.get([STORAGE_KEY], result => {
        const store = result[STORAGE_KEY] || {};
        if (!selectedDate || !store[selectedDate]) {
          alert('❌ 삭제할 날짜 데이터가 없습니다.');
          return;
        }
    
        delete store[selectedDate];
        chrome.storage.local.set({ [STORAGE_KEY]: store }, () => {
          const nextDate = sortedKeys(store)[0] || '';  
          selectedDate = nextDate;                      
          renderPoongUI(store, selectedDate);           
        });
      });
    };
    
    document.querySelector('#export-btn').onclick = async () => {
      const result = await new Promise(resolve =>
        chrome.storage.local.get(['poong_donation_by_date'], resolve)
      );
    
      const allData = result.poong_donation_by_date || {};
      const keys = Object.keys(allData);
    
      if (keys.length === 0) return;
    
      // 날짜 정규식 확인 (띄어쓰기 제거된 YYYY.MM.DD 또는 YYYY.MM)
      const isValidDate = date => /^\d{4}\.\d{2}(\.\d{2})?$/.test(date.replace(/\s/g, ''));
    
      for (const origKey of keys) {
        const cleanKey = origKey.replace(/\s/g, '');        // 띄어쓰기 제거
        if (!isValidDate(cleanKey)) continue;
    
        const noDotKey = cleanKey.replace(/\./g, '');       // 🔥 점 제거
    
        const data = allData[origKey];
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
    
        const a = document.createElement('a');
        a.href = url;
        a.download = `${noDotKey}.json`;                   // 🔥 점 제거된 이름으로 저장
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    
        // ✅ 150ms 딜레이로 순차 저장
        await new Promise(r => setTimeout(r, 150));
      }
    };

    // ─── 여러 JSON 파일(또는 폴더) 한꺼번에 불러오기 ───
    document.querySelector('#import-btn').onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.multiple = true;         // 다중 선택
      input.webkitdirectory = true;  // 폴더째 선택 가능
    
      input.onchange = async e => {
        const files = Array.from(e.target.files)
          .filter(f => /\.json$/i.test(f.name));    // JSON만 필터
    
        if (!files.length) return;
    
        // ① 기존 저장 데이터 불러오기
        const existing = await new Promise(resolve =>
          chrome.storage.local.get('poong_donation_by_date', res =>
            resolve(res.poong_donation_by_date || {})
          )
        );
    
        // ② 새 파일 병합
        for (const file of files) {
          try {
            const text = await file.text();
            const data = JSON.parse(text);
    
            // 🔧 파일명에서 키 추출 + 공백/점 제거 → YYYYMMDD 형식으로
            let key = file.webkitRelativePath
              ? file.webkitRelativePath.split('/').pop().replace(/\.json$/i, '')
              : file.name.replace(/\.json$/i, '');
    
            key = key.replace(/\s/g, '').replace(/\./g, '');  // 띄어쓰기 및 점 제거
    
            // 🔒 키 포맷 유효성 검사: YYYYMM 또는 YYYYMMDD 만 허용
            if (!/^\d{6}(\d{2})?$/.test(key)) {
              console.warn(`❌ 무시됨: 잘못된 날짜 형식 → ${file.name}`);
              continue;
            }
    
            existing[key] = data;  // 병합 또는 덮어쓰기
    
          } catch (err) {
            console.warn(`❌ ${file.name} 파싱 실패`, err);
          }
        }
    
        // ③ 병합 저장 후 UI 갱신
        chrome.storage.local.set({ poong_donation_by_date: existing }, () => {
          const latest = Object.keys(existing).sort().reverse()[0] || '';  // 최신 날짜 기준
          renderPoongUI(existing, latest);               // 새로고침 없이 렌더링
          alert(`✅ ${files.length}개 날짜 데이터를 불러왔습니다!`);
        });
      };
    
      input.click();
    };

    document.getElementById('reset-btn').onclick = () => {
      const confirmed = confirm('⚠️ 모든 후원 데이터를 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.');
      if (!confirmed) return;
    
      chrome.storage.local.set({ [STORAGE_KEY]: {} }, () => {
        selectedDate = '';
        renderPoongUI({}, '');
        alert('✅ 모든 후원 데이터가 초기화되었습니다.');
      });
    };

    const doFilter = () => {
      const key = document.getElementById('filter-key').value.trim();
      const star = parseInt(document.getElementById('filter-star').value.trim()) || 0;
      document.getElementById('poong-table-body').innerHTML = renderRows(list, key, star);
    };
    
    document.getElementById('filter-key').onkeydown = e => {
      if (e.key === 'Enter') doFilter();
    };
    document.getElementById('filter-star').onkeydown = e => {
      if (e.key === 'Enter') doFilter();
    };
  }

  async function loadAllDateFiles() {
    try {
      const indexUrl  = chrome.runtime.getURL("index.json");
      const indexRes  = await fetch(indexUrl);
      const indexJson = await indexRes.json();           // { files: [...] }
      const files     = indexJson.files || [];
  
      const map = {};
      for (const file of files) {
        const fileUrl = chrome.runtime.getURL(`date/${file}`);
        try {
          const res = await fetch(fileUrl);
          if (!res.ok) throw new Error("404");
          const data = await res.json();
  
          // 🔧 파일명에서 키 추출 (확장자 제거 + 공백 제거)
          const rawKey = file.replace(/\.json$/i, '');
          const key = rawKey.replace(/\s/g, '');
  
          // 🔒 날짜 형식 확인: YYYY.MM 또는 YYYY.MM.DD만 허용
          if (!/^\d{4}\.\d{2}(\.\d{2})?$/.test(key)) {
            console.warn(`[loadAllDateFiles] ❌ 잘못된 키 형식: ${rawKey}`);
            continue;
          }
  
          map[key] = data;
        } catch (e) {
          console.warn("[loadAllDateFiles] missing:", file);
        }
      }
      return map;
    } catch (err) {
      console.error("[loadAllDateFiles] failed:", err);
      return {};
    }
  }
  
  /* ─────────── ② UI 열 때 자동 로드 ─────────── */
  window.showPoongUI = async function () {
    const dataMap = await loadAllDateFiles();  // ← date/* 로드

    // ✅ 유효한 날짜 키만 필터
    const validKeys = Object.keys(dataMap).filter(key =>
      /^\d{4}\.\d{2}(\.\d{2})?$/.test(key)
    ).sort((a, b) => b.localeCompare(a));

    const latest = validKeys[0] || "";

    renderPoongUI(dataMap, latest);           // 기존 렌더 함수 재사용
  };
  const icon = document.createElement('div');
  icon.innerHTML = '🐷'; // 아이콘 내용 바꾸고 싶으면 여기
  Object.assign(icon.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '48px',
    height: '48px',
    background: 'white',
    borderRadius: '50%',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#111827',
    cursor: 'pointer',
    zIndex: 2147483647,
    transition: 'all 0.2s ease',
  });
  icon.title = '요닝 큰손 알리미';
  icon.onmouseenter = () => icon.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
  icon.onmouseleave = () => icon.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  icon.onclick = window.showPoongUI;
  document.body.appendChild(icon);

/*==============여기서부터 알림설정================*/

// 🔔 알림 아이콘 생성
const alertIcon = document.createElement('div');
alertIcon.innerHTML = '🔔';
Object.assign(alertIcon.style, {
  position: 'fixed',
  bottom: '80px',
  right: '20px',
  width: '48px',
  height: '48px',
  background: 'white',
  borderRadius: '50%',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#111827',
  cursor: 'pointer',
  zIndex: 2147483647,
  transition: 'all 0.2s ease',
});
alertIcon.title = '알림 설정 열기';
alertIcon.onmouseenter = () => alertIcon.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
alertIcon.onmouseleave = () => alertIcon.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
document.body.appendChild(alertIcon);

let alertPanel = null;
let alertUserList = [];

// 📌 알림 설정 패널 표시 함수
function showAlertPanel() {
  if (!alertPanel) return;

  chrome.storage.local.get('poong_alert_config', ({ poong_alert_config }) => {
    const config = poong_alert_config || {};
    alertPanel.querySelector('#alert-enabled').checked = config.enabled || false;
    alertPanel.querySelector('#alert-start').value = config.start || '';
    alertPanel.querySelector('#alert-end').value = config.end || '';
    alertPanel.querySelector('#alert-stars').value = config.minStars || '';
    alertUserList = (config.manualIds || []);
    renderAlertTags();
  });

  alertPanel.style.display = 'block';
}

// 📌 태그 렌더링
function renderAlertTags() {
  const tagBox = alertPanel.querySelector('#alert-tags');
  tagBox.innerHTML = '';
  alertUserList.forEach((id, idx) => {
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.innerHTML = `${id}<button class="remove">×</button>`;
    tag.querySelector('button').onclick = () => {
      alertUserList.splice(idx, 1);
      renderAlertTags();
    };
    tagBox.appendChild(tag);
  });
}

// 📌 알림 패널 생성
function createAlertPanel() {
  alertPanel = document.createElement('div');
  alertPanel.id = 'poong-alert-panel';
  alertPanel.style = `
    position:fixed;
    right:80px;
    bottom:80px;
    width:360px;
    background:#f9fafb;
    border:1px solid #d1d5db;
    border-radius:12px;
    box-shadow:0 10px 25px rgba(0,0,0,0.1);
    font-family: 'Segoe UI','Pretendard',sans-serif;
    z-index:2147483647;
    overflow:hidden;
    display:none;
  `;

  alertPanel.innerHTML = `
    <div class="panel-header">🔔 알림 설정</div>
    <div class="panel-body">
      <div class="setting-group">
        <label>알림 사용</label>
        <div class="toggle-wrap">
          <label class="toggle-switch">
            <input type="checkbox" id="alert-enabled"><span class="slider"></span>
          </label>
        </div>
      </div>
      <div class="setting-group">
        <label>기간 설정</label>
        <div class="input-row">
          <input type="date" id="alert-start">
          <input type="date" id="alert-end">
        </div>
        <div class="range-buttons">
          <button data-range="1">하루</button>
          <button data-range="7">일주일</button>
          <button data-range="30">한달</button>
          <button data-range="365">일년</button>
        </div>
      </div>
      <div class="setting-group">
        <label>별풍선 필터</label>
        <input type="number" id="alert-stars" placeholder="예: 10000">
      </div>
      <div class="setting-group">
        <label>ID 수동 추가</label>
        <div class="tag-list" id="alert-tags"></div>
        <div class="add-id">
          <input type="text" id="alert-id-input" placeholder="유저 ID 입력">
          <button id="add-id-btn">+ 추가</button>
        </div>
      </div>
    </div>
    <div class="panel-footer">
      <button class="cancel">취소</button>
      <button class="apply" id="save-alert-settings">저장</button>
    </div>
  `;
  document.body.appendChild(alertPanel);

  // 날짜 버튼 처리
  alertPanel.querySelectorAll('.range-buttons button').forEach(btn => {
    btn.onclick = () => {
      const range = parseInt(btn.dataset.range);
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - (range - 1));
      alertPanel.querySelector('#alert-start').value = start.toISOString().split('T')[0];
      alertPanel.querySelector('#alert-end').value = end.toISOString().split('T')[0];
    };
  });

  alertPanel.querySelector('#add-id-btn').onclick = () => {
    const input = alertPanel.querySelector('#alert-id-input');
    const id = input.value.trim();
    if (id && !alertUserList.includes(id)) {
      alertUserList.push(id);
      renderAlertTags();
      input.value = '';
    }
  };

  alertPanel.querySelector('.cancel').onclick = () => {
    alertPanel.style.display = 'none';
  };

  alertPanel.querySelector('.apply').onclick = () => {
    console.log('✅ [알림] 저장 버튼 클릭됨');
    const enabled = alertPanel.querySelector('#alert-enabled').checked;
    const start = alertPanel.querySelector('#alert-start').value;
    const end = alertPanel.querySelector('#alert-end').value;
    const minStars = parseInt(alertPanel.querySelector('#alert-stars').value) || 0;
    const manualIds = [...alertUserList];
  
    console.log('⏳ 수동 ID 목록:', manualIds);
    console.log('⏳ 날짜범위:', start, '~', end);
    console.log('⏳ 별풍선 필터:', minStars);
  
    chrome.storage.local.get(['poong_donation_by_date'], ({ poong_donation_by_date }) => {
      if (!poong_donation_by_date) {
        alert('❌ poong_donation_by_date 없음');
        return;
      }
  
      const matchedIds = new Set();
  
      const toDateObj = str => {
        const [y, m = '1', d = '1'] = str.split(/[^\d]/).map(Number);
        return new Date(y, m - 1, d);
      };
  
      const startDate = toDateObj(start);
      const endDate = toDateObj(end);
  
      Object.entries(poong_donation_by_date).forEach(([rawDate, entries]) => {
        const parts = rawDate.split(/[^\d]/).filter(Boolean);
        const y = parseInt(parts[0] || '0', 10);
        const m = parseInt(parts[1] || '1', 10) - 1;
        const d = parseInt(parts[2] || '1', 10);
        const dateObj = new Date(y, m, d);
  
        if (dateObj >= startDate && dateObj <= endDate) {
          entries.forEach(entry => {
            const id = (entry.user_id || entry.userId || '').trim();
            let raw = entry.totalStars ?? entry.stars ?? '0';
  
            // 객체 형태 대응
            if (typeof raw === 'object' && raw !== null) raw = raw.v ?? '0';
  
            const str = typeof raw === 'string' ? raw : raw.toString();
            let normalized = str.replace(/,/g, '').replace(/[^\d]/g, '');
  
            // "만" 단위 처리
            if (/만/.test(str)) {
              const num = parseFloat(str.replace(/[^\d.]/g, '')) || 0;
              normalized = Math.round(num * 10000).toString();
            }
  
            const stars = parseInt(normalized, 10) || 0;
            if (id && stars >= minStars) matchedIds.add(id);
          });
        }
      });
  
      manualIds.forEach(id => matchedIds.add(id));
      const finalIds = [...matchedIds];
  
      console.log('✅ 최종 감시 ID 목록:', finalIds);
  
      chrome.storage.local.set({
        poong_alert_config: {
          enabled,
          start,
          end,
          minStars,
          ids: finalIds,
          manualIds: manualIds
        }
      }, () => {
        alert(
          `✅ 저장됨\n` +
          `총 ${finalIds.length}명 감시 설정됨\n\n` +
          `[감시 대상 ID]\n${finalIds.join('\n')}\n\n` +
          `[기간] ${start} ~ ${end}\n` +
          `[별풍선 필터] ${minStars}개 이상`
        );
      });
    });
  };
}

// 🔔 아이콘 클릭 시 패널 표시
alertIcon.onclick = () => {
  if (!alertPanel) createAlertPanel();
  showAlertPanel();
};

// (디버그용) 7월 데이터 출력
chrome.storage.local.get('poong_donation_by_date', r => {
  const data = r?.poong_donation_by_date || {};
  const result = [];

  for (const [rawDate, arr] of Object.entries(data)) {
    const normalized = rawDate.replace(/\s/g, '');
    if (/^2025\.?0?7(\.|$)/.test(normalized)) {
      result.push(...arr);
    }
  }

  console.log(`[Poong] ✅ 7월 전체 후원자 수: ${result.length}`);
  console.log(`[Poong] ✅ 7월 전체 후원자 목록:`, result);
});
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
(document.head || document.documentElement).appendChild(script);

// ─────────────────  자동 GitHub 로드  ─────────────────
const BASE_URL = 'https://raw.githubusercontent.com/ksh8741/poongtoo/main/';
const INDEX_URL = BASE_URL + 'index.json';

(async function autoImportFromIndex() {
  const STORAGE_KEY = 'poong_donation_by_date';

  const existing = await new Promise(r =>
    chrome.storage.local.get(STORAGE_KEY, res => r(res[STORAGE_KEY] || {}))
  );
  const savedDates = new Set(Object.keys(existing));

  try {
    const indexRes = await fetch(INDEX_URL);
    const index = await indexRes.json();

    const missingDates = index.filter(date => !savedDates.has(date));
    if (missingDates.length === 0) return;

    for (const date of missingDates) {
      const clean = date.replace(/\./g, '').replace(/\s/g, '');
      const fileUrl = `${BASE_URL}${clean}.json`;  // ← date/ 제거됨

      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error('File not found');
        const data = await res.json();
        existing[date] = data;
      } catch (err) {
        console.warn(`❌ ${date} 불러오기 실패`, err);
      }
    }

    chrome.storage.local.set({ [STORAGE_KEY]: existing }, () => {
      console.log(`✅ 자동 불러오기 완료 (${missingDates.length}개)`);
      renderPoongUI(existing);
    });

  } catch (err) {
    console.warn('❌ index.json 로딩 실패', err);
  }
})();
// ─────────────────  자동 GitHub 로드 끝 ─────────────────
})();
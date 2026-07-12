(() => {
  const DEFAULTS = {
    piscineStart: "2026-06-29",
    piscineEnd: "2026-07-23",
    targetHours: 0, // 총 목표 시간(h). 0이면 미설정 (주 목표 있으면 주 목표×주차 수로 대체)
    lang: "ko",
    excludeDays: [], // 제외 요일: 0(일)~6(토)
    excludeDates: [], // 제외 날짜: ["2026-07-15", ...]
    weeklyGoal: 0, // 주차별 목표 시간(h). 0이면 표시 안 함 (경북대 현장실습: 40)
  };

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  const STR = {
    ko: {
      waiting:
        "로그타임 데이터를 기다리는 중...<br>프로필의 <b>로그타임 캘린더가 보이도록</b> 스크롤/이동해 보세요.",
      piscine: "라피신",
	  titleWithLogin: (login) => `⏱ ${login} 로그타임`,
      titleDefault: "⏱ Moulinette Time",
      short: (t) => `부족 ${t}`,
      reached: (h, extra) => ` ${h}시간 달성! (+${extra})`,
      leftLine: (d) => `남은 ${d}일`,
      avgLine: (avg) => `오늘부터 매일 ${avg}`,
	  avgLive: (avg) => `지금부터 매일 ${avg}`,
      period: (elapsed, total) => `기간 ${total}일 · 경과 ${elapsed}일`,
      dayNames: ["일", "월", "화", "수", "목", "금", "토"],
      exclDays: "제외 요일",
      exclDates: "제외 날짜",
      dateCount: (n) => `날짜 ${n}일`,
      weekly: "주차별",
      weekLabel: (n) => `${n}주차`,
      wgoal: "주 목표(h)",
      attend: (n) => `${n}일`,
      weekAvg: (avg) => `[고정] 이번 주 하루 평균 ${avg} 필요`,
      weekAvgLive: (avg) => `[라이브] 이번 주 하루 평균 ${avg} 필요`,
      weekDone: "이번 주 목표 달성 ✓",
      shortWeek: (t) => `이번 주 부족 ${t}`,
      thisWeek: (range) => `이번 주 (${range})`,
      cumul: (t) => `누적: ${t}`,
      today: "오늘",
      monthly: "월별",
      monthName: (m) => `${m}월`,
      start: "시작",
      end: "종료",
      goal: "목표(h)",
      settingsTitle: "설정",
      collapse: "접기",
      langBtn: "EN", // 누르면 전환될 언어 표시
      dur: (h, min) => `${h}시간 ${String(min).padStart(2, "0")}분`,
    },
    en: {
      waiting:
        "Waiting for logtime data...<br>Scroll so the <b>logtime calendar is visible</b> on your profile.",
      piscine: "Piscine",
	  titleWithLogin: (login) => `⏱ ${login}'s logtime`,
      titleDefault: "⏱ Moulinette Time",
      short: (t) => `Short by ${t}`,
      reached: (h, extra) => ` ${h}h reached! (+${extra})`,
      leftLine: (d) => `${d} left`,
      avgLine: (avg) => `[Fixed] Need ${avg} / day`,
      avgLive: (avg) => `[Live] Need ${avg} / day`,
      period: (elapsed, total) => `${total} days total · ${elapsed} elapsed`,
      dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      exclDays: "Skip days",
      exclDates: "Skip dates",
      dateCount: (n) => `${n} date${n > 1 ? "s" : ""}`,
      weekly: "Weekly",
      weekLabel: (n) => `W${n}`,
      wgoal: "Wk goal(h)",
      attend: (n) => `${n}d`,
      weekAvg: (avg) => `[Fixed] This week: need ${avg}/day`,
      weekAvgLive: (avg) => `[Live] This week: need ${avg}/day`,
      weekDone: "Weekly goal reached ✓",
      shortWeek: (t) => `This week short by ${t}`,
      thisWeek: (range) => `This week (${range})`,
      cumul: (t) => `Total: ${t}`,
      today: "Today",
      monthly: "Monthly",
      monthName: (m) =>
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1],
      start: "Start",
      end: "End",
      goal: "Goal(h)",
      settingsTitle: "Settings",
      collapse: "Collapse",
      langBtn: "한",
      dur: (h, min) => `${h}h ${String(min).padStart(2, "0")}m`,
    },
  };

  let statsByDate = null; // { "2026-07-01": seconds, ... }
  let settings = { ...DEFAULTS };
  let currentLogin = null;
  function findLogin() {
  // 1순위: 프로필 상세 영역의 로그인 (p.text-sm)
  const p = document.querySelector("p.text-sm");
  if (p) {
    const text = p.textContent.trim();
    if (text) return text;
  }

  // 2순위: URL의 /users/{login}
  const urlMatch = location.pathname.match(/\/users\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];

  // 3순위: 네비바의 내 계정 정보 (항상 내 id)
  const meEl = document.querySelector("span[data-login]");
  if (meEl) return meEl.getAttribute("data-login");

  // 4순위(백업)
  const el = document.querySelector("[data-login]");
  if (el) return el.getAttribute("data-login");
  const link = document.querySelector('a[href*="/users/"]');
  if (link) {
    const m = link.getAttribute("href").match(/\/users\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
  }
  return null;
}

  function updateLogin() {
    const login = findLogin();
    if (login && login !== currentLogin) {
      currentLogin = login;
      render();
    }
  }

  const L = () => STR[settings.lang] || STR.ko;

  // ---------- 유틸 ----------

  function durationToSeconds(str) {
    const m = String(str).match(/^(\d+):(\d{1,2}):(\d{1,2})(?:\.\d+)?$/);
    if (!m) return 0;
    return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
  }

  function fmt(seconds) {
    const totalMin = Math.round(seconds / 60);
    const h = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    return L().dur(h, min);
  }

  function fmtShort(seconds) {
    const totalMin = Math.round(seconds / 60);
    const h = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    return `${h}h${String(min).padStart(2, "0")}m`;
  }

  function isoDate(d) {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function todayISO() {
    return isoDate(new Date());
  }

  function mmdd(iso) {
    const [, m, d] = iso.split("-");
    return `${+m}/${+d}`;
  }

  function daysBetweenInclusive(fromISO, toISO) {
    const from = new Date(fromISO + "T00:00:00");
    const to = new Date(toISO + "T00:00:00");
    return Math.round((to - from) / 86400000) + 1;
  }

  // 제외 요일(excludedDays: [0~6])과 제외 날짜(excludedDates: ISO 문자열)를
  // 뺀 날짜 수 (양끝 포함)
  function countDaysExcluding(fromISO, toISO, excludedDays, excludedDates) {
    const daySet = new Set(excludedDays || []);
    const dateSet = new Set(excludedDates || []);
    let count = 0;
    const cursor = new Date(fromISO + "T00:00:00");
    const to = new Date(toISO + "T00:00:00");
    while (cursor <= to) {
      if (!daySet.has(cursor.getDay()) && !dateSet.has(isoDate(cursor))) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }

  // ---------- 설정 ----------
  function sanitizeSettings(raw, base = DEFAULTS) {
    const s = { ...base };
    if (raw && DATE_RE.test(raw.piscineStart || "")) s.piscineStart = raw.piscineStart;
    if (raw && DATE_RE.test(raw.piscineEnd || "")) s.piscineEnd = raw.piscineEnd;
    const t = Number(raw && raw.targetHours);
    if (Number.isFinite(t) && t >= 0) s.targetHours = t;
    if (raw && (raw.lang === "ko" || raw.lang === "en")) s.lang = raw.lang;
    if (raw && Array.isArray(raw.excludeDays)) {
      s.excludeDays = [...new Set(raw.excludeDays)]
        .map(Number)
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        .sort();
    }
    if (raw && Array.isArray(raw.excludeDates)) {
      s.excludeDates = [...new Set(raw.excludeDates)]
        .filter((d) => DATE_RE.test(String(d)))
        .sort();
    }
    if (raw && raw.weeklyGoal !== undefined) {
      const w = Number(raw.weeklyGoal);
      if (Number.isFinite(w) && w >= 0) s.weeklyGoal = w;
    }
    return s;
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (raw) => {
        settings = sanitizeSettings(raw);
        resolve(settings);
      });
    });
  }

  function persist() {
    chrome.storage.sync.set(settings);
  }

  // ---------- 패널 위치 (기기별로 다르므로 storage.local 사용) ----------
  // 우하단(right/bottom) 기준으로 저장·배치한다.
  //  - 접기/펼치기 시 우하단 모서리가 고정점이 되어 자연스럽게 접힘
  //  - 창 크기가 바뀌거나 새 창에서 패널이 화면 밖이면 기본 위치(우하단)로 복귀

  const DEFAULT_POS = { right: 16, bottom: 16 };

  function loadPanelPos() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["lt42PanelPos"], (raw) => {
        const p = raw && raw.lt42PanelPos;
        // 새 형식 {right, bottom}만 사용. 옛 {x, y} 형식은 무시 → 기본 위치로 시작
        if (p && Number.isFinite(p.right) && Number.isFinite(p.bottom)) resolve(p);
        else resolve(null);
      });
    });
  }

  function savePanelPos(right, bottom) {
    chrome.storage.local.set({ lt42PanelPos: { right, bottom } });
  }

  // 우하단 기준 배치
  function applyPos(panel, right, bottom) {
    panel.style.right = right + "px";
    panel.style.bottom = bottom + "px";
    panel.style.left = "auto";
    panel.style.top = "auto";
  }

  // 패널이 화면 밖으로 (일부라도) 나갔는지
  function isOffscreen(panel) {
    const r = panel.getBoundingClientRect();
    return (
      r.left < 0 ||
      r.top < 0 ||
      r.right > window.innerWidth ||
      r.bottom > window.innerHeight
    );
  }

  // 화면 밖이면 기본 위치(우하단)로 복귀
  function resetIfOffscreen(panel) {
    if (isOffscreen(panel)) {
      applyPos(panel, DEFAULT_POS.right, DEFAULT_POS.bottom);
      savePanelPos(DEFAULT_POS.right, DEFAULT_POS.bottom);
    }
  }

  // 헤더를 드래그해서 패널을 옮길 수 있게 함 (접힘/펼침 상태 모두 지원)
  // setPointerCapture 사용: 페이지(SPA)나 다른 확장이 document 레벨에서
  // 포인터 이벤트를 가로채도 드래그가 끊기지 않는다.
  // 드래그 중에는 left/top으로 따라가고, 놓는 순간 right/bottom으로 변환 저장.
  function makeDraggable(panel) {
    const header = panel.querySelector(".lt42-header");
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return; // 헤더 위 버튼은 드래그로 처리하지 않음
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      panel.classList.add("lt42-dragging");
      header.setPointerCapture(e.pointerId); // ★ 이후 포인터 이벤트를 헤더로 직행
      e.preventDefault();
    });

    header.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const x = Math.min(
        Math.max(0, e.clientX - offsetX),
        Math.max(0, window.innerWidth - panel.offsetWidth)
      );
      const y = Math.min(
        Math.max(0, e.clientY - offsetY),
        Math.max(0, window.innerHeight - panel.offsetHeight)
      );
      panel.style.left = x + "px";
      panel.style.top = y + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove("lt42-dragging");
      if (header.hasPointerCapture && header.hasPointerCapture(e.pointerId)) {
        header.releasePointerCapture(e.pointerId);
      }
      // 놓는 순간 right/bottom 기준으로 변환해서 적용 + 저장
      const rect = panel.getBoundingClientRect();
      const right = Math.max(0, window.innerWidth - rect.right);
      const bottom = Math.max(0, window.innerHeight - rect.bottom);
      applyPos(panel, right, bottom);
      savePanelPos(right, bottom);
    };
    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);
  }

  // ---------- 데이터 정규화 ----------

  function normalizeStatsMap(raw) {
    const out = {};
    for (const [date, dur] of Object.entries(raw)) {
      out[date] = (out[date] || 0) + durationToSeconds(dur);
    }
    return out;
  }

  function normalizeLocations(arr) {
    const out = {};
    for (const loc of arr) {
      const begin = new Date(loc.begin_at);
      const end = loc.end_at ? new Date(loc.end_at) : new Date();
      if (isNaN(begin) || isNaN(end) || end <= begin) continue;

      let cursor = new Date(begin);
      while (cursor < end) {
        const dayEnd = new Date(cursor);
        dayEnd.setHours(24, 0, 0, 0);
        const segEnd = dayEnd < end ? dayEnd : end;
        const key = isoDate(cursor);
        out[key] = (out[key] || 0) + (segEnd - cursor) / 1000;
        cursor = segEnd;
      }
    }
    return out;
  }

  function acceptData(normalized, sourceLabel) {
    const size = Object.keys(normalized).length;
    if (!statsByDate || size >= Object.keys(statsByDate).length) {
      statsByDate = normalized;
      console.info(`[Moulinette Time] 데이터 수신 (${sourceLabel}, ${size}일)`);
      render();
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== "lt42-interceptor") return;

    if (msg.kind === "stats_map") {
      acceptData(normalizeStatsMap(msg.data), "v3 intercept");
    } else if (msg.kind === "locations") {
      acceptData(normalizeLocations(msg.data), "v3 locations");
    }
  });

  // ---------- 집계 ----------

  function rangeTotal(startISO, endISO) {
    let total = 0;
    for (const [date, sec] of Object.entries(statsByDate)) {
      if (date >= startISO && date <= endISO) total += sec;
    }
    return total;
  }

  function piscineMonthlyTotals(startISO, endISO) {
    const result = [];
    let cursor = new Date(startISO + "T00:00:00");
    cursor.setDate(1);
    const endDate = new Date(endISO + "T00:00:00");

    while (cursor <= endDate) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const monthStart = isoDate(new Date(y, m, 1));
      const monthEnd = isoDate(new Date(y, m + 1, 0));

      const from = monthStart > startISO ? monthStart : startISO;
      const to = monthEnd < endISO ? monthEnd : endISO;

      result.push({ monthNum: m + 1, from, to, seconds: rangeTotal(from, to) });
      cursor = new Date(y, m + 1, 1);
    }
    return result;
  }

  // 주차별 합계: 일~토 달력 주 기준, 라피신 기간 내로 클리핑.
  // 첫 주는 시작일~그 주 토요일, 마지막 주는 일요일~종료일이 된다.
  // (경북대 "마지막 주 일~금" 규칙은 종료일을 금요일로 두면 자동 반영)
  function piscineWeeklyTotals(startISO, endISO) {
    const result = [];
    let cursor = new Date(startISO + "T00:00:00");
    const endDate = new Date(endISO + "T00:00:00");
    let n = 1;

    while (cursor <= endDate) {
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay())); // 이번 주 토요일
      const to = weekEnd < endDate ? weekEnd : endDate;

      const fromISO = isoDate(cursor);
      const toISO = isoDate(to);
      result.push({
        n: n++,
        from: fromISO,
        to: toISO,
        seconds: rangeTotal(fromISO, toISO),
        attendDays: attendanceDays(fromISO, toISO),
      });

      cursor = new Date(to);
      cursor.setDate(cursor.getDate() + 1); // 다음 주 일요일
    }
    return result;
  }

  // 범위 내에서 로그타임이 1분 이상 있는 날 수 (출석 일수)
  function attendanceDays(fromISO, toISO) {
    let count = 0;
    for (const [date, sec] of Object.entries(statsByDate)) {
      if (date >= fromISO && date <= toISO && sec >= 60) count++;
    }
    return count;
  }

  // ---------- 설정 적용 (즉시 반영 + 자동 저장) ----------

  function applySettingsFromInputs(panel) {
    const startInput = panel.querySelector(".lt42-start");
    const endInput = panel.querySelector(".lt42-end");

    const excludeDays = [...panel.querySelectorAll(".lt42-day.lt42-day-on")].map(
      (b) => Number(b.dataset.day)
    );

    const next = sanitizeSettings(
      {
        piscineStart: startInput.value,
        piscineEnd: endInput.value,
        targetHours: panel.querySelector(".lt42-target").value,
        weeklyGoal: panel.querySelector(".lt42-wgoal").value || 0,
        lang: settings.lang,
        excludeDays,
      },
      settings // 검증 실패 시 기본값이 아닌 현재 값 유지
    );

    // 시작 > 종료면 적용하지 않고 입력칸에 경고 표시
    const invalid = next.piscineStart > next.piscineEnd;
    startInput.classList.toggle("lt42-invalid", invalid);
    endInput.classList.toggle("lt42-invalid", invalid);
    if (invalid) return;

    settings = next;
    persist();
    console.info(
      `[Moulinette Time] 설정 적용: ${settings.piscineStart} ~ ${settings.piscineEnd}, ${settings.targetHours}h`
    );
    render();
  }

  // ---------- 렌더링 ----------

  function ensurePanel() {
    let panel = document.getElementById("lt42-panel");
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = "lt42-panel";
    document.body.appendChild(panel);

    panel.innerHTML = `
      <div class="lt42-header">
        <span class="lt42-title">⏱ Moulinette Time</span>
        <span class="lt42-summary"></span>
        <span class="lt42-btns">
          <button class="lt42-lang"></button>
          <button class="lt42-gear">⚙</button>
          <button class="lt42-min">−</button>
        </span>
      </div>
      <div class="lt42-body">
        <div class="lt42-content">
          <div class="lt42-sub lt42-waiting"></div>
        </div>
        <div class="lt42-settings" hidden>
          <label><span class="lt42-lbl-start"></span> <input type="date" class="lt42-start"></label>
          <label><span class="lt42-lbl-end"></span> <input type="date" class="lt42-end"></label>
          <label><span class="lt42-lbl-goal"></span> <input type="number" class="lt42-target" min="0" placeholder="0"></label>
          <label><span class="lt42-lbl-wgoal"></span> <input type="number" class="lt42-wgoal" min="0" placeholder="0"></label>
          <div class="lt42-days-row">
            <span class="lt42-lbl-days"></span>
            <span class="lt42-day-btns">
              ${[0, 1, 2, 3, 4, 5, 6]
                .map((d) => `<button class="lt42-day" data-day="${d}"></button>`)
                .join("")}
            </span>
          </div>
          <div class="lt42-dates-row">
            <span class="lt42-lbl-dates"></span>
            <input type="date" class="lt42-excl-date">
            <button class="lt42-add-date">+</button>
          </div>
          <div class="lt42-date-chips"></div>
        </div>
      </div>
    `;

    syncSettingsInputs(panel);
    syncChromeText(panel);
    makeDraggable(panel);

    // 언어 토글
    panel.querySelector(".lt42-lang").addEventListener("click", () => {
      settings.lang = settings.lang === "ko" ? "en" : "ko";
      persist();
      syncChromeText(panel);
      render();
    });

    panel.querySelector(".lt42-gear").addEventListener("click", () => {
      const s = panel.querySelector(".lt42-settings");
      s.hidden = !s.hidden;
      if (!s.hidden) syncSettingsInputs(panel);
    });

    panel.querySelector(".lt42-min").addEventListener("click", (e) => {
      panel.classList.toggle("lt42-collapsed");
      e.target.textContent = panel.classList.contains("lt42-collapsed") ? "+" : "−";
    });

    // 변경 즉시 반영: 어떤 입력이든 바뀌면 바로 재계산 + 저장
    for (const sel of [".lt42-start", ".lt42-end", ".lt42-target", ".lt42-wgoal"]) {
      const input = panel.querySelector(sel);
      input.addEventListener("change", () => applySettingsFromInputs(panel));
      input.addEventListener("input", () => applySettingsFromInputs(panel));
    }

    // 요일 토글: 누르면 켜짐/꺼짐 후 즉시 반영
    for (const btn of panel.querySelectorAll(".lt42-day")) {
      btn.addEventListener("click", () => {
        btn.classList.toggle("lt42-day-on");
        applySettingsFromInputs(panel);
      });
    }

    // 제외 날짜 추가 (+ 버튼 또는 날짜 선택 후 Enter)
    const addExclDate = () => {
      const input = panel.querySelector(".lt42-excl-date");
      const v = input.value;
      if (!DATE_RE.test(v) || settings.excludeDates.includes(v)) return;
      settings.excludeDates = [...settings.excludeDates, v].sort();
      persist();
      input.value = "";
      renderDateChips(panel);
      render();
    };
    panel.querySelector(".lt42-add-date").addEventListener("click", addExclDate);
    panel.querySelector(".lt42-excl-date").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addExclDate();
    });

    // 칩의 × 클릭으로 제거 (이벤트 위임)
    panel.querySelector(".lt42-date-chips").addEventListener("click", (e) => {
      const chip = e.target.closest(".lt42-chip");
      if (!chip) return;
      settings.excludeDates = settings.excludeDates.filter(
        (d) => d !== chip.dataset.date
      );
      persist();
      renderDateChips(panel);
      render();
    });

    return panel;
  }

  // 입력칸 값을 현재 설정으로 동기화 (설정창을 열 때 / 초기화할 때만)
  function syncSettingsInputs(panel) {
    panel.querySelector(".lt42-start").value = settings.piscineStart;
    panel.querySelector(".lt42-end").value = settings.piscineEnd;
    panel.querySelector(".lt42-target").value = settings.targetHours || "";
    panel.querySelector(".lt42-wgoal").value = settings.weeklyGoal || "";
    for (const btn of panel.querySelectorAll(".lt42-day")) {
      btn.classList.toggle(
        "lt42-day-on",
        settings.excludeDays.includes(Number(btn.dataset.day))
      );
    }
    renderDateChips(panel);
  }

  // 제외 날짜 칩 목록 렌더링 (클릭하면 제거)
  function renderDateChips(panel) {
    const box = panel.querySelector(".lt42-date-chips");
    box.innerHTML = settings.excludeDates
      .map(
        (d) =>
          `<button class="lt42-chip" data-date="${d}" title="${d}">${mmdd(d)} ×</button>`
      )
      .join("");
  }

  // 언어에 따라 고정 UI 텍스트 갱신
  function syncChromeText(panel) {
    const l = L();
    panel.querySelector(".lt42-lang").textContent = l.langBtn;
    panel.querySelector(".lt42-gear").title = l.settingsTitle;
    panel.querySelector(".lt42-min").title = l.collapse;
    panel.querySelector(".lt42-lbl-start").textContent = l.start;
    panel.querySelector(".lt42-lbl-end").textContent = l.end;
    panel.querySelector(".lt42-lbl-goal").textContent = l.goal;
    panel.querySelector(".lt42-lbl-wgoal").textContent = l.wgoal;
    panel.querySelector(".lt42-lbl-days").textContent = l.exclDays;
    panel.querySelector(".lt42-lbl-dates").textContent = l.exclDates;
    for (const btn of panel.querySelectorAll(".lt42-day")) {
      btn.textContent = l.dayNames[Number(btn.dataset.day)];
    }
    const waiting = panel.querySelector(".lt42-waiting");
    if (waiting) waiting.innerHTML = l.waiting;
  }

  function render() {
    const panel = ensurePanel();
    const content = panel.querySelector(".lt42-content");
    const l = L();

    // 데이터 유무와 무관하게 로그인 표시는 항상 갱신
    panel.querySelector(".lt42-title").textContent = currentLogin
	  ? l.titleWithLogin(currentLogin)
	  : l.titleDefault;

    if (!statsByDate) {
      content.innerHTML = `<div class="lt42-sub lt42-waiting">${l.waiting}</div>`;
      return;
    }

    const { piscineStart: start, piscineEnd: end } = settings;
    const today = todayISO();

    // 주차/월별은 목표 계산에 필요하므로 먼저 집계
    const months = piscineMonthlyTotals(start, end);
    const weeks = piscineWeeklyTotals(start, end);
    const wg = settings.weeklyGoal; // 0이면 주 목표 미사용

    // 표시 모드: 총 목표 직접 설정 > 주 목표만 > 없음
    //  - total: 상단 값/바 = 전체 누적/총 목표
    //  - week : 상단 값/바 = 이번 주 누적/주 목표 (매주 리셋)
    //  - none : 값만, 바 없음
    const mode = settings.targetHours > 0 ? "total" : wg > 0 ? "week" : "none";
    const targetHours = settings.targetHours;
    const targetSec = targetHours * 3600;

    const doneSec = rangeTotal(start, end);
    const remainSec = Math.max(0, targetSec - doneSec);

    // 오늘 로그타임 (하루 평균 계산에 필요하므로 먼저 계산)
    const todaySec = statsByDate[today] || 0;

    // 기간 요약 (시작일을 바꾸면 전체·경과가 바로 변함)
    //  전체 = 시작~종료, 남은 = max(오늘,시작)~종료 (오늘 포함), 경과 = 전체 - 남은
    const totalDays = daysBetweenInclusive(start, end);
    const daysLeft =
      today > end ? 0 : daysBetweenInclusive(today > start ? today : start, end);
    const elapsedDays = totalDays - daysLeft;
    const periodLine = l.period(elapsedDays, totalDays);

    // 남은 날짜 / 하루 평균: 제외 요일·날짜를 뺀 "실제 갈 수 있는 날" 기준.
    //  [고정]  = (부족 + 오늘 로그타임) ÷ 남은 날. 어제까지 누적 기준이라
    //           하루 종일 안 변하는 목표치. "오늘 포함 매일 X씩".
    //  [라이브] = 부족 ÷ 남은 날. 현재 누적 기준이라 오늘 시간을 채울수록
    //           실시간으로 줄어드는 값. "지금 이 순간부터 매일 X씩".
    //  오늘 로그타임이 0이면 두 값이 같으므로 라이브는 생략한다.
    let leftLine = "";
    let avgLine = "";
    let avgLiveLine = "";
    if (daysLeft > 0) {
      const from = today > start ? today : start;
      const effDaysLeft = countDaysExcluding(
        from,
        end,
        settings.excludeDays,
        settings.excludeDates
      );
      if (effDaysLeft > 0) {
        leftLine = l.leftLine(effDaysLeft);
        // 전체 하루 평균은 총 목표를 직접 설정한 경우에만
        if (mode === "total" && remainSec > 0) {
          avgLine = l.avgLine(fmt(Math.ceil((remainSec + todaySec) / effDaysLeft)));
          if (todaySec > 0) {
            avgLiveLine = l.avgLive(fmt(Math.ceil(remainSec / effDaysLeft)));
          }
        }
      }
    }

    // 주 목표 사용 시: 이번 주 누적/부족/하루 평균 (제외 요일·날짜 반영)
    let weekAvgLine = "";
    let weekAvgLiveLine = "";
    let curWeek = null;
    let curWeekRemain = 0;
    if (wg > 0) {
      curWeek = weeks.find((w) => today >= w.from && today <= w.to) || null;
      if (curWeek) {
        curWeekRemain = Math.max(0, wg * 3600 - curWeek.seconds);
        if (curWeekRemain > 0) {
          const effWeekDays = countDaysExcluding(
            today,
            curWeek.to,
            settings.excludeDays,
            settings.excludeDates
          );
          if (effWeekDays > 0) {
            // [고정] 어제까지 누적 기준
            weekAvgLine = `<span class="lt42-avg">${l.weekAvg(
              fmt(Math.ceil((curWeekRemain + todaySec) / effWeekDays))
            )}</span>`;
            // [라이브] 현재 누적 기준 (오늘 로그타임이 있을 때만)
            if (todaySec > 0) {
              weekAvgLiveLine = `<span class="lt42-avg-live">${l.weekAvgLive(
                fmt(Math.ceil(curWeekRemain / effWeekDays))
              )}</span>`;
            }
          }
        }
      }
    }

    // 부족/달성 줄 (모드별)
    let shortLine = "";
    if (mode === "total") {
      shortLine =
        remainSec === 0
          ? `<span class="lt42-ok">${l.reached(targetHours, fmt(doneSec - targetSec))}</span>`
          : `<span class="lt42-warn">${l.short(fmt(remainSec))}</span>`;
    } else if (mode === "week" && curWeek) {
      shortLine =
        curWeekRemain === 0
          ? `<span class="lt42-ok">${l.weekDone}</span>`
          : `<span class="lt42-warn">${l.shortWeek(fmt(curWeekRemain))}</span>`;
    }
    // 총 목표 + 주 목표 둘 다 있는 경우: 이번 주 달성 표시는 weekAvgLine 자리에
    if (mode === "total" && wg > 0 && curWeek && curWeekRemain === 0) {
      weekAvgLine = `<span class="lt42-ok">${l.weekDone}</span>`;
      weekAvgLiveLine = "";
    }

	// 오늘 몫 달성 여부: 오늘 로그타임 >= 라이브 하루 필요량 (모드별 기준)
    let todayCleared = false;
    if (mode === "total" && remainSec > 0 && daysLeft > 0) {
      const from = today > start ? today : start;
      const eff = countDaysExcluding(from, end, settings.excludeDays, settings.excludeDates);
      if (eff > 0) todayCleared = todaySec >= remainSec / eff;
    } else if (mode === "week" && curWeek && curWeekRemain > 0) {
      const eff = countDaysExcluding(today, curWeek.to, settings.excludeDays, settings.excludeDates);
      if (eff > 0) todayCleared = todaySec >= curWeekRemain / eff;
    } else if ((mode === "total" && remainSec === 0) || (mode === "week" && curWeek && curWeekRemain === 0)) {
      todayCleared = true; // 목표 자체를 달성한 상태
    }

    // 상단 값/바 (모드별)
    let headLabel = `${l.piscine} ${mmdd(start)} ~ ${mmdd(end)}`;
    let headValue = fmt(doneSec);
    let barPct = -1; // 음수면 바 없음
    let barDone = false;
    if (mode === "total") {
      headValue = `${fmt(doneSec)} / ${targetHours}h`;
      barPct = Math.min(100, (doneSec / targetSec) * 100);
      barDone = remainSec === 0;
    } else if (mode === "week" && curWeek) {
      headLabel = l.thisWeek(`${mmdd(curWeek.from)}~${mmdd(curWeek.to)}`);
      headValue = `${fmt(curWeek.seconds)} / ${wg}h`;
      barPct = Math.min(100, (curWeek.seconds / (wg * 3600)) * 100);
      barDone = curWeekRemain === 0;
    }

    // 접었을 때 헤더 요약 (모드별)
    const summary = panel.querySelector(".lt42-summary");
    if (mode === "total") {
      summary.textContent = `${fmtShort(doneSec)} / ${targetHours}h`;
      summary.classList.toggle("lt42-summary-done", remainSec === 0);
    } else if (mode === "week" && curWeek) {
      summary.textContent = `${fmtShort(curWeek.seconds)} / ${wg}h`;
      summary.classList.toggle("lt42-summary-done", curWeekRemain === 0);
    } else {
      summary.textContent = fmtShort(doneSec);
      summary.classList.remove("lt42-summary-done");
    }

    content.innerHTML = `
      <div class="lt42-piscine">
        <div class="lt42-row">
          <span class="lt42-label">${headLabel}</span>
          <span class="lt42-value">${headValue}</span>
        </div>
        ${
          barPct >= 0
            ? `
        <div class="lt42-bar">
          <div class="lt42-bar-fill${barDone ? " lt42-done" : ""}"
               style="width:${barPct.toFixed(1)}%"></div>
        </div>`
            : ""
        }
        <div class="lt42-sub">${periodLine}${leftLine ? ` (${leftLine})` : ""}</div>
        ${mode === "week" && curWeek ? `<div class="lt42-sub">${l.cumul(fmt(doneSec))}</div>` : ""}
        ${shortLine ? `<div class="lt42-sub">${shortLine}</div>` : ""}
        ${avgLine ? `<div class="lt42-sub"><span class="lt42-avg">${avgLine}</span></div>` : ""}
        ${avgLiveLine ? `<div class="lt42-sub"><span class="lt42-avg-live">${avgLiveLine}</span></div>` : ""}
        ${weekAvgLine ? `<div class="lt42-sub">${weekAvgLine}</div>` : ""}
        ${weekAvgLiveLine ? `<div class="lt42-sub">${weekAvgLiveLine}</div>` : ""}
        <div class="lt42-sub">${l.today}: <span class="lt42-today${todayCleared ? " lt42-ok" : ""}">${fmt(todaySec)}</span></div>
      </div>

      <div class="lt42-weeks">
        <div class="lt42-sub lt42-months-title">${l.weekly}</div>
        ${weeks
          .map((w) => {
            const isNow = today >= w.from && today <= w.to;
            const ended = w.to < today;
            const met = wg > 0 && w.seconds >= wg * 3600;
            return `
          <div class="lt42-row${isNow ? " lt42-week-now" : ""}">
            <span>${l.weekLabel(w.n)} <span class="lt42-dim">(${mmdd(w.from)}~${mmdd(w.to)})</span></span>
            <span class="lt42-mono">${fmtShort(w.seconds)}${
              wg > 0
                ? `<span class="lt42-dim"> / ${wg}h · ${l.attend(w.attendDays)}</span>${
                    met
                      ? `<span class="lt42-ok"> ✓</span>`
                      : ended
                        ? `<span class="lt42-fail"> ✕</span>`
                        : ""
                  }`
                : ""
            }</span>
          </div>`;
          })
          .join("")}
      </div>

      <div class="lt42-months">
        <div class="lt42-sub lt42-months-title">${l.monthly}</div>
        ${months
          .map(
            (m) => `
          <div class="lt42-row">
            <span>${l.monthName(m.monthNum)} <span class="lt42-dim">(${mmdd(m.from)}~${mmdd(m.to)})</span></span>
            <span class="lt42-mono">${fmtShort(m.seconds)}</span>
          </div>`
          )
          .join("")}
      </div>
    `;
  }

  // ---------- 메인 ----------

  async function main() {
    await loadSettings();
    const panel = ensurePanel();
    updateLogin();
    render();

    // 저장된 패널 위치 복원 (화면 밖이면 우하단 기본 위치로)
    const savedPos = await loadPanelPos();
    if (savedPos) applyPos(panel, savedPos.right, savedPos.bottom);
    resetIfOffscreen(panel);

    // 창 크기가 바뀌어 패널이 화면 밖으로 나가면 우하단으로 복귀
    window.addEventListener("resize", () => resetIfOffscreen(panel));

    let lastPath = location.pathname;
    setInterval(() => {
      const pathChanged = location.pathname !== lastPath;
      if (pathChanged) lastPath = location.pathname;
      // URL이 바뀌었거나, 아직 로그인을 못 찾았으면 계속 재시도
      if (pathChanged || !currentLogin) {
        updateLogin();
      }
    }, 1500);
  }

  main();
})();
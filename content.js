(() => {
  const DEFAULTS = {
    piscineStart: "2026-06-29",
    piscineEnd: "2026-07-23",
    targetHours: 0, // 총 목표 시간(h). 0이면 미설정 (주 목표 있으면 주 목표×주차 수로 대체)
    lang: "ko",
    excludeDays: [], // 제외 요일: 0(일)~6(토)
    excludeDates: [], // 제외 날짜: ["2026-07-15", ...]
    weeklyGoal: 0, // 주차별 목표 시간(h). 0이면 표시 안 함 (경북대 현장실습: 40)
	theme: "", // "light" | "dark" | ""(시스템 따라감)
	avgModeTotal: "fixed", // "both" | "live" | "fixed" | "none" — [총] 하루 평균 줄 표시 방식
	avgModeWeek: "fixed",  // "both" | "live" | "fixed" | "none" — [주] 하루 평균 줄 표시 방식
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
      avgLine: (avg) => `[총] 오늘부터 매일 ${avg} 필요`,
	  avgLive: (avg) => `[총] 지금부터 매일 ${avg} 필요`,
      period: (elapsed, total) => `기간 ${total}일 · 경과 ${elapsed}일`,
      dayNames: ["일", "월", "화", "수", "목", "금", "토"],
      exclDays: "제외 요일",
      exclDates: "제외 날짜",
      dateCount: (n) => `날짜 ${n}일`,
      weekly: "주차별",
      weekLabel: (n) => `${n}주차`,
      wgoal: "주 목표(h)",
      attend: (n) => `${n}일`,
      weekAvg: (avg) => `[주] 오늘부터 매일 ${avg} 필요`,
      weekAvgLive: (avg) => `[주] 지금부터 매일 ${avg} 필요`,
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
      langBtn: "EN",
      dur: (h, min) => `${h}시간 ${String(min).padStart(2, "0")}분`,
      avgModeTotalLbl: "총 평균",
      avgModeWeekLbl: "주 평균",
      avgModeOpts: { both: "둘 다", live: "지금", fixed: "오늘", none: "숨김" },
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
      avgLine: (avg) => `[Total] Need ${avg} / day from today`,
      avgLive: (avg) => `[Total] Need ${avg} / day from now`,
      period: (elapsed, total) => `${total} days total · ${elapsed} elapsed`,
      dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      exclDays: "Skip days",
      exclDates: "Skip dates",
      dateCount: (n) => `${n} date${n > 1 ? "s" : ""}`,
      weekly: "Weekly",
      weekLabel: (n) => `W${n}`,
      wgoal: "Wk goal(h)",
      attend: (n) => `${n}d`,
      weekAvg: (avg) => `[Week] need ${avg} / day from today`,
      weekAvgLive: (avg) => `[Week] need ${avg} / day from now`,
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
      avgModeTotalLbl: "Total avg",
      avgModeWeekLbl: "Week avg",
      avgModeOpts: { both: "Both", live: "Live only", fixed: "Fixed only", none: "Hide" },
    },
  };

  let statsByDate = null;
  let settings = { ...DEFAULTS };
  let currentLogin = null;
  function findLogin() {
  const p = document.querySelector("p.text-sm");
  if (p) {
    const text = p.textContent.trim();
    if (text) return text;
  }

  const urlMatch = location.pathname.match(/\/users\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];

  const meEl = document.querySelector("span[data-login]");
  if (meEl) return meEl.getAttribute("data-login");

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
	if (raw && (raw.theme === "light" || raw.theme === "dark")) s.theme = raw.theme;
	const avgModes = ["both", "live", "fixed", "none"];
	if (raw && avgModes.includes(raw.avgModeTotal)) s.avgModeTotal = raw.avgModeTotal;
	if (raw && avgModes.includes(raw.avgModeWeek)) s.avgModeWeek = raw.avgModeWeek;
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

  function isLightTheme() {
    if (settings.theme) return settings.theme === "light";
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  }

  function applyTheme(panel) {
    panel.classList.toggle("lt42-light", isLightTheme());
    const btn = panel.querySelector(".lt42-theme");
    if (btn) btn.textContent = isLightTheme() ? "⛧" : "☀";
  }

  const DEFAULT_POS = { right: 16, bottom: 16 };

  function loadPanelPos() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["lt42PanelPos"], (raw) => {
        const p = raw && raw.lt42PanelPos;
        if (p && Number.isFinite(p.right) && Number.isFinite(p.bottom)) resolve(p);
        else resolve(null);
      });
    });
  }

  function savePanelPos(right, bottom) {
    chrome.storage.local.set({ lt42PanelPos: { right, bottom } });
  }

  function applyPos(panel, right, bottom) {
    panel.style.right = right + "px";
    panel.style.bottom = bottom + "px";
    panel.style.left = "auto";
    panel.style.top = "auto";
  }

  function isOffscreen(panel) {
    const r = panel.getBoundingClientRect();
    return (
      r.left < 0 ||
      r.top < 0 ||
      r.right > window.innerWidth ||
      r.bottom > window.innerHeight
    );
  }

  function resetIfOffscreen(panel) {
    if (isOffscreen(panel)) {
      applyPos(panel, DEFAULT_POS.right, DEFAULT_POS.bottom);
      savePanelPos(DEFAULT_POS.right, DEFAULT_POS.bottom);
    }
  }

  function makeDraggable(panel) {
    const header = panel.querySelector(".lt42-header");
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      panel.classList.add("lt42-dragging");
      header.setPointerCapture(e.pointerId);
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
      const rect = panel.getBoundingClientRect();
      const right = Math.max(0, window.innerWidth - rect.right);
      const bottom = Math.max(0, window.innerHeight - rect.bottom);
      applyPos(panel, right, bottom);
      savePanelPos(right, bottom);
    };
    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);
  }

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

  function piscineWeeklyTotals(startISO, endISO) {
    const result = [];
    let cursor = new Date(startISO + "T00:00:00");
    const endDate = new Date(endISO + "T00:00:00");
    let n = 1;

    while (cursor <= endDate) {
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));
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
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  function attendanceDays(fromISO, toISO) {
    let count = 0;
    for (const [date, sec] of Object.entries(statsByDate)) {
      if (date >= fromISO && date <= toISO && sec >= 60) count++;
    }
    return count;
  }

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
      settings
    );

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
		  <button class="lt42-theme"></button>
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
          <label class="lt42-row-full"><span class="lt42-lbl-start"></span> <input type="date" class="lt42-start"></label>
          <label class="lt42-row-full"><span class="lt42-lbl-end"></span> <input type="date" class="lt42-end"></label>
          <div class="lt42-pair-row">
            <label><span class="lt42-lbl-goal"></span> <input type="number" class="lt42-target" min="0" placeholder="0"></label>
            <label><span class="lt42-lbl-wgoal"></span> <input type="number" class="lt42-wgoal" min="0" placeholder="0"></label>
          </div>
          <div class="lt42-pair-row">
            <label><span class="lt42-lbl-avgmode-total"></span>
              <select class="lt42-avgmode-total">
                <option value="both"></option>
                <option value="live"></option>
                <option value="fixed"></option>
                <option value="none"></option>
              </select>
            </label>
            <label><span class="lt42-lbl-avgmode-week"></span>
              <select class="lt42-avgmode-week">
                <option value="both"></option>
                <option value="live"></option>
                <option value="fixed"></option>
                <option value="none"></option>
              </select>
            </label>
          </div>
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

    panel.querySelector(".lt42-lang").addEventListener("click", () => {
      settings.lang = settings.lang === "ko" ? "en" : "ko";
      persist();
      syncChromeText(panel);
      render();
    });

    panel.querySelector(".lt42-theme").addEventListener("click", () => {
      settings.theme = isLightTheme() ? "dark" : "light";
      persist();
      applyTheme(panel);
    });
    applyTheme(panel);

    window.matchMedia("(prefers-color-scheme: light)")
      .addEventListener("change", () => { if (!settings.theme) applyTheme(panel); });

    panel.querySelector(".lt42-avgmode-total").addEventListener("change", (e) => {
      settings.avgModeTotal = e.target.value;
      persist();
      render();
    });

    panel.querySelector(".lt42-avgmode-week").addEventListener("change", (e) => {
      settings.avgModeWeek = e.target.value;
      persist();
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

    for (const sel of [".lt42-start", ".lt42-end", ".lt42-target", ".lt42-wgoal"]) {
      const input = panel.querySelector(sel);
      input.addEventListener("change", () => applySettingsFromInputs(panel));
      input.addEventListener("input", () => applySettingsFromInputs(panel));
    }

    for (const btn of panel.querySelectorAll(".lt42-day")) {
      btn.addEventListener("click", () => {
        btn.classList.toggle("lt42-day-on");
        applySettingsFromInputs(panel);
      });
    }

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

  function syncSettingsInputs(panel) {
    panel.querySelector(".lt42-start").value = settings.piscineStart;
    panel.querySelector(".lt42-end").value = settings.piscineEnd;
    panel.querySelector(".lt42-target").value = settings.targetHours || "";
    panel.querySelector(".lt42-wgoal").value = settings.weeklyGoal || "";
    panel.querySelector(".lt42-avgmode-total").value = settings.avgModeTotal;
    panel.querySelector(".lt42-avgmode-week").value = settings.avgModeWeek;
    for (const btn of panel.querySelectorAll(".lt42-day")) {
      btn.classList.toggle(
        "lt42-day-on",
        settings.excludeDays.includes(Number(btn.dataset.day))
      );
    }
    renderDateChips(panel);
  }

  function renderDateChips(panel) {
    const box = panel.querySelector(".lt42-date-chips");
    box.innerHTML = settings.excludeDates
      .map(
        (d) =>
          `<button class="lt42-chip" data-date="${d}" title="${d}">${mmdd(d)} ×</button>`
      )
      .join("");
  }

  function syncChromeText(panel) {
    const l = L();
    panel.querySelector(".lt42-lang").textContent = l.langBtn;
    panel.querySelector(".lt42-gear").title = l.settingsTitle;
    panel.querySelector(".lt42-min").title = l.collapse;
    panel.querySelector(".lt42-lbl-start").textContent = l.start;
    panel.querySelector(".lt42-lbl-end").textContent = l.end;
    panel.querySelector(".lt42-lbl-goal").textContent = l.goal;
    panel.querySelector(".lt42-lbl-wgoal").textContent = l.wgoal;
    panel.querySelector(".lt42-lbl-avgmode-total").textContent = l.avgModeTotalLbl;
    panel.querySelector(".lt42-lbl-avgmode-week").textContent = l.avgModeWeekLbl;
    for (const opt of panel.querySelectorAll(".lt42-avgmode-total option, .lt42-avgmode-week option")) {
      opt.textContent = l.avgModeOpts[opt.value];
    }
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

    panel.querySelector(".lt42-title").textContent = currentLogin
	  ? l.titleWithLogin(currentLogin)
	  : l.titleDefault;

    if (!statsByDate) {
      content.innerHTML = `<div class="lt42-sub lt42-waiting">${l.waiting}</div>`;
      return;
    }

    const { piscineStart: start, piscineEnd: end } = settings;
    const today = todayISO();

    const months = piscineMonthlyTotals(start, end);
    const weeks = piscineWeeklyTotals(start, end);
    const wg = settings.weeklyGoal;

    const mode = settings.targetHours > 0 ? "total" : wg > 0 ? "week" : "none";
    const targetHours = settings.targetHours;
    const targetSec = targetHours * 3600;

    const doneSec = rangeTotal(start, end);
    const remainSec = Math.max(0, targetSec - doneSec);

    const todaySec = statsByDate[today] || 0;

    const totalDays = daysBetweenInclusive(start, end);
    const daysLeft =
      today > end ? 0 : daysBetweenInclusive(today > start ? today : start, end);
    const elapsedDays = totalDays - daysLeft;
    const periodLine = l.period(elapsedDays, totalDays);

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
        if (mode === "total" && remainSec > 0) {
          if (settings.avgModeTotal === "fixed" || settings.avgModeTotal === "both") {
            avgLine = l.avgLine(fmt(Math.ceil((remainSec + todaySec) / effDaysLeft)));
          }
          if (todaySec > 0 && (settings.avgModeTotal === "live" || settings.avgModeTotal === "both")) {
            avgLiveLine = l.avgLive(fmt(Math.ceil(remainSec / effDaysLeft)));
          }
        }
      }
    }

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
            if (settings.avgModeWeek === "fixed" || settings.avgModeWeek === "both") {
              weekAvgLine = `<span class="lt42-avg">${l.weekAvg(
                fmt(Math.ceil((curWeekRemain + todaySec) / effWeekDays))
              )}</span>`;
            }
            if (todaySec > 0 && (settings.avgModeWeek === "live" || settings.avgModeWeek === "both")) {
              weekAvgLiveLine = `<span class="lt42-avg-live">${l.weekAvgLive(
                fmt(Math.ceil(curWeekRemain / effWeekDays))
              )}</span>`;
            }
          }
        }
      }
    }

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
    if (mode === "total" && wg > 0 && curWeek && curWeekRemain === 0) {
      weekAvgLine = `<span class="lt42-ok">${l.weekDone}</span>`;
      weekAvgLiveLine = "";
    }

    let todayCleared = false;
    if (mode === "total" && remainSec > 0 && daysLeft > 0) {
      const from = today > start ? today : start;
      const eff = countDaysExcluding(from, end, settings.excludeDays, settings.excludeDates);
      if (eff > 0) todayCleared = todaySec >= remainSec / eff;
    } else if (mode === "week" && curWeek && curWeekRemain > 0) {
      const eff = countDaysExcluding(today, curWeek.to, settings.excludeDays, settings.excludeDates);
      if (eff > 0) todayCleared = todaySec >= curWeekRemain / eff;
    } else if ((mode === "total" && remainSec === 0) || (mode === "week" && curWeek && curWeekRemain === 0)) {
      todayCleared = true;
    }

    let headLabel = `${l.piscine} ${mmdd(start)} ~ ${mmdd(end)}`;
    let headValue = fmt(doneSec);
    let barPct = -1;
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
        <div class="lt42-sub"><span class="lt42-today-label">${l.today}</span>: <span class="lt42-today${todayCleared ? " lt42-ok" : ""}">${fmt(todaySec)}</span></div>
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

  async function main() {
    await loadSettings();
    const panel = ensurePanel();
    updateLogin();
    render();

    const savedPos = await loadPanelPos();
    if (savedPos) applyPos(panel, savedPos.right, savedPos.bottom);
    resetIfOffscreen(panel);

    window.addEventListener("resize", () => resetIfOffscreen(panel));

    let lastPath = location.pathname;
    setInterval(() => {
      const pathChanged = location.pathname !== lastPath;
      if (pathChanged) lastPath = location.pathname;
      if (pathChanged || !currentLogin) {
        updateLogin();
      }
    }, 1500);
  }

  main();
})();
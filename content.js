(() => {
  const DEFAULTS = {
    piscineStart: "2026-06-29",
    piscineEnd: "2026-07-23",
    targetHours: 120,
    lang: "ko",
    excludeDays: [], // 제외 요일: 0(일)~6(토)
    excludeDates: [], // 제외 날짜: ["2026-07-15", ...]
  };

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  const STR = {
    ko: {
      waiting:
        "로그타임 데이터를 기다리는 중...<br>프로필의 <b>로그타임 캘린더가 보이도록</b> 스크롤/이동해 보세요.",
      piscine: "라피신",
      short: (t) => `부족 ${t}`,
      reached: (h, extra) => ` ${h}시간 달성! (+${extra})`,
      leftLine: (d) => `남은 ${d}일`,
      avgLine: (avg) => `하루 평균 ${avg} 필요`,
      period: (elapsed, total) => `기간 ${total}일 · 경과 ${elapsed}일`,
      dayNames: ["일", "월", "화", "수", "목", "금", "토"],
      exclDays: "제외 요일",
      exclDates: "제외 날짜",
      dateCount: (n) => `날짜 ${n}일`,
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
      short: (t) => `Short by ${t}`,
      reached: (h, extra) => ` ${h}h reached! (+${extra})`,
      leftLine: (d) => `${d} left`,
      avgLine: (avg) => `Need ${avg}/day`,
      period: (elapsed, total) => `${total} days total · ${elapsed} elapsed`,
      dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      exclDays: "Skip days",
      exclDates: "Skip dates",
      dateCount: (n) => `${n} date${n > 1 ? "s" : ""}`,
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

  const L = () => STR[settings.lang] || STR.ko;

  // ---------- 유틸 ----------

  function durationToSeconds(str) {
    const m = String(str).match(/^(\d+):(\d{1,2}):(\d{1,2})(?:\.\d+)?$/);
    if (!m) return 0;
    return (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
  }

  function fmt(seconds) {
    const h = Math.floor(seconds / 3600);
    const min = Math.round((seconds % 3600) / 60);
    return L().dur(h, min);
  }

  function fmtShort(seconds) {
    const h = Math.floor(seconds / 3600);
    const min = Math.round((seconds % 3600) / 60);
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
    if (Number.isFinite(t) && t > 0) s.targetHours = t;
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
      console.info(`[42 Logtime Tracker] 데이터 수신 (${sourceLabel}, ${size}일)`);
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
      `[42 Logtime Tracker] 설정 적용: ${settings.piscineStart} ~ ${settings.piscineEnd}, ${settings.targetHours}h`
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
        <span class="lt42-title">⏱ Logtime</span>
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
          <label><span class="lt42-lbl-goal"></span> <input type="number" class="lt42-target" min="1"></label>
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
    for (const sel of [".lt42-start", ".lt42-end", ".lt42-target"]) {
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
    panel.querySelector(".lt42-target").value = settings.targetHours;
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
    if (!statsByDate) {
      content.innerHTML = `<div class="lt42-sub lt42-waiting">${l.waiting}</div>`;
      return;
    }

    const { piscineStart: start, piscineEnd: end, targetHours } = settings;
    const targetSec = targetHours * 3600;

    const doneSec = rangeTotal(start, end);
    const remainSec = Math.max(0, targetSec - doneSec);
    const pct = Math.min(100, targetSec > 0 ? (doneSec / targetSec) * 100 : 0);

    const today = todayISO();

    // 기간 요약 (시작일을 바꾸면 전체·경과가 바로 변함)
    //  전체 = 시작~종료, 남은 = max(오늘,시작)~종료 (오늘 포함), 경과 = 전체 - 남은
    const totalDays = daysBetweenInclusive(start, end);
    const daysLeft =
      today > end ? 0 : daysBetweenInclusive(today > start ? today : start, end);
    const elapsedDays = totalDays - daysLeft;
    const periodLine = l.period(elapsedDays, totalDays);

    // 남은 날짜 / 하루 평균: 제외 요일·날짜를 뺀 "실제 갈 수 있는 날" 기준
    let leftLine = "";
    let avgLine = "";
    if (remainSec > 0 && daysLeft > 0) {
      const from = today > start ? today : start;
      const effDaysLeft = countDaysExcluding(
        from,
        end,
        settings.excludeDays,
        settings.excludeDates
      );
      if (effDaysLeft > 0) {
        leftLine = l.leftLine(effDaysLeft);
        avgLine = l.avgLine(fmt(Math.ceil(remainSec / effDaysLeft)));
      }
    }

    const todaySec = statsByDate[today] || 0;
    const months = piscineMonthlyTotals(start, end);

    if (currentLogin) {
      panel.querySelector(".lt42-title").textContent = `⏱ Logtime | ${currentLogin}`;
    }
    // 접었을 때 헤더에 보이는 요약: 누적 / 목표
    const summary = panel.querySelector(".lt42-summary");
    summary.textContent = `${fmtShort(doneSec)} / ${targetHours}h`;
    summary.classList.toggle("lt42-summary-done", remainSec === 0);

    content.innerHTML = `
      <div class="lt42-piscine">
        <div class="lt42-row">
          <span class="lt42-label">${l.piscine} ${mmdd(start)} ~ ${mmdd(end)}</span>
          <span class="lt42-value">${fmt(doneSec)} / ${targetHours}h</span>
        </div>
        <div class="lt42-bar">
          <div class="lt42-bar-fill${remainSec === 0 ? " lt42-done" : ""}"
               style="width:${pct.toFixed(1)}%"></div>
        </div>
        <div class="lt42-row lt42-sub">
          ${
            remainSec === 0
              ? `<span class="lt42-ok">${l.reached(targetHours, fmt(doneSec - targetSec))}</span>`
              : `<span class="lt42-warn">${l.short(fmt(remainSec))}</span>`
          }
        </div>
        <div class="lt42-sub">${periodLine}${leftLine ? ` (${leftLine})` : ""}</div>
        ${avgLine ? `<div class="lt42-sub"><span class="lt42-avg">${avgLine}</span></div>` : ""}
        <div class="lt42-sub">${l.today}: ${fmt(todaySec)}</div>
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
    ensurePanel();
    render();

    let lastPath = location.pathname;
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        tryV2Fallback();
      }
    }, 1500);
  }

  main();
})();

// interceptor.js - 페이지 컨텍스트(MAIN world)에서 실행.
// v3 인트라가 캘린더를 그리기 위해 불러오는 로그타임 데이터를
// 엔드포인트 이름과 무관하게 "데이터 모양"으로 감지해서 content script로 전달한다.
//
// 감지하는 모양:
//  A) { "2026-07-01": "05:32:10", ... }              (v2 locations_stats 스타일)
//  B) [ { begin_at, end_at, ... }, ... ]             (42 API locations 스타일)
//  C) 위 모양이 객체 안에 중첩된 경우 (예: { data: {...} })

(() => {
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const DUR_RE = /^\d+:\d{1,2}:\d{1,2}(\.\d+)?$/;

  function looksLikeStatsMap(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
    const keys = Object.keys(obj);
    if (keys.length === 0) return false;
    let hits = 0;
    for (const k of keys.slice(0, 20)) {
      if (DATE_RE.test(k) && DUR_RE.test(String(obj[k]))) hits++;
    }
    return hits >= Math.min(3, keys.length);
  }

  function looksLikeLocationsArray(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const sample = arr.slice(0, 5);
    return sample.every(
      (x) => x && typeof x === "object" && "begin_at" in x && "end_at" in x
    );
  }

  // 중첩 탐색 (2단계까지)
  function findLogtimeData(json) {
    if (looksLikeStatsMap(json)) return { kind: "stats_map", data: json };
    if (looksLikeLocationsArray(json))
      return { kind: "locations", data: json };
    if (json && typeof json === "object") {
      for (const v of Object.values(json)) {
        if (looksLikeStatsMap(v)) return { kind: "stats_map", data: v };
        if (looksLikeLocationsArray(v)) return { kind: "locations", data: v };
      }
    }
    return null;
  }

  function report(url, found) {
    try {
      window.postMessage(
        {
          source: "lt42-interceptor",
          url,
          kind: found.kind,
          data: found.data,
        },
        window.location.origin
      );
    } catch (_) {}
  }

  function inspect(url, text) {
    if (!text || text.length > 5_000_000) return;
    const t = text.trim();
    if (!t.startsWith("{") && !t.startsWith("[")) return;
    try {
      const json = JSON.parse(t);
      const found = findLogtimeData(json);
      if (found) report(url, found);
    } catch (_) {}
  }

  // --- fetch 후킹 ---
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url =
        typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      const clone = res.clone();
      clone.text().then((text) => inspect(url, text)).catch(() => {});
    } catch (_) {}
    return res;
  };

  // --- XHR 후킹 ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__lt42_url = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        if (typeof this.responseText === "string") {
          inspect(this.__lt42_url || "", this.responseText);
        }
      } catch (_) {}
    });
    return origSend.apply(this, args);
  };
})();

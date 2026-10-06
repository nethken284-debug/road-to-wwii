/* =====================================================================
   核心：工具函數、儲存、記憶統計（間隔重複）、音效、彩紙、XP、選擇題
   ===================================================================== */
"use strict";

/* ---------- 小工具 ---------- */
const $ = (s, el = document) => el.querySelector(s);
// h()：建立 DOM 元素。attrs 支援 class / text / html / on事件 / style 物件
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}
// 中文輔助文字（可用「中」掣隱藏）
const zh = (t, block) => t ? h("span", { class: "zh" + (block ? " zhb" : "") }, t) : null;
// 英文段落＋中文輔助
const P = (en, z, cls) => h("p", { class: cls || null }, en, z ? [" ", zh(z, true)] : null);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const yearOf = d => Math.floor(d + 1e-9);
// append 時自動略過 null / false（方便寫「條件 ? 元素 : null」）
const _append = Element.prototype.append;
Element.prototype.append = function (...k) { return _append.apply(this, k.filter(x => x != null && x !== false)); };

/* ---------- 儲存（localStorage，失敗都唔影響使用）---------- */
const STORE_KEY = "road-to-wwii-v1";
const DEFAULT_STATE = { stats: {}, xp: 0, ch: {}, best: 0, zh: true, snd: true, onlyWrong: false, topic: "all", zone: "review", badges: {} };
let S = (() => {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { saved = null; }
  return Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), saved || {});
})();
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* 私密瀏覽等情況：只係唔儲存 */ } }

/* ---------- 題庫索引 ---------- */
const FACTS = DATA.filter(d => !d.type);
const CHAINS = DATA.filter(d => d.type === "chain");
const BY = Object.fromEntries(DATA.map(d => [d.id, d]));
const EVENTS = FACTS.filter(f => f.ev && f.d);
const PAIRS = [];
FACTS.forEach(f => (f.pr || []).forEach(p => PAIRS.push({ id: f.id, kind: p[0], l: p[1], r: p[2], g: p[3] || p[1], f })));
const CHAIN_ITEMS = [];
CHAINS.forEach(c => c.steps.forEach((s, i) => CHAIN_ITEMS.push({ id: c.id + ":" + i, t: c.t, chain: c, i })));
// 所有計入「掌握程度」的項目
const ALL_ITEMS = [...FACTS.map(f => ({ id: f.id, t: f.t })), ...CHAIN_ITEMS.map(c => ({ id: c.id, t: c.t }))];

/* ---------- 記憶統計：答錯多出、答對多次少出 ----------
   每題記錄 lv（0–5 級）：答對 +1，模糊最多 1 級，答錯回到 0。
   miss = 錯題標記；之後連續答對 2 次先會移除。 */
function record(id, res) { // res: "good" | "fuzzy" | "bad"
  const x = S.stats[id] || (S.stats[id] = { s: 0, c: 0, w: 0, lv: 0, last: 0 });
  x.s++; x.last = Date.now();
  if (res === "good") {
    x.c++; x.lv = Math.min(5, x.lv + 1);
    if (x.miss) { x.fix = (x.fix || 0) + 1; if (x.fix >= 2) { x.miss = false; x.fix = 0; } }
  } else {
    if (res === "bad") { x.w++; x.lv = 0; } else { x.lv = Math.min(x.lv, 1); }
    x.miss = true; x.fix = 0;
  }
  save();
}
const isMiss = id => !!(S.stats[id] && S.stats[id].miss);
function status(id) {
  const x = S.stats[id];
  if (!x || !x.s) return "new";
  if (x.miss) return "weak";
  return x.lv >= 3 ? "mastered" : "learning";
}
// 抽題權重：未做過 5；等級越低越常出；錯題 ×2；啱啱做完嘅暫時少出
function weight(id) {
  const x = S.stats[id];
  if (!x || !x.s) return 5;
  let w = [7, 4.5, 2.5, 1.2, 0.6, 0.3][x.lv] || 0.3;
  if (x.miss) w *= 2;
  if (Date.now() - x.last < 90000) w *= 0.15;
  return w;
}
function wpick(list, idOf = x => x.id) {
  let tot = 0; const ws = list.map(x => { const w = weight(idOf(x)); tot += w; return w; });
  let r = Math.random() * tot;
  for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
// 按權重抽 n 個（不重複），ok() 用嚟檢查同已選嘅有冇衝突
function wsample(list, n, idOf = x => x.id, ok) {
  const pool = [...list], out = [];
  while (out.length < n && pool.length) {
    const c = wpick(pool, idOf);
    pool.splice(pool.indexOf(c), 1);
    if (!ok || ok(out, c)) out.push(c);
  }
  return out;
}
// 測驗區範圍：主題篩選＋只練錯題
function inScope(id, t) {
  if (S.topic !== "all" && t !== S.topic) return false;
  if (S.onlyWrong && !isMiss(id)) return false;
  return true;
}

/* ---------- 日期：判斷兩件事能否分先後 ----------
   只有年份的事件當作覆蓋全年；有月份就係該月；有 d2 就係一段時間 */
function span(e) {
  const y = yearOf(e.d), m = Math.round((e.d - y) * 100);
  const s = m ? e.d : y + 0.001;
  const end = e.d2 ? e.d2 : (m ? e.d : y + 0.12);
  return [s, end];
}
function orderable(a, b) { const A = span(a), B = span(b); return A[1] < B[0] || B[1] < A[0]; }

/* ---------- 音效（Web Audio，即時合成，唔使檔案）---------- */
let AC = null;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (AC.state === "suspended") AC.resume();
  return AC;
}
function tone(freq, at, dur, type = "sine", vol = 0.07) {
  const ac = audio(); if (!ac) return;
  const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  ok() { tone(660, 0, 0.1); tone(990, 0.08, 0.16); },
  bad() { tone(220, 0, 0.18, "triangle", 0.09); tone(160, 0.1, 0.22, "triangle", 0.07); },
  flip() { tone(430, 0, 0.06, "triangle", 0.05); },
  tick() { tone(1200, 0, 0.03, "square", 0.025); },
  thud() { tone(120, 0, 0.16, "sawtooth", 0.05); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22)); },
  crash() { [400, 330, 260, 190, 130].forEach((f, i) => tone(f, i * 0.07, 0.16, "sawtooth", 0.05)); }
};
function play(name) { if (S.snd) try { SFX[name](); } catch (e) { } }

/* ---------- 彩紙 ---------- */
const FX = { cv: null, ctx: null, parts: [], raf: 0 };
function confetti(n = 70) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!FX.cv) { FX.cv = $("#fx"); FX.ctx = FX.cv.getContext("2d"); }
  const W = FX.cv.width = innerWidth, H = FX.cv.height = innerHeight;
  const cs = getComputedStyle(document.documentElement);
  const cols = ["--signal", "--accent", "--brass", "--ok"].map(v => cs.getPropertyValue(v).trim());
  for (let i = 0; i < n; i++) FX.parts.push({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 11, vy: -Math.random() * 11 - 4, r: Math.random() * 6 + 4, c: cols[i % 4], a: Math.random() * 6, life: 0 });
  if (!FX.raf) loop();
  function loop() {
    FX.ctx.clearRect(0, 0, W, H);
    FX.parts = FX.parts.filter(p => p.life < 90);
    for (const p of FX.parts) {
      p.life++; p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.a += 0.2;
      FX.ctx.save(); FX.ctx.translate(p.x, p.y); FX.ctx.rotate(p.a); FX.ctx.fillStyle = p.c;
      FX.ctx.globalAlpha = Math.max(0, 1 - p.life / 90); FX.ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); FX.ctx.restore();
    }
    FX.raf = FX.parts.length ? requestAnimationFrame(loop) : (FX.ctx.clearRect(0, 0, W, H), 0);
  }
}

/* ---------- 提示訊息 ---------- */
let toastT = 0;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- XP 與等級 ---------- */
const RANKS = [[0, "Rookie", "新手"], [100, "Cadet", "見習生"], [250, "Researcher", "研究員"], [500, "Historian", "歷史學家"], [900, "Professor", "教授"], [1400, "Exam Ace", "考試王"]];
function rankOf(xp) { let i = 0; RANKS.forEach((r, k) => { if (xp >= r[0]) i = k; }); return i; }
function renderXP() {
  const i = rankOf(S.xp), cur = RANKS[i], nxt = RANKS[i + 1];
  $("#xpLv").textContent = i + 1;
  $("#xpRank").textContent = cur[1];
  $("#xpNum").textContent = S.xp + " XP";
  $("#xpBar").style.width = nxt ? Math.round((S.xp - cur[0]) / (nxt[0] - cur[0]) * 100) + "%" : "100%";
}
function addXP(n, from) {
  const before = rankOf(S.xp);
  S.xp += n; save(); renderXP();
  if (from && from.getBoundingClientRect) {
    const r = from.getBoundingClientRect();
    const f = h("div", { class: "xpfloat", style: { left: (r.left + r.width / 2 - 20) + "px", top: (r.top - 6) + "px" } }, "+" + n);
    document.body.append(f); setTimeout(() => f.remove(), 950);
  }
  const after = rankOf(S.xp);
  if (after > before) { play("win"); confetti(90); toast(`Rank up! ${RANKS[after][1]} ${RANKS[after][2]}`); }
}

/* ---------- 徽章 ---------- */
const BADGES = [
  { id: "first", n: "1", en: "First stamp", z: "完成第一站" },
  { id: "half", n: "5", en: "Halfway", z: "完成五站" },
  { id: "all", n: "★", en: "Route complete", z: "走完全程" },
  { id: "perfect", n: "3", en: "Perfect checkpoint", z: "小測三星" },
  { id: "ready", n: "A", en: "Exam ready", z: "最終任務 8 分或以上" },
  { id: "speed", n: "60", en: "Speed reader", z: "限時挑戰 15 分" },
  { id: "order", n: "↕", en: "Time keeper", z: "時間線全對" },
  { id: "matcher", n: "⇄", en: "Perfect match", z: "配對零失誤" }
];
function award(id) {
  if (S.badges[id]) return;
  S.badges[id] = Date.now(); save();
  const b = BADGES.find(x => x.id === id);
  if (b) { setTimeout(() => { toast(`Badge: ${b.en} ${b.z}`); play("win"); confetti(60); }, 500); }
}

/* ---------- 回饋框：答錯顯示答案＋中文＋聯繫 ---------- */
function feedback(ok, f, opts = {}) {
  const box = h("div", { class: "fb " + (ok ? "ok" : "bad") });
  box.append(h("div", { class: "h" }, ok ? (opts.okText || "Correct!") : (opts.badText || "Not quite."), " ", zh(ok ? "答對了" : "答錯了")));
  if (f) {
    if (!ok || opts.showAnswer) box.append(h("div", { style: { whiteSpace: "pre-line" } }, h("b", null, "Answer: "), f.a));
    if (f.zh) box.append(zh(f.zh, true));
    if (!ok && f.link) box.append(h("div", { class: "lnk" }, h("b", null, "Link it 記憶線索"), h("div", null, f.link)));
    if (f.warn) box.append(h("div", { class: "warn" }, f.warn));
  }
  return box;
}

/* ---------- 選擇題生成 ---------- */
// 由知識點產生選擇題：kind = mc（自帶選項）| when（幾時發生）| what（發生咩事）
function mcqFrom(f, kind) {
  if (!kind) {
    const ks = [];
    if (f.mc) ks.push("mc");
    if (f.ev) ks.push("when", "what");
    if (!ks.length) return null;
    kind = ks[Math.random() * ks.length | 0];
  }
  if (kind === "mc" && f.mc) return { id: f.id, q: f.mq || f.q, opts: shuffle(f.mc.map((t, i) => ({ t, ok: i === 0 }))), f };
  if (kind === "when" && f.ev) {
    const labels = [];
    for (const e of shuffle(EVENTS)) {
      if (e.when === f.when || !orderable(e, f) || labels.includes(e.when)) continue;
      labels.push(e.when); if (labels.length === 3) break;
    }
    return { id: f.id, q: "When did this happen?", sub: f.ev, opts: shuffle([{ t: f.when, ok: true }, ...labels.map(t => ({ t, ok: false }))]), f };
  }
  if (kind === "what" && f.ev) {
    const evs = [];
    for (const e of shuffle(EVENTS)) {
      if (e.id === f.id || e.ev === f.ev || !orderable(e, f) || evs.includes(e.ev)) continue;
      evs.push(e.ev); if (evs.length === 3) break;
    }
    return { id: f.id, q: `What happened in ${f.when}?`, opts: shuffle([{ t: f.ev, ok: true }, ...evs.map(t => ({ t, ok: false }))]), f };
  }
  return null;
}
// 由配對（名詞、因果）產生選擇題
function mcqFromPair(p) {
  const rs = [];
  for (const o of shuffle(PAIRS)) {
    if (o.kind !== p.kind || o.g === p.g || o.r === p.r || rs.includes(o.r)) continue;
    rs.push(o.r); if (rs.length === 3) break;
  }
  const q = p.kind === "term" ? "What does this mean?" : "What was the result?";
  return { id: p.id, q, sub: p.l, opts: shuffle([{ t: p.r, ok: true }, ...rs.map(t => ({ t, ok: false }))]), f: p.f };
}

/* ---------- 選擇題元件 ---------- */
// item: {id, q, sub, opts:[{t, ok}], f}；cb(ok, el)
function mcqWidget(item, cb, o = {}) {
  const wrap = h("div", { class: "stack" });
  wrap.append(h("div", { class: "pq", style: { fontWeight: 700, fontSize: "1.06rem" } }, item.q));
  if (item.sub) wrap.append(h("div", { class: "card", style: { padding: "10px 14px", boxShadow: "none", background: "var(--surface2)" } }, item.sub));
  const opts = h("div", { class: "opts", "data-active": "1" });
  let done = false;
  item.opts.forEach((op, i) => {
    const b = h("button", { class: "opt", type: "button" }, h("span", { class: "k" }, "ABCD"[i]), h("span", null, op.t));
    b.addEventListener("click", () => {
      if (done) return; done = true; opts.removeAttribute("data-active");
      [...opts.children].forEach((c, k) => { c.disabled = true; if (item.opts[k].ok) c.classList.add("right"); });
      if (!op.ok) b.classList.add("wrong");
      play(op.ok ? "ok" : "bad");
      if (o.record !== false && item.id) record(item.id, op.ok ? "good" : "bad");
      if (o.feedback !== false) wrap.append(feedback(op.ok, item.f));
      if (!op.ok) wrap.classList.add("shake");
      cb && cb(op.ok, b);
    });
    opts.append(b);
  });
  wrap.append(opts);
  return wrap;
}
// 鍵盤：1–4 / A–D 揀答案
document.addEventListener("keydown", e => {
  if (e.target.closest && e.target.closest("input,textarea")) return;
  const act = [...document.querySelectorAll('.opts[data-active="1"]')].pop();
  if (!act) return;
  const k = "1234".indexOf(e.key) >= 0 ? "1234".indexOf(e.key) : "abcd".indexOf(e.key.toLowerCase());
  if (k >= 0 && act.children[k]) { e.preventDefault(); act.children[k].click(); }
});

/* ---------- 路由：溫習 / 測驗 / 進度 ---------- */
const VIEW = () => $("#view");
function setZone(zone) {
  S.zone = zone; save();
  document.querySelectorAll(".zones button").forEach(b => b.setAttribute("aria-selected", b.dataset.zone === zone ? "true" : "false"));
  window.scrollTo({ top: 0 });
  if (zone === "review") renderReviewHome();
  else if (zone === "quiz") renderQuizHome();
  else renderProgress();
}
function clearView() { const v = VIEW(); v.innerHTML = ""; window.scrollTo({ top: 0 }); return v; }

/* ---------- 進度頁 ---------- */
function topicCounts(t) {
  const items = ALL_ITEMS.filter(x => !t || x.t === t);
  const c = { mastered: 0, learning: 0, weak: 0, new: 0, total: items.length };
  items.forEach(x => c[status(x.id)]++);
  return c;
}
function mbar(c) {
  const pc = k => (c[k] / c.total * 100) + "%";
  return h("div", { class: "mbar", role: "img", "aria-label": `${c.mastered} mastered, ${c.learning} learning, ${c.weak} to review` },
    h("i", { class: "m", style: { width: pc("mastered") } }), h("i", { class: "l", style: { width: pc("learning") } }), h("i", { class: "w", style: { width: pc("weak") } }));
}
function renderProgress() {
  const v = clearView();
  const all = topicCounts();
  const chDone = (typeof CHAPTERS !== "undefined") ? CHAPTERS.filter(c => S.ch[c.id] && S.ch[c.id].done).length : 0;
  v.append(h("div", { class: "stack lg" },
    h("div", { class: "card stack" },
      h("div", { class: "eyebrow" }, "Your progress 你的進度"),
      h("div", { class: "hero-stats", style: { color: "var(--ink)" } },
        h("div", null, h("b", null, Math.round(all.mastered / all.total * 100) + "%"), "mastered ", zh("已熟記")),
        h("div", null, h("b", null, all.weak), "to review ", zh("待加強")),
        h("div", null, h("b", null, `${chDone}/${CHAPTERS.length}`), "stops done ", zh("溫習站")),
        h("div", null, h("b", null, S.best), "60s best ", zh("限時最高"))),
      mbar(all),
      h("div", { class: "legend" }, h("span", { style: { "--c": "var(--ok)" } }, "Mastered 已熟記"), h("span", { style: { "--c": "var(--accent)" } }, "Learning 學習中"), h("span", { style: { "--c": "var(--signal)" } }, "To review 待加強"), h("span", { style: { "--c": "var(--line)" } }, "Not tried 未練習"))),
    h("div", { class: "card" },
      h("div", { class: "eyebrow", style: { marginBottom: "4px" } }, "By topic 各主題掌握程度"),
      Object.keys(TOPICS).map(t => {
        const c = topicCounts(t), pct = Math.round(c.mastered / c.total * 100);
        const label = pct >= 80 ? "Mastered 已熟記" : c.weak ? `To review 待加強 (${c.weak})` : c.new === c.total ? "Not started 未開始" : "Learning 學習中";
        return h("div", { class: "trow" }, h("div", null, h("b", null, TOPICS[t].en), " ", zh(TOPICS[t].zh), h("div", { class: "note" }, label)), h("div", { class: "pct" }, pct + "%"), mbar(c));
      })),
    renderMistakeList(),
    renderReset()));
}
function renderMistakeList() {
  const miss = FACTS.filter(f => isMiss(f.id));
  const box = h("div", { class: "card stack" }, h("div", { class: "row between" },
    h("div", null, h("div", { class: "eyebrow" }, "Mistake book 錯題本"), h("b", null, miss.length + " question(s)")),
    miss.length ? h("button", { class: "btn primary", type: "button", onclick: () => { S.onlyWrong = true; S.topic = "all"; save(); setZone("quiz"); openMode("flash"); } }, "Practise mistakes ", zh("只練錯題")) : null));
  if (!miss.length) box.append(P("No mistakes yet. Wrong answers from any mode will appear here.", "暫時沒有錯題；任何模式答錯的題目都會記錄在這裡。", "note"));
  else box.append(h("div", { class: "wlist" }, miss.map(f => h("div", { class: "witem" }, h("b", null, f.q), h("div", { style: { whiteSpace: "pre-line" } }, f.a), zh(f.zh, true)))));
  return box;
}
function renderReset() {
  const box = h("div", { class: "card stack" }, h("div", { class: "eyebrow" }, "Start over 重新開始"));
  const btn = h("button", { class: "btn", type: "button" }, "Reset all progress ", zh("清除所有紀錄"));
  btn.onclick = () => {
    btn.hidden = true;
    const bar = h("div", { class: "confirmbar" }, h("span", null, "Delete all XP, stars and mistakes on this device? ", zh("確定刪除？")),
      h("button", { class: "btn", type: "button", onclick: () => { bar.remove(); btn.hidden = false; } }, "Cancel"),
      h("button", { class: "btn primary", type: "button", onclick: () => { const keep = { zh: S.zh, snd: S.snd }; S = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), keep); save(); renderXP(); toast("Progress cleared 已清除"); setZone("progress"); } }, "Delete"));
    box.append(bar);
  };
  box.append(btn);
  return box;
}

/* ---------- 開機 ---------- */
function boot() {
  document.body.classList.toggle("no-zh", !S.zh);
  const zb = $("#zhBtn"), sb = $("#sndBtn");
  zb.setAttribute("aria-pressed", S.zh ? "true" : "false");
  sb.setAttribute("aria-pressed", S.snd ? "true" : "false");
  zb.onclick = () => { S.zh = !S.zh; save(); document.body.classList.toggle("no-zh", !S.zh); zb.setAttribute("aria-pressed", S.zh ? "true" : "false"); toast(S.zh ? "Chinese hints on 顯示中文提示" : "Chinese hints off（英文模式）"); };
  sb.onclick = () => { S.snd = !S.snd; save(); sb.setAttribute("aria-pressed", S.snd ? "true" : "false"); if (S.snd) play("ok"); };
  $("#brand").onclick = () => setZone("review");
  document.querySelectorAll(".zones button").forEach(b => b.onclick = () => setZone(b.dataset.zone));
  renderXP();
  setZone(S.zone === "quiz" || S.zone === "progress" ? S.zone : "review");
}

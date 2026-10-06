/* =====================================================================
   測驗區：閃卡、時間線排序、配對、因果鏈填空、60 秒限時挑戰
   所有模式共用「只練錯題」及主題篩選，並按記憶統計抽題
   ===================================================================== */

const MODES = [
  { id: "flash", n: "01", en: "Flashcards", z: "閃卡", d: "See the question, say the answer, flip, then rate yourself.", dz: "先回想答案，再翻卡自評" },
  { id: "time", n: "02", en: "Timeline", z: "時間線排序", d: "Drag the events into the order they happened.", dz: "把事件拖到正確的時間次序" },
  { id: "match", n: "03", en: "Match", z: "配對遊戲", d: "Who ↔ what, event ↔ year, cause → effect, term ↔ meaning.", dz: "人物、年份、因果、名詞配對" },
  { id: "chain", n: "04", en: "Cause & effect", z: "因果鏈填空", d: "One link of the chain is missing. Type it in.", dz: "因果鏈挖空一環，輸入答案" },
  { id: "timed", n: "05", en: "60-second challenge", z: "限時挑戰", d: "Answer as many as you can in 60 seconds.", dz: "60 秒內盡量答多題" }
];

/* ---------- 測驗區主頁 ---------- */
function renderQuizHome() {
  const v = clearView();
  const missN = FACTS.filter(f => isMiss(f.id)).length + CHAIN_ITEMS.filter(c => isMiss(c.id)).length;
  v.append(quizTools(() => renderQuizHome()),
    S.onlyWrong && !missN ? h("div", { class: "fb ok", style: { marginBottom: "12px" } }, h("div", { class: "h" }, "No mistakes to practise right now.", " ", zh("暫時沒有錯題，做得好！")), P("Turn off “Mistakes only” or answer more questions first.", "先關掉「只練錯題」或多做一些題目。", "note")) : null,
    h("div", { class: "modes" }, MODES.map(m => h("button", { class: "mode" + (m.id === "timed" ? " hot" : ""), type: "button", onclick: () => openMode(m.id) },
      h("div", { class: "mi" }, m.id === "timed" ? `Best: ${S.best}` : `Mode ${m.n}`),
      h("h3", null, m.en), zh(m.z, true), h("p", null, m.d, " ", zh(m.dz)))))
  );
}
// 頂部工具：只練錯題＋主題篩選
function quizTools(refresh) {
  const missN = FACTS.filter(f => isMiss(f.id)).length + CHAIN_ITEMS.filter(c => isMiss(c.id)).length;
  const sw = h("input", { type: "checkbox", id: "only-wrong", role: "switch" });
  sw.checked = !!S.onlyWrong;
  sw.onchange = () => { S.onlyWrong = sw.checked; save(); refresh(); };
  const chips = h("div", { class: "topicchips", role: "group", "aria-label": "Topic filter" },
    [["all", "All topics", "全部"], ...Object.keys(TOPICS).map(k => [k, TOPICS[k].en.replace(/^\d · /, ""), TOPICS[k].zh])].map(([k, en, z]) =>
      h("button", { type: "button", "aria-pressed": S.topic === k ? "true" : "false", onclick: () => { S.topic = k; save(); refresh(); } }, en, " ", zh(z))));
  return h("div", { class: "qtools" },
    h("label", { class: "switch", for: "only-wrong" }, sw, h("span", null, h("b", null, "Mistakes only"), " ", zh("只練錯題"), h("span", { class: "note" }, `  (${missN} saved)`))),
    chips);
}
function modeHead(m, extra) {
  return h("div", { class: "chap-head" },
    h("button", { class: "iconbtn", type: "button", "aria-label": "Back to the Quiz zone", onclick: () => renderQuizHome() }, "←"),
    h("div", { class: "t" }, h("div", { class: "eyebrow" }, "Quiz zone · " + m.z), h("h2", null, m.en)),
    extra || null);
}
function openMode(id) {
  const m = MODES.find(x => x.id === id);
  ({ flash: modeFlash, time: modeTimeline, match: modeMatch, chain: modeChain, timed: modeTimed })[id](m);
}
// 範圍內冇題時：自動放寬並提示
function scoped(list, idOf = x => x.id, tOf = x => x.t, min = 1) {
  const a = list.filter(x => inScope(idOf(x), tOf(x)));
  if (a.length >= min) return { list: a, note: null };
  const b = list.filter(x => S.topic === "all" || tOf(x) === S.topic);
  if (b.length >= min) return { list: b, note: "Not enough mistakes here yet – showing all questions in this topic. 錯題不足，暫時顯示此主題全部題目。" };
  return { list, note: "Showing questions from all topics. 顯示全部主題的題目。" };
}

/* =====================================================================
   1. 閃卡（自評：記得／模糊／忘了）
   ===================================================================== */
function modeFlash(m) {
  const v = clearView();
  const holder = h("div", { class: "stack lg" });
  v.append(modeHead(m), quizTools(() => modeFlash(m)), holder);
  const { list, note } = scoped(FACTS);
  const queue = [];   // 答錯／模糊的卡：幾張之後再出現
  const recent = [];
  let count = 0;
  const tally = { good: 0, fuzzy: 0, bad: 0 };
  const tallyEl = h("div", { class: "note mono" });
  const drawTally = () => tallyEl.textContent = `Cards ${count} · remembered ${tally.good} · fuzzy ${tally.fuzzy} · forgot ${tally.bad}`;
  function nextCard() {
    count++;
    let f = null;
    const dueI = queue.findIndex(x => x.due <= count);
    if (dueI >= 0) f = BY[queue.splice(dueI, 1)[0].id];
    if (!f) {
      const pool = list.filter(x => !recent.includes(x.id)) ;
      f = wpick(pool.length ? pool : list);
    }
    recent.push(f.id); if (recent.length > Math.min(4, list.length - 1)) recent.shift();
    show(f);
  }
  function show(f) {
    holder.innerHTML = "";
    drawTally();
    const card = h("button", { class: "flash", type: "button", "aria-label": "Flip card" },
      h("div", { class: "in" },
        h("div", { class: "face front" },
          h("div", { class: "meta" }, h("span", null, TOPICS[f.t].en), h("span", null, "p." + f.p)),
          h("div", { class: "qtxt" }, f.q),
          h("div", { class: "tapnote" }, "Say the answer out loud, then tap to flip (Space). ", zh("先講出答案，再點擊翻卡"))),
        h("div", { class: "face back" },
          h("div", { class: "meta" }, h("span", null, "Answer"), h("span", null, "p." + f.p)),
          h("div", { class: "atxt" }, f.a),
          zh(f.zh, true),
          f.warn ? h("div", { class: "warn" }, f.warn) : null,
          h("div", { class: "fb", style: { padding: "8px 0 0", animation: "none" } }, h("div", { class: "lnk" }, h("b", null, "Link it 記憶線索"), h("div", null, f.link))))));
    const rate = h("div", { class: "rate", hidden: true },
      h("button", { class: "btn g", type: "button", onclick: e => rateIt("good", e.currentTarget) }, "Remembered", zh("記得 (1)")),
      h("button", { class: "btn f", type: "button", onclick: e => rateIt("fuzzy", e.currentTarget) }, "Fuzzy", zh("模糊 (2)")),
      h("button", { class: "btn b", type: "button", onclick: e => rateIt("bad", e.currentTarget) }, "Forgot", zh("忘了 (3)")));
    const flip = () => { card.classList.toggle("open"); play("flip"); rate.hidden = false; };
    card.onclick = flip;
    function rateIt(r, btn) {
      record(f.id, r); tally[r]++;
      if (r === "good") { play("ok"); addXP(2, btn); }
      else { play(r === "bad" ? "bad" : "flip"); queue.push({ id: f.id, due: count + (r === "bad" ? 3 : 6) }); }
      nextCard();
    }
    holder.append(note ? h("div", { class: "note" }, note) : null, tallyEl, card, rate,
      h("div", { class: "note" }, "Forgot → the card comes back in 3 cards. Fuzzy → in 6. ", zh("忘了的卡 3 張後再出現；模糊的 6 張後再出現。")));
    holder._keys = e => {
      if (e.target.closest && e.target.closest("input")) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
      else if (!rate.hidden && "123".includes(e.key)) { e.preventDefault(); rate.children["123".indexOf(e.key)].click(); }
    };
  }
  const keyH = e => holder._keys && holder._keys(e);
  document.addEventListener("keydown", keyH);
  onLeave(() => document.removeEventListener("keydown", keyH));
  nextCard();
}

/* =====================================================================
   2. 時間線排序（拖曳或用 ▲▼）
   ===================================================================== */
function modeTimeline(m) {
  const v = clearView();
  const holder = h("div", { class: "stack lg" });
  v.append(modeHead(m), quizTools(() => modeTimeline(m)), holder);
  let setKey = modeTimeline._last || "mix";
  const picker = h("div", { class: "topicchips" });
  const sets = [["mix", "Random mix", "隨機混合"], ...TIMELINE_SETS.map(t => [t.key, t.en, t.zh]), ["chain", "Cause chain order", "因果鏈排序"]];
  sets.forEach(([k, en, z]) => picker.append(h("button", { type: "button", "aria-pressed": k === setKey ? "true" : "false", onclick: () => { modeTimeline._last = k; modeTimeline(m); } }, en, " ", zh(z))));
  const area = h("div", { class: "stack" });
  holder.append(h("div", { class: "eyebrow" }, "Choose a set 選擇題組"), picker, area);
  round();

  function round() {
    area.innerHTML = "";
    let items, title, isChain = false, note = null;
    if (setKey === "chain") {
      isChain = true;
      const sc = scoped(CHAINS.map(c => ({ c, id: c.id, t: c.t })), x => x.id, x => x.t);
      const pool = sc.list.filter(x => !S.onlyWrong || x.c.steps.some((_, i) => isMiss(x.c.id + ":" + i)));
      const pick = wpick(pool.length ? pool : sc.list, x => x.c.id + ":0").c;
      title = pick.title;
      items = pick.steps.map((st, i) => ({ id: pick.id + ":" + i, label: stripDates(st.s), z: st.z, key: i, when: "Step " + (i + 1) }));
    } else if (setKey === "mix") {
      const sc = scoped(EVENTS, x => x.id, x => x.t, 4);
      note = sc.note;
      const chosen = wsample(sc.list, 6, x => x.id, (out, c) => out.every(o => orderable(o, c)));
      items = chosen.sort((a, b) => a.d - b.d).map(f => ({ id: f.id, label: f.ev, z: f.zh, key: f.d, when: f.when, f }));
      title = "Random mix of events";
    } else {
      const set = TIMELINE_SETS.find(t => t.key === setKey);
      items = EVENTS.filter(f => (f.tl || []).includes(setKey)).sort((a, b) => a.d - b.d).map(f => ({ id: f.id, label: f.ev, z: f.zh, key: f.d, when: f.when, f }));
      title = set.en;
    }
    const correct = items.map(x => x.id);
    let shuffled = shuffle(items);
    let guard = 0;
    while (shuffled.map(x => x.id).join() === correct.join() && guard++ < 10) shuffled = shuffle(items);
    const ul = h("ul", { class: "sortlist", "aria-label": "Events to put in order" });
    shuffled.forEach(it => ul.append(sortItem(it)));
    makeSortable(ul);
    const check = h("button", { class: "btn primary big", type: "button" }, "Check order ", zh("核對"));
    const res = h("div", { class: "stack" });
    check.onclick = () => {
      check.remove();
      const now = [...ul.children];
      let right = 0;
      now.forEach((li, i) => {
        const ok = li._it.id === correct[i];
        li.classList.add(ok ? "right" : "wrong");
        li.querySelector(".arr").remove();
        li.querySelector(".grip").style.visibility = "hidden";
        li.querySelector(".txt").prepend(h("span", { class: "when" }, li._it.when));
        li.querySelector(".txt").append(zh(li._it.z, true));
        if (ok) right++;
        record(li._it.id, ok ? "good" : "bad");
      });
      ul._locked = true;
      const all = right === items.length;
      play(all ? "win" : right >= items.length / 2 ? "ok" : "bad");
      addXP(right * 3, check);
      if (all) { confetti(90); award("order"); }
      res.append(h("div", { class: "fb " + (all ? "ok" : "bad") }, h("div", { class: "h" }, all ? "Perfect order!" : `${right} of ${items.length} in the right place.`, " ", zh(all ? "全部正確！" : "看看正確次序：")),
        all ? null : h("ol", { style: { margin: 0, paddingLeft: "20px" } }, items.map(it => h("li", null, h("b", null, it.when + ": "), it.label, it.f && !now.find((li, i) => li._it === it && correct[i] === it.id) ? h("div", { class: "note" }, "Link: " + it.f.link) : null)))),
        h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: round }, "New round →")));
    };
    area.append(h("div", { class: "row between" }, h("div", null, h("b", null, title), isChain ? null : h("div", { class: "note" }, "Earliest at the top. 最早的放最上面。")), h("span", { class: "tag" }, items.length + " cards")),
      note ? h("div", { class: "note" }, note) : null,
      h("div", { class: "axislabel" }, "▲ ", isChain ? "First (cause)" : "Earliest", " ", zh(isChain ? "最先（原因）" : "最早")), ul, h("div", { class: "axislabel" }, "▼ ", isChain ? "Last (result)" : "Latest", " ", zh(isChain ? "最後（結果）" : "最遲")),
      check, res);
  }
  function sortItem(it) {
    const li = h("li", { class: "sitem" },
      h("span", { class: "grip", "aria-hidden": "true" }),
      h("div", { class: "txt" }, it.label),
      h("div", { class: "arr" },
        h("button", { type: "button", "aria-label": "Move up", onclick: () => { if (li.previousElementSibling && !li.parentNode._locked) { li.parentNode.insertBefore(li, li.previousElementSibling); play("tick"); } } }, "▲"),
        h("button", { type: "button", "aria-label": "Move down", onclick: () => { if (li.nextElementSibling && !li.parentNode._locked) { li.parentNode.insertBefore(li.nextElementSibling, li); play("tick"); } } }, "▼")));
    li.querySelector(".grip").innerHTML = '<svg viewBox="0 0 10 16" width="12" height="18" aria-hidden="true"><g fill="currentColor"><circle cx="2" cy="2" r="1.6"/><circle cx="8" cy="2" r="1.6"/><circle cx="2" cy="8" r="1.6"/><circle cx="8" cy="8" r="1.6"/><circle cx="2" cy="14" r="1.6"/><circle cx="8" cy="14" r="1.6"/></g></svg>';
    li._it = it;
    return li;
  }
}
// 拖曳排序（滑鼠／觸控都用 Pointer Events）
function makeSortable(ul) {
  ul.addEventListener("pointerdown", e => {
    if (ul._locked) return;
    const li = e.target.closest(".sitem"); if (!li) return;
    const onGrip = e.target.closest(".grip");
    if (!onGrip && (e.pointerType !== "mouse" || e.target.closest("button"))) return;
    e.preventDefault();
    const r = li.getBoundingClientRect();
    const ghost = li.cloneNode(true);
    ghost.classList.add("ghost");
    Object.assign(ghost.style, { width: r.width + "px", left: r.left + "px", top: r.top + "px" });
    document.body.append(ghost);
    const offY = e.clientY - r.top;
    li.classList.add("drag");
    const pid = e.pointerId;
    let scrollDir = 0;
    const scroller = setInterval(() => { if (scrollDir) window.scrollBy(0, scrollDir * 10); }, 16);
    const move = ev => {
      if (ev.pointerId !== pid) return;
      ghost.style.top = (ev.clientY - offY) + "px";
      let before = null;
      for (const it of ul.children) {
        if (it === li) continue;
        const rr = it.getBoundingClientRect();
        if (ev.clientY < rr.top + rr.height / 2) { before = it; break; }
      }
      if (before) { if (li.nextElementSibling !== before) ul.insertBefore(li, before); }
      else if (ul.lastElementChild !== li) ul.append(li);
      scrollDir = ev.clientY < 80 ? -1 : ev.clientY > innerHeight - 80 ? 1 : 0;
    };
    // 用 window 監聽：卡片喺 DOM 移動時 pointer capture 會失效
    const up = ev => {
      if (ev.pointerId !== pid) return;
      clearInterval(scroller);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      ghost.remove(); li.classList.remove("drag"); play("tick");
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
}

// 因果鏈排序用：拿走句子入面的年份（否則一眼就知次序）
function stripDates(t) {
  const M = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";
  let x = t.replace(/\s*\(\d{4}\)/g, "")
    .replace(new RegExp("(?:Late |Early )?(?:" + M + " )?\\d{4}\\s*:\\s*", "g"), "")
    .replace(/\b\d{4}\s+(?=[a-z])/g, "")
    .replace(/\s{2,}/g, " ").trim();
  return x.charAt(0).toUpperCase() + x.slice(1);
}

/* =====================================================================
   3. 配對遊戲
   ===================================================================== */
const MATCH_KINDS = [["mixed", "Mixed", "混合"], ["who", "Who ↔ what", "人物/國家 ↔ 主張"], ["year", "Event ↔ year", "事件 ↔ 年份"], ["cause", "Cause → effect", "原因 → 結果"], ["term", "Term ↔ meaning", "名詞 ↔ 意思"]];
function modeMatch(m) {
  const v = clearView();
  const holder = h("div", { class: "stack lg" });
  v.append(modeHead(m), quizTools(() => modeMatch(m)), holder);
  let kind = modeMatch._last || "mixed";
  const picker = h("div", { class: "topicchips" }, MATCH_KINDS.map(([k, en, z]) => h("button", { type: "button", "aria-pressed": k === kind ? "true" : "false", onclick: () => { modeMatch._last = k; modeMatch(m); } }, en, " ", zh(z))));
  const area = h("div", { class: "stack" });
  holder.append(picker, area);
  round();
  function buildPairs(k) {
    if (k === "year") {
      const sc = scoped(EVENTS, x => x.id, x => x.t, 4);
      const chosen = wsample(sc.list, 5, x => x.id, (out, c) => out.every(o => orderable(o, c) && o.when !== c.when));
      return { note: sc.note, pairs: chosen.map(f => ({ l: f.ev, r: f.when, id: f.id, f, yr: true })) };
    }
    const sc = scoped(PAIRS.filter(p => p.kind === k), p => p.id, p => p.f.t, 3);
    const chosen = wsample(sc.list, 5, p => p.id, (out, c) => out.every(o => o.g !== c.g && o.r !== c.r && o.l !== c.l && o.id !== c.id));
    return { note: sc.note, pairs: chosen.map(p => ({ l: p.l, r: p.r, id: p.id, f: p.f })) };
  }
  function round() {
    area.innerHTML = "";
    const k = kind === "mixed" ? ["who", "year", "cause", "term"][Math.random() * 4 | 0] : kind;
    const { pairs, note } = buildPairs(k);
    const label = MATCH_KINDS.find(x => x[0] === k);
    const t0 = Date.now();
    let mistakes = 0, left = pairs.length, selL = null, selR = null;
    const missed = new Set();
    const L = h("div", { class: "col" }), R = h("div", { class: "col" }), msg = h("div");
    const mk = (p, side) => {
      const b = h("button", { class: "mitem", type: "button", "data-k": pairs.indexOf(p) }, side === "r" && p.yr ? h("span", { class: "yr" }, p.r) : side === "l" ? p.l : p.r);
      b._p = p; b._s = side; b.onclick = () => pick(b); return b;
    };
    shuffle(pairs).forEach(p => L.append(mk(p, "l")));
    shuffle(pairs).forEach(p => R.append(mk(p, "r")));
    function pick(b) {
      if (b.classList.contains("done")) return;
      play("flip");
      if (b._s === "l") { if (selL) selL.classList.remove("sel"); selL = b; } else { if (selR) selR.classList.remove("sel"); selR = b; }
      b.classList.add("sel");
      if (!(selL && selR)) return;
      const a = selL, c = selR; selL = selR = null;
      a.classList.remove("sel"); c.classList.remove("sel");
      msg.innerHTML = "";
      if (a._p === c._p) {
        a.classList.add("done", "pop"); c.classList.add("done", "pop"); play("ok"); left--;
        record(a._p.id, missed.has(a._p) ? "bad" : "good");
        if (!missed.has(a._p)) addXP(2, c);
        if (!left) finish();
      } else {
        play("bad"); mistakes++;
        [a, c].forEach(x => { x.classList.remove("shake"); void x.offsetWidth; x.classList.add("shake"); });
        missed.add(a._p);
        const partner = [...R.children].find(x => x._p === a._p);
        if (partner) { partner.classList.add("flash"); setTimeout(() => partner.classList.remove("flash"), 1300); }
        msg.append(feedback(false, { a: `${a._p.l}  →  ${a._p.r}`, zh: a._p.f.zh, link: a._p.f.link, warn: a._p.f.warn }, { badText: "Not a pair." }));
      }
    }
    function finish() {
      const secs = Math.round((Date.now() - t0) / 1000);
      if (!mistakes) { award("matcher"); confetti(70); play("win"); }
      msg.innerHTML = "";
      msg.append(h("div", { class: "fb ok" }, h("div", { class: "h" }, mistakes ? `Done in ${secs}s with ${mistakes} mistake(s).` : `Perfect round in ${secs}s!`, " ", zh(mistakes ? "完成！錯的已加入錯題本。" : "零失誤！"))),
        h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: round }, "Next round →")));
    }
    area.append(h("div", { class: "row between" }, h("b", null, label[1], " ", zh(label[2])), h("span", { class: "tag" }, pairs.length + " pairs")),
      note ? h("div", { class: "note" }, note) : null,
      h("div", { class: "note" }, "Tap one on the left, then its partner on the right. ", zh("左邊點一個，再點右邊的配對。")),
      h("div", { class: "match" }, L, R), msg);
  }
}

/* =====================================================================
   4. 因果鏈填空
   ===================================================================== */
const norm = t => (t || "").toLowerCase().replace(/[ü]/g, "u").replace(/[’'“”"().,;:!?–—-]/g, " ").replace(/\s+/g, " ").trim();
// 每個 k 都要命中其中一個可接受字
function checkKeys(input, keys) { const t = " " + norm(input) + " "; return keys.every(k => k.split("|").some(w => t.includes(norm(w)))); }
function modeChain(m) {
  const v = clearView();
  const holder = h("div", { class: "stack lg" });
  v.append(modeHead(m), quizTools(() => modeChain(m)), holder);
  const sc = scoped(CHAIN_ITEMS, x => x.id, x => x.t);
  let lastChain = null;
  round();
  function round() {
    holder.innerHTML = "";
    // 先揀因果鏈（按最弱一環的權重），再揀挖空嗰一環
    const chainIds = [...new Set(sc.list.map(x => x.chain.id))];
    let pool = chainIds.filter(id => id !== lastChain);
    if (!pool.length) pool = chainIds;
    const cid = wpick(pool.map(id => ({ id })), x => {
      const c = BY[x.id]; let best = c.id + ":0", bw = -1;
      c.steps.forEach((_, i) => { const w = weight(c.id + ":" + i); if (w > bw) { bw = w; best = c.id + ":" + i; } });
      return best;
    }).id;
    lastChain = cid;
    const chain = BY[cid];
    const blanks = sc.list.filter(x => x.chain.id === cid);
    const blank = wpick(blanks);
    const i0 = blank.i, step = chain.steps[i0];
    const box = h("div", { class: "chain" });
    const input = h("input", { type: "text", id: "chain-answer", autocomplete: "off", autocapitalize: "off", spellcheck: "false", placeholder: "Type the missing link…", "aria-label": "Missing link" });
    const blankEl = h("div", { class: "link blank" }, h("div", { class: "eyebrow" }, "Missing link 缺少的一環"), input);
    chain.steps.forEach((st, i) => {
      if (i) box.append(h("div", { class: "arrow", "aria-hidden": "true" }));
      box.append(i === i0 ? blankEl : h("div", { class: "link" }, st.s, zh(st.z, true)));
    });
    const out = h("div", { class: "stack" });
    const bCheck = h("button", { class: "btn primary", type: "button" }, "Check ", zh("核對"));
    const bHint = h("button", { class: "btn", type: "button" }, "Hint ", zh("提示"));
    const bShow = h("button", { class: "btn ghost", type: "button" }, "Show answer ", zh("看答案"));
    const ctl = h("div", { class: "row" }, bCheck, bHint, bShow);
    let hinted = false, finished = false;
    bHint.onclick = () => {
      if (hinted) return; hinted = true;
      out.prepend(h("div", { class: "note" }, "Hint (Chinese): ", h("span", { style: { fontFamily: "var(--f-zh)" } }, step.z), " · starts with “", step.s.split(" ")[0].replace(/[:,]/g, ""), "”"));
    };
    const reveal = (cls) => {
      blankEl.classList.add(cls);
      blankEl.innerHTML = "";
      blankEl.append(h("div", { class: "eyebrow" }, "Missing link 缺少的一環"), h("div", null, h("b", null, step.s)), zh(step.z, true));
    };
    const nextBtn = () => h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: round }, "Next chain →"));
    bCheck.onclick = () => {
      if (finished) return;
      const val = input.value.trim();
      if (!val) { input.focus(); toast("Type your answer first 先輸入答案"); return; }
      finished = true; ctl.remove();
      if (checkKeys(val, step.k)) {
        reveal("ok"); play("ok"); record(blank.id, hinted ? "fuzzy" : "good"); if (!hinted) addXP(4, blankEl);
        out.append(h("div", { class: "fb ok" }, h("div", { class: "h" }, "Correct! ", zh("答對了")), h("div", { class: "note" }, "You wrote: " + val)), nextBtn());
      } else {
        reveal("bad"); play("bad");
        let decided = false;
        const decide = r => { if (decided) return; decided = true; record(blank.id, r); };
        out.append(h("div", { class: "fb bad" }, h("div", { class: "h" }, "Compare with the answer above. ", zh("對照上面的答案")), h("div", { class: "note" }, "You wrote: " + val),
          h("div", { class: "lnk" }, h("b", null, "Link it 記憶線索"), h("div", null, `This is step ${i0 + 1} of “${chain.title}” (p.${chain.p}).`))),
          h("div", { class: "row" },
            h("button", { class: "btn", type: "button", onclick: e => { decide("good"); play("ok"); e.currentTarget.parentNode.remove(); out.append(nextBtn()); } }, "I was right ", zh("其實我答對")),
            h("button", { class: "btn primary", type: "button", onclick: () => { decide("bad"); round(); } }, "Next chain →")));
      }
    };
    bShow.onclick = () => {
      if (finished) return; finished = true; ctl.remove(); reveal("bad");
      out.append(h("div", { class: "note" }, "How well did you know it? ", zh("你記得多少？")),
        h("div", { class: "rate" },
          h("button", { class: "btn g", type: "button", onclick: () => { record(blank.id, "good"); round(); } }, "Knew it", zh("記得")),
          h("button", { class: "btn f", type: "button", onclick: () => { record(blank.id, "fuzzy"); round(); } }, "Fuzzy", zh("模糊")),
          h("button", { class: "btn b", type: "button", onclick: () => { record(blank.id, "bad"); round(); } }, "Forgot", zh("忘了"))));
    };
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); bCheck.click(); } });
    holder.append(sc.note ? h("div", { class: "note" }, sc.note) : null,
      h("div", null, h("div", { class: "eyebrow" }, `${TOPICS[chain.t].en} · p.${chain.p}`), h("h3", { class: "st h-display", style: { fontSize: "1.7rem" } }, chain.title), zh(chain.zh, true)),
      box, ctl, out);
  }
}

/* =====================================================================
   5. 60 秒限時挑戰
   ===================================================================== */
function timedPool() {
  const q = [];
  FACTS.forEach(f => {
    if (!inScope(f.id, f.t)) return;
    if (f.mc) q.push({ id: f.id, make: () => mcqFrom(f, "mc") });
    if (f.ev) { q.push({ id: f.id, make: () => mcqFrom(f, "when") }); q.push({ id: f.id, make: () => mcqFrom(f, "what") }); }
  });
  PAIRS.filter(p => p.kind === "term" || p.kind === "cause").forEach(p => { if (inScope(p.id, p.f.t)) q.push({ id: p.id, make: () => mcqFromPair(p) }); });
  return q;
}
function modeTimed(m) {
  const v = clearView();
  const holder = h("div", { class: "stack lg" });
  v.append(modeHead(m), quizTools(() => modeTimed(m)), holder);
  let pool = timedPool(), note = null;
  if (pool.length < 6) { const keep = S.onlyWrong; S.onlyWrong = false; pool = timedPool(); S.onlyWrong = keep; note = "Not enough mistakes yet – using all questions in this topic. 錯題不足，改用此主題全部題目。"; }
  if (pool.length < 6) { const t = S.topic; S.topic = "all"; pool = timedPool(); S.topic = t; note = "Using questions from all topics. 使用全部主題的題目。"; }
  holder.append(h("div", { class: "card stack", style: { textAlign: "center", alignItems: "center" } },
    h("div", { class: "eyebrow" }, "Best score 最高紀錄"),
    h("div", { class: "h-display", style: { fontSize: "4rem", color: "var(--signal)" } }, S.best),
    P("60 seconds. Tap the right answer as fast as you can. Wrong answers show the correct one and go to your Mistake book.", "60 秒內盡快選出正確答案；答錯會顯示正確答案並加入錯題本。"),
    note ? h("div", { class: "note" }, note) : null,
    h("button", { class: "btn primary big", type: "button", onclick: start }, "Start ", zh("開始"))));

  function start() {
    holder.innerHTML = "";
    const total = 60, C = 2 * Math.PI * 30;
    let left = total, score = 0, streak = 0, ended = false;
    const wrongs = [];
    const fg = s("circle", { class: "fg", cx: 36, cy: 36, r: 30, "stroke-dasharray": C, "stroke-dashoffset": 0 });
    const tnum = s("text", { x: 36, y: 44, "text-anchor": "middle", text: String(total) });
    const ring = s("svg", { class: "ring", viewBox: "0 0 72 72", "aria-hidden": "true" }, s("circle", { class: "bg", cx: 36, cy: 36, r: 30 }), fg, tnum);
    const scoreEl = h("div", { class: "score" }, "0");
    const comboEl = h("div", { class: "combo" });
    const qbox = h("div", { class: "stack" });
    holder.append(h("div", { class: "timer card", style: { padding: "12px 16px" } }, ring, h("div", { style: { flex: 1 } }, h("div", { class: "eyebrow" }, "Score 分數"), scoreEl), comboEl), qbox);
    const timer = setInterval(() => {
      left--; tnum.textContent = String(left);
      fg.setAttribute("stroke-dashoffset", String(C * (1 - left / total)));
      if (left <= 5 && left > 0) play("tick");
      if (left <= 0) end();
    }, 1000);
    onLeave(() => clearInterval(timer));
    const recent = [];
    function ask() {
      if (ended) return;
      const cand = pool.filter(x => !recent.includes(x.id));
      const pick = wpick(cand.length ? cand : pool);
      recent.push(pick.id); if (recent.length > Math.min(8, pool.length - 1)) recent.shift();
      const item = pick.make();
      if (!item || item.opts.length < 2) return ask();
      qbox.innerHTML = "";
      qbox.append(mcqWidget(item, ok => {
        if (ended) return;
        if (ok) { score++; streak++; scoreEl.textContent = score; scoreEl.classList.remove("pop"); void scoreEl.offsetWidth; scoreEl.classList.add("pop"); }
        else { streak = 0; wrongs.push(item); }
        comboEl.textContent = streak >= 3 ? `Streak ×${streak}` : "";
        setTimeout(ask, ok ? 380 : 1100);
      }, { feedback: false }));
    }
    function end() {
      if (ended) return; ended = true; clearInterval(timer);
      const isBest = score > S.best;
      if (isBest) { S.best = score; save(); }
      addXP(score * 2);
      if (score >= 15) award("speed");
      play(isBest ? "win" : "ok"); if (isBest && score) confetti(100);
      holder.innerHTML = "";
      holder.append(h("div", { class: "card stack", style: { textAlign: "center", alignItems: "center" } },
        h("div", { class: "eyebrow" }, isBest ? "New best! 新紀錄！" : "Time's up! 時間到"),
        h("div", { class: "h-display", style: { fontSize: "4.4rem", color: "var(--signal)" } }, score),
        h("div", { class: "note" }, `Best: ${S.best}`),
        h("div", { class: "row", style: { justifyContent: "center" } },
          h("button", { class: "btn primary big", type: "button", onclick: start }, "Play again ", zh("再玩")),
          h("button", { class: "btn", type: "button", onclick: () => renderQuizHome() }, "Quiz zone"))));
      if (wrongs.length) {
        holder.append(h("div", { class: "card stack" }, h("div", { class: "eyebrow" }, `Review your ${wrongs.length} mistake(s) 檢討錯題`),
          wrongs.map(w => {
            const right = w.opts.find(o => o.ok).t;
            return h("div", { class: "witem stack", style: { gap: "4px" } }, h("b", null, w.q), w.sub ? h("div", { class: "note" }, w.sub) : null,
              h("div", null, "Answer: ", h("b", null, right)), zh(w.f && w.f.zh, true), w.f && w.f.link ? h("div", { class: "note" }, "Link: " + w.f.link) : null);
          })));
      }
    }
    ask();
  }
}

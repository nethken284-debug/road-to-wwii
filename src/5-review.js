/* =====================================================================
   溫習區：路線圖 → 每一站（章節）有幾頁互動頁面 → 站末小測
   內容只用講義第 1–6 頁
   ===================================================================== */

/* ---------- SVG 小工具 ---------- */
const SVGNS = "http://www.w3.org/2000/svg";
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs || {}) {
    const v = attrs[k]; if (v == null) continue;
    if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  kids.flat().forEach(c => c && el.append(c));
  return el;
}
// 離開頁面時要停止的計時器等
let CLEAN = [];
const onLeave = f => CLEAN.push(f);
const _clearView = clearView;
clearView = function () { CLEAN.forEach(f => { try { f(); } catch (e) { } }); CLEAN = []; return _clearView(); };

/* =====================================================================
   互動元件
   ===================================================================== */

// 翻牌：items [{front, fz, num, back(節點)}]；全部打開後 onAll()
function tiles(items, onAll) {
  const g = h("div", { class: "tiles" });
  let opened = 0;
  items.forEach(it => {
    const t = h("button", { class: "tile", type: "button" },
      h("div", { class: "in" },
        h("div", { class: "face front" }, it.num ? h("div", { class: "bignum" }, it.num) : null, h("b", null, it.front), zh(it.fz, true), h("span", { class: "tap" }, "Tap to open")),
        h("div", { class: "face back" }, it.back)));
    t.onclick = () => {
      t.classList.toggle("open"); play("flip");
      if (!t.dataset.seen) { t.dataset.seen = "1"; opened++; if (opened === items.length && onAll) setTimeout(onAll, 350); }
    };
    g.append(t);
  });
  return g;
}

// 小測（預測）：spec {q, opts, ans, id} 或 {fromId}（用該題自帶選項）
function predict(spec, onDone) {
  let item;
  if (spec.fromId) item = mcqFrom(BY[spec.fromId], spec.kind || "mc");
  else {
    const f = spec.id ? BY[spec.id] : { a: spec.opts[spec.ans || 0], zh: spec.zh, link: spec.link };
    item = { id: spec.id, q: spec.q, opts: shuffle(spec.opts.map((t, i) => ({ t, ok: i === (spec.ans || 0) }))), f };
  }
  const box = h("div", { class: "predict" }, h("div", { class: "ptag" }, spec.tag || "Quick check · 小測"));
  box.append(mcqWidget(item, (ok, b) => { if (ok) addXP(5, b); onDone && setTimeout(() => onDone(ok), 250); }, { record: !!item.id }));
  return box;
}

// 分類遊戲：先點卡，再點格
function sortGame(spec, onDone) {
  let sel = null, left = spec.items.length;
  const missed = new Set();
  const chips = h("div", { class: "chips" }), bins = h("div", { class: "bins" }), msg = h("div");
  const binEls = {};
  const arm = on => Object.values(binEls).forEach(b => b.classList.toggle("armed", on));
  spec.bins.forEach(b => {
    const el = h("button", { class: "bin", type: "button", "data-bin": b.id }, h("h4", null, b.t), zh(b.z, true));
    el.onclick = () => drop(b.id, el);
    binEls[b.id] = el; bins.append(el);
  });
  shuffle(spec.items).forEach(it => {
    const c = h("button", { class: "chipx", type: "button", "data-bin": it.bin }, it.t, it.z ? [" ", zh(it.z)] : null);
    c.onclick = () => {
      chips.querySelectorAll(".chipx").forEach(x => x.classList.remove("sel"));
      if (sel && sel.c === c) { sel = null; arm(false); return; }
      sel = { c, it }; c.classList.add("sel"); arm(true); play("flip");
    };
    chips.append(c);
  });
  function drop(binId, el) {
    if (!sel) { toast("Tap a card first 先點一張卡"); return; }
    const { c, it } = sel;
    msg.innerHTML = "";
    if (it.bin === binId) {
      play("ok"); el.append(h("div", { class: "placed pop" }, it.t));
      c.remove(); sel = null; arm(false); left--;
      if (it.id) record(it.id, missed.has(it) ? "bad" : "good");
      if (!left) { msg.append(feedback(true, null, { okText: spec.doneText || "All sorted!" })); onDone && onDone(missed.size === 0); }
    } else {
      play("bad"); el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
      missed.add(it);
      msg.append(h("div", { class: "fb bad" }, h("div", { class: "h" }, "Not that box – try another one. ", zh("放錯格，再試一次。"))));
    }
  }
  return h("div", { class: "stack" }, h("div", { class: "note" }, "Tap a card, then tap the box it belongs to. ", zh("先點卡片，再點正確的格子。")), chips, bins, msg);
}

// 小型配對：pairs [{l, r, id}]
function miniMatch(pairs, onDone) {
  const L = h("div", { class: "col" }), R = h("div", { class: "col" }), msg = h("div");
  let selL = null, selR = null, left = pairs.length;
  const bad = new Set();
  const mk = (p, side) => { const b = h("button", { class: "mitem", type: "button", "data-k": pairs.indexOf(p) }, side === "l" ? p.l : p.r); b._p = p; b._s = side; b.onclick = () => pick(b); return b; };
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
      a.classList.add("done"); c.classList.add("done"); play("ok"); left--;
      if (a._p.id) record(a._p.id, bad.has(a._p) ? "bad" : "good");
      if (!left) { msg.append(feedback(true, null, { okText: bad.size ? "All matched!" : "Perfect – no mistakes!" })); onDone && onDone(bad.size); }
    } else {
      play("bad");
      [a, c].forEach(x => { x.classList.remove("shake"); void x.offsetWidth; x.classList.add("shake"); });
      bad.add(a._p);
      const partner = [...R.children].find(x => x._p === a._p);
      if (partner) { partner.classList.add("flash"); setTimeout(() => partner.classList.remove("flash"), 1300); }
      const f = a._p.id ? BY[a._p.id] : null;
      msg.append(feedback(false, { a: a._p.l + "  →  " + a._p.r, zh: f && f.zh, link: f && f.link }));
    }
  }
  return h("div", { class: "stack" }, h("div", { class: "note" }, "Tap one on the left, then its partner on the right. ", zh("左邊點一個，再點右邊的配對。")), h("div", { class: "match" }, L, R), msg);
}

// 逐步揭示：steps [{render() → 節點, pred?}]；遇到 pred 會先小測再揭示
function revealSeq(steps, o = {}) {
  const list = h("div", { class: "moves" });
  const btn = h("button", { class: "btn primary pulse", type: "button" }, o.btn || "Next →");
  const ctl = h("div", { class: "row" }, btn);
  const wrap = h("div", { class: "stack" }, list, ctl);
  let i = 0, pbox = null;
  btn.onclick = () => {
    if (pbox) { pbox.remove(); pbox = null; }
    const st = steps[i]; if (!st) return;
    if (st.pred && !st._asked) {
      st._asked = true; btn.disabled = true;
      pbox = predict(st.pred, () => { btn.disabled = false; btn.textContent = "Reveal →"; });
      wrap.insertBefore(pbox, ctl);
      return;
    }
    const node = st.render ? st.render() : null;
    if (node) list.append(node);
    o.onStep && o.onStep(i, node);
    i++;
    btn.textContent = o.btn || "Next →";
    if (i >= steps.length) { btn.remove(); o.onDone && o.onDone(); }
    if (node) setTimeout(() => node.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
  };
  return wrap;
}
// 一張「事件卡」
const moveCard = (when, t, z, color, extra) => h("div", { class: "move" },
  h("div", { class: "when", style: { color: color || "var(--ink)" } }, when),
  h("div", { class: "stack", style: { gap: "4px" } }, h("div", null, t), zh(z, true), extra || null));

/* =====================================================================
   各頁面（scene）
   ===================================================================== */

/* ---- Stop 0 ---- */
function sceneIntro(el, done) {
  el.append(
    h("div", { class: "row", style: { alignItems: "flex-end", gap: "12px" } },
      h("div", { class: "h-display", style: { fontSize: "clamp(3rem,14vw,5.4rem)", color: "var(--signal)" } }, "1939–1945"),
      h("div", { class: "eyebrow", style: { paddingBottom: "10px" } }, "World War II")),
    P("World War II (1939–1945) was the deadliest conflict in human history.", "第二次世界大戰（1939–1945）是人類歷史上死傷最慘重的衝突。", "lead"),
    P("The world went to war again just 20 years after WWI. Why?", "第一次世界大戰後僅僅 20 年，世界再次開戰。為甚麼？"),
    predict({ q: "Was WWII caused by a single event?", opts: ["No – a combination of long-term problems and short-term triggers", "Yes – one single event"], ans: 0, id: "q3", tag: "Make a guess · 估一估" }, () => {
      el.append(P("To understand why, the notes look at four major factors. Open them on the next page.", "要理解原因，講義分析了四大因素——下一頁打開看看。", "note"));
      done();
    }));
}
function sceneFactors(el, done) {
  const F = [
    ["The Great Depression (1929)", "大蕭條（1929）", "A severe worldwide economic crisis."],
    ["The Rise of Totalitarianism", "極權主義興起", "Dictators took total control in Germany, Italy and Japan."],
    ["The Failure of Collective Security", "集體安全失敗", "The League of Nations failed to stop aggression."],
    ["The Policy of Appeasement", "綏靖政策", "Britain and France gave in to the invaders' demands."]];
  el.append(P("WWII was caused by four major factors. Tap each file to open it.", "二戰由四大因素造成。點擊每份檔案打開。", "note"),
    tiles(F.map((f, i) => ({ num: String(i + 1), front: "Factor " + (i + 1), fz: "因素 " + (i + 1), back: [h("b", null, f[0]), zh(f[1], true), h("p", { class: "note" }, f[2])] })), () => {
      el.append(P("Each factor is a stop on your route map. Next stop: the Great Depression.", "每個因素都是路線圖上的一站。下一站：大蕭條。", "note"));
      done();
    }));
}

/* ---- Stop 1 大蕭條 ---- */
function sceneBoom(el, done) {
  el.append(P("After WWI, the US became very rich in the 1920s. Open the three reasons.", "一戰後，美國在 1920 年代變得非常富有。打開三個原因。", "lead"),
    tiles([
      { front: "Producer & creditor", fz: "生產國與債權國", back: P("It was the largest producer and creditor in the world.", "全球最大的生產國及債權國。") },
      { front: "A major market", fz: "主要市場", back: P("Many countries depended on the US as a major market for their products.", "許多國家依賴美國作為產品的主要市場。") },
      { front: "Borrowing & lending", fz: "借貸", back: P("Money borrowing and lending became frequent.", "借錢和放債變得頻繁。") }
    ], () => el.append(predict({ fromId: "q7" }, () => done()))));
}
function sceneCrash(el, done) {
  const W = 400, H = 210;
  const pts = [[10, 64], [40, 58], [70, 62], [100, 56], [130, 60], [160, 54], [190, 58], [220, 52], [250, 56], [275, 52]];
  const lab = (x, y, t, anchor) => s("text", { x, y, "text-anchor": anchor || "start", text: t, style: "font:12px var(--f-mono);fill:var(--muted)" });
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Illustration: US stock prices rise in the 1920s, then crash in late October 1929" });
  for (let y = 40; y <= 200; y += 40) svg.append(s("line", { x1: 0, x2: W, y1: y, y2: y, style: "stroke:var(--line);stroke-width:1" }));
  const area = s("path", { style: "fill:var(--accent-soft)" });
  const line = s("polyline", { style: "fill:none;stroke:var(--accent);stroke-width:3.5;stroke-linejoin:round;stroke-linecap:round" });
  svg.append(area, line, lab(8, 20, "US stock prices 股價"), lab(255, H - 6, "Late Oct 1929"), lab(W - 8, 20, "illustration 示意圖", "end"));
  const redraw = () => {
    line.setAttribute("points", pts.map(p => p.join(",")).join(" "));
    const last = pts[pts.length - 1];
    area.setAttribute("d", `M${pts[0][0]},${H} L` + pts.map(p => p.join(",")).join(" L") + ` L${last[0]},${H} Z`);
  };
  redraw();
  const stampBox = h("div", { class: "stampbox" });
  const chart = h("div", { class: "crash" }, svg, stampBox);
  const investors = h("div", { class: "investors" });
  const after = h("div", { class: "stack" });
  const N = 6; let sold = 0;
  const rumour = h("button", { class: "btn primary pulse", type: "button" }, "Spread the rumour ", zh("散播謠言"));
  rumour.onclick = () => {
    rumour.remove(); play("bad");
    after.append(P("“The US will soon be in a recession!” Tap each panicking investor to sell.", "「美國快將陷入衰退！」點擊每個恐慌的投資者拋售股票。"));
    for (let i = 0; i < N; i++) {
      const b = h("button", { class: "inv panic", type: "button", "aria-label": "Sell shares" }, "SELL");
      b.onclick = () => {
        if (b.classList.contains("sold")) return;
        b.classList.add("sold"); b.textContent = "SOLD"; sold++;
        const last = pts[pts.length - 1]; pts.push([last[0] + 20, Math.min(H - 14, last[1] + 23)]);
        line.style.stroke = "var(--signal)"; area.style.fill = "var(--signal-soft)"; redraw(); play("thud");
        if (sold === N) crash();
      };
      investors.append(b);
    }
  };
  function crash() {
    play("crash");
    stampBox.append(h("span", { class: "stamp pop" }, "The Wall Street Crash"));
    after.append(P("Many people sold their shares and caused panic selling. The stock prices in the US fell sharply. The Wall Street Crash took place.", "大量拋售股票造成恐慌性拋售，美國股價急跌，爆發華爾街股災。", "lead"),
      predict({ fromId: "q6" }, () => done()));
  }
  el.append(P("In late October 1929, there were rumours that the US would soon be in a recession.", "1929 年 10 月底，傳出美國將陷入經濟衰退的謠言。", "lead"), chart, rumour, investors, after);
}
function sceneDomino(el, done) {
  const items = [
    { t: "The US economy entered a period of recession", z: "美國經濟進入衰退期" },
    { t: "Internal consumption dropped", z: "內部消費下跌" },
    { t: "Mass unemployment among workers resulted", z: "工人大量失業" },
    { t: "Many people went bankrupt and became homeless", z: "許多人破產及無家可歸" },
    { t: "The US began to impose high tariffs on all foreign goods; other European countries started to follow", z: "美國對所有外國貨品徵收高關稅，其他歐洲國家跟隨", warn: BY.q10.warn },
    { t: "The Great Depression occurred in the world", z: "全球出現大蕭條" }];
  const doms = h("div", { class: "dominoes", "aria-hidden": "true" });
  const list = h("ol", { class: "domlist", style: { padding: 0, margin: 0 } });
  items.forEach((it, i) => {
    doms.append(h("div", { class: "dom" }, i + 1));
    list.append(h("li", null, h("b", null, String(i + 1).padStart(2, "0")), it.t, zh(it.z, true), it.warn ? h("div", { class: "warn", style: { marginTop: "6px" } }, it.warn) : null));
  });
  const push = h("button", { class: "btn primary pulse", type: "button" }, "Push the first domino ", zh("推倒第一塊"));
  push.onclick = async () => {
    push.remove();
    for (let i = 0; i < items.length; i++) {
      if (!doms.isConnected) return;
      doms.children[i].classList.add("fall"); list.children[i].classList.add("on"); play("thud");
      await sleep(520);
    }
    el.append(predict({ fromId: "q11" }, () => done()));
  };
  el.append(P("Once the US economy entered a recession, one problem knocked over the next.", "美國經濟一陷入衰退，問題就像骨牌一樣接連倒下。"), doms, push, list);
}
function sceneImpacts(el, done) {
  el.append(P("The Great Depression had economic and political impacts. Open both files.", "大蕭條帶來經濟和政治方面的影響。打開兩份檔案。", "note"),
    tiles([
      { front: "Economic aspect", fz: "經濟方面", back: [h("b", null, "Economic Ruin"), zh("經濟崩潰", true), P("Countries around the world faced massive unemployment, poverty, and starvation.", "世界各國出現大規模失業、貧窮和飢餓。")] },
      { front: "Political aspect", fz: "政治方面", back: [h("b", null, "Loss of Faith in Democracy"), zh("對民主失去信心", true), P("Desperate people felt that their democratic governments were failing to fix the economic crisis.", "絕望的人民覺得民主政府無法解決經濟危機。")] }
    ], () => el.append(predict({ fromId: "q13" }, () => done()))));
}
function sceneDiplomatic(el, done) {
  el.append(P("Diplomatic aspect: each country reacted differently. Sort the cards into the right reaction.", "外交方面：各國反應不同。把卡片放進正確的格子。", "lead"),
    sortGame({
      bins: [{ id: "app", t: "Britain and France", z: "英國和法國" }, { id: "iso", t: "The US", z: "美國" }, { id: "dic", t: "Germany and Japan", z: "德國和日本" }],
      items: [
        { t: "Adopted an appeasement policy toward the aggressors", bin: "app", id: "q14" },
        { t: "Busy solving their own economic problems", bin: "app" },
        { t: "Adopted an isolationist policy", bin: "iso", id: "q15" },
        { t: "Focused on internal problems", bin: "iso" },
        { t: "Citizens supported extreme parties and strongmen", bin: "dic", id: "q16" },
        { t: "Paved the way for dictators to take power", bin: "dic" }]
    }, () => {
      el.append(h("div", { class: "card stack" },
        P("Britain and France were busy solving their own economic problems; they did not have time to deal with international affairs → appeasement policy.", "英法忙於解決經濟問題，無暇處理國際事務 → 綏靖政策。"),
        P("The US government focused on internal problems → isolationist policy.", "美國專注國內問題 → 孤立主義政策。"),
        P("Germany and Japan: in their desperation, citizens supported extreme parties and strongmen who promised quick fixes, national glory, and jobs → this directly paved the way for dictators to take power.", "德日人民在絕望中支持承諾快速解決問題、國家榮耀和工作的極端政黨及強人 → 直接為獨裁者上台鋪路。")));
      done();
    }));
}

/* ---- Stop 2 極權主義 ---- */
function sceneControl(el, done) {
  const after = h("div", { class: "stack" });
  let n = 0;
  const mk = (t, z) => {
    const b = h("button", { class: "bin", type: "button", style: { alignItems: "center", justifyContent: "center", minHeight: "120px" } }, h("h4", null, t), zh(z, true), h("span", { class: "note" }, "Tap to take control"));
    b.onclick = () => {
      if (b.dataset.on) return; b.dataset.on = "1"; n++;
      b.style.background = "var(--signal-soft)"; b.style.borderColor = "var(--signal)"; b.style.borderStyle = "solid";
      b.lastChild.textContent = "CONTROLLED"; b.lastChild.style.color = "var(--signal)"; play("thud");
      if (n === 2) reveal();
    };
    return b;
  };
  function reveal() {
    after.append(h("div", null, h("span", { class: "stamp pop" }, "Totalitarianism")),
      P("Totalitarianism is a system where the government (usually led by a single dictator) has complete, total control over public and private life.", "極權主義：政府（通常由一名獨裁者領導）完全控制公共及私人生活。", "lead"),
      P("During the 1920s and 1930s, totalitarian regimes rose to power in several key nations:", "1920 及 1930 年代，極權政權在幾個主要國家上台："),
      h("div", { class: "chips" },
        h("span", { class: "tag", style: { color: "var(--de)" } }, "Germany – Nazism"),
        h("span", { class: "tag", style: { color: "var(--it)" } }, "Italy – Fascism"),
        h("span", { class: "tag", style: { color: "var(--jp)" } }, "Japan – Militarism")));
    done();
  }
  el.append(P("You are the dictator. Take control of both areas of people's lives.", "假設你是獨裁者：把人民生活的兩個範疇都控制住。", "note"),
    h("div", { class: "bins" }, mk("Public life", "公共生活"), mk("Private life", "私人生活")), after);
}
function sceneRegimes(el, done) {
  el.append(P("Meet the three totalitarian regimes. Flip each card.", "認識三個極權政權。翻開每張卡。", "note"),
    tiles([
      { front: "Germany", fz: "德國 · Nazism 納粹主義", back: [h("b", { style: { color: "var(--de)" } }, "Nazism"), P("Adolf Hitler and the Nazi Party took control. Hitler promised to destroy the harsh Treaty of Versailles, rebuild the German military, and conquer “Lebensraum” (living space) for the German people.", "希特拉及納粹黨掌權，承諾摧毀《凡爾賽和約》、重建德軍、征服「生存空間」。")] },
      { front: "Italy", fz: "意大利 · Fascism 法西斯主義", back: [h("b", { style: { color: "var(--it)" } }, "Fascism"), P("Benito Mussolini wanted to restore the glory of the ancient Roman Empire by aggressively expanding Italy's territory.", "墨索里尼想以侵略擴張恢復古羅馬帝國的光榮。")] },
      { front: "Japan", fz: "日本 · Militarism 軍國主義", back: [h("b", { style: { color: "var(--jp)" } }, "Militarism"), P("The military gained control of the Japanese government. To solve their economic problems and lack of natural resources, they believed Japan needed to conquer neighboring Asian countries.", "軍人控制政府，認為要征服亞洲鄰國以解決經濟問題和天然資源不足。")] }
    ], () => el.append(h("div", { class: "eyebrow", style: { marginTop: "8px" } }, "Match them 配對"), miniMatch([
      { l: "Germany", r: "Nazism", id: "q20" }, { l: "Italy", r: "Fascism", id: "q21" },
      { l: "Japan", r: "Militarism", id: "q22" }, { l: "Lebensraum", r: "Living space", id: "q24" }], () => done()))));
}

/* ---- Stop 3 意大利 ---- */
function sceneMeter(el, done) {
  const g = [
    { t: "Italy lost about 600,000 people in WWI", z: "意大利在一戰中損失約 60 萬人" },
    { t: "However, Italy failed to gain the land promised by the victorious countries", z: "但未能得到戰勝國承諾的土地" },
    { t: "After WWI, the Italian government failed to solve the problems of unemployment and inflation", z: "一戰後政府無法解決失業和通脹" }];
  const fill = h("i"); const tube = h("div", { class: "tube", "aria-hidden": "true" }, fill);
  const after = h("div", { class: "stack" });
  let n = 0;
  const cards = h("div", { class: "cards" }, g.map(x => {
    const b = h("button", { class: "chipx", type: "button" }, x.t, zh(x.z, true));
    b.onclick = () => { if (b.disabled) return; b.disabled = true; b.classList.add("sel"); n++; fill.style.height = (n / g.length * 100) + "%"; play("thud"); if (n === g.length) full(); };
    return b;
  }));
  function full() {
    after.append(h("div", null, h("span", { class: "stamp pop" }, "Wanted: a strong leader")),
      P("Italians saw the then government as weak and expected a strong leader to save them.", "意大利人認為當時政府軟弱，期望有強人拯救他們。", "lead"),
      predict({ q: "Who established the Fascist Party in 1919?", opts: ["Benito Mussolini", "Adolf Hitler", "The militarists", "The Weimar Republic"], ans: 0, id: "q34" }, () => {
        after.append(P("In 1919, Benito Mussolini established the Fascist Party. He had a strong posture and was very good at public speaking. He won the support of different classes in Italy later.", "1919 年墨索里尼成立法西斯黨。他姿態強硬、擅長演說，後來贏得意大利各階層支持。"));
        done();
      }));
  }
  el.append(P("Why did Italians want a strongman? Tap each problem to fill the discontent meter.", "為何意大利人想要強人？點擊每個問題，填滿「不滿指數」。", "note"), h("div", { class: "meter" }, tube, cards), after);
}
function sceneFascism(el, done) {
  el.append(P("Fascism is a political ideology that promotes extreme nationalism.", "法西斯主義是鼓吹極端民族主義的政治意識形態。", "lead"),
    sortGame({
      bins: [{ id: "in", t: "Internally", z: "對內" }, { id: "out", t: "Externally", z: "對外" }],
      items: [
        { t: "Dictatorship", z: "獨裁", bin: "in", id: "q28" },
        { t: "Strict control over people's rights and freedom", z: "嚴格控制權利與自由", bin: "in" },
        { t: "Demands absolute obedience and loyalty from people", z: "要求絕對服從和忠誠", bin: "in" },
        { t: "The external expansion of the state", z: "國家向外擴張", bin: "out", id: "q29" }]
    }, () => {
      el.append(P("Externally in action: Italy invaded Abyssinia (October 1935 – May 1936) and annexed Albania (1939).", "對外擴張的例子：意大利入侵阿比西尼亞（1935–1936）及吞併阿爾巴尼亞（1939）。", "note"));
      done();
    }));
}

/* ---- Stop 4 德國 ---- */
function sceneStairs(el, done) {
  const steps = [
    { y: "WWI", t: "After WWI, Germany signed the harsh Treaty of Versailles", z: "一戰後德國簽署苛刻的《凡爾賽和約》" },
    { y: "1929", t: "The Great Depression caused a severe blow to Germany's economy", z: "大蕭條重創德國經濟", warn: BY.q37.warn },
    { y: "1932", t: "More than 6 million people were unemployed", z: "超過 600 萬人失業", pred: { fromId: "q38" } },
    { y: "", t: "Lots of Germans criticized the Weimar Republic for signing a humiliating peace treaty and being unable to solve the economy", z: "許多德國人批評威瑪共和國簽署屈辱和約、無法解決經濟" },
    { y: "", t: "Adolf Hitler, the leader of the Nazi Party, promised to revoke the Treaty of Versailles and improve the economy", z: "納粹黨領袖希特拉承諾廢除和約、改善經濟" },
    { y: "", t: "His speech was very persuasive and attracted many Germans", z: "他的演說極具說服力，吸引了很多德國人" },
    { y: "1933", t: "Hitler became the Chancellor of Germany", z: "希特拉出任德國總理", pred: { q: "In 1933, Hitler became…", opts: ["the Chancellor of Germany", "the President of Germany", "the leader of the League of Nations", "the leader of Italy"], ans: 0, id: "q42" } },
    { y: "1934", t: "The following year, he also became the President", z: "翌年兼任總統" },
    { y: "Fuhrer", t: "He called himself the “Fuhrer”, meaning leader", z: "自稱「元首」，即領袖" }];
  const stairs = h("div", { class: "stairs" });
  const nodes = steps.map(st => h("div", { class: "stair" }, h("div", { class: "yr" }, st.y || "·"), h("div", null, st.t, zh(st.z, true), st.warn ? h("div", { class: "warn", style: { marginTop: "4px" } }, st.warn) : null)));
  nodes.forEach(n => stairs.append(n));
  const seq = revealSeq(steps.map(st => ({ pred: st.pred })), {
    btn: "Climb ↑",
    onStep: i => { nodes.forEach(n => n.classList.remove("cur")); nodes[i].classList.add("on", "cur"); play("flip"); },
    onDone: () => { play("win"); confetti(40); done(); }
  });
  el.append(P("Climb Hitler's staircase to power – each step is one point from p.3.", "沿著希特拉的上台階梯往上爬——每一級都是講義第 3 頁的一點。", "note"), seq, stairs);
}
function scenePromises(el, done) {
  el.append(P("Who promised or wanted what? Mix of p.2 and p.3.", "誰承諾或想要甚麼？（第 2、3 頁）", "lead"),
    sortGame({
      bins: [{ id: "hit", t: "Hitler", z: "希特拉（德國）" }, { id: "mus", t: "Mussolini", z: "墨索里尼（意大利）" }, { id: "jap", t: "Japan's military", z: "日本軍方" }],
      items: [
        { t: "Destroy the harsh Treaty of Versailles", bin: "hit", id: "q23" },
        { t: "Rebuild the German military", bin: "hit" },
        { t: "Conquer “Lebensraum” (living space)", bin: "hit" },
        { t: "Revoke the Treaty of Versailles and improve the economy", bin: "hit", id: "q40" },
        { t: "Restore the glory of the ancient Roman Empire", bin: "mus", id: "q25" },
        { t: "Conquer neighboring Asian countries", bin: "jap", id: "q26" },
        { t: "Expand overseas to solve economic problems", bin: "jap", id: "q49" }]
    }, () => done()));
}

/* ---- Stop 5 日本 ---- */
function sceneTug(el, done) {
  const knot = h("div", { class: "knot" });
  knot.style.left = "30%";
  const tug = h("div", { class: "tug", "aria-hidden": "true" }, h("div", { class: "mid" }), h("div", { class: "rope" }), knot,
    h("div", { class: "side l" }, "Party government"), h("div", { class: "side r" }, "Militarists"));
  const steps = [
    { when: "After WWI", t: "The party government ruled Japan.", z: "政黨政府統治日本。", pos: 30 },
    { when: "But…", t: "The party government was corrupt, inefficient, and weak.", z: "政黨政府腐敗、低效、軟弱。", pos: 42 },
    { when: "Depression", t: "During the Great Depression, Japan's export fell greatly by 50% and 3 million people were unemployed.", z: "大蕭條期間日本出口大跌 50%，300 萬人失業。", pos: 54, pred: { fromId: "q47" } },
    { when: "Militarists", t: "The militarists said: expand overseas in order to solve economic problems. Thus, they became popular.", z: "軍國主義者主張向海外擴張以解決經濟問題，因而受歡迎。", pos: 66 },
    { when: "1931–32", t: "In 1931, the Japanese army invaded Manchuria and later set up Manchukuo in 1932. This increased the popularity of the Japanese military and militarism.", z: "1931 年日軍侵佔滿洲，1932 年成立滿洲國，令軍方及軍國主義更受歡迎。", pos: 78 },
    { when: "1932", t: "Party government ended. A military dictatorship was established step by step. Japan became more aggressive towards China and Asia.", z: "政黨政府結束，逐步建立軍事獨裁，對中國及亞洲更具侵略性。", pos: 92, stamp: "Military dictatorship" }];
  const seq = revealSeq(steps.map(st => ({
    pred: st.pred,
    render: () => moveCard(st.when, st.t, st.z, "var(--jp)", st.stamp ? h("div", null, h("span", { class: "stamp pop" }, st.stamp)) : null)
  })), {
    btn: "Pull →",
    onStep: i => { knot.style.left = steps[i].pos + "%"; play("thud"); },
    onDone: () => { play("win"); done(); }
  });
  el.append(P("Who controlled Japan after WWI? Pull the rope and watch power shift to the militarists.", "一戰後誰控制日本？拉動繩子，看權力如何轉到軍國主義者手上。", "note"), tug, seq);
}
function sceneFeatures(el, done) {
  const F = [
    ["Military dictatorship", "軍事獨裁", "The militarists controlled the cabinet. Under military dictatorship, all opposition to its rule was silenced by force."],
    ["Control over thoughts and emperor worship", "思想控制及崇拜天皇", "To unite the Japanese people, the military government promoted emperor-centred nationalism. The military controlled thought and ideas. School textbooks were used to promote war and emperor-centred nationalism."],
    ["Anti-communism", "反共", "Japanese militarists believed that the idea of class struggle would weaken unity among the people and even destroy national tradition."],
    ["Military and territorial expansion", "軍事及領土擴張", "Japan's expansion aimed to get land for its surplus population and resources for its industries. It expanded in China and Asia step by step."],
    ["State control", "國家控制", "The military government controlled all resources and economic activities in the state. The whole nation was military-oriented to continue the war effort."]];
  el.append(P("Five features of militarism in Japan. Flip all five, then match them.", "日本軍國主義的五大特徵：全部翻開，再配對。", "note"),
    tiles(F.map((f, i) => ({ num: String(i + 1), front: f[0], fz: f[1], back: [h("b", null, f[0]), h("p", { style: { fontSize: ".88rem" } }, f[2])] })), () => {
      el.append(h("div", { class: "eyebrow", style: { marginTop: "8px" } }, "Match them 配對"), miniMatch([
        { l: "Military dictatorship", r: "Militarists controlled the cabinet; opposition silenced by force", id: "q53" },
        { l: "Thought control and emperor worship", r: "Emperor-centred nationalism; textbooks promoted war", id: "q54" },
        { l: "Anti-communism", r: "Class struggle would weaken unity and destroy national tradition", id: "q55" },
        { l: "Military and territorial expansion", r: "Land for surplus population, resources for industries", id: "q56" },
        { l: "State control", r: "Military government controlled all resources and economic activities", id: "q57" }], () => done()));
    }));
}

/* ---- Stop 6 1930 年代侵略 ---- */
function sceneScrub(el, done) {
  const lanes = [
    { k: "Japan", z: "日本", c: "var(--jp)", ids: ["q58", "q59", "q60", "q61", "q62"] },
    { k: "Italy", z: "意大利", c: "var(--it)", ids: ["q63", "q64"] },
    { k: "Germany", z: "德國", c: "var(--de)", ids: ["q65", "q66", "q67", "q68", "q69", "q70"] },
    { k: "Pacts", z: "條約", c: "var(--brass)", ids: ["q71", "q72", "q73", "q74"] }];
  const yearEl = h("div", { class: "yearbig" }, "1931");
  const range = h("input", { type: "range", min: 1931, max: 1940, step: 1, value: 1931, id: "yr-scrub", "aria-label": "Year" });
  const detail = h("div");
  const laneEls = lanes.map(L => { const evs = h("div", { class: "evs" }); return { L, evs, node: h("div", { class: "lane" }, h("div", { class: "ln", style: { color: L.c } }, L.k, " ", zh(L.z)), evs) }; });
  let finished = false, timer = null;
  function draw() {
    const y = +range.value; yearEl.textContent = y;
    laneEls.forEach(({ L, evs }) => {
      evs.innerHTML = "";
      L.ids.map(id => BY[id]).filter(f => yearOf(f.d) <= y).forEach(f => {
        const c = h("button", { class: "evchip" + (yearOf(f.d) === y ? " now" : ""), type: "button" }, h("span", { class: "w" }, f.when), f.ev);
        c.onclick = () => { detail.innerHTML = ""; detail.append(h("div", { class: "card stack", style: { boxShadow: "none" } }, h("div", { class: "eyebrow" }, f.when), h("div", null, f.a), zh(f.zh, true))); };
        evs.append(c);
      });
      if (!evs.children.length) evs.append(h("span", { class: "note", style: { paddingTop: "6px" } }, "—"));
    });
    if (y === 1940 && !finished) { finished = true; done(); }
  }
  range.oninput = () => { play("tick"); draw(); };
  const playBtn = h("button", { class: "btn primary pulse", type: "button" }, "Play 1931 → 1940");
  const stop = () => { clearInterval(timer); timer = null; };
  onLeave(stop);
  playBtn.onclick = () => {
    playBtn.classList.remove("pulse");
    if (timer) { stop(); playBtn.textContent = "Play"; return; }
    if (+range.value >= 1940) range.value = 1931;
    draw(); playBtn.textContent = "Pause";
    timer = setInterval(() => {
      if (+range.value >= 1940) { stop(); playBtn.textContent = "Replay"; return; }
      range.value = +range.value + 1; play("tick"); draw();
    }, 1200);
  };
  el.append(P("Press Play (or drag the slider) to travel through the 1930s. Tap any event for details.", "按播放或拖動年份，逐年看侵略行動；點擊事件看詳情。", "note"),
    h("div", { class: "scrub" }, h("div", { class: "row between" }, yearEl, playBtn), range, h("div", { class: "lanes" }, laneEls.map(x => x.node)), detail));
  draw();
}
function sceneGermany(el, done) {
  const steps = [
    { w: "1935", t: "Introduced conscription", z: "實行徵兵制" },
    { w: "March 1936", t: "German troops entered the demilitarized Rhineland", z: "德軍進入非軍事化的萊茵蘭", pred: { fromId: "q66" }, stamp: "Broke the Treaty of Versailles" },
    { w: "March 1938", t: "Union with Austria (Anschluss)", z: "德奧合併", pred: { fromId: "q67" }, stamp: "Broke the Treaty of St. Germain" },
    { w: "September 1938", t: "Germany occupied the Sudetenland, the northwestern part of Czechoslovakia", z: "佔領蘇台德區（捷克斯洛伐克西北部）" },
    { w: "March 1939", t: "Annexed the rest of Czechoslovakia", z: "吞併捷克斯洛伐克餘下部分" },
    { w: "September 1939", t: "Germany invaded Poland", z: "德國入侵波蘭" }];
  el.append(P("Germany's expansion in Europe – six moves. Guess the treaty before each stamp lands.", "德國在歐洲擴張的六步。蓋章前先估估違反了哪條條約。", "note"),
    revealSeq(steps.map(st => ({ pred: st.pred, render: () => moveCard(st.w, st.t, st.z, "var(--de)", st.stamp ? h("div", null, h("span", { class: "stamp pop" }, st.stamp)) : null) })),
      { btn: "Next move →", onStep: () => play("thud"), onDone: () => done() }));
}
function sceneJapan(el, done) {
  const steps = [
    { w: "18 September 1931", t: "Shenyang Incident: Japan invaded the northeast provinces of China", z: "瀋陽事變：日本入侵中國東北各省" },
    { w: "January 1932", t: "Shanghai Incident: Japan invaded Shanghai but withdrew its troops because Britain, France and the US intervened", z: "上海事變：英法美干預，日本撤軍", pred: { fromId: "q59" } },
    { w: "March 1932", t: "Japan set up Manzhouguo, a puppet state, in Northeastern China", z: "日本在中國東北成立傀儡政權滿洲國" },
    { w: "1937", t: "Lugouqiao Incident (also called the Marco Polo Bridge Incident): Japan invaded Beijing and officially began a full invasion on China", z: "盧溝橋事變：日本全面侵華", pred: { fromId: "q61" } },
    { w: "December 1937", t: "The Japanese army captured Nanjing and massacred Chinese military and civilians. It is known as the Nanjing Massacre", z: "日軍攻陷南京並屠殺中國軍民——南京大屠殺" }];
  el.append(P("Japan's expansion in China, step by step.", "日本一步一步侵略中國。", "note"),
    revealSeq(steps.map(st => ({ pred: st.pred, render: () => moveCard(st.w, st.t, st.z, "var(--jp)") })), { btn: "Next →", onStep: () => play("thud"), onDone: () => done() }));
}
function sceneItaly(el, done) {
  el.append(P("Italian expansion – Fascism's “external expansion of the state” in action.", "意大利的擴張——法西斯主義「對外擴張」的實例。", "note"),
    moveCard("Oct 1935 – May 1936", "Italy invaded Abyssinia in northeastern Africa and annexed it in the end.", "意大利入侵非洲東北部的阿比西尼亞，最終吞併。", "var(--it)"),
    moveCard("1939", "Italy annexed Albania.", "意大利吞併阿爾巴尼亞。", "var(--it)"),
    predict({ fromId: "q96" }, () => {
      el.append(P("Remember Mussolini's aim: restore the glory of the ancient Roman Empire by aggressively expanding Italy's territory (p.2).", "記住墨索里尼的目標：以侵略擴張恢復古羅馬帝國的光榮（第 2 頁）。", "note"));
      done();
    }));
}

/* ---- Stop 7 軸心國 ---- */
function sceneAxis(el, done) {
  const N = { G: [95, 72, "Germany", "Berlin", "var(--de)"], J: [305, 72, "Japan", "Tokyo", "var(--jp)"], I: [200, 208, "Italy", "Rome", "var(--it)"] };
  const svg = s("svg", { viewBox: "0 0 400 262", role: "img", "aria-label": "Diagram of alliances between Germany, Italy and Japan" });
  const tri = s("polygon", { points: "95,72 305,72 200,208", style: "fill:var(--brass-soft);opacity:0;transition:opacity .6s" });
  svg.append(tri);
  const E = {};
  [["GJ", "G", "J"], ["GI", "G", "I"], ["IJ", "I", "J"]].forEach(([k, a, b]) => {
    E[k] = s("line", { x1: N[a][0], y1: N[a][1], x2: N[b][0], y2: N[b][1], style: "stroke:var(--brass);stroke-width:0;transition:stroke-width .5s" });
    svg.append(E[k]);
  });
  Object.values(N).forEach(([x, y, n, c, col]) => svg.append(
    s("circle", { cx: x, cy: y, r: 40, style: `fill:var(--surface);stroke:${col};stroke-width:4` }),
    s("text", { x, y: y + 1, "text-anchor": "middle", text: n.toUpperCase(), style: `font:800 16px var(--f-display);fill:${col}` }),
    s("text", { x, y: y + 17, "text-anchor": "middle", text: c, style: "font:11px var(--f-mono);fill:var(--muted)" })));
  const center = s("text", { x: 200, y: 124, "text-anchor": "middle", text: "AXIS POWERS", style: "font:800 18px var(--f-display);fill:var(--brass);opacity:0;transition:opacity .6s" });
  const lbl = s("text", { x: 200, y: 60, "text-anchor": "middle", style: "font:11px var(--f-mono);fill:var(--muted)" });
  svg.append(center, lbl);
  const line = (k, w, dash) => { E[k].style.strokeWidth = w; E[k].style.strokeDasharray = dash; };
  const steps = [
    { y: "1936", go: () => { line("GJ", 4, "8 5"); lbl.textContent = "Anti-Comintern Pact"; }, t: "Germany and Japan concluded the Anti-Comintern Pact to defend against the threat of the communist Soviet Union.", z: "德日簽訂《反共產國際協定》，防範共產蘇聯的威脅。" },
    { y: "1937", go: () => { line("GI", 2.5, "8 5"); line("IJ", 2.5, "8 5"); }, t: "Italy also signed the pact.", z: "意大利也簽署了這份協定。" },
    { y: "1939", pred: { q: "In 1939, which two countries signed the Pact of Steel?", opts: ["Germany and Italy", "Germany and Japan", "Japan and Italy", "Britain and France"], ans: 0, id: "q73" }, go: () => line("GI", 8, "none"), t: "Germany and Italy signed the Pact of Steel to form a military alliance.", z: "德意簽訂《鋼鐵盟約》，結成軍事同盟。" },
    { y: "1940", go: () => { ["GJ", "GI", "IJ"].forEach(k => line(k, 8, "none")); tri.style.opacity = 1; center.style.opacity = 1; lbl.textContent = "Tripartite Pact"; }, t: "Japan, Germany and Italy signed the Tripartite Pact, forming the military alliance of the “Berlin-Rome-Tokyo Axis”. Thus, they were also called the “Axis Powers”.", z: "日德意簽訂《三國同盟條約》，組成「柏林－羅馬－東京軸心」，稱為「軸心國」。" }];
  const caps = h("div", { class: "moves" });
  const btnRow = h("div", { class: "yrbtns" });
  const pslot = h("div");
  let k = 0;
  const btns = steps.map((st, i) => {
    const b = h("button", { class: "yrbtn" + (i === 0 ? " next" : ""), type: "button", disabled: i > 0 }, st.y);
    b.onclick = () => {
      if (i !== k) return;
      const apply = () => {
        pslot.innerHTML = ""; st.go(); play(i === 3 ? "win" : "thud");
        caps.append(moveCard(st.y, st.t, st.z, "var(--brass)"));
        b.classList.remove("next"); b.classList.add("done"); b.disabled = true; k++;
        if (btns[k]) { btns[k].disabled = false; btns[k].classList.add("next"); }
        else { confetti(80); done(); }
      };
      if (st.pred) { b.disabled = true; pslot.innerHTML = ""; pslot.append(predict(st.pred, apply)); }
      else apply();
    };
    btnRow.append(b);
    return b;
  });
  el.append(P("Build the alliance year by year. Press the years in order.", "按年份次序，一步步砌出軸心國同盟。", "note"), h("div", { class: "axisbox stack" }, svg, btnRow), pslot, caps);
}
function scenePacts(el, done) {
  el.append(P("Which countries signed which pact?", "邊啲國家簽咗邊份條約？", "lead"), miniMatch([
    { l: "Germany and Japan (1936)", r: "Anti-Comintern Pact", id: "q71" },
    { l: "Italy (1937)", r: "Also signed the Anti-Comintern Pact", id: "q72" },
    { l: "Germany and Italy (1939)", r: "Pact of Steel", id: "q73" },
    { l: "Japan, Germany and Italy (1940)", r: "Tripartite Pact – Berlin-Rome-Tokyo Axis", id: "q74" }], () => done()));
}

/* ---- Stop 8 國聯 ---- */
function sceneLeague(el, done) {
  const grid = h("div", { class: "dotgrid", "aria-hidden": "true" }, Array.from({ length: 58 }, () => h("i")));
  const counter = h("div", { class: "counter" }, "0");
  const after = h("div", { class: "stack" });
  const count = h("button", { class: "btn primary pulse", type: "button" }, "Count the members ", zh("數一數成員國"));
  count.onclick = async () => {
    count.remove();
    for (let i = 0; i < 58; i++) { if (!grid.isConnected) return; grid.children[i].classList.add("on"); counter.textContent = i + 1; if (i % 4 === 0) play("tick"); await sleep(28); }
    after.append(P("It had 58 member states at its peak. Its member countries would collectively…", "高峰期有 58 個成員國。成員國會集體……"),
      tiles([
        { front: "Mediate", fz: "調停", back: P("Member countries would collectively mediate to stop aggression.", "成員國會集體調停，制止侵略。") },
        { front: "Impose sanctions", fz: "實施制裁", back: P("…or impose sanctions. Later, against the aggressors, the League could only condemn or impose economic sanctions (p.6).", "或實施制裁。後來國聯對侵略者只能譴責或經濟制裁（第 6 頁）。") },
        { front: "Take military action", fz: "採取軍事行動", back: P("…or take military action. But the League did not have a standing army (p.6).", "或採取軍事行動。但國聯沒有常備軍（第 6 頁）。") }
      ], () => {
        after.append(P("In the 1920s, the League settled some disputes among the smaller countries, but it failed to stop the invasions by Japan, Germany, and Italy. They ignored the criticism of the League and even withdrew from it one after another.", "1920 年代國聯解決了一些小國之間的糾紛，但未能阻止日、德、意的侵略。它們無視國聯批評，更相繼退出。"));
        done();
      }));
  };
  el.append(P("After WWI, the League of Nations was created to maintain world peace through “collective security” – the idea that countries would act together to stop any aggressor.", "一戰後成立國際聯盟，以「集體安全」維持世界和平——各國一同行動制止任何侵略者。", "lead"),
    h("div", { class: "row", style: { alignItems: "center" } }, counter, h("span", { class: "note" }, "member states", zh("成員國", true))), grid, count, after);
}
function sceneShield(el, done) {
  const reasons = [
    ["Lack of representation", "代表性不足", "Its operation mainly relied on the support of Britain and France. Other powers joined only briefly or never joined (e.g. the US), so it failed to establish its authority."],
    ["Inefficient mechanism", "機制低效", "Resolutions had to be passed unanimously by all members of the League. This made it difficult for the League to carry out actions."],
    ["Weak military power", "軍事力量薄弱", "The League did not have a standing army. The League could only condemn or impose economic sanctions on the aggressors."]];
  const cracks = ["M70 30 L84 62 L66 90 L82 120", "M130 50 L118 84 L136 112 L122 150", "M96 140 L110 168 L94 190 L104 214"];
  const svg = s("svg", { viewBox: "0 0 200 240", role: "img", "aria-label": "The League of Nations shield with three cracks" },
    s("path", { d: "M100 8 L182 36 L172 140 Q146 198 100 230 Q54 198 28 140 L18 36 Z", style: "fill:var(--brass-soft);stroke:var(--lon);stroke-width:5" }),
    s("text", { x: 100, y: 34, "text-anchor": "middle", text: "LEAGUE", style: "font:800 15px var(--f-display);fill:var(--lon)" }));
  const out = h("div", { class: "stack" });
  let found = 0;
  cracks.forEach((d, i) => {
    const vis = s("path", { d, style: "fill:none;stroke:var(--muted);stroke-width:3;stroke-dasharray:4 4;stroke-linecap:round" });
    const hit = s("path", { d, style: "fill:none;stroke:transparent;stroke-width:28" });
    const [x, y] = d.match(/M(\d+) (\d+)/).slice(1).map(Number);
    const tag = s("g", null, s("circle", { cx: x, cy: y - 4, r: 11, style: "fill:var(--surface);stroke:var(--lon);stroke-width:2" }), s("text", { x, y: y, "text-anchor": "middle", text: String(i + 1), style: "font:800 13px var(--f-display);fill:var(--lon)" }));
    const g = s("g", { class: "crack", tabindex: "0", role: "button", "aria-label": "Crack " + (i + 1) }, vis, hit, tag);
    const open = () => {
      if (g.dataset.on) return; g.dataset.on = "1"; found++;
      vis.style.stroke = "var(--signal)"; vis.style.strokeDasharray = "none"; vis.style.strokeWidth = "4"; play("thud");
      out.append(h("div", { class: "move" }, h("div", { class: "when", style: { color: "var(--lon)" } }, String(i + 1)),
        h("div", { class: "stack", style: { gap: "4px" } }, h("b", null, reasons[i][0]), zh(reasons[i][1], true), h("div", null, reasons[i][2]))));
      if (found === 3) finish();
    };
    g.addEventListener("click", open);
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    svg.append(g);
  });
  function finish() {
    out.append(h("div", { class: "stack", style: { borderTop: "1px solid var(--line)", paddingTop: "12px" } },
      h("div", { class: "eyebrow" }, "Chart on p.6 · Major members of the League of Nations (1920–1946)"),
      leagueChart(),
      h("div", { class: "note" }, "Redrawn from the chart in your notes. The numbers in the scan are blurry – check them against p.6. ", zh("根據講義第 6 頁圖表重繪；掃描中數字較模糊，請以講義為準。"))));
    done();
  }
  el.append(P("The League was so weak and ineffective because… Tap the three cracks in its shield.", "國聯軟弱無力的原因——點擊盾牌上的三條裂痕。", "note"), h("div", { class: "shield" }, svg), out);
}
// 國聯主要成員圖表（第 6 頁）
function leagueChart() {
  const rows = [["Britain", 1920, 1946, "var(--bf)"], ["France", 1920, 1946, "var(--bf)"], ["Italy", 1920, 1937, "var(--it)"], ["Japan", 1920, 1933, "var(--jp)"], ["Germany", 1926, 1933, "var(--de)"], ["USSR", 1934, 1939, "var(--brass)"]];
  const x = y => 62 + (y - 1920) / 30 * 236, top = 14, rh = 26;
  const svg = s("svg", { viewBox: "0 0 340 206", role: "img", "aria-label": "Bar chart of League membership years: Britain and France 1920 to 1946, Italy 1920 to 1937, Japan 1920 to 1933, Germany 1926 to 1933, USSR 1934 to 1939" });
  for (let y = 1920; y <= 1950; y += 5) {
    svg.append(s("line", { x1: x(y), x2: x(y), y1: top - 4, y2: top + rows.length * rh, style: "stroke:var(--line);stroke-width:1" }),
      s("text", { x: x(y), y: top + rows.length * rh + 16, "text-anchor": "middle", text: String(y), style: "font:11px var(--f-mono);fill:var(--muted)" }));
  }
  rows.forEach(([n, a, b, c], i) => {
    const y = top + i * rh;
    svg.append(s("text", { x: 56, y: y + 14, "text-anchor": "end", text: n, style: "font:700 12px var(--f-body);fill:var(--ink)" }),
      s("rect", { x: x(a), y: y + 3, width: x(b) - x(a), height: 15, rx: 3, style: `fill:${c}` }),
      s("text", { x: x(b) + 4, y: y + 15, text: `${a}–${b}`, style: "font:10px var(--f-mono);fill:var(--muted)" }));
  });
  return h("div", { class: "chartbox" }, svg);
}
function sceneCases(el, done) {
  const cases = [
    { k: "Japan", z: "日本", w: "1931–1933", lines: [["1931: Japan invaded Manchuria (in northeast China).", "1931 年日本入侵滿洲（中國東北）。"], ["The League condemned Japan and urged it to withdraw.", "國聯譴責日本並要求撤軍。"]],
      q: "Did Japan withdraw?", opts: ["No – Japan ignored the demand", "Yes – Japan withdrew its army"], id: "q89",
      out: ["Japan ignored the demand and simply left the League in 1933. The League did nothing to stop them.", "日本置之不理，1933 年退出國聯；國聯沒有阻止。"] },
    { k: "Germany", z: "德國", w: "1932–1933", lines: [["1932: the League convened the Geneva Disarmament Conference.", "1932 年國聯召開日內瓦裁軍會議。"], ["1933: Hitler rose to power.", "1933 年希特拉上台。"]],
      q: "What did Germany do?", opts: ["Left both the disarmament conference and the League", "Disarmed as the conference wanted", "Asked the League to send an army"], id: "q92",
      out: ["Germany left both the disarmament conference and the League. The League also did nothing to stop the German aggression in the 1930s.", "德國退出裁軍會議及國聯；國聯亦沒有阻止德國在 1930 年代的侵略。"] },
    { k: "Italy", z: "意大利", w: "1935–1937", lines: [["1935: Italy invaded Abyssinia (nowadays Ethiopia).", "1935 年意大利入侵阿比西尼亞（今埃塞俄比亞）。"], ["The League tried to use economic sanctions to stop the Italian invasion.", "國聯嘗試以經濟制裁阻止意大利。"]],
      q: "Did the sanctions work?", opts: ["No – they were weak and ineffective", "Yes – Italy pulled out of Abyssinia"], id: "q93",
      out: ["They were weak and ineffective. In 1936, Italy occupied Abyssinia, and it left the League the next year.", "制裁軟弱無效。1936 年意大利佔領阿比西尼亞，翌年退出國聯。"] }];
  let solved = 0;
  const files = cases.map(c => {
    const body = h("div", { class: "body", hidden: true });
    const state = h("span", { class: "tag" }, "Open case");
    const head = h("button", { type: "button", "aria-expanded": "false" }, h("h4", null, "Case: " + c.k, " ", zh(c.z)), h("span", { class: "mono note" }, c.w), state);
    let started = false;
    head.onclick = () => {
      body.hidden = !body.hidden; head.setAttribute("aria-expanded", body.hidden ? "false" : "true"); play("flip");
      if (started) return; started = true;
      c.lines.forEach(l => body.append(P(l[0], l[1])));
      body.append(predict({ q: c.q, opts: c.opts, ans: 0, id: c.id, tag: "Your verdict · 你的判斷" }, () => {
        body.append(P(c.out[0], c.out[1], "lead"), h("div", null, h("span", { class: "stamp pop" }, "League failed")));
        state.textContent = "Closed ✓"; solved++;
        if (solved === cases.length) done();
      }));
    };
    return h("div", { class: "folder" }, head, body);
  });
  el.append(P("Examples of the failure of the League in the 1930s. Open each case file and decide.", "1930 年代國聯失敗的例子。打開每份案件檔案作出判斷。", "note"), h("div", { class: "casefiles" }, files));
}
function sceneResult(el, done) {
  el.append(P("So what did the dictators learn?", "獨裁者從中學到甚麼？", "lead"),
    predict({ fromId: "q97" }, () => {
      el.append(h("div", null, h("span", { class: "stamp pop" }, "Powerless")),
        P("The Result: Dictators realized the League was powerless. They learned they could act aggressively without facing any real consequences.", "結果：獨裁者發現國聯無力，知道可以肆意侵略而不會有真正的後果。", "lead"));
      done();
    }));
}

/* ---- Stop 9 綏靖 ---- */
function sceneScale(el, done) {
  const svg = s("svg", { viewBox: "0 0 440 240", role: "img", "aria-label": "A balance scale tipping towards avoiding war" });
  svg.append(s("rect", { x: 170, y: 214, width: 100, height: 12, rx: 4, style: "fill:var(--muted)" }), s("rect", { x: 216, y: 70, width: 8, height: 146, style: "fill:var(--muted)" }));
  const beam = s("g", { class: "beam" });
  const pan = (x, label, sub) => s("g", null,
    s("line", { x1: x, y1: 70, x2: x - 40, y2: 140, style: "stroke:var(--muted);stroke-width:1.5" }), s("line", { x1: x, y1: 70, x2: x + 40, y2: 140, style: "stroke:var(--muted);stroke-width:1.5" }),
    s("path", { d: `M${x - 50} 140 Q${x} 168 ${x + 50} 140 Z`, style: "fill:var(--surface2);stroke:var(--ink);stroke-width:2" }),
    s("text", { x, y: 190, "text-anchor": "middle", text: label, style: "font:800 15px var(--f-display);fill:var(--ink)" }),
    s("text", { x, y: 206, "text-anchor": "middle", text: sub, style: "font:11px var(--f-mono);fill:var(--muted)" }));
  const blocks = s("g");
  beam.append(s("rect", { x: 60, y: 66, width: 320, height: 8, rx: 4, style: "fill:var(--ink)" }), pan(90, "FIGHT ANOTHER WAR", "再打一仗"), pan(350, "AVOID WAR", "避免戰爭"), blocks);
  svg.append(beam, s("circle", { cx: 220, cy: 70, r: 7, style: "fill:var(--brass)" }));
  const W = [
    ["Still traumatized by the horrors of WWI", "仍受一戰的恐怖經歷創傷"],
    ["Struggling with the Great Depression – not ready to fight another war", "受大蕭條困擾，未準備好再打仗"],
    ["Many felt the Treaty of Versailles had been too harsh on Germany", "許多人認為《凡爾賽和約》對德國太苛刻"]];
  let n = 0;
  const after = h("div", { class: "stack" });
  const chips = h("div", { class: "stack" }, W.map(w => {
    const b = h("button", { class: "chipx", type: "button" }, "+ ", w[0], zh(w[1], true));
    b.onclick = () => {
      if (b.disabled) return; b.disabled = true; b.classList.add("sel"); n++;
      blocks.append(s("rect", { x: 330 - (n - 1) * 4, y: 128 - n * 14, width: 40, height: 12, rx: 2, style: "fill:var(--signal)" }));
      beam.style.transform = `rotate(${n * 6}deg)`; play("thud");
      if (n === W.length) finish();
    };
    return b;
  }));
  function finish() {
    after.append(h("div", null, h("span", { class: "stamp pop" }, "Appeasement")),
      P("The appeasement policy was the foreign policy adopted by Britain and France in the 1930s when facing the expansion of the Axis Powers. It meant giving in to the demands of the invaders in order to avoid war.", "綏靖政策：英法在 1930 年代面對軸心國擴張時採取的外交政策，即向侵略者的要求讓步以避免戰爭。", "lead"),
      predict({ fromId: "q98" }, () => done()));
  }
  el.append(P("Why did Britain and France appease? Put each reason on the scale.", "英法為何採取綏靖？把每個原因放上天秤。", "note"), h("div", { class: "scale" }, svg), chips, after);
}
function sceneMunich(el, done) {
  el.append(predict({ fromId: "q101", tag: "Recall first · 先回想" }, () => {
    el.append(h("div", { class: "card stack", style: { borderLeft: "4px solid var(--signal)" } },
      h("div", { class: "eyebrow" }, "The Munich Agreement (1938)"),
      P("The most famous example of the appeasement policy was the Munich Agreement. In September 1938, Hitler demanded the Sudetenland (a…", "綏靖政策最著名的例子是《慕尼黑協定》。1938 年 9 月，希特拉要求得到蘇台德區……", "lead"),
      h("div", { class: "warn" }, "講義第 6 頁在這句中途結束，這一站只溫習到這裡為止。")),
      P("Link it with p.5: in September 1938, Germany occupied the Sudetenland.", "連結第 5 頁：1938 年 9 月，德國佔領蘇台德區。"),
      predict({ fromId: "q68" }, () => done()));
  }));
}

/* ---- 終點：四大因素連結 ---- */
function sceneMap(el, done) {
  const svg = s("svg", { viewBox: "0 0 420 330", role: "img", "aria-label": "Concept map linking the four factors to WWII" });
  const defs = s("defs", null, s("marker", { id: "ah", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, s("path", { d: "M0 0 L10 5 L0 10 z", style: "fill:var(--muted)" })));
  svg.append(defs);
  const node = (x, y, t, z, col) => s("g", null, s("rect", { x, y, width: 150, height: 56, rx: 10, style: `fill:var(--surface);stroke:${col};stroke-width:2.5` }),
    s("text", { x: x + 75, y: y + 25, "text-anchor": "middle", text: t, style: `font:800 15px var(--f-display);fill:${col}` }),
    s("text", { x: x + 75, y: y + 43, "text-anchor": "middle", text: z, style: "font:11px var(--f-zh);fill:var(--muted)" }));
  const links = [
    { d: "M160 38 L258 38", n: [209, 38], t: "Great Depression → dictators", txt: "In their desperation, citizens in Germany and Japan supported extreme parties and strongmen. This directly paved the way for dictators to take power (p.2). In Germany the Depression caused a severe blow in 1929; in Japan exports fell by 50% (p.3).", z: "大蕭條令德日人民支持強人，為獨裁者上台鋪路。" },
    { d: "M85 66 L85 148", n: [85, 107], t: "Great Depression → appeasement", txt: "Britain and France were busy solving their own economic problems, so they adopted an appeasement policy toward the aggressors (p.2). They were struggling with the Great Depression and not ready to fight another war (p.6).", z: "英法忙於應付大蕭條，未準備再戰 → 綏靖。" },
    { d: "M300 66 L300 148", n: [300, 107], t: "Dictators → League fails", txt: "Japan, Germany and Italy invaded other countries. The League failed to stop them, and they withdrew from it one after another (p.5–6).", z: "日德意侵略他國，國聯無法阻止，它們相繼退出。" },
    { d: "M360 150 L360 68", n: [360, 107], t: "League fails → dictators", txt: "The Result: dictators realized the League was powerless. They learned they could act aggressively without facing any real consequences (p.6).", z: "國聯無力 → 獨裁者知道侵略不會有真正後果。" },
    { d: "M160 160 L262 68", n: [211, 114], t: "Appeasement → the Axis Powers", txt: "Appeasement meant Britain and France gave in to the demands of the invaders in order to avoid war – e.g. the Munich Agreement (1938), when Hitler demanded the Sudetenland (p.6).", z: "綏靖＝向侵略者讓步，例如《慕尼黑協定》。" }];
  svg.append(node(10, 10, "GREAT DEPRESSION", "大蕭條", "var(--accent)"), node(260, 10, "DICTATORS", "極權國家", "var(--jp)"),
    node(10, 150, "APPEASEMENT", "綏靖政策", "var(--bf)"), node(260, 150, "LEAGUE FAILS", "國聯失敗", "var(--lon)"));
  svg.append(s("path", { d: "M85 206 L170 268", style: "stroke:var(--line);stroke-width:2;stroke-dasharray:5 5;fill:none" }), s("path", { d: "M335 206 L250 268", style: "stroke:var(--line);stroke-width:2;stroke-dasharray:5 5;fill:none" }));
  const ww = s("g", { style: "opacity:.35;transition:opacity .6s" }, s("rect", { x: 135, y: 268, width: 150, height: 52, rx: 10, style: "fill:var(--ink)" }),
    s("text", { x: 210, y: 291, "text-anchor": "middle", text: "WWII", style: "font:800 18px var(--f-display);fill:var(--bg)" }),
    s("text", { x: 210, y: 309, "text-anchor": "middle", text: "1939–1945", style: "font:11px var(--f-mono);fill:var(--bg)" }));
  svg.append(ww);
  const info = h("div");
  let opened = 0;
  links.forEach((L, i) => {
    const path = s("path", { d: L.d, "marker-end": "url(#ah)", style: "fill:none;stroke:var(--muted);stroke-width:2.5" });
    const hit = s("path", { d: L.d, style: "fill:none;stroke:transparent;stroke-width:26" });
    const badge = s("g", null, s("circle", { cx: L.n[0], cy: L.n[1], r: 12, style: "fill:var(--brass);stroke:var(--surface);stroke-width:2" }), s("text", { x: L.n[0], y: L.n[1] + 4, "text-anchor": "middle", text: String(i + 1), style: "font:800 13px var(--f-display);fill:var(--surface)" }));
    const g = s("g", { class: "arrow", tabindex: "0", role: "button", "aria-label": L.t }, path, hit, badge);
    const open = () => {
      svg.querySelectorAll(".arrow").forEach(a => a.classList.remove("on")); g.classList.add("on"); play("flip");
      info.innerHTML = ""; info.append(h("div", { class: "card stack", style: { boxShadow: "none" } }, h("div", { class: "eyebrow" }, `Link ${i + 1} · ${L.t}`), h("div", null, L.txt), zh(L.z, true)));
      if (!g.dataset.seen) { g.dataset.seen = "1"; opened++; if (opened === links.length) finish(); }
    };
    g.addEventListener("click", open);
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    svg.append(g);
  });
  function finish() {
    ww.style.opacity = 1; play("win");
    el.append(P("Together: WWII (1939–1945) was not caused by a single event, but by a combination of long-term problems and short-term triggers.", "總結：二戰不是單一事件造成，而是長期問題加上短期導火線。", "lead"));
    done();
  }
  el.append(P("Tap the numbered arrows to see how the four factors connect.", "點擊編號箭咀，看四大因素如何互相關連。", "note"), h("div", { class: "cmap" }, svg), info);
}

/* ---------- 站末小測 ---------- */
function checkpointScene(ch, n, title, z) {
  return {
    t: title || "Checkpoint", z: z || "站末小測", run(el, done) {
      const pool = ch.check === "all" ? FACTS.filter(f => f.mc || f.ev) : ch.check.map(id => BY[id]);
      const N = n || 5;
      let qs, k, score;
      const prog = h("span", { class: "eyebrow" });
      const box = h("div", { class: "stack" });
      el.append(P(ch.check === "all" ? "10 questions from every stop. Score 8 or more to earn the “Exam ready” badge." : "Quick questions on this stop. Every answer updates your mastery.", ch.check === "all" ? "從全部站點抽 10 題，答對 8 題或以上可得「Exam ready」徽章。" : "本站小測，答題結果會更新掌握程度。", "note"), prog, box);
      function start() { qs = wsample(pool, Math.min(N, pool.length)); k = 0; score = 0; ask(); }
      function ask() {
        prog.textContent = `Question ${k + 1} of ${qs.length}`;
        box.innerHTML = "";
        box.append(mcqWidget(mcqFrom(qs[k]), (ok, b) => {
          if (ok) { score++; addXP(10, b); }
          const nb = h("button", { class: "btn primary", type: "button" }, k + 1 < qs.length ? "Next question →" : "See my result");
          nb.onclick = () => { k++; k < qs.length ? ask() : finish(); };
          box.append(h("div", { class: "row end" }, nb));
        }));
      }
      function finish() {
        const r = score / qs.length;
        const stars = r >= 0.9 ? 3 : r >= 0.7 ? 2 : r >= 0.4 ? 1 : 0;
        const st = S.ch[ch.id];
        st.stars = Math.max(st.stars || 0, stars); save();
        prog.textContent = "Result";
        box.innerHTML = "";
        box.append(h("div", { class: "card stack", style: { textAlign: "center", alignItems: "center" } },
          h("div", { class: "h-display", style: { fontSize: "3.4rem" } }, `${score}/${qs.length}`),
          h("div", { class: "stars", style: { fontSize: "1.8rem" } }, [0, 1, 2].map(i => h("span", { class: i < stars ? "on" : "" }, "★"))),
          P(stars === 3 ? "Excellent! You know this stop well." : stars >= 1 ? "Good work. Your mistakes go to the Mistake book for extra practice." : "Keep going – the questions you missed will come back more often.",
            stars === 3 ? "非常好！" : stars >= 1 ? "做得好，錯題已加入錯題本。" : "繼續努力，答錯的題目會更常出現。"),
          h("div", { class: "row", style: { justifyContent: "center" } }, h("button", { class: "btn", type: "button", onclick: () => start() }, "Try again ", zh("再試")))));
        if (stars === 3) { award("perfect"); confetti(80); play("win"); }
        if (ch.check === "all" && score >= 8) award("ready");
        done();
      }
      start();
    }
  };
}

/* =====================================================================
   章節（路線圖上的每一站）
   ===================================================================== */
const CHAPTERS = [
  { id: "intro", stop: "Start", title: "Why another war?", zh: "為何再次開戰？", when: "1939–1945", check: ["q1", "q2", "q3", "q4", "q5"], n: 4,
    scenes: [{ t: "Just 20 years later", z: "僅僅 20 年後", run: sceneIntro }, { t: "Four major factors", z: "四大因素", run: sceneFactors }] },
  { id: "gd", stop: "Stop 1", title: "The Great Depression", zh: "大蕭條", when: "1929", check: ["q6", "q7", "q9", "q11", "q12", "q13", "q14", "q15", "q16", "q17"],
    scenes: [{ t: "Boom: the US in the 1920s", z: "1920 年代美國的繁榮", run: sceneBoom }, { t: "Crash! Late October 1929", z: "1929 年 10 月底：股災", run: sceneCrash },
      { t: "The domino effect", z: "骨牌效應", run: sceneDomino }, { t: "Economic and political impacts", z: "經濟及政治影響", run: sceneImpacts }, { t: "Diplomatic impacts", z: "外交影響", run: sceneDiplomatic }] },
  { id: "tot", stop: "Stop 2", title: "Rise of Totalitarianism", zh: "極權主義興起", when: "1920s–1930s", check: ["q18", "q19", "q20", "q21", "q22", "q24", "q25", "q26"],
    scenes: [{ t: "Total control", z: "全面控制", run: sceneControl }, { t: "Three regimes", z: "三個極權政權", run: sceneRegimes }] },
  { id: "ita", stop: "Stop 3", title: "Italy: Fascism", zh: "意大利法西斯主義", when: "1919", check: ["q27", "q28", "q29", "q30", "q31", "q32", "q33", "q34", "q35"],
    scenes: [{ t: "Wanted: a strong leader", z: "渴望強人", run: sceneMeter }, { t: "Fascism inside and outside", z: "法西斯主義：對內與對外", run: sceneFascism }] },
  { id: "ger", stop: "Stop 4", title: "Germany: Nazism", zh: "德國納粹主義", when: "1929–1934", check: ["q36", "q38", "q39", "q40", "q41", "q42", "q43", "q44"],
    scenes: [{ t: "Hitler's staircase to power", z: "希特拉的上台階梯", run: sceneStairs }, { t: "Who promised what?", z: "誰的主張？", run: scenePromises }] },
  { id: "jap", stop: "Stop 5", title: "Japan: Militarism", zh: "日本軍國主義", when: "1931–1932", check: ["q45", "q46", "q47", "q48", "q49", "q52", "q53", "q54", "q55", "q56"],
    scenes: [{ t: "Tug of war for Japan", z: "日本的拔河", run: sceneTug }, { t: "Five features of militarism", z: "軍國主義五大特徵", run: sceneFeatures }] },
  { id: "agg", stop: "Stop 6", title: "Aggression in the 1930s", zh: "1930 年代的侵略", when: "1931–1939", check: ["q58", "q59", "q60", "q61", "q62", "q63", "q64", "q65", "q66", "q67", "q68", "q69", "q70"],
    scenes: [{ t: "Year by year", z: "逐年看侵略", run: sceneScrub }, { t: "Germany's six moves", z: "德國六步擴張", run: sceneGermany },
      { t: "Japan in China", z: "日本侵華", run: sceneJapan }, { t: "Italy's expansion", z: "意大利的擴張", run: sceneItaly }] },
  { id: "axis", stop: "Stop 7", title: "The Axis Powers", zh: "軸心國", when: "1936–1940", check: ["q71", "q72", "q73", "q74", "q75"], n: 4,
    scenes: [{ t: "Build the Axis", z: "砌出軸心", run: sceneAxis }, { t: "Which pact?", z: "配對條約", run: scenePacts }] },
  { id: "lon", stop: "Stop 8", title: "The League of Nations", zh: "國際聯盟", when: "1920s–1930s", check: ["q76", "q78", "q79", "q80", "q82", "q84", "q85", "q86", "q90", "q91", "q93", "q95", "q96", "q97"],
    scenes: [{ t: "Collective security", z: "集體安全", run: sceneLeague }, { t: "Why so weak?", z: "為何軟弱？", run: sceneShield },
      { t: "Case files", z: "案件檔案", run: sceneCases }, { t: "The result", z: "結果", run: sceneResult }] },
  { id: "app", stop: "Stop 9", title: "Appeasement", zh: "綏靖政策", when: "1930s", check: ["q98", "q99", "q100", "q101"], n: 4,
    scenes: [{ t: "Why give in?", z: "為何讓步？", run: sceneScale }, { t: "Munich, 1938", z: "慕尼黑，1938", run: sceneMunich }] },
  { id: "final", stop: "Finish", title: "The big picture", zh: "總結：四大因素", when: "All", check: "all", n: 10, final: true,
    scenes: [{ t: "How the factors connect", z: "四大因素如何關連", run: sceneMap }] }
];
CHAPTERS.forEach(c => { c.allScenes = [...c.scenes, c.final ? checkpointScene(c, 10, "Final mission", "最終任務") : checkpointScene(c, c.n || 5)]; });
const chState = id => S.ch[id] || (S.ch[id] = { seen: 0, sd: [], stars: 0, done: false });

/* ---------- 路線圖（溫習區主頁）---------- */
function renderReviewHome() {
  const v = clearView();
  const doneN = CHAPTERS.filter(c => S.ch[c.id] && S.ch[c.id].done).length;
  const stars = CHAPTERS.reduce((a, c) => a + ((S.ch[c.id] && S.ch[c.id].stars) || 0), 0);
  const next = CHAPTERS.find(c => !(S.ch[c.id] && S.ch[c.id].done));
  const go = next ? () => openChapter(next.id, (S.ch[next.id] && S.ch[next.id].seen) || 0) : () => setZone("quiz");
  v.append(h("section", { class: "hero" },
    h("div", { class: "years", "aria-hidden": "true" }, "1929–39"),
    h("div", { class: "eyebrow", style: { color: "inherit", opacity: .7 } }, "Review zone · 溫習區"),
    h("h1", null, "The road to ", h("em", null, "WWII")),
    P("Walk the route stop by stop: interactive pages, quick checks along the way, and a checkpoint at every stop.", "沿路逐站溫習：每站都有互動頁面、沿途小測和站末小測。"),
    h("div", { class: "hero-stats" },
      h("div", null, h("b", null, `${doneN}/${CHAPTERS.length}`), "stops"),
      h("div", null, h("b", null, stars), "stars"),
      h("div", null, h("b", null, S.xp), "XP")),
    h("div", { class: "row" }, h("button", { class: "btn primary big", type: "button", onclick: go },
      next ? (doneN || (S.ch[next.id] && S.ch[next.id].seen) ? `Continue: ${next.title}` : "Start the route") : "Route complete – go to Quiz zone", " →"))));
  const route = h("div", { class: "route" });
  CHAPTERS.forEach(c => {
    const st = S.ch[c.id];
    const isDone = st && st.done, isNext = next && next.id === c.id;
    route.append(h("button", { class: "station" + (isDone ? " done" : "") + (isNext ? " next" : ""), type: "button", onclick: () => openChapter(c.id, 0) },
      h("div", { class: "num" }, `${c.stop} · ${c.when}`),
      h("h3", null, c.title),
      zh(c.zh, true),
      h("div", { class: "meta" },
        h("div", { class: "stars", "aria-label": `${(st && st.stars) || 0} of 3 stars` }, [0, 1, 2].map(i => h("span", { class: st && st.stars > i ? "on" : "" }, "★"))),
        h("span", { class: "tag" }, isDone ? "Done 完成" : st && st.seen ? "In progress" : `${c.allScenes.length} pages`))));
  });
  v.append(route,
    h("div", { class: "card", style: { marginTop: "18px" } }, h("div", { class: "eyebrow" }, "Badges 徽章"),
      h("div", { class: "badges" }, BADGES.map(b => h("div", { class: "badge" + (S.badges[b.id] ? " got" : ""), title: b.z }, h("i", null, b.n), h("span", null, b.en, " ", zh(b.z)))))));
}

/* ---------- 打開一站 ---------- */
function openChapter(cid, idx) {
  const ch = CHAPTERS.find(c => c.id === cid);
  const st = chState(cid);
  const scenes = ch.allScenes;
  idx = Math.max(0, Math.min(idx || 0, scenes.length - 1));
  st.seen = Math.max(st.seen || 0, idx); save();
  const v = clearView();
  const sc = scenes[idx];
  const isLast = idx === scenes.length - 1;
  const nextBtn = h("button", { class: "btn primary", type: "button" }, isLast ? "Finish this stop ✓" : "Next →");
  const backBtn = h("button", { class: "btn ghost", type: "button" }, idx ? "← Back" : "← Map");
  backBtn.onclick = () => idx ? openChapter(cid, idx - 1) : setZone("review");
  nextBtn.onclick = () => {
    if (!isLast) return openChapter(cid, idx + 1);
    finishChapter(ch);
  };
  // 本頁完成：Next 發光＋第一次完成加 XP
  const done = () => {
    nextBtn.classList.add("pulse");
    const key = String(idx);
    if (!st.sd.includes(key)) { st.sd.push(key); save(); addXP(5, nextBtn); }
  };
  const body = h("div", { class: "stack lg" });
  v.append(
    h("div", { class: "chap-head" },
      h("button", { class: "iconbtn", type: "button", "aria-label": "Back to the route map", onclick: () => setZone("review") }, "←"),
      h("div", { class: "t" }, h("div", { class: "eyebrow" }, `${ch.stop} · ${ch.title}`), h("div", { class: "dots", "aria-label": `Page ${idx + 1} of ${scenes.length}` }, scenes.map((_, i) => h("i", { class: i === idx ? "cur" : i <= st.seen ? "seen" : "" }))))),
    h("section", { class: "card scene" },
      h("div", { class: "stack lg" }, h("div", null, h("div", { class: "eyebrow" }, `Page ${idx + 1} of ${scenes.length}`), h("h3", { class: "st" }, sc.t), zh(sc.z, true)), body)),
    h("div", { class: "scene-foot" }, backBtn, nextBtn));
  sc.run(body, done);
}
function finishChapter(ch) {
  const st = chState(ch.id);
  const first = !st.done;
  st.done = true; save();
  if (first) {
    addXP(20);
    play("win"); confetti(100);
    const n = CHAPTERS.filter(c => S.ch[c.id] && S.ch[c.id].done).length;
    award("first"); if (n >= 5) award("half"); if (n === CHAPTERS.length) award("all");
    toast(`Stamp collected: ${ch.title} ✓`);
  }
  setZone("review");
}

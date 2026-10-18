"use strict";
const D = window.DATA;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (n) => (n ?? 0).toLocaleString("en-US");
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : "0.0") + "%";
const FAM = D.fams.map(([id, n, kind], i) => ({ id, n, kind, i }));
const ST = D.ST;
const ST_SHORT = ["rev", "rev-latest", "alias", "conflict", "src-only", "no-spec"];
const ST_COL = ["#007000", "#6aa86a", "#bbbbbb", "#b00000", "#c08000", "#e07070"];
const BK = D.BUCK;
const BK_LBL = { enable: "stateen/misa", vcfg: "vl/vtype/vstart", vmask: "v0 mask", vfixed: "vxsat/vxrm", frm: "frm", fflags: "fflags", ctx: "FS/VS dirty", pc: "pc", xreg: "implicit GPR", resv: "LR/SC reservation", csr: "CSR", vendor: "vendor state", mem: "memory", other: "other" };
const EXI = new Map(D.ext.map((e, i) => [e.n, i]));
const INI = new Map(D.ins.map((x, i) => [x.m, i]));
// var tuple accessors
const V = D.var.map((t, i) => ({ i, r: t[0], ins: t[1], e: t[2], w: t[3], mask: t[4], match: t[5], L: t[6], pc: t[7], any: t[8], none: t[9], xl: t[10], o: t[11], in: t[12], f: t[13], uses: t[14], defs: t[15], syn: t[16], ov: t[17], nov: t[18] }));
const varsOfExt = (() => { const m = D.ext.map(() => []); V.forEach((v) => v.e.forEach((e) => m[e].push(v.i))); return m; })();
const insOfExt = (() => { const m = D.ext.map(() => []); D.ins.forEach((x, i) => x.e.forEach((e) => m[e].push(i))); return m; })();
const famOfVar = (v) => [...new Set(v.e.map((e) => D.ext[e].f))];
const extLink = (i) => `<a href="#/ext/${encodeURIComponent(D.ext[i].n)}">${esc(D.ext[i].n)}</a>`;
const insLink = (m) => `<a href="#/ins/${encodeURIComponent(m)}">${esc(m)}</a>`;
const famLink = (f) => `<a href="#/extensions?q=fam:${FAM[f].id}">${esc(FAM[f].n)}</a>`;
const dim = (s) => `<span class="dim">${s}</span>`;
const num = (n) => (n ? fmt(n) : dim("-"));
const hex = (h) => parseInt(h, 16);

// ---------- small visual primitives ----------
function stbar(st, w = 64) {
  const t = st.reduce((a, b) => a + b, 0);
  if (!t) return dim("-");
  let x = 0, out = "";
  st.forEach((n, i) => { if (!n) return; const ww = (n / t) * w; out += `<rect x="${x.toFixed(2)}" width="${ww.toFixed(2)}" height="8" fill="${ST_COL[i]}"/>`; x += ww; });
  const title = st.map((n, i) => n ? `${ST[i]}: ${n}` : "").filter(Boolean).join("\n");
  return `<svg class="bar" width="${w}" height="8"><title>${esc(title)}</title>${out}</svg>`;
}
function hbar(n, max, w = 80, col = "#555") {
  const ww = max ? Math.max(n ? 1 : 0, (n / max) * w) : 0;
  return `<svg class="bar" width="${w}" height="8"><rect width="${w}" height="8" fill="#eee"/><rect width="${ww.toFixed(1)}" height="8" fill="${col}"/></svg>`;
}
function heat(n, max, red = false, title = "") {
  if (!n) return `<td class="h">${dim("·")}</td>`;
  const a = 0.08 + 0.85 * Math.sqrt(n / max);
  const bg = red ? `rgba(176,0,0,${a.toFixed(2)})` : `rgba(0,0,0,${a.toFixed(2)})`;
  return `<td class="h" style="background:${bg};color:${a > 0.5 ? "#fff" : "#000"}"${title ? ` title="${esc(title)}"` : ""}>${fmt(n)}</td>`;
}
// bit strip of a layout; with a variant, fixed bits show their values.
// Every bit is BIT px wide and borders sit inside each segment, so strips of equal width are equal length.
const BIT = 11, FONT = 9;
const charW = (() => { const c = document.createElement("canvas").getContext("2d"); c.font = FONT + "px monospace"; return c.measureText("0").width; })();
const ABBR = [[/^uimm/, "u"], [/^simm/, "s"], [/^imm/, "i"], [/^shamt/, "sh"], [/^rlist/, "rl"], [/^stackadj/, "sa"], [/^vtype/, "vt"], [/^funct/, "f"], [/^opcode/, "op"]];
function fitLabel(name, px) {
  const room = (s) => s.length * charW <= px - 3;
  const m = name.match(/^([^\[]+)(\[(\d+)(?::(\d+))?\])?$/);
  const base = m ? m[1] : name, slice = m && m[2] ? (m[4] != null ? m[3] + ":" + m[4] : m[3]) : "";
  let short = base; for (const [re, to] of ABBR) short = short.replace(re, to);
  const tries = slice ? [name, base + " " + slice, short + " " + slice, base, short] : [name, short];
  for (const t of tries) if (room(t)) return { text: t, abbr: t !== name };
  for (let n = short.length - 1; n >= 1; n--) if (room(short.slice(0, n))) return { text: short.slice(0, n), abbr: true };
  return { text: "", abbr: true };
}
function bitstrip(L, v) {
  const lay = D.lay[L];
  const mt = v ? BigInt("0x" + v.match) : 0n;
  let out = "";
  lay.s.forEach(([hi, lo, name], j) => {
    const n = hi - lo + 1, px = n * BIT, left = (lay.w - 1 - hi) * BIT;
    let text = "", abbr = false;
    if (name === "F") { if (v) { for (let b = hi; b >= lo; b--) text += (mt >> BigInt(b)) & 1n ? "1" : "0"; if (!(text.length * charW <= px - 2)) { text = ""; abbr = true; } } }
    else ({ text, abbr } = fitLabel(name, px));
    const tip = `${hi === lo ? hi : hi + ":" + lo} ${name === "F" ? "fixed" + (v ? " " + [...Array(n)].map((_, k) => ((mt >> BigInt(hi - k)) & 1n ? "1" : "0")).join("") : "") : name}`;
    out += `<span class="${name === "F" ? "F" : "v"}${abbr && text ? " ab" : ""}${j === lay.s.length - 1 ? " last" : ""}" style="left:${left}px;width:${px}px" title="${esc(tip)}">${esc(text)}</span>`;
  });
  return `<span class="bs" style="width:${lay.w * BIT}px">${out}</span>`;
}
function chips(list, map) { return list.map((b) => `<span class="chip">${esc(map ? map[b] : b)}</span>`).join(""); }
function sortable(id) {
  const t = document.getElementById(id); if (!t) return;
  t.querySelectorAll("th[data-k]").forEach((th) => {
    th.classList.add("sortable");
    th.addEventListener("click", () => {
      const k = +th.dataset.k, body = t.tBodies[0], rows = [...body.rows];
      const dir = th.dataset.dir === "d" ? "a" : "d"; th.dataset.dir = dir;
      const val = (r) => { const c = r.cells[k]; const s = c?.dataset.v ?? c?.textContent ?? ""; const n = parseFloat(s.replace(/,/g, "")); return isNaN(n) || s === "" || s === "-" ? (s === "-" || s === "·" ? -1 : s) : n; };
      rows.sort((a, b) => { const x = val(a), y = val(b); const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y)); return dir === "d" ? -c : c; });
      rows.forEach((r) => body.appendChild(r));
    });
  });
}
function lineChart(series, { w = 620, h = 200, xmax, ymax, xlabel = "", ylabel = "", marks = [] }) {
  const px = (x) => 40 + Math.sqrt(x / xmax) * (w - 50), py = (y) => h - 24 - (y / ymax) * (h - 36);
  let g = `<line x1="40" y1="${py(0)}" x2="${w - 10}" y2="${py(0)}" stroke="#999"/><line x1="40" y1="${py(0)}" x2="40" y2="${py(ymax)}" stroke="#999"/>`;
  for (let t = 0; t <= 4; t++) { const y = (ymax * t) / 4; g += `<text x="36" y="${py(y) + 3}" text-anchor="end">${t * 25}%</text><line x1="40" x2="${w - 10}" y1="${py(y)}" y2="${py(y)}" stroke="#eee"/>`; }
  for (const x of [1, 5, 10, 20, 30, 50, 77, 120, xmax].filter((x) => x <= xmax)) g += `<text x="${px(x)}" y="${h - 10}" text-anchor="middle">${x}</text>`;
  for (const s of series) g += `<polyline fill="none" stroke="${s.col}" stroke-width="1.5" points="${s.pts.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(" ")}"/>`;
  for (const m of marks) g += `<circle cx="${px(m.x)}" cy="${py(m.y)}" r="2.5" fill="${m.col}"/><text x="${px(m.x) + 5}" y="${py(m.y) + (m.up ? -5 : 12)}" fill="${m.col}">${esc(m.t)}</text>`;
  g += `<text x="${w - 10}" y="${h - 22}" text-anchor="end">${esc(xlabel)} (√ scale)</text>`;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${g}</svg>`;
}

// ---------- shared aggregates ----------
const TOT = D.frag.encoded;
const OPN = ["LOAD", "LOAD-FP", "custom-0", "MISC-MEM", "OP-IMM", "AUIPC", "OP-IMM-32", "48b", "STORE", "STORE-FP", "custom-1", "AMO", "OP", "LUI", "OP-32", "64b", "MADD", "MSUB", "NMSUB", "NMADD", "OP-FP", "OP-V", "custom-2", "48b", "BRANCH", "JALR", "reserved", "JAL", "SYSTEM", "OP-VE", "custom-3", "≥80b"];
function opcodeOf(v) {
  const m = hex(v.mask) , mt = hex(v.match);
  if (v.w === 16) { if ((m & 3) !== 3 || ((m >> 13) & 7) !== 7) return "C ?"; return `C${mt & 3} f3=${(mt >> 13) & 7}`; }
  if (v.w === 32) { if ((m & 0x7f) !== 0x7f) return "? (opcode not fixed)"; return OPN[(mt >> 2) & 31]; }
  return v.w + "-bit";
}
const C_NAMES = { "C0 f3=0": "c.addi4spn", "C0 f3=1": "c.fld|c.lq", "C0 f3=2": "c.lw", "C0 f3=3": "c.flw|c.ld", "C0 f3=4": "reserved/Zcb", "C0 f3=5": "c.fsd|c.sq", "C0 f3=6": "c.sw", "C0 f3=7": "c.fsw|c.sd", "C1 f3=0": "c.addi", "C1 f3=1": "c.jal|c.addiw", "C1 f3=2": "c.li", "C1 f3=3": "c.lui/addi16sp", "C1 f3=4": "MISC-ALU", "C1 f3=5": "c.j", "C1 f3=6": "c.beqz", "C1 f3=7": "c.bnez", "C2 f3=0": "c.slli", "C2 f3=1": "c.fldsp|c.lqsp", "C2 f3=2": "c.lwsp", "C2 f3=3": "c.flwsp|c.ldsp", "C2 f3=4": "c.jr/mv/add", "C2 f3=5": "c.fsdsp|c.sqsp", "C2 f3=6": "c.swsp", "C2 f3=7": "c.fswsp|c.sdsp" };

// ---------- pages ----------
const PAGES = {};
PAGES.index = () => {
  const m = D.man;
  const top10 = D.cum[9], top30 = D.cum[29], m20 = D.mcum[19];
  const pts = D.cum.map((c, i) => [i + 1, c]); pts.unshift([0, 0]);
  const mpts = D.mcum.map((c, i) => [i + 1, c]); mpts.unshift([0, 0]);
  return `
<h3>RISC-V MC instruction survey: data for a TableGen-style JIT description</h3>
<p>Snapshot ${esc(m.date)} · LLVM <a href="https://github.com/llvm/llvm-project/commit/${m.llvm}">${m.llvm.slice(0, 12)}</a> · GNU Binutils ${esc(m.gnuv)} <a href="https://gnu.googlesource.com/binutils-gdb/+/${m.gnu}">${m.gnu.slice(0, 12)}</a>.
The question each page answers: how much of RISC-V encoding, operand typing, availability and implicit state is <i>shared structure</i> a generator can exploit, and how much is genuine fragmentation that has to be described explicitly.</p>
<h4>Coverage of LLVM encoding records by the N most used layouts / fixed-bit masks</h4>
${lineChart([{ pts, col: "#000" }, { pts: mpts, col: "#b00000" }], { xmax: D.lay.length, ymax: TOT, xlabel: "N most used", marks: [{ x: 10, y: top10, col: "#000", t: `10 layouts: ${pct(top10, TOT)}` }, { x: 20, y: m20, col: "#b00000", t: `20 masks: ${pct(m20, TOT)}`, up: true }, { x: 30, y: top30, col: "#000", t: `30 layouts: ${pct(top30, TOT)}` }] })}
<p class="legend"><span class="item"><span class="key" style="background:#000"></span>field layouts (${D.lay.length})</span><span class="item"><span class="key" style="background:#b00000"></span>fixed-bit masks (${D.frag.masks})</span></p>
<p>A layout is the exact sequence of operand fields and fixed-bit runs (e.g. <code>funct7 | rs2 | rs1 | funct3 | rd | opcode</code>). A mask ignores field names and keeps only which bits are fixed. Only LLVM records carry bit-level encodings in this survey; GNU's MATCH/MASK macros are not resolved, so GNU-only instructions (${fmt(D.frag.gnu_only)}) are absent from every encoding statistic.</p>
`;
};

function famTable(compact) {
  const mx = Math.max(...D.famr.map((f) => f.ni));
  const rows = D.famr.map((f, i) => `<tr>
<td class="l">${famLink(i)}</td><td class="l">${f.kind === "vendor" ? '<span class="tp">vendor</span>' : f.kind === "priv" ? "priv" : "std"}</td>
<td>${f.ne}</td><td>${num(f.ni)}</td><td class="l">${hbar(f.ni, mx, 60)}</td>
<td>${num(f.nl)}</td><td>${num(f.ng)}</td><td>${num(f.both)}</td>
<td>${num(f.nv)}</td><td>${num(f.nL)}</td><td>${num(f.nM)}</td><td data-v="${f.nv ? f.sh / f.nv : -1}">${f.nv ? pct(f.sh, f.nv) : dim("-")}</td>
<td data-v="${f.ov}">${f.ov ? `<span class="${f.ov / f.nv > 0.5 ? "fp" : ""}">${fmt(f.ov)}</span>` : dim("-")}</td><td data-v="${f.nv ? f.ov / f.nv : -1}">${f.nv ? pct(f.ov, f.nv) : dim("-")}</td>
<td>${num(f.mx)}</td><td>${num(f.xl)}</td><td>${num(f.none)}</td>
${compact ? "" : `<td>${num(f.w[0])}</td><td>${num(f.w[1])}</td><td>${num(f.w[2] + f.w[3])}</td>`}
<td class="l">${stbar(f.st)}</td><td>${num(f.oi)}</td></tr>`).join("");
  return `<div class="wide"><table id="t-fam${compact ? "c" : ""}">
<tr><th class="l" data-k="0">Family</th><th class="l" data-k="1">Kind</th><th data-k="2">Ext</th><th data-k="3">Mnem</th><th></th>
<th data-k="5" title="spellings with an LLVM record">LLVM</th><th data-k="6" title="spellings with a GNU record">GNU</th><th data-k="7">Both</th>
<th data-k="8" title="LLVM records with bit encodings">Enc rec</th><th data-k="9" title="distinct field layouts">Layouts</th><th data-k="10" title="distinct fixed-bit masks">Masks</th><th data-k="11" title="records whose layout is also used by another family">Shared lay.</th>
<th data-k="12" title="records whose bit pattern overlaps a record from a disjoint extension">Ovl rec</th><th data-k="13">Ovl %</th>
<th data-k="14" title="spellings gated by more than one extension atom">Multi-ext</th><th data-k="15" title="records with an IsRV32/IsRV64 predicate">XLEN</th><th data-k="16" title="records with a none_of predicate">none_of</th>
${compact ? "" : `<th data-k="17">16b</th><th data-k="18">32b</th><th data-k="19">48b+</th>`}
<th class="l">Status</th><th data-k="${compact ? 18 : 21}">Issues</th></tr>
<tbody>${rows}</tbody></table></div>
<p class="hint dim">Status bar: ${ST.map((s, i) => `<span style="color:${ST_COL[i]}">■</span> ${s}`).join(" · ")}. Counts are per family; a spelling gated by several families counts in each.</p>`;
}

PAGES.families = () => {
  const fl = D.fl, mxL = Math.max(...fl.m.flat());
  const famRows = FAM.filter((f) => D.famr[f.i].nv);
  const layHead = fl.lays.map((li, j) => `<th class="rot" title="${esc(D.lay[li].k)}"><div>${esc(D.lay[li].lb || "#" + li)}</div></th>`).join("");
  const layTable = `<div class="wide"><table class="hm"><tr><th class="l">Family \\ layout</th>${layHead}<th>Σ top30</th><th>Rec</th></tr>
${famRows.map((f) => { const r = fl.m[f.i]; const s = r.reduce((a, b) => a + b, 0); return `<tr><td class="l">${famLink(f.i)}</td>${r.map((n) => heat(n, mxL)).join("")}<td>${fmt(s)}</td><td>${fmt(D.famr[f.i].nv)} ${dim("(" + pct(s, D.famr[f.i].nv) + ")")}</td></tr>`; }).join("")}
<tr><td class="l"><b>records</b></td>${fl.lays.map((li) => `<td class="h"><b>${D.lay[li].n}</b></td>`).join("")}<td></td><td></td></tr>
<tr><td class="l"><b>families</b></td>${fl.lays.map((li) => `<td class="h">${D.lay[li].fm.length}</td>`).join("")}<td></td><td></td></tr>
</table></div>`;
  const of = D.of, mxO = Math.max(...of.m.flat());
  const opTable = `<div class="wide"><table class="hm"><tr><th class="l">Family \\ operand class</th>${of.c.map((c) => `<th class="rot"><div>${esc(c)}</div></th>`).join("")}</tr>
${famRows.map((f) => `<tr><td class="l">${famLink(f.i)}</td>${of.m[f.i].map((n) => heat(n, mxO)).join("")}</tr>`).join("")}
<tr><td class="l"><b>records</b></td>${of.n.map((n) => `<td class="h"><b>${fmt(n)}</b></td>`).join("")}</tr></table></div>`;
  return `<h3>Families</h3>
<p>Extensions grouped by prefix. Std: ratified or draft RISC-V; vendor: X* extensions. This is the extension-level comparison: how many records each family adds, how many distinct layouts and masks it needs, and how much of it collides with other families.</p>
${famTable(false)}
<hr /><h4>Family × top-30 field layouts (LLVM records)</h4>
<p>Each column is one layout (hover for the field sequence; see <a href="#/formats">Formats</a>). A column lit across many rows is a format class many families reuse unchanged. A row whose mass sits outside these 30 columns needs bespoke layouts.</p>
${layTable}
<hr /><h4>Family × operand classes (top 40 of ${of.tot})</h4>
${opTable}`;
};

PAGES.extensions = (q) => {
  const rows = D.ext.map((e, i) => ({ e, i }));
  const mx = Math.max(...D.ext.map((e) => e.ni));
  const body = rows.map(({ e, i }) => `<tr data-key="${esc(e.n + " fam:" + FAM[e.f].id + (e.ven ? " vendor" : " std") + (e.x ? " experimental" : "") + " " + e.ds.toLowerCase())}">
<td class="l">${extLink(i)}</td><td class="l">${esc(FAM[e.f].n)}</td><td class="l">${e.ven ? '<span class="tp">V</span>' : ""}${e.x ? '<span class="fp">X</span>' : ""}</td>
<td>${e.lv || dim("-")}</td><td>${e.gv || dim("-")}</td>
<td>${num(e.ni)}</td><td class="l">${hbar(e.ni, mx, 40)}</td><td>${num(e.nl)}</td><td>${num(e.ng)}</td><td data-v="${e.nl - e.both}">${e.nl - e.both ? fmt(e.nl - e.both) : dim("-")}</td><td data-v="${e.ng - e.both}">${e.ng - e.both ? fmt(e.ng - e.both) : dim("-")}</td>
<td>${num(e.nv)}</td><td>${num(e.nL)}</td><td>${num(e.own)}</td>
<td data-v="${e.ov}">${e.ov ? `<span class="${e.ov === e.nv ? "fp" : ""}">${fmt(e.ov)}</span>` : dim("-")}</td>
<td>${num(e.w16)}</td><td>${num(e.w48)}</td><td>${num(e.x32)}</td><td>${num(e.x64)}</td>
<td>${num(e.imp)}</td><td>${e.cf ? `<span class="fp">${e.cf}</span>` : dim("-")}</td>
<td class="l" data-v="${e.st[0] / (e.ni || 1)}">${stbar(e.st, 48)}</td><td>${num(e.oi)}</td>
<td class="l msg small">${chips([...new Set([...e.rd, ...e.wr])].map((b) => BK[b]), BK_LBL)}</td></tr>`).join("");
  return `<h3>Extensions (${D.ext.length})</h3>
<form onsubmit="return false"><label>Filter: <input id="filter" value="${esc(q || "")}" placeholder="name, fam:qc, vendor, experimental, word in description" /></label> <span id="fcount" class="dim"></span></form>
<p class="hint dim">LLVM-only / GNU-only: spellings this extension gates in one toolchain but not the other. Own: layouts used by no other family. Ovl: encoded records that overlap a record of a disjoint extension. V = vendor, X = experimental. Click a header to sort.</p>
<div class="wide"><table id="t-ext"><thead><tr>
<th class="l" data-k="0">Extension</th><th class="l" data-k="1">Family</th><th class="l"></th><th class="l" data-k="3">LLVM v</th><th data-k="4">GNU v</th>
<th data-k="5">Mnem</th><th></th><th data-k="7">LLVM</th><th data-k="8">GNU</th><th data-k="9">L-only</th><th data-k="10">G-only</th>
<th data-k="11">Enc rec</th><th data-k="12">Layouts</th><th data-k="13">Own</th><th data-k="14">Ovl</th>
<th data-k="15">16b</th><th data-k="16">48b+</th><th data-k="17">RV32</th><th data-k="18">RV64</th><th data-k="19">Implies</th><th data-k="20">Conflicts</th><th class="l" data-k="21">Status</th><th data-k="22">Issues</th><th class="l">Implicit state</th>
</tr></thead><tbody>${body}</tbody></table></div>`;
};
function bindFilter(tableId) {
  const inp = $("#filter"), t = document.getElementById(tableId); if (!inp || !t) return;
  const run = () => {
    const terms = inp.value.toLowerCase().trim().split(/\s+/).filter(Boolean); let n = 0;
    for (const r of t.tBodies[0].rows) { const k = (r.dataset.key || "").toLowerCase(); const ok = terms.every((w) => k.includes(w)); r.style.display = ok ? "" : "none"; n += ok; }
    const c = $("#fcount"); if (c) c.textContent = `${n} shown`;
  };
  inp.addEventListener("input", run); run();
}

PAGES.ext = (name) => {
  const i = EXI.get(name); if (i == null) return `<p class="warning">Unknown extension ${esc(name)}</p>`;
  const e = D.ext[i];
  const ins = insOfExt[i].map((k) => D.ins[k]);
  const vs = varsOfExt[i].map((k) => V[k]);
  const partners = new Map();
  for (const v of vs) for (const o of v.ov) for (const pe of V[o].e) partners.set(pe, (partners.get(pe) || 0) + 1);
  const pr = [...partners.entries()].sort((a, b) => b[1] - a[1]);
  const lays = new Map(); vs.forEach((v) => lays.set(v.L, (lays.get(v.L) || 0) + 1));
  const rel = D.rel.filter((r) => r[1] === e.n || r[2].split(",").includes(e.n));
  return `<h3>${esc(e.n)} ${dim("· " + esc(FAM[e.f].n))}</h3>
<p>${esc(e.ds) || dim("no LLVM description")}<br/>LLVM ${e.lv || "-"}${e.x ? ' <span class="fp">experimental</span>' : ""} · GNU ${e.gv || "-"} · ${e.ven ? "vendor" : "standard"} · PDF candidates ${e.pdf} · <a href="#/compare?a=${encodeURIComponent(e.n)}">compare…</a></p>
<table><tr><th>Mnem</th><th>LLVM</th><th>GNU</th><th>Enc rec</th><th>Layouts</th><th>Own</th><th>Ovl rec</th><th>RV32</th><th>RV64</th><th class="l">Status</th><th>Issues</th></tr>
<tr><td>${e.ni}</td><td>${e.nl}</td><td>${e.ng}</td><td>${e.nv}</td><td>${e.nL}</td><td>${e.own}</td><td>${e.ov}</td><td>${e.x32}</td><td>${e.x64}</td><td class="l">${stbar(e.st)}</td><td>${e.oi}</td></tr></table>
<h4>Layouts used</h4>
<table><tr><th>#</th><th class="l">Label</th><th class="l">Fields</th><th>Rec here</th><th>Rec total</th><th>Families</th></tr>
${[...lays.entries()].sort((a, b) => b[1] - a[1]).map(([L, n]) => `<tr><td><a href="#/formats?q=%23${L}">${L}</a></td><td class="l">${esc(D.lay[L].lb)}</td><td class="l">${bitstrip(L)}</td><td>${n}</td><td>${D.lay[L].n}</td><td>${D.lay[L].fm.length}</td></tr>`).join("")}</table>
<h4>Overlapping extensions (bit-pattern)</h4>
${pr.length ? `<table><tr><th class="l">With</th><th class="l">Family</th><th>Records</th><th class="l"></th></tr>${pr.slice(0, 40).map(([pe, n]) => `<tr><td class="l">${extLink(pe)}</td><td class="l">${esc(FAM[D.ext[pe].f].n)}</td><td>${n}</td><td class="l"><a href="#/compare?a=${encodeURIComponent(e.n)}&b=${encodeURIComponent(D.ext[pe].n)}">compare</a></td></tr>`).join("")}</table>` : dim("none")}
<h4>Relations</h4>
${rel.length ? `<table>${rel.map((r) => `<tr><td class="l">${esc(r[0])}</td><td class="l">${esc(r[1])}</td><td class="l">→ ${esc(r[2])}</td><td class="l dim">${esc(r[3])}</td><td class="l msg dim">${esc(r[4])}</td></tr>`).join("")}</table>` : dim("none")}
<h4>Instructions (${ins.length})</h4>
${insTable(insOfExt[i], "t-ei")}`;
};

function insRow(k) {
  const x = D.ins[k];
  const v0 = x.v.length ? V[x.v[0]] : null;
  const ov = x.v.reduce((a, vi) => a + V[vi].nov, 0);
  return `<tr data-key="${esc(x.m + " " + x.e.map((e) => D.ext[e].n + " fam:" + FAM[D.ext[e].f].id).join(" ") + " " + ST[x.s] + " " + x.k.join(" ") + (x.tc === 1 ? " llvm-only" : x.tc === 2 ? " gnu-only" : " both") + (x.oi ? " issue" : "") + (ov ? " overlap" : ""))}">
<td class="l">${insLink(x.m)}</td><td class="l small">${x.e.slice(0, 4).map(extLink).join(" ")}${x.e.length > 4 ? dim(` +${x.e.length - 4}`) : ""}</td>
<td class="l">${x.tc === 3 ? "LG" : x.tc === 1 ? "L" : '<span class="dim">G</span>'}</td><td class="l small">${esc(x.k.map((s) => s.replace("assembler_", "").replace("instruction", "insn")).join(","))}</td>
<td class="l"><span style="color:${ST_COL[x.s]}">${ST_SHORT[x.s]}</span></td><td>${num(x.nl)}</td><td>${num(x.ng)}</td><td>${num(x.ne)}</td>
<td class="l">${v0 ? bitstrip(v0.L, v0) : dim("-")}</td><td data-v="${ov}">${ov ? `<span class="fp">${ov}</span>` : dim("-")}</td>
<td class="l small">${chips(x.rd.map((b) => BK[b]), BK_LBL)}</td><td class="l small">${chips(x.wr.map((b) => BK[b]), BK_LBL)}</td><td>${x.mem ? "M" : ""}</td><td>${x.oi ? `<span class="fp">${x.oi}</span>` : ""}</td></tr>`;
}
function insTable(list, id, limit = 0) {
  const shown = limit ? list.slice(0, limit) : list;
  return `<div class="wide"><table id="${id}"><thead><tr><th class="l" data-k="0">Mnemonic</th><th class="l">Extensions</th><th class="l" data-k="2">TC</th><th class="l" data-k="3">Kind</th><th class="l" data-k="4">Status</th><th data-k="5">#L</th><th data-k="6">#G</th><th data-k="7" title="distinct LLVM encodings">#Enc</th><th class="l">First LLVM encoding (msb → lsb, fixed bits shown)</th><th data-k="9" title="overlapping records of disjoint extensions">Ovl</th><th class="l">Reads</th><th class="l">Writes</th><th data-k="12">Mem</th><th data-k="13">Iss</th></tr></thead>
<tbody>${shown.map(insRow).join("")}</tbody></table></div>`;
}

let INS_KEYS = null;
function insKey(i) {
  const x = D.ins[i];
  const ov = x.v.reduce((a, vi) => a + V[vi].nov, 0);
  return (x.m + " " + x.e.map((e) => D.ext[e].n + " fam:" + FAM[D.ext[e].f].id).join(" ") + " " + ST[x.s] + " " + x.k.join(" ") + (x.tc === 1 ? " llvm-only" : x.tc === 2 ? " gnu-only" : " both") + (x.oi ? " issue" : "") + (ov ? " overlap" : "") + " " + x.rd.map((b) => "r:" + BK[b]).join(" ") + " " + x.wr.map((b) => "w:" + BK[b]).join(" ")).toLowerCase();
}
function bindInsFilter() {
  const inp = $("#filter"), box = $("#ins-box"); if (!inp || !box) return;
  INS_KEYS = INS_KEYS || D.ins.map((_, i) => insKey(i));
  let limit = 400;
  const run = () => {
    const terms = inp.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const hits = []; for (let i = 0; i < D.ins.length; i++) if (terms.every((w) => INS_KEYS[i].includes(w))) hits.push(i);
    box.innerHTML = insTable(hits, "t-ins", limit) + (hits.length > limit ? `<p><a href="javascript:void 0" id="more">show all ${fmt(hits.length)}</a> ${dim("(showing " + limit + ")")}</p>` : "");
    $("#fcount").textContent = `${fmt(hits.length)} match`;
    sortable("t-ins");
    const more = $("#more"); if (more) more.addEventListener("click", () => { limit = 1e9; run(); });
  };
  let tm = 0; inp.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => { limit = 400; run(); }, 120); }); run();
}
PAGES.instructions = (q) => {
  return `<h3>Instructions (${fmt(D.ins.length)} spellings)</h3>
<form onsubmit="return false"><label>Filter: <input id="filter" value="${esc(q || "")}" placeholder="mnemonic, extension, fam:v, conflict, llvm-only, gnu-only, overlap, issue" /></label> <span id="fcount" class="dim"></span></form>
<p class="hint dim">TC: L = LLVM, G = GNU. #Enc: distinct LLVM bit encodings of this spelling. Ovl: number of (record, record) bit-pattern overlaps with records from disjoint extensions. Reads/Writes are the survey's implicit state, bucketed; filter them with r:vcfg, w:fflags, r:vendor … Sorting applies to the rows shown.</p>
<div id="ins-box"></div>`;
};

PAGES.ins = (m) => {
  const k = INI.get(m); if (k == null) return `<p class="warning">Unknown mnemonic ${esc(m)}</p>`;
  const x = D.ins[k];
  const vrows = x.v.map((vi) => {
    const v = V[vi];
    const ovs = v.ov.map((o) => V[o]);
    return `<tr><td class="l">${esc(v.r)}</td><td class="l">${v.e.map(extLink).join(" ")}</td><td>${v.w}</td><td class="l">${bitstrip(v.L, v)}</td><td class="l"><code>${v.mask}/${v.match}</code></td><td class="l">${v.xl === "any" ? dim("any") : "RV" + v.xl}</td>
<td class="l small">${esc(v.o.join(",") || "-")} ← ${esc(v.in.join(","))}</td><td class="l small">${["ld", "st", "se", "br"].filter((_, b) => v.f & (1 << b)).join(" ")} ${esc([...v.uses.map((u) => "use:" + u), ...v.defs.map((d) => "def:" + d)].join(" "))}</td>
<td class="l small">${ovs.length ? ovs.slice(0, 8).map((o) => `${o.ins >= 0 ? insLink(D.ins[o.ins].m) : esc(o.r)} ${dim("(" + o.e.map((e) => D.ext[e].n).join("|") + ")")}`).join("<br/>") + (ovs.length > 8 ? dim(`<br/>+${ovs.length - 8} more`) : "") : dim("-")}</td></tr>`;
  }).join("");
  const iss = D.oi.filter((o) => o.m === m);
  return `<h3>${esc(x.m)}</h3>
<p>${x.e.map(extLink).join(" | ")} · ${x.tc === 3 ? "LLVM + GNU" : x.tc === 1 ? "LLVM only" : "GNU only"} · ${esc(x.k.join(", "))} · <span style="color:${ST_COL[x.s]}">${ST[x.s]}</span>${x.sg.length ? " · similarity: " + x.sg.map((s) => `<a href="#/notes">${esc(s)}</a>`).join(" ") : ""}</p>
<p>${esc(x.d)}</p>
<h4>LLVM records (${x.v.length})</h4>
${x.v.length ? `<div class="wide"><table><tr><th class="l">Record</th><th class="l">Predicate atoms</th><th>Bits</th><th class="l">Encoding</th><th class="l">mask/match</th><th class="l">XLEN</th><th class="l">Operands (out ← in)</th><th class="l">Flags</th><th class="l">Overlaps with</th></tr>${vrows}</table></div>` : dim("none with a bit encoding")}
${window.ISEL_INS ? ISEL_INS(m) : ""}
<h4>GNU syntax</h4>${x.gs.length ? x.gs.map((s) => `<code>${esc(s)}</code>`).join("<br/>") : dim("none")}
<h4>Implicit state</h4><p>reads ${chips(x.rd.map((b) => BK[b]), BK_LBL) || dim("-")} · writes ${chips(x.wr.map((b) => BK[b]), BK_LBL) || dim("-")} · memory ${x.mem ? "yes" : "no"}</p>
${x.u.length ? `<h4>Remaining uncertainties</h4><ul>${x.u.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>` : ""}
${iss.length ? `<h4>Open issues</h4>${iss.map((o) => `<div class="warning">${esc(o.s)}: ${esc(o.u)}</div>`).join("")}` : ""}`;
};

PAGES.formats = (q) => {
  const order = D.lay.map((l, i) => i).sort((a, b) => D.lay[b].n - D.lay[a].n);
  let cum = 0;
  const rows = order.map((li, rank) => {
    const l = D.lay[li]; cum += l.n;
    const extCount = new Map(); l.e.forEach((e) => 0);
    const top = (() => { const c = new Map(); for (const vi of V.filter((v) => v.L === li).map((v) => v.i)) for (const e of V[vi].e) c.set(e, (c.get(e) || 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1]); })();
    return `<tr data-key="${esc("#" + li + " " + l.lb + " " + l.k + " " + top.map(([e]) => D.ext[e].n).join(" ") + " " + l.fm.map((f) => "fam:" + FAM[f].id).join(" "))}">
<td>${rank + 1}</td><td>${li}</td><td class="l">${esc(l.lb) || dim("-")}</td><td>${l.w}</td><td class="l">${bitstrip(li)}</td><td>${l.n}</td><td>${pct(cum, TOT)}</td><td>${top.length}</td><td>${l.fm.length}</td>
<td class="l small">${top.slice(0, 8).map(([e, n]) => `${extLink(e)}${dim(":" + n)}`).join(" ")}${top.length > 8 ? dim(` +${top.length - 8}`) : ""}</td></tr>`;
  }).join("");
  const byFam = new Map(); D.lay.forEach((l) => { const k = l.fm.length; byFam.set(k, (byFam.get(k) || 0) + 1); });
  const single = D.lay.filter((l) => l.fm.length === 1), singleRec = single.reduce((a, l) => a + l.n, 0);
  return `<h3>Formats: ${D.lay.length} field layouts over ${fmt(TOT)} LLVM encoding records</h3>
<p>${single.length} layouts (${pct(single.length, D.lay.length)}) are used by a single family, but they hold only ${fmt(singleRec)} records (${pct(singleRec, TOT)}). Layouts by number of families using them: ${[...byFam.entries()].sort((a, b) => a[0] - b[0]).map(([k, n]) => `${k}→${n}`).join(", ")}.
A bespoke layout is cheap in a table (one class) and expensive in a hand-written emitter (a new code path per extension).</p>
<form onsubmit="return false"><label>Filter: <input id="filter" value="${esc(q || "")}" placeholder="field (vm, frm, rd[4:1]), extension, fam:p, #id" /></label> <span id="fcount" class="dim"></span></form>
<div class="wide"><table id="t-lay"><thead><tr><th data-k="0">Rank</th><th data-k="1">#</th><th class="l" data-k="2">Label</th><th data-k="3">Bits</th><th class="l">Fields (msb → lsb; gray = fixed; dotted = shortened, hover for full name)</th><th data-k="5">Rec</th><th data-k="6">Cum</th><th data-k="7">Ext</th><th data-k="8">Fam</th><th class="l">Top extensions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
};

PAGES.overlap = (q) => {
  const mx = Math.max(...D.fo.flat());
  const famRows = FAM.filter((f) => D.famr[f.i].nv);
  const cls = (a, b) => { const ka = FAM[D.ext[a].f].kind === "vendor", kb = FAM[D.ext[b].f].kind === "vendor"; return ka && kb ? "vendor×vendor" : ka || kb ? "std×vendor" : D.ext[a].f === D.ext[b].f ? "std same-family" : "std×std"; };
  const classes = new Map(); D.pairs.forEach((p) => { const c = cls(p[0], p[1]); const o = classes.get(c) || [0, 0, 0]; o[0]++; o[1] += p[2]; o[2] += p[5]; classes.set(c, o); });
  const rows = D.pairs.map((p) => `<tr data-key="${esc(D.ext[p[0]].n + " " + D.ext[p[1]].n + " fam:" + FAM[D.ext[p[0]].f].id + " fam:" + FAM[D.ext[p[1]].f].id + " " + cls(p[0], p[1]) + (p[5] ? " declared" : " undeclared"))}">
<td class="l">${extLink(p[0])}</td><td class="l dim">${esc(FAM[D.ext[p[0]].f].n)}</td><td class="l">${extLink(p[1])}</td><td class="l dim">${esc(FAM[D.ext[p[1]].f].n)}</td><td>${p[2]}</td><td class="l">${esc(cls(p[0], p[1]))}</td><td class="l">${p[5] ? '<span class="tp">declared</span>' : dim("not declared")}</td><td class="l small"><code>${esc(p[3])}</code> ≈ <code>${esc(p[4])}</code></td><td class="l"><a href="#/compare?a=${encodeURIComponent(D.ext[p[0]].n)}&b=${encodeURIComponent(D.ext[p[1]].n)}">compare</a></td></tr>`).join("");
  return `<h3>Encoding overlap between extensions</h3>
<p>Two LLVM records overlap when every bit both fix agrees: <code>(maskA &amp; maskB) &amp; (matchA ^ matchB) == 0</code>. Pairs where one is RV32-only and the other RV64-only are excluded, as are pairs that share an extension atom (aliases and hints inside one extension: ${D.frag.sameext_overlap}). Operand constraints such as rd≠0 are not modelled, so a listed overlap is a <i>candidate</i> decode ambiguity. "Declared" means the survey's relations already record an implementation, architectural, encoding or toolchain conflict between the two.</p>
<table><tr><th class="l">Class</th><th>Ext pairs</th><th>Record pairs</th><th>Declared</th></tr>${[...classes.entries()].sort((a, b) => b[1][1] - a[1][1]).map(([c, o]) => `<tr><td class="l">${c}</td><td>${o[0]}</td><td>${fmt(o[1])}</td><td>${o[2]}</td></tr>`).join("")}</table>
<h4>Family × family (overlapping record pairs)</h4>
<div class="wide"><table class="hm"><tr><th class="l"></th>${famRows.map((f) => `<th class="rot"><div>${esc(f.n)}</div></th>`).join("")}</tr>
${famRows.map((a) => `<tr><td class="l">${famLink(a.i)}</td>${famRows.map((b) => heat(D.fo[a.i][b.i], mx, true, `${a.n} × ${b.n}`)).join("")}</tr>`).join("")}</table></div>
<hr /><h4>Extension pairs (${D.pairs.length})</h4>
<form onsubmit="return false"><label>Filter: <input id="filter" value="${esc(q || "")}" placeholder="extension, fam:qc, vendor×vendor, undeclared" /></label> <span id="fcount" class="dim"></span></form>
<div class="wide"><table id="t-ov"><thead><tr><th class="l" data-k="0">A</th><th class="l" data-k="1"></th><th class="l" data-k="2">B</th><th class="l" data-k="3"></th><th data-k="4">Pairs</th><th class="l" data-k="5">Class</th><th class="l" data-k="6">Relation</th><th class="l">Example</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
};

PAGES.opcodes = () => {
  const famRows = FAM.filter((f) => D.famr[f.i].nv);
  const grid = new Map();
  for (const v of V) { const op = opcodeOf(v); if (!grid.has(op)) grid.set(op, FAM.map(() => 0)); const r = grid.get(op); famOfVar(v).forEach((f) => r[f]++); }
  const order32 = OPN.map((n, i) => n).filter((n, i, a) => a.indexOf(n) === i);
  const keys32 = order32.filter((k) => grid.has(k)).concat(["? (opcode not fixed)"].filter((k) => grid.has(k)));
  const keys16 = Object.keys(C_NAMES).filter((k) => grid.has(k));
  const keysW = [...grid.keys()].filter((k) => /-bit$/.test(k));
  const mx = Math.max(...[...grid.values()].flat());
  const tbl = (keys, title) => `<h4>${title}</h4><div class="wide"><table class="hm"><tr><th class="l">Slot</th>${famRows.map((f) => `<th class="rot"><div>${esc(f.n)}</div></th>`).join("")}<th>Σ</th><th>Fam</th><th>Vendor fam</th></tr>
${keys.map((k) => { const r = grid.get(k); const s = famRows.reduce((a, f) => a + r[f.i], 0); const nf = famRows.filter((f) => r[f.i]).length; const nv = famRows.filter((f) => r[f.i] && f.kind === "vendor").length; return `<tr><td class="l">${esc(k)}${C_NAMES[k] ? dim(" " + C_NAMES[k]) : ""}</td>${famRows.map((f) => heat(r[f.i], mx, /custom/.test(k), `${k} · ${f.n}`)).join("")}<td>${fmt(s)}</td><td>${nf}</td><td>${nv ? `<span class="${nv > 1 ? "fp" : ""}">${nv}</span>` : dim("-")}</td></tr>`; }).join("")}</table></div>`;
  return `<h3>Opcode map</h3>
<p>Where each family's LLVM records sit in the major-opcode space (32-bit: <code>inst[6:2]</code>; 16-bit: quadrant and <code>funct3</code>). Rows with several vendor families (red count) are shared territory: the same bits mean different things depending on which extension is enabled. The custom-0..3 rows are red-shaded on purpose.</p>
${tbl(keys32, "32-bit major opcodes")}${tbl(keys16, "16-bit compressed slots")}${keysW.length ? tbl(keysW, "Longer encodings") : ""}`;
};

PAGES.fragmentation = () => {
  const f = D.frag;
  const combos = new Map();
  D.ins.forEach((x) => { if (x.e.length > 1) { const k = x.e.map((e) => D.ext[e].n).join(" | "); combos.set(k, (combos.get(k) || 0) + 1); } });
  const cTop = [...combos.entries()].sort((a, b) => b[1] - a[1]);
  const multi = D.ins.map((x, i) => i).filter((i) => D.ins[i].v.length > 1).sort((a, b) => D.ins[b].v.length - D.ins[a].v.length);
  const famRows = D.famr.map((x, i) => ({ ...x, i })).filter((x) => x.ni);
  const mx = Math.max(...famRows.map((x) => x.ni));
  return `<h3>Fragmentation</h3>
<h4>1. Toolchain coverage per family (spellings)</h4>
<div class="wide"><table><tr><th class="l">Family</th><th>Both</th><th>LLVM only</th><th>GNU only</th><th class="l">both / LLVM-only / GNU-only</th></tr>
${famRows.map((x) => { const lo = x.nl - x.both, go = x.ng - x.both, t = x.both + lo + go || 1; return `<tr><td class="l">${famLink(x.i)}</td><td>${num(x.both)}</td><td>${num(lo)}</td><td>${num(go)}</td><td class="l"><svg class="bar" width="200" height="8"><rect width="${(200 * x.both) / mx}" height="8" fill="#555"/><rect x="${(200 * x.both) / mx}" width="${(200 * lo) / mx}" height="8" fill="#007000"/><rect x="${(200 * (x.both + lo)) / mx}" width="${(200 * go) / mx}" height="8" fill="#b00000"/></svg></td></tr>`; }).join("")}</table></div>
<p class="legend"><span class="item"><span class="key" style="background:#555"></span>both</span><span class="item"><span class="key" style="background:#007000"></span>LLVM only</span><span class="item"><span class="key" style="background:#b00000"></span>GNU only</span></p>
<h4>2. Availability predicates on LLVM encoding records</h4>
<table><tr><th class="l">Predicates per record</th>${f.pred_hist.map(([n]) => `<th>${n}</th>`).join("")}</tr><tr><td class="l">records</td>${f.pred_hist.map(([, c]) => `<td>${fmt(c)}</td>`).join("")}</tr></table>
<table><tr><th class="l">Family</th><th>Rec</th><th>XLEN-gated</th><th>none_of</th><th>any_of (&gt;1)</th><th>Multi-ext spellings</th></tr>
${famRows.filter((x) => x.nv).map((x) => `<tr><td class="l">${famLink(x.i)}</td><td>${fmt(x.nv)}</td><td>${num(x.xl)} ${dim(pct(x.xl, x.nv))}</td><td>${num(x.none)}</td><td>${num(x.any)}</td><td>${num(x.mx)}</td></tr>`).join("")}</table>
<h4>3. Spellings gated by several extension atoms (${fmt(f.multi_ext)}), most common atom sets</h4>
<table><tr><th class="l">Atom set (any of)</th><th>Spellings</th></tr>${cTop.slice(0, 30).map(([k, n]) => `<tr><td class="l">${esc(k)}</td><td>${n}</td></tr>`).join("")}</table>
<p class="dim">${cTop.length} distinct atom sets in total.</p>
<h4>4. One spelling, several LLVM records (${fmt(f.multi_rec)}): ${fmt(f.multi_ops_same_enc)} same bits / different operand classes, ${fmt(f.multi_enc)} different bits</h4>
<div class="wide"><table><tr><th class="l">Mnemonic</th><th>Records</th><th>Encodings</th><th>Operand sigs</th><th class="l">Records (predicate atoms)</th></tr>
${multi.map((k) => { const x = D.ins[k]; return `<tr><td class="l">${insLink(x.m)}</td><td>${x.v.length}</td><td>${x.ne > 1 ? `<span class="fp">${x.ne}</span>` : x.ne}</td><td>${x.no}</td><td class="l small">${x.v.map((vi) => `${esc(V[vi].r)}${dim("(" + V[vi].e.map((e) => D.ext[e].n).join("|") + (V[vi].xl !== "any" ? ",RV" + V[vi].xl : "") + ")")}`).join(" ")}</td></tr>`; }).join("")}</table></div>`;
};

PAGES.state = () => {
  const famRows = D.famr.map((x, i) => ({ ...x, i })).filter((x) => x.ni);
  const mx = Math.max(...famRows.flatMap((x) => [...x.rd, ...x.wr]));
  const used = BK.map((b, i) => i).filter((i) => famRows.some((x) => x.rd[i] || x.wr[i]));
  const mt = (key) => `<div class="wide"><table class="hm"><tr><th class="l">Family</th>${used.map((i) => `<th class="rot"><div>${esc(BK_LBL[BK[i]])}</div></th>`).join("")}<th>Mnem</th></tr>
${famRows.map((x) => `<tr><td class="l">${famLink(x.i)}</td>${used.map((i) => heat(x[key][i], mx, false, `${x.n} · ${BK_LBL[BK[i]]}`)).join("")}<td>${fmt(x.ni)}</td></tr>`).join("")}</table></div>`;
  const flags = famRows.filter((x) => x.nv).map((x) => { const vs = V.filter((v) => famOfVar(v).includes(x.i)); return { x, ld: vs.filter((v) => v.f & 1).length, st: vs.filter((v) => v.f & 2).length, se: vs.filter((v) => v.f & 4).length, br: vs.filter((v) => v.f & 8).length, u: vs.filter((v) => v.uses.length).length, d: vs.filter((v) => v.defs.length).length }; });
  return `<h3>Implicit state</h3>
<p>For a JIT the dangerous part of an instruction is what it reads and writes without naming it. Two sources: the survey's per-instruction implicit reads/writes (free text, bucketed by keyword here) and LLVM's own <code>Uses</code>/<code>Defs</code> and <code>mayLoad</code>/<code>mayStore</code>/<code>hasSideEffects</code> (compiler model only, not architectural truth).</p>
<h4>Implicit reads (spellings per family)</h4>${mt("rd")}
<h4>Implicit writes</h4>${mt("wr")}
<h4>LLVM compiler-model flags (encoding records)</h4>
<table><tr><th class="l">Family</th><th>Rec</th><th>mayLoad</th><th>mayStore</th><th>hasSideEffects</th><th>branch/call/ret</th><th>with Uses</th><th>with Defs</th></tr>
${flags.map((r) => `<tr><td class="l">${famLink(r.x.i)}</td><td>${fmt(r.x.nv)}</td><td>${num(r.ld)}</td><td>${num(r.st)}</td><td>${num(r.se)}</td><td>${num(r.br)}</td><td>${num(r.u)}</td><td>${num(r.d)}</td></tr>`).join("")}</table>
<h4>LLVM Uses / Defs registers</h4>
<table><tr><th class="l">Register</th><th>Records</th></tr>${D.ud.map(([k, n]) => `<tr><td class="l">${esc(k.replace("U:", "uses ").replace("D:", "defs "))}</td><td>${n}</td></tr>`).join("")}</table>`;
};

PAGES.compare = (q) => {
  const p = new URLSearchParams(q || "");
  const a = p.get("a") || "zcmp", b = p.get("b") || "xqccmp";
  const resolve = (s) => { if (s.startsWith("fam:")) { const f = FAM.find((x) => x.id === s.slice(4)); return f ? D.ext.map((e, i) => i).filter((i) => D.ext[i].f === f.i) : []; } const i = EXI.get(s); return i == null ? [] : [i]; };
  const A = resolve(a), B = resolve(b);
  const opts = [...FAM.map((f) => `fam:${f.id}`), ...D.ext.map((e) => e.n)];
  const dl = `<datalist id="cmp-list">${opts.map((o) => `<option value="${esc(o)}">`).join("")}</datalist>`;
  const form = `<form id="cmp" onsubmit="return false">A: <input name="a" list="cmp-list" value="${esc(a)}" /> B: <input name="b" list="cmp-list" value="${esc(b)}" /> <button>compare</button> <span class="dim">extension name or fam:&lt;id&gt; (${FAM.map((f) => f.id).join(", ")})</span></form>${dl}`;
  if (!A.length || !B.length) return `<h3>Compare</h3>${form}<p class="warning">Unknown A or B.</p>`;
  const side = (X) => { const ins = new Set(X.flatMap((i) => insOfExt[i])); const vars = new Set(X.flatMap((i) => varsOfExt[i])); const lays = new Map(); vars.forEach((v) => lays.set(V[v].L, (lays.get(V[v].L) || 0) + 1)); const masks = new Set([...vars].map((v) => V[v].w + ":" + V[v].mask)); const st = ST.map(() => 0); ins.forEach((k) => st[D.ins[k].s]++); const rd = new Set(), wr = new Set(); ins.forEach((k) => { D.ins[k].rd.forEach((x) => rd.add(x)); D.ins[k].wr.forEach((x) => wr.add(x)); }); return { ins, vars, lays, masks, st, rd, wr }; };
  const SA = side(A), SB = side(B);
  const mA = new Set([...SA.ins].map((k) => D.ins[k].m)), mB = new Set([...SB.ins].map((k) => D.ins[k].m));
  const both = [...mA].filter((m) => mB.has(m));
  const lA = new Set(SA.lays.keys()), lB = new Set(SB.lays.keys());
  const lBoth = [...lA].filter((l) => lB.has(l)), lOnlyA = [...lA].filter((l) => !lB.has(l)), lOnlyB = [...lB].filter((l) => !lA.has(l));
  const Bset = new Set(B);
  const ovp = []; SA.vars.forEach((vi) => V[vi].ov.forEach((o) => { if (V[o].e.some((e) => Bset.has(e))) ovp.push([vi, o]); }));
  const tc = (S) => { let l = 0, g = 0, lg = 0; S.ins.forEach((k) => { const t = D.ins[k].tc; t === 3 ? lg++ : t === 1 ? l++ : g++; }); return `${lg} / ${l} / ${g}`; };
  const sameName = (s1, s2) => { const x = (m) => m.replace(/^[a-z]+\./, ""); const nB = new Map(); [...s2].forEach((m) => nB.set(x(m), m)); return [...s1].filter((m) => !s2.has(m) && nB.has(x(m))).map((m) => [m, nB.get(x(m))]); };
  const sn = sameName(mA, mB);
  const sims = D.sim.filter((s) => { const t = s.mem.join(" ").toLowerCase(); const hit = (X, M) => X.some((i) => t.includes(D.ext[i].n)) || [...M].some((m) => t.includes(m)); return hit(A, mA) && hit(B, mB); });
  const layRows = (list, S, T) => list.sort((x, y) => (S.lays.get(y) || 0) - (S.lays.get(x) || 0)).map((L) => `<tr><td>${L}</td><td class="l">${esc(D.lay[L].lb)}</td><td class="l">${bitstrip(L)}</td><td>${S.lays.get(L) || ""}</td><td>${T ? T.lays.get(L) || "" : ""}</td><td>${D.lay[L].n}</td></tr>`).join("");
  return `<h3>Compare ${esc(a)} ↔ ${esc(b)}</h3>${form}
<table><tr><th class="l"></th><th>${esc(a)}</th><th>${esc(b)}</th></tr>
<tr><td class="l">extensions</td><td>${A.length}</td><td>${B.length}</td></tr>
<tr><td class="l">spellings</td><td>${mA.size}</td><td>${mB.size}</td></tr>
<tr><td class="l">LG / L-only / G-only</td><td>${tc(SA)}</td><td>${tc(SB)}</td></tr>
<tr><td class="l">LLVM encoding records</td><td>${SA.vars.size}</td><td>${SB.vars.size}</td></tr>
<tr><td class="l">field layouts</td><td>${lA.size}</td><td>${lB.size}</td></tr>
<tr><td class="l">fixed-bit masks</td><td>${SA.masks.size}</td><td>${SB.masks.size}</td></tr>
<tr><td class="l">status</td><td>${stbar(SA.st)}</td><td>${stbar(SB.st)}</td></tr>
<tr><td class="l">implicit reads</td><td class="small">${chips([...SA.rd].map((x) => BK[x]), BK_LBL)}</td><td class="small">${chips([...SB.rd].map((x) => BK[x]), BK_LBL)}</td></tr>
<tr><td class="l">implicit writes</td><td class="small">${chips([...SA.wr].map((x) => BK[x]), BK_LBL)}</td><td class="small">${chips([...SB.wr].map((x) => BK[x]), BK_LBL)}</td></tr>
</table>
<p><b>${both.length}</b> shared spellings · <b>${lBoth.length}</b> shared layouts (${lOnlyA.length} only in A, ${lOnlyB.length} only in B) · <b class="${ovp.length ? "fp" : ""}">${ovp.length}</b> overlapping record pairs · ${sn.length} same-suffix spelling pairs (e.g. <code>qc.cm.push</code> ↔ <code>cm.push</code>)</p>
${ovp.length ? `<h4>Overlapping encodings A ↔ B</h4><div class="wide"><table><tr><th class="l">A record</th><th class="l">A encoding</th><th class="l">B record</th><th class="l">B encoding</th></tr>${ovp.slice(0, 200).map(([x, y]) => `<tr><td class="l">${V[x].ins >= 0 ? insLink(D.ins[V[x].ins].m) : ""} ${dim(esc(V[x].r))}</td><td class="l">${bitstrip(V[x].L, V[x])}</td><td class="l">${V[y].ins >= 0 ? insLink(D.ins[V[y].ins].m) : ""} ${dim(esc(V[y].r))}</td><td class="l">${bitstrip(V[y].L, V[y])}</td></tr>`).join("")}</table></div>${ovp.length > 200 ? dim(`first 200 of ${ovp.length}`) : ""}` : ""}
${sn.length ? `<h4>Same operation name, different spelling</h4><table>${sn.slice(0, 80).map(([x, y]) => { const ix = D.ins[INI.get(x)], iy = D.ins[INI.get(y)]; const vx = ix.v[0] != null ? V[ix.v[0]] : null, vy = iy.v[0] != null ? V[iy.v[0]] : null; return `<tr><td class="l">${insLink(x)}</td><td class="l">${vx ? bitstrip(vx.L, vx) : ""}</td><td class="l">${insLink(y)}</td><td class="l">${vy ? bitstrip(vy.L, vy) : ""}</td></tr>`; }).join("")}</table>` : ""}
<h4>Layouts</h4><table><tr><th>#</th><th class="l">Label</th><th class="l">Fields</th><th>A</th><th>B</th><th>All</th></tr>
${layRows(lBoth, SA, SB)}${layRows(lOnlyA, SA, SB)}${layRows(lOnlyB, SB, SA).replace(/<td>(\d*)<\/td><td>(\d*)<\/td><td>(\d+)<\/td><\/tr>/g, "<td>$2</td><td>$1</td><td>$3</td></tr>")}</table>
${sims.length ? `<h4>Survey similarity groups touching both</h4>${sims.map((s) => `<p><b>${esc(s.id)}</b>: ${esc(s.rel)} ${s.ec !== "" ? `· encoding conflict: <span class="${s.ec === true ? "fp" : ""}">${esc(s.ec)}</span>` : ""}<br/>${esc(s.mem.join(" · "))}<br/>${s.diff.length ? `<span class="dim">${esc(s.diff.join(" | "))}</span>` : esc(s.com)}</p>`).join("")}` : ""}
${both.length ? `<h4>Shared spellings</h4><p class="small">${both.slice(0, 300).map(insLink).join(" ")}</p>` : ""}`;
};

PAGES.notes = () => `<h3>Notes, method and survey cross-references</h3>
<ul>
<li>Source: <code>riscv-survey/data-v2</code> (${esc(D.man.date)}), ${fmt(D.man.instructions)} spellings, ${fmt(D.man.variants)} variants, ${fmt(D.man.extensions)} extensions, ${D.man.pdf_files} PDFs. Structural validation PASS; not every semantic is certified (see survey README).</li>
<li>Families are assigned by name prefix. LLVM base-ISA records have no extension predicate; they are counted under <code>i</code>.</li>
<li>Encoding statistics use LLVM <code>encoding_lsb_first</code> only (${fmt(TOT)} records). A layout is the exact msb→lsb sequence of fixed runs and named operand slices; a mask is the set of fixed bit positions. GNU entries carry MATCH/MASK macro names, not values.</li>
<li>Overlaps: bit-pattern compatibility of fixed bits, XLEN-exclusive pairs removed, operand constraints not modelled. Treat as an upper bound on decode ambiguity that needs the enabled-extension set to resolve.</li>
<li>Implicit state buckets are keyword matches on the survey's free-text state names; "other" collects the rest.</li>
<li>Extension counts per family double count a spelling that several extensions gate (e.g. Zve32x and V).</li>
</ul>
<h4>Similarity groups (${D.sim.length})</h4>
<div class="wide"><table><tr><th class="l">Id</th><th class="l">Members</th><th class="l">Relationship</th><th class="l">Encoding conflict</th><th class="l">Differences / conditions</th></tr>
${D.sim.map((s) => `<tr><td class="l">${esc(s.id)}</td><td class="l msg">${esc(s.mem.join(" · "))}</td><td class="l msg">${esc(s.rel)}</td><td class="l msg">${s.ec === true ? '<span class="fp">yes</span>' : esc(s.ec)}</td><td class="l msg small">${esc(s.diff.join(" | ") || s.com)}</td></tr>`).join("")}</table></div>
<h4>Open issues (${D.oi.length})</h4>
<div class="wide"><table><tr><th class="l">Mnemonic</th><th class="l">Status</th><th class="l">Uncertainty</th></tr>
${D.oi.map((o) => `<tr><td class="l">${insLink(o.m)}</td><td class="l"><span class="${/conflict/.test(o.s) ? "fp" : ""}">${esc(o.s)}</span></td><td class="l msg small">${esc(o.u)}</td></tr>`).join("")}</table></div>`;

// ---------- router ----------
const NAV = [["index", "Index"], ["families", "Families"], ["extensions", "Extensions"], ["formats", "Formats"], ["overlap", "Overlap"], ["opcodes", "Opcode map"], ["fragmentation", "Fragmentation"], ["state", "State"], ["instructions", "Instructions"], ["compare", "Compare"], ["notes", "Notes"]];
function route() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, "")) || "index";
  const [path, query = ""] = h.split("?");
  const [page, arg] = path.split(/\/(.+)/);
  const q = new URLSearchParams(query).get("q") || "";
  $("nav").innerHTML = NAV.map((e) => (!e ? "‖" : e[0] === page ? `<b>${e[1]}</b>` : `<a href="#/${e[0]}">${e[1]}</a>`)).join(" | ").replace(/ \| ‖ \| /g, "<br/>");
  const fn = PAGES[page] || PAGES.index;
  const main = $("#main");
  main.innerHTML = fn(page === "compare" ? query : arg ?? q);
  ["t-ext", "t-ins", "t-lay", "t-ov", "t-fam", "t-famc", "t-ei"].forEach(sortable);
  if (page === "extensions") bindFilter("t-ext");
  if (page === "instructions") bindInsFilter();
  if (page === "formats") bindFilter("t-lay");
  if (page === "overlap") bindFilter("t-ov");
  if (window.ISEL_POST && ISEL_POST[page]) ISEL_POST[page](arg ?? q);
  const cmp = $("#cmp"); if (cmp) cmp.addEventListener("submit", () => { location.hash = `#/compare?a=${encodeURIComponent(cmp.a.value)}&b=${encodeURIComponent(cmp.b.value)}`; });
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
route();

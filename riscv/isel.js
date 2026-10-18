"use strict";
// ISel pages. Loaded after app.js; shares its helpers (esc, fmt, pct, heat, hbar, dim, num, chips, sortable, FAM, EXI, INI, PAGES, NAV).
const S = window.ISEL;
const FAMI = new Map(FAM.map((f) => [f.id, f.i]));
const famName = (id) => (FAMI.has(id) ? FAM[FAMI.get(id)].n : id);
const famA = (id) => (FAMI.has(id) ? famLink(FAMI.get(id)) : esc(id));
const extA = (n) => (EXI.has(n) ? extLink(EXI.get(n)) : esc(n));
const PRI = new Map(S.pred.map((p, i) => [p.id, i]));
const predA = (id) => `<a href="#/preds?q=${encodeURIComponent(id)}" title="${esc(PRI.has(id) ? S.pred[PRI.get(id)].c : "")}">${esc(id)}</a>`;
const opA = (n) => `<a href="#/op/${encodeURIComponent(n)}">${esc(n)}</a>`;
const R = S.ins.map((t, i) => ({ i, id: t[0], m: t[1], sz: t[2], p: t[3], f: t[4], tie: t[5], ec: t[6], use: t[7], def: t[8], eff: t[9], sr: t[10], pat: t[11], np: t[12], roots: t[13], fl: t[14], o: t[15], in: t[16], cin: t[17], cout: t[18], loc: t[19], real: t[20], vpm: t[21], vpp: t[22] }));
const RID = new Map(R.map((r) => [r.id, r]));
const RBYM = (() => { const m = new Map(); R.forEach((r) => { if (r.m) { if (!m.has(r.m)) m.set(r.m, []); m.get(r.m).push(r); } }); return m; })();
const recA = (id) => (RID.has(id) ? `<a href="#/records?q=${encodeURIComponent(id)}">${esc(id)}</a>` : esc(id));
const EFF_S = { memory_read: "ld", memory_write: "st", implicit_state_read: "ird", implicit_state_write: "iwr", fp_exception: "fpe", control_flow: "cf", call: "call", explicit_trap: "trap", other_or_unmodeled_effects: "other" };
const effs = (b) => S.EFF.filter((_, i) => (b >> i) & 1);
const FL_S = { isCommutable: "comm", isReMaterializable: "remat", isPseudo: "pseudo", isCodeGenOnly: "cgonly", isAsmParserOnly: "asmonly", usesCustomInserter: "custins", hasPostISelHook: "postisel", isConvergent: "conv", isNotDuplicable: "nodup", mayRaiseFPException: "fpexc", hasSideEffects: "side", isTerminator: "term", isBarrier: "barrier" };
const flags = (b) => S.FLAGS.filter((_, i) => (b >> i) & 1);
const selRoute = (r) => (r.pat ? "pattern" : r.vpp ? "vpseudo" : r.cout.length ? "compress" : "none");
const ROUTE_L = { pattern: "TableGen pattern", vpseudo: "via vector pseudo", compress: "MC compression", none: "no TableGen route" };
const ROUTE_C = { pattern: "#000", vpseudo: "#555", compress: "#007000", none: "#b00000" };
const isFam = FAM.filter((f) => S.famsel[f.id]);

// lazy pattern store
let PAT = null, patLoading = false;
function needPat() {
  if (window.ISELPAT) { PAT = window.ISELPAT; return true; }
  if (!patLoading) { patLoading = true; const s = document.createElement("script"); s.src = "isel-pat.js"; s.onload = () => { PAT = window.ISELPAT; route_(); }; document.body.appendChild(s); }
  return false;
}
const route_ = () => window.dispatchEvent(new HashChangeEvent("hashchange"));
const LOADING = `<p class="dim">loading isel-pat.js (12 MB of expanded patterns)…</p>`;

function routeBar(c, w = 160) {
  const parts = [["pattern", c.pat || 0], ["vpseudo", c.vp || 0], ["compress", (c.n || 0) - (c.pat || 0) - (c.vp || 0) - (c.none || 0)], ["none", c.none || 0]];
  const t = c.n || 1; let x = 0, out = "";
  for (const [k, n] of parts) { if (!n) continue; const ww = (n / t) * w; out += `<rect x="${x.toFixed(1)}" width="${ww.toFixed(1)}" height="8" fill="${ROUTE_C[k]}"><title>${ROUTE_L[k]}: ${n}</title></rect>`; x += ww; }
  return `<svg class="bar" width="${w}" height="8">${out}</svg>`;
}
const routeLegend = `<p class="legend">${Object.keys(ROUTE_L).map((k) => `<span class="item"><span class="key" style="background:${ROUTE_C[k]};height:8px"></span>${ROUTE_L[k]}</span>`).join("")}</p>`;

PAGES.isel = () => {
  const c = S.man.counts, pv = S.pv;
  const tot = { n: 0, pat: 0, vp: 0, none: 0 }; R.filter((r) => r.real).forEach((r) => { tot.n++; const k = selRoute(r); if (k === "pattern") tot.pat++; else if (k === "vpseudo") tot.vp++; else if (k === "none") tot.none++; });
  const rows = isFam.map((f) => { const x = S.famsel[f.id]; return { f, x }; }).filter(({ x }) => x.n);
  const mx = Math.max(...rows.map(({ x }) => x.n));
  return `<h3>ISel supplement: selection evidence from LLVM TableGen</h3>
<p>LLVM <a href="https://github.com/llvm/llvm-project/commit/${S.man.commit}">${S.man.commit.slice(0, 12)}</a> (same snapshot as the MC survey) · ${fmt(c.explicit_patterns)} expanded patterns + ${c.inline_patterns} inline · ${fmt(c.instructions)} instruction records (${fmt(pv.n)} vector pseudos) · ${fmt(c.operation_roots)} root operations · ${c.predicates} predicates · ${c.operands} operand classes (${c.normalized_immediates} immediates normalized) · ${c.compression_patterns} CompressPats · ${fmt(c.scheduling_records)} scheduling records · validation ${esc(S.man.val.status)}.</p>
<p class="dim">${esc(S.man.contract)}</p>
<h4>How each MC instruction is reached from SelectionDAG (${fmt(tot.n)} records linked to a survey variant)</h4>
${routeLegend}
<div class="wide"><table id="t-isf"><thead><tr><th class="l" data-k="0">Family</th><th data-k="1">MC rec</th><th class="l">Route</th><th data-k="3">Pattern</th><th data-k="4" title="no direct pattern; a vector pseudo whose name maps to it has one">Via V pseudo</th><th data-k="5" title="output of a CompressPat, no direct pattern">Compress</th><th data-k="6">None</th><th data-k="7">None %</th>
<th data-k="8" title="records with tied operands">Tied</th><th data-k="9">Early-clob</th><th data-k="10" title="implicit Uses/Defs">Impl. reg</th>${S.EFF.map((e, i) => `<th data-k="${11 + i}" title="${e}">${EFF_S[e]}</th>`).join("")}<th data-k="${11 + S.EFF.length}" title="codegen-only / pseudo records attributed to this family">Pseudo</th></tr></thead><tbody>
${rows.map(({ f, x }) => `<tr><td class="l">${famLink(f.i)}</td><td>${fmt(x.n)}</td><td class="l">${routeBar(x, Math.max(4, (160 * x.n) / mx))}</td><td>${num(x.pat)}</td><td>${num(x.vp)}</td><td>${num(x.n - (x.pat || 0) - (x.vp || 0) - (x.none || 0))}</td><td>${x.none ? `<span class="${x.none === x.n ? "fp" : ""}">${fmt(x.none)}</span>` : dim("-")}</td><td data-v="${(x.none || 0) / x.n}">${pct(x.none || 0, x.n)}</td>
<td>${num(x.tie)}</td><td>${num(x.ec)}</td><td>${num(x.imp)}</td>${S.EFF.map((_, i) => `<td>${num(x["e" + i])}</td>`).join("")}<td>${num(x.pseudo)}</td></tr>`).join("")}</tbody></table></div>
<p class="hint dim">"None" means no TableGen pattern, no name-matched vector pseudo with a pattern, and no CompressPat output. Such instructions may still be produced by C++ selection (RISCVISelDAGToDAG), intrinsic lowering, frame lowering or pseudo expansion; the supplement does not exclude those. The pseudo→MC link for vectors is derived from LLVM's naming (<code>PseudoVADD_VV_M1_MASK → VADD_VV</code>); ${fmt(pv.n - pv.unmapped)} of ${fmt(pv.n)} vector pseudos map, ${fmt(pv.unmapped)} do not. Effect columns are LLVM compiler-model categories, not architectural trap freedom.</p>
<h4>Vector pseudos (${fmt(pv.n)})</h4>
<table><tr><th>with pattern</th><th>tied</th><th>early-clobber</th>${Object.keys(S.pvf).map((k) => `<th>${esc(k)}</th>`).join("")}<th>MC targets</th></tr><tr><td>${fmt(pv.pat)}</td><td>${fmt(pv.ties)}</td><td>${fmt(pv.ec)}</td>${Object.values(S.pvf).map((n) => `<td>${fmt(n)}</td>`).join("")}<td>${fmt(pv.mapped_targets)}</td></tr></table>
<h4>Worked operation examples (${S.exm.length}, hand-checked in the supplement)</h4>
${S.exm.map(exampleBlock).join("")}`;
};
function exprText(e) { if (e == null) return ""; if (typeof e !== "object") return String(e); return `${e.op}(${(e.args || []).map(exprText).join(", ")})`; }
function reqText(r) { if (!r) return ""; if (r.extension) return r.extension; for (const k of ["all_of", "any_of", "none_of"]) if (r[k]) return (k === "none_of" ? "!" : "") + "(" + r[k].map(reqText).join(k === "any_of" ? " | " : " & ") + ")"; return JSON.stringify(r); }
function exampleBlock(e) {
  return `<p><b>${esc(e.id)}</b>: <code>${esc(exprText(e.operation))}</code> ${dim(esc(e.scope || ""))}</p>
<div class="wide"><table><tr><th class="l">Instructions</th><th class="l">Requires</th><th class="l">Phase</th><th>Bytes</th><th class="l">Patterns</th><th class="l">Constraints</th></tr>
${e.candidates.map((c) => `<tr><td class="l">${(c.instructions || []).map(recA).join(" ") || dim("(none fixed)")}</td><td class="l">${esc(reqText(c.requires))}</td><td class="l">${esc(c.phase || "")}</td><td>${c.uncompressed_bytes ?? ""}</td><td class="l small">${(c.pattern_ids || []).map(esc).join(" ")}</td><td class="l msg small">${esc([c.binding, c.constraints, c.evidence_kind].filter(Boolean).join(" · "))}</td></tr>`).join("")}</table></div>
<p class="small dim">${esc((e.source || []).join(" · "))}</p>`;
}

PAGES.ops = (q) => {
  const fams = FAM.filter((f) => S.ops.some((o) => o.f[f.id] || o.fv[f.id]));
  const hm = (key, n) => {
    const top = [...S.ops].sort((a, b) => sum(b[key]) - sum(a[key])).filter((o) => sum(o[key])).slice(0, n);
    const cols = fams.filter((f) => top.some((o) => o[key][f.id]));
    const mx = Math.max(...top.flatMap((o) => cols.map((f) => o[key][f.id] || 0)));
    return `<div class="wide"><table class="hm"><tr><th class="l">Root op \\ family</th>${cols.map((f) => `<th class="rot"><div>${esc(f.n)}</div></th>`).join("")}<th>Σ</th><th>Fam</th></tr>
${top.map((o) => `<tr><td class="l">${opA(o.n)}</td>${cols.map((f) => heat(o[key][f.id] || 0, mx, false, `${o.n} · ${f.n}`)).join("")}<td>${fmt(sum(o[key]))}</td><td>${cols.filter((f) => o[key][f.id]).length}</td></tr>`).join("")}</table></div>`;
  };
  const mxp = Math.max(...S.ops.map((o) => o.np));
  const body = S.ops.map((o) => `<tr data-key="${esc(o.n + " " + Object.keys(o.f).concat(Object.keys(o.fv)).map((f) => "fam:" + f).join(" ") + (o.nv && !o.ns ? " vector" : o.ns && !o.nv ? " scalar" : " mixed") + " " + o.tg.join(" ").toLowerCase())}">
<td class="l">${opA(o.n)}</td><td>${fmt(o.np)}</td><td class="l">${hbar(o.np, mxp, 50)}</td><td>${num(o.ns)}</td><td>${num(o.nv)}</td><td>${fmt(o.nt)}</td><td>${fmt(o.ps)}</td><td>${num(o.ac)}</td><td>${Object.keys(o.f).length}</td><td>${Object.keys(o.fv).length}</td>
<td class="l small">${Object.entries(o.f).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, n]) => `${esc(famName(f))}${dim(":" + n)}`).join(" ")}</td><td class="l small">${o.tg.slice(0, 6).map(esc).join(" ")}${o.nt > 6 ? dim(" +" + (o.nt - 6)) : ""}</td></tr>`).join("");
  return `<h3>Operations → candidate instructions (${fmt(S.ops.length)} root operations)</h3>
<p>Each row is a SelectionDAG root operator from <code>operation-index.json</code>, with every expanded pattern rooted at it. A pattern is attributed to a family through its predicates (pattern + target predicates → extension leaves); patterns with no extension predicate count as base. Vector = target is a vector pseudo, the DAG has scalable vector types, or the pattern requires <code>HasVInstructions*</code>. Same root does not mean same expression: fragments and C++ predicates still decide.</p>
<h4>Scalar patterns: top 60 root operations × family</h4>${hm("f", 60)}
<h4>Vector patterns: top 40 root operations × family</h4>${hm("fv", 40)}
<hr /><h4>All root operations</h4>
<form onsubmit="return false"><label>Filter: <input id="filter" value="${esc(q || "")}" placeholder="op name, fam:zba, scalar, vector, mixed, target name" /></label> <span id="fcount" class="dim"></span></form>
<div class="wide"><table id="t-ops"><thead><tr><th class="l" data-k="0">Root op</th><th data-k="1">Patterns</th><th></th><th data-k="3">Scalar</th><th data-k="4">Vector</th><th data-k="5" title="distinct target instructions">Targets</th><th data-k="6" title="distinct predicate sets">Pred sets</th><th data-k="7" title="max AddedComplexity">AC</th><th data-k="8" title="families with scalar patterns">Fam s</th><th data-k="9" title="families with vector patterns">Fam v</th><th class="l">Scalar patterns per family</th><th class="l">Targets</th></tr></thead><tbody>${body}</tbody></table></div>`;
};
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

PAGES.op = (name) => {
  const o = S.ops.find((x) => x.n === name); if (!o) return `<p class="warning">Unknown operation ${esc(name)}</p>`;
  if (!needPat()) return `<h3>${esc(name)}</h3>${LOADING}`;
  const ks = PAT.op[name] || [];
  const byT = new Map();
  for (const k of ks) { const p = PAT.p[k]; const t = p[4].join(" + ") || "(none)"; if (!byT.has(t)) byT.set(t, []); byT.get(t).push(p); }
  const groups = [...byT.entries()].sort((a, b) => (a[1][0][8] - b[1][0][8]) || (b[1].length - a[1].length));
  const ex = S.exm.filter((e) => JSON.stringify(e.operation).includes(`"${name}`) || e.candidates.some((c) => (c.pattern_ids || []).some((id) => ks.some((k) => PAT.p[k][0] === id))));
  const row = (p) => `<tr><td class="l small">${esc(p[0])}</td><td class="l small">${esc(p[1])}</td><td class="l small"><code>${esc(p[2])}</code></td><td class="l small"><code>${esc(p[3])}</code></td><td class="l small">${p[5].map(predA).join(" ") || dim("-")}</td><td>${p[6] || ""}</td><td class="l small">${p[7].map(famName).map(esc).join(",")}</td></tr>`;
  const famsHere = new Map(); ks.forEach((k) => PAT.p[k][7].forEach((f) => famsHere.set(f, (famsHere.get(f) || 0) + 1)));
  return `<h3>${esc(name)} ${dim(`· ${fmt(o.np)} patterns · ${o.nt} targets · ${o.ps} predicate sets`)}</h3>
<p>${[...famsHere.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${famA(f)} ${dim(n)}`).join(" · ")}</p>
${ex.length ? `<h4>Worked examples</h4>${ex.map(exampleBlock).join("")}` : ""}
<h4>Target instruction groups (${groups.length}); scalar first</h4>
<table><tr><th class="l">Targets</th><th>Patterns</th><th class="l">Kind</th><th class="l">Families</th><th class="l">Predicates seen</th></tr>
${groups.map(([t, ps], j) => `<tr><td class="l"><a href="#g${j}">${esc(t)}</a></td><td>${ps.length}</td><td class="l">${ps[0][8] ? "vector" : "scalar"}</td><td class="l small">${[...new Set(ps.flatMap((p) => p[7]))].map(famName).map(esc).join(", ")}</td><td class="l small">${[...new Set(ps.flatMap((p) => p[5]))].slice(0, 8).map(predA).join(" ")}</td></tr>`).join("")}</table>
${groups.map(([t, ps], j) => `<h4 id="g${j}">${t.split(" + ").map(recA).join(" + ")} ${dim("(" + ps.length + ")")}</h4>
<div class="wide"><table><tr><th class="l">Id</th><th class="l">Source</th><th class="l">Match</th><th class="l">Result</th><th class="l">Predicates</th><th>AC</th><th class="l">Fam</th></tr>${ps.slice(0, 120).map(row).join("")}</table></div>${ps.length > 120 ? dim(`first 120 of ${ps.length}`) : ""}`).join("")}`;
};

PAGES.preds = (q) => {
  const mxp = Math.max(...S.pred.map((p) => p.np));
  const prow = S.pred.map((p) => `<tr data-key="${esc(p.id + " " + p.c + " " + p.k + " " + p.fam.map((f) => "fam:" + f).join(" ") + (p.unk ? " unknown" : ""))}"><td class="l">${esc(p.id)}</td><td class="l">${p.k === "ext" ? "ext" : p.k === "neg" ? '<span class="fp">neg</span>' : p.k === "tune" ? '<span class="tp">tune</span>' : esc(p.k)}</td>
<td class="l small">${p.unk ? dim("?") + " " : ""}${esc(p.c)}</td><td class="l small">${p.fam.map(famName).map(esc).join(",")}</td><td>${num(p.np)}</td><td class="l">${hbar(p.np, mxp, 40)}</td><td>${num(p.ni)}</td><td class="l small dim">${esc(p.cpp)}</td><td class="l small dim">${esc(p.loc)}</td></tr>`).join("");
  const kinds = { ext: "extension", exp: "experimental ext", tune: "tune feature", fusion: "fusion" };
  const frow = S.feat.map((f) => `<tr data-key="${esc(f.n + " " + f.id + " " + f.k + " " + f.imp.join(" ") + " " + f.d.toLowerCase())}"><td class="l">${extA(f.n)}</td><td class="l">${esc(kinds[f.k] || f.k)}</td><td>${f.v || dim("-")}</td><td>${f.imp.length || dim("-")}</td><td>${f.cl || dim("-")}</td><td>${num(f.by)}</td><td class="l small">${f.imp.map(extA).join(" ")}</td><td class="l small dim">${f.cl > f.imp.length ? esc(f.clx.filter((x) => !f.imp.includes(x)).join(" ")) : ""}</td><td class="l small dim">${esc(f.d)}</td></tr>`).join("");
  const conf = D.rel.filter((r) => /conflict|incompat|xlen_restriction|conditional/.test(r[0]));
  return `<h3>Predicates and features</h3>
<p>An ISel predicate is a tree over extensions and XLEN (all_of / any_of / none_of), plus the C++ condition the selector actually evaluates. "?" marks the ${S.pred.filter((p) => p.unk).length} predicates whose assembler condition is unknown; their family is read from the C++ condition. neg = only negative leaves (pattern applies when an extension is absent); tune = depends on a tuning feature, not on the ISA.</p>
<form onsubmit="return false"><label>Filter: <input id="filter" value="${esc(q || "")}" placeholder="name, extension, fam:v, neg, tune, unknown" /></label> <span id="fcount" class="dim"></span></form>
<div class="wide"><table id="t-pred"><thead><tr><th class="l" data-k="0">Predicate</th><th class="l" data-k="1">Kind</th><th class="l" data-k="2">Condition</th><th class="l" data-k="3">Family</th><th data-k="4">Patterns</th><th></th><th data-k="6">Records</th><th class="l">C++ (ISel)</th><th class="l">Source</th></tr></thead><tbody>${prow}</tbody></table></div>
<hr /><h4>SubtargetFeatures (${S.feat.length}): direct Implies and transitive closure</h4>
<form onsubmit="return false"><label>Filter: <input id="filter2" placeholder="name, experimental, fusion, implied name" /></label> <span id="fcount2" class="dim"></span></form>
<div class="wide"><table id="t-feat"><thead><tr><th class="l" data-k="0">Feature</th><th class="l" data-k="1">Kind</th><th data-k="2">Ver</th><th data-k="3">Implies</th><th data-k="4">Closure</th><th data-k="5" title="features that imply this one directly">Implied by</th><th class="l">Direct</th><th class="l">Transitive only</th><th class="l">Description</th></tr></thead><tbody>${frow}</tbody></table></div>
<hr /><h4>Exclusions and conditional rules (${conf.length} of ${D.rel.length} survey relations)</h4>
<div class="wide"><table><tr><th class="l">Type</th><th class="l">From</th><th class="l">To</th><th class="l">Toolchain</th><th class="l">Condition</th></tr>${conf.map((r) => `<tr><td class="l">${/conflict|incompat/.test(r[0]) ? `<span class="fp">${esc(r[0])}</span>` : esc(r[0])}</td><td class="l">${extA(r[1])}</td><td class="l">${r[2].split(",").map(extA).join(", ")}</td><td class="l dim">${esc(r[3])}</td><td class="l msg small">${esc(r[4])}</td></tr>`).join("")}</table></div>`;
};

PAGES.operands = (q) => {
  const rows = S.opr.map((o) => { const d = o.dom; return `<tr data-key="${esc(o.id + " " + o.k + " " + o.rc + " " + (d ? (d.signed ? "signed" : "unsigned") + " normalized" : o.code ? "raw" : ""))}"><td class="l">${esc(o.id)}</td><td class="l">${esc(o.k)}</td><td class="l">${esc(o.rc)}</td><td data-v="${o.nm ?? -1}">${o.nm ?? dim("-")}</td>
<td>${d ? (d.signed ? "s" : "u") : dim("-")}</td><td>${d ? d.value_bits : dim("-")}</td><td>${d ? d.encoded_significant_bits : dim("-")}</td><td>${d ? d.min : dim("-")}</td><td>${d ? d.max : dim("-")}</td><td>${d && d.alignment > 1 ? d.alignment : dim("-")}</td><td>${d && d.exclude_zero ? '<span class="fp">≠0</span>' : ""}</td>
<td>${num(o.u)}</td><td class="l small">${esc(o.ot)}</td><td class="l small dim">${esc(o.enc)}</td><td class="l small">${o.mem.length ? esc(compactRegs(o.mem)) : ""}${o.code ? `<code>${esc(o.code)}</code>` : ""}</td><td class="l small dim">${esc(o.loc)}</td></tr>`; }).join("");
  const kc = {}; S.opr.forEach((o) => (kc[o.k] = (kc[o.k] || 0) + 1));
  return `<h3>Operand and register classes (${S.opr.length})</h3>
<p>${Object.entries(kc).map(([k, n]) => `${esc(k)} ${n}`).join(" · ")}. Immediate domains are normalized only where the ImmediateCode matched a supported form (${S.opr.filter((o) => o.dom).length}); the others keep the raw code. Uses = instruction records (vector pseudos included) that name the class in ins/outs. Register sets list resolved members; tuples keep their MemberList and are not expanded.</p>
<form onsubmit="return false"><label>Filter: <input id="filter" value="${esc(q || "")}" placeholder="name, imm, regclass, signed, normalized, raw" /></label> <span id="fcount" class="dim"></span></form>
<div class="wide"><table id="t-opr"><thead><tr><th class="l" data-k="0">Operand</th><th class="l" data-k="1">Kind</th><th class="l" data-k="2">RegClass</th><th data-k="3">Regs</th><th data-k="4">Sign</th><th data-k="5">Bits</th><th data-k="6" title="encoded significant bits">Enc</th><th data-k="7">Min</th><th data-k="8">Max</th><th data-k="9">Align</th><th data-k="10"></th><th data-k="11">Uses</th><th class="l" data-k="12">OperandType</th><th class="l">Encoder</th><th class="l">Members / raw ImmediateCode</th><th class="l">Source</th></tr></thead><tbody>${rows}</tbody></table></div>`;
};
function compactRegs(list) {
  const by = new Map(); list.forEach((r) => { const m = r.match(/^([A-Z_]+?)(\d+)(.*)$/); const k = m ? m[1] + "|" + m[3] : r; if (!by.has(k)) by.set(k, []); by.get(k).push(m ? +m[2] : null); });
  return [...by.entries()].map(([k, ns]) => { if (ns[0] == null) return k; const [p, s] = k.split("|"); ns.sort((a, b) => a - b); const rs = []; let a = ns[0], b = a; for (const n of ns.slice(1)) { if (n === b + 1) b = n; else { rs.push(a === b ? a : a + "-" + b); a = b = n; } } rs.push(a === b ? a : a + "-" + b); return p + "{" + rs.join(",") + "}" + s; }).join(" ");
}

PAGES.compress = () => {
  const byOut = new Map(); S.cmp.forEach((c) => { const p = c.p.join(" & "); byOut.set(p, (byOut.get(p) || 0) + 1); });
  return `<h3>Compression and pseudo expansion</h3>
<p>${S.cmp.length} CompressPats map a 32-bit instruction to a 16-bit one after selection (MC level). ${S.cmp.filter((c) => c.only).length} are compress-only (no uncompress direction). The input operand classes carry the constraints (GPRC = x8–x15, tied rd = rs1, nonzero immediates); not every compressed form is limited to x8–x15.</p>
<table><tr><th class="l">Predicates</th><th>Patterns</th></tr>${[...byOut.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => `<tr><td class="l">${p.split(" & ").map(predA).join(" & ")}</td><td>${n}</td></tr>`).join("")}</table>
<div class="wide"><table id="t-cmp"><thead><tr><th class="l" data-k="0">From</th><th class="l" data-k="1">To</th><th class="l">Input DAG (constraints)</th><th class="l">Output DAG</th><th class="l" data-k="4">Predicates</th><th data-k="5">Only</th><th class="l">Source</th></tr></thead><tbody>
${S.cmp.map((c) => `<tr><td class="l">${recA(c.a)}</td><td class="l">${recA(c.b)}</td><td class="l small"><code>${esc(c.ia)}</code></td><td class="l small"><code>${esc(c.ob)}</code></td><td class="l small">${c.p.map(predA).join(" ")}</td><td>${c.only ? "1" : ""}</td><td class="l small dim">${esc(c.loc)}</td></tr>`).join("")}</tbody></table></div>
<h4>Pseudo expansions (${S.pex.length})</h4>
<div class="wide"><table><tr><th class="l">Pseudo</th><th class="l">Expands to</th><th class="l">Source</th></tr>${S.pex.map((p) => `<tr><td class="l">${recA(p.id)}</td><td class="l small"><code>${esc(p.r)}</code></td><td class="l small dim">${esc(p.loc)}</td></tr>`).join("")}</table></div>`;
};

PAGES.sched = (q) => {
  const ms = S.models.filter((m) => !m.nm);
  const short = (id) => id.replace(/Model$/, "").replace(/^SiFive7VLEN/, "SF7-").replace(/^Syntacore/, "").replace(/^XiangShan/, "XS");
  const mrows = S.models.map((m) => `<tr><td class="l">${esc(m.id)}</td><td>${m.iw}</td><td>${m.ll}</td><td>${m.mp}</td><td>${m.mob}</td><td>${m.cm ? "1" : ""}</td><td>${num(m.wr)}</td><td>${num(m.wru)}</td><td data-v="${m.wr ? m.wru / m.wr : -1}">${m.wr ? pct(m.wru, m.wr) : dim("-")}</td><td>${num(m.swr)}</td><td>${num(m.ra)}</td><td>${num(m.irw)}</td><td>${num(m.al)}</td><td>${num(m.vr)}</td><td>${num(m.pr)}</td><td>${m.procs.length}</td><td class="l small">${esc(m.procs.join(" "))}</td></tr>`).join("");
  const filt = (q || "").toLowerCase();
  const wts = S.wt.filter((w) => !filt || w.toLowerCase().includes(filt));
  const lmax = Math.max(...wts.flatMap((w) => ms.map((m) => { const c = S.lat[w][m.id]; return c && typeof c[0] === "number" ? c[0] : 0; })));
  const cell = (w, m) => {
    const c = S.lat[w][m.id];
    if (!c) return `<td class="h">${dim("·")}</td>`;
    if (c[0] === "U") return `<td class="h" title="Unsupported">${dim("×")}</td>`;
    if (c[0] === "A") return `<td class="h" title="SchedAlias → ${esc(c[1])}"><span class="tp">var</span></td>`;
    const [lat, uops, res, rel] = c; const a = 0.06 + 0.8 * Math.sqrt(Math.min(lat, lmax) / (lmax || 1));
    return `<td class="h" style="background:rgba(0,0,0,${a.toFixed(2)});color:${a > 0.5 ? "#fff" : "#000"}" title="${esc(`${w} · ${m.id}\nlatency ${lat}, uops ${uops}\n${res.join(", ")}${rel.length ? "\nrelease " + rel.join(",") : ""}`)}">${lat}${uops > 1 ? "<sup>" + uops + "</sup>" : ""}</td>`;
  };
  return `<h3>Scheduling models</h3>
<p>Costs exist only per CPU. Path: instruction <code>SchedRW</code> → CPU's SchedModel → WriteRes / ReadAdvance, overridden by InstRW, SchedAlias and SchedVariant. Missing record = unknown, not zero. Resource cycles are not reciprocal throughput; latencies of several writes do not add.</p>
<h4>Models (${S.models.length}) and processors (${S.procs.length})</h4>
<div class="wide"><table id="t-sm"><thead><tr><th class="l" data-k="0">SchedModel</th><th data-k="1">Issue</th><th data-k="2">LoadLat</th><th data-k="3">Mispred</th><th data-k="4">µop buf</th><th data-k="5">Complete</th><th data-k="6">WriteRes</th><th data-k="7">Unsupp.</th><th data-k="8">Unsupp. %</th><th data-k="9">SchedWriteRes</th><th data-k="10">ReadAdv</th><th data-k="11">InstRW</th><th data-k="12">Alias</th><th data-k="13">Variant</th><th data-k="14">Resources</th><th data-k="15">CPUs</th><th class="l">CPUs</th></tr></thead><tbody>${mrows}</tbody></table></div>
<h4>Scalar WriteRes latency: ${wts.length} write types × ${ms.length} models</h4>
<form onsubmit="location.hash='#/sched?q='+encodeURIComponent(this.q.value);return false"><label>Write type contains: <input name="q" value="${esc(q || "")}" placeholder="IMul, FDiv, LD, Atomic" /></label> <button>filter</button></form>
<p class="hint dim">Cell = Latency (superscript = NumMicroOps when &gt;1; hover for resources). × = Unsupported, var = resolved through SchedAlias/variant (SiFive7), · = no record.</p>
<div class="wide"><table class="hm"><tr><th class="l">WriteType \\ model</th>${ms.map((m) => `<th class="rot"><div title="${esc(m.id)}">${esc(short(m.id))}</div></th>`).join("")}</tr>
${wts.map((w) => `<tr><td class="l small">${esc(w)}</td>${ms.map((m) => cell(w, m)).join("")}</tr>`).join("")}</table></div>
<h4>Processors</h4>
<div class="wide"><table id="t-proc"><thead><tr><th class="l" data-k="0">CPU</th><th class="l" data-k="1">SchedModel</th><th data-k="2">RV64</th><th data-k="3">Features</th><th data-k="4">Tune</th><th class="l">Vendor extensions</th></tr></thead><tbody>
${S.procs.map((p) => `<tr><td class="l">${esc(p.n)}${p.tune ? dim(" (tune)") : ""}</td><td class="l">${p.m === "NoSchedModel" ? dim(p.m) : esc(p.m)}</td><td>${p.b64 ? "64" : p.tune ? "" : "32"}</td><td>${p.nf}</td><td>${p.nt}</td><td class="l small">${p.ven.map(extA).join(" ")}</td></tr>`).join("")}</tbody></table></div>`;
};

function recRow(r) {
  const ef = effs(r.eff), fl = flags(r.fl), rt = selRoute(r);
  return `<tr><td class="l">${esc(r.id)}</td><td class="l">${r.m ? insLink(r.m) : r.fl & (1 << S.FLAGS.indexOf("isPseudo")) ? dim("pseudo") : `<span class="dim" title="no linked survey variant">(no MC link)</span>`}</td><td class="l small">${r.f.map(famName).map(esc).join(",")}</td><td class="l small">${r.p.map(predA).join(" ") || dim("-")}</td>
<td class="l"><span style="color:${ROUTE_C[rt]}">${rt === "pattern" ? "pat" : rt === "vpseudo" ? "vps" : rt === "compress" ? "cmp" : "-"}</span></td><td>${num(r.np)}</td><td data-v="${r.vpp}">${r.vpm ? `${r.vpp}/${r.vpm}` : dim("-")}</td><td class="l small">${r.roots.map(opA).join(" ")}</td>
<td class="l small">${esc(r.o.join(","))} ← ${esc(r.in.join(","))}</td><td class="l small">${esc(r.tie.join(" "))}${r.ec.length ? ` <span class="fp">@${esc(r.ec.join(","))}</span>` : ""}</td><td class="l small">${esc([...r.use.map((u) => "u:" + u), ...r.def.map((d) => "d:" + d)].join(" "))}</td>
<td class="l small">${chips(ef.map((e) => EFF_S[e]))}</td><td class="l small dim">${esc(fl.map((f) => FL_S[f]).join(" "))}</td><td class="l small">${esc(r.sr.join(" "))}</td><td class="l small">${r.cin.map(recA).join(" ")}${r.cout.length ? dim(" ← ") + r.cout.map(recA).join(" ") : ""}</td><td>${r.sz}</td></tr>`;
}
function recTable(list, id, limit = 0) {
  const shown = limit ? list.slice(0, limit) : list;
  return `<div class="wide"><table id="${id}"><thead><tr><th class="l" data-k="0">Record</th><th class="l" data-k="1">Mnemonic</th><th class="l" data-k="2">Fam</th><th class="l">Predicates</th><th class="l" data-k="4" title="pat: TableGen pattern; vps: via vector pseudo; cmp: CompressPat output">Route</th><th data-k="5">Pat</th><th data-k="6" title="vector pseudos with pattern / mapped pseudos">V ps</th><th class="l">Root ops</th><th class="l">Operands (out ← in)</th><th class="l">Tied / @early-clobber</th><th class="l">Impl. regs</th><th class="l">Effects</th><th class="l">Flags</th><th class="l">SchedRW</th><th class="l">Compress → / ←</th><th data-k="15">Size</th></tr></thead><tbody>${shown.map(recRow).join("")}</tbody></table></div>`;
}
let REC_KEYS = null;
PAGES.records = (q) => `<h3>ISel instruction records (${fmt(R.length)} = MC instructions + non-vector pseudos; ${fmt(S.pv.n)} vector pseudos summarized on <a href="#/isel">ISel</a>)</h3>
<form onsubmit="return false"><label>Filter: <input id="filter" value="${esc(q || "")}" placeholder="record, mnemonic, fam:qc, route:none, route:pat, tied, early, eff:ird, op:add, pred name, pseudo" /></label> <span id="fcount" class="dim"></span></form>
<div id="rec-box"></div>`;
function recKey(r) { return [r.id, r.m, ...r.f.map((f) => "fam:" + f), ...r.p, "route:" + selRoute(r).replace("pattern", "pat"), r.tie.length ? "tied" : "", r.ec.length ? "early" : "", ...effs(r.eff).map((e) => "eff:" + EFF_S[e]), ...r.roots.map((o) => "op:" + o), r.real ? "mc" : "pseudo", r.cin.length || r.cout.length ? "compress" : "", ...flags(r.fl).map((f) => FL_S[f])].join(" ").toLowerCase(); }
function bindRec() {
  const inp = $("#filter"), box = $("#rec-box"); if (!inp || !box) return;
  REC_KEYS = REC_KEYS || R.map(recKey);
  let limit = 400;
  const run = () => {
    const terms = inp.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const hits = R.filter((_, i) => terms.every((w) => REC_KEYS[i].includes(w)));
    box.innerHTML = recTable(hits, "t-rec", limit) + (hits.length > limit ? `<p><a href="javascript:void 0" id="more">show all ${fmt(hits.length)}</a> ${dim("(showing " + limit + ")")}</p>` : "");
    $("#fcount").textContent = `${fmt(hits.length)} match`; sortable("t-rec");
    const more = $("#more"); if (more) more.addEventListener("click", () => { limit = 1e9; run(); });
  };
  let tm = 0; inp.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => { limit = 400; run(); }, 120); }); run();
}

// extra section on the MC instruction page
window.ISEL_INS = (m) => {
  const rs = RBYM.get(m) || []; if (!rs.length) return "";
  return `<h4>ISel (${rs.length} LLVM record${rs.length > 1 ? "s" : ""})</h4>${recTable(rs, "t-irec")}`;
};

function bindSecondFilter() {
  const inp = $("#filter2"), t = document.getElementById("t-feat"); if (!inp || !t) return;
  const run = () => { const terms = inp.value.toLowerCase().trim().split(/\s+/).filter(Boolean); let n = 0; for (const r of t.tBodies[0].rows) { const ok = terms.every((w) => (r.dataset.key || "").toLowerCase().includes(w)); r.style.display = ok ? "" : "none"; n += ok; } $("#fcount2").textContent = `${n} shown`; };
  inp.addEventListener("input", run); run();
}
window.ISEL_POST = {
  isel: () => sortable("t-isf"),
  ops: () => { sortable("t-ops"); bindFilter("t-ops"); },
  preds: () => { sortable("t-pred"); sortable("t-feat"); bindFilter("t-pred"); bindSecondFilter(); },
  operands: () => { sortable("t-opr"); bindFilter("t-opr"); },
  compress: () => sortable("t-cmp"),
  sched: () => { sortable("t-sm"); sortable("t-proc"); },
  records: bindRec,
  ins: () => sortable("t-irec"),
};
NAV.push(null, ["isel", "ISel"], ["ops", "Operations"], ["preds", "Predicates"], ["operands", "Operands"], ["compress", "Compression"], ["sched", "Scheduling"], ["records", "Records"]);
route_();

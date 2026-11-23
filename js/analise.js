/* Geoportal das Escolas Públicas – aba "Análise": painel que cruza desempenho (SARESP, SAEB, IDEB)
   com variáveis do setor censitário da escola. Gráficos em SVG puro, sem bibliotecas. */
(function () {
  const $ = id => document.getElementById(id);
  const SVGNS = "http://www.w3.org/2000/svg";
  const fmt = (v, c = 0) => v == null || isNaN(v) ? "–" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
  const FORA = "__fora__";
  const REDES = CONFIG.redes;
  const COR_TEXTO = "#262838";

  // ---------- Dados: escola + propriedades do setor censitário onde está ----------
  const SETMAP = {};
  DATA_SETORES.features.forEach(f => { SETMAP[f.properties.cd_setor] = f.properties; });
  const ESCOLAS = DATA_ESCOLAS.features.map(f => ({ p: f.properties, s: SETMAP[f.properties.cd_setor] || {} }));
  const VALS_SETOR = k => DATA_SETORES.features.map(f => f.properties[k]).filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);

  const st = { rede: "", bairro: "", y: "ideb_ai", x: "renda_media", ord: { col: "y", dir: -1 } };
  let G = null;   // GEO (pronto depois do app.js)

  // definição do indicador: fonte, nome, casas
  function defY(k) {
    for (const [f, F] of Object.entries(G.fontes)) if (F.vars[k]) {
      const d = F.vars[k];
      return { fonte: f, nomeFonte: F.nome, nome: d.nome, curto: d.curto, casas: d.casas != null ? d.casas : 1, div: !!d.div };
    }
  }
  const defX = k => CONFIG.variaveis[k];
  const valX = (e, k = st.x) => e.s[k];
  const fmtX = (v, k = st.x) => {
    const d = defX(k); if (v == null || isNaN(v)) return "–";
    return d.unidade === "R$" ? "R$ " + fmt(v, d.casas) : d.unidade === "%" ? fmt(v, d.casas) + "%" : fmt(v, d.casas) + (d.unidade === "SM" ? " SM" : "");
  };
  const fmtY = (v, k = st.y) => { const d = defY(k); return v == null ? "–" : (d.div && v > 0 ? "+" : "") + fmt(v, d.casas); };

  function recorte() {
    return ESCOLAS.filter(({ p }) =>
      (!st.rede || p.dependencia === st.rede) &&
      (!st.bairro || (st.bairro === FORA ? !p.bairro_ibge : p.bairro_ibge === st.bairro)));
  }
  const redesAtivas = () => st.rede ? [st.rede] : Object.keys(REDES);
  const media = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  function niceTicks(min, max, n = 5) {
    if (min === max) { min -= 1; max += 1; }
    const passo0 = (max - min) / n, pot = Math.pow(10, Math.floor(Math.log10(passo0)));
    const passo = [1, 2, 2.5, 5, 10].map(f => f * pot).find(p => p >= passo0);
    const ini = Math.floor(min / passo) * passo, fim = Math.ceil(max / passo) * passo, t = [];
    for (let v = ini; v <= fim + passo / 2; v += passo) t.push(Math.round(v / passo) * passo);
    return t;
  }
  const casasTick = ticks => { const p = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1; return p >= 1 ? 0 : p >= 0.1 ? 1 : 2; };

  // ---------- SVG ----------
  function el(tag, attrs = {}, pai) {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (pai) pai.appendChild(n);
    return n;
  }
  function texto(pai, x, y, t, attrs = {}) { const n = el("text", { x, y, ...attrs }, pai); n.textContent = t; return n; }
  function novoSvg(cont, H) {
    cont.innerHTML = "";
    const W = Math.max(280, cont.clientWidth || 520);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img" }, cont);
    return { svg, W, H };
  }
  function vazio(cont, msg) { cont.innerHTML = ""; const d = document.createElement("div"); d.className = "dash-vazio"; d.textContent = msg; cont.appendChild(d); }

  // ---------- Tooltip (textContent; o valor em destaque, o rótulo depois) ----------
  const tip = $("da-tip");
  function mostraTip(ev, titulo, linhas) {
    tip.innerHTML = "";
    const t = document.createElement("div"); t.style.fontWeight = "500"; t.style.marginBottom = "4px"; t.textContent = titulo; tip.appendChild(t);
    linhas.forEach(([valor, rotulo, cor]) => {
      const d = document.createElement("div");
      if (cor) { const k = document.createElement("span"); k.className = "tk"; k.style.borderColor = cor; d.appendChild(k); }
      const v = document.createElement("span"); v.className = "tv"; v.textContent = valor; d.appendChild(v);
      const r = document.createElement("span"); r.className = "tl"; r.textContent = " " + rotulo; d.appendChild(r);
      tip.appendChild(d);
    });
    tip.hidden = false;
    const r = ev.target.getBoundingClientRect ? ev.target.getBoundingClientRect() : { left: ev.clientX, top: ev.clientY, width: 0 };
    const x = ev.clientX != null && ev.type !== "focus" ? ev.clientX : r.left + r.width / 2;
    const y = ev.clientY != null && ev.type !== "focus" ? ev.clientY : r.top;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.min(innerWidth - tw - 8, Math.max(8, x + 14)) + "px";
    tip.style.top = Math.max(8, y - th - 12) + "px";
  }
  const escondeTip = () => { tip.hidden = true; };
  function interativo(g, titulo, linhas, aoClicar) {
    g.setAttribute("class", "marca-hover"); g.setAttribute("tabindex", "0");
    g.setAttribute("aria-label", titulo + ": " + linhas.map(l => l[0] + " " + l[1]).join(", "));
    const mostra = ev => mostraTip(ev, titulo, linhas);
    g.addEventListener("pointermove", mostra); g.addEventListener("focus", mostra);
    g.addEventListener("pointerleave", escondeTip); g.addEventListener("blur", escondeTip);
    if (aoClicar) { g.addEventListener("click", aoClicar); g.addEventListener("keydown", e => { if (e.key === "Enter") aoClicar(); }); }
  }
  function legenda(id, itens) {   // itens: [cor, rótulo, tipo ("ponto" | "ret" | "lin")]
    const c = $(id); c.innerHTML = "";
    itens.forEach(([cor, rot, tipo]) => {
      const s = document.createElement("span"), i = document.createElement("i");
      if (tipo === "lin") { i.className = "lin"; i.style.color = cor; } else { i.className = tipo === "ret" ? "ret" : ""; i.style.background = cor; }
      s.appendChild(i); s.appendChild(document.createTextNode(rot)); c.appendChild(s);
    });
  }
  const irParaEscola = inep => { abrirAba("camadas"); setTimeout(() => G.selecionarEscola(inep, true), 60); };

  // ---------- Indicadores-resumo ----------
  function tiles(es) {
    const dy = defY(st.y);
    const ys = es.map(e => e.p[st.y]).filter(v => v != null);
    const n = r => es.filter(e => e.p.dependencia === r).length;
    const mat = es.reduce((s, e) => s + (e.p.mat_total || 0), 0);
    // quarto quadro: quantas escolas estão acima do resultado do Estado (ou melhoraram, na variação do IDEB)
    const com = es.filter(e => e.p[st.y] != null);
    let q4;
    if (dy.div) {
      const k = com.filter(e => e.p[st.y] > 0).length;
      q4 = ["Escolas que melhoraram desde 2023", com.length ? `${fmt(k)} de ${fmt(com.length)}` : "–", "escolas com IDEB em 2023 e em 2025"];
    } else {
      const comRef = com.filter(e => G.fontes[dy.fonte].ref(e.p.dependencia, st.y)[1] != null);
      const k = comRef.filter(e => e.p[st.y] >= G.fontes[dy.fonte].ref(e.p.dependencia, st.y)[1]).length;
      q4 = ["Escolas acima da média do Estado", comRef.length ? `${fmt(k)} de ${fmt(comRef.length)}` : "–", "comparadas com a média da mesma rede em SP"];
    }
    const itens = [
      ["Escolas no recorte", fmt(es.length), `${fmt(n("Estadual"))} estaduais · ${fmt(n("Municipal"))} municipais`],
      ["Matrículas", fmt(mat), es.length ? `média de ${fmt(mat / es.length)} por escola` : ""],
      [`Média · ${dy.curto}`, ys.length ? fmtY(media(ys)) : "–", `média de ${fmt(ys.length)} escolas com resultado`],
      q4,
    ];
    const cont = $("da-tiles"); cont.innerHTML = "";
    itens.forEach(([r, v, s]) => {
      const d = document.createElement("div"); d.className = "tile";
      const a = document.createElement("span"); a.textContent = r;
      const b = document.createElement("b"); b.textContent = v;
      const sm = document.createElement("small"); sm.textContent = s;
      d.append(a, b, sm); cont.appendChild(d);
    });
  }

  // ---------- Dispersão: entorno (x) × desempenho (y) ----------
  function dispersao(es) {
    const cont = $("da-disp"), dy = defY(st.y), dx = defX(st.x);
    $("da-sub-disp").textContent = `Cada ponto é uma escola. Quanto mais à direita, maior a ${dx.nome.toLowerCase()} no entorno da escola; quanto mais alto, maior o resultado em ${dy.nomeFonte} (${dy.nome}).`;
    const pts = es.filter(e => e.p[st.y] != null && valX(e) != null);
    legenda("da-leg-disp", redesAtivas().map(r => [REDES[r].cor, REDES[r].rotulo, "ponto"]));
    if (pts.length < 2) return vazio(cont, "Sem escolas com os dois valores neste recorte.");
    const { svg, W, H } = novoSvg(cont, 300), m = { l: 52, r: 14, t: 10, b: 40 };
    const xs = pts.map(e => valX(e)), ys = pts.map(e => e.p[st.y]);
    const tx = niceTicks(Math.min(...xs), Math.max(...xs)), ty = niceTicks(Math.min(...ys), Math.max(...ys));
    const X = v => m.l + (v - tx[0]) / (tx[tx.length - 1] - tx[0]) * (W - m.l - m.r);
    const Y = v => H - m.b - (v - ty[0]) / (ty[ty.length - 1] - ty[0]) * (H - m.t - m.b);
    const grade = el("g", { class: "grade" }, svg), eixo = el("g", { class: "eixo" }, svg);
    const cx = casasTick(tx), cy = casasTick(ty);
    ty.forEach(v => { el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, grade); texto(eixo, m.l - 6, Y(v) + 4, fmt(v, cy), { "text-anchor": "end" }); });
    tx.forEach(v => { el("line", { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b }, grade); texto(eixo, X(v), H - m.b + 16, fmt(v, cx), { "text-anchor": "middle" }); });
    texto(eixo, (m.l + W - m.r) / 2, H - 4, `${dx.nome} no entorno da escola (${dx.unidade})`, { "text-anchor": "middle" });
    // pontos (anel de 2px na cor da superfície; alvo de 24px)
    pts.forEach(e => {
      const g = el("g", {}, svg), x = X(valX(e)), y = Y(e.p[st.y]);
      el("circle", { cx: x, cy: y, r: 12, fill: "transparent" }, g);
      el("circle", { class: "vis", cx: x, cy: y, r: 5, fill: REDES[e.p.dependencia].cor, stroke: "#fff", "stroke-width": 2 }, g);
      interativo(g, G.titulo(e.p.nome), [[fmtY(e.p[st.y]), dy.curto, REDES[e.p.dependencia].cor], [fmtX(valX(e)), dx.nome.toLowerCase() + " no entorno"],
        [G.titulo(e.p.bairro_ibge || "") || "fora dos bairros", "· clique para ver no mapa"]], () => irParaEscola(e.p.co_inep));
    });
  }

  // ---------- Médias por faixa (quintis do entorno entre todos os setores da cidade) ----------
  function faixas(es) {
    const cont = $("da-faixas"), dy = defY(st.y), dx = defX(st.x);
    const vs = VALS_SETOR(st.x), q = [1, 2, 3, 4].map(i => vs[Math.floor(i / 5 * (vs.length - 1))]);
    const lim = [vs[0], ...q, vs[vs.length - 1]];
    const classe = v => { let i = 0; while (i < q.length && v > q[i]) i++; return i; };
    $("da-sub-faixas").textContent = `As áreas da cidade (setores do Censo) foram separadas em 5 faixas de ${dx.nome.toLowerCase()}, da mais baixa (faixa 1) à mais alta (faixa 5). Cada ponto é a média de ${dy.curto} das escolas daquela faixa.`;
    const series = redesAtivas();
    legenda("da-leg-faixas", series.map(r => [REDES[r].cor, REDES[r].rotulo, "ponto"]));
    const dados = series.map(r => [0, 1, 2, 3, 4].map(i => {
      const v = es.filter(e => e.p.dependencia === r && e.p[st.y] != null && valX(e) != null && classe(valX(e)) === i).map(e => e.p[st.y]);
      return { m: media(v), n: v.length };
    }));
    const todos = dados.flat().filter(d => d.m != null).map(d => d.m);
    if (!todos.length) return vazio(cont, "Sem escolas com os dois valores neste recorte.");
    const { svg, W, H } = novoSvg(cont, 300), m = { l: 52, r: 14, t: 14, b: 52 };
    const ty = niceTicks(Math.min(...todos), Math.max(...todos), 4), cy = casasTick(ty);
    const Y = v => H - m.b - (v - ty[0]) / (ty[ty.length - 1] - ty[0]) * (H - m.t - m.b);
    const banda = (W - m.l - m.r) / 5;
    const grade = el("g", { class: "grade" }, svg), eixo = el("g", { class: "eixo" }, svg);
    ty.forEach(v => { el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, grade); texto(eixo, m.l - 6, Y(v) + 4, fmt(v, cy), { "text-anchor": "end" }); });
    [0, 1, 2, 3, 4].forEach(i => {
      const cx = m.l + banda * (i + 0.5);
      texto(eixo, cx, H - m.b + 16, `Faixa ${i + 1}`, { "text-anchor": "middle" });
      texto(eixo, cx, H - m.b + 30, `${fmtX(lim[i]).replace("R$ ", "")}–${fmtX(lim[i + 1]).replace("R$ ", "")}`, { "text-anchor": "middle" });
    });
    texto(eixo, (m.l + W - m.r) / 2, H - 4, `${dx.nome} no entorno da escola (${dx.unidade})`, { "text-anchor": "middle" });
    // linhas ligando as médias de cada rede + pontos
    series.forEach((r, si) => {
      const off = series.length > 1 ? (si - (series.length - 1) / 2) * 12 : 0;
      const p = dados[si].map((d, i) => d.m == null ? null : [m.l + banda * (i + 0.5) + off, Y(d.m)]);
      let dpath = ""; p.forEach((pt, i) => { if (!pt) return; dpath += (dpath && p[i - 1] ? "L" : "M") + pt[0] + " " + pt[1]; });
      el("path", { d: dpath, fill: "none", stroke: REDES[r].cor, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round", opacity: 0.6 }, svg);
      dados[si].forEach((d, i) => {
        if (d.m == null) return;
        const g = el("g", {}, svg), [x, y] = p[i];
        el("circle", { cx: x, cy: y, r: 12, fill: "transparent" }, g);
        el("circle", { class: "vis", cx: x, cy: y, r: 5.5, fill: REDES[r].cor, stroke: "#fff", "stroke-width": 2 }, g);
        interativo(g, `${REDES[r].rotulo} · faixa ${i + 1}`, [[fmtY(d.m), `média de ${dy.curto}`, REDES[r].cor], [fmt(d.n), d.n === 1 ? "escola" : "escolas"],
          [`${fmtX(lim[i])} a ${fmtX(lim[i + 1])}`, "no entorno"]]);
      });
    });
  }

  // ---------- Distribuição por rede (pontos) com média e referência estadual ----------
  function distribuicao(es) {
    const cont = $("da-dist"), dy = defY(st.y);
    const series = redesAtivas().filter(r => es.some(e => e.p.dependencia === r && e.p[st.y] != null));
    $("da-sub-dist").textContent = `Cada ponto é uma escola; o traço escuro é a média das escolas e o losango, o valor oficial da rede no Estado de SP.`;
    if (!series.length) return vazio(cont, "Nenhuma escola com resultado neste recorte.");
    const linhaH = 88, { svg, W, H } = novoSvg(cont, 30 + series.length * linhaH + 34), m = { l: 112, r: 18, t: 18, b: 34 };
    const vals = es.map(e => e.p[st.y]).filter(v => v != null);
    const refs = series.map(r => G.fontes[dy.fonte].ref(r, st.y));
    refs.forEach(([, e]) => { if (e != null) vals.push(e); });
    const tx = niceTicks(Math.min(...vals), Math.max(...vals)), cx = casasTick(tx);
    const X = v => m.l + (v - tx[0]) / (tx[tx.length - 1] - tx[0]) * (W - m.l - m.r);
    const grade = el("g", { class: "grade" }, svg), eixo = el("g", { class: "eixo" }, svg);
    tx.forEach(v => { el("line", { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b }, grade); texto(eixo, X(v), H - m.b + 16, fmt(v, cx), { "text-anchor": "middle" }); });
    series.forEach((r, si) => {
      const yc = m.t + linhaH * (si + 0.5);
      texto(svg, 0, yc + 4, REDES[r].rotulo, { class: "rot" });
      const es2 = es.filter(e => e.p.dependencia === r && e.p[st.y] != null);
      es2.forEach(e => {
        const h = (e.p.co_inep * 2654435761 % 1000) / 1000;   // espalhamento vertical fixo por escola
        const g = el("g", {}, svg), x = X(e.p[st.y]), y = yc - 15 + h * 30;
        el("circle", { cx: x, cy: y, r: 10, fill: "transparent" }, g);
        el("circle", { class: "vis", cx: x, cy: y, r: 4.5, fill: REDES[r].cor, stroke: "#fff", "stroke-width": 2, "fill-opacity": 0.9 }, g);
        interativo(g, G.titulo(e.p.nome), [[fmtY(e.p[st.y]), dy.curto, REDES[r].cor], ["", "clique para ver no mapa"]], () => irParaEscola(e.p.co_inep));
      });
      const md = media(es2.map(e => e.p[st.y]));
      el("line", { x1: X(md), x2: X(md), y1: yc - 21, y2: yc + 21, stroke: COR_TEXTO, "stroke-width": 2.5, "stroke-linecap": "round" }, svg);
      texto(svg, X(md), yc - 26, `média ${fmtY(md)}`, { class: "rot", "text-anchor": "middle" });
      const [, est, pub] = refs[si];
      if (est != null) {
        const g = el("g", {}, svg), x = X(est), y = yc + 29;
        el("rect", { x: x - 10, y: y - 10, width: 20, height: 20, fill: "transparent" }, g);
        el("path", { class: "vis", d: `M${x} ${y - 6}L${x + 6} ${y}L${x} ${y + 6}L${x - 6} ${y}Z`, fill: "#fff", stroke: COR_TEXTO, "stroke-width": 1.5 }, g);
        interativo(g, `Estado de SP · ${pub ? "rede pública" : REDES[r].rotulo.toLowerCase()}`, [[fmtY(est), dy.curto]]);
      }
    });
  }

  // ---------- Matrículas por etapa (barras horizontais agrupadas por rede) ----------
  function matriculas(es) {
    const cont = $("da-mat");
    const ETAPAS = [["mat_creche", "Creche"], ["mat_pre", "Pré-escola"], ["mat_fund_ai", "Fund. anos iniciais"], ["mat_fund_af", "Fund. anos finais"],
      ["mat_medio", "Ensino médio"], ["mat_eja", "EJA"], ["mat_especial", "Ed. especial"], ["mat_prof", "Ed. profissional"]];
    const series = redesAtivas();
    const dados = ETAPAS.map(([k, n]) => ({ n, v: series.map(r => es.filter(e => e.p.dependencia === r).reduce((s, e) => s + (e.p[k] || 0), 0)) }))
      .filter(d => d.v.some(x => x > 0));
    $("da-sub-mat").textContent = `Censo Escolar 2025 · ${fmt(es.reduce((s, e) => s + (e.p.mat_total || 0), 0))} matrículas no recorte.`;
    legenda("da-leg-mat", series.length > 1 ? series.map(r => [REDES[r].cor, REDES[r].rotulo, "ret"]) : []);
    if (!dados.length) return vazio(cont, "Sem matrículas neste recorte.");
    const barra = series.length > 1 ? 11 : 16, gap = 2, grupo = series.length * barra + (series.length - 1) * gap, passo = grupo + 16;
    const m = { l: 130, r: 64, t: 6, b: 24 }, { svg, W, H } = novoSvg(cont, m.t + dados.length * passo + m.b);
    const max = Math.max(...dados.flatMap(d => d.v)), tx = niceTicks(0, max, 4);
    const X = v => m.l + v / tx[tx.length - 1] * (W - m.l - m.r);
    const grade = el("g", { class: "grade" }, svg), eixo = el("g", { class: "eixo" }, svg);
    tx.forEach(v => { el("line", { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b }, grade); texto(eixo, X(v), H - m.b + 16, tx[tx.length - 1] >= 10000 && v ? fmt(v / 1000, v % 1000 ? 1 : 0) + " mil" : fmt(v), { "text-anchor": "middle" }); });
    el("line", { class: "base", x1: m.l, x2: m.l, y1: m.t, y2: H - m.b }, svg);
    dados.forEach((d, i) => {
      const y0 = m.t + i * passo + 8;
      texto(svg, m.l - 8, y0 + grupo / 2 + 4, d.n, { class: "rot", "text-anchor": "end" });
      d.v.forEach((v, si) => {
        if (!v) return;
        const y = y0 + si * (barra + gap), w = Math.max(1, X(v) - m.l), rr = Math.min(4, w / 2);
        const g = el("g", {}, svg);
        el("rect", { x: m.l, y: y - 2, width: Math.max(w, 24), height: barra + 4, fill: "transparent" }, g);
        // ponta arredondada (4px) e base reta
        el("path", { class: "vis", fill: REDES[series[si]].cor,
          d: `M${m.l} ${y}H${m.l + w - rr}Q${m.l + w} ${y} ${m.l + w} ${y + rr}V${y + barra - rr}Q${m.l + w} ${y + barra} ${m.l + w - rr} ${y + barra}H${m.l}Z` }, g);
        texto(svg, m.l + w + 6, y + barra / 2 + 4, fmt(v), { class: "rot" });
        interativo(g, d.n, [[fmt(v), `matrículas · ${REDES[series[si]].rotulo.toLowerCase()}`, REDES[series[si]].cor]]);
      });
    });
  }

  // ---------- Tabela ordenável (também é a "visão em tabela" dos gráficos) ----------
  function tabela(es) {
    const dy = defY(st.y), dx = defX(st.x);
    const cols = [
      { k: "nome", t: "Escola", v: e => G.titulo(e.p.nome) },
      { k: "rede", t: "Rede", v: e => e.p.dependencia },
      { k: "bairro", t: "Bairro (IBGE)", v: e => G.titulo(e.p.bairro_ibge || "") },
      { k: "mat", t: "Matrículas", v: e => e.p.mat_total, n: true, f: v => fmt(v) },
      { k: "y", t: dy.curto, v: e => e.p[st.y], n: true, f: v => fmtY(v) },
      { k: "x", t: `${dx.nome} no entorno da escola`, dica: "Dado do Censo 2022 para a pequena área (setor censitário) onde fica o prédio da escola. Não é a situação das famílias dos alunos, que podem morar em outros lugares.", v: e => valX(e), n: true, f: v => fmtX(v) },
    ];
    const c = cols.find(x => x.k === st.ord.col) || cols[4];
    const lin = es.slice().sort((a, b) => {
      const va = c.v(a), vb = c.v(b);
      if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
      return (c.n ? va - vb : String(va).localeCompare(String(vb), "pt-BR")) * st.ord.dir;
    });
    const t = $("da-tabela"); t.innerHTML = "";
    const th = t.createTHead().insertRow();
    cols.forEach(col => {
      const h = document.createElement("th"); h.textContent = col.t; if (col.n) h.className = "n"; if (col.dica) h.title = col.dica;
      h.setAttribute("scope", "col"); h.tabIndex = 0;
      if (col.k === st.ord.col) h.setAttribute("aria-sort", st.ord.dir > 0 ? "ascending" : "descending");
      const ordena = () => { st.ord = { col: col.k, dir: st.ord.col === col.k ? -st.ord.dir : (col.n ? -1 : 1) }; tabela(recorte()); };
      h.onclick = ordena; h.onkeydown = e => { if (e.key === "Enter") ordena(); };
      th.appendChild(h);
    });
    const tb = t.createTBody();
    lin.forEach(e => {
      const r = tb.insertRow();
      cols.forEach((col, i) => {
        const td = r.insertCell(), v = col.v(e);
        if (col.n) td.className = "n";
        if (i === 0) {
          const a = document.createElement("a"); a.href = "#"; a.textContent = v;
          a.onclick = ev => { ev.preventDefault(); irParaEscola(e.p.co_inep); }; td.appendChild(a);
        } else if (i === 1) {
          const s = document.createElement("span"); s.className = "pto-mini"; s.style.background = REDES[v].cor;
          td.append(s, document.createTextNode(REDES[v].rotulo.replace("Rede ", "")));
        } else td.textContent = col.f ? col.f(v) : (v || "–");
      });
    });
  }
  $("da-csv").onclick = () => {
    const es = recorte();
    const q = s => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"', n = v => v == null ? "" : String(v).replace(".", ",");
    const linhas = [["co_inep", "escola", "rede", "bairro_ibge", "cd_setor", "matriculas", st.y, st.x].join(";")]
      .concat(es.map(e => [e.p.co_inep, q(e.p.nome), e.p.dependencia, q(e.p.bairro_ibge), e.p.cd_setor || "", e.p.mat_total, n(e.p[st.y]), n(valX(e))].join(";")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `analise_${st.y}_x_${st.x}.csv`; a.click();
  };

  // ---------- Montagem ----------
  function desenhar() {
    if ($("pagina-analise").hidden || !G) return;
    escondeTip();
    const es = recorte();
    tiles(es); dispersao(es); faixas(es); distribuicao(es); matriculas(es); tabela(es);
  }
  function iniciar() {
    G = window.GEO;
    const sy = $("da-y");
    Object.entries(G.fontes).forEach(([f, F]) => {
      const og = document.createElement("optgroup"); og.label = F.nome;
      Object.entries(F.vars).forEach(([k, d]) => og.appendChild(new Option(d.nome, k)));
      sy.appendChild(og);
    });
    sy.value = st.y;
    const sx = $("da-x");
    Object.entries(CONFIG.variaveis).forEach(([k, d]) => sx.add(new Option(d.nome, k)));
    sx.value = st.x;
    const sb = $("da-bairro");
    DATA_BAIRROS.features.map(f => f.properties.bairro).sort((a, b) => a.localeCompare(b, "pt-BR")).forEach(b => sb.add(new Option(G.titulo(b), b)));
    sb.add(new Option("Fora dos bairros (área rural)", FORA));
    $("da-rede").onchange = e => { st.rede = e.target.value; desenhar(); };
    sb.onchange = e => { st.bairro = e.target.value; desenhar(); };
    sy.onchange = e => { st.y = e.target.value; if (st.ord.col === "y") st.ord.dir = -1; desenhar(); };
    sx.onchange = e => { st.x = e.target.value; desenhar(); };
    document.addEventListener("aba-analise", () => setTimeout(desenhar, 0));
    let tr; addEventListener("resize", () => { clearTimeout(tr); tr = setTimeout(desenhar, 150); });
    $("pagina-analise").addEventListener("scroll", escondeTip);
  }
  if (window.GEO) iniciar(); else document.addEventListener("geo-pronto", iniciar);
})();

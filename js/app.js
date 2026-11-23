/* Geoportal das Escolas Públicas de Piracicaba – Leaflet, sem build. Dados em data/*.js */
(function () {
  const $ = id => document.getElementById(id);
  const fmt = (v, casas = 0) =>
    v == null || isNaN(v) ? "–" :
    Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const esc = s => s == null ? "" : String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const titulo = s => s ? s.toLowerCase()
    .replace(/(^|\s|\(|\/|-)(\S)/g, (m, a, b) => a + b.toUpperCase())
    .replace(/(\s)(De|Da|Do|Das|Dos|E|Em)(?=\s)/g, (m, a, w) => a + w.toLowerCase())
    .replace(/\b(Ee|Em|Emef|Emei|Cei|Ceti|Ceeja|Ceu|Eja|Apae|Ii|Iii|Iv|Sesi|Senai|Etec)\b/g, w => w.toUpperCase()) : "";
  const valor = (v, k) => {
    const d = CONFIG.variaveis[k]; if (v == null || isNaN(v)) return "–";
    return d.unidade === "R$" ? "R$ " + fmt(v, d.casas) : d.unidade === "%" ? fmt(v, d.casas) + "%" :
           d.unidade === "SM" ? fmt(v, d.casas) + " SM" : fmt(v, d.casas);
  };

  const ESC = window.DATA_ESCOLAS, SET = window.DATA_SETORES, BAI = window.DATA_BAIRROS,
        LIM = window.DATA_LIMITE, REF = window.DATA_SARESP_REF || {}, REFI = window.DATA_IDEB_REF || {};
  const REDES = CONFIG.redes, SAR = CONFIG.saresp;
  // variação do IDEB 2023 → 2025 (calculada aqui para não duplicar no arquivo)
  ESC.features.forEach(({ properties: p }) => ["ai", "af", "em"].forEach(k => {
    p[`ideb_${k}_var`] = p[`ideb_${k}`] != null && p[`ideb_${k}_2023`] != null ? Math.round((p[`ideb_${k}`] - p[`ideb_${k}_2023`]) * 10) / 10 : null;
  }));
  // referência oficial (Piracicaba e Estado) da mesma rede: [municipio, estado, estado_usou_rede_publica]
  function refInep(rede, v) {
    const [, et, campo] = v.split("_"), r = REFI[rede.toLowerCase()] || {}, pub = REFI["pública"] || {};
    const pega = (o, varia) => {
      if (!o) return null;
      if (v.startsWith("ideb_")) return varia ? (o.ideb != null && o.ideb_2023 != null ? o.ideb - o.ideb_2023 : null) : o.ideb;
      return o[campo];
    };
    const varia = v.endsWith("_var"), em = r.municipio && r.municipio[et];
    const ee = r.estado && r.estado[et], ep = pub.estado && pub.estado[et];
    return [pega(em, varia), pega(ee || ep, varia), !ee && !!ep];
  }
  const FONTES = {
    saresp: { nome: "SARESP 2025", vars: SAR, fonte: "SEDUC-SP – SARESP 2025",
              ref: (rede, v) => { const r = REF[rede.toLowerCase()] || {}, kk = v.replace("saresp_", ""); return [r.municipio && r.municipio[kk], r.estado && r.estado[kk], false]; } },
    saeb: { nome: "SAEB 2025", vars: CONFIG.saeb, fonte: "INEP – SAEB 2025", ref: refInep },
    ideb: { nome: "IDEB 2025", vars: CONFIG.ideb, fonte: "INEP – IDEB 2025", ref: refInep },
  };
  const FORA = "__fora__";   // escolas fora dos bairros do IBGE (área rural)

  // ---------- Estado ----------
  const estado = {
    redes: new Set(Object.keys(REDES)), etapa: "", tamMat: false, rotEsc: false,
    desemp: null,   // fonte que colore as escolas: null (rede), "saresp", "saeb" ou "ideb"
    df: { saresp: { v: "saresp_5ef_lp", classe: "fixa", so: false, q: [] },
          saeb: { v: "saeb_ai_mat", classe: "quantil", so: false, q: [] },
          ideb: { v: "ideb_ai", classe: "fixa", so: false, q: [] } },
    terr: true, unidade: "setores", variavel: "renda_media", classe: "quantil", opacidade: 0.65, quebras: [],
    bairro: "", sel: null,
  };

  // ---------- Mapa, painéis (ordem de desenho) e mapas de fundo ----------
  const mapa = L.map("mapa", { zoomControl: true, preferCanvas: true }).setView(CONFIG.centro, CONFIG.zoom);
  [["terr", 400], ["bairros", 430], ["limite", 450], ["escolas", 460]].forEach(([n, z]) => { mapa.createPane(n).style.zIndex = z; });
  mapa.getPane("limite").style.pointerEvents = mapa.getPane("bairros").style.pointerEvents = "none";
  const rCanvas = {};
  ["terr", "bairros", "limite", "escolas"].forEach(p => rCanvas[p] = L.canvas({ pane: p, padding: 0.3, tolerance: p === "escolas" ? 3 : 0 }));

  // crossOrigin: necessário para o "Monte seu mapa" conseguir copiar os blocos do fundo para a imagem
  const fundos = {
    "Cinza claro (Esri)": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, maxNativeZoom: 16, crossOrigin: "anonymous", fonte: "Esri World Light Gray",
      attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap" }),
    "OpenStreetMap": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, crossOrigin: "anonymous", fonte: "© colaboradores do OpenStreetMap",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }),
    "Imagem de satélite (Esri)": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, crossOrigin: "anonymous", fonte: "Esri World Imagery", attribution: "Tiles &copy; Esri" }),
  };
  fundos[CONFIG.fundo_inicial].addTo(mapa);
  let opacFundo = CONFIG.opacidade_fundo;
  Object.values(fundos).forEach(l => l.setOpacity(opacFundo));
  L.control.layers(fundos, null, { position: "topleft" }).addTo(mapa);
  L.control.scale({ imperial: false }).addTo(mapa);

  const hover = L.control({ position: "bottomright" });
  hover.onAdd = function () { this._div = L.DomUtil.create("div", "info-hover"); this.update(); return this._div; };
  hover.update = function (html) { this._div.innerHTML = html || "Passe o mouse ou clique no mapa para consultar"; };
  hover.addTo(mapa);

  // ---------- Classificação ----------
  function quebrasQuantil(vals, k) {
    const q = []; for (let i = 1; i < k; i++) q.push(vals[Math.floor((i / k) * (vals.length - 1))]); return q;
  }
  function quebrasIguais(vals, k) {
    const min = vals[0], max = vals[vals.length - 1], q = [];
    for (let i = 1; i < k; i++) q.push(min + ((max - min) * i) / k); return q;
  }
  function quebrasJenks(d, k) {
    const n = d.length, lim = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
    const vari = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(Infinity));
    for (let j = 1; j <= k; j++) { lim[1][j] = 1; vari[1][j] = 0; }
    for (let l = 2; l <= n; l++) {
      let s1 = 0, s2 = 0, w = 0, v = 0;
      for (let m = 1; m <= l; m++) {
        const i3 = l - m + 1, val = d[i3 - 1];
        s2 += val * val; s1 += val; w++; v = s2 - (s1 * s1) / w;
        const i4 = i3 - 1;
        if (i4 !== 0) for (let j = 2; j <= k; j++)
          if (vari[l][j] >= v + vari[i4][j - 1]) { lim[l][j] = i3; vari[l][j] = v + vari[i4][j - 1]; }
      }
      lim[l][1] = 1; vari[l][1] = v;
    }
    const q = []; let kk = n;
    for (let j = k; j >= 2; j--) { const id = lim[kk][j] - 2; q.unshift(d[id]); kk = lim[kk][j] - 1; }
    return q;
  }
  const classeDe = (v, q) => { if (v == null || isNaN(v)) return -1; let i = 0; while (i < q.length && v > q[i]) i++; return i; };

  // ---------- Território (setores / bairros) ----------
  const dadosTerr = () => estado.unidade === "setores" ? SET : BAI;
  const noBairro = p => !estado.bairro || (estado.bairro === FORA ? !p.bairro : p.bairro === estado.bairro);
  function calcularQuebras() {
    const vals = dadosTerr().features.map(f => f.properties[estado.variavel])
      .filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
    const fn = { quantil: quebrasQuantil, jenks: quebrasJenks, igual: quebrasIguais }[estado.classe];
    estado.quebras = vals.length ? [...new Set(fn(vals, 5))] : [];
    estado.min = vals[0]; estado.max = vals[vals.length - 1];
  }
  const corTerr = v => { const i = classeDe(v, estado.quebras); return i < 0 ? "#cccccc" : CONFIG.cores_terr[Math.min(i, 4)]; };
  const estiloTerr = f => {
    const fora = !noBairro(f.properties);
    return { fillColor: corTerr(f.properties[estado.variavel]), fillOpacity: fora ? estado.opacidade * 0.3 : estado.opacidade,
             color: "#ffffff", weight: estado.unidade === "setores" ? 0.4 : 1.1, opacity: fora ? 0.25 : 0.8 };
  };
  let camadaTerr = null;
  function desenharTerr() {
    if (camadaTerr) mapa.removeLayer(camadaTerr);
    calcularQuebras();
    camadaTerr = L.geoJSON(dadosTerr(), {
      renderer: rCanvas.terr, style: estiloTerr,
      onEachFeature: (f, l) => l.on({
        mouseover: e => {
          e.target.setStyle({ weight: 2, color: "#2a2550" });
          const p = f.properties, v = CONFIG.variaveis[estado.variavel];
          hover.update(`<h4>${estado.unidade === "setores" ? "Setor " + p.cd_setor : esc(p.bairro)}</h4>
            ${estado.unidade === "setores" && p.bairro ? esc(p.bairro) + "<br>" : ""}<b>${v.nome}:</b> ${valor(p[estado.variavel], estado.variavel)}`);
        },
        mouseout: e => { camadaTerr.resetStyle(e.target); hover.update(); },
        click: e => { L.DomEvent.stop(e); fichaTerritorio(f.properties); },
      }),
    });
    if (estado.terr) camadaTerr.addTo(mapa);
    legendaTerr();
  }
  function legendaTerr() {
    const v = CONFIG.variaveis[estado.variavel];
    const lim = [estado.min, ...estado.quebras, estado.max];
    let html = `<div class="nota" style="margin-bottom:6px">${v.unidade} · por ${estado.unidade === "setores" ? "setor censitário" : "bairro"}</div>`;
    for (let i = 0; i < lim.length - 1; i++)
      html += `<div class="item"><span class="cor" style="background:${CONFIG.cores_terr[Math.min(i, 4)]}"></span>${fmt(lim[i], v.casas)} – ${fmt(lim[i + 1], v.casas)}</div>`;
    html += `<div class="item"><span class="cor" style="background:#cccccc"></span>Sem dado / sigilo</div>`;
    $("legenda").innerHTML = html; $("desc-var").textContent = v.desc;
  }

  // ---------- Limite e bairros ----------
  const camadaLim = L.geoJSON(LIM, { renderer: rCanvas.limite, interactive: false,
    style: { color: "#2a2550", weight: 2.2, fill: false, opacity: 0.9 } }).addTo(mapa);
  const estiloBai = f => {
    const s = estado.bairro && estado.bairro === f.properties.bairro;
    return { color: s ? "#c2457a" : "#3a3360", weight: s ? 3 : 1, opacity: s ? 1 : 0.7, fill: false, dashArray: s ? null : "3 3" };
  };
  const camadaBai = L.geoJSON(BAI, { renderer: rCanvas.bairros, interactive: false, style: estiloBai });
  const rotulosBai = L.layerGroup(BAI.features.map(f =>
    L.tooltip({ permanent: true, direction: "center", className: "rotulo-bai" })
      .setLatLng(L.geoJSON(f).getBounds().getCenter()).setContent(titulo(f.properties.bairro))));
  // contorno de destaque do bairro escolhido (sempre visível)
  let destaqueBai = null;

  // ---------- Escolas ----------
  const camadaEsc = L.layerGroup().addTo(mapa);
  const rotulosEsc = L.layerGroup();
  const filtroBase = p => estado.redes.has(p.dependencia) && (!estado.etapa || (p.etapas || "").split("; ").includes(estado.etapa));
  const filtradas = () => ESC.features.filter(f => filtroBase(f.properties) &&
    (!estado.desemp || !DS().so || f.properties[DS().v] != null));

  // ---------- Desempenho (SARESP, SAEB, IDEB): a escola é colorida por uma fonte de cada vez ----------
  const DS = (f = estado.desemp) => estado.df[f];
  const varDef = (f, v) => FONTES[f].vars[v || DS(f).v];
  const cortes = f => DS(f).classe !== "quantil" && varDef(f).cortes;
  function coresDe(f) {
    const d = varDef(f);
    if (!cortes(f)) return CONFIG.cores_saresp_quantis;
    return d.div ? CONFIG.cores_var : f === "saresp" ? CONFIG.cores_niveis : CONFIG.cores_ideb;
  }
  function calcularQuebrasDes(f) {
    const c = cortes(f), s = DS(f);
    if (c) { s.q = c.slice(); return; }
    const vals = ESC.features.map(x => x.properties[s.v]).filter(v => v != null).sort((a, b) => a - b);
    s.q = vals.length ? [...new Set(quebrasQuantil(vals, 5))] : [];
  }
  function corEscola(p) {
    if (!estado.desemp) return REDES[p.dependencia].cor;
    const i = classeDe(p[DS().v], DS().q); if (i < 0) return null;
    const cores = coresDe(estado.desemp); return cores[Math.min(i, cores.length - 1)];
  }
  const raio = p => estado.tamMat ? Math.max(4, Math.min(18, 3 + Math.sqrt(p.mat_total || 0) / 2.2)) : 6.5;
  function desenharEscolas() {
    camadaEsc.clearLayers();
    const fs = filtradas().map(f => ({ f, cor: corEscola(f.properties) }));
    // sem resultado embaixo; escolas maiores embaixo das menores
    fs.sort((a, b) => (!!a.cor - !!b.cor) || (b.f.properties.mat_total - a.f.properties.mat_total));
    fs.forEach(({ f, cor }) => {
      const p = f.properties, [lon, lat] = f.geometry.coordinates, sel = estado.sel === p.co_inep;
      const fora = !noBairro({ bairro: p.bairro_ibge });
      const m = L.circleMarker([lat, lon], {
        renderer: rCanvas.escolas, radius: cor ? raio(p) : 3.6,
        fillColor: cor || CONFIG.cor_sem_dado, fillOpacity: fora ? 0.3 : cor ? 0.95 : 0.7,
        color: sel ? "#111" : "#ffffff", weight: sel ? 3 : 1.3, opacity: fora ? 0.4 : 1,
      });
      const sv = estado.desemp ? `<br><b>${varDef(estado.desemp).curto}:</b> ${fmt(p[DS().v], casasDe(estado.desemp))}` : "";
      m.on({
        mouseover: () => hover.update(`<h4>${esc(titulo(p.nome))}</h4>${REDES[p.dependencia].rotulo} · ${fmt(p.mat_total)} matrículas${sv}`),
        mouseout: () => hover.update(),
        click: e => { L.DomEvent.stop(e); selecionarEscola(p.co_inep, false); },
      });
      m.addTo(camadaEsc);
    });
    atualizaRotulosEsc(); legendaRedes(); legendasDes(); cartoes();
  }
  function atualizaRotulosEsc() {
    rotulosEsc.clearLayers();
    if (!estado.rotEsc || mapa.getZoom() < CONFIG.zoom_rotulos_escolas) { mapa.removeLayer(rotulosEsc); return; }
    const b = mapa.getBounds().pad(0.1);
    filtradas().forEach(f => {
      const [lon, lat] = f.geometry.coordinates; if (!b.contains([lat, lon])) return;
      L.tooltip({ permanent: true, direction: "right", offset: [7, 0], className: "rotulo-esc" })
        .setLatLng([lat, lon]).setContent(esc(titulo(f.properties.nome))).addTo(rotulosEsc);
    });
    rotulosEsc.addTo(mapa);
  }
  mapa.on("zoomend moveend", atualizaRotulosEsc);

  // lista das redes com contagem (interruptores)
  function legendaRedes() {
    const n = {};
    ESC.features.forEach(({ properties: p }) => {
      if (estado.etapa && !(p.etapas || "").split("; ").includes(estado.etapa)) return;
      if (!noBairro({ bairro: p.bairro_ibge })) return;
      n[p.dependencia] = (n[p.dependencia] || 0) + 1;
    });
    $("lista-redes").innerHTML = Object.entries(REDES).map(([k, r]) =>
      `<label class="chk"><input type="checkbox" data-rede="${k}" ${estado.redes.has(k) ? "checked" : ""}>
       <span class="pto" style="background:${estado.desemp ? CONFIG.cor_sem_dado : r.cor}"></span><span>${r.rotulo}</span><small>${fmt(n[k] || 0)}</small></label>`).join("");
    $("lista-redes").querySelectorAll("input").forEach(i => i.onchange = () => {
      i.checked ? estado.redes.add(i.dataset.rede) : estado.redes.delete(i.dataset.rede); desenharEscolas();
    });
  }

  // ---------- Desempenho: legenda e resumo por rede ----------
  const casasDe = (f, v) => { const d = varDef(f, v); return d.casas != null ? d.casas : f === "ideb" ? 1 : 1; };
  const rotCorte = (f, x) => f === "ideb" && varDef(f).div ? (x > 0 ? "+" : "") + fmt(x, 2) : fmt(x, f === "ideb" ? 1 : 0);
  function legendaDes(f) {
    const s = DS(f), d = varDef(f), c = cortes(f), q = s.q, cores = coresDe(f);
    const fs = filtradas().filter(x => noBairro({ bairro: x.properties.bairro_ibge }));
    const vals = fs.map(x => x.properties[s.v]).filter(v => v != null);
    const cont = new Array(q.length + 1).fill(0); vals.forEach(v => cont[classeDe(v, q)]++);
    let html = `<div class="nota" style="margin-bottom:6px">${d.nome} · ${c ? (f === "saresp" ? "níveis de proficiência" : "classes fixas") : "quantis"}</div>`;
    const lim = [vals.length ? Math.min(...vals) : 0, ...q, vals.length ? Math.max(...vals) : 0];
    for (let i = 0; i <= q.length; i++) {
      const faixa = c && d.div ? CONFIG.faixas_var[i] : c ? (i === 0 ? `< ${rotCorte(f, q[0])}` : i === q.length ? `≥ ${rotCorte(f, q[q.length - 1])}` : `${rotCorte(f, q[i - 1])} a ${rotCorte(f, q[i])}`)
                      : `${fmt(lim[i], casasDe(f))} – ${fmt(lim[i + 1], casasDe(f))}`;
      const nome = c && f === "saresp" ? CONFIG.niveis[i] : c && d.div ? CONFIG.rotulos_var[i] : faixa;
      html += `<div class="item"><span class="pto" style="background:${cores[Math.min(i, cores.length - 1)]}"></span>${nome} <span class="cod">${nome !== faixa ? faixa + " · " : ""}${cont[i]}</span></div>`;
    }
    html += `<div class="item"><span class="pto" style="background:${CONFIG.cor_sem_dado}"></span>Sem resultado</div>`;
    $(`legenda-${f}`).innerHTML = html;
    $(`legenda-${f}`).style.opacity = estado.desemp === f ? 1 : 0.5;

    // médias simples das escolas por rede x referências oficiais
    const linhas = Object.keys(REDES).map(rede => {
      const v = fs.filter(x => x.properties.dependencia === rede).map(x => x.properties[s.v]).filter(x => x != null);
      const [m, e, eRot] = FONTES[f].ref(rede, s.v);
      return `<tr><td>${REDES[rede].rotulo}</td><td>${v.length}</td><td>${v.length ? fmt(v.reduce((a, b) => a + b, 0) / v.length, casasDe(f)) : "–"}</td>
              <td>${fmt(m, casasDe(f))}</td><td>${fmt(e, casasDe(f))}${eRot ? "²" : ""}</td></tr>`;
    }).join("");
    $(`${f}-resumo`).innerHTML = `<h3>Resumo – ${esc(nomeBairroSel())}</h3><table class="tab-equip">
      <tr><th style="text-align:left">Rede</th><th>Escolas</th><th>Média*</th><th>Pira.</th><th>SP</th></tr>${linhas}</table>
      <p class="nota">*Média simples das escolas com resultado. “Pira.” e “SP”: valor oficial da rede em Piracicaba e no Estado.${f !== "saresp" ? " ²O INEP não divulga a rede municipal do Estado; usa-se a rede pública." : ""}</p>`;
  }
  const legendasDes = () => Object.keys(FONTES).forEach(legendaDes);

  // ---------- Cartão do bairro ----------
  const nomeBairroSel = () => !estado.bairro ? "Toda Piracicaba" : estado.bairro === FORA ? "Fora dos bairros (área rural)" : titulo(estado.bairro);
  const somaTerr = (fs, k) => fs.reduce((s, f) => s + (f.properties[k] || 0), 0);
  function cartoes() {
    const fs = filtradas().filter(f => noBairro({ bairro: f.properties.bairro_ibge }));
    const n = r => fs.filter(f => f.properties.dependencia === r).length;
    $("resumo").innerHTML = [
      [fmt(fs.length), "escolas públicas"], [fmt(somaTerr(fs, "mat_total")), "matrículas"],
      [fmt(n("Estadual")), "estaduais"], [fmt(n("Municipal")), "municipais"],
    ].map(([b, s]) => `<div class="cartao"><b>${b}</b><span>${s}</span></div>`).join("");
    infoBairro(fs);
  }
  function infoBairro(fs) {
    let p;
    if (estado.bairro && estado.bairro !== FORA) p = (BAI.features.find(f => f.properties.bairro === estado.bairro) || {}).properties;
    else {
      const st = SET.features.filter(f => noBairro(f.properties));
      const pop = somaTerr(st, "pop");
      const pondera = k => { let s = 0, w = 0; st.forEach(f => { const v = f.properties[k], d = f.properties.domicilios; if (v != null && d) { s += v * d; w += d; } }); return w ? s / w : null; };
      const alf = somaTerr(st, "analfabetos_15m");
      p = { pop, domicilios: somaTerr(st, "domicilios"), area_km2: somaTerr(st, "area_km2"), renda_media: pondera("renda_media"),
            alfabetizacao: pondera("alfabetizacao"), pct_0_14: pop ? 100 * (somaTerr(st, "pop_0_4") + somaTerr(st, "pop_5_9") + somaTerr(st, "pop_10_14")) / pop : null,
            analfabetos_15m: alf, n_setores: st.length };
    }
    if (!p) { $("info-mun").innerHTML = ""; return; }
    const docentes = somaTerr(fs, "docentes"), sar = fs.filter(f => f.properties.tem_saresp).length, ide = fs.filter(f => f.properties.tem_ideb).length;
    $("info-mun").innerHTML = `<table>
      <tr><td>População (2022)</td><td>${fmt(p.pop)}</td></tr>
      <tr><td>Domicílios ocupados</td><td>${fmt(p.domicilios)}</td></tr>
      <tr><td>Área</td><td>${fmt(p.area_km2, 1)} km²</td></tr>
      <tr><td>Renda média do resp.</td><td>${valor(p.renda_media, "renda_media")}</td></tr>
      <tr><td>Alfabetização 15+</td><td>${valor(p.alfabetizacao, "alfabetizacao")}</td></tr>
      <tr><td>População 0–14 anos</td><td>${valor(p.pct_0_14, "pct_0_14")}</td></tr>
      <tr><td>Docentes nas escolas*</td><td>${fmt(docentes)}</td></tr>
      <tr><td>Escolas com SARESP</td><td>${fmt(sar)}</td></tr>
      <tr><td>Escolas com SAEB/IDEB</td><td>${fmt(ide)}</td></tr></table>
      <p class="nota">*Soma por escola. Renda e alfabetização de “Toda Piracicaba” são médias dos setores ponderadas pelos domicílios.</p>`;
  }
  function folga() {
    const pm = $("painel-mun"), w = mapa.getSize().x;
    if (!pm || pm.hidden || pm.classList.contains("minimizado") || w < 700) return { padding: [20, 20] };
    return { paddingTopLeft: [20, 20], paddingBottomRight: [pm.offsetWidth + 24, 20] };
  }
  function selecionarBairro(b, enquadra = true) {
    estado.bairro = b; $("sel-mun").value = b;
    if (camadaTerr) camadaTerr.setStyle(estiloTerr);
    camadaBai.setStyle(estiloBai);
    if (destaqueBai) { mapa.removeLayer(destaqueBai); destaqueBai = null; }
    const f = b && b !== FORA && BAI.features.find(x => x.properties.bairro === b);
    if (f) destaqueBai = L.geoJSON(f, { renderer: rCanvas.bairros, interactive: false, style: { color: "#c2457a", weight: 3, fill: false } }).addTo(mapa);
    desenharEscolas();
    if (!enquadra) return;
    if (f) mapa.fitBounds(destaqueBai.getBounds(), folga());
    else if (b === FORA) { const pts = filtradas().filter(x => !x.properties.bairro_ibge).map(x => [x.geometry.coordinates[1], x.geometry.coordinates[0]]); if (pts.length) mapa.fitBounds(pts, folga()); }
    else mapa.fitBounds(camadaLim.getBounds(), folga());
  }

  // ---------- Ficha ----------
  const ficha = $("ficha"), corpo = $("ficha-corpo");
  function abrirFicha(html, cor) {
    corpo.innerHTML = html; ficha.style.setProperty("--c", cor || "var(--destaque)");
    ficha.hidden = false; ficha.scrollTop = 0;
  }
  $("ficha-fechar").onclick = () => { ficha.hidden = true; if (estado.sel) { estado.sel = null; desenharEscolas(); } };
  L.DomEvent.disableClickPropagation(ficha); L.DomEvent.disableScrollPropagation(ficha);

  function nivelDe(k, v) {
    const c = SAR[k].cortes; if (!c || v == null) return "";
    const i = classeDe(v, c); return `<br><span class="nivel" style="background:${CONFIG.cores_niveis[i]}">${CONFIG.niveis[i]}</span>`;
  }
  function fichaEscola(p) {
    const rede = REDES[p.dependencia], R = REF[p.dependencia.toLowerCase()] || {};
    const end = [p.logradouro, p.numero].filter(Boolean).join(", ") + (p.complemento ? " – " + p.complemento : "");
    const mats = [["Creche", p.mat_creche], ["Pré-escola", p.mat_pre], ["Fund. anos iniciais", p.mat_fund_ai], ["Fund. anos finais", p.mat_fund_af],
      ["Ensino médio", p.mat_medio], ["Ed. profissional", p.mat_prof], ["EJA", p.mat_eja], ["Ed. especial", p.mat_especial]].filter(x => x[1] > 0);
    const mx = Math.max(1, ...mats.map(x => x[1]));
    const ks = Object.keys(SAR).filter(k => p[k] != null);
    const sar = ks.length
      ? `<table class="tab-sar"><tr><th>Ano / componente</th><th>Escola</th><th>Pira.¹</th><th>SP¹</th></tr>` + ks.map(k => {
          const kk = k.replace("saresp_", ""), m = R.municipio && R.municipio[kk], e = R.estado && R.estado[kk], v = p[k];
          return `<tr><td>${SAR[k].nome}${nivelDe(k, v)}</td><td class="${e != null ? (v >= e ? "acima" : "abaixo") : ""}"><b>${fmt(v, 1)}</b></td><td>${fmt(m, 1)}</td><td>${fmt(e, 1)}</td></tr>`;
        }).join("") + `</table><p class="nota">¹ Média da ${rede.rotulo.toLowerCase()} em Piracicaba e no Estado de SP. Verde: acima da média estadual da rede.</p>`
      : `<p class="nota">Sem resultado divulgado (a escola não oferece o 2º, 5º ou 9º ano do EF avaliados, ou não participou).</p>`;
    // SAEB e IDEB 2025 (INEP)
    const ETS = [["ai", "Anos iniciais", "5º EF"], ["af", "Anos finais", "9º EF"], ["em", "Ensino médio", "3ª EM"]]
      .filter(([k]) => p[`ideb_${k}`] != null || p[`saeb_${k}_mat`] != null);
    const cel = (v, ref, c) => `<td class="${ref != null && v != null ? (v >= ref ? "acima" : "abaixo") : ""}"><b>${fmt(v, c)}</b></td>`;
    const ideb = ETS.length
      ? `<table class="tab-sar"><tr><th>Etapa</th><th>2025</th><th>2023</th><th>Pira.¹</th><th>SP¹</th></tr>` + ETS.map(([k, n]) => {
          const [m, e, pub] = refInep(p.dependencia, `ideb_${k}`), v = p[`ideb_${k}`], d = p[`ideb_${k}_var`];
          const dv = d == null ? "" : `<br><span class="nivel" style="background:${CONFIG.cores_var[classeDe(d, CONFIG.ideb.ideb_ai_var.cortes)]}">${d > 0 ? "+" : ""}${fmt(d, 1)} desde 2023</span>`;
          return `<tr><td>${n}${dv}</td>${cel(v, e, 1)}<td>${fmt(p[`ideb_${k}_2023`], 1)}</td><td>${fmt(m, 1)}</td><td>${fmt(e, 1)}${pub ? "²" : ""}</td></tr>`;
        }).join("") + "</table>"
      : "";
    const saeb = ETS.length
      ? `<table class="tab-sar"><tr><th>Ano / componente</th><th>Escola</th><th>Pira.¹</th><th>SP¹</th></tr>` + ETS.flatMap(([k, , ano]) => [["lp", "Língua Portuguesa"], ["mat", "Matemática"]].map(([c, cn]) => {
          const [m, e, pub] = refInep(p.dependencia, `saeb_${k}_${c}`), v = p[`saeb_${k}_${c}`];
          return v == null ? "" : `<tr><td>${ano} – ${cn}</td>${cel(v, e, 1)}<td>${fmt(m, 1)}</td><td>${fmt(e, 1)}${pub ? "²" : ""}</td></tr>`;
        })).join("") + "</table>"
      : "";
    const notaInep = `<p class="nota">¹ Valor oficial da ${rede.rotulo.toLowerCase()} em Piracicaba e no Estado de SP. Verde: igual ou acima do Estado.${ETS.some(([k]) => refInep(p.dependencia, `ideb_${k}`)[2]) ? " ² Rede pública do Estado (o INEP não divulga a rede municipal estadual)." : ""}</p>`;
    const inep = ETS.length
      ? `<div class="sec"><h4>IDEB 2025</h4>${ideb}</div><div class="sec"><h4>Desempenho · SAEB 2025</h4>${saeb}${notaInep}</div>`
      : `<div class="sec"><h4>SAEB e IDEB 2025</h4><p class="nota" style="margin-top:0">Sem resultado divulgado pelo INEP (a escola não oferece as etapas avaliadas, teve poucos participantes ou não participou).</p></div>`;
    abrirFicha(`
      <h3>${esc(titulo(p.nome))}</h3>
      <span class="tag" style="background:${rede.cor}">${rede.rotulo}</span><span class="tag claro">${esc(p.localizacao || "")}</span>${p.localizacao_diferenciada ? `<span class="tag claro">${esc(p.localizacao_diferenciada)}</span>` : ""}
      <section class="cartoes">
        <div class="cartao"><b>${fmt(p.mat_total)}</b><span>matrículas</span></div>
        <div class="cartao"><b>${fmt(p.docentes)}</b><span>docentes</span></div>
        <div class="cartao"><b>${fmt(p.turmas)}</b><span>turmas</span></div>
        <div class="cartao"><b>${p.turmas ? fmt(p.mat_total / p.turmas, 1) : "–"}</b><span>alunos por turma</span></div>
      </section>
      <div class="sec"><h4>Identificação</h4><dl class="kv">
        <dt>Código INEP</dt><dd>${p.co_inep}</dd>
        <dt>Endereço</dt><dd>${esc(end) || "–"}</dd>
        <dt>Bairro</dt><dd>${esc(p.bairro_escola) || "–"}</dd>
        <dt>Bairro (IBGE)</dt><dd>${esc(titulo(p.bairro_ibge)) || "fora dos bairros"}</dd>
        <dt>CEP</dt><dd>${esc(p.cep) || "–"}</dd>
        <dt>Telefone</dt><dd>${esc(p.telefone) || "–"}</dd>
        <dt>Distrito</dt><dd>${esc(p.distrito) || "–"}</dd>
      </dl></div>
      <div class="sec"><h4>Matrículas por etapa · Censo Escolar 2025</h4>
        ${mats.map(([a, b]) => `<div class="matrow" style="--c:${rede.cor}"><span>${a}</span><div class="bar"><i style="width:${100 * b / mx}%"></i></div><span>${fmt(b)}</span></div>`).join("")}
        <p class="nota"><b>Etapas:</b> ${esc(p.etapas) || "–"}</p>
        <p class="nota"><b>Salas em uso:</b> ${fmt(p.salas)}</p>
      </div>
      <div class="sec"><h4>Desempenho · SARESP 2025</h4>${sar}</div>
      ${inep}
      <div class="sec"><h4>Infraestrutura</h4>
        <p class="nota" style="margin-top:0">${esc(p.infraestrutura) || "–"}</p>
        <p class="nota"><b>Acessibilidade:</b> ${esc(p.acessibilidade) || "–"}</p>
      </div>
      <div class="sec"><h4>Entorno · setor censitário (IBGE 2022)</h4><dl class="kv">
        <dt>Setor</dt><dd>${p.cd_setor || "–"}</dd>
        <dt>Renda média do resp.</dt><dd>${valor(p.setor_renda_media, "renda_media")}</dd>
        <dt>Alfabetização 15+</dt><dd>${valor(p.setor_alfabetizacao, "alfabetizacao")}</dd>
      </dl></div>
      <p class="nota">Origem da coordenada: ${esc(p.origem_coord)}</p>`, rede.cor);
  }
  function fichaTerritorio(p) {
    const ehSetor = estado.unidade === "setores";
    const dentro = ESC.features.filter(f => ehSetor ? f.properties.cd_setor === p.cd_setor : f.properties.bairro_ibge === p.bairro);
    const linhas = Object.keys(CONFIG.variaveis).map(k => `<dt>${CONFIG.variaveis[k].nome}</dt><dd>${valor(p[k], k)}</dd>`).join("");
    abrirFicha(`<h3>${ehSetor ? "Setor " + p.cd_setor : esc(titulo(p.bairro))}</h3>
      ${ehSetor ? `<div class="sub">${esc(titulo(p.bairro)) || "Fora dos bairros"} · ${esc(p.distrito || "")}</div><span class="tag claro">${esc(p.situacao || "")}</span><span class="tag claro">${esc(p.tipo || "")}</span>` : `<div class="sub">Distrito ${esc(p.distrito || "")}</div>`}
      ${!ehSetor ? `<button class="botao botao-sec" id="ficha-sel-bai">Selecionar este bairro</button>` : ""}
      <div class="sec"><h4>Escolas públicas (${dentro.length})</h4>
        ${dentro.length ? `<ul class="lista-esc">${dentro.map(f => `<li><span class="pto-mini" style="background:${REDES[f.properties.dependencia].cor}"></span><a href="#" data-inep="${f.properties.co_inep}">${esc(titulo(f.properties.nome))}</a><small>${fmt(f.properties.mat_total)} mat.</small></li>`).join("")}</ul>` : `<p class="nota">Nenhuma escola pública ${ehSetor ? "neste setor" : "neste bairro"}.</p>`}
      </div>
      <div class="sec"><h4>Indicadores · Censo 2022</h4><dl class="kv">
        <dt>Área</dt><dd>${fmt(p.area_km2, 2)} km²</dd><dt>Domicílios ocupados</dt><dd>${fmt(p.domicilios)}</dd>${linhas}
        ${p.fcu ? `<dt>Favela / Comunidade urbana</dt><dd>${esc(p.fcu)}</dd>` : ""}</dl>
        <p class="nota">Valores omitidos pelo IBGE por sigilo aparecem como “–”.</p></div>`, "var(--t-socio)");
    corpo.querySelectorAll("a[data-inep]").forEach(a => a.onclick = e => { e.preventDefault(); selecionarEscola(+a.dataset.inep, true); });
    const bt = $("ficha-sel-bai"); if (bt) bt.onclick = () => selecionarBairro(p.bairro);
  }
  function selecionarEscola(inep, centraliza) {
    const f = ESC.features.find(x => x.properties.co_inep === inep); if (!f) return;
    estado.sel = inep; fichaEscola(f.properties); desenharEscolas();
    if (centraliza) { const [lon, lat] = f.geometry.coordinates; mapa.setView([lat, lon], Math.max(mapa.getZoom(), 16)); }
  }

  // ---------- Controles ----------
  // etapas
  const etapas = new Set(); ESC.features.forEach(f => (f.properties.etapas || "").split("; ").filter(Boolean).forEach(e => etapas.add(e)));
  [...etapas].sort((a, b) => a.localeCompare(b, "pt-BR")).forEach(e => $("f-etapa").add(new Option(e, e)));
  $("f-etapa").onchange = e => { estado.etapa = e.target.value; desenharEscolas(); };
  $("chk-tam").onchange = e => { estado.tamMat = e.target.checked; desenharEscolas(); };
  $("chk-rot-esc").onchange = e => {
    estado.rotEsc = e.target.checked; atualizaRotulosEsc();
    if (estado.rotEsc && mapa.getZoom() < CONFIG.zoom_rotulos_escolas) avisoRapido("Aproxime o mapa (zoom 15 ou mais) para ver os nomes");
  };
  // SARESP
  // desempenho: cada fonte tem interruptor, variável, classificação e "só com resultado"; ligar uma desliga as outras
  const ativaDes = f => {
    estado.desemp = f;
    Object.keys(FONTES).forEach(k => { $(`chk-${k}`).checked = k === f; });
    desenharEscolas();
  };
  Object.keys(FONTES).forEach(f => {
    const sel = $(`sel-${f}`);
    if (!sel.options.length) sel.innerHTML = Object.entries(FONTES[f].vars).map(([k, v]) => `<option value="${k}">${v.nome}</option>`).join("");
    sel.value = DS(f).v;
    $(`chk-${f}`).onchange = e => ativaDes(e.target.checked ? f : null);
    sel.onchange = e => { DS(f).v = e.target.value; calcularQuebrasDes(f); ativaDes(f); };
    $(`sel-${f}-classe`).onchange = e => { DS(f).classe = e.target.value; calcularQuebrasDes(f); ativaDes(f); };
    $(`chk-so-${f}`).onchange = e => { DS(f).so = e.target.checked; desenharEscolas(); };
  });
  // território
  $("sel-var").innerHTML = Object.entries(CONFIG.variaveis).map(([k, v]) => `<option value="${k}">${v.nome}</option>`).join("");
  $("sel-var").onchange = e => { estado.variavel = e.target.value; desenharTerr(); };
  $("sel-classe").onchange = e => { estado.classe = e.target.value; desenharTerr(); };
  document.querySelectorAll("input[name=unidade]").forEach(r => r.onchange = () => { estado.unidade = r.value; desenharTerr(); });
  $("chk-terr").onchange = e => { estado.terr = e.target.checked; estado.terr ? camadaTerr.addTo(mapa) : mapa.removeLayer(camadaTerr); };
  $("rng-opac").oninput = e => { estado.opacidade = e.target.value / 100; $("val-opac").textContent = e.target.value + "%"; camadaTerr.setStyle(estiloTerr); };
  // limites
  const alterna = (id, camada) => $(id).onchange = e => e.target.checked ? camada.addTo(mapa) : mapa.removeLayer(camada);
  alterna("chk-lim", camadaLim); alterna("chk-bai", camadaBai); alterna("chk-rot-bai", rotulosBai);
  $("rng-fundo").oninput = e => {
    $("val-fundo").textContent = e.target.value + "%"; opacFundo = e.target.value / 100;
    Object.values(fundos).forEach(l => l.setOpacity(opacFundo));
  };
  // bairro
  const selB = $("sel-mun");
  [...BAI.features].map(f => f.properties.bairro).sort((a, b) => a.localeCompare(b, "pt-BR"))
    .forEach(b => selB.add(new Option(titulo(b), b)));
  selB.add(new Option("Fora dos bairros (área rural)", FORA));
  selB.onchange = e => selecionarBairro(e.target.value);

  // busca
  const busca = $("busca"), res = $("busca-res");
  busca.oninput = () => {
    const q = norm(busca.value.trim());
    if (q.length < 2) { res.hidden = true; return; }
    const hits = ESC.features.filter(f => norm(f.properties.nome).includes(q) || String(f.properties.co_inep).includes(q)).slice(0, 12);
    res.innerHTML = hits.map(f => `<li data-inep="${f.properties.co_inep}">${esc(titulo(f.properties.nome))}<small>${REDES[f.properties.dependencia].rotulo} · ${esc(f.properties.bairro_escola || "")} · INEP ${f.properties.co_inep}</small></li>`).join("")
      || "<li><small>Nenhuma escola encontrada</small></li>";
    res.hidden = false;
    res.querySelectorAll("li[data-inep]").forEach(li => li.onclick = () => { res.hidden = true; busca.value = ""; selecionarEscola(+li.dataset.inep, true); });
  };
  busca.onkeydown = e => {
    if (e.key === "Enter") { const li = res.querySelector("li[data-inep]"); if (li) li.click(); }
    if (e.key === "Escape") res.hidden = true;
  };
  document.addEventListener("click", e => { if (!e.target.closest(".busca")) res.hidden = true; });

  // CSV das escolas filtradas
  $("btn-csv").onclick = () => {
    const fs = filtradas().filter(f => noBairro({ bairro: f.properties.bairro_ibge })); if (!fs.length) return;
    const cols = Object.keys(fs[0].properties);
    const cel = v => v == null ? "" : typeof v === "string" ? '"' + v.replace(/"/g, '""') + '"' : typeof v === "number" ? String(v).replace(".", ",") : String(v);
    const linhas = [cols.concat(["lon", "lat"]).join(";")].concat(fs.map(f => cols.map(c => cel(f.properties[c])).concat(f.geometry.coordinates.map(cel)).join(";")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "escolas_publicas_piracicaba.csv"; a.click();
  };

  // ---------- Camadas ligadas (usado pelo "Monte seu mapa") ----------
  function camadasAtivas() {
    const on = l => l && mapa.hasLayer(l), lst = [];
    if (on(camadaEsc) && filtradas().length) {
      const f = estado.desemp, cores = f && coresDe(f);
      // itens lidos da legenda do painel (nome da classe, sem a contagem)
      const itens = f
        ? [...$(`legenda-${f}`).querySelectorAll(".item")].slice(0, -1).map((el, i) => ({ ponto: cores[Math.min(i, cores.length - 1)], rotulo: el.firstChild.nextSibling.textContent.trim() }))
            .concat([{ ponto: CONFIG.cor_sem_dado, rotulo: "Sem resultado" }])
        : Object.entries(REDES).filter(([k]) => estado.redes.has(k)).map(([, r]) => ({ ponto: r.cor, rotulo: r.rotulo }));
      lst.push({ id: "escolas", titulo: f ? `${FONTES[f].nome} – ${varDef(f).nome}` : "Escolas públicas", itens,
                 fonte: f ? `${FONTES[f].fonte}; INEP – Censo Escolar 2025` : "INEP – Censo Escolar 2025; SEDUC-SP" });
    }
    if (on(camadaTerr)) {
      const v = CONFIG.variaveis[estado.variavel];
      lst.push({ id: "terr", titulo: `${v.nome} (${v.unidade}) por ${estado.unidade === "setores" ? "setor censitário" : "bairro"}`, el: $("legenda"), fonte: "IBGE – Censo Demográfico 2022" });
    }
    const lim = [];
    if (on(camadaLim)) lim.push({ linha: "#2a2550", larg: 2.2, rotulo: "Limite municipal" });
    if (on(camadaBai)) lim.push({ linha: "#3a3360", larg: 1, rotulo: "Bairros (IBGE)" });
    if (destaqueBai) lim.push({ linha: "#c2457a", larg: 3, rotulo: titulo(estado.bairro) });
    if (lim.length) lst.push({ id: "limites", titulo: "Limites", itens: lim, fonte: "IBGE – Censo 2022" });
    return lst;
  }
  const fundoAtivo = () => Object.values(fundos).find(l => mapa.hasLayer(l));
  const escolasRes = ESC.features.map(f => f.properties);
  window.GEO = {
    mapa, camadasAtivas, fundoAtivo, estado, fontes: FONTES, selecionarEscola, titulo,
    resumo: { escolas: escolasRes.length, matriculas: escolasRes.reduce((s, p) => s + (p.mat_total || 0), 0),
              saresp: escolasRes.filter(p => p.tem_saresp).length, ideb: escolasRes.filter(p => p.tem_ideb).length, setores: SET.features.length, bairros: BAI.features.length },
  };

  $("btn-painel").onclick = () => $("painel").classList.toggle("aberto");

  // ---------- Início ----------
  Object.keys(FONTES).forEach(calcularQuebrasDes); desenharTerr(); desenharEscolas();
  document.dispatchEvent(new CustomEvent("geo-pronto"));
  // vista inicial: #zoom/lat/lon no endereço (link compartilhável) ou a área urbana contínua de Piracicaba
  const urbana = L.geoJSON({ type: "FeatureCollection", features: SET.features.filter(f =>
    f.properties.situacao === "Urbana" && CONFIG.distritos_urbanos.includes(f.properties.distrito)) }).getBounds();
  let vistaPendente = true;
  const h = location.hash.slice(1).split("/").map(Number);
  const vistaInicial = () => {
    if (h.length === 3 && h.every(n => !isNaN(n)) && h[0] >= 8) mapa.setView([h[1], h[2]], h[0]);
    else mapa.fitBounds(urbana, folga());
    vistaPendente = false;
  };
  if (mapa.getSize().x > 50) vistaInicial(); else vistaPendente = vistaInicial;
  if (window.ResizeObserver) new ResizeObserver(() => {
    mapa.invalidateSize();
    if (typeof vistaPendente === "function" && mapa.getSize().x > 50) vistaPendente();
  }).observe($("mapa"));
  mapa.on("moveend", () => {
    if (vistaPendente) return;
    const c = mapa.getCenter();
    history.replaceState(null, "", `#${mapa.getZoom()}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}`);
  });
  $("carregando").classList.add("oculto");
})();

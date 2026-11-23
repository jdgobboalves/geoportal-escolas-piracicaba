/* Geoportal das Escolas Públicas – navegação entre abas, página de Download e Mais informações */
(function () {
  const $ = id => document.getElementById(id);
  const fmt = (v, c = 0) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- Aviso rápido ----------
  let tAviso;
  window.avisoRapido = msg => {
    const el = $("aviso-flutuante"); el.textContent = msg; el.hidden = false;
    clearTimeout(tAviso); tAviso = setTimeout(() => (el.hidden = true), 2600);
  };

  // ---------- Abas ----------
  const ABAS = ["camadas", "analise", "download", "monte", "info"];
  function abrirAba(aba) {
    if (!ABAS.includes(aba)) aba = "camadas";
    document.querySelectorAll(".nav-item").forEach(b => {
      const at = b.dataset.aba === aba; b.classList.toggle("ativo", at);
      at ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current");
    });
    $("pagina-download").hidden = aba !== "download";
    $("pagina-analise").hidden = aba !== "analise";
    $("pagina-info").hidden = aba !== "info";
    $("painel-camadas").hidden = aba !== "camadas";
    $("painel-monte").hidden = aba !== "monte";
    $("painel-mun").hidden = aba === "monte";   // deixa o mapa livre para enquadrar a imagem
    if (aba === "monte") $("ficha").hidden = true;
    $("btn-painel").textContent = aba === "monte" ? "Monte seu mapa" : "Camadas";
    $("nav").classList.remove("aberto"); $("btn-menu").setAttribute("aria-expanded", "false");
    if (aba === "monte") document.dispatchEvent(new CustomEvent("aba-monte"));
    if (aba === "info") animaContadores();
    if (aba === "analise") document.dispatchEvent(new CustomEvent("aba-analise"));
    if (window.GEO) setTimeout(() => GEO.mapa.invalidateSize(), 0);
    if (aba === "camadas" || aba === "monte") $("painel").scrollTop = 0;
    if (matchMedia("(max-width: 820px)").matches) $("painel").classList.toggle("aberto", aba === "camadas" || aba === "monte");
  }
  document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => abrirAba(b.dataset.aba)));
  // cartão do bairro: minimizar/expandir (no celular começa minimizado)
  function minimizaMun(min) {
    $("painel-mun").classList.toggle("minimizado", min);
    $("btn-mun-min").textContent = min ? "+" : "–";
    $("btn-mun-min").title = min ? "Expandir" : "Minimizar";
    $("btn-mun-min").setAttribute("aria-expanded", String(!min));
  }
  $("btn-mun-min").onclick = () => minimizaMun(!$("painel-mun").classList.contains("minimizado"));
  minimizaMun(true);   // começa recolhido; o botão "+" expande
  if (window.L) { L.DomEvent.disableClickPropagation($("painel-mun")); L.DomEvent.disableScrollPropagation($("painel-mun")); }

  $("btn-menu").onclick = () => {
    const ab = $("nav").classList.toggle("aberto"); $("btn-menu").setAttribute("aria-expanded", String(ab));
  };
  window.abrirAba = abrirAba;

  $("btn-link").onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); avisoRapido("Link da vista atual copiado"); }
    catch { prompt("Copie o link:", location.href); }
  };
  $("url-cita").textContent = location.href.split("#")[0].replace(/index\.html$/, "");

  // ---------- Download ----------
  const ICONES = {
    "Escolas Públicas": '<path d="M3 10l9-5 9 5-9 5z M7 12.5V17c0 1.5 2.5 3 5 3s5-1.5 5-3v-4.5 M21 10v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
    "Desempenho": '<path d="M4 20V13M9.3 20V8M14.6 20v-5M20 20V4M2 20h20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    "Socioeconomia": '<circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="9" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 14c3 0 5 2 5 5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    "Limites Territoriais": '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  };
  const SETA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12m-5-5 5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const linkDe = it => it.url || CONFIG.BASE_DOWNLOAD + it.arquivo;
  const tamTxt = b => b == null ? "—" : b < 1024 * 1024 ? fmt(b / 1024, 0) + " KB" : fmt(b / 1024 / 1024, 1) + " MB";
  const TAM = window.DATA_TAMANHOS || {};

  function montaDownloads() {
    $("lista-downloads").innerHTML = CONFIG.downloads.map(g => `
      <section class="grupo-dl" style="--cor-tema:${g.cor}">
        <h3><span class="tema-ico"><svg viewBox="0 0 24 24">${ICONES[g.tema] || ""}</svg></span>${esc(g.tema)}<small>${g.itens.length} ${g.itens.length > 1 ? "arquivos" : "arquivo"}</small></h3>
        <table class="tab-dl">
          <thead><tr><th>Camada</th><th>Formato</th><th>Fonte</th><th>Tamanho</th><th></th></tr></thead>
          <tbody>${g.itens.map(it => `
            <tr data-busca="${esc((it.nome + " " + it.desc + " " + it.formato + " " + it.fonte + " " + g.tema).toLowerCase())}">
              <td><b>${esc(it.nome)}</b><small>${esc(it.desc || "")}</small></td>
              <td><span class="fmt fmt-${it.formato.toLowerCase()}">${esc(it.formato)}</span></td>
              <td>${esc(it.fonte || "")}</td>
              <td class="tam">${tamTxt(TAM[it.arquivo])}</td>
              <td><a class="btn-dl" href="${esc(linkDe(it))}" download>${SETA}Baixar</a></td>
            </tr>`).join("")}</tbody>
        </table>
      </section>`).join("");
  }
  $("dl-busca").oninput = e => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll(".grupo-dl").forEach(sec => {
      let n = 0;
      sec.querySelectorAll("tbody tr").forEach(tr => { const ok = !q || tr.dataset.busca.includes(q); tr.hidden = !ok; n += ok; });
      sec.hidden = n === 0;
    });
  };

  // ---------- Mais informações: contadores ----------
  let contadoresFeitos = false;
  function montaContadores() {
    const r = GEO.resumo || {};
    const itens = [
      ["Escolas públicas", r.escolas, "estaduais e municipais", "#4b3f9e"],
      ["Matrículas", r.matriculas, "Censo Escolar 2025", "#e8833a"],
      ["Escolas no SARESP", r.saresp, "com resultado em 2025", "#c2457a"],
      ["Escolas no SAEB/IDEB", r.ideb, "com resultado em 2025", "#2f9a7a"],
    ];
    $("contadores").innerHTML = itens.map(([n, v, u, cor]) =>
      `<div class="contador" style="--c:${cor}"><span>${n}</span><b data-alvo="${v || 0}">0</b><small>${u}</small></div>`).join("");
  }
  function animaContadores() {
    if (contadoresFeitos || !window.GEO || !GEO.resumo) return;
    contadoresFeitos = true;
    const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll(".contador b").forEach(el => {
      const alvo = Number(el.dataset.alvo), t0 = performance.now(), dur = reduz ? 0 : 1100;
      const passo = t => {
        const p = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(alvo * e, 0);
        if (p < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
  }

  const inicia = () => { montaDownloads(); montaContadores(); if (!$("pagina-info").hidden) animaContadores(); };
  if (window.GEO) inicia(); else document.addEventListener("geo-pronto", inicia);
})();

// Configuração do Geoportal das Escolas Públicas de Piracicaba.
// Os dados são carregados de data/*.js (gerados por scripts/04_exportar_js.py),
// então o geoportal abre também direto do disco, sem servidor.
const CONFIG = {
  centro: [-22.72, -47.65],
  zoom: 11,
  fundo_inicial: "OpenStreetMap",
  opacidade_fundo: 0.4,   // opacidade inicial do mapa de fundo (0 a 1)
  // vista inicial: área urbana contínua (setores urbanos destes distritos)
  distritos_urbanos: ["Piracicaba", "Santa Teresinha de Piracicaba"],
  zoom_rotulos_escolas: 15,

  // Redes de ensino (cor dos pontos)
  redes: {
    Estadual: { cor: "#2f6fd1", rotulo: "Rede estadual" },
    Municipal: { cor: "#e8833a", rotulo: "Rede municipal" },
  },

  // SARESP 2025
  saresp: {
    saresp_2ef_lp: { nome: "2º ano EF – Língua Portuguesa", curto: "2º EF · LP" },
    saresp_2ef_mat: { nome: "2º ano EF – Matemática", curto: "2º EF · MAT" },
    saresp_5ef_lp: { nome: "5º ano EF – Língua Portuguesa", curto: "5º EF · LP", cortes: [150, 200, 250] },
    saresp_5ef_mat: { nome: "5º ano EF – Matemática", curto: "5º EF · MAT", cortes: [175, 225, 275] },
    saresp_9ef_lp: { nome: "9º ano EF – Língua Portuguesa", curto: "9º EF · LP", cortes: [200, 275, 325] },
    saresp_9ef_mat: { nome: "9º ano EF – Matemática", curto: "9º EF · MAT", cortes: [225, 300, 350] },
  },
  niveis: ["Abaixo do básico", "Básico", "Adequado", "Avançado"],
  cores_niveis: ["#d1495b", "#f2b134", "#4fa36b", "#2f5fa8"],
  cores_saresp_quantis: ["#d1495b", "#ef8f5a", "#f2d27a", "#8cc38a", "#2f8f63"],
  cor_sem_dado: "#a3a3b5",

  // SAEB 2025 (INEP) – proficiência média da escola (escala SAEB). Classificação por quantis.
  saeb: {
    saeb_ai_lp: { nome: "5º ano EF – Língua Portuguesa", curto: "SAEB 5º EF · LP" },
    saeb_ai_mat: { nome: "5º ano EF – Matemática", curto: "SAEB 5º EF · MAT" },
    saeb_af_lp: { nome: "9º ano EF – Língua Portuguesa", curto: "SAEB 9º EF · LP" },
    saeb_af_mat: { nome: "9º ano EF – Matemática", curto: "SAEB 9º EF · MAT" },
    saeb_em_lp: { nome: "3ª série EM – Língua Portuguesa", curto: "SAEB 3ª EM · LP" },
    saeb_em_mat: { nome: "3ª série EM – Matemática", curto: "SAEB 3ª EM · MAT" },
    saeb_ai_n: { nome: "Anos iniciais – nota média padronizada (0–10)", curto: "SAEB AI · nota N", casas: 2 },
    saeb_af_n: { nome: "Anos finais – nota média padronizada (0–10)", curto: "SAEB AF · nota N", casas: 2 },
    saeb_em_n: { nome: "Ensino médio – nota média padronizada (0–10)", curto: "SAEB EM · nota N", casas: 2 },
  },
  // IDEB 2025 (INEP) – classes fixas (escala 0–10) ou quantis; variação 2023→2025 em classes divergentes
  ideb: {
    ideb_ai: { nome: "Anos iniciais do EF (1º ao 5º ano)", curto: "IDEB AI", cortes: [4, 5, 6, 7] },
    ideb_af: { nome: "Anos finais do EF (6º ao 9º ano)", curto: "IDEB AF", cortes: [4, 5, 6, 7] },
    ideb_em: { nome: "Ensino médio", curto: "IDEB EM", cortes: [3, 4, 5, 6] },
    ideb_ai_var: { nome: "Variação 2023 → 2025 – anos iniciais", curto: "Variação IDEB AI", cortes: [-0.45, -0.05, 0.05, 0.45], div: true },
    ideb_af_var: { nome: "Variação 2023 → 2025 – anos finais", curto: "Variação IDEB AF", cortes: [-0.45, -0.05, 0.05, 0.45], div: true },
    ideb_em_var: { nome: "Variação 2023 → 2025 – ensino médio", curto: "Variação IDEB EM", cortes: [-0.45, -0.05, 0.05, 0.45], div: true },
  },
  cores_ideb: ["#d1495b", "#ef8f5a", "#f2d27a", "#8cc38a", "#2f8f63"],
  cores_var: ["#b2182b", "#ef8a62", "#d9d9e3", "#67a9cf", "#2166ac"],
  rotulos_var: ["Queda de 0,5 ou mais", "Queda", "Estável", "Alta", "Alta de 0,5 ou mais"],
  faixas_var: ["≤ −0,5", "−0,4 a −0,1", "0,0", "+0,1 a +0,4", "≥ +0,5"],

  // Indicadores do Censo 2022 (setores e bairros) – paleta sequencial em roxo
  cores_terr: ["#f3f0fa", "#d5cdee", "#a99bd8", "#7a66bd", "#4b3a8f"],
  variaveis: {
    renda_media:     { nome: "Renda média do responsável", unidade: "R$", casas: 0, desc: "Média do rendimento mensal das pessoas responsáveis pelos domicílios (só as que têm algum rendimento), em reais de 2022. Fonte: IBGE, Censo 2022." },
    renda_mediana:   { nome: "Renda mediana do responsável", unidade: "R$", casas: 0, desc: "Valor do meio do rendimento mensal das pessoas responsáveis pelos domicílios (só as que têm algum rendimento), em reais de 2022." },
    renda_sm:        { nome: "Renda média em salários mínimos", unidade: "SM", casas: 2, desc: "Renda média do responsável dividida pelo salário mínimo de 2022 (R$ 1.212)." },
    alfabetizacao:   { nome: "Taxa de alfabetização (15 anos ou mais)", unidade: "%", casas: 1, desc: "Pessoas de 15 anos ou mais que sabem ler e escrever, em % da população dessa idade." },
    analfabetos_15m: { nome: "Pessoas não alfabetizadas (15 anos ou mais)", unidade: "pessoas", casas: 0, desc: "Número de pessoas de 15 anos ou mais que não sabem ler e escrever." },
    pop:             { nome: "População residente", unidade: "habitantes", casas: 0, desc: "População residente em 2022." },
    densidade:       { nome: "Densidade demográfica", unidade: "hab./km²", casas: 0, desc: "Habitantes por km²." },
    pct_0_14:        { nome: "População de 0 a 14 anos", unidade: "%", casas: 1, desc: "Crianças e adolescentes de 0 a 14 anos, em % da população." },
    pop_0_4:         { nome: "Crianças de 0 a 4 anos", unidade: "pessoas", casas: 0, desc: "Idade de creche e pré-escola." },
    pop_5_9:         { nome: "Crianças de 5 a 9 anos", unidade: "pessoas", casas: 0, desc: "Idade dos anos iniciais do ensino fundamental." },
    pop_10_14:       { nome: "Crianças de 10 a 14 anos", unidade: "pessoas", casas: 0, desc: "Idade dos anos finais do ensino fundamental." },
    pop_15_19:       { nome: "Jovens de 15 a 19 anos", unidade: "pessoas", casas: 0, desc: "Idade do ensino médio." },
    pct_preta_parda: { nome: "População preta e parda", unidade: "%", casas: 1, desc: "Pessoas autodeclaradas pretas ou pardas, em % da população." },
  },

  // ---------- Downloads (aba "Download") ----------
  // BASE_DOWNLOAD: pasta/URL de onde saem os arquivos. "url" em cada item tem prioridade.
  BASE_DOWNLOAD: "data/",
  downloads: [
    { tema: "Escolas Públicas", cor: "#4b3f9e", itens: [
      { nome: "Escolas estaduais e municipais", desc: "195 escolas (pontos) com cadastro, matrículas por etapa, docentes, turmas, infraestrutura, SARESP 2025, SAEB e IDEB 2025 e setor/bairro do IBGE", formato: "GeoJSON", arquivo: "escolas.geojson", fonte: "INEP 2025, SEDUC-SP", url: "" },
      { nome: "Escolas estaduais e municipais – tabela", desc: "Os mesmos atributos, com longitude e latitude", formato: "CSV", arquivo: "escolas_publicas.csv", fonte: "INEP 2025, SEDUC-SP", url: "" },
    ]},
    { tema: "Desempenho", cor: "#c2457a", itens: [
      { nome: "SARESP 2025 – médias de referência", desc: "Proficiência média das redes estadual e municipal em Piracicaba e no Estado de SP", formato: "JSON", arquivo: "saresp_referencias.json", fonte: "SEDUC-SP", url: "" },
      { nome: "SAEB e IDEB 2025 – referências", desc: "Notas do SAEB e IDEB 2025 (e IDEB 2023) por rede em Piracicaba e no Estado de SP, por etapa", formato: "JSON", arquivo: "ideb_referencias.json", fonte: "INEP", url: "" },
    ]},
    { tema: "Socioeconomia", cor: "#e08a2c", itens: [
      { nome: "Setores censitários – Censo 2022", desc: "890 setores com população, renda, alfabetização, faixas etárias escolares e cor ou raça", formato: "GeoJSON", arquivo: "setores.geojson", fonte: "IBGE – Censo 2022", url: "" },
      { nome: "Setores censitários – tabela", desc: "Indicadores dos setores, sem geometria", formato: "CSV", arquivo: "setores_indicadores.csv", fonte: "IBGE – Censo 2022", url: "" },
      { nome: "Bairros – Censo 2022", desc: "71 bairros do IBGE com os mesmos indicadores", formato: "GeoJSON", arquivo: "bairros.geojson", fonte: "IBGE – Censo 2022", url: "" },
      { nome: "Bairros – tabela", desc: "Indicadores dos bairros, sem geometria", formato: "CSV", arquivo: "bairros_indicadores.csv", fonte: "IBGE – Censo 2022", url: "" },
    ]},
    { tema: "Limites Territoriais", cor: "#2f8fa8", itens: [
      { nome: "Limite municipal de Piracicaba", desc: "União dos setores censitários de 2022", formato: "GeoJSON", arquivo: "limite.geojson", fonte: "IBGE – Censo 2022", url: "" },
    ]},
  ],
};

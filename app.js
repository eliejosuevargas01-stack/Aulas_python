const ENDPOINT = "https://myn8n.seommerce.shop/webhook/Aulas_python";
const STORAGE_KEY = "pylab_progress_v1";
const THEME_KEY = "pylab_theme_v1";
const COMMENT_KEY = "pylab_comments_v1";

const state = {
  allLessons: [],
  lessons: [],
  filtered: [],
  expanded: false,
  lastUpdated: null,
  progress: { lastCompletedId: null },
  slideIndexById: {},
  comments: {},
};

const SECTION_CONFIG = [
  { key: "Contexto_problema", label: "Contexto problema", open: true },
  { key: "Objetivo", label: "Objetivo", open: true },
  { key: "Logica_programacao", label: "Logica de programacao", open: false },
  { key: "Conceitos_tecnicos", label: "Conceitos tecnicos", open: false },
  { key: "Implementacao_guiada", label: "Implementacao guiada", open: false },
  { key: "Pratica_guiada", label: "Pratica guiada", open: false },
  { key: "Exercicios", label: "Exercicios", open: false },
  { key: "Desafio_mercado", label: "Desafio de mercado", open: false },
  { key: "Mini_prova", label: "Mini prova", open: false },
  { key: "Criterios_avaliacao", label: "Criterios de avaliacao", open: false },
  { key: "Conexao_proximos_passos", label: "Conexao e proximos passos", open: false },
];

const EXTRA_KEYS = ["titulo", "objetivo_resumo", "entrega_esperada", "foco"];
const CANONICAL_KEYS = [...SECTION_CONFIG.map((section) => section.key), ...EXTRA_KEYS];

const HIGHLIGHT_FIELDS = [
  { key: "Logica_programacao", label: "Logica" },
  { key: "Conceitos_tecnicos", label: "Conceitos" },
  { key: "Implementacao_guiada", label: "Implementacao" },
  { key: "Pratica_guiada", label: "Pratica" },
  { key: "Exercicios", label: "Exercicios" },
  { key: "Desafio_mercado", label: "Desafio" },
  { key: "Mini_prova", label: "Mini prova" },
];

const lessonList = document.getElementById("lessonList");
const lessonCount = document.getElementById("lessonCount");
const lastUpdated = document.getElementById("lastUpdated");
const statusText = document.getElementById("statusText");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const refreshBtn = document.getElementById("refreshBtn");
const toggleAllBtn = document.getElementById("toggleAllBtn");
const scrollTopBtn = document.getElementById("scrollTopBtn");
const lessonTemplate = document.getElementById("lessonTemplate");
const themeToggle = document.getElementById("themeToggle");

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const loadTheme = () => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyTheme = (theme) => {
  document.body.dataset.theme = theme === "dark" ? "dark" : "light";
  if (themeToggle) themeToggle.checked = theme === "dark";
  localStorage.setItem(THEME_KEY, theme);
};

const loadComments = () => {
  try {
    const raw = localStorage.getItem(COMMENT_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch (error) {
    console.warn("Falha ao ler comentarios", error);
    return {};
  }
};

const saveComments = () => {
  localStorage.setItem(COMMENT_KEY, JSON.stringify(state.comments));
};

const getComment = (lesson, key) => {
  const lessonComments = state.comments[lesson._idKey];
  if (!lessonComments) return "";
  return lessonComments[key] || "";
};

const setComment = (lesson, key, value) => {
  if (!state.comments[lesson._idKey]) {
    state.comments[lesson._idKey] = {};
  }
  state.comments[lesson._idKey][key] = value;
  saveComments();
};

const loadProgress = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastCompletedId: null };
    const data = JSON.parse(raw);
    if (!data || data.lastCompletedId === undefined || data.lastCompletedId === null) {
      return { lastCompletedId: null };
    }
    return { lastCompletedId: String(data.lastCompletedId) };
  } catch (error) {
    console.warn("Falha ao ler progresso", error);
    return { lastCompletedId: null };
  }
};

const saveProgress = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
};

const DATE_FIELDS = ["data", "Data", "data_aula", "date", "createdAt", "updatedAt"];

const getDayKey = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getLessonDate = (lesson) => {
  for (const field of DATE_FIELDS) {
    const value = lesson[field];
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
};

const getLessonDayKeys = (lesson) => {
  const keys = new Set();
  DATE_FIELDS.forEach((field) => {
    const key = getDayKey(lesson[field]);
    if (key) keys.add(key);
  });
  return [...keys];
};

const getSortedLessons = (lessons) => {
  const sorted = [...lessons];
  const hasDay = sorted.some((lesson) => Number.isFinite(lesson._sortDay));
  const hasNumericId = sorted.some((lesson) => Number.isFinite(lesson._sortId));

  sorted.sort((a, b) => {
    if (hasDay) {
      const aDay = Number.isFinite(a._sortDay) ? a._sortDay : Number.MAX_SAFE_INTEGER;
      const bDay = Number.isFinite(b._sortDay) ? b._sortDay : Number.MAX_SAFE_INTEGER;
      if (aDay !== bDay) return aDay - bDay;
    }

    if (hasNumericId) {
      const aId = Number.isFinite(a._sortId) ? a._sortId : Number.MAX_SAFE_INTEGER;
      const bId = Number.isFinite(b._sortId) ? b._sortId : Number.MAX_SAFE_INTEGER;
      if (aId !== bId) return aId - bId;
    }

    const aTime = a._sortDate ? a._sortDate.getTime() : 0;
    const bTime = b._sortDate ? b._sortDate.getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;

    return a._idKey.localeCompare(b._idKey);
  });

  return sorted;
};

const getDailyLesson = (lessons) => {
  const todayKey = getDayKey(new Date());
  if (!todayKey) return null;
  return lessons.find((lesson) => lesson._hasContent && lesson._dayKeys.includes(todayKey)) || null;
};

const getNextLessonById = (lessons, idKey) => {
  if (!idKey) return null;
  const index = lessons.findIndex((lesson) => lesson._idKey === idKey);
  if (index === -1) return null;
  for (let i = index + 1; i < lessons.length; i += 1) {
    if (lessons[i]._hasContent) return lessons[i];
  }
  return null;
};

const getNextFromProgress = (lessons) => {
  if (!state.progress.lastCompletedId) return null;
  return getNextLessonById(lessons, state.progress.lastCompletedId);
};

const computeAvailableLessons = () => {
  const sorted = getSortedLessons(state.allLessons);
  const nextFromProgress = getNextFromProgress(sorted);
  if (nextFromProgress) return [nextFromProgress];

  const todayLesson = getDailyLesson(sorted);
  if (todayLesson) return [todayLesson];

  return [];
};

const toSearchable = (lesson) => {
  const extras = [
    lesson.titulo,
    lesson.objetivo_resumo,
    lesson.entrega_esperada,
    lesson.foco,
    lesson.dayLabel,
  ];
  const values = SECTION_CONFIG.map((section) => lesson[section.key])
    .concat([lesson.title, String(lesson.id || ""), ...extras])
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return values;
};

const extractTitle = (lesson) => {
  const candidates = [lesson.titulo, lesson.Objetivo, lesson.Contexto_problema];
  for (const text of candidates) {
    if (typeof text !== "string") continue;
    const firstLine = text.split("\n").find((line) => line.trim());
    if (firstLine) return truncate(firstLine.trim(), 80);
  }
  return "Aula sem titulo";
};

const truncate = (value, max) => {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}...`;
};

const buildHighlights = (lesson) => {
  return HIGHLIGHT_FIELDS.filter((field) => lesson[field.key])
    .slice(0, 4)
    .map((field) => field.label);
};

const buildSummary = (lesson) => {
  const text = lesson.Contexto_problema || lesson.Objetivo || lesson.Logica_programacao;
  if (!text) return "Sem resumo disponivel.";
  return truncate(text.replace(/\s+/g, " ").trim(), 220);
};

const hasText = (value) => typeof value === "string" && value.trim().length > 0;

const hasLessonContent = (lesson) => {
  if (CANONICAL_KEYS.some((key) => hasText(lesson[key]))) return true;
  return SECTION_CONFIG.some((section) => hasText(lesson[section.key]));
};

const normalizeLesson = (raw) => {
  const base = raw && typeof raw === "object" ? raw : {};
  const merged = base.aula && typeof base.aula === "object" ? { ...base, ...base.aula } : base;
  const lesson = { ...merged };
  CANONICAL_KEYS.forEach((key) => {
    if (lesson[key] !== undefined) return;
    const lowerKey = key.toLowerCase();
    if (lesson[lowerKey] !== undefined) lesson[key] = lesson[lowerKey];
  });
  lesson.day = lesson.dia ?? lesson.Dia ?? lesson.day ?? lesson.dia_aula ?? null;
  lesson.dayLabel = lesson.day !== null && lesson.day !== undefined ? String(lesson.day) : "";
  const parsedDay = Number(lesson.day);
  lesson._sortDay = Number.isFinite(parsedDay) ? parsedDay : null;
  lesson.id = lesson.id ?? lesson.ID ?? lesson.Id ?? "--";
  lesson._idKey = String(lesson.id ?? "");
  const parsedId = Number(lesson.id);
  lesson._sortId = Number.isFinite(parsedId) ? parsedId : null;
  lesson._sortDate = getLessonDate(lesson);
  lesson._dayKeys = getLessonDayKeys(lesson);
  lesson.title = extractTitle(lesson);
  lesson.summary = buildSummary(lesson);
  lesson.highlights = buildHighlights(lesson);
  lesson._search = toSearchable(lesson);
  lesson._hasContent = hasLessonContent(lesson);
  return lesson;
};

const renderEmpty = (message) => {
  lessonList.innerHTML = "";
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message;
  lessonList.appendChild(empty);
};

const buildContent = (container, text) => {
  container.innerHTML = "";
  if (!text) {
    container.textContent = "Sem conteudo.";
    return;
  }

  const parts = text.split("```");
  if (parts.length === 1) {
    const prose = document.createElement("div");
    prose.className = "prose";
    prose.textContent = text.trim();
    container.appendChild(prose);
    return;
  }

  parts.forEach((part, index) => {
    if (!part.trim()) return;
    if (index % 2 === 1) {
      const lines = part.split("\n");
      const codeLines = lines.length > 1 ? lines.slice(1) : lines;
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = codeLines.join("\n").trim();
      pre.appendChild(code);
      container.appendChild(pre);
      return;
    }

    const prose = document.createElement("div");
    prose.className = "prose";
    prose.textContent = part.trim();
    container.appendChild(prose);
  });
};

const getLessonSlides = (lesson) => {
  return SECTION_CONFIG.map((config) => {
    const value = lesson[config.key];
    if (!value || typeof value !== "string") return null;
    return { label: config.label, value, key: config.key };
  }).filter(Boolean);
};

const setSlideIndex = (lesson, index) => {
  state.slideIndexById[lesson._idKey] = index;
};

const getSlideIndex = (lesson, total) => {
  const current = state.slideIndexById[lesson._idKey] ?? 0;
  if (current < 0) return 0;
  if (current >= total) return total - 1;
  return current;
};

const renderSlides = (slideWrap, lesson) => {
  slideWrap.innerHTML = "";
  const slides = getLessonSlides(lesson);

  if (!slides.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Sem detalhes adicionais para esta aula.";
    slideWrap.appendChild(empty);
    return;
  }

  const total = slides.length;
  let currentIndex = getSlideIndex(lesson, total);
  setSlideIndex(lesson, currentIndex);

  const stack = document.createElement("div");
  stack.className = "slide-stack";

  slides.forEach((slide, index) => {
    const slideEl = document.createElement("section");
    slideEl.className = "lesson-slide";
    slideEl.dataset.index = String(index);
    if (index === currentIndex) slideEl.classList.add("is-active");

    const header = document.createElement("div");
    header.className = "slide-header";

    const pill = document.createElement("span");
    pill.className = "slide-pill";
    pill.textContent = `Passo ${index + 1}`;

    const title = document.createElement("h3");
    title.className = "slide-title";
    title.textContent = slide.label;

    header.appendChild(pill);
    header.appendChild(title);

    const body = document.createElement("div");
    body.className = "slide-body";
    buildContent(body, slide.value);

    const commentWrap = document.createElement("div");
    commentWrap.className = "slide-comment";

    const commentLabel = document.createElement("label");
    commentLabel.className = "comment-label";
    commentLabel.textContent = "Comentario desta secao";

    const commentInput = document.createElement("textarea");
    commentInput.rows = 4;
    commentInput.placeholder = "Escreva suas observacoes aqui...";
    commentInput.value = getComment(lesson, slide.key);

    const commentActions = document.createElement("div");
    commentActions.className = "comment-actions";

    const commentStatus = document.createElement("span");
    commentStatus.className = "comment-status";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "btn ghost";
    saveButton.textContent = "Salvar comentario";
    saveButton.addEventListener("click", () => {
      setComment(lesson, slide.key, commentInput.value.trim());
      commentStatus.textContent = "Comentario salvo.";
      window.setTimeout(() => {
        commentStatus.textContent = "";
      }, 1800);
    });

    commentActions.appendChild(commentStatus);
    commentActions.appendChild(saveButton);
    commentWrap.appendChild(commentLabel);
    commentWrap.appendChild(commentInput);
    commentWrap.appendChild(commentActions);

    slideEl.appendChild(header);
    slideEl.appendChild(body);
    slideEl.appendChild(commentWrap);
    stack.appendChild(slideEl);
  });

  const nav = document.createElement("div");
  nav.className = "slide-nav";

  const progress = document.createElement("div");
  progress.className = "slide-progress";

  const progressLabel = document.createElement("span");
  progressLabel.className = "slide-progress-label";

  const progressTrack = document.createElement("div");
  progressTrack.className = "slide-progress-track";

  const progressBar = document.createElement("div");
  progressBar.className = "slide-progress-bar";

  progressTrack.appendChild(progressBar);
  progress.appendChild(progressLabel);
  progress.appendChild(progressTrack);

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn ghost";
  prevBtn.textContent = "Voltar";

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn accent";
  nextBtn.textContent = "Continuar";

  nav.appendChild(progress);
  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);

  const slideEls = Array.from(stack.querySelectorAll(".lesson-slide"));

  const updateUI = (index) => {
    slideEls.forEach((el) => {
      const isActive = Number(el.dataset.index) === index;
      el.classList.toggle("is-active", isActive);
    });

    prevBtn.disabled = index === 0;
    const isLast = index === total - 1;
    nextBtn.textContent = isLast ? "Finalizar aula" : "Continuar";
    progressLabel.textContent = `Passo ${index + 1} de ${total}`;
    progressBar.style.width = `${Math.round(((index + 1) / total) * 100)}%`;
  };

  prevBtn.addEventListener("click", () => {
    currentIndex = Math.max(0, currentIndex - 1);
    setSlideIndex(lesson, currentIndex);
    updateUI(currentIndex);
  });

  nextBtn.addEventListener("click", () => {
    if (currentIndex >= total - 1) {
      handleComplete(lesson);
      return;
    }
    currentIndex = Math.min(total - 1, currentIndex + 1);
    setSlideIndex(lesson, currentIndex);
    updateUI(currentIndex);
  });

  slideWrap.appendChild(stack);
  slideWrap.appendChild(nav);
  updateUI(currentIndex);
};

const handleComplete = (lesson) => {
  state.progress.lastCompletedId = lesson._idKey;
  saveProgress();
  state.lessons = computeAvailableLessons();
  applyFilters();
  if (state.lessons.length) {
    setStatus("Proxima aula liberada");
  } else {
    setStatus("Aulas finalizadas");
  }
};

const renderLessons = () => {
  lessonList.innerHTML = "";

  if (!state.filtered.length) {
    const hasQuery = searchInput.value.trim().length > 0;
    const hasContent = state.allLessons.some((lesson) => lesson._hasContent);
    const message = hasQuery
      ? "Nenhuma aula encontrada. Ajuste a busca ou tente atualizar."
      : !hasContent
        ? "As aulas chegaram sem conteudo. Aguarde a liberacao completa."
      : state.progress.lastCompletedId
        ? "Voce concluiu todas as aulas."
        : "Nenhuma aula liberada hoje. Volte amanha.";
    renderEmpty(message);
    return;
  }

  const sorted = getSortedLessons(state.allLessons);

  state.filtered.forEach((lesson, index) => {
    const card = lessonTemplate.content.cloneNode(true);
    const root = card.querySelector(".lesson-card");
    root.style.setProperty("--delay", `${index * 0.05}s`);

    const lessonLabel = lesson.dayLabel || lesson._idKey || "--";
    card.querySelector('[data-field="id"]').textContent = lessonLabel;
    card.querySelector('[data-field="title"]').textContent = lesson.title;
    card.querySelector('[data-field="summary"]').textContent = lesson.summary;
    card.querySelector('[data-field="created"]').textContent = `Criado: ${formatDate(lesson.createdAt)}`;
    card.querySelector('[data-field="updated"]').textContent = `Atualizado: ${formatDate(lesson.updatedAt)}`;

    const highlights = card.querySelector('[data-field="highlights"]');
    if (lesson.highlights.length) {
      lesson.highlights.forEach((label) => {
        const span = document.createElement("span");
        span.className = "highlight";
        span.textContent = label;
        highlights.appendChild(span);
      });
    } else {
      highlights.remove();
    }

    const slideWrap = card.querySelector('[data-field="slides"]');
    renderSlides(slideWrap, lesson);

    const completeBtn = card.querySelector('[data-action="complete"]');
    const hint = card.querySelector(".lesson-hint");
    const nextLesson = getNextLessonById(sorted, lesson._idKey);
    if (!nextLesson) {
      completeBtn.disabled = true;
      completeBtn.textContent = "Ultima aula";
      hint.textContent = "Voce concluiu todas as aulas.";
    } else {
      completeBtn.addEventListener("click", () => handleComplete(lesson));
    }

    lessonList.appendChild(card);
  });
};

const sortLessons = (lessons, mode) => {
  const sorted = [...lessons];
  const byDate = (value) => (value ? new Date(value).getTime() : 0);

  sorted.sort((a, b) => {
    switch (mode) {
      case "id-asc":
        return Number(a.id || 0) - Number(b.id || 0);
      case "id-desc":
        return Number(b.id || 0) - Number(a.id || 0);
      case "created-asc":
        return byDate(a.createdAt) - byDate(b.createdAt);
      case "created-desc":
        return byDate(b.createdAt) - byDate(a.createdAt);
      default:
        return 0;
    }
  });

  return sorted;
};

const applyFilters = () => {
  const query = searchInput.value.trim().toLowerCase();
  let list = [...state.lessons];

  if (query) {
    list = list.filter((lesson) => lesson._search.includes(query));
  }

  list = sortLessons(list, sortSelect.value);
  state.filtered = list;
  renderLessons();
};

const updateStats = () => {
  lessonCount.textContent = state.allLessons.length ? String(state.allLessons.length) : "--";
  lastUpdated.textContent = state.lastUpdated ? formatDate(state.lastUpdated) : "--";
};

const setStatus = (value) => {
  statusText.textContent = value;
};

const toggleAll = () => {
  state.expanded = !state.expanded;
  toggleAllBtn.textContent = state.expanded ? "Recolher tudo" : "Expandir tudo";
  document.querySelectorAll(".lesson-section").forEach((section) => {
    section.open = state.expanded;
  });
};

const scrollTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const loadLessons = async () => {
  setStatus("Carregando...");
  try {
    const response = await fetch(ENDPOINT, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Falha ao carregar: ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data)
      ? data
      : data?.items || data?.aulas || data?.data || [];

    const normalized = items.map(normalizeLesson);
    state.allLessons = normalized;
    const sorted = getSortedLessons(state.allLessons);
    const nextFromProgress = getNextFromProgress(sorted);
    const dailyLesson = getDailyLesson(sorted);
    state.lessons = nextFromProgress ? [nextFromProgress] : dailyLesson ? [dailyLesson] : [];
    state.lastUpdated = new Date().toISOString();
    updateStats();
    applyFilters();
    if (state.lessons.length) {
      setStatus(nextFromProgress ? "Proxima aula liberada" : "Aula do dia liberada");
    } else {
      setStatus(state.progress.lastCompletedId ? "Aulas finalizadas" : "Sem aula hoje");
    }
  } catch (error) {
    console.error(error);
    setStatus("Erro na carga");
    renderEmpty("Nao foi possivel carregar as aulas. Verifique a conexao.");
  }
};

const init = () => {
  state.progress = loadProgress();
  state.comments = loadComments();
  applyTheme(loadTheme());
  if (themeToggle) {
    themeToggle.addEventListener("change", (event) => {
      const isDark = event.target.checked;
      applyTheme(isDark ? "dark" : "light");
    });
  }
  refreshBtn.addEventListener("click", loadLessons);
  searchInput.addEventListener("input", applyFilters);
  sortSelect.addEventListener("change", applyFilters);
  toggleAllBtn.addEventListener("click", toggleAll);
  scrollTopBtn.addEventListener("click", scrollTop);

  loadLessons();
};

init();

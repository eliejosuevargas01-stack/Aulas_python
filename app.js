/**
 * APP.JS - VERSÃO ROBUSTA PARA DASHBOARD TECH
 * Focado em garantir que as requisições aconteçam.
 */

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Sistema Iniciado. Carregando módulos...");

  // --- 1. CONFIGURAÇÕES E CONSTANTES ---
  const CONFIG = {
    endpoints: {
      lessons: "https://myn8n.seommerce.shop/webhook/Aulas_python",
      actions: "https://myn8n.seommerce.shop/webhook/Aulas_python_actions",
    },
    pyodideUrl: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/",
    storageKey: "pylab_progress_v3",
    slideKey: "pylab_slide_indices_v1",
    codeKey: "pylab_code_cache_v1",
    chatKey: "pylab_chat_history_v1",
    quizKey: "pylab_quiz_answers_v1",
    quizGradeKey: "pylab_quiz_grades_v1",
    quizResultKey: "pylab_quiz_results_v1",
    themeKey: "pylab_theme_v1",
  };

  // Configuração das Seções (Slides Dinâmicos)
  const SECTIONS = [
    { key: "Contexto_problema", label: "Contexto e Problema" },
    { key: "Objetivo", label: "Objetivo da Aula" },
    { key: "Logica_programacao", label: "Lógica de Programação" },
    { key: "Conceitos_tecnicos", label: "Conceitos Técnicos" },
    { key: "Implementacao_guiada", label: "Implementação Guiada" },
    { key: "Pratica_guiada", label: "Prática Guiada" },
    { key: "Exercicios", label: "Exercícios Práticos" },
    { key: "Desafio_mercado", label: "Desafio de Mercado" },
    { key: "Mini_prova", label: "Mini Prova Teórica" },
    { key: "Criterios_avaliacao", label: "Critérios de Avaliação" },
    { key: "Conexao_proximos_passos", label: "Próximos Passos" },
  ];

  const HIGHLIGHTS = [
    { key: "Logica_programacao", label: "Lógica" },
    { key: "Conceitos_tecnicos", label: "Conceitos" },
    { key: "Implementacao_guiada", label: "Impl. Guiada" },
    { key: "Exercicios", label: "Exercícios" },
  ];

  const HTML_BLOCK_TAGS = new Set([
    "p",
    "div",
    "section",
    "article",
    "header",
    "footer",
    "aside",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "pre",
    "blockquote",
  ]);

  const htmlToPlainText = (html) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    const parts = [];

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue.replace(/\s+/g, " ");
        if (text.trim()) parts.push(text);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();
      if (tag === "br") {
        parts.push("\n");
        return;
      }
      if (tag === "pre") {
        const preText = node.textContent || "";
        const trimmed = preText.replace(/\n{3,}/g, "\n\n").trim();
        if (trimmed) {
          parts.push("\n```");
          parts.push(`\n${trimmed}\n`);
          parts.push("```\n");
        }
        return;
      }
      if (tag === "code") {
        const inline = node.textContent || "";
        if (inline.trim()) parts.push(`\`${inline.trim()}\``);
        return;
      }
      if (tag === "li") {
        parts.push("\n- ");
        node.childNodes.forEach(walk);
        return;
      }

      const isBlock = HTML_BLOCK_TAGS.has(tag);
      if (isBlock) parts.push("\n");
      node.childNodes.forEach(walk);
      if (isBlock) parts.push("\n");
    };

    walk(wrapper);
    return parts
      .join("")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const normalizeLessonText = (value) => {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
    return looksLikeHtml ? htmlToPlainText(trimmed) : trimmed;
  };

  const normalizeHeading = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  const stripDuplicateHeading = (text, label) => {
    if (!label) return text;
    const lines = text.split("\n");
    const first = (lines[0] || "").trim();
    if (!first) return text;
    const normalizedLabel = normalizeHeading(label);
    const normalizedFirst = normalizeHeading(first);
    if (!normalizedLabel || !normalizedFirst) return text;
    if (
      normalizedFirst === normalizedLabel ||
      normalizedFirst.includes(normalizedLabel) ||
      normalizedLabel.includes(normalizedFirst)
    ) {
      return lines.slice(1).join("\n").trim();
    }
    return text;
  };

  // --- 2. ESTADO GLOBAL ---
  const state = {
    allLessons: [],
    filteredLessons: [],
    completedLessons: [],
    progress: { completedIds: [], lastCompletedId: null, exercisesIds: [] },
    viewingCompletedId: null,
    showAllLessons: true,
    slideIndices: {}, // Controle de qual slide está aberto em cada aula
    slideContextById: {},
    codeCache: {},
    chatHistory: {},
    quizAnswers: {},
    quizGrades: {},
    quizResults: {},
    lastUpdated: null,
  };

  // --- 3. ELEMENTOS DO DOM (Cache) ---
  const UI = {
    lessonList: document.getElementById("lessonList"),
    completedList: document.getElementById("completedList"),
    lessonCount: document.getElementById("lessonCount"),
    lastUpdated: document.getElementById("lastUpdated"),
    statusText: document.getElementById("statusText"),
    searchInput: document.getElementById("searchInput"),
    sortSelect: document.getElementById("sortSelect"),
    refreshBtn: document.getElementById("refreshBtn"),
    toggleAllBtn: document.getElementById("toggleAllBtn"),
    scrollTopBtn: document.getElementById("scrollTopBtn"),
    themeToggle: document.getElementById("themeToggle"),
    dashProgressValue: document.querySelector(".dash-value-big"),
    dashProgressBar: document.querySelector(".progress-bar"),
    dashCompletedCount: document.querySelector(".stat-item.success .stat-num"),
    dsPercentText: document.getElementById("dsPercentText"),
    dsProgressBar: document.getElementById("dsProgressBar"),
    dsCompleted: document.getElementById("dsCompleted"),
    dsAvgGrade: document.getElementById("dsAvgGrade"),
    templates: {
      lesson: document.getElementById("lessonTemplate"),
      completed: document.getElementById("completedTemplate"),
    },
  };

  // --- 4. FUNÇÕES UTILITÁRIAS ---

  const utils = {
    formatDate: (dateString) => {
      if (!dateString) return "--/--/--";
      try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat("pt-BR").format(date);
      } catch (e) {
        return dateString;
      }
    },

    setStatus: (text, type = "normal") => {
      if (!UI.statusText) return;
      UI.statusText.textContent = text;
      if (type === "error") UI.statusText.style.color = "#ff7b72";
      else if (type === "success") UI.statusText.style.color = "var(--status-success)";
      else UI.statusText.style.color = "var(--text-primary)";
    },

    htmlToText: (html) => normalizeLessonText(html),

    normalizeId: (raw) => String(raw || Math.random()).trim(),
    
    // Normaliza os dados vindos do N8N para um formato padrão
    normalizeLesson: (raw) => {
      // Tenta pegar o objeto aula se vier aninhado, senão usa o raw
      const data = raw.aula || raw;
      
      const lesson = { ...data };
      lesson._id = utils.normalizeId(lesson.id || lesson.ID || lesson.Id);
      
      // Título Inteligente
      const titleSource = normalizeLessonText(
        lesson.title || lesson.titulo || lesson.Objetivo || "Aula sem título",
      );
      lesson._title = titleSource.split("\n")[0].substring(0, 80);
      
      // Dia / Label
      lesson._dayLabel = lesson.dia || lesson.Dia || lesson.day || "--";

      // Resumo
      const summaryText = normalizeLessonText(lesson.Contexto_problema || lesson.Objetivo || "");
      const trimmedSummary = summaryText.trim();
      lesson._summary =
        trimmedSummary.length > 160
          ? `${trimmedSummary.substring(0, 160)}...`
          : trimmedSummary || "Sem resumo disponível.";

      // Tags
      lesson._highlights = HIGHLIGHTS
        .filter(h => lesson[h.key] && lesson[h.key].length > 5)
        .map(h => h.label);

      return lesson;
    }
  };

  // --- 5. LÓGICA DO PYTHON (PYODIDE) ---
  let pyodideWorker = null;
  let pyodideWorkerReady = false;
  let pyodideWorkerInitPromise = null;
  let pyodideRunId = 0;
  const pyodidePending = new Map();

  function initPyodideWorker() {
    if (pyodideWorkerInitPromise) return pyodideWorkerInitPromise;

    pyodideWorkerInitPromise = new Promise((resolve, reject) => {
      try {
        pyodideWorker = new Worker("pyodide-worker.js");

        pyodideWorker.onmessage = (event) => {
          const data = event.data || {};
          if (data.type !== "result") return;
          const pending = pyodidePending.get(data.id);
          if (!pending) return;
          pyodidePending.delete(data.id);
          if (data.error) {
            pending.reject(new Error(data.error));
            return;
          }
          pyodideWorkerReady = true;
          pending.resolve(data.output || "");
        };

        pyodideWorker.onerror = (error) => {
          reject(error);
        };

        resolve();
      } catch (error) {
        reject(error);
      }
    });

    return pyodideWorkerInitPromise;
  }

  function runPythonInWorker(code) {
    return (async () => {
      await initPyodideWorker();
      const id = ++pyodideRunId;
      return new Promise((resolve, reject) => {
        pyodidePending.set(id, { resolve, reject });
        pyodideWorker.postMessage({
          type: "run",
          id,
          code,
          indexURL: CONFIG.pyodideUrl,
        });
      });
    })();
  }

  function extractInputPrompts(code) {
    const prompts = [];
    const re = /\binput\s*\(/g;
    let match;
    while ((match = re.exec(code))) {
      let i = re.lastIndex;
      while (i < code.length && /\s/.test(code[i])) i += 1;
      let prompt = "";
      const quote = code[i];
      if (quote === "'" || quote === '"') {
        i += 1;
        let buf = "";
        while (i < code.length) {
          const ch = code[i];
          if (ch === "\\" && i + 1 < code.length) {
            buf += code[i + 1];
            i += 2;
            continue;
          }
          if (ch === quote) {
            prompt = buf;
            break;
          }
          buf += ch;
          i += 1;
        }
      }
      prompts.push(prompt || `Digite o valor ${prompts.length + 1}`);
    }
    return prompts;
  }

  function wrapCodeWithInputs(code, inputs) {
    if (!inputs.length) return code;
    const serialized = inputs.map((val) => JSON.stringify(String(val)));
    const prelude = [
      "__input_values = [" + serialized.join(", ") + "]",
      "__input_index = 0",
      "def input(prompt=''):",
      "    global __input_index",
      "    if __input_index >= len(__input_values):",
      "        raise EOFError('Sem mais entradas para input()')",
      "    value = __input_values[__input_index]",
      "    __input_index += 1",
      "    return value",
      "",
    ].join("\n");
    return `${prelude}\n${code}`;
  }

  async function collectInputsFromUI(prompts, codeLab, outputElement) {
    if (!prompts.length) return [];
    const stdinWrap = codeLab ? codeLab.querySelector("[data-code-stdin]") : null;
    const stdinInput = codeLab ? codeLab.querySelector("[data-stdin-input]") : null;
    const stdinSend = codeLab ? codeLab.querySelector("[data-stdin-send]") : null;
    const stdinPrompt = codeLab ? codeLab.querySelector("[data-stdin-prompt]") : null;

    if (!stdinWrap || !stdinInput || !stdinSend || !stdinPrompt) {
      const fallbackInputs = [];
      for (let i = 0; i < prompts.length; i += 1) {
        const promptText = prompts[i] || `Digite o valor ${i + 1}`;
        const answer = window.prompt(promptText);
        if (answer === null) return null;
        fallbackInputs.push(answer);
      }
      return fallbackInputs;
    }

    stdinWrap.hidden = false;
    if (outputElement) {
      outputElement.textContent = "Aguardando entrada...";
      outputElement.style.color = "var(--text-secondary)";
    }

    let index = 0;
    const collected = [];

    return new Promise((resolve) => {
      const updatePrompt = () => {
        stdinPrompt.textContent = prompts[index] || `Digite o valor ${index + 1}`;
        stdinInput.value = "";
        stdinInput.focus();
      };

      const cleanup = () => {
        stdinWrap.hidden = true;
        stdinPrompt.textContent = "";
        stdinInput.value = "";
        stdinInput.removeEventListener("keydown", onKeydown);
        stdinSend.removeEventListener("click", onSubmit);
      };

      const onSubmit = () => {
        collected.push(stdinInput.value);
        index += 1;
        if (index >= prompts.length) {
          cleanup();
          resolve(collected);
        } else {
          updatePrompt();
        }
      };

      const onKeydown = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
      };

      stdinSend.addEventListener("click", onSubmit);
      stdinInput.addEventListener("keydown", onKeydown);
      updatePrompt();
    });
  }

  async function executePython(code, outputElement, btnElement, codeLab) {
    if (btnElement) {
      btnElement.disabled = true;
      btnElement.textContent = "Carregando...";
    }
    
    if (!pyodideWorkerReady) {
      outputElement.textContent = "Carregando Python...";
      utils.setStatus("Carregando Kernel...");
      try {
        await initPyodideWorker();
      } catch (err) {
        outputElement.textContent = "Erro ao carregar o Python.";
        utils.setStatus("Erro Kernel", "error");
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.textContent = "Executar";
        }
        return;
      }
    }

    if (btnElement) {
      btnElement.textContent = "Executando...";
    }

    outputElement.innerHTML = "<span style='opacity:0.5'>Processando...</span>";

    try {
      const prompts = extractInputPrompts(code);
      const inputs = await collectInputsFromUI(prompts, codeLab, outputElement);
      if (inputs === null) {
        outputElement.textContent = "Execucao cancelada pelo usuario.";
        outputElement.style.color = "var(--text-secondary)";
        utils.setStatus("Cancelado", "error");
        return;
      }

      const codeToRun = wrapCodeWithInputs(code, inputs);
      const result = await runPythonInWorker(codeToRun);
      outputElement.textContent = result || "> Código executado sem saída.";
      outputElement.style.color = "var(--text-primary)";
      utils.setStatus("Online", "success");
    } catch (err) {
      outputElement.textContent = String(err);
      outputElement.style.color = "#ff7b72";
      utils.setStatus("Erro Kernel", "error");
    } finally {
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.textContent = "Executar";
      }
    }
  }

  // --- 6. ACTIONS (Salvar / Completar) ---

  async function saveExercise(lesson, code, exId, statusEl) {
    statusEl.textContent = "Enviando...";
    
    const formData = new FormData();
    formData.append("action", "exercices");
    formData.append("diaAula", lesson._dayLabel);
    formData.append("exerciseId", exId);
    formData.append("conteudo", code);
    formData.append("criadoEm", new Date().toISOString());
    // Cria arquivo fake para upload
    const blob = new Blob([code], { type: "text/x-python" });
    formData.append("file", blob, `ex_${exId}.py`);

    try {
      await fetch(CONFIG.endpoints.actions, { method: "POST", body: formData });
      statusEl.textContent = "Salvo com sucesso!";
      const cleanedId = String(exId || "").trim();
      const exerciseKey = cleanedId ? `${lesson._id}:${cleanedId}` : `${lesson._id}:${Date.now()}`;
      const next = new Set(state.progress.exercisesIds || []);
      next.add(exerciseKey);
      state.progress.exercisesIds = [...next];
      saveProgress();
      setTimeout(() => statusEl.textContent = "", 3000);
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Erro ao salvar.";
    }
  }

  function renderMiniProvaResult(resultWrap, resultItem) {
    if (!resultWrap) return;
    if (!resultItem || typeof resultItem !== "object") {
      resultWrap.innerHTML = "";
      return;
    }

    const grade = Number(resultItem.nota_prova);
    const gradeText = Number.isFinite(grade) ? grade.toFixed(1) : "--";
    const gradeClass = Number.isFinite(grade)
      ? grade >= 7
        ? "is-good"
        : grade < 5
          ? "is-bad"
          : "is-warn"
      : "";
    const avaliacao = resultItem.avaliacao_geral || "Avaliação recebida.";

    resultWrap.classList.remove("has-fireworks");
    if (Number.isFinite(grade) && grade >= 7) {
      resultWrap.classList.add("has-fireworks");
    }

    resultWrap.innerHTML = `
      <div class="mini-quiz-result-header">
        <span class="mini-quiz-grade ${gradeClass}">Nota: ${gradeText}</span>
        <span class="mini-quiz-status-pill">Resultado</span>
      </div>
      <p class="mini-quiz-feedback">${avaliacao}</p>
    `;

    if (Array.isArray(resultItem.avaliacao_respostas) &&
        resultItem.avaliacao_respostas.length) {
      const list = document.createElement("div");
      list.className = "mini-quiz-result-list";

      resultItem.avaliacao_respostas.forEach((item) => {
        const row = document.createElement("div");
        row.className = "mini-quiz-result-item";
        row.innerHTML = `
          <div class="mini-quiz-result-q">${item.pergunta || ""}</div>
          <div class="mini-quiz-result-a">${item.resposta_aluno || ""}</div>
          <div class="mini-quiz-result-meta">
            <span>Nota: ${item.nota ?? "--"}</span>
            <span>${item.comentario || ""}</span>
          </div>
        `;
        list.appendChild(row);
      });

      resultWrap.appendChild(list);
    }
  }

  async function sendMiniProva(lesson, slideIndex, questions, answers, statusEl, resultWrap) {
    if (statusEl) statusEl.textContent = "Enviando...";
    try {
      const pairs = questions.map((pergunta, idx) => ({
        pergunta,
        resposta: answers[idx] || "",
      }));

      const payload = {
        action: "mini_prova",
        aula: lesson._title,
        diaAula: lesson._dayLabel,
        slideIndex,
        perguntas_respostas: pairs,
        criadoEm: new Date().toISOString(),
      };

      const response = await fetch(CONFIG.endpoints.actions, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Falha ao enviar mini prova.");
      }

      const result = await response.json().catch(() => null);
      const resultItem = Array.isArray(result) ? result[0] : result;
      if (resultItem && typeof resultItem === "object") {
        if (!state.quizResults[lesson._id]) state.quizResults[lesson._id] = {};
        state.quizResults[lesson._id][slideIndex] = resultItem;
        saveQuizResults();
        renderMiniProvaResult(resultWrap, resultItem);
      }

      const grade = Number(resultItem?.nota_prova);
      if (Number.isFinite(grade)) {
        state.quizGrades[lesson._id] = grade;
        saveQuizGrades();
        updateDashboard();
      }

      if (statusEl) statusEl.textContent = "Respostas enviadas!";
      setTimeout(() => {
        if (statusEl) statusEl.textContent = "";
      }, 3000);
    } catch (error) {
      console.error(error);
      if (statusEl) statusEl.textContent = "Erro ao enviar. Tente novamente.";
    }
  }

  async function completeLesson(lesson) {
    const payload = {
      action: "finalizado",
      finalizado: true,
      lessonId: lesson._id,
      diaAula: lesson._dayLabel,
      titulo: lesson._title,
      concluidoEm: new Date().toISOString(),
      dadosAula: lesson 
    };

    try {
      await fetch(CONFIG.endpoints.actions, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return true;
    } catch (err) {
      console.error("Erro ao completar:", err);
      return false;
    }
  }

  async function markLessonCompleted(lesson, completeBtn) {
    if (state.progress.completedIds.includes(lesson._id)) return true;
    if (completeBtn) {
      completeBtn.textContent = "Enviando...";
      completeBtn.disabled = true;
    }

    const success = await completeLesson(lesson);
    if (success) {
      state.progress.completedIds.push(lesson._id);
      state.progress.lastCompletedId = lesson._id;
      saveProgress();
      updateApp();
      return true;
    }

    if (completeBtn) {
      completeBtn.textContent = "Erro. Tente novamente.";
      completeBtn.disabled = false;
    }
    return false;
  }

  // --- 7. RENDERIZAÇÃO DA UI ---

  function renderSlides(container, lesson, options = {}) {
    container.innerHTML = "";
    
    // 1. Filtra seções que têm conteúdo
    const slidesData = SECTIONS
      .map(sec => ({ ...sec, content: lesson[sec.key] }))
      .filter(s => s.content && typeof s.content === 'string' && s.content.trim().length > 0);

    if (slidesData.length === 0) {
      container.innerHTML = "<div class='empty-state'>Conteúdo indisponível para esta aula.</div>";
      return;
    }

    // 2. Índice atual
    let currentIndex = state.slideIndices[lesson._id] || 0;
    if (currentIndex >= slidesData.length) currentIndex = 0;

    // 3. Monta o HTML
    const wrapper = document.createElement("div");
    wrapper.className = "slide-wrapper";
    
    const currentSlide = slidesData[currentIndex];

    // Header do Slide
    const header = document.createElement("div");
    header.className = "slide-header";
    header.innerHTML = `
      <span class="slide-pill">Slide ${currentIndex + 1} de ${slidesData.length}</span>
      <h3 class="slide-title">${currentSlide.label}</h3>
    `;

    // Corpo do Slide (Processa markdown básico)
    const body = document.createElement("div");
    body.className = "slide-body";
    
    // Função simples de renderização de conteúdo
    const rawContent = normalizeLessonText(currentSlide.content);
    const cleanedContent = stripDuplicateHeading(rawContent, currentSlide.label);
    state.slideContextById[lesson._id] = {
      label: currentSlide.label,
      content: cleanedContent,
      index: currentIndex,
      total: slidesData.length,
    };
    const parts = cleanedContent.split("```");
    
    parts.forEach((part, idx) => {
      if (!part.trim()) return;
      if (idx % 2 === 1) { // Código
        const pre = document.createElement("pre");
        pre.textContent = part.trim();
        body.appendChild(pre);
      } else { // Texto
        const div = document.createElement("div");
        div.className = "prose";
        div.textContent = part.trim();
        body.appendChild(div);
      }
    });

    if (currentSlide.key === "Mini_prova") {
      const quizWrapper = document.createElement("div");
      quizWrapper.className = "mini-quiz";

      const quizTitle = document.createElement("h4");
      quizTitle.className = "mini-quiz-title";
      quizTitle.textContent = "Respostas da mini prova";
      quizWrapper.appendChild(quizTitle);

      const questionLines = cleanedContent
        .split("\n")
        .map(line => line.trim())
        .filter(line => /^(\d+[\).]|[-*])\s+/.test(line));

      const questions = questionLines.length
        ? questionLines.map(line => line.replace(/^(\d+[\).]|[-*])\s+/, "").trim())
        : ["Digite suas respostas abaixo."];

      const storedByLesson = state.quizAnswers[lesson._id] || {};
      const storedAnswers = Array.isArray(storedByLesson[currentIndex])
        ? storedByLesson[currentIndex]
        : [];

      const answerStore = [];

      questions.forEach((question, idx) => {
        const item = document.createElement("div");
        item.className = "mini-quiz-item";

        const label = document.createElement("label");
        label.className = "mini-quiz-label";
        label.textContent = question || `Pergunta ${idx + 1}`;

        const textarea = document.createElement("textarea");
        textarea.className = "mini-quiz-input";
        textarea.rows = 4;
        textarea.placeholder = "Escreva sua resposta aqui...";
        textarea.value = storedAnswers[idx] || "";
        answerStore[idx] = textarea.value;
        textarea.addEventListener("input", () => {
          if (!state.quizAnswers[lesson._id]) state.quizAnswers[lesson._id] = {};
          if (!Array.isArray(state.quizAnswers[lesson._id][currentIndex])) {
            state.quizAnswers[lesson._id][currentIndex] = [];
          }
          state.quizAnswers[lesson._id][currentIndex][idx] = textarea.value;
          answerStore[idx] = textarea.value;
          saveQuizAnswers();
        });

        item.appendChild(label);
        item.appendChild(textarea);
        quizWrapper.appendChild(item);
      });

      const resultWrap = document.createElement("div");
      resultWrap.className = "mini-quiz-result";
      const storedResult = state.quizResults?.[lesson._id]?.[currentIndex];
      if (storedResult) {
        renderMiniProvaResult(resultWrap, storedResult);
      }
      quizWrapper.appendChild(resultWrap);

      const actions = document.createElement("div");
      actions.className = "mini-quiz-actions";

      const statusEl = document.createElement("span");
      statusEl.className = "mini-quiz-status";

      const sendBtn = document.createElement("button");
      sendBtn.type = "button";
      sendBtn.className = "btn accent mini-quiz-send";
      sendBtn.textContent = "Enviar respostas";
      sendBtn.addEventListener("click", () => {
        sendBtn.disabled = true;
        sendMiniProva(lesson, currentIndex, questions, answerStore, statusEl, resultWrap)
          .finally(() => {
            sendBtn.disabled = false;
          });
      });

      actions.appendChild(statusEl);
      actions.appendChild(sendBtn);
      quizWrapper.appendChild(actions);

      body.appendChild(quizWrapper);
    }

    // Navegação
    const nav = document.createElement("div");
    nav.className = "slide-nav";
    const isLast = currentIndex === slidesData.length - 1;
    
    nav.innerHTML = `
      <div class="slide-progress">
        <div class="slide-progress-track">
          <div class="slide-progress-bar" style="width: ${((currentIndex + 1) / slidesData.length) * 100}%"></div>
        </div>
      </div>
      <button class="btn ghost prev-btn" ${currentIndex === 0 ? 'disabled' : ''}>Anterior</button>
      <button class="btn accent next-btn">${isLast ? 'Finalizar Leitura' : 'Próximo'}</button>
    `;

    // Eventos de Navegação
    nav.querySelector(".prev-btn").addEventListener("click", () => {
      state.slideIndices[lesson._id] = Math.max(0, currentIndex - 1);
      saveSlideIndices();
      renderSlides(container, lesson, { scrollIntoView: true });
    });

    nav.querySelector(".next-btn").addEventListener("click", () => {
      if (!isLast) {
        state.slideIndices[lesson._id] = currentIndex + 1;
        saveSlideIndices();
        renderSlides(container, lesson, { scrollIntoView: true });
      } else {
        (async () => {
          await markLessonCompleted(lesson);
          const editor = container.closest(".lesson-card").querySelector(".code-input");
          if (editor) editor.focus();
        })();
      }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    wrapper.appendChild(nav);
    container.appendChild(wrapper);

    if (options.scrollIntoView) {
      requestAnimationFrame(() => {
        wrapper.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }

  function renderList() {
    UI.lessonList.innerHTML = "";
    
    // Se não tiver aulas carregadas
    if (state.filteredLessons.length === 0) {
      if (state.allLessons.length === 0) {
         UI.lessonList.innerHTML = "<div class='empty-state'>Carregando conteúdo...</div>";
      } else {
         UI.lessonList.innerHTML = "<div class='empty-state'>Nenhuma aula encontrada com este filtro ou todas foram concluídas.</div>";
      }
      return;
    }

    state.filteredLessons.forEach(lesson => {
      const clone = UI.templates.lesson.content.cloneNode(true);
      const card = clone.querySelector(".lesson-card");
      const isCompleted = state.progress.completedIds.includes(lesson._id);

      // Preenche Textos
      clone.querySelector('[data-field="id"]').textContent = lesson._dayLabel;
      clone.querySelector('[data-field="title"]').textContent = lesson._title;
      clone.querySelector('[data-field="created"]').textContent = `Criado: ${utils.formatDate(lesson.createdAt)}`;
      clone.querySelector('[data-field="updated"]').textContent = `Upd: ${utils.formatDate(lesson.updatedAt)}`;
      clone.querySelector('[data-field="summary"]').textContent = lesson._summary;

      // Highlights
      const highlightBox = clone.querySelector('[data-field="highlights"]');
      if (lesson._highlights && lesson._highlights.length) {
        lesson._highlights.forEach(h => {
          const s = document.createElement("span");
          s.className = "highlight";
          s.textContent = h;
          highlightBox.appendChild(s);
        });
      }

      // Slides
      renderSlides(clone.querySelector('[data-field="slides"]'), lesson);

      // Editor Logic
      const codeLab = clone.querySelector("[data-code-lab]");
      if (codeLab) {
        const runBtn = codeLab.querySelector('[data-action="run-code"]');
        const saveBtn = codeLab.querySelector('[data-action="save-code"]');
        const input = codeLab.querySelector("[data-code-input]");
        const output = codeLab.querySelector("[data-code-output]");
        const exIdInput = codeLab.querySelector("[data-exercise-id]");
        const statusEl = codeLab.querySelector("[data-code-status]");

        if (input && state.codeCache[lesson._id]) {
          input.value = state.codeCache[lesson._id];
        }

        if (input) {
          input.addEventListener("input", () => {
            state.codeCache[lesson._id] = input.value;
            saveCodeCache();
          });
        }

        runBtn.addEventListener("click", () => executePython(input.value, output, runBtn, codeLab));
        saveBtn.addEventListener("click", () => saveExercise(lesson, input.value, exIdInput.value, statusEl));

      }

      const chatMessages = clone.querySelector("[data-chat-messages]");
      const chatInput = clone.querySelector("[data-chat-input]");
      const chatSend = clone.querySelector("[data-chat-send]");
      const chatStatus = clone.querySelector("[data-chat-status]");

      if (chatSend && chatInput && chatMessages && chatStatus) {
        const appendTextMessage = (text, role = "bot") => {
          if (!text) return;
          const row = document.createElement("div");
          row.className = `code-chat-message ${role}`;
          row.textContent = text;
          chatMessages.appendChild(row);
        };

        const appendCodeBlock = (codeBlock) => {
          if (!codeBlock || codeBlock.existe !== true || !codeBlock.codigo) return;
          const wrapper = document.createElement("div");
          wrapper.className = "code-chat-message bot";

          const header = document.createElement("div");
          header.className = "code-chat-code-header";
          header.textContent = codeBlock.linguagem || "codigo";

          const copyBtn = document.createElement("button");
          copyBtn.type = "button";
          copyBtn.className = "btn ghost";
          copyBtn.textContent = "Copiar";
          copyBtn.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(codeBlock.codigo);
              copyBtn.textContent = "Copiado";
              setTimeout(() => (copyBtn.textContent = "Copiar"), 1500);
            } catch (error) {
              copyBtn.textContent = "Erro";
            }
          });

          const headerWrap = document.createElement("div");
          headerWrap.className = "code-chat-code-bar";
          headerWrap.appendChild(header);
          headerWrap.appendChild(copyBtn);

          const pre = document.createElement("pre");
          const code = document.createElement("code");
          code.className = codeBlock.linguagem
            ? `language-${codeBlock.linguagem}`
            : "language-python";
          code.textContent = codeBlock.codigo;
          pre.appendChild(code);

          wrapper.appendChild(headerWrap);
          wrapper.appendChild(pre);
          chatMessages.appendChild(wrapper);
        };

        const storeChatEntry = (entry) => {
          if (!lesson._id) return;
          if (!state.chatHistory[lesson._id]) state.chatHistory[lesson._id] = [];
          state.chatHistory[lesson._id].push(entry);
          saveChatHistory();
        };

        const appendAndStoreText = (text, role = "bot") => {
          if (!text) return;
          appendTextMessage(text, role);
          storeChatEntry({ role, kind: "text", text });
        };

        const appendAndStoreCode = (codeBlock) => {
          if (!codeBlock || codeBlock.existe !== true || !codeBlock.codigo) return;
          appendCodeBlock(codeBlock);
          storeChatEntry({
            role: "bot",
            kind: "code",
            language: codeBlock.linguagem || "python",
            description: codeBlock.descricao || "",
            code: codeBlock.codigo,
          });
        };

        const history = state.chatHistory[lesson._id] || [];
        history.forEach((entry) => {
          if (entry.kind === "code") {
            appendCodeBlock({
              existe: true,
              linguagem: entry.language,
              descricao: entry.description,
              codigo: entry.code,
            });
          } else {
            appendTextMessage(entry.text, entry.role || "bot");
          }
        });
        if (history.length) {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        chatSend.addEventListener("click", async () => {
          const message = chatInput.value.trim();
          if (!message) return;
          const context = state.slideContextById[lesson._id] || {};

          appendAndStoreText(message, "user");
          chatMessages.scrollTop = chatMessages.scrollHeight;

          chatInput.value = "";
          chatStatus.textContent = "Enviando...";
          chatSend.disabled = true;

          try {
            const payload = {
              action: "duvida",
              aula: lesson._title,
              contexto: context.content || "",
              mensagem: message,
              criadoEm: new Date().toISOString(),
            };

            const response = await fetch(CONFIG.endpoints.actions, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (response.ok) {
              const data = await response.json().catch(() => ({}));
              const responses = Array.isArray(data) ? data : [data];

              const extractCodeBlock = (text) => {
                const match = text.match(/\{[^]*?\}/);
                if (!match) return null;
                try {
                  const parsed = JSON.parse(match[0]);
                  return parsed && typeof parsed === "object" ? parsed : null;
                } catch (error) {
                  return null;
                }
              };

              const stripEmbeddedJson = (text) =>
                text.replace(/\{[^]*?\}/g, "").replace(/\[\s*\]/g, "").trim();

              const normalizeStep = (step) => {
                if (typeof step === "string") return step.trim();
                if (step && typeof step === "object") {
                  const values = Object.values(step)
                    .filter((v) => typeof v === "string" && v.trim())
                    .map((v) => v.trim());
                  return values.join(" - ");
                }
                return "";
              };

              let renderedAny = false;

              responses.forEach((responseItem) => {
                const professorRaw =
                  responseItem?.professor ?? responseItem?.resposta ?? responseItem?.message ?? "";

                if (responseItem?.resposta_curta || responseItem?.explicacao_detalhada) {
                  appendAndStoreText(String(responseItem.resposta_curta || "").trim());
                  appendAndStoreText(String(responseItem.explicacao_detalhada || "").trim());

                  if (responseItem?.codigo_exemplo?.descricao) {
                    appendAndStoreText(String(responseItem.codigo_exemplo.descricao || "").trim());
                  }

                  appendAndStoreCode(responseItem?.codigo_exemplo);

                  if (Array.isArray(responseItem?.passos) && responseItem.passos.length) {
                    const steps = responseItem.passos
                      .map(normalizeStep)
                      .filter(Boolean)
                      .map((step) => `- ${step}`)
                      .join("\n");
                    appendAndStoreText(steps);
                  }

                  appendAndStoreText(String(responseItem.aviso_importante || "").trim());
                  renderedAny = true;
                  return;
                }

                const messageText = stripEmbeddedJson(String(professorRaw || "")).trim();
                const codeBlock = extractCodeBlock(String(professorRaw || ""));

                if (messageText) {
                  appendAndStoreText(messageText);
                  renderedAny = true;
                }

                if (codeBlock && codeBlock.existe === true && codeBlock.codigo) {
                  appendAndStoreCode(codeBlock);
                  renderedAny = true;
                }
              });

              if (!renderedAny) {
                appendAndStoreText("Resposta recebida.");
              }

              chatMessages.scrollTop = chatMessages.scrollHeight;
              chatStatus.textContent = "";
            } else {
              appendAndStoreText("Falha ao enviar sua mensagem.");
              chatMessages.scrollTop = chatMessages.scrollHeight;
              chatStatus.textContent = "";
            }
          } catch (error) {
            console.error(error);
            chatStatus.textContent = "Erro ao enviar. Tente novamente.";
          } finally {
            chatSend.disabled = false;
          }
        });
      }

      // Botão Concluir
      const completeBtn = clone.querySelector('[data-action="complete"]');
      if (isCompleted) {
        completeBtn.textContent = "✔ Concluído";
        completeBtn.disabled = true;
        completeBtn.classList.remove("accent");
      } else {
        completeBtn.addEventListener("click", async () => {
          await markLessonCompleted(lesson, completeBtn);
        });
      }

      UI.lessonList.appendChild(clone);
    });
  }

  function renderCompletedList() {
    UI.completedList.innerHTML = "";
    
    if (state.completedLessons.length === 0) {
      UI.completedList.innerHTML = "<div class='empty-state'>Nenhuma aula finalizada.</div>";
      return;
    }

    state.completedLessons.forEach(lesson => {
      const clone = UI.templates.completed.content.cloneNode(true);
      clone.querySelector('[data-field="id"]').textContent = lesson._dayLabel;
      clone.querySelector('[data-field="title"]').textContent = lesson._title;
      clone.querySelector('[data-field="summary"]').textContent = lesson._summary;

      // Botão de Ver
      clone.querySelector('[data-action="view"]').addEventListener("click", () => {
        state.viewingCompletedId = lesson._id;
        state.showAllLessons = false;
        if (UI.toggleAllBtn) UI.toggleAllBtn.textContent = "Ver todas";
        updateApp(); // Atualiza a lista principal para mostrar só essa
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      UI.completedList.appendChild(clone);
    });
  }

  function updateDashboard() {
    const total = state.allLessons.length;
    const completedSet = new Set(state.progress.completedIds || []);
    state.allLessons
      .filter((lesson) => lesson.finalizado === true)
      .forEach((lesson) => completedSet.add(lesson._id));
    const completed = completedSet.size;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    const gradeValues = state.allLessons
      .map((lesson) => state.quizGrades[lesson._id] ??
        lesson.nota_mini_prova ??
        lesson.notaMiniProva ??
        lesson.nota)
      .map((value) => {
        if (value === null || value === undefined || value === "") return null;
        const parsed = Number(String(value).replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
      })
      .filter((value) => value !== null);
    const avgGrade = gradeValues.length
      ? gradeValues.reduce((sum, value) => sum + value, 0) / gradeValues.length
      : null;

    if (UI.lessonCount) UI.lessonCount.textContent = total;
    if (UI.dashCompletedCount) UI.dashCompletedCount.textContent = completed;
    if (UI.dashProgressValue) UI.dashProgressValue.textContent = `${percent}%`;
    if (UI.dashProgressBar) UI.dashProgressBar.style.width = `${percent}%`;
    if (UI.lastUpdated) UI.lastUpdated.textContent = utils.formatDate(state.lastUpdated);
    if (UI.dsPercentText) UI.dsPercentText.textContent = `${percent}%`;
    if (UI.dsProgressBar) UI.dsProgressBar.style.width = `${percent}%`;
    if (UI.dsCompleted) UI.dsCompleted.textContent = completed;
    if (UI.dsAvgGrade) {
      UI.dsAvgGrade.textContent = avgGrade === null ? "--" : avgGrade.toFixed(1);
    }
  }

  function loadProgress() {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) {
      return { completedIds: [], lastCompletedId: null, exercisesIds: [] };
    }
    try {
      const data = JSON.parse(raw);
      return {
        completedIds: Array.isArray(data.completedIds) ? data.completedIds : [],
        lastCompletedId: data.lastCompletedId ?? null,
        exercisesIds: Array.isArray(data.exercisesIds) ? data.exercisesIds : [],
      };
    } catch (error) {
      console.warn("Falha ao ler progresso", error);
      return { completedIds: [], lastCompletedId: null, exercisesIds: [] };
    }
  }

  function saveProgress() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.progress));
  }

  function loadSlideIndices() {
    try {
      const raw = localStorage.getItem(CONFIG.slideKey);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch (error) {
      console.warn("Falha ao ler slides", error);
      return {};
    }
  }

  function saveSlideIndices() {
    localStorage.setItem(CONFIG.slideKey, JSON.stringify(state.slideIndices));
  }

  function loadCodeCache() {
    try {
      const raw = localStorage.getItem(CONFIG.codeKey);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch (error) {
      console.warn("Falha ao ler codigo salvo", error);
      return {};
    }
  }

  function saveCodeCache() {
    localStorage.setItem(CONFIG.codeKey, JSON.stringify(state.codeCache));
  }

  function loadChatHistory() {
    try {
      const raw = localStorage.getItem(CONFIG.chatKey);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch (error) {
      console.warn("Falha ao ler chat salvo", error);
      return {};
    }
  }

  function saveChatHistory() {
    localStorage.setItem(CONFIG.chatKey, JSON.stringify(state.chatHistory));
  }

  function loadQuizAnswers() {
    try {
      const raw = localStorage.getItem(CONFIG.quizKey);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch (error) {
      console.warn("Falha ao ler respostas da mini prova", error);
      return {};
    }
  }

  function saveQuizAnswers() {
    localStorage.setItem(CONFIG.quizKey, JSON.stringify(state.quizAnswers));
  }

  function loadQuizGrades() {
    try {
      const raw = localStorage.getItem(CONFIG.quizGradeKey);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch (error) {
      console.warn("Falha ao ler notas da mini prova", error);
      return {};
    }
  }

  function saveQuizGrades() {
    localStorage.setItem(CONFIG.quizGradeKey, JSON.stringify(state.quizGrades));
  }

  function loadQuizResults() {
    try {
      const raw = localStorage.getItem(CONFIG.quizResultKey);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch (error) {
      console.warn("Falha ao ler resultado da mini prova", error);
      return {};
    }
  }

  function saveQuizResults() {
    localStorage.setItem(CONFIG.quizResultKey, JSON.stringify(state.quizResults));
  }

  // --- 8. GERENCIAMENTO DE DADOS (CORE) ---

  function applyFilters() {
    const searchTerm = UI.searchInput.value.toLowerCase();
    
    // 1. Separa Pendentes de Concluídas
    const all = state.allLessons;
    const completedIds = state.progress.completedIds;
    
    // Atualiza listas globais
    state.completedLessons = all.filter(
      (lesson) => completedIds.includes(lesson._id) || lesson.finalizado === true,
    );
    const pendingLessons = all.filter(
      (lesson) => !completedIds.includes(lesson._id) && lesson.finalizado !== true,
    );

    // 2. Decide o que mostrar na lista principal
    let toShow = [];

    if (state.viewingCompletedId) {
      // Modo Revisão: Mostra apenas a aula clicada no histórico
      toShow = all.filter(l => l._id === state.viewingCompletedId);
    } else if (state.showAllLessons) {
      // Modo Ver Todas: mostra todas as aulas
      toShow = all;
    } else if (searchTerm) {
      // Modo Busca: Busca em TUDO (pendentes e concluídas)
      toShow = all.filter(l => 
        l._title.toLowerCase().includes(searchTerm) || 
        l._summary.toLowerCase().includes(searchTerm)
      );
    } else {
      // Modo Padrão: Mostra a PRÓXIMA pendente (Foco)
      // Se tiver pendentes, pega a primeira. Se não, não mostra nada na lista principal.
      toShow = pendingLessons.length > 0 ? [pendingLessons[0]] : [];
    }

    state.filteredLessons = toShow;
  }

  function updateApp() {
    applyFilters();
    renderList();
    renderCompletedList();
    updateDashboard();
  }

  async function loadData() {
    utils.setStatus("Conectando...");
    console.log("📡 Fetching data from:", CONFIG.endpoints.lessons);
    
    try {
      const res = await fetch(CONFIG.endpoints.lessons);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const json = await res.json();
      console.log("📦 Data received:", json);

      // Normaliza dados (aceita array ou objeto com items)
      const rawItems = Array.isArray(json) ? json : (json.items || json.data || []);
      state.allLessons = rawItems.map(utils.normalizeLesson);
      const merged = new Set(state.progress.completedIds || []);
      state.allLessons
        .filter((lesson) => lesson.finalizado === true)
        .forEach((lesson) => merged.add(lesson._id));
      if (merged.size !== (state.progress.completedIds || []).length) {
        state.progress.completedIds = [...merged];
        saveProgress();
      }
      state.lastUpdated = new Date().toISOString();

      utils.setStatus("Online", "success");
      updateApp();

    } catch (err) {
      console.error("Erro fatal no fetch:", err);
      utils.setStatus("Erro Conexão", "error");
      UI.lessonList.innerHTML = `
        <div class="empty-state" style="color:#ff7b72">
          Falha ao conectar com o servidor.<br>
          <small>${err.message}</small><br>
          <button class="btn ghost" onclick="location.reload()" style="margin-top:10px">Tentar novamente</button>
        </div>
      `;
    }
  }

  // --- 9. INICIALIZAÇÃO E EVENTOS ---

  function init() {
    // Carrega progresso
    state.progress = loadProgress();
    state.slideIndices = loadSlideIndices();
    state.codeCache = loadCodeCache();
    state.chatHistory = loadChatHistory();
    state.quizAnswers = loadQuizAnswers();
    state.quizGrades = loadQuizGrades();
    state.quizResults = loadQuizResults();

    // Carrega tema
    const theme = localStorage.getItem(CONFIG.themeKey);
    if (theme === "light") {
      document.body.dataset.theme = "light";
      if(UI.themeToggle) UI.themeToggle.checked = false;
    }

    // Eventos
    UI.refreshBtn.addEventListener("click", loadData);
    UI.searchInput.addEventListener("input", () => {
      state.viewingCompletedId = null; // Sai do modo revisão ao buscar
      updateApp();
    });

    if (UI.toggleAllBtn) {
      UI.toggleAllBtn.textContent = state.showAllLessons ? "Ver somente próxima" : "Ver todas";
      UI.toggleAllBtn.addEventListener("click", () => {
        state.showAllLessons = !state.showAllLessons;
        state.viewingCompletedId = null;
        UI.toggleAllBtn.textContent = state.showAllLessons ? "Ver somente próxima" : "Ver todas";
        updateApp();
      });
    }
    
    if (UI.scrollTopBtn) {
      UI.scrollTopBtn.addEventListener("click", () => window.scrollTo({top:0, behavior:'smooth'}));
    }

    if (UI.themeToggle) {
      UI.themeToggle.addEventListener("change", (e) => {
        const t = e.target.checked ? "dark" : "light";
        document.body.dataset.theme = t;
        localStorage.setItem(CONFIG.themeKey, t);
      });
    }

    // Inicia
    loadData();
  }

  init();
});

// Adicione isso no final do app.js para colorir o código automaticamente
const highlightCodeBlocks = (targets) => {
  if (!window.Prism) return;

  targets.forEach((node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

    const preBlocks = node.matches("pre") ? [node] : node.querySelectorAll("pre");
    preBlocks.forEach((pre) => {
      if (!pre.classList.contains("language-python") &&
          ![...pre.classList].some((cls) => cls.startsWith("language-"))) {
        pre.classList.add("language-python");
      }
      const codeEl = pre.querySelector("code") || pre;
      if (!codeEl.dataset.prismHighlighted) {
        window.Prism.highlightElement(codeEl);
        codeEl.dataset.prismHighlighted = "true";
      }
    });
  });
};

// Observador: só colore os blocos novos ao invés de reprocessar tudo
const observer = new MutationObserver((mutations) => {
  const nodesToHighlight = [];
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => nodesToHighlight.push(node));
  });
  if (nodesToHighlight.length) {
    highlightCodeBlocks(nodesToHighlight);
  }
});

const lessonList = document.getElementById("lessonList");
if (lessonList) {
  observer.observe(lessonList, {
    childList: true,
    subtree: true,
  });
}

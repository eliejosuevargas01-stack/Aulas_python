/* dashboard.js - Lógica Visual do Painel de Progresso */

document.addEventListener("DOMContentLoaded", () => {
  const TOTAL_LESSONS = 86;
  const STORAGE_KEY = "pylab_progress_v3";

  const LEVELS = [
    { count: 0, label: "Estagiário" },
    { count: 10, label: "Júnior I" },
    { count: 25, label: "Júnior II" },
    { count: 45, label: "Pleno I" },
    { count: 65, label: "Pleno II" },
    { count: 80, label: "Sênior" },
  ];

  const elBar = document.getElementById("dsProgressBar");
  const elText = document.getElementById("dsPercentText");
  const elCompletedCount = document.getElementById("dsCompleted");
  const elLevel = document.getElementById("dsLevel");
  const elGrade = document.getElementById("dsAvgGrade");
  const elExercises = document.getElementById("dsExercises");

  const getTotalLessons = () => {
    const totalText = document.getElementById("lessonCount")?.textContent;
    const parsed = Number.parseInt(totalText || "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : TOTAL_LESSONS;
  };

  const updateDashboard = () => {
    let completedCount = 0;
    let exercisesCount = 0;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.completedIds && Array.isArray(data.completedIds)) {
          completedCount = data.completedIds.length;
        }
        if (data.exercisesIds && Array.isArray(data.exercisesIds)) {
          exercisesCount = data.exercisesIds.length;
        }
      }
    } catch (error) {
      console.error("Erro ao ler progresso para o dashboard", error);
    }

    const totalLessons = getTotalLessons();
    const rawPercent = (completedCount / totalLessons) * 100;
    const percent = Math.min(100, Math.max(0, Math.round(rawPercent)));

    const currentLevel =
      LEVELS.slice()
        .reverse()
        .find((level) => completedCount >= level.count) || LEVELS[0];

    if (elBar) elBar.style.width = `${percent}%`;
    if (elText) elText.innerText = `${percent}%`;
    if (elCompletedCount) elCompletedCount.innerText = completedCount;
    if (elLevel) elLevel.innerText = currentLevel.label;
    if (elExercises) elExercises.innerText = exercisesCount;

    if (elGrade) {
      elGrade.innerText = completedCount > 0 ? "Em análise..." : "--";
      elGrade.style.fontSize = completedCount > 0 ? "0.8rem" : "1.2rem";
    }
  };

  updateDashboard();

  document.body.addEventListener("click", (event) => {
    if (event.target.closest("button")) {
      setTimeout(updateDashboard, 1000);
    }
  });
});

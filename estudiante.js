// CONFIGURACIÓN DE CONEXIÓN CON SUPABASE
const SUPABASE_URL = 'https://bpxjhwjjemtseblstkmo.supabase.co';
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweGpod2pqZW10c2VibHN0a21vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTkzODYsImV4cCI6MjEwODk3NTM4Nn0.GWNCsGSgyXLX7aG_DjHenKt7xpnnv7fdBMYbUJ-K_Co";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. VERIFICAR SESIÓN DE ESTUDIANTE
const currentUser = JSON.parse(localStorage.getItem("ranknotes_user") || "null");

if (!currentUser || currentUser.rol !== "estudiante") {
  alert("Acceso exclusivo para estudiantes matriculados.");
  window.location.href = "login.html";
}

let selectedPeriod = "s1";
let myStudentData = null;
let classmatesData = [];
let allSubjects = [];

function logout() {
  localStorage.removeItem("ranknotes_user");
  window.location.href = "login.html";
}

function formatScore(score) {
  return score === null || score === undefined ? "—" : `${score.toFixed(1).replace(".", ",")} pts`;
}

function initials(name) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

// 2. INICIALIZAR Y CARGAR DATOS EXCLUSIVOS DEL CURSO
async function inicializarPortalEstudiante() {
  // Configurar cabecera
  document.querySelector("#student-name").textContent = currentUser.nombre;
  document.querySelector("#student-avatar").textContent = initials(currentUser.nombre);
  document.querySelector("#welcome-message").textContent = `¡Hola, ${currentUser.nombre.split(" ")[0]}!`;

  try {
    // A. Obtener detalles del estudiante y su curso
    const { data: est, error: errEst } = await client
      .from('usuarios')
      .select('id, nombre_completo, ci, curso_id, cursos(grado, paralelo, nivel)')
      .eq('id', currentUser.id)
      .single();

    if (errEst || !est) throw new Error("No se pudo cargar la información del estudiante.");
    myStudentData = est;

    const cursoDesc = est.cursos ? `${est.cursos.grado} - Paralelo "${est.cursos.paralelo}"` : "Sin curso asignado";
    document.querySelector("#student-course-badge").textContent = cursoDesc;
    document.querySelector("#course-name-title").textContent = `Cuadro general de ${cursoDesc}`;

    // B. Obtener todas las materias del nivel (Primaria o Secundaria)
    const { data: materias } = await client
      .from('materias')
      .select('id, nombre, nivel')
      .eq('nivel', est.cursos ? est.cursos.nivel : 'Secundaria')
      .order('nombre');
    allSubjects = materias || [];

    // C. Cargar SOLO los estudiantes del mismo curso (Compañeros de aula)
    const { data: companeros, error: errComp } = await client
      .from('usuarios')
      .select(`
        id,
        nombre_completo,
        ci,
        estado,
        calificaciones (materia_id, periodo, nota)
      `)
      .eq('curso_id', est.curso_id)
      .eq('rol', 'estudiante')
      .order('nombre_completo');

    if (errComp) throw errComp;
    classmatesData = companeros || [];

    render();
  } catch (err) {
    console.error("Error al cargar datos del estudiante:", err);
  }
}

// 3. CALCULAR PROMEDIOS
function calcularPromedio(calificaciones, periodo) {
  const notas = (calificaciones || []).filter(c => (periodo === "year" ? true : c.periodo === periodo));
  if (notas.length === 0) return null;
  const suma = notas.reduce((acc, curr) => acc + parseFloat(curr.nota), 0);
  return suma / notas.length;
}

// 4. RENDERIZADO VISUAL
function render() {
  // A. Procesar y ordenar compañeros del aula
  const rankingCurso = classmatesData
    .map(c => ({
      ...c,
      promedio: calcularPromedio(c.calificaciones, selectedPeriod)
    }))
    .sort((a, b) => {
      if (a.estado !== b.estado) return a.estado === "activo" ? -1 : 1;
      if (a.promedio === null) return 1;
      if (b.promedio === null) return -1;
      return b.promedio - a.promedio;
    });

  const activosConNota = rankingCurso.filter(c => c.estado === "activo" && c.promedio !== null);

  // B. Métricas del estudiante actual
  const yoEnRanking = rankingCurso.find(c => c.id === myStudentData.id);
  const miPromedio = yoEnRanking ? yoEnRanking.promedio : null;
  const miPuesto = yoEnRanking && miPromedio !== null ? (activosConNota.findIndex(c => c.id === myStudentData.id) + 1) : "—";

  document.querySelector("#my-average").textContent = formatScore(miPromedio);
  document.querySelector("#my-rank").textContent = miPuesto !== "—" ? `#${miPuesto}` : "—";
  document.querySelector("#my-rank-total").textContent = `entre ${classmatesData.length} compañeros de curso`;

  const periodoTexto = document.querySelector(".period-button.active").textContent;
  if (miPuesto === 1) {
    document.querySelector("#personal-summary-text").textContent = `¡Felicidades! Tienes el mejor promedio de tu curso en el ${periodoTexto}.`;
  } else if (miPuesto !== "—") {
    document.querySelector("#personal-summary-text").textContent = `Ocupas el puesto #${miPuesto} de tu aula con un promedio de ${formatScore(miPromedio)} en el ${periodoTexto}.`;
  } else {
    document.querySelector("#personal-summary-text").textContent = `Aún no se han completado las valoraciones para el ${periodoTexto}.`;
  }

  // C. Renderizar Boletín de notas personales
  renderBoletinPersonal();

  // D. Renderizar Podio del Curso (1°, 2°, 3°)
  renderPodioCurso(activosConNota);

  // E. Renderizar Tabla completa del aula
  renderTablaCurso(rankingCurso, activosConNota);
}

function renderBoletinPersonal() {
  const tbody = document.querySelector("#my-grades-table");
  const misCalificaciones = (yoEstudianteActual()?.calificaciones || []).filter(c => 
    selectedPeriod === "year" ? true : c.periodo === selectedPeriod
  );

  document.querySelector("#my-subjects-count").textContent = `${misCalificaciones.length} / ${allSubjects.length}`;

  if (allSubjects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center">No hay materias asignadas a tu nivel.</td></tr>`;
    return;
  }

  tbody.innerHTML = allSubjects.map(materia => {
    const cal = misCalificaciones.find(c => c.materia_id === materia.id);
    const nota = cal ? parseFloat(cal.nota) : null;
    const aprobado = nota !== null && nota >= 51;

    return `
      <tr>
        <td><strong>${materia.nombre}</strong></td>
        <td style="text-align: center; font-weight:800; color:${nota !== null ? (aprobado ? 'var(--purple)' : '#e04f5f') : 'var(--muted)'};">
          ${nota !== null ? `${nota.toFixed(1)}` : '—'}
        </td>
        <td>
          <span class="badge-status ${nota === null ? '' : (aprobado ? 'activo' : 'reprobado')}">
            ${nota === null ? 'Pendiente' : (aprobado ? 'Aprobado' : 'Reforzamiento')}
          </span>
        </td>
        <td>
          <div class="score-cell">
            <span class="score-track"><span class="score-fill" style="width:${nota !== null ? Math.min(100, nota) : 0}%"></span></span>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function yoEstudianteActual() {
  return classmatesData.find(c => c.id === myStudentData.id);
}

function renderPodioCurso(activos) {
  const podioEl = document.querySelector("#course-podium");
  const top3 = [activos[1], activos[0], activos[2]];
  const clases = ["second", "first", "third"];

  podioEl.innerHTML = top3.map((est, i) => {
    if (!est) return `<article class="podium-card ${clases[i]}"><div class="podium-name" style="color:var(--muted)">Sin registro</div></article>`;
    const esYo = est.id === myStudentData.id;
    return `
      <article class="podium-card ${clases[i]}">
        <div class="medal">${i === 1 ? "1" : i === 0 ? "2" : "3"}</div>
        <div class="podium-avatar">${initials(est.nombre_completo)}</div>
        <div class="podium-name">${est.nombre_completo} ${esYo ? '<span class="you-tag">Tú</span>' : ''}</div>
        <div class="podium-score">${formatScore(est.promedio)}</div>
      </article>
    `;
  }).join("");
}

function renderTablaCurso(ranking, activos) {
  const tbody = document.querySelector("#course-ranking-body");

  tbody.innerHTML = ranking.map(est => {
    const puesto = est.estado === "activo" && est.promedio !== null ? (activos.indexOf(est) + 1) : "—";
    const esYo = est.id === myStudentData.id;

    return `
      <tr class="${esYo ? 'my-row' : ''}">
        <td><strong>${puesto !== "—" ? `#${puesto}` : '—'}</strong></td>
        <td>
          <strong>${est.nombre_completo}</strong>
          ${esYo ? '<span class="you-tag">Tú</span>' : ''}
        </td>
        <td><small style="color:var(--muted);">${est.ci}</small></td>
        <td>
          <div class="score-cell">
            ${formatScore(est.promedio)}
            ${est.promedio !== null ? `<span class="score-track"><span class="score-fill" style="width:${Math.min(100, est.promedio)}%"></span></span>` : ''}
          </div>
        </td>
        <td>
          <span class="badge-status ${est.estado === 'activo' ? 'activo' : 'reprobado'}">
            ${est.estado === 'activo' ? 'Regular' : 'Retirado'}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

// EVENTOS DE BOTONES DE TRIMESTRE
document.querySelectorAll(".period-button").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedPeriod = btn.dataset.period;
    document.querySelectorAll(".period-button").forEach(b => b.classList.toggle("active", b === btn));
    render();
  });
});

// CONTROL DE TEMA CLARO / OSCURO
const themeToggle = document.querySelector("#theme-toggle");
const themeIcon = document.querySelector("#theme-icon");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === "dark";
  if (themeToggle) themeToggle.setAttribute("aria-label", isDark ? "Activar modo claro" : "Activar modo oscuro");
  if (themeIcon) {
    themeIcon.innerHTML = isDark
      ? '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>'
      : '<path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5a8.5 8.5 0 1 0 12 12Z"></path>';
  }
}

applyTheme(localStorage.getItem("ranknotes-theme") || "light");

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem("ranknotes-theme", nextTheme);
  });
}

// INICIAR
inicializarPortalEstudiante();
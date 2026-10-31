// CONFIGURACIÓN DE CONEXIÓN CON SUPABASE
const SUPABASE_URL = 'https://bpxjhwjjemtseblstkmo.supabase.co';
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweGpod2pqZW10c2VibHN0a21vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTkzODYsImV4cCI6MjEwODk3NTM4Nn0.GWNCsGSgyXLX7aG_DjHenKt7xpnnv7fdBMYbUJ-K_Co";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let coursesList = [];
let subjectsList = [];
let studentsData = [];
let selectedPeriod = "s1";

// 1. REVISAR ESTADO DE SESIÓN (TOPBAR INTELIGENTE)
function configurarAccesoUsuario() {
  const currentUser = JSON.parse(localStorage.getItem("ranknotes_user") || "null");
  const authArea = document.querySelector("#auth-area");

  if (currentUser) {
    let panelUrl = "index.html";
    let panelLabel = "Mi Perfil";

    if (currentUser.rol === "director") {
      panelUrl = "director.html";
      panelLabel = "Panel Director";
    } else if (currentUser.rol === "docente") {
      panelUrl = "admin.html";
      panelLabel = "Cargar Notas";
    }

    authArea.innerHTML = `
      <div class="user-logged-box">
        <div class="user-tag">
          <span style="font-size:11px;">👤</span>
          <span>${currentUser.nombre.split(" ")[0]}</span>
        </div>
        ${currentUser.rol !== "estudiante" ? `<a href="${panelUrl}" class="btn-panel-link">${panelLabel}</a>` : ''}
        <button class="btn-logout-small" onclick="cerrarSesion()">Salir</button>
      </div>
    `;
  } else {
    authArea.innerHTML = `
      <a href="login.html" class="btn-login">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
        Iniciar Sesión
      </a>
    `;
  }
}

function cerrarSesion() {
  localStorage.removeItem("ranknotes_user");
  window.location.reload();
}

// 2. OBTENER DATOS REALES DE SUPABASE
async function cargarDatosAcademicos() {
  try {
    // A. Cargar cursos disponibles
    const { data: cursos } = await client.from('cursos').select('*').order('nivel').order('grado');
    coursesList = cursos || [];

    const classFilter = document.querySelector("#class-filter");
    classFilter.innerHTML = '<option value="todos">Todos los cursos</option>' + 
      coursesList.map(c => `<option value="${c.id}">${c.grado} - ${c.paralelo} (${c.nivel})</option>`).join('');

    // B. Cargar materias curriculares
    const { data: materias } = await client.from('materias').select('*').order('nombre');
    subjectsList = materias || [];

    const courseFilter = document.querySelector("#course-filter");
    courseFilter.innerHTML = '<option value="todos">Todas las materias</option>' + 
      subjectsList.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');

    // C. Cargar estudiantes y sus calificaciones
    const { data: usuariosEstudiantes, error: errEst } = await client
      .from('usuarios')
      .select(`
        id,
        nombre_completo,
        ci,
        estado,
        curso_id,
        cursos (grado, paralelo, nivel),
        calificaciones (materia_id, periodo, nota)
      `)
      .eq('rol', 'estudiante');

    if (errEst) throw errEst;

    studentsData = usuariosEstudiantes || [];
    render();
  } catch (err) {
    console.error("Error al cargar datos escolares:", err);
  }
}

// 3. CÁLCULOS MATEMÁTICOS DE PROMEDIOS
function calcularPromedioEstudiante(estudiante, periodo, materiaIdFiltro = "todos") {
  const notas = (estudiante.calificaciones || []).filter(c => {
    const matchPeriodo = (periodo === "year") ? true : (c.periodo === periodo);
    const matchMateria = (materiaIdFiltro === "todos") ? true : (c.materia_id === materiaIdFiltro);
    return matchPeriodo && matchMateria;
  });

  if (notas.length === 0) return null;
  const suma = notas.reduce((acc, curr) => acc + parseFloat(curr.nota), 0);
  return suma / notas.length;
}

function formatScore(score) {
  return score === null || score === undefined ? "—" : `${score.toFixed(1).replace(".", ",")} pts`;
}

function initials(name) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

// Colores consistentes de avatares
const avatarColors = [
  ["#6d5ce8", "#e8e3ff"], ["#397b85", "#dff2f1"], ["#a45f7f", "#f8e3ed"],
  ["#af7543", "#f9ecd9"], ["#52874e", "#e5f1df"], ["#5875a9", "#e4eafa"]
];

// 4. RENDERIZADO VISUAL
function render() {
  const query = document.querySelector("#student-search").value.trim().toLowerCase();
  const filtroCurso = document.querySelector("#class-filter").value;
  const filtroMateria = document.querySelector("#course-filter").value;

  // Filtrar lista
  const listaProcesada = studentsData
    .filter(e => e.nombre_completo.toLowerCase().includes(query))
    .filter(e => filtroCurso === "todos" || e.curso_id === filtroCurso)
    .map(e => ({
      ...e,
      score: calcularPromedioEstudiante(e, selectedPeriod, filtroMateria)
    }))
    .sort((a, b) => {
      if (a.estado !== b.estado) return a.estado === "activo" ? -1 : 1;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });

  const activosConNota = listaProcesada.filter(e => e.estado === "activo" && e.score !== null);

  // Tarjetas métricas
  const sumaTotal = activosConNota.reduce((acc, curr) => acc + curr.score, 0);
  const promedioColegio = activosConNota.length ? sumaTotal / activosConNota.length : null;
  const mejor = activosConNota[0] || null;

  document.querySelector("#active-count").textContent = String(activosConNota.length);
  document.querySelector("#withdrawn-count").textContent = `${studentsData.filter(e => e.estado === 'retirado').length} retirados`;
  document.querySelector("#school-average").textContent = formatScore(promedioColegio);
  document.querySelector("#best-score").textContent = mejor ? formatScore(mejor.score) : "—";
  document.querySelector("#best-student").textContent = mejor ? mejor.nombre_completo : "Sin notas registradas";

  // Podio de los tres primeros
  renderPodio(activosConNota);

  // Tabla general
  const tbody = document.querySelector("#student-list");
  const emptyState = document.querySelector("#empty-state");

  if (listaProcesada.length === 0) {
    tbody.innerHTML = "";
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
    tbody.innerHTML = listaProcesada.map((est, index) => {
      const puesto = est.estado === "activo" && est.score !== null ? (activosConNota.indexOf(est) + 1) : "—";
      const [fg, bg] = avatarColors[Math.abs(index) % avatarColors.length];
      const cursoDesc = est.cursos ? `${est.cursos.grado} (${est.cursos.paralelo})` : "Sin curso";

      return `
        <tr>
          <td><span class="rank-badge">${puesto}</span></td>
          <td>
            <div class="student-cell">
              <span class="table-avatar" style="color:${fg}; background:${bg}">${initials(est.nombre_completo)}</span>
              <div>
                <div class="student-name">${est.nombre_completo}</div>
                <div class="student-meta">C.I.: ${est.ci}</div>
              </div>
            </div>
          </td>
          <td><span class="class-tag">${cursoDesc}</span></td>
          <td>
            <div class="score-cell">
              ${formatScore(est.score)}
              ${est.score !== null ? `<span class="score-track"><span class="score-fill" style="width:${Math.min(100, est.score)}%"></span></span>` : ''}
            </div>
          </td>
          <td>
            <span class="${est.estado === 'activo' ? 'trend' : 'status-tag'}">
              ${est.estado === 'activo' ? 'Regular' : 'Retirado'}
            </span>
          </td>
        </tr>
      `;
    }).join("");
  }

  document.querySelector("#results-count").textContent = `Mostrando ${listaProcesada.length} estudiante(s) evaluado(s)`;
  renderMejoresPorMateria();
}

function renderPodio(activos) {
  const podiumEl = document.querySelector("#podium");
  const primeros = [activos[1], activos[0], activos[2]]; // 2do, 1ro, 3ro
  const clases = ["second", "first", "third"];

  podiumEl.innerHTML = primeros.map((est, i) => {
    if (!est) return `<article class="podium-card ${clases[i]}"><div class="podium-name" style="color:var(--muted)">Sin registro</div></article>`;
    return `
      <article class="podium-card ${clases[i]}">
        <div class="medal">${i === 1 ? "1" : i === 0 ? "2" : "3"}</div>
        <div class="podium-avatar">${initials(est.nombre_completo)}</div>
        <div class="podium-name">${est.nombre_completo}</div>
        <div class="podium-school">${est.cursos ? est.cursos.grado : ''}</div>
        <div class="podium-score">${formatScore(est.score)}</div>
      </article>
    `;
  }).join("");
}

function renderMejoresPorMateria() {
  const tbody = document.querySelector("#course-list");
  tbody.innerHTML = subjectsList.map(materia => {
    // Buscar notas en esta materia
    const notasMateria = [];
    studentsData.forEach(est => {
      const notaObj = (est.calificaciones || []).find(c => c.materia_id === materia.id && (selectedPeriod === "year" ? true : c.periodo === selectedPeriod));
      if (notaObj && est.estado === "activo") {
        notasMateria.push({ estudiante: est, nota: parseFloat(notaObj.nota) });
      }
    });

    notasMateria.sort((a, b) => b.nota - a.nota);
    const top = notasMateria[0] || null;
    const promedioMat = notasMateria.length ? (notasMateria.reduce((a, b) => a + b.nota, 0) / notasMateria.length) : null;

    return `
      <tr>
        <td><span class="class-tag">${materia.nombre}</span></td>
        <td><strong>${top ? top.estudiante.nombre_completo : '—'}</strong></td>
        <td>${top && top.estudiante.cursos ? top.estudiante.cursos.grado : '—'}</td>
        <td class="school-average">${top ? formatScore(top.nota) : '—'}</td>
        <td>${formatScore(promedioMat)}</td>
      </tr>
    `;
  }).join("");
}

// EVENTOS
document.querySelector("#student-search").addEventListener("input", render);
document.querySelector("#class-filter").addEventListener("change", render);
document.querySelector("#course-filter").addEventListener("change", render);

document.querySelectorAll(".period-button").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedPeriod = btn.dataset.period;
    document.querySelectorAll(".period-button").forEach(b => b.classList.toggle("active", b === btn));
    render();
  });
});

// TEMA CLARO / OSCURO
const themeToggle = document.querySelector("#theme-toggle");
themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.dataset.theme === "dark";
  document.documentElement.dataset.theme = isDark ? "light" : "dark";
  localStorage.setItem("ranknotes-theme", isDark ? "light" : "dark");
});
document.documentElement.dataset.theme = localStorage.getItem("ranknotes-theme") || "light";

// INICIAR
configurarAccesoUsuario();
cargarDatosAcademicos();
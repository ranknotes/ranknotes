// CONFIGURACIÓN DE CONEXIÓN CON SUPABASE
const SUPABASE_URL = 'https://bpxjhwjjemtseblstkmo.supabase.co';
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweGpod2pqZW10c2VibHN0a21vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTkzODYsImV4cCI6MjEwODk3NTM4Nn0.GWNCsGSgyXLX7aG_DjHenKt7xpnnv7fdBMYbUJ-K_Co";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. VERIFICAR SESIÓN DEL DOCENTE
const currentUser = JSON.parse(localStorage.getItem("ranknotes_user") || "null");

if (!currentUser || currentUser.rol !== "docente") {
  alert("Acceso restringido: Debe iniciar sesión como docente.");
  window.location.href = "login.html";
}

// Variables en memoria
let misAsignaciones = [];
let currentEstudiantes = [];

function logout() {
  localStorage.removeItem("ranknotes_user");
  window.location.href = "login.html";
}

// 2. INICIALIZAR INTERFAZ Y CARGAR ASIGNACIONES DEL PROFESOR
async function inicializarPanelDocente() {
  // Mostrar panel protegido
  const adminSec = document.querySelector("#admin-sec");
  if (adminSec) adminSec.style.display = "block";

  const logoutBtn = document.querySelector("#logout-btn");
  if (logoutBtn) logoutBtn.style.display = "inline-block";
  
  const brandEl = document.querySelector(".brand small");
  if (brandEl && currentUser) {
    brandEl.textContent = `Prof. ${currentUser.nombre}`;
  }

  // Consultar en Supabase qué cursos y materias tiene asignados este profesor
  const { data: asignaciones, error } = await client
    .from('asignaciones_docentes')
    .select(`
      id,
      curso_id,
      materia_id,
      cursos (id, grado, paralelo, nivel),
      materias (id, nombre, nivel)
    `)
    .eq('docente_id', currentUser.id);

  if (error) {
    console.error("Error al cargar asignaciones:", error);
    return;
  }

  misAsignaciones = asignaciones || [];

  if (misAsignaciones.length === 0) {
    if (adminSec) {
      adminSec.innerHTML = `
        <div class="card" style="text-align:center; padding:40px;">
          <h3>Sin asignación académica</h3>
          <p style="color:var(--muted);">Comuníquese con la Dirección para que le asignen sus cursos y materias en el sistema.</p>
          <button class="btn" onclick="logout()">Cerrar Sesión</button>
        </div>`;
    }
    return;
  }

  // Poblar selectores de cursos asignados (evitando duplicados)
  const cursosUnicosMap = new Map();
  misAsignaciones.forEach(a => {
    if (a.cursos && !cursosUnicosMap.has(a.cursos.id)) {
      cursosUnicosMap.set(a.cursos.id, a.cursos);
    }
  });

  const selectCourse = document.querySelector("#select-course");
  const selectNewCourse = document.querySelector("#new-student-course");
  
  const cursosOptionsHtml = Array.from(cursosUnicosMap.values()).map(c => 
    `<option value="${c.id}">${c.grado} - Paralelo ${c.paralelo} (${c.nivel})</option>`
  ).join('');

  if (selectCourse) selectCourse.innerHTML = cursosOptionsHtml;
  if (selectNewCourse) selectNewCourse.innerHTML = cursosOptionsHtml;

  // Actualizar materias disponibles para el curso seleccionado
  actualizarMateriasPorCurso();
}

// 3. ACTUALIZAR MATERIAS SEGÚN EL CURSO SELECCIONADO
function actualizarMateriasPorCurso() {
  const selectCourse = document.querySelector("#select-course");
  if (!selectCourse) return;
  const selectedCourseId = selectCourse.value;
  
  // Filtrar asignaciones que coincidan con el curso seleccionado
  const materiasDelCurso = misAsignaciones.filter(a => a.curso_id === selectedCourseId && a.materias);
  const selectSubject = document.querySelector("#select-subject");

  if (selectSubject) {
    selectSubject.innerHTML = materiasDelCurso.map(a => 
      `<option value="${a.materias.id}">${a.materias.nombre}</option>`
    ).join('');
  }

  // Cargar estudiantes y notas
  cargarEstudiantesPlanilla();
}

// 4. CARGAR LISTA DE ALUMNOS Y CALIFICACIONES DEL TRIMESTRE
async function cargarEstudiantesPlanilla() {
  const selectCourse = document.querySelector("#select-course");
  const selectSubject = document.querySelector("#select-subject");
  const selectPeriod = document.querySelector("#select-period");

  if (!selectCourse || !selectSubject || !selectPeriod) return;

  const courseId = selectCourse.value;
  const subjectId = selectSubject.value;
  const period = selectPeriod.value;
  
  if (!courseId || !subjectId) return;

  // Consultar estudiantes de este curso desde la tabla usuarios
  const { data: ests, error: errEst } = await client
    .from('usuarios')
    .select('id, nombre_completo, ci, estado')
    .eq('rol', 'estudiante')
    .eq('curso_id', courseId)
    .order('nombre_completo');

  if (errEst) {
    console.error("Error al cargar estudiantes:", errEst);
    return;
  }

  currentEstudiantes = ests || [];

  // Consultar las calificaciones ya registradas
  const { data: notas } = await client
    .from('calificaciones')
    .select('estudiante_id, nota')
    .eq('materia_id', subjectId)
    .eq('periodo', period);

  const notasMap = {};
  (notas || []).forEach(n => { notasMap[n.estudiante_id] = n.nota; });

  const tbody = document.querySelector("#grades-table-body");
  if (!tbody) return;

  if (currentEstudiantes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--muted); padding:20px;">No hay estudiantes matriculados en este curso.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentEstudiantes.map(e => `
    <tr>
      <td>
        <strong>${e.nombre_completo}</strong><br>
        <small style="color:var(--muted);">C.I.: ${e.ci}</small>
      </td>
      <td>
        <span style="font-size:12px; font-weight:700; color:${e.estado === 'activo' ? 'var(--green)' : 'red'};">
          ${e.estado.toUpperCase()}
        </span>
      </td>
      <td style="text-align:center;">
        <input type="number" min="0" max="100" step="0.5" class="score-input"
          data-id="${e.id}" value="${notasMap[e.id] !== undefined ? notasMap[e.id] : ''}" placeholder="—">
      </td>
    </tr>
  `).join('');
}

// 5. REGISTRAR ESTUDIANTE DIRECTAMENTE EN EL CURSO
async function registrarEstudiante() {
  const nameInput = document.querySelector("#new-student-name");
  const courseInput = document.querySelector("#new-student-course");
  if (!nameInput || !courseInput) return;

  const name = nameInput.value.trim();
  const courseId = courseInput.value;
  if (!name) return alert("Ingrese el nombre completo del estudiante.");

  // Generar un C.I. provisional basado en número aleatorio
  const ciGen = "16" + Math.floor(100000 + Math.random() * 900000);

  const { error } = await client.from('usuarios').insert([{
    nombre_completo: name,
    ci: ciGen,
    password: ciGen,
    rol: 'estudiante',
    curso_id: courseId,
    estado: 'activo'
  }]);

  if (error) {
    alert("Error al matricular: " + error.message);
  } else {
    alert(`Estudiante matriculado con éxito.\nC.I. asignado: ${ciGen}`);
    nameInput.value = "";
    cargarEstudiantesPlanilla();
  }
}

// 6. GUARDAR CALIFICACIONES EN SUPABASE
async function guardarCalificaciones() {
  const selectSubject = document.querySelector("#select-subject");
  const selectPeriod = document.querySelector("#select-period");
  if (!selectSubject || !selectPeriod) return;

  const subjectId = selectSubject.value;
  const period = selectPeriod.value;
  const inputs = document.querySelectorAll(".score-input");

  const records = [];
  inputs.forEach(input => {
    const val = input.value.trim();
    if (val !== "") {
      records.push({
        estudiante_id: input.dataset.id,
        materia_id: subjectId,
        periodo: period,
        nota: parseFloat(val)
      });
    }
  });

  if (records.length === 0) return alert("No ingresó ninguna calificación para registrar.");

  const { error } = await client.from('calificaciones').upsert(records, {
    onConflict: 'estudiante_id,materia_id,periodo'
  });

  if (error) {
    alert("Error al guardar calificaciones: " + error.message);
  } else {
    alert("¡Calificaciones guardadas exitosamente en Supabase!");
    cargarEstudiantesPlanilla();
  }
}

// Escuchar cambios en los selectores
const selectCourse = document.querySelector("#select-course");
const selectSubject = document.querySelector("#select-subject");
const selectPeriod = document.querySelector("#select-period");

if (selectCourse) selectCourse.addEventListener("change", actualizarMateriasPorCurso);
if (selectSubject) selectSubject.addEventListener("change", cargarEstudiantesPlanilla);
if (selectPeriod) selectPeriod.addEventListener("change", cargarEstudiantesPlanilla);

// CONTROL DE TEMA CLARO / OSCURO
const themeToggle = document.querySelector("#theme-toggle");
const themeIcon = document.querySelector("#theme-icon");

function applyAdminTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === "dark";
  if (themeToggle) themeToggle.setAttribute("aria-label", isDark ? "Activar modo claro" : "Activar modo oscuro");
  if (themeIcon) {
    themeIcon.innerHTML = isDark
      ? '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>'
      : '<path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5a8.5 8.5 0 1 0 12 12Z"></path>';
  }
}

applyAdminTheme(localStorage.getItem("ranknotes-theme") || "light");

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyAdminTheme(nextTheme);
    localStorage.setItem("ranknotes-theme", nextTheme);
  });
}

// Iniciar panel
inicializarPanelDocente();
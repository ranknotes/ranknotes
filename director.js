// CONFIGURACIÓN DE CONEXIÓN CON SUPABASE
const SUPABASE_URL = 'https://bpxjhwjjemtseblstkmo.supabase.co';
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweGpod2pqZW10c2VibHN0a21vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTkzODYsImV4cCI6MjEwODk3NTM4Nn0.GWNCsGSgyXLX7aG_DjHenKt7xpnnv7fdBMYbUJ-K_Co";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// VERIFICAR ROL DE DIRECTOR
const currentUser = JSON.parse(localStorage.getItem("ranknotes_user") || "null");
if (!currentUser || currentUser.rol !== "director") {
  alert("Acceso restringido: Solo el personal de Dirección puede ingresar a este panel.");
  window.location.href = "login.html";
} else {
  const nameEl = document.querySelector("#director-name");
  if (nameEl) nameEl.textContent = currentUser.nombre.split(" ")[0];
}

function logout() {
  localStorage.removeItem("ranknotes_user");
  window.location.href = "login.html";
}

// CONTROL DEL MENÚ HAMBURGUESA Y OVERLAY
const menuToggle = document.querySelector("#menu-toggle");
const sidebar = document.querySelector("#sidebar");
const overlay = document.querySelector("#sidebar-overlay");
const closeMenuBtn = document.querySelector("#close-menu-btn");

function abrirMenu() {
  sidebar.classList.add("open");
  overlay.classList.add("open");
}

function cerrarMenu() {
  sidebar.classList.remove("open");
  overlay.classList.remove("open");
}

if (menuToggle) menuToggle.addEventListener("click", abrirMenu);
if (overlay) overlay.addEventListener("click", cerrarMenu);
if (closeMenuBtn) closeMenuBtn.addEventListener("click", cerrarMenu);

// NAVEGACIÓN ENTRE MÓDULOS (CIERRA EL MENÚ SIEMPRE)
function switchSection(sectionId, btnElement) {
  document.querySelectorAll(".module-section").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
  
  const targetSec = document.querySelector(`#${sectionId}`);
  if (targetSec) targetSec.classList.add("active");
  if (btnElement) btnElement.classList.add("active");

  // Cerrar siempre el menú al cambiar de sección
  cerrarMenu();
}

// VARIABLES EN MEMORIA
let cursosCache = [];
let materiasCache = [];
let docentesCache = [];
let asignacionesCache = [];

// ==============================================================================
// 1. CARGA INICIAL
// ==============================================================================
async function inicializarPanel() {
  await Promise.all([
    cargarCursos(),
    cargarMaterias(),
    cargarDocentes()
  ]);
  await cargarAsignaciones();
  await cargarEstudiantes();
}

async function cargarCursos() {
  const { data: cursos } = await client.from('cursos').select('*').order('nivel').order('grado');
  cursosCache = cursos || [];

  const tbody = document.querySelector("#tabla-cursos");
  if (tbody) {
    tbody.innerHTML = cursosCache.map(c => `
      <tr>
        <td><strong>${c.nivel}</strong></td>
        <td>${c.grado}</td>
        <td>Paralelo ${c.paralelo}</td>
        <td>
          <button class="btn-action-del" onclick="eliminarCurso('${c.id}')">Eliminar</button>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="4" class="text-center">No hay cursos registrados.</td></tr>`;
  }

  const optionsHtml = cursosCache.map(c => `<option value="${c.id}">${c.grado} (${c.nivel}) - ${c.paralelo}</option>`).join("");
  const asigCurso = document.querySelector("#asig-curso");
  const estCurso = document.querySelector("#est-curso");
  const filtroEst = document.querySelector("#filtro-est-curso");

  if (asigCurso) asigCurso.innerHTML = optionsHtml;
  if (estCurso) estCurso.innerHTML = optionsHtml;
  if (filtroEst) filtroEst.innerHTML = `<option value="todos">Todos los cursos</option>` + optionsHtml;
}

async function cargarMaterias() {
  const { data: materias } = await client.from('materias').select('*').order('nombre');
  materiasCache = materias || [];
  const asigMateria = document.querySelector("#asig-materia");
  if (asigMateria) {
    asigMateria.innerHTML = materiasCache.map(m => `<option value="${m.id}">${m.nombre} [${m.nivel}]</option>`).join("");
  }
}

// ==============================================================================
// 2. MÓDULO DOCENTES
// ==============================================================================
async function cargarDocentes() {
  const { data: docentes } = await client.from('usuarios').select('*').eq('rol', 'docente').order('nombre_completo');
  docentesCache = docentes || [];

  const tbody = document.querySelector("#tabla-docentes");
  if (tbody) {
    tbody.innerHTML = docentesCache.map(d => `
      <tr>
        <td><strong>${d.nombre_completo}</strong></td>
        <td>${d.ci}</td>
        <td><span class="badge-status ${d.estado}">${d.estado}</span></td>
        <td>
          <button class="btn-action-toggle" onclick="cambiarEstadoUsuario('${d.id}', '${d.estado === 'activo' ? 'retirado' : 'activo'}')">
            ${d.estado === 'activo' ? 'Baja' : 'Activar'}
          </button>
          <button class="btn-action-del" onclick="eliminarUsuario('${d.id}')">Borrar</button>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="4" class="text-center">No hay docentes registrados.</td></tr>`;
  }

  const asigDoc = document.querySelector("#asig-docente");
  if (asigDoc) {
    asigDoc.innerHTML = docentesCache
      .filter(d => d.estado === 'activo')
      .map(d => `<option value="${d.id}">${d.nombre_completo} (CI: ${d.ci})</option>`).join("");
  }
}

const formDocente = document.querySelector("#form-docente");
if (formDocente) {
  formDocente.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.querySelector("#doc-nombre").value.trim();
    const ci = document.querySelector("#doc-ci").value.trim();
    const pass = document.querySelector("#doc-password").value.trim() || ci;

    const { error } = await client.from('usuarios').insert([{
      nombre_completo: nombre,
      ci: ci,
      password: pass,
      rol: 'docente',
      estado: 'activo'
    }]);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Docente registrado con éxito.");
      formDocente.reset();
      await cargarDocentes();
    }
  });
}

// ==============================================================================
// 3. MÓDULO ASIGNACIONES
// ==============================================================================
async function cargarAsignaciones() {
  const { data: asigs } = await client.from('asignaciones_docentes').select(`
    id,
    usuarios(nombre_completo),
    cursos(grado, paralelo),
    materias(nombre)
  `).order('id', { ascending: false });

  asignacionesCache = asigs || [];
  renderTablaAsignaciones(asignacionesCache);
}

function renderTablaAsignaciones(lista) {
  const tbody = document.querySelector("#tabla-asignaciones");
  if (!tbody) return;

  tbody.innerHTML = lista.map(a => `
    <tr>
      <td><strong>${a.usuarios ? a.usuarios.nombre_completo : 'Sin docente'}</strong></td>
      <td>${a.cursos ? `${a.cursos.grado} - ${a.cursos.paralelo}` : '—'}</td>
      <td>${a.materias ? a.materias.nombre : '—'}</td>
      <td>
        <button class="btn-action-del" onclick="eliminarAsignacion('${a.id}')">Quitar</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="text-center">No se encontraron asignaciones.</td></tr>`;
}

function filtrarAsignaciones() {
  const q = document.querySelector("#search-asig").value.trim().toLowerCase();
  const filtradas = asignacionesCache.filter(a => {
    const prof = (a.usuarios?.nombre_completo || "").toLowerCase();
    const cur = (a.cursos?.grado || "").toLowerCase();
    const mat = (a.materias?.nombre || "").toLowerCase();
    return prof.includes(q) || cur.includes(q) || mat.includes(q);
  });
  renderTablaAsignaciones(filtradas);
}

const formAsignacion = document.querySelector("#form-asignacion");
if (formAsignacion) {
  formAsignacion.addEventListener("submit", async (e) => {
    e.preventDefault();
    const docente_id = document.querySelector("#asig-docente").value;
    const curso_id = document.querySelector("#asig-curso").value;
    const materia_id = document.querySelector("#asig-materia").value;

    const { error } = await client.from('asignaciones_docentes').insert([{
      docente_id, curso_id, materia_id, gestion: 2026
    }]);

    if (error) {
      alert("Error: Asignación duplicada o no válida.");
    } else {
      alert("Materia asignada exitosamente.");
      await cargarAsignaciones();
    }
  });
}

async function eliminarAsignacion(id) {
  if (!confirm("¿Quitar esta asignación?")) return;
  await client.from('asignaciones_docentes').delete().eq('id', id);
  await cargarAsignaciones();
}

// ==============================================================================
// 4. MÓDULO ESTUDIANTES
// ==============================================================================
async function cargarEstudiantes() {
  const filtroCurso = document.querySelector("#filtro-est-curso")?.value;
  let query = client.from('usuarios').select('id, nombre_completo, ci, estado, cursos(grado, paralelo)').eq('rol', 'estudiante').order('nombre_completo');

  if (filtroCurso && filtroCurso !== "todos") {
    query = query.eq('curso_id', filtroCurso);
  }

  const { data: estudiantes } = await query;
  const tbody = document.querySelector("#tabla-estudiantes");

  if (tbody) {
    tbody.innerHTML = (estudiantes || []).map(e => `
      <tr>
        <td><strong>${e.nombre_completo}</strong></td>
        <td>${e.ci}</td>
        <td>${e.cursos ? `${e.cursos.grado} (${e.cursos.paralelo})` : 'Sin curso'}</td>
        <td><span class="badge-status ${e.estado}">${e.estado}</span></td>
        <td>
          <button class="btn-action-toggle" onclick="cambiarEstadoUsuario('${e.id}', '${e.estado === 'activo' ? 'retirado' : 'activo'}')">
            ${e.estado === 'activo' ? 'Retirar' : 'Activar'}
          </button>
          <button class="btn-action-del" onclick="eliminarUsuario('${e.id}')">Borrar</button>
        </td>
      </tr>
    `).join("") || `<tr><td colspan="5" class="text-center">No hay estudiantes en este curso.</td></tr>`;
  }
}

const formEstudiante = document.querySelector("#form-estudiante");
if (formEstudiante) {
  formEstudiante.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.querySelector("#est-nombre").value.trim();
    const ci = document.querySelector("#est-ci").value.trim();
    const curso_id = document.querySelector("#est-curso").value;

    const { error } = await client.from('usuarios').insert([{
      nombre_completo: nombre,
      ci: ci,
      password: ci,
      rol: 'estudiante',
      curso_id: curso_id,
      estado: 'activo'
    }]);

    if (error) {
      alert("Error al registrar: " + error.message);
    } else {
      alert("Estudiante matriculado con éxito.");
      formEstudiante.reset();
      await cargarEstudiantes();
    }
  });
}

// ==============================================================================
// 5. MÓDULO CURSOS
// ==============================================================================
const formCurso = document.querySelector("#form-curso");
if (formCurso) {
  formCurso.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nivel = document.querySelector("#curso-nivel").value;
    const grado = document.querySelector("#curso-grado").value.trim();
    const paralelo = document.querySelector("#curso-paralelo").value.trim().toUpperCase();

    const { error } = await client.from('cursos').insert([{
      nivel, grado, paralelo, gestion: 2026
    }]);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Curso registrado con éxito.");
      formCurso.reset();
      await cargarCursos();
    }
  });
}

async function eliminarCurso(id) {
  if (!confirm("¿Eliminar curso? Se desvincularán los estudiantes asignados.")) return;
  await client.from('cursos').delete().eq('id', id);
  await inicializarPanel();
}

// UTILIDADES
async function cambiarEstadoUsuario(id, nuevoEstado) {
  await client.from('usuarios').update({ estado: nuevoEstado }).eq('id', id);
  await cargarDocentes();
  await cargarEstudiantes();
}

async function eliminarUsuario(id) {
  if (!confirm("¿Eliminar permanentemente este registro?")) return;
  await client.from('usuarios').delete().eq('id', id);
  await cargarDocentes();
  await cargarEstudiantes();
  await cargarAsignaciones();
}

// CONTROL DE TEMA CLARO / OSCURO
const themeToggle = document.querySelector("#theme-toggle");
const themeIcon = document.querySelector("#theme-icon");

function applyDirectorTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === "dark";
  if (themeToggle) themeToggle.setAttribute("aria-label", isDark ? "Activar modo claro" : "Activar modo oscuro");
  if (themeIcon) {
    themeIcon.innerHTML = isDark
      ? '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 1.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>'
      : '<path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5a8.5 8.5 0 1 0 12 12Z"></path>';
  }
}

applyDirectorTheme(localStorage.getItem("ranknotes-theme") || "light");

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyDirectorTheme(nextTheme);
    localStorage.setItem("ranknotes-theme", nextTheme);
  });
}

// INICIAR
inicializarPanel();
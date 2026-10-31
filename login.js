// CONFIGURACIÓN DE SUPABASE
const SUPABASE_URL = 'https://bpxjhwjjemtseblstkmo.supabase.co';
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJweGpod2pqZW10c2VibHN0a21vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTkzODYsImV4cCI6MjEwODk3NTM4Nn0.GWNCsGSgyXLX7aG_DjHenKt7xpnnv7fdBMYbUJ-K_Co";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const form = document.querySelector("#login-form");
const ciInput = document.querySelector("#ci-input");
const passwordInput = document.querySelector("#password-input");
const submitBtn = document.querySelector("#submit-btn");
const errorMsg = document.querySelector("#error-message");

function setDemo(ci, password) {
  ciInput.value = ci;
  passwordInput.value = password;
  errorMsg.style.display = "none";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const ci = ciInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!ci || !password) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Verificando...";
  errorMsg.style.display = "none";

  try {
    // Consulta directa a la tabla usuarios
    const { data: user, error } = await client
      .from('usuarios')
      .select('id, ci, password, nombre_completo, rol, curso_id, estado')
      .eq('ci', ci)
      .single();

    if (error || !user) {
      throw new Error("Usuario o Carnet de Identidad no encontrado.");
    }

    if (user.password !== password) {
      throw new Error("Contraseña incorrecta.");
    }

    if (user.estado === 'retirado') {
      throw new Error("La cuenta se encuentra en estado retirado. Contacte a Dirección.");
    }

    // Guardar sesión activa en localStorage
    const sessionData = {
      id: user.id,
      ci: user.ci,
      nombre: user.nombre_completo,
      rol: user.rol,
      curso_id: user.curso_id
    };
    localStorage.setItem("ranknotes_user", JSON.stringify(sessionData));

    // Redirección inteligente según el rol institucional
    if (user.rol === "director") {
      window.location.href = "director.html";
    } else if (user.rol === "docente") {
      window.location.href = "admin.html";
    } else if (user.rol === "estudiante") {
      window.location.href = "index.html";
    } else {
      throw new Error("Rol de usuario desconocido.");
    }

  } catch (err) {
    errorMsg.textContent = err.message || "Error al intentar iniciar sesión.";
    errorMsg.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "Ingresar al Sistema";
  }
});
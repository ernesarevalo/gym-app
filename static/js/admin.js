// static/js/admin.js
// Panel de administrador. Verifica que el usuario logueado sea ADMIN_EMAIL,
// y usa el token de Firebase para llamar a la API protegida del backend
// (/api/admin/*), donde firebase-admin hace las operaciones reales.

let usuariosCache = [];

const modalEditar = () => new bootstrap.Modal(document.getElementById("modalEditar"));
const modalNuevo = () => new bootstrap.Modal(document.getElementById("modalNuevo"));

function mostrarMsg(texto, tipo = "success") {
  const msg = document.getElementById("adminMsg");
  msg.className = `alert alert-${tipo}`;
  msg.textContent = texto;
  msg.classList.remove("d-none");
  setTimeout(() => msg.classList.add("d-none"), 4000);
}

async function llamarApiAdmin(url, options = {}) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.description || `Error ${res.status}`);
  }
  return data;
}

async function cargarUsuarios() {
  try {
    usuariosCache = await llamarApiAdmin("/api/admin/usuarios");
    renderTabla(usuariosCache);
  } catch (err) {
    mostrarMsg("Error al cargar usuarios: " + err.message, "danger");
  }
}

function renderTabla(usuarios) {
  const tbody = document.getElementById("tablaUsuarios");
  tbody.innerHTML = "";

  usuarios.forEach(u => {
    const tr = document.createElement("tr");
    const perfil = u.perfil || {};
    const estado = u.auth_disabled ? `<span class="badge bg-danger">Deshabilitado</span>` : `<span class="badge bg-success">Activo</span>`;

    tr.innerHTML = `
      <td>${u.nombre || "-"}</td>
      <td>${u.username || "-"}</td>
      <td>${u.email || u.auth_email || "-"}</td>
      <td>${perfil.dias || "-"}</td>
      <td>${perfil.enfoque || "-"}</td>
      <td>${estado}</td>
      <td class="d-flex gap-1">
        <button class="btn btn-sm btn-outline-light btnEditar">✏️</button>
        <button class="btn btn-sm btn-outline-light btnToggle">${u.auth_disabled ? "✅ Habilitar" : "🚫 Deshabilitar"}</button>
        <button class="btn btn-sm btn-outline-light btnEliminar">🗑️</button>
      </td>
    `;

    tr.querySelector(".btnEditar").addEventListener("click", () => abrirEdicion(u));
    tr.querySelector(".btnToggle").addEventListener("click", () => toggleDisabled(u.uid));
    tr.querySelector(".btnEliminar").addEventListener("click", () => eliminarUsuario(u));

    tbody.appendChild(tr);
  });
}

document.getElementById("buscador").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const filtrados = usuariosCache.filter(u =>
    (u.nombre || "").toLowerCase().includes(q) ||
    (u.username || "").toLowerCase().includes(q) ||
    (u.email || "").toLowerCase().includes(q)
  );
  renderTabla(filtrados);
});

// ---------- EDITAR ----------
function abrirEdicion(u) {
  document.getElementById("editUid").value = u.uid;
  document.getElementById("editNombre").value = u.nombre || "";
  document.getElementById("editEmail").value = u.email || u.auth_email || "";
  document.getElementById("editDias").value = (u.perfil && u.perfil.dias) || "";
  document.getElementById("editEnfoque").value = (u.perfil && u.perfil.enfoque) || "Hipertrofia";
  document.getElementById("editPassword").value = "";
  modalEditar().show();
}

document.getElementById("btnGuardarEdicion").addEventListener("click", async () => {
  const uid = document.getElementById("editUid").value;
  const nombre = document.getElementById("editNombre").value;
  const email = document.getElementById("editEmail").value;
  const dias = parseInt(document.getElementById("editDias").value, 10) || null;
  const enfoque = document.getElementById("editEnfoque").value;
  const password = document.getElementById("editPassword").value;

  try {
    await llamarApiAdmin(`/api/admin/usuarios/${uid}`, {
      method: "PUT",
      body: JSON.stringify({ nombre, email, perfil: { dias, enfoque } })
    });

    if (password) {
      if (password.length < 6) {
        mostrarMsg("La contraseña debe tener al menos 6 caracteres.", "danger");
        return;
      }
      await llamarApiAdmin(`/api/admin/usuarios/${uid}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password })
      });
    }

    mostrarMsg("Usuario actualizado ✅");
    bootstrap.Modal.getInstance(document.getElementById("modalEditar")).hide();
    await cargarUsuarios();
  } catch (err) {
    mostrarMsg("Error: " + err.message, "danger");
  }
});

// ---------- HABILITAR / DESHABILITAR ----------
async function toggleDisabled(uid) {
  try {
    await llamarApiAdmin(`/api/admin/usuarios/${uid}/toggle-disabled`, { method: "POST" });
    mostrarMsg("Estado actualizado ✅");
    await cargarUsuarios();
  } catch (err) {
    mostrarMsg("Error: " + err.message, "danger");
  }
}

// ---------- ELIMINAR ----------
async function eliminarUsuario(u) {
  if (!confirm(`¿Seguro que querés eliminar a ${u.nombre || u.email}? Esta acción no se puede deshacer.`)) return;
  try {
    await llamarApiAdmin(`/api/admin/usuarios/${u.uid}`, { method: "DELETE" });
    mostrarMsg("Usuario eliminado ✅");
    await cargarUsuarios();
  } catch (err) {
    mostrarMsg("Error: " + err.message, "danger");
  }
}

// ---------- CREAR ----------
document.getElementById("btnNuevoUsuario").addEventListener("click", () => modalNuevo().show());

document.getElementById("btnCrearUsuario").addEventListener("click", async () => {
  const nombre = document.getElementById("nuevoNombre").value;
  const username = document.getElementById("nuevoUsername").value.trim().toLowerCase();
  const email = document.getElementById("nuevoEmail").value;
  const password = document.getElementById("nuevoPassword").value;

  try {
    await llamarApiAdmin("/api/admin/usuarios", {
      method: "POST",
      body: JSON.stringify({ nombre, username, email, password })
    });
    mostrarMsg("Usuario creado ✅");
    bootstrap.Modal.getInstance(document.getElementById("modalNuevo")).hide();
    await cargarUsuarios();
  } catch (err) {
    mostrarMsg("Error: " + err.message, "danger");
  }
});

// ---------- VERIFICACIÓN DE ACCESO ----------
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = "/"; return; }

  if (user.email !== ADMIN_EMAIL) {
    document.getElementById("accesoDenegado").classList.remove("d-none");
    document.getElementById("zonaAdmin").classList.add("d-none");
    return;
  }

  document.getElementById("zonaAdmin").classList.remove("d-none");
  await cargarUsuarios();
  await cargarEjercicios();
});

// ================= GESTIÓN DE EJERCICIOS (Firestore directo) =================
// A diferencia de los usuarios, esto NO pasa por el backend: el propio
// usuario admin escribe directamente en Firestore. Las reglas de seguridad
// (ver README) permiten escritura en "ejercicios" solo a este correo.

let ejerciciosCache = [];
const modalEjercicio = () => new bootstrap.Modal(document.getElementById("modalEjercicio"));

async function cargarEjercicios() {
  try {
    ejerciciosCache = await obtenerCatalogoEjercicios();
    renderTablaEjercicios(ejerciciosCache);
  } catch (err) {
    mostrarMsg("Error al cargar ejercicios: " + err.message, "danger");
  }
}

function renderTablaEjercicios(lista) {
  const tbody = document.getElementById("tablaEjercicios");
  tbody.innerHTML = "";

  lista.forEach(ej => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ej.nombre}</td>
      <td>${ej.grupo_muscular}</td>
      <td>${ej.series_recomendadas || "-"} x ${ej.repeticiones_recomendadas || "-"}</td>
      <td class="d-flex gap-1">
        <button class="btn btn-sm btn-outline-light btnEditarEj">✏️</button>
        <button class="btn btn-sm btn-outline-light btnEliminarEj">🗑️</button>
      </td>
    `;
    tr.querySelector(".btnEditarEj").addEventListener("click", () => abrirEdicionEjercicio(ej));
    tr.querySelector(".btnEliminarEj").addEventListener("click", () => eliminarEjercicio(ej));
    tbody.appendChild(tr);
  });
}

document.getElementById("buscadorEjercicios").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const filtrados = ejerciciosCache.filter(ej =>
    ej.nombre.toLowerCase().includes(q) || ej.grupo_muscular.toLowerCase().includes(q)
  );
  renderTablaEjercicios(filtrados);
});

function limpiarFormularioEjercicio() {
  ["ejEditId","ejNombre","ejDescripcion","ejPatronMovimiento","ejSeries","ejReps","ejPostura","ejErrores",
   "ejSeguridad","ejTips","ejPesoPrincipiante","ejPesoIntermedio","ejPesoAvanzado",
   "ejVideoUrl","ejTiktokUrl","ejImagenUrl"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("ejGrupo").value = "Pecho";
}

function abrirEdicionEjercicio(ej) {
  limpiarFormularioEjercicio();
  document.getElementById("tituloModalEjercicio").textContent = "Editar ejercicio";
  document.getElementById("ejEditId").value = ej.id;
  document.getElementById("ejNombre").value = ej.nombre || "";
  document.getElementById("ejGrupo").value = ej.grupo_muscular || "Pecho";
  document.getElementById("ejDescripcion").value = ej.descripcion || "";
  document.getElementById("ejPatronMovimiento").value = ej.patron_movimiento || "";
  document.getElementById("ejSeries").value = ej.series_recomendadas || "";
  document.getElementById("ejReps").value = ej.repeticiones_recomendadas || "";
  const tec = ej.tecnica || {};
  document.getElementById("ejPostura").value = tec.postura || "";
  document.getElementById("ejErrores").value = tec.errores_comunes || "";
  document.getElementById("ejSeguridad").value = tec.seguridad || "";
  document.getElementById("ejTips").value = (ej.tips || []).join("\n");
  const peso = ej.peso_recomendado || {};
  document.getElementById("ejPesoPrincipiante").value = peso.principiante || "";
  document.getElementById("ejPesoIntermedio").value = peso.intermedio || "";
  document.getElementById("ejPesoAvanzado").value = peso.avanzado || "";
  document.getElementById("ejVideoUrl").value = ej.video_url || "";
  document.getElementById("ejTiktokUrl").value = ej.tiktok_url || "";
  document.getElementById("ejImagenUrl").value = ej.imagen_url || "";
  modalEjercicio().show();
}

document.getElementById("btnNuevoEjercicio").addEventListener("click", () => {
  limpiarFormularioEjercicio();
  document.getElementById("tituloModalEjercicio").textContent = "Nuevo ejercicio";
  modalEjercicio().show();
});

document.getElementById("btnGuardarEjercicio").addEventListener("click", async () => {
  const idExistente = document.getElementById("ejEditId").value;
  const nombre = document.getElementById("ejNombre").value.trim();

  if (!nombre) {
    mostrarMsg("El nombre es obligatorio.", "danger");
    return;
  }

  const id = idExistente || ("custom_" + nombre.toLowerCase().replace(/[^a-z0-9]+/g, "_") + "_" + Date.now());

  const datos = {
    nombre,
    grupo_muscular: document.getElementById("ejGrupo").value,
    descripcion: document.getElementById("ejDescripcion").value,
    patron_movimiento: document.getElementById("ejPatronMovimiento").value,
    series_recomendadas: parseInt(document.getElementById("ejSeries").value, 10) || null,
    repeticiones_recomendadas: document.getElementById("ejReps").value,
    tecnica: {
      postura: document.getElementById("ejPostura").value,
      errores_comunes: document.getElementById("ejErrores").value,
      seguridad: document.getElementById("ejSeguridad").value
    },
    tips: document.getElementById("ejTips").value.split("\n").map(t => t.trim()).filter(Boolean),
    peso_recomendado: {
      principiante: document.getElementById("ejPesoPrincipiante").value,
      intermedio: document.getElementById("ejPesoIntermedio").value,
      avanzado: document.getElementById("ejPesoAvanzado").value
    },
    video_url: document.getElementById("ejVideoUrl").value,
    tiktok_url: document.getElementById("ejTiktokUrl").value,
    imagen_url: document.getElementById("ejImagenUrl").value
  };

  try {
    await db.collection("ejercicios").doc(id).set(datos, { merge: true });
    mostrarMsg("Ejercicio guardado ✅");
    bootstrap.Modal.getInstance(document.getElementById("modalEjercicio")).hide();
    await cargarEjercicios();
  } catch (err) {
    mostrarMsg("Error al guardar ejercicio: " + err.message, "danger");
  }
});

async function eliminarEjercicio(ej) {
  if (!confirm(`¿Eliminar "${ej.nombre}" del catálogo? Esto no afecta rutinas ya guardadas, solo el catálogo para futuras rutinas.`)) return;
  try {
    await db.collection("ejercicios").doc(ej.id).delete();
    mostrarMsg("Ejercicio eliminado ✅");
    await cargarEjercicios();
  } catch (err) {
    mostrarMsg("Error al eliminar: " + err.message, "danger");
  }
}

// ---------- MIGRACIÓN: copiar el catálogo base local a Firestore ----------
document.getElementById("btnMigrarEjercicios").addEventListener("click", async () => {
  if (!confirm("Esto copia los 60 ejercicios base a Firestore (sin pisar los que ya existan ahí). ¿Continuar?")) return;

  try {
    const res = await fetch("/api/ejercicios");
    const base = await res.json();
    let agregados = 0;

    for (const ej of base) {
      const docRef = db.collection("ejercicios").doc(ej.id);
      const existe = await docRef.get();
      if (!existe.exists) {
        await docRef.set(ej);
        agregados++;
      }
    }

    mostrarMsg(`Migración completa: ${agregados} ejercicios nuevos agregados a Firestore ✅`);
    await cargarEjercicios();
  } catch (err) {
    mostrarMsg("Error en la migración: " + err.message, "danger");
  }
});

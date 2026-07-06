// static/js/avatar.js — Página de selección y gestión del avatar/companion

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = "/"; return; }
  await Gamification.cargarCatalogos();
  await renderPaginaAvatar(user.uid);
});

async function renderPaginaAvatar(uid) {
  const [snap, mascotas] = await Promise.all([
    db.collection("usuarios").doc(uid).get(),
    fetch("/api/mascotas").then(r => r.json())
  ]);

  const data = snap.data() || {};
  const avatarData = data.avatar || {};
  const coins = data.gymcoins || 0;
  const racha = data.racha_dias || 0;
  const inventario = data.inventario || [];
  const inventarioIds = new Set(inventario.map(i => i.item_id));
  const mascotaActivaId = avatarData.mascota_id || "shiba_swole";

  // Sprite del companion activo con pose según estado
  const estadoAnimo = avatarData.estado_animo || "neutral";
  const mascotaActiva = mascotas.find(m => m.id === mascotaActivaId)
    || mascotas.find(m => m.desbloqueado_por_defecto);

  const cont = document.getElementById("avatarContenedor");

  cont.innerHTML = `
    <!-- Header: estado actual -->
    <div class="card p-4 mb-4 text-center">
      <div id="previewSprite" class="companion-sprite-wrap mx-auto mb-3" style="--mascota-primario:${mascotaActiva?.paleta?.primario || '#e67e22'};--mascota-glow:${mascotaActiva?.paleta?.glow || '#ff6b35'}">
        <div class="companion-sprite"></div>
        <span class="companion-emoji" style="font-size:3rem;">${mascotaActiva?.emoji_base || '🦊'}</span>
      </div>
      <h4>${mascotaActiva?.nombre || 'Shiba-Swole'}</h4>
      <p class="text-secondary small mb-2">
        Estado: <strong>${estadoAnimo.replace("_", " ")}</strong> ·
        Morfología: <strong>${avatarData.morfologia || "normal"}</strong>
      </p>
      <div class="d-flex justify-content-center gap-3 flex-wrap">
        <span class="gymcoins-display">🪙 ${coins.toLocaleString()} GymCoins</span>
        <span class="badge bg-warning text-dark p-2">🔥 ${racha} días de racha</span>
      </div>
    </div>

    <!-- Accesorios equipados -->
    <div class="card p-3 mb-4">
      <h6 class="mb-2">⚙️ Equipado actualmente</h6>
      <div class="d-flex gap-2 flex-wrap">
        ${inventario.filter(i => i.equipado).map(i =>
          `<span class="badge p-2 rareza-${i.rareza}" style="font-size:1rem;">${i.icono} ${i.nombre}</span>`
        ).join("") || `<span class="text-secondary small">Ningún ítem equipado.
          <a href="/tienda">Visitá la tienda</a>.</span>`}
      </div>
    </div>

    <!-- Selector de mascota -->
    <h5 class="mb-3">🐾 Elegí tu compañero</h5>
    <div class="mascotas-grid mb-4">
      ${mascotas.map(m => {
        const comprada = m.desbloqueado_por_defecto || inventarioIds.has(m.id);
        const esActiva = m.id === mascotaActivaId;
        const bloqueada = !comprada;
        return `
          <div class="mascota-card ${esActiva ? 'activa' : ''} ${bloqueada ? 'bloqueada' : ''}"
               style="--mascota-primario:${m.paleta.primario};--mascota-glow:${m.paleta.glow};"
               data-id="${m.id}" title="${m.descripcion}">
            <div class="mascota-emoji">${m.emoji_base}</div>
            <div class="mascota-nombre">${m.nombre}</div>
            <div class="mascota-rareza badge rareza-${m.rareza}">${m.rareza}</div>
            ${bloqueada
              ? `<div class="small text-secondary mt-1">🪙 ${m.precio_coins}</div>
                 <a href="/tienda" class="btn btn-xs btn-outline-light mt-1">Comprar</a>`
              : esActiva
              ? `<div class="small text-success mt-1">✅ Activa</div>`
              : `<button class="btn btn-xs btn-primary mt-1 btnSeleccionar" data-id="${m.id}">Seleccionar</button>`
            }
          </div>
        `;
      }).join("")}
    </div>

    <!-- Links rápidos -->
    <div class="d-flex gap-2 flex-wrap">
      <a href="/tienda" class="btn btn-primary">🏪 Ir a la Tienda</a>
      <a href="/trofeos" class="btn btn-outline-light">🏆 Ver mis Trofeos</a>
    </div>
  `;

  // Render del sprite activo en preview
  if (mascotaActiva) {
    const previewWrap = cont.querySelector("#previewSprite");
    if (previewWrap && typeof Companion !== "undefined") {
      // Carga la spritesheet con la pose del estado actual
      const companionTemp = { ...Companion };
      renderSpriteEnContenedor(mascotaActiva, estadoAnimo, previewWrap);
    }
  }

  // Botones de seleccionar mascota
  cont.querySelectorAll(".btnSeleccionar").forEach(btn => {
    btn.addEventListener("click", async () => {
      const nuevoId = btn.dataset.id;
      await db.collection("usuarios").doc(uid).set(
        { avatar: { mascota_id: nuevoId } }, { merge: true }
      );
      renderPaginaAvatar(uid);
    });
  });
}

// Helper: renderiza el sprite en un contenedor dado (sin el widget global)
function renderSpriteEnContenedor(mascota, pose, contenedor) {
  const SPRITE_CELDA = 120;
  const SPRITE_COLS = 6;
  const POSE_COORDS = {
    neutral:{col:0,fila:0}, flexionando:{col:1,fila:0}, entrenando:{col:2,fila:0},
    motivando:{col:3,fila:0}, sudando:{col:4,fila:0}, feliz:{col:5,fila:0},
    pensativo:{col:0,fila:1}, durmiendo:{col:1,fila:1}, analizando:{col:3,fila:1},
    evolucionado:{col:5,fila:1}, on_fire:{col:0,fila:2}, en_descanso:{col:1,fila:2},
    sedentario:{col:2,fila:2}, sedentario_extremo:{col:3,fila:2}
  };
  const coords = POSE_COORDS[pose] || POSE_COORDS["neutral"];
  const sheetUrl = `/static/img/mascotas/${mascota.id}/spritesheet.png`;
  const spriteEl = contenedor.querySelector(".companion-sprite");
  const emojiEl  = contenedor.querySelector(".companion-emoji");
  if (!spriteEl) return;
  const img = new Image();
  img.onload = () => {
    spriteEl.style.backgroundImage = `url('${sheetUrl}')`;
    spriteEl.style.backgroundPosition = `${-(coords.col*SPRITE_CELDA)}px ${-(coords.fila*SPRITE_CELDA)}px`;
    spriteEl.style.backgroundRepeat = "no-repeat";
    spriteEl.style.backgroundSize = `${SPRITE_CELDA*SPRITE_COLS}px auto`;
    spriteEl.style.display = "block";
    if (emojiEl) emojiEl.style.display = "none";
  };
  img.onerror = () => {
    spriteEl.style.display = "none";
    if (emojiEl) { emojiEl.style.display = "block"; emojiEl.style.fontSize = "3rem"; }
  };
  img.src = sheetUrl;
}

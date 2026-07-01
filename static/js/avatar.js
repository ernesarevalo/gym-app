// Página de selección y vista de avatar
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = "/"; return; }
  await Gamification.cargarCatalogos();
  await renderPaginaAvatar(user.uid);
});

async function renderPaginaAvatar(uid) {
  const snap = await db.collection("usuarios").doc(uid).get();
  const data = snap.data() || {};
  const avatarData = data.avatar || {};
  const { sprite, accesorio, renderHtml } = Shop.renderAvatarEquipado(data);
  const coins = data.gymcoins || 0;
  const racha = data.racha_dias || 0;

  const cont = document.getElementById("avatarContenedor");
  cont.innerHTML = `
    <div class="text-center mb-5">
      <div style="font-size:5rem;" class="mb-2">${sprite}</div>
      ${accesorio ? `<div style="font-size:2rem;">${accesorio}</div>` : ""}
      <h4 class="mt-2">${data.nombre || data.username || "Atleta"}</h4>
      <p class="text-secondary">Morfología: <strong>${avatarData.morfologia || "normal"}</strong>
        · Estado: <strong>${avatarData.estado_animo || "normal"}</strong></p>
      <div class="gymcoins-display mb-2">🪙 ${coins.toLocaleString()} GymCoins · 🔥 ${racha} días de racha</div>
    </div>

    <h5 class="mb-3">Elegí tu animal</h5>
    <div class="d-flex gap-3 mb-4 justify-content-center flex-wrap">
      ${[{id:"perro",emoji:"🐶"},{id:"gato",emoji:"🐱"},{id:"conejo",emoji:"🐰"}].map(a => `
        <button class="btn ${avatarData.especie===a.id ? 'btn-primary' : 'btn-outline-light'} btn-lg btnEspecie" data-especie="${a.id}">
          ${a.emoji} ${a.id.charAt(0).toUpperCase()+a.id.slice(1)}
        </button>
      `).join("")}
    </div>

    <h5 class="mb-3">Inventario equipado</h5>
    <div class="d-flex gap-2 flex-wrap mb-4">
      ${(data.inventario||[]).filter(i=>i.equipado).map(i =>
        `<span class="badge bg-warning text-dark p-2" style="font-size:1.1rem;">${i.icono} ${i.nombre}</span>`
      ).join("") || "<span class='text-secondary'>Ningún ítem equipado. ¡Visitá la tienda!</span>"}
    </div>

    <a href="/tienda" class="btn btn-primary">🏪 Ir a la Tienda</a>
  `;

  cont.querySelectorAll(".btnEspecie").forEach(btn => {
    btn.addEventListener("click", async () => {
      const especie = btn.dataset.especie;
      await db.collection("usuarios").doc(uid).set(
        { avatar: { especie } }, { merge: true }
      );
      renderPaginaAvatar(uid);
    });
  });
}

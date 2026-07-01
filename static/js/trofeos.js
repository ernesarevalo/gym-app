const COLORES_RAREZA = {
  bronce: "#cd7f32", plata: "#9e9e9e", oro: "#fbbf24", diamante: "#60a5fa"
};

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = "/"; return; }
  await Gamification.cargarCatalogos();
  await renderTrofeos(user.uid);
});

async function renderTrofeos(uid) {
  const [snap, catalogo] = await Promise.all([
    db.collection("usuarios").doc(uid).get(),
    fetch("/api/trofeos").then(r => r.json())
  ]);

  const data = snap.data() || {};
  const obtenidos = new Set(data.trofeos_obtenidos || []);
  const coins = data.gymcoins || 0;

  const cont = document.getElementById("trofeosContenedor");
  cont.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
      <h4 class="mb-0">🏆 Mis Trofeos</h4>
      <div class="gymcoins-display">🪙 <strong>${coins.toLocaleString()}</strong> GymCoins · ${obtenidos.size}/${catalogo.length} trofeos</div>
    </div>
    <div class="progress mb-4" style="height:10px;">
      <div class="progress-bar" style="width:${Math.round(obtenidos.size/catalogo.length*100)}%;background:var(--primary);"></div>
    </div>
    <div class="trofeos-grid">
      ${catalogo.map(t => {
        const tiene = obtenidos.has(t.id);
        const color = COLORES_RAREZA[t.rareza] || "#888";
        return `
          <div class="trofeo-card ${tiene ? '' : 'bloqueado'}" style="border-color:${color}22;">
            <div class="trofeo-emoji" style="filter:${tiene?'none':'grayscale(1) opacity(0.4)'}">${t.icono}</div>
            <div class="trofeo-nombre" style="color:${tiene?color:'var(--text-secondary)'}">${t.nombre}</div>
            <div class="trofeo-desc small">${t.descripcion}</div>
            <span class="badge mt-1" style="background:${color}33;color:${color};border:1px solid ${color};">${t.rareza}</span>
            <div class="trofeo-coins small mt-1">🪙 ${Gamification.coinsRecompensaTrofeo(t)} coins</div>
            ${tiene ? '<div class="text-success small mt-1">✅ Obtenido</div>' : ''}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// static/js/shop.js
// Tienda Virtual — transacciones de GymCoins, equipado de ítems, renderizado del avatar
// =====================================================================

async function cargarTienda(uid) {
  const [snap, tiendaItems] = await Promise.all([
    db.collection("usuarios").doc(uid).get(),
    fetch("/api/tienda").then(r => r.json())
  ]);

  const userData = snap.data() || {};
  const coins = userData.gymcoins || 0;
  const inventario = userData.inventario || [];
  const racha = userData.racha_dias || 0;
  const inventarioIds = new Set(inventario.map(i => i.item_id));

  return tiendaItems.map(item => ({
    ...item,
    comprado: inventarioIds.has(item.id),
    bloqueado: !cumpleRequisito(item.requisito, racha, userData),
    puedePagar: coins >= item.precio_coins && !inventarioIds.has(item.id)
  }));
}

function cumpleRequisito(requisito, racha, userData) {
  if (!requisito) return true;
  if (requisito.tipo === "racha_dias") return racha >= requisito.valor;
  if (requisito.tipo === "trofeo") return (userData.trofeos_obtenidos || []).includes(requisito.valor);
  return true;
}

// ---- TRANSACCIÓN DE COMPRA (atómica) ----
async function comprarItem(uid, item) {
  const ref = db.collection("usuarios").doc(uid);

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.data() || {};
    const coins = data.gymcoins || 0;

    if (coins < item.precio_coins) throw new Error("GymCoins insuficientes.");
    const inventario = data.inventario || [];
    if (inventario.some(i => i.item_id === item.id)) throw new Error("Ya tenés este ítem.");

    const nuevoItem = {
      item_id: item.id,
      tipo: item.tipo,
      nombre: item.nombre,
      icono: item.icono,
      rareza: item.rareza,
      equipado: false,
      fecha_compra: new Date().toISOString()
    };

    transaction.update(ref, {
      gymcoins: firebase.firestore.FieldValue.increment(-item.precio_coins),
      inventario: firebase.firestore.FieldValue.arrayUnion(nuevoItem)
    });

    return nuevoItem;
  });
}

// ---- EQUIPAR ÍTEM ----
async function equiparItem(uid, itemId) {
  const snap = await db.collection("usuarios").doc(uid).get();
  const data = snap.data() || {};
  const inventario = data.inventario || [];

  const actualizado = inventario.map(i => {
    // Solo 1 accesorio equipado a la vez del mismo tipo
    if (i.tipo === inventario.find(x => x.item_id === itemId)?.tipo) {
      return { ...i, equipado: i.item_id === itemId };
    }
    return i;
  });

  const itemEquipado = actualizado.find(i => i.item_id === itemId);

  // Si es mascota premium, actualizar el campo avatar.mascota_premium
  const update = { inventario: actualizado };
  if (itemEquipado?.tipo === "mascota_premium") {
    const especieMap = {
      "mascota_husky": "husky",
      "mascota_shiba": "shiba"
    };
    update["avatar.mascota_premium"] = especieMap[itemId] || null;
  } else {
    update["avatar.accesorio_equipado"] = itemId;
  }

  await db.collection("usuarios").doc(uid).update(update);
}

// ---- RENDERIZADO FINAL DEL AVATAR EQUIPADO ----
// Compone el sprite base + accesorio en el perfil público
function renderAvatarEquipado(userData) {
  const avatarData = userData.avatar || { especie: "perro" };
  const spriteBase = Gamification.obtenerSprite(avatarData);
  const accesorio = (userData.inventario || []).find(i => i.equipado && i.tipo === "accesorio");

  return {
    sprite: spriteBase,
    accesorio: accesorio ? accesorio.icono : null,
    renderHtml: `
      <div class="avatar-compuesto">
        <span class="avatar-base">${spriteBase}</span>
        ${accesorio ? `<span class="avatar-accesorio">${accesorio.icono}</span>` : ""}
      </div>
    `
  };
}

// ---- PÁGINA DE TIENDA: render HTML ----
async function renderPaginaTienda(uid, contenedor) {
  const items = await cargarTienda(uid);
  const snap = await db.collection("usuarios").doc(uid).get();
  const coins = (snap.data() || {}).gymcoins || 0;

  contenedor.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
      <h4 class="mb-0">🏪 Tienda</h4>
      <div class="gymcoins-display">🪙 <strong>${coins.toLocaleString()}</strong> GymCoins disponibles</div>
    </div>
    <div class="tienda-grid">
      ${items.map(item => `
        <div class="tienda-card rareza-border-${item.rareza} ${item.comprado ? 'comprado' : ''} ${item.bloqueado ? 'bloqueado' : ''}">
          <div class="tienda-icono">${item.icono}</div>
          <div class="tienda-nombre">${item.nombre}</div>
          <div class="tienda-desc small text-secondary">${item.descripcion}</div>
          <div class="tienda-rareza badge rareza-${item.rareza}">${item.rareza}</div>
          ${item.requisito ? `<div class="tienda-req small text-warning">🔒 Requiere: ${item.requisito.tipo === 'racha_dias' ? item.requisito.valor + ' días de racha' : item.requisito.valor}</div>` : ""}
          <div class="tienda-precio mt-2">🪙 ${item.precio_coins.toLocaleString()}</div>
          ${item.comprado
            ? `<button class="btn btn-sm btn-success mt-2 w-100" onclick="equiparYRefrescar('${uid}','${item.id}')">✓ Equipar</button>`
            : item.bloqueado
            ? `<button class="btn btn-sm btn-secondary mt-2 w-100" disabled>🔒 Bloqueado</button>`
            : item.puedePagar
            ? `<button class="btn btn-sm btn-primary mt-2 w-100" onclick="comprarYRefrescar('${uid}','${JSON.stringify(item).replace(/'/g,"\\'")}')">Comprar</button>`
            : `<button class="btn btn-sm btn-outline-secondary mt-2 w-100" disabled>Sin coins</button>`
          }
        </div>
      `).join("")}
    </div>
  `;
}

async function comprarYRefrescar(uid, itemJson) {
  try {
    const item = JSON.parse(itemJson);
    await comprarItem(uid, item);
    Gamification.notificarTrofeos([{ icono: item.icono, nombre: "¡Compra exitosa!", descripcion: item.nombre, rareza: item.rareza, recompensa_puntos: 0 }]);
    const cont = document.getElementById("tiendaContenedor");
    if (cont) renderPaginaTienda(uid, cont);
  } catch (e) {
    alert("Error: " + e.message);
  }
}

async function equiparYRefrescar(uid, itemId) {
  await equiparItem(uid, itemId);
  const cont = document.getElementById("tiendaContenedor");
  if (cont) renderPaginaTienda(uid, cont);
}

window.Shop = { cargarTienda, comprarItem, equiparItem, renderAvatarEquipado, renderPaginaTienda };
window.comprarYRefrescar = comprarYRefrescar;
window.equiparYRefrescar = equiparYRefrescar;

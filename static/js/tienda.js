auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = "/"; return; }
  await Gamification.cargarCatalogos();
  await Shop.renderPaginaTienda(user.uid, document.getElementById("tiendaContenedor"));
});

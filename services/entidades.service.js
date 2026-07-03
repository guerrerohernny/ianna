/* ════════════════════════════════════════════════════════════════
   IANNA CRM — services/entidades.service.js
   CAPA DE SERVICIOS DE DATOS
   ────────────────────────────────────────────────────────────────
   Fachadas de acceso a datos por entidad, sobre el DataStore (DS).
   FASE 1: se definen los servicios; los módulos existentes siguen
   usando DS directamente (comportamiento intacto). FASE 2: los
   módulos migrarán a estos servicios, y cambiar el backend
   (localStorage → Supabase) será transparente para los módulos.
   ════════════════════════════════════════════════════════════════ */

window.prospectosService = {
  listar: (f) => DS.find('prospectos', f),
  obtener: (id) => DS.findOne('prospectos', id),
  crear: (d) => DS.create('prospectos', d),
  actualizar: (id, d) => DS.update('prospectos', id, d),
  eliminar: (id) => DS.delete('prospectos', id),
};

window.inventarioService = {
  listar: () => DS.db.inventario,
  obtener: (clave) => getLote(clave),
  vendibles: () => DS.db.inventario.filter(l => !['Apartado','Vendido','Casa Muestra','Subdividido'].includes(l.estado)),
};

window.apartadosService = {
  listar: (f) => DS.find('apartados', f),
  obtener: (id) => DS.findOne('apartados', id),
  crear: (d) => DS.create('apartados', d),
  actualizar: (id, d) => DS.update('apartados', id, d),
  ventas: () => DS.find('apartados').filter(a => a.estatus === 'Venta'),
  activos: () => DS.find('apartados').filter(a => a.estatus === 'Activo'),
};

window.usuariosService = {
  listar: (f) => DS.find('usuarios', f),
  obtener: (id) => getUser(id),
  asesores: () => DS.find('usuarios', { rol: 'asesor', activo: true }),
};

window.brokersService = {
  listar: (f) => DS.find('brokers', f),
  obtener: (id) => DS.findOne('brokers', id),
};

window.pagosService = {
  deApartado: (apId) => (DS.findOne('apartados', apId)?.pagos) || [],
  efectivoAcumulado: (apId) => {
    const ap = DS.findOne('apartados', apId); if (!ap) return 0;
    return (ap.metodo_pago === 'Efectivo' ? (ap.monto_enganche || 0) : 0)
      + (ap.pagos || []).filter(p => p.metodo === 'Efectivo').reduce((s, p) => s + (p.monto || 0), 0);
  },
};

window.parametrosService = {
  obtener: () => getP(),
};

/* ════════════════════════════════════════════════════════════════
   IANNA CRM — business/estados.business.js
   MÁQUINA DE ESTADOS (Fase 1.8)
   ────────────────────────────────────────────────────────────────
   Autoridad única sobre el ciclo de vida de una operación. Cada
   estado declara: de dónde puede venir, a dónde puede avanzar, qué
   operaciones permite/prohíbe, qué documentos exige y qué módulos
   deben refrescarse. Los estados nuevos se AGREGAN al registro sin
   tocar el núcleo (IANNA_ESTADOS.registrar).

   Nota de implementación (estabilidad ante todo): los registros
   actuales usan estatus internos ('Activo','Venta'...). La máquina
   es la autoridad y `estadoDe(ap)` los mapea. Los estados del
   pipeline posteriores a "Contrato firmado" (Enganche→…→Postventa)
   quedan DEFINIDOS y transitables por el motor, pero ningún flujo
   comercial los recorre aún: eso llega en fases posteriores sin
   modificar este núcleo.
   ════════════════════════════════════════════════════════════════ */

window.IANNA_ESTADOS = {

  _def: {
    'Disponible':       { desde:['Cancelado','Reubicado','Suspendido'], hacia:['Apartado','Suspendido'],
                          permitidas:['crear_apartado'], prohibidas:['cancelacion_venta','cobranza'],
                          documentos:[], modulos:['inventario','dashboard'] },
    'Apartado':         { desde:['Disponible','Contrato firmado'], hacia:['Contrato firmado','Cancelado','Reubicado'],
                          permitidas:['editar_apartado','generar_cierre','contrato_firmado','cancelacion_apartado','registrar_pago','cambio_lote','cambio_modelo','cambio_cliente','cambio_asesor'],
                          prohibidas:['cancelacion_venta'],
                          documentos:['Recibo de Apartado','Formato de Apartado'], modulos:['inventario','apartados','dashboard','reportes'] },
    'Contrato firmado': { desde:['Apartado'], hacia:['Enganche','Apartado','Cancelado','Reubicado','Suspendido','Rescindido'],
                          permitidas:['cobranza','registrar_pago','correccion_administrativa','cancelacion_venta','cambio_lote','cambio_cliente','cambio_asesor','transferencia'],
                          prohibidas:['editar_apartado','contrato_firmado','crear_apartado'],
                          documentos:['Contrato de Compraventa','Carátula','Datos Generales','Carta Restricción','Carta Autorización'],
                          modulos:['inventario','apartados','ingresos','cobranza','dashboard','reportes'] },
    'Enganche':         { desde:['Contrato firmado'], hacia:['Cobranza','Cancelado','Suspendido','Rescindido'],
                          permitidas:['cobranza','registrar_pago','correccion_administrativa','cancelacion_venta'],
                          prohibidas:['editar_apartado'], documentos:['Recibos de Enganche'], modulos:['cobranza','ingresos','dashboard'] },
    'Cobranza':         { desde:['Enganche'], hacia:['Liquidado','Cancelado','Suspendido','Rescindido'],
                          permitidas:['cobranza','registrar_pago','correccion_administrativa','cancelacion_venta'],
                          prohibidas:['editar_apartado'], documentos:['Pagarés','Estado de cuenta'], modulos:['cobranza','ingresos','dashboard'] },
    'Liquidado':        { desde:['Cobranza','Enganche'], hacia:['Escrituración'],
                          permitidas:['correccion_administrativa'], prohibidas:['cancelacion_venta','registrar_pago'],
                          documentos:['Carta de liquidación'], modulos:['cobranza','ingresos','dashboard','reportes'] },
    'Escrituración':    { desde:['Liquidado'], hacia:['Entregado'],
                          permitidas:['correccion_administrativa'], prohibidas:['cancelacion_venta'],
                          documentos:['Escritura pública'], modulos:['inventario','reportes'] },
    'Entregado':        { desde:['Escrituración'], hacia:['Postventa'],
                          permitidas:['correccion_administrativa'], prohibidas:['cancelacion_venta'],
                          documentos:['Acta de entrega'], modulos:['inventario','reportes'] },
    'Postventa':        { desde:['Entregado'], hacia:[],
                          permitidas:['correccion_administrativa'], prohibidas:[], documentos:[], modulos:['reportes'] },
    // ── Estados especiales ──
    'Cancelado':        { desde:['Apartado','Contrato firmado','Enganche','Cobranza'], hacia:['Disponible'],
                          permitidas:[], prohibidas:['editar_apartado','cobranza','registrar_pago'],
                          documentos:['Folio de cancelación'], modulos:['inventario','apartados','ingresos','dashboard','reportes'] },
    'Reubicado':        { desde:['Apartado','Contrato firmado'], hacia:['Disponible'],
                          permitidas:[], prohibidas:[], documentos:[], modulos:['inventario','apartados'] },
    'Suspendido':       { desde:['Contrato firmado','Enganche','Cobranza','Disponible'], hacia:['Contrato firmado','Enganche','Cobranza','Cancelado','Disponible'],
                          permitidas:['correccion_administrativa'], prohibidas:['registrar_pago'], documentos:[], modulos:['apartados','cobranza'] },
    'Rescindido':       { desde:['Contrato firmado','Enganche','Cobranza'], hacia:['Disponible'],
                          permitidas:[], prohibidas:[], documentos:['Acta de rescisión'], modulos:['inventario','apartados','ingresos'],
                          nota:'Preparado para futuras políticas de rescisión contractual.' },
  },

  // Registrar un estado nuevo sin tocar el núcleo
  registrar(nombre, def){ this._def[nombre]=def; },

  get(nombre){ return this._def[nombre]||null; },
  existe(nombre){ return !!this._def[nombre]; },

  // Mapeo desde los estatus internos actuales del registro
  estadoDe(ap){
    if(!ap) return null;
    const M={ 'Activo':'Apartado', 'Venta':'Contrato firmado', 'Cancelado':'Cancelado', 'Venta Cancelada':'Cancelado', 'Reubicado':'Reubicado', 'Suspendido':'Suspendido', 'Rescindido':'Rescindido' };
    return ap.estado_maquina || M[ap.estatus] || ap.estatus;
  },

  // ¿La transición de → a es legal?
  puedeTransicionar(de, a){
    const dDe=this.get(de), dA=this.get(a);
    if(!dDe||!dA) return {ok:false, razon:`Estado desconocido: ${!dDe?de:a}`};
    if(!dDe.hacia.includes(a)) return {ok:false, razon:`Transición no permitida: "${de}" no puede avanzar a "${a}". Destinos válidos: ${dDe.hacia.join(', ')||'ninguno'}.`};
    if(!dA.desde.includes(de)) return {ok:false, razon:`"${a}" no acepta provenir de "${de}". Orígenes válidos: ${dA.desde.join(', ')}.`};
    return {ok:true};
  },

  // ¿La operación está permitida en el estado actual del registro?
  operacionPermitida(ap, operacion){
    const est=this.estadoDe(ap); const d=this.get(est);
    if(!d) return {ok:false, estado:est, razon:`Estado "${est}" no registrado en la máquina de estados.`};
    if(d.prohibidas.includes(operacion)) return {ok:false, estado:est, razon:`La operación "${operacion}" está prohibida en estado "${est}".`};
    if(!d.permitidas.includes(operacion)) return {ok:false, estado:est, razon:`La operación "${operacion}" no está entre las permitidas en "${est}" (${d.permitidas.join(', ')||'ninguna'}).`};
    return {ok:true, estado:est};
  },

  permitidasDe(ap){ const d=this.get(this.estadoDe(ap)); return d?d.permitidas.slice():[]; },
  modulosDe(estado){ const d=this.get(estado); return d?d.modulos.slice():[]; },
  documentosDe(estado){ const d=this.get(estado); return d?d.documentos.slice():[]; },
};

/* ════════════════════════════════════════════════════════════════
   IANNA CRM — business/motor.business.js
   MOTOR DE REGLAS DE NEGOCIO (Fase 1.5)
   ────────────────────────────────────────────────────────────────
   Toda operación sensible pasa por aquí ANTES de ejecutarse.
   Si una regla falla, la operación se cancela COMPLETA (nunca
   escrituras parciales: validar primero, escribir después) y el
   intento queda auditado.

   Principios:
   · Inventario protegido: vivienda con venta/apartado activo no se
     modifica ni elimina directamente — solo mediante cancelación.
   · Unicidad: jamás dos operaciones activas sobre la misma vivienda.
   · Cliente único: no se crean expedientes duplicados.
   · Eliminaciones protegidas: lo histórico cambia de estado, no se borra.
   · Auditoría automática: usuario, fecha, acción, antes, después, motivo.
   ════════════════════════════════════════════════════════════════ */

window.IANNA_MOTOR = {

  /* ── AUDITORÍA AUTOMÁTICA ─────────────────────────────────────── */
  auditar(tabla, id, accion, antes, despues, motivo){
    try{ DS.audit(tabla, id, accion, antes||{}, {...(despues||{}), ...(motivo?{motivo}:{})}); }catch(e){ console.error('auditar',e); }
  },

  // Bloquea una operación: mensaje al usuario + auditoría del intento
  bloquear(tabla, id, accion, razon){
    this.auditar(tabla, id, accion+'_BLOQUEADO', {}, {}, razon);
    toast('⛔ '+razon, 'err', 6000);
    return false;
  },

  /* ── ESTADO DE PROTECCIÓN DE UNA VIVIENDA ─────────────────────── */
  // Devuelve la operación activa (Venta o Apartado) que protege al lote
  operacionActivaDeLote(clave, excluirApId){
    return DS.find('apartados').find(a =>
      a.id!==excluirApId &&
      (a.estatus==='Venta'||a.estatus==='Activo') &&
      (a.clave_lote===clave || a.clave_lote_adicional===clave)
    )||null;
  },

  loteProtegido(clave, excluirApId){
    const op=this.operacionActivaDeLote(clave, excluirApId);
    if(!op) return {protegido:false};
    const p=DS.findOne('prospectos',op.prospectoId);
    const tipo = op.estatus==='Venta' ? 'una VENTA con contrato firmado' : 'un APARTADO activo';
    return {protegido:true, op, razon:`El lote ${clave} tiene ${tipo} de ${p?.nombre||'un cliente'}. Para modificarlo primero realiza la cancelación formal desde Apartados.`};
  },

  /* ── VALIDACIONES DE OPERACIONES ──────────────────────────────── */

  // Alta/edición de apartado: unicidad de vivienda (principal y adicional)
  validarNuevoApartado({clave_lote, clave_lote_adicional, prospectoId, editId}){
    const errores=[];
    const l=getLote(clave_lote);
    if(!l) errores.push(`El lote ${clave_lote} no existe en el inventario.`);
    if(!DS.findOne('prospectos',prospectoId)) errores.push('El prospecto seleccionado no existe.');
    const opPrin=this.operacionActivaDeLote(clave_lote, editId);
    if(opPrin){
      const p=DS.findOne('prospectos',opPrin.prospectoId);
      errores.push(`El lote ${clave_lote} ya tiene ${opPrin.estatus==='Venta'?'una venta':'un apartado activo'} de ${p?.nombre||'otro cliente'}. Una vivienda no puede tener dos operaciones activas.`);
    }
    if(clave_lote_adicional){
      if(!getLote(clave_lote_adicional)) errores.push(`El lote adicional ${clave_lote_adicional} no existe.`);
      const opAd=this.operacionActivaDeLote(clave_lote_adicional, editId);
      if(opAd) errores.push(`El lote adicional ${clave_lote_adicional} ya está comprometido en otra operación activa.`);
    }
    return {ok:errores.length===0, errores};
  },

  // Conversión a venta: el apartado debe estar Activo y la vivienda libre de otra operación
  validarConversionVenta(ap){
    const errores=[];
    if(!ap) errores.push('Operación no encontrada.');
    else{
      if(ap.estatus!=='Activo') errores.push(`Solo un apartado Activo puede convertirse en venta (estatus actual: ${ap.estatus}).`);
      const otra=this.operacionActivaDeLote(ap.clave_lote, ap.id);
      if(otra) errores.push(`El lote ${ap.clave_lote} tiene otra operación activa. Una vivienda no puede venderse dos veces.`);
      const l=getLote(ap.clave_lote);
      if(l&&l.estado==='Vendido') errores.push(`El lote ${ap.clave_lote} ya figura como Vendido en el inventario.`);
    }
    return {ok:errores.length===0, errores};
  },

  // Cliente único: no crear expedientes duplicados (mismo teléfono o correo)
  validarProspectoUnico({telefono, correo, editId}){
    const norm=t=>String(t||'').replace(/\D/g,'');
    const tel=norm(telefono), mail=String(correo||'').trim().toLowerCase();
    const dup=DS.find('prospectos').find(p=>p.id!==editId&&(
      (tel&&tel.length>=10&&norm(p.telefono)===tel) ||
      (mail&&String(p.correo||'').trim().toLowerCase()===mail)
    ));
    if(dup) return {ok:false, dup, errores:[`Ya existe el expediente de "${dup.nombre}" con ese ${tel&&norm(dup.telefono)===tel?'teléfono':'correo'}. Cada cliente conserva un único expediente: usa el existente en lugar de crear uno nuevo.`]};
    return {ok:true, errores:[]};
  },

  /* ── ELIMINACIONES PROTEGIDAS ─────────────────────────────────── */

  relacionesDeProspecto(pid){
    return {
      apartados: DS.find('apartados',{prospectoId:pid}).length,
      seguimientos: DS.find('seguimientos',{prospectoId:pid}).length,
      cotizaciones: (DS.db.cotizaciones||[]).filter(c=>c.prospectoId===pid).length,
    };
  },
  puedeEliminarProspecto(pid){
    const r=this.relacionesDeProspecto(pid);
    const total=r.apartados+r.seguimientos+r.cotizaciones;
    return {fisico: total===0, relaciones:r};
  },
  puedeEliminarLote(clave){
    const refs=DS.find('apartados').filter(a=>a.clave_lote===clave||a.clave_lote_adicional===clave).length;
    return {fisico: refs===0, refs};
  },
  modeloEnUso(modId){
    return DS.find('apartados').some(a=>a.modelo_id===modId);
  },
  asesorEnUso(uid){
    return DS.find('prospectos',{asesor:uid}).length>0 || DS.find('apartados').some(a=>a.asesor===uid);
  },

  /* ── FOLIO DEFINITIVO DEL CIERRE ──────────────────────────────── */
  // Reutiliza el folio ya asignado al apartado; si no tiene, emite uno
  // en firme (único). Reabrir un cierre jamás cambia su folio.
  asegurarFolioCierre(){
    if(!_cierreData) return null;
    const ap=DS.findOne('apartados',_cierreData.ap.id)||_cierreData.ap;
    if(ap.folio_recibo){ _cierreData.folio=String(ap.folio_recibo).padStart(8,'0'); return parseInt(ap.folio_recibo); }
    const f=IANNA_FOLIOS.emitir('recibo_apartado', ap.id);
    _cierreData.folio=f;
    return parseInt(f);
  },

  /* ── RESUMEN DE CONSECUENCIAS (flujos de cancelación) ─────────── */
  consecuenciasCancelacionVenta(ap, destino){
    const p=DS.findOne('prospectos',ap.prospectoId);
    return `Esta operación realizará automáticamente:\n\n`+
      `• Cancelar la venta actual de ${p?.nombre||'el cliente'} (Lote ${ap.clave_lote}).\n`+
      (destino==='Apartado'
        ? `• Revertir la operación a APARTADO activo (reaparece en el módulo).\n• Limpiar fecha de venta, total de operación y comisiones cobradas.\n`
        : `• Liberar la vivienda (Lote ${ap.clave_lote} → Disponible).\n• Retirar al cliente del lote.\n`)+
      `• Actualizar Ingresos y comisiones (la venta deja de contar).\n`+
      `• Actualizar Apartados, Inventario y Dashboard.\n`+
      `• Emitir folio de cancelación y registrar auditoría.\n`+
      `• Conservar íntegro el historial y el expediente de documentos.\n\n`+
      `¿Confirmas la cancelación?`;
  },
  consecuenciasCancelacionApartado(ap){
    const p=DS.findOne('prospectos',ap.prospectoId);
    return `Esta operación realizará automáticamente:\n\n`+
      `• Cancelar el apartado de ${p?.nombre||'el cliente'} (Lote ${ap.clave_lote}).\n`+
      `• Liberar la vivienda y retirar al cliente del lote.\n`+
      `• Regresar el prospecto a Seguimiento.\n`+
      `• Emitir folio de cancelación y registrar auditoría.\n`+
      `• Conservar íntegro el historial.\n\n`+
      `¿Confirmas la cancelación del apartado?`;
  },

  // Registro formal de una cancelación (documento oficial con folio único)
  registrarCancelacion(tipo, ap, motivo, destino){
    if(!DS.db.cancelaciones) DS.db.cancelaciones=[];
    const folio=IANNA_FOLIOS.emitir('cancelacion', ap.id);
    const reg={
      id:uid(), folio:parseInt(folio), tipo, apartadoId:ap.id,
      prospectoId:ap.prospectoId, clave_lote:ap.clave_lote,
      total_operacion:ap.total_operacion||null, motivo:motivo||'', destino:destino||'',
      usuario:CU.id, fecha:new Date().toISOString(),
    };
    DS.db.cancelaciones.unshift(reg);
    DS._save(DS.db);
    return reg;
  },
};

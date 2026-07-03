/* ════════════════════════════════════════════════════════════════
   IANNA CRM — business/cancelaciones.business.js
   REGLAS DE NEGOCIO — Cancelación/reversión de ventas: destino del lote, limpieza de comisiones, reversión a apartado. Aquí vivirán las futuras reglas (cambios de lote, cambio de cliente, reasignaciones, penalizaciones, liberación de inventario...).
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// MIS INGRESOS
// ================================================================
function openCancelarVenta(aid){
  const ap=DS.findOne('apartados',aid); if(!ap||ap.estatus!=='Venta') return;
  const p=DS.findOne('prospectos',ap.prospectoId);
  const l=DS.db.inventario.find(x=>x.clave===ap.clave_lote);
  // Build modal dynamically — inject into existing m-lote modal reusing simple confirm pattern
  const motivo=prompt(`Cancelar venta de ${p?p.nombre:'cliente'} — Lote ${ap.clave_lote}\n\nEscribe el motivo de cancelación:`,'');
  if(motivo===null) return; // cancelled by user
  if(!motivo.trim()){ toast('El motivo es requerido','err'); return; }
  const destino=confirm(`¿Volver el lote ${ap.clave_lote} a:\n\n✅ Aceptar → Disponible\n❌ Cancelar → Apartado`)?'Disponible':'Apartado';
  cancelarVenta(aid, motivo.trim(), destino);
}
function cancelarVenta(aid, motivo, destinoLote){
  const ap=DS.findOne('apartados',aid); if(!ap) return;
  const now=new Date().toISOString();
  // 1. Marcar apartado como Venta Cancelada + guardar auditoría
  if(destinoLote==='Apartado'){
    // La venta se revierte: el registro REGRESA a apartado Activo (reaparece en el módulo)
    // y se limpian los datos de la venta para que Ingresos no la cuente.
    DS.update('apartados',aid,{
      estatus:'Activo',
      fecha_venta:null, total_operacion:null, fecha_firma_contrato:null,
      comision_parte1_cobrada:false, comision_parte2_cobrada:false,
      comision_ger_parte1_cobrada:false, comision_ger_parte2_cobrada:false,
      venta_revertida_fecha:now, venta_revertida_motivo:motivo, venta_revertida_usuario:CU.id,
    });
  } else {
    DS.update('apartados',aid,{
      estatus:'Venta Cancelada',
      cancelacion_fecha:now,
      cancelacion_usuario:CU.id,
      cancelacion_motivo:motivo,
      cancelacion_destino_lote:destinoLote,
    });
  }
  // 2. Actualizar inventario — lote principal
  // Si el lote vuelve a Disponible: SIEMPRE se limpia el cliente; el modelo según si la construcción ya inició
  let keepModelo=false;
  const lPrinV=getLote(ap.clave_lote);
  if(destinoLote==='Disponible'&&lPrinV&&lPrinV.modelo_asignado){
    keepModelo=!confirm(`El lote ${ap.clave_lote} quedará DISPONIBLE: se limpia el cliente y el modelo "${lPrinV.modelo_asignado}".\n\n✅ Aceptar → Limpiar todo (lote Disponible, sin modelo ni cliente)\n❌ Cancelar → SOLO si la construcción de la casa YA INICIÓ físicamente: conserva el modelo y queda como Entrega Rápida (sin cliente)`);
  }
  const li=DS.db.inventario.findIndex(x=>x.clave===ap.clave_lote);
  if(li>=0){
    const hist=[...(DS.db.inventario[li].historial||[]),{estadoAnterior:'Vendido',estadoNuevo:destinoLote,fecha:now,usuario:CU.id,nota:`Venta cancelada — Motivo: ${motivo}`+(destinoLote==='Disponible'?(keepModelo?' — construcción iniciada, conserva modelo':' — modelo y cliente liberados'):'')}];
    const patchPrin={...DS.db.inventario[li],estado:destinoLote,historial:hist};
    if(destinoLote==='Disponible'){ patchPrin.cliente_asignado=''; if(!keepModelo) patchPrin.modelo_asignado=''; }
    DS.db.inventario[li]=patchPrin;
  }
  // 3. Actualizar lote adicional si existía
  if(ap.clave_lote_adicional){
    const liAd=DS.db.inventario.findIndex(x=>x.clave===ap.clave_lote_adicional);
    if(liAd>=0){
      const histAd=[...(DS.db.inventario[liAd].historial||[]),{estadoAnterior:'Vendido',estadoNuevo:destinoLote,fecha:now,usuario:CU.id,nota:`Venta cancelada (lote adicional) — Motivo: ${motivo}`}];
      const patchAd={...DS.db.inventario[liAd],estado:destinoLote,historial:histAd};
      if(destinoLote==='Disponible'){ patchAd.cliente_asignado=''; patchAd.modelo_asignado=''; }
      DS.db.inventario[liAd]=patchAd;
    }
  }
  DS._save(DS.db);
  // 4. Actualizar estatus del prospecto (Apartado si la venta se revierte; Seguimiento si se libera el lote)
  const estatusProsp = destinoLote==='Apartado' ? 'Apartado' : 'Seguimiento';
  DS.update('prospectos',ap.prospectoId,{estatus:estatusProsp});
  DS.create('seguimientos',{prospectoId:ap.prospectoId,tipo:'Nota interna',nota:`Venta CANCELADA — Lote ${ap.clave_lote} — Motivo: ${motivo} — Lote vuelto a: ${destinoLote}`,fecha:now,usuario:CU.id,estatusCambio:estatusProsp});
  renderApartados(); renderInventario(); renderDashboard(); renderIngresos();
  toast(`Venta cancelada. Lote ${ap.clave_lote} → ${destinoLote} ✓`,'warn',5000);
}

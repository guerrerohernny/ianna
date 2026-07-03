/* ════════════════════════════════════════════════════════════════
   IANNA CRM — services/expediente.service.js
   Servicio Expediente: snapshots inmutables, registro y regeneración de documentos.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ════════════════════════════════════════════════════════════════
// EXPEDIENTE DE DOCUMENTOS — snapshot inmutable + registro + regeneración
// ════════════════════════════════════════════════════════════════
const DOC_LABELS = {
  imprimirReciboApartado:'Recibo de Apartado',
  imprimirFormatoApartado:'Formato de Apartado de Vivienda',
  imprimirDatosGenerales:'Datos Generales del Solicitante',
  imprimirCartaAutorizacion:'Carta de Autorización de Uso de Datos',
  imprimirCartaRestriccion:'Carta Compromiso Restricción de Efectivo',
  imprimirCaratula:'Carátula del Contrato',
  imprimirContrato:'Contrato de Compraventa',
  imprimirPagares:'Pagarés',
};

// Snapshot serializable de _cierreData (congela los datos al momento de generar)
function construirSnapshotCierre(){
  if(!_cierreData) return null;
  const cd=_cierreData;
  const cli=getClienteData();
  return {
    cli, folio:cd.folio, numCliente:cd.numCliente,
    asesorNombre:(getUser(cd.ap?.asesor)?.nombre)||CU.nombre,
    formaPago: cd.formaPago || $('c-forma-pago')?.value || 'Transferencia electrónica',
    l: cd.l?{...cd.l, historial:undefined}:null,
    m: cd.m?{...cd.m}:null,
    ap: cd.ap?{id:cd.ap.id, monto_enganche:cd.ap.monto_enganche, clave_lote:cd.ap.clave_lote, clave_lote_adicional:cd.ap.clave_lote_adicional, construccion_adicional_desc:cd.ap.construccion_adicional_desc, construccion_adicional_m2:cd.ap.construccion_adicional_m2, construccion_adicional_val:cd.ap.construccion_adicional_val, fecha_apartado:cd.ap.fecha_apartado}:null,
    vTotalVivienda:cd.vTotalVivienda, vConstrAdic:cd.vConstrAdic, constrAdicDesc:cd.constrAdicDesc, constrAdicM2:cd.constrAdicM2,
    vLoteAdic:cd.vLoteAdic, loteAdicData:cd.loteAdicData?{...cd.loteAdicData, historial:undefined}:null,
    gastosCalc:cd.gastosCalc, vGastos:cd.vGastos, vTotalOp:cd.vTotalOp,
    apartado:cd.apartado, credito:cd.credito, descuento:cd.descuento, pagoAdic:cd.pagoAdic,
    vDesembolso:cd.vDesembolso, plazo:cd.plazo,
    pagares:(cd.pagares||[]).map(p=>({n:p.n, fecha:(p.fecha instanceof Date?p.fecha.toISOString():p.fecha), monto:p.monto})),
    fechaSnapshot:new Date().toISOString(),
  };
}

// Registrar un documento generado en el expediente del apartado
function registrarDocumento(apId, fn, label){
  const ap=DS.findOne('apartados',apId); if(!ap) return;
  const docs=(ap.documentos||[]).filter(d=>d.fn!==fn);
  docs.push({fn, label:label||DOC_LABELS[fn]||fn, fecha:new Date().toISOString(), usuario:CU.id});
  DS.update('apartados',apId,{documentos:docs});
}

// Reconstruir _cierreData desde el snapshot guardado y abrir el documento
function abrirDocumentoGuardado(apId, fn, pagoId){
  if(fn==='imprimirReciboPago'&&pagoId){ abrirReciboPagoDesdeFicha(apId,pagoId); return; }
  const ap=DS.findOne('apartados',apId);
  if(!ap||!ap.doc_snapshot){ toast('Este documento aún no tiene datos guardados','warn'); return; }
  const s=ap.doc_snapshot;
  if(fn==='imprimirPagares'&&!(s.pagares&&s.pagares.length)){ toast('Esta operación no tiene pagarés (contado)','warn'); return; }
  const prev=_cierreData;
  _cierreData={
    ap:{...ap}, p:DS.findOne('prospectos',ap.prospectoId)||null,
    l:s.l||getLote(ap.clave_lote)||{}, m:s.m||getMod(ap.modelo_id)||{},
    folio:s.folio, numCliente:s.numCliente, cliSnapshot:s.cli, asesorNombre:s.asesorNombre, formaPago:s.formaPago,
    vTotalVivienda:s.vTotalVivienda, vConstrAdic:s.vConstrAdic, constrAdicDesc:s.constrAdicDesc, constrAdicM2:s.constrAdicM2,
    vLoteAdic:s.vLoteAdic, loteAdicData:s.loteAdicData,
    gastosCalc:s.gastosCalc, vGastos:s.vGastos, vTotalOp:s.vTotalOp,
    apartado:s.apartado, credito:s.credito, descuento:s.descuento, pagoAdic:s.pagoAdic,
    vDesembolso:s.vDesembolso, plazo:s.plazo,
    pagares:(s.pagares||[]).map(p=>({...p, fecha:new Date(p.fecha)})),
  };
  try{ window[fn](); }catch(e){ console.error('Error abriendo documento',fn,e); toast('Error al generar el documento','err'); }
  _cierreData=prev;
}


/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/cierre-acciones.module.js
   Acciones del cierre: guardar, contrato firmado→venta, apertura de documentos, expediente en ficha.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// Contrato firmado: guarda el cierre completo, registra los documentos en el expediente y convierte a VENTA
function registrarVentaCierre(){
  if(!_cierreData) return;
  const curp=$('c-curp').value.trim();
  if(!guardarCierreCompleto(true)) return;
  if(!curp){ toast('Captura el CURP del cliente para cerrar la venta','err'); cierreTab(0); return; }
  DS.update('apartados',_cierreData.ap.id,{cierre_generado:true});
  Object.keys(DOC_LABELS).forEach(fn=>{
    if(fn==='imprimirPagares'&&!(_cierreData.pagares&&_cierreData.pagares.length)) return;
    registrarDocumento(_cierreData.ap.id, fn, DOC_LABELS[fn]);
  });
  const apId=_cierreData.ap.id;
  convertirVenta(apId);
  const ap2=DS.findOne('apartados',apId);
  if(ap2&&ap2.estatus==='Venta'){ closeM('m-cierre'); }
}

// Guardar todo el cierre (datos del cliente + snapshot) sin abrir documentos
function guardarCierreCompleto(silencioso){
  if(!_cierreData) return false;
  const nombre=$('c-nombre').value.trim();
  if(!nombre){ toast('Captura el nombre del cliente en la pestaña 1','err'); cierreTab(0); return false; }
  calcCierre();
  const snap=construirSnapshotCierre();
  DS.update('apartados',_cierreData.ap.id,{ datos_cierre:getClienteData(), doc_snapshot:snap, folio_recibo:parseInt(_cierreData.folio) });
  if(!silencioso) toast('Datos del cierre guardados ✓','ok');
  return true;
}

// Abrir un documento desde la ventana del cierre (guarda datos + snapshot + registra, luego abre)
function abrirDocCierre(fn){
  if(!_cierreData){ toast('Abre un cierre primero','err'); return; }
  const nombre=$('c-nombre').value.trim();
  if(!nombre){ toast('Captura el nombre del cliente en la pestaña 1','err'); cierreTab(0); return; }
  const curp=$('c-curp').value.trim();
  if(fn!=='imprimirReciboApartado'&&!curp){ toast('Captura el CURP del cliente','err'); cierreTab(0); return; }
  if(fn==='imprimirPagares'&&!(_cierreData.pagares&&_cierreData.pagares.length)){ toast('Esta operación no tiene pagarés (contado)','warn'); return; }
  calcCierre();
  const snap=construirSnapshotCierre();
  DS.update('apartados',_cierreData.ap.id,{ datos_cierre:getClienteData(), doc_snapshot:snap, folio_recibo:parseInt(_cierreData.folio), cierre_generado:true });
  _cierreData.ap.cierre_generado=true;
  registrarDocumento(_cierreData.ap.id, fn, DOC_LABELS[fn]);
  try{ window[fn](); }catch(e){ console.error('Error generando',fn,e); toast('Error al generar el documento','err'); return; }
  renderApartados();
}

// Sección "📁 Documentos" en la ficha del prospecto
function renderDocsProspecto(pid){
  const cont=$('det-docs-card'); if(!cont) return;
  const aps=DS.find('apartados').filter(a=>a.prospectoId===pid&&(a.documentos||[]).length);
  if(!aps.length){ cont.style.display='none'; cont.innerHTML=''; return; }
  cont.style.display='block';
  cont.innerHTML='<div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">📁 Documentos</div>'+
    aps.map(a=>{
      const docs=(a.documentos||[]).slice().sort((x,y)=>new Date(y.fecha)-new Date(x.fecha));
      return `<div style="margin-bottom:8px">
        <div style="font-size:11px;color:var(--t3);margin-bottom:6px">Lote ${a.clave_lote} · ${a.estatus}${a.folio_recibo?' · Folio '+String(a.folio_recibo).padStart(8,'0'):''}</div>
        ${docs.map(d=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--bd2)">
          <div style="min-width:0"><div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📄 ${d.label}</div><div style="font-size:10.5px;color:var(--t3)">${fD(d.fecha)}</div></div>
          <button class="btn btn-out btn-xs" style="flex-shrink:0" onclick="abrirDocumentoGuardado('${a.id}','${d.fn}','${d.pagoId||''}')">⬇ Abrir</button>
        </div>`).join('')}
      </div>`;
    }).join('');
}

// Cola de documentos pendientes por generar — se abren uno a la vez con clic real
// del usuario, para que el navegador nunca los bloquee como ventanas emergentes.

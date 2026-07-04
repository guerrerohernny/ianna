/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/cobranza.module.js
   Módulo Cobranza: pagos, recibos con folio, alerta de efectivo LFPIORPI (8,025 UMA), modo consulta.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ════════════════════════════════════════════════════════════════
// COBRANZA — pagos de enganche con recibo, y alerta de efectivo LFPIORPI
// ════════════════════════════════════════════════════════════════
function _cobDatos(){
  const ap=DS.findOne('apartados',_cierreData.ap.id)||_cierreData.ap;
  const pagos=ap.pagos||[];
  const aportado=(ap.monto_enganche||0)+pagos.reduce((s,p)=>s+(p.monto||0),0);
  // Efectivo: apartado inicial (si su método fue efectivo) + pagos en efectivo
  const efectivo=(ap.metodo_pago==='Efectivo'?(ap.monto_enganche||0):0)+pagos.filter(p=>p.metodo==='Efectivo').reduce((s,p)=>s+(p.monto||0),0);
  const P=getP();
  const topeEfectivo=8025*(P.uma_diaria||117.31);
  const vTotalOp=_cierreData.vTotalOp||ap.total_operacion||0;
  const descuento=_cierreData.descuento||0, credito=_cierreData.credito||0;
  const pendiente=Math.max(0, vTotalOp-descuento-credito-aportado);
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const vencidos=(_cierreData.pagares||[]).filter(p=>p.fecha<hoy);
  return {ap,pagos,aportado,efectivo,topeEfectivo,vTotalOp,pendiente,vencidos};
}
function renderCobranza(){
  if(!_cierreData) return;
  const d=_cobDatos();
  if(!$('cob-fecha').value) $('cob-fecha').value=new Date().toISOString().split('T')[0];
  $('cob-kpis').innerHTML=[
    {lbl:'Total operación',val:mxn(d.vTotalOp),bg:'#f1f5f9',fg:'#0f172a'},
    {lbl:'Aportado (apartado + pagos)',val:mxn(d.aportado),bg:'#d1fae5',fg:'#065f46'},
    {lbl:'Pendiente',val:mxn(d.pendiente),bg:'#fef9c3',fg:'#854d0e'},
    {lbl:'Pagarés vencidos',val:d.vencidos.length+(d.vencidos.length?' — '+mxn(d.vencidos.reduce((s,p)=>s+p.monto,0)):''),bg:d.vencidos.length?'#fee2e2':'#f1f5f9',fg:d.vencidos.length?'#991b1b':'#0f172a'},
  ].map(k=>`<div style="background:${k.bg};color:${k.fg};border-radius:8px;padding:10px 12px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;opacity:.75">${k.lbl}</div><div style="font-size:16px;font-weight:800;margin-top:2px">${k.val}</div></div>`).join('');
  // Alerta de efectivo (8,025 UMA — LFPIORPI)
  const pct=d.topeEfectivo>0?Math.min(100,Math.round(d.efectivo/d.topeEfectivo*100)):0;
  const nivel=d.efectivo>=d.topeEfectivo?'rojo':(pct>=70?'ambar':'ok');
  const col=nivel==='rojo'?{bg:'#fee2e2',bd:'#fecaca',fg:'#991b1b',bar:'#dc2626'}:nivel==='ambar'?{bg:'#fef3c7',bd:'#fde68a',fg:'#92400e',bar:'#f59e0b'}:{bg:'#f0fdf4',bd:'#bbf7d0',fg:'#166534',bar:'#16a34a'};
  $('cob-efectivo').innerHTML=`<div style="background:${col.bg};border:1px solid ${col.bd};border-radius:8px;padding:12px 14px">
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:${col.fg}">
      <div><b>💵 Efectivo recibido:</b> ${mxn(d.efectivo)} de ${mxn(d.topeEfectivo)} permitidos (8,025 UMA — LFPIORPI)</div>
      <div style="font-weight:800">${pct}%</div>
    </div>
    <div style="background:rgba(0,0,0,.08);border-radius:20px;height:8px;margin-top:8px;overflow:hidden"><div style="background:${col.bar};height:100%;width:${pct}%;border-radius:20px;transition:width .4s"></div></div>
    ${nivel==='rojo'?'<div style="font-size:12px;font-weight:700;color:#991b1b;margin-top:6px">⚠️ LÍMITE LFPIORPI EXCEDIDO — no se puede recibir más efectivo por esta operación</div>':nivel==='ambar'?'<div style="font-size:11.5px;color:#92400e;margin-top:6px">⚠️ Advertencia: te acercas al tope legal de efectivo para esta operación</div>':''}
  </div>`;
  // Lista de pagos
  $('cob-lista').innerHTML=!d.pagos.length
    ?'<div style="padding:20px;text-align:center;color:var(--t3);font-size:13px">Sin pagos registrados aún — el apartado inicial ('+mxn(d.ap.monto_enganche||0)+' · '+(d.ap.metodo_pago||'Transferencia')+') ya cuenta como aportado.</div>'
    :`<table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead><tr style="background:var(--s2)">${['Fecha','Concepto','Método','Monto','Folio',''].map(h=>`<th style="padding:8px 12px;text-align:left;font-size:10.5px;color:var(--t3);text-transform:uppercase">${h}</th>`).join('')}</tr></thead>
      <tbody>${d.pagos.slice().sort((a,b)=>new Date(b.fecha)-new Date(a.fecha)).map(p=>`<tr style="border-bottom:1px solid var(--s2)">
        <td style="padding:9px 12px">${new Date(p.fecha+'T12:00:00').toLocaleDateString('es-MX')}</td>
        <td style="padding:9px 12px">${p.concepto}</td>
        <td style="padding:9px 12px">${p.metodo==='Efectivo'?'💵 ':''}${p.metodo}</td>
        <td style="padding:9px 12px;font-weight:700">${mxn(p.monto)}</td>
        <td style="padding:9px 12px">${String(p.folio).padStart(8,'0')}</td>
        <td style="padding:9px 12px"><button class="btn btn-out btn-xs" onclick="reabrirReciboPago('${d.ap.id}','${p.id}')">🧾 Recibo</button></td>
      </tr>`).join('')}</tbody></table>`;
}
function registrarPagoCobranza(){
  if(!_cierreData) return;
  const monto=parseMoneyInput($('cob-monto').value);
  const fecha=$('cob-fecha').value;
  const metodo=$('cob-metodo').value;
  const concepto=$('cob-concepto').value;
  if(!monto||monto<=0){ toast('Captura el monto del pago','err'); return; }
  if(!fecha){ toast('Captura la fecha del pago','err'); return; }
  const d=_cobDatos();
  if(metodo==='Efectivo'&&(d.efectivo+monto)>d.topeEfectivo){
    if(!confirm(`⚠️ ALERTA LFPIORPI\n\nCon este pago el efectivo acumulado sería ${mxn(d.efectivo+monto)}, superando el tope legal de ${mxn(d.topeEfectivo)} (8,025 UMA).\n\nRecibir este efectivo implica sanciones conforme a la ley.\n\n¿Registrar de todas formas?`)) return;
  }
  const folio=IANNA_FOLIOS.emitir('pago', _cierreData.ap.id);
  const pago={id:'pg'+Date.now(), fecha, monto, metodo, concepto, folio:parseInt(folio), usuario:CU.id, registrado:new Date().toISOString()};
  const ap=DS.findOne('apartados',_cierreData.ap.id);
  const pagos=[...(ap.pagos||[]),pago];
  // Asegurar snapshot del cliente para poder regenerar el recibo desde la ficha
  let snap=ap.doc_snapshot;
  if(!snap){ snap=construirSnapshotCierre(); }
  DS.update('apartados',_cierreData.ap.id,{pagos, doc_snapshot:snap});
  _cierreData.ap.pagos=pagos;
  // Registrar en expediente
  const docs=(ap.documentos||[]).filter(x=>x.pagoId!==pago.id);
  docs.push({fn:'imprimirReciboPago', pagoId:pago.id, label:`Recibo de ${concepto} — ${mxn(monto)}`, fecha:new Date().toISOString(), usuario:CU.id});
  DS.update('apartados',_cierreData.ap.id,{documentos:docs});
  // Abrir recibo (mismo gesto de clic → sin bloqueo de popup)
  _cierreData.pagoActual=pago;
  imprimirReciboPago();
  _cierreData.pagoActual=null;
  $('cob-monto').value='';
  renderCobranza();
  IANNA_MOTOR.auditar('apartados', _cierreData.ap.id, 'REGISTRAR_PAGO', {}, {monto:pago.monto, metodo:pago.metodo, concepto:pago.concepto, folio:pago.folio}, 'Pago de cobranza con recibo');
  toast(`Pago registrado — Recibo folio ${String(pago.folio).padStart(8,'0')} ✓`,'ok');
}
function reabrirReciboPago(apId,pagoId){
  const ap=DS.findOne('apartados',apId); if(!ap) return;
  const pago=(ap.pagos||[]).find(p=>p.id===pagoId); if(!pago){ toast('Pago no encontrado','err'); return; }
  if(_cierreData&&_cierreData.ap.id===apId){
    _cierreData.pagoActual=pago; imprimirReciboPago(); _cierreData.pagoActual=null; return;
  }
  abrirReciboPagoDesdeFicha(apId,pagoId);
}
function abrirReciboPagoDesdeFicha(apId,pagoId){
  const ap=DS.findOne('apartados',apId); if(!ap||!ap.doc_snapshot) return;
  const pago=(ap.pagos||[]).find(p=>p.id===pagoId); if(!pago) return;
  const s=ap.doc_snapshot; const prev=_cierreData;
  _cierreData={ap:{...ap}, l:s.l||getLote(ap.clave_lote)||{}, m:s.m||{}, folio:pago.folio,
    numCliente:s.numCliente, cliSnapshot:s.cli, asesorNombre:s.asesorNombre, formaPago:s.formaPago, pagoActual:pago};
  try{ imprimirReciboPago(); }catch(e){ console.error(e); toast('Error al generar el recibo','err'); }
  _cierreData=prev;
}
// Recibo de pago de cobranza — mismo formato del recibo oficial, concepto y método del pago
function imprimirReciboPago(){
  if(!_cierreData||!_cierreData.pagoActual) return;
  const {l} = _cierreData;
  const pago=_cierreData.pagoActual;
  const cli = getClienteData();
  const hoy = new Date(pago.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  const monto = pago.monto;
  const montoPalabras = numToLetras(monto);
  const CONC=['APARTADO','ENGANCHE','MENSUALIDAD','INTERÉS MORATORIO'];
  const sel=(pago.concepto||'').toUpperCase()==='INTERÉS MORATORIO'?'INTERÉS MORATORIO':(pago.concepto||'').toUpperCase();
  const esInteres=sel==='INTERÉS MORATORIO';
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Recibo ${String(pago.folio).padStart(8,'0')}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#1a1a1a}
  .marco{border:2px solid #1E3D0F;border-radius:10px;padding:18px 22px;max-width:820px;margin:0 auto}
  table{width:100%;border-collapse:collapse}td{padding:4px 6px;vertical-align:top}
  .sep{border-top:1px solid #94a3b8;margin:9px 0}
  .concepto-box{display:flex;gap:18px;margin-top:6px}
  .concepto-box label{display:flex;align-items:center;gap:6px;font-size:11.5px}
  .chk{width:13px;height:13px;border:1.5px solid #333;display:inline-block;border-radius:2px}
  .chk{position:relative}.chk.sel{background:#1E3D0F;print-color-adjust:exact;-webkit-print-color-adjust:exact}.chk.sel::after{content:'✕';position:absolute;left:0;right:0;top:-2px;text-align:center;color:#1E3D0F;font-weight:900;font-size:11px;line-height:15px;text-shadow:0 0 2px #fff,0 0 2px #fff}
  .firma{border-top:1.5px solid #333;margin-top:44px;padding-top:5px;text-align:center;font-size:10.5px;font-weight:700}
  @media print{button{display:none!important}@page{size:letter;margin:10mm}}</style></head><body>
  <div class="marco">
    <table style="margin-bottom:8px"><tr>
      <td style="width:130px"><img src="${VA_LOGO}" style="height:52px"></td>
      <td style="text-align:center"><div style="font-weight:800;font-size:15px;color:#1E3D0F">DESARROLLADORA PALIZ</div>
        <div style="font-size:10.5px">BLVD. FRANCISCO I. MADERO #1051 COL. CENTRO C.P. 80000<br>CULIACÁN, SINALOA</div></td>
      <td style="width:160px"><div style="border:1.5px solid #1E3D0F;border-radius:6px;padding:6px 10px;text-align:right">
        <div style="font-size:10px;font-weight:700">FOLIO</div>
        <div style="font-size:11px;font-weight:700">No. ${String(pago.folio).padStart(8,'0')}</div>
        <div style="font-size:13px;font-weight:800;color:#C9963C">$ ${mxn(monto).replace('$','')}</div></div></td>
    </tr></table>
    <table>
      <tr><td><b>DESARROLLO:</b> VALLE DE ARAGÓN</td><td><b>MANZANA:</b> ${l.mz}</td><td><b>LOTE:</b> ${l.lote}</td></tr>
      <tr><td colspan="3"><b>RECIBIMOS DE:</b> ${cli.numCliente} &nbsp; ${(cli.nombre||'').toUpperCase()}</td></tr>
      <tr><td colspan="3"><b>LA CANTIDAD DE:</b> <span style="font-size:14px;font-weight:800;color:#1E3D0F">$ ${mxn(monto).replace('$','')}</span></td></tr>
      <tr><td colspan="3"><b>(${montoPalabras})</b></td></tr>
    </table>
    <div class="sep"></div>
    <div><b>POR CONCEPTO DE:</b>
      <div class="concepto-box">
        ${CONC.map(c=>`<label><span class="chk ${c===sel?'sel':''}"></span>${c}</label>`).join('')}
      </div>
    </div>
    <div style="margin-top:6px"><b>OBSERVACIONES:</b> &nbsp;</div>
    <div class="sep"></div>
    <div><b>DISTRIBUCIÓN DEL PAGO:</b> &nbsp; Pago a Capital: ${esInteres?'0.00':mxn(monto).replace('$','')} &nbsp;&nbsp; Interés Moratorio: ${esInteres?mxn(monto).replace('$',''):'0.00'}</div>
    <div style="margin-top:6px"><b>Forma de pago:</b> ${FORMA_PAGO_TXT[pago.metodo]||pago.metodo}</div>
    <div class="sep"></div>
    <div style="text-align:right;font-size:11px">ADMINISTRACIÓN</div>
    <table style="margin-top:30px"><tr>
      <td style="width:45%"><div class="firma">ELABORÓ</div></td><td></td>
      <td style="width:45%;text-align:center"><div style="font-size:11px;font-weight:700;margin-top:44px;border-top:1.5px solid #333;padding-top:5px">CULIACÁN, SINALOA &nbsp; ${hoy}</div></td>
    </tr></table>
  </div>
  <button onclick="window.print()" style="margin:14px auto;display:block;padding:8px 20px;background:#1E3D0F;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Imprimir</button>
  </body></html>`);
  win.document.close();
}
// ── Modo consulta para ventas cerradas ──
function setCierreLock(locked){
  ['cierre-tab-0','cierre-tab-1'].forEach(tid=>{
    const tab=$(tid); if(!tab||!tab.querySelectorAll) return;
    tab.querySelectorAll('input,select,textarea').forEach(el=>{ el.disabled=locked; });
    tab.querySelectorAll('button').forEach(b=>{
      const oc=b.getAttribute&&b.getAttribute('onclick')||'';
      if(oc.includes('guardar')) b.style.display=locked?'none':'';
    });
  });
  // Tab 3 (vista previa): en modo consulta ocultar Guardar y el botón de registrar venta (ya vendido)
  const esVenta=_cierreData&&_cierreData.ap&&DS.findOne('apartados',_cierreData.ap.id)?.estatus==='Venta';
  const btnVenta=$('btn-descargar-cierre');
  if(btnVenta) btnVenta.style.display=(locked||esVenta)?'none':'';
  const tab2=$('cierre-tab-2');
  if(tab2&&tab2.querySelectorAll) tab2.querySelectorAll('button').forEach(b=>{
    const oc=b.getAttribute&&b.getAttribute('onclick')||'';
    if(oc.includes('guardarCierreCompleto')) b.style.display=locked?'none':'';
  });
  const unlockBtn=$('btn-cierre-unlock');
  if(unlockBtn) unlockBtn.style.display=locked?'inline-flex':'none';
  window._cierreLocked=locked;
  if(!locked){
    const apLock=_cierreData&&DS.findOne('apartados',_cierreData.ap.id);
    if(apLock&&apLock.estatus==='Venta') IANNA_MOTOR.auditar('apartados', apLock.id, 'CORRECCION_ADMINISTRATIVA_DESBLOQUEO', {}, {}, 'Edición habilitada sobre venta cerrada');
    toast('Edición habilitada — puedes modificar y guardar','ok');
  }
}
function abrirCobranzaVenta(aid){
  generarCierre(aid);
  setCierreLock(true);
  cierreTab(3);
}


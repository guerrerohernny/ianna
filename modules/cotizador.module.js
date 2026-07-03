/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/cotizador.module.js
   Módulo Cotizador (simulador).
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ════════════════════════════════════════════════════════════════
// COTIZADOR — inicialización de la página
// ════════════════════════════════════════════════════════════════
function renderCotizador(){
  const P=getP();
  // Fecha de hoy por defecto
  if($('cot-fecha')&&!$('cot-fecha').value) $('cot-fecha').value=new Date().toISOString().split('T')[0];
  // Poblar select de manzana (ya viene fijo en el HTML) — poblar lotes según manzana actual
  onCotMzChange();
  // Poblar prospectos
  const prs=DS.find('prospectos');
  if($('cot-prosp')) $('cot-prosp').innerHTML='<option value="">— Selecciona o escribe nombre —</option>'+prs.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('');
  // Precio accesorio por defecto desde parámetros
  if($('cot-ca-pm2')) $('cot-ca-pm2').value=P.precio_m2_lote_adicional||13000;
  if(typeof calcCotizador==='function') calcCotizador();
}
function onCotMzChange(){
  const mz=$('cot-mz')?.value||'';
  const lotesDisponibles=(DS.db.inventario||[]).filter(l=>{
    if(mz&&String(l.mz)!==mz) return false;
    return ['Disponible','Entrega Rápida','Lote Especial'].includes(l.estado_display||l.estado);
  });
  if($('cot-lote')) $('cot-lote').innerHTML='<option value="">—</option>'+lotesDisponibles.map(l=>`<option value="${l.clave}">${l.clave} — Mz${l.mz} Lt${l.lote} (${f3(l.terreno)}m²)</option>`).join('');
  $('cot-lote-info').style.display='none';
  onCotModeloMzFilter();
  if(typeof calcCotizador==='function') calcCotizador();
}
function onCotModeloMzFilter(){
  const mz=$('cot-mz')?.value||'';
  const mods=DS.getModelos().filter(m=>m.activo&&m.id!=='SOLO_TERRENO');
  if(!$('cot-modelo')) return;
  $('cot-modelo').innerHTML='<option value="">— Selecciona —</option>'+mods.map(m=>{
    const blocked=m.id==='MORELLO'&&mz&&mz!=='10';
    return `<option value="${m.id}" ${blocked?'disabled':''}>${m.nombre}${blocked?' (Solo Manzana 10)':''}</option>`;
  }).join('');
}
function onCotLoteChange(){
  const clave=$('cot-lote')?.value;
  const l=clave?getLote(clave):null;
  if(!l){ $('cot-lote-info').style.display='none'; if(typeof calcCotizador==='function') calcCotizador(); return; }
  // Si el lote tiene manzana diferente al filtro, ajustar filtro de modelo
  if($('cot-mz') && String(l.mz)!==$('cot-mz').value){ $('cot-mz').value=String(l.mz); onCotModeloMzFilter(); }
  $('cot-lote-info').style.display='block';
  $('cot-lote-info').innerHTML=`<b>${l.clave}</b> — Mz ${l.mz} Lote ${l.lote} · Terreno ${f3(l.terreno)}m² · Excedente ${f3(l.excedente)}m²${l.fraccion_fusionada?' · <span style="color:#7c3aed">Fracción fusionada '+f3(l.fraccion_m2_adicional||0)+'m²</span>':''}${l.plusvalia?' · Plusvalía '+mxn(l.plusvalia):''}`;
  if(typeof calcCotizador==='function') calcCotizador();
}
function onCotModeloChange(){
  const mid=$('cot-modelo')?.value;
  const m=mid?getMod(mid):null;
  if(!m){ $('cot-modelo-info').style.display='none'; if(typeof calcCotizador==='function') calcCotizador(); return; }
  $('cot-modelo-info').style.display='block';
  $('cot-modelo-info').innerHTML=`<b>${m.nombre}</b> — ${mxn(m.precio)} · ${m.construccion||'—'}m² construcción · ${m.recamaras||'—'} rec. · ${m.banos||'—'} baños`;
  if(typeof calcCotizador==='function') calcCotizador();
}
function onCotProspChange(){
  const pid=$('cot-prosp')?.value;
  if(pid){
    const p=DS.findOne('prospectos',pid);
    if(p&&$('cot-nm')) $('cot-nm').value=p.nombre;
  }
  if(typeof calcCotizador==='function') calcCotizador();
}

let _cotActual=null; // contexto de la cotización calculada actualmente
function calcCotizador(){
  const clave=$('cot-lote')?.value;
  const mid=$('cot-modelo')?.value;
  const l=clave?getLote(clave):null;
  const m=mid?getMod(mid):null;
  if(!l||!m){
    if($('cot-resultado-wrap')) $('cot-resultado-wrap').style.display='none';
    if($('cot-placeholder')) $('cot-placeholder').style.display='';
    return;
  }
  const P=getP();
  const pExc=P.precio_m2_exc||9000;
  const pFracParam=P.precio_m2_lote_adicional||13000;

  const vCasa=m.precio||0;
  const vExc=(l.excedente||0)*pExc;
  const fracM2=l.fraccion_fusionada?(l.fraccion_m2_adicional||0):0;
  const pFracLote=l.fraccion_precio_m2||pFracParam;
  const vFrac=fracM2*pFracLote;
  const caM2=parseFloat($('cot-ca-m2')?.value)||0;
  const caPM2=parseFloat($('cot-ca-pm2')?.value)||pFracParam;
  const caDesc=$('cot-ca-desc')?.value.trim()||'';
  const vAccesorios=caM2*caPM2;
  const excConstrM2=parseFloat($('cot-exc-constr-m2')?.value)||0;
  const excConstrPM2=parseFloat($('cot-exc-constr-pm2')?.value)||0;
  const vExcConstr=excConstrM2*excConstrPM2;
  const vPlus=l.plusvalia||0;
  const vTotalVivienda=vCasa+vExc+vFrac+vAccesorios+vExcConstr+vPlus;

  const credito=parseMoneyInput($('cot-credito')?.value);
  const gastosParam=P.gastos_operacion||MASTER_PARAMS.gastos_operacion;
  const gastosCalc=(gastosParam||[]).filter(g=>g.activo).map(g=>{
    let monto=0;
    if(g.tipo==='fijo') monto=g.valor;
    else if(g.tipo==='pct_vivienda') monto=vTotalVivienda*g.valor;
    else if(g.tipo==='pct_credito') monto=credito*g.valor;
    return {...g,monto};
  });
  const vGastos=gastosCalc.reduce((s,g)=>s+g.monto,0);
  const vTotalOp=vTotalVivienda+vGastos;

  const apartado=parseMoneyInput($('cot-apartado-val')?.value);
  const descuento=parseMoneyInput($('cot-descuento')?.value);
  const pagoAdic=parseMoneyInput($('cot-pago-adic')?.value);
  const vDesembolso=vTotalOp-apartado-descuento-pagoAdic-credito;

  const nPagos=parseInt($('cot-mensualidades')?.value)||0;
  let calendario=[];
  if(nPagos>0&&vDesembolso>0){
    const base=Math.floor(vDesembolso/nPagos);
    const ultimo=vDesembolso-base*(nPagos-1);
    const fechaBase=$('cot-fecha-inicio')?.value?new Date($('cot-fecha-inicio').value+'T12:00:00'):new Date();
    calendario=Array.from({length:nPagos},(_,i)=>{
      const d=new Date(fechaBase); d.setMonth(d.getMonth()+i);
      return {n:i+1,fecha:d,monto:i===nPagos-1?ultimo:base};
    });
  }

  // ── Render ──
  if($('cot-placeholder')) $('cot-placeholder').style.display='none';
  if($('cot-resultado-wrap')) $('cot-resultado-wrap').style.display='block';
  if($('cot-hdr-fecha')) $('cot-hdr-fecha').textContent=$('cot-fecha')?.value?fD($('cot-fecha').value):fD(new Date().toISOString());

  if($('cot-banner-info')){
    $('cot-banner-info').innerHTML=[
      ['Lote',l.clave],['Manzana',l.mz],['Terreno',f3(l.terreno)+'m²'],['Modelo',m.nombre]
    ].map(r=>`<div style="font-size:11px"><div style="color:var(--t3);font-size:9.5px;text-transform:uppercase">${r[0]}</div><div style="font-weight:700;color:#fff">${r[1]}</div></div>`).join('');
  }

  const rows=[
    ['Valor vivienda — '+m.nombre,vCasa],
    ...(l.excedente>0?[['Terreno excedente ('+f3(l.excedente)+'m²)',vExc]]:[]),
    ...(fracM2>0?[['Fracción fusionada ('+f3(fracM2)+'m²)',vFrac]]:[]),
    ...(vAccesorios>0?[['Accesorios'+(caDesc?' — '+caDesc:'')+' ('+f3(caM2)+'m²)',vAccesorios]]:[]),
    ...(vExcConstr>0?[['Construcción excedente ('+f3(excConstrM2)+'m²)',vExcConstr]]:[]),
    ...(vPlus>0?[['Plusvalía — '+l.tipo,vPlus]]:[]),
  ];
  let bodyHtml=rows.map(r=>`<tr><td style="padding:6px 14px">${r[0]}</td><td></td><td style="text-align:right;padding:6px 14px">${mxn(r[1])}</td><td></td></tr>`).join('');
  bodyHtml+=`<tr style="background:var(--s2);font-weight:700"><td style="padding:6px 14px">VALOR TOTAL DE LA VIVIENDA</td><td></td><td style="text-align:right;padding:6px 14px">${mxn(vTotalVivienda)}</td><td></td></tr>`;
  bodyHtml+=gastosCalc.map(g=>`<tr><td style="padding:6px 14px;color:#92400e">${g.nombre}</td><td></td><td style="text-align:right;padding:6px 14px">${mxn(g.monto)}</td><td></td></tr>`).join('');
  bodyHtml+=`<tr style="background:var(--s2);font-weight:700"><td style="padding:6px 14px">TOTAL GASTOS DE OPERACIÓN</td><td></td><td style="text-align:right;padding:6px 14px">${mxn(vGastos)}</td><td></td></tr>`;
  bodyHtml+=`<tr style="background:var(--navy);color:#fff;font-weight:700"><td style="padding:8px 14px">VALOR TOTAL DE LA OPERACIÓN</td><td></td><td style="text-align:right;padding:8px 14px">${mxn(vTotalOp)}</td><td></td></tr>`;
  if(apartado>0) bodyHtml+=`<tr><td style="padding:6px 14px">Apartado</td><td></td><td style="text-align:right;padding:6px 14px;color:#dc2626">− ${mxn(apartado)}</td><td></td></tr>`;
  if(descuento>0) bodyHtml+=`<tr><td style="padding:6px 14px">Descuento</td><td></td><td style="text-align:right;padding:6px 14px;color:#dc2626">− ${mxn(descuento)}</td><td></td></tr>`;
  if(pagoAdic>0) bodyHtml+=`<tr><td style="padding:6px 14px">Pago adicional</td><td></td><td style="text-align:right;padding:6px 14px;color:#dc2626">− ${mxn(pagoAdic)}</td><td></td></tr>`;
  if(credito>0) bodyHtml+=`<tr><td style="padding:6px 14px">Crédito</td><td></td><td style="text-align:right;padding:6px 14px;color:#dc2626">− ${mxn(credito)}</td><td></td></tr>`;
  bodyHtml+=`<tr style="background:var(--gold);color:#fff;font-weight:700"><td style="padding:8px 14px">MONTO A PAGAR</td><td></td><td style="text-align:right;padding:8px 14px">${mxn(Math.max(0,vDesembolso))}</td><td></td></tr>`;
  if($('cot-tabla-body')) $('cot-tabla-body').innerHTML=bodyHtml;

  if(calendario.length>0){
    if($('cot-pagos-section')) $('cot-pagos-section').style.display='block';
    if($('cot-pagos-body')) $('cot-pagos-body').innerHTML=calendario.map(p=>`<tr><td style="padding:5px 14px">${p.n}/${nPagos}</td><td style="padding:5px 14px">${p.fecha.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'})}</td><td style="text-align:right;padding:5px 14px;font-weight:600">${mxn(p.monto)}</td></tr>`).join('');
  } else {
    if($('cot-pagos-section')) $('cot-pagos-section').style.display='none';
  }

  const comentarios=$('cot-comentarios')?.value.trim()||'';
  if(comentarios){
    if($('cot-coment-section')){ $('cot-coment-section').style.display='block'; $('cot-coment-section').textContent='💬 '+comentarios; }
  } else if($('cot-coment-section')) $('cot-coment-section').style.display='none';

  if($('cot-firma-asesor')) $('cot-firma-asesor').textContent=CU.nombre;
  if($('cot-firma-gerente')) $('cot-firma-gerente').textContent=(DS.find('usuarios',{rol:'gerente'})[0]||{}).nombre||'Gerente de Ventas';
  if($('cot-firma-cliente')) $('cot-firma-cliente').textContent=$('cot-nm')?.value||'';

  _cotActual={l,m,vCasa,vExc,vFrac,vAccesorios,vExcConstr,vPlus,vTotalVivienda,gastosCalc,vGastos,vTotalOp,apartado,descuento,pagoAdic,credito,vDesembolso,calendario,nPagos,comentarios};
}

function guardarCotizacion(){
  if(!_cotActual){ toast('Genera una cotización primero','err'); return; }
  const c=_cotActual;
  const cot={
    id:'cot_'+Date.now(),
    prospectoId:$('cot-prosp')?.value||'',
    nombreCliente:$('cot-nm')?.value||'',
    claveLote:c.l.clave,
    modeloId:c.m.id,
    vTotalVivienda:c.vTotalVivienda,
    vTotalOp:c.vTotalOp,
    vDesembolso:c.vDesembolso,
    fecha:new Date().toISOString(),
    usuario:CU.id,
    version:1,
  };
  if(!DS.db.cotizaciones) DS.db.cotizaciones=[];
  // Versionado: si ya existe cotización para este prospecto+lote, incrementar versión
  const previas=DS.db.cotizaciones.filter(x=>x.prospectoId===cot.prospectoId&&x.claveLote===cot.claveLote);
  cot.version=previas.length+1;
  DS.db.cotizaciones.push(cot);
  DS._save(DS.db);
  toast('Cotización guardada (v'+cot.version+') ✓','ok');
}

function imprimirCotizacion(){
  if(!_cotActual){ toast('Genera una cotización primero','err'); return; }
  const c=_cotActual;
  const nombreCliente=$('cot-nm')?.value||'Cliente';
  const win=window.open('','_blank');
  const filas=[
    ['Valor vivienda — '+c.m.nombre,c.vCasa],
    ...(c.vExc>0?[['Terreno excedente',c.vExc]]:[]),
    ...(c.vFrac>0?[['Fracción fusionada',c.vFrac]]:[]),
    ...(c.vAccesorios>0?[['Accesorios',c.vAccesorios]]:[]),
    ...(c.vExcConstr>0?[['Construcción excedente',c.vExcConstr]]:[]),
    ...(c.vPlus>0?[['Plusvalía',c.vPlus]]:[]),
  ];
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cotización ${c.l.clave}</title>
  <style>body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#1a1a1a}
  table{width:100%;border-collapse:collapse;margin-bottom:10px}td,th{padding:6px 10px;border-bottom:1px solid #eee}
  .tot{background:#1E3D0F;color:#fff;font-weight:700}.gold{background:#C9963C;color:#fff;font-weight:700}
  @media print{button{display:none!important}@page{size:letter;margin:10mm}}</style></head><body>
  <h2 style="color:#1E3D0F">Cotización — Valle de Aragón</h2>
  <p><b>Cliente:</b> ${nombreCliente} &nbsp; <b>Lote:</b> ${c.l.clave} &nbsp; <b>Modelo:</b> ${c.m.nombre}</p>
  <table>${filas.map(f=>`<tr><td>${f[0]}</td><td style="text-align:right">${mxn(f[1])}</td></tr>`).join('')}
  <tr class="tot"><td>VALOR TOTAL VIVIENDA</td><td style="text-align:right">${mxn(c.vTotalVivienda)}</td></tr>
  ${c.gastosCalc.map(g=>`<tr><td>${g.nombre}</td><td style="text-align:right">${mxn(g.monto)}</td></tr>`).join('')}
  <tr class="tot"><td>TOTAL OPERACIÓN</td><td style="text-align:right">${mxn(c.vTotalOp)}</td></tr>
  <tr class="gold"><td>MONTO A PAGAR</td><td style="text-align:right">${mxn(Math.max(0,c.vDesembolso))}</td></tr>
  </table>
  <button onclick="window.print()" style="padding:8px 20px;background:#1E3D0F;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Imprimir</button>
  </body></html>`);
  win.document.close();
}

function openHistorialCotizaciones(){
  const cots=(DS.db.cotizaciones||[]).slice().reverse();
  if(cots.length===0){ toast('Sin cotizaciones guardadas aún','warn'); return; }
  const lista=cots.slice(0,10).map(c=>`${fD(c.fecha)} — ${c.nombreCliente||'Sin nombre'} — Lote ${c.claveLote} — v${c.version} — ${mxn(c.vTotalOp)}`).join('\n');
  alert('Historial de cotizaciones recientes:\n\n'+lista);
}


/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/cierre.module.js
   Módulo Cierre: captura de cliente, corrida financiera, pagarés, vista previa.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ════════════════════════════════════════════════════════════════
// GENERAR CIERRE
// ════════════════════════════════════════════════════════════════
let _cierreData = null; // stores current cierre context

function generarCierre(aid){
  const ap = DS.findOne('apartados', aid);
  if(!ap){ toast('Apartado no encontrado','err'); return; }
  const l = getLote(ap.clave_lote);
  const m = getMod(ap.modelo_id);
  const p = DS.findOne('prospectos', ap.prospectoId);
  if(!l||!m){ toast('Datos del lote o modelo incompletos','err'); return; }

  // Verify dirección oficial
  if(!l.dir_oficial){
    const dir = prompt(`El lote ${ap.clave_lote} no tiene dirección oficial.\nCaptura la dirección oficial:`);
    if(!dir){ toast('Se requiere la dirección oficial para generar el cierre','err'); return; }
    const li = DS.db.inventario.findIndex(x=>x.clave===ap.clave_lote);
    if(li>=0){ DS.db.inventario[li].dir_oficial = dir.trim(); DS._save(DS.db); }
    l.dir_oficial = dir.trim();
  }

  // Generate or get numero de cliente
  const numCliente = getOrCreateNumCliente(ap.prospectoId);

  // Folio del recibo: si el apartado YA tiene folio, se reutiliza SIEMPRE
  // (reabrir un cierre jamás cambia el folio de un documento emitido).
  const folio = ap.folio_recibo ? String(ap.folio_recibo).padStart(8,'0') : getNextFolio();

  // Store context
  _cierreData = {ap, l, m, p, numCliente, folio, asesorNombre:(getUser(ap.asesor)?.nombre)||CU.nombre, formaPago:(FORMA_PAGO_TXT[ap.metodo_pago]||ap.metodo_pago||null)};

  // Mapear estado civil del prospecto al formato del cierre ("Casado" → "Casado(a)")
  const ECMAP={'Soltero':'Soltero(a)','Casado':'Casado(a)','Divorciado':'Divorciado','Viudo':'Viudo(a)','Unión libre':'Unión libre'};
  const estadoCivilProspecto = p?.estadoCivil ? (ECMAP[p.estadoCivil]||p.estadoCivil) : 'Soltero(a)';

  // Pre-fill client data from prospecto
  const _ecMap={'Soltero':'Soltero(a)','Casado':'Casado(a)','Divorciado':'Divorciado','Viudo':'Viudo(a)','Unión libre':'Unión libre'};
  if(p){
    $('c-nombre').value = p.nombre||'';
    $('c-cel').value = p.telefono||'';
    $('c-email').value = p.correo||'';
    $('c-estado-civil').value = _ecMap[p.estadoCivil]||p.estadoCivil||'Soltero(a)';
  }
  $('c-num-cliente').value = numCliente;
  $('c-ciudad').value = 'Culiacán';
  $('c-municipio').value = 'Culiacán';
  $('c-nacionalidad').value = 'Mexicana';
  $('prev-folio').textContent = folio;

  // Si ya existe un cierre previo guardado para este apartado, restaurar TODOS los campos
  const dc = ap.datos_cierre;
  if(dc){
    $('c-nombre').value = dc.nombre||$('c-nombre').value;
    $('c-curp').value = dc.curp||'';
    $('c-rfc').value = dc.rfc||'';
    $('c-nacimiento').value = dc.nacimiento||'';
    $('c-sexo').value = dc.sexo||'H';
    $('c-estado-civil').value = dc.estadoCivil||estadoCivilProspecto;
    $('c-regimen').value = dc.regimen||'';
    $('c-lugar-nac').value = dc.lugarNac||'Culiacán';
    $('c-nacionalidad').value = dc.nacionalidad||'Mexicana';
    $('c-cel').value = dc.cel||$('c-cel').value;
    $('c-email').value = dc.email||$('c-email').value;
    $('c-calle').value = dc.calle||'';
    $('c-colonia').value = dc.colonia||'';
    $('c-cp').value = dc.cp||'';
    $('c-ciudad').value = dc.ciudad||'Culiacán';
    $('c-municipio').value = dc.municipio||'Culiacán';
    $('c-conyuge-nombre').value = dc.conyugeNombre||'';
    $('c-conyuge-curp').value = dc.conyugeCurp||'';
    $('c-conyuge-rfc').value = dc.conyugeRfc||'';
    $('c-conyuge-nac').value = dc.conyugeNac||'';
    $('c-conyuge-cel').value = dc.conyugeCel||'';
    $('c-ref-nombre').value = dc.refNombre||'';
    $('c-ref-parentesco').value = dc.refParentesco||'';
    $('c-ref-cel').value = dc.refCel||'';
    $('c-empresa').value = dc.empresa||'';
    $('c-puesto').value = dc.puesto||'';
    $('c-ingresos').value = dc.ingresos||'';
    $('c-comprobacion').value = dc.comprobacion||'';
    $('c-tipo-credito').value = dc.tipoCredito||'contado';
    $('c-banco').value = dc.banco||'';
    $('c-plazo-credito').value = dc.plazoCredito||'';

    // ── Restaurar datos financieros guardados (tab 2) ──
    if(dc.fin_credito!==undefined){
      $('c-credito').value = dc.fin_credito||'';
      $('c-descuento').value = dc.fin_descuento||'';
      $('c-pago-adic').value = dc.fin_pago_adic||'';
      $('c-plazo').value = dc.fin_plazo||$('c-plazo').value;
      $('c-fecha-primer-pago').value = dc.fin_fecha_primer_pago||'';
      $('c-forma-pago').value = dc.fin_forma_pago||$('c-forma-pago').value;
    }
  } else {
    // Sin cierre previo: limpiar a valores por defecto (no dejar datos de otro cliente)
    ['c-curp','c-rfc','c-nacimiento','c-regimen','c-calle','c-colonia','c-cp',
     'c-conyuge-nombre','c-conyuge-curp','c-conyuge-rfc','c-conyuge-nac','c-conyuge-cel',
     'c-ref-nombre','c-ref-parentesco','c-ref-cel','c-empresa','c-puesto','c-ingresos',
     'c-comprobacion','c-banco','c-plazo-credito'].forEach(id=>{ if($(id)) $(id).value=''; });
    if($('c-sexo')) $('c-sexo').value='H';
    if($('c-estado-civil')) $('c-estado-civil').value=estadoCivilProspecto;
    if($('c-tipo-credito')) $('c-tipo-credito').value='contado';
  }

  // Set title
  $('cierre-ttl-sub').textContent = `${l.clave} — ${m.nombre} — ${p?p.nombre:'Cliente'}`;

  // Financial tab: show lot summary
  const P = getP();
  const pExc = P.precio_m2_exc||9000;
  const pFrac = P.precio_m2_lote_adicional||13000;
  const vCasa = m.precio;
  const vExc = l.excedente * pExc;
  const fracM2 = l.fraccion_fusionada?(l.fraccion_m2_adicional||0):0;
  const pFracLote = l.fraccion_precio_m2||pFrac;
  const vFrac = fracM2 * pFracLote;
  const vPlus = l.plusvalia||0;
  const vTotal = vCasa + vExc + vFrac + vPlus;
  const gastosParam = P.gastos_operacion||MASTER_PARAMS.gastos_operacion;
  const gastos = gastosParam.filter(g=>g.activo).map(g=>{
    let monto=0;
    if(g.tipo==='fijo') monto=g.valor;
    else if(g.tipo==='pct_vivienda') monto=vTotal*g.valor;
    else if(g.tipo==='pct_credito') monto=0; // calculated after credito input
    return {...g,monto};
  });
  const vGastosFijos = gastos.filter(g=>g.tipo!=='pct_credito').reduce((s,g)=>s+g.monto,0);

  $('cierre-resumen-lote').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:12px">
      <div><div style="color:var(--t3);font-size:10px">LOTE</div><div style="font-weight:700">${l.clave}</div></div>
      <div><div style="color:var(--t3);font-size:10px">MODELO</div><div style="font-weight:700">${m.nombre}</div></div>
      <div><div style="color:var(--t3);font-size:10px">TERRENO</div><div style="font-weight:700">${f3(l.terreno)}m²</div></div>
      <div><div style="color:var(--t3);font-size:10px">EXCEDENTE</div><div style="font-weight:700">${f3(l.excedente)}m²</div></div>
      <div><div style="color:var(--t3);font-size:10px">PRECIO VIVIENDA</div><div style="font-weight:700">${mxn(vCasa)}</div></div>
      <div><div style="color:var(--t3);font-size:10px">EXCEDENTE</div><div style="font-weight:700">${mxn(vExc)}</div></div>
      ${fracM2>0?`<div><div style="color:var(--t3);font-size:10px">FRACCIÓN</div><div style="font-weight:700">${mxn(vFrac)}</div></div>`:''}
      ${vPlus>0?`<div><div style="color:var(--t3);font-size:10px">PLUSVALÍA</div><div style="font-weight:700">${mxn(vPlus)}</div></div>`:''}
      <div><div style="color:var(--t3);font-size:10px">VALOR VIVIENDA</div><div style="font-weight:700;color:var(--navy)">${mxn(vTotal)}</div></div>
      <div><div style="color:var(--t3);font-size:10px">APARTADO YA DADO</div><div style="font-weight:700;color:#dc2626">−${mxn(ap.monto_enganche||50000)}</div></div>
      <div><div style="color:var(--t3);font-size:10px">GASTOS (est.)</div><div style="font-weight:700">${mxn(vGastosFijos)}</div></div>
    </div>`;

  // Set default fecha primer pago (next month, day 1)
  // Defaults financieros — SOLO si este apartado no tiene financieros guardados (si los tiene, ya se restauraron arriba)
  if(!(ap.datos_cierre && ap.datos_cierre.fin_credito!==undefined)){
    const dp = new Date(); dp.setMonth(dp.getMonth()+1); dp.setDate(1);
    $('c-fecha-primer-pago').value = dp.toISOString().split('T')[0];
    $('c-credito').value = '';
    $('c-descuento').value = '';
    $('c-pago-adic').value = '';
    $('c-plazo').value = '0';
  }

  calcCierre();
  window._cierreLocked=false;
  ['cierre-tab-0','cierre-tab-1'].forEach(tid=>{ const t=$(tid); if(t&&t.querySelectorAll) t.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=false); });
  const _ub=$('btn-cierre-unlock'); if(_ub) _ub.style.display='none';
  const _bv=$('btn-descargar-cierre'); if(_bv) _bv.style.display = (DS.findOne('apartados',aid)?.estatus==='Venta')?'none':'';
  cierreTab(0);
  openM('m-cierre');
}


function guardarDatosCierre(){
  if(!_cierreData){ toast('Abre un cierre primero','err'); return; }
  const cli = getClienteData();
  DS.update('apartados', _cierreData.ap.id, {
    datos_cierre: cli,
    folio_recibo: IANNA_MOTOR.asegurarFolioCierre()
  });
  toast('Datos del cliente guardados ✓','ok');
}
function getOrCreateNumCliente(prospectoId){
  const year = new Date().getFullYear();
  const p = DS.findOne('prospectos', prospectoId);
  if(p && p.num_cliente) return p.num_cliente;
  // Find next number for this year
  const allProsp = DS.find('prospectos');
  const yearsNums = allProsp.filter(x=>x.num_cliente&&x.num_cliente.endsWith('-'+year)).map(x=>parseInt(x.num_cliente.split('-')[0]));
  const nextNum = yearsNums.length>0 ? Math.max(...yearsNums)+1 : 7; // start at 007
  const numCliente = String(nextNum).padStart(3,'0')+'-'+year;
  if(p) DS.update('prospectos', prospectoId, {num_cliente: numCliente});
  return numCliente;
}

function getNextFolio(){
  // Fase 1.5: delega al servicio central de folios (escanea TODAS las
  // fuentes: recibos, pagos, cancelaciones y registro). Solo consulta,
  // no consume: la emisión en firme ocurre al guardar (IANNA_FOLIOS.emitir).
  return IANNA_FOLIOS.peek();
}

function cierreTab(n){
  for(let i=0;i<4;i++){
    const tab = $('cierre-tab-'+i);
    const btn = $('ctab'+i);
    if(tab) tab.style.display = i===n?'block':'none';
    if(btn){
      btn.style.borderBottom = i===n?'3px solid var(--navy)':'3px solid transparent';
      btn.style.color = i===n?'var(--navy)':'var(--t3)';
      btn.style.fontWeight = i===n?'700':'400';
    }
  }
  if(n===2) updateCierrePreview();
  if(n===3) renderCobranza();
}

function calcCierre(){
  if(!_cierreData) return;
  const {ap,l,m} = _cierreData;
  const P = getP();
  const pExc = P.precio_m2_exc||9000;
  const pFrac = P.precio_m2_lote_adicional||13000;
  const vCasa = m.precio;
  const vExc = l.excedente * pExc;
  const fracM2 = l.fraccion_fusionada?(l.fraccion_m2_adicional||0):0;
  const vFrac = fracM2*(l.fraccion_precio_m2||pFrac);
  const vPlus = l.plusvalia||0;
  // Extras capturados en el apartado original (construcción adicional y lote adicional)
  const vConstrAdic = ap.construccion_adicional_val||0;
  const constrAdicDesc = ap.construccion_adicional_desc||'';
  const constrAdicM2 = ap.construccion_adicional_m2||0;
  let vLoteAdic = 0, loteAdicData = null;
  if(ap.clave_lote_adicional){
    loteAdicData = getLote(ap.clave_lote_adicional);
    if(loteAdicData) vLoteAdic = loteAdicData.terreno * pFrac;
  }
  const vTotalVivienda = vCasa + vExc + vFrac + vPlus + vConstrAdic + vLoteAdic;

  const credito = parseMoneyInput($('c-credito').value);
  const gastosParam = P.gastos_operacion||MASTER_PARAMS.gastos_operacion;
  const gastosCalc = gastosParam.filter(g=>g.activo).map(g=>{
    let monto=0;
    if(g.tipo==='fijo') monto=g.valor;
    else if(g.tipo==='pct_vivienda') monto=vTotalVivienda*g.valor;
    else if(g.tipo==='pct_credito') monto=credito*g.valor;
    return {...g,monto};
  });
  const vGastos = gastosCalc.reduce((s,g)=>s+g.monto,0);
  const vTotalOp = vTotalVivienda + vGastos;

  const apartado = ap.monto_enganche||50000;
  const descuento = parseMoneyInput($('c-descuento').value);
  const pagoAdic = parseMoneyInput($('c-pago-adic').value);
  const vDesembolso = vTotalOp - apartado - descuento - pagoAdic - credito;

  // Payment schedule
  const plazo = parseInt($('c-plazo').value)||0;
  let pagares = [];
  if(plazo>0 && vDesembolso>0){
    const base = Math.floor(vDesembolso/plazo);
    const ultimo = vDesembolso - base*(plazo-1);
    const fechaBase = $('c-fecha-primer-pago').value ? new Date($('c-fecha-primer-pago').value+'T12:00:00') : new Date();
    pagares = Array.from({length:plazo},(_,i)=>{
      const d = new Date(fechaBase); d.setMonth(d.getMonth()+i);
      return {n:i+1, fecha:d, monto: i===plazo-1?ultimo:base};
    });
  }

  // Store for PDF generation
  _cierreData.vTotalVivienda = vTotalVivienda;
  _cierreData.vConstrAdic = vConstrAdic;
  _cierreData.constrAdicDesc = constrAdicDesc;
  _cierreData.constrAdicM2 = constrAdicM2;
  _cierreData.vLoteAdic = vLoteAdic;
  _cierreData.loteAdicData = loteAdicData;
  _cierreData.gastosCalc = gastosCalc;
  _cierreData.vGastos = vGastos;
  _cierreData.vTotalOp = vTotalOp;
  _cierreData.apartado = apartado;
  _cierreData.descuento = descuento;
  _cierreData.pagoAdic = pagoAdic;
  _cierreData.credito = credito;
  _cierreData.vDesembolso = vDesembolso;
  _cierreData.pagares = pagares;
  _cierreData.plazo = plazo;

  // Render financial table
  const rows = [
    ['Valor vivienda — '+m.nombre, mxn(vCasa)],
    ...(l.excedente>0?[['Terreno excedente ('+f3(l.excedente)+'m² × '+mxn(pExc)+'/m²)', mxn(vExc)]]:[]),
    ...(fracM2>0?[['Fracción fusionada ('+f3(fracM2)+'m² × '+mxn(l.fraccion_precio_m2||pFrac)+'/m²)', mxn(vFrac)]]:[]),
    ...(vPlus>0?[['Plusvalía — '+l.tipo, mxn(vPlus)]]:[]),
    ...(vConstrAdic>0?[['Construcción adicional'+(constrAdicDesc?' — '+constrAdicDesc:'')+(constrAdicM2?' ('+f3(constrAdicM2)+'m²)':''), mxn(vConstrAdic)]]:[]),
    ...(vLoteAdic>0?[['Lote adicional '+(loteAdicData?loteAdicData.clave:'')+' ('+(loteAdicData?f3(loteAdicData.terreno):'0')+'m² × '+mxn(pFrac)+'/m²)', mxn(vLoteAdic)]]:[]),
    ['VALOR TOTAL DE LA VIVIENDA', mxn(vTotalVivienda), true],
    ...gastosCalc.map(g=>[g.nombre+(g.tipo.startsWith('pct')?` (${(g.valor*100).toFixed(2)}%)`:'')+' (Est.)', mxn(g.monto)]),
    ['TOTAL GASTOS DE OPERACIÓN', mxn(vGastos), true],
    ['VALOR TOTAL DE LA OPERACIÓN', mxn(vTotalOp), true, 'navy'],
    ['Apartado', '− '+mxn(apartado)],
    ...(descuento>0?[['Descuento', '− '+mxn(descuento)]]:[]),
    ...(pagoAdic>0?[['Pago adicional', '− '+mxn(pagoAdic)]]:[]),
    ...(credito>0?[['Crédito hipotecario', '− '+mxn(credito)]]:[]),
    ['MONTO A PAGAR (DESEMBOLSO)', mxn(Math.max(0,vDesembolso)), true, 'gold'],
  ];

  $('cierre-financiero').innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
    ${rows.map(r=>`<tr style="border-bottom:1px solid var(--s2)${r[2]?';background:'+(r[3]==='navy'?'#0D1F3C':r[3]==='gold'?'#C9963C':'var(--s2)'):''}">
      <td style="padding:7px 12px;${r[2]?'font-weight:700;color:'+(r[3]==='navy'||r[3]==='gold'?'#fff':'var(--t1)'):''}">${r[0]}</td>
      <td style="text-align:right;padding:7px 12px;font-weight:${r[2]?'700':'400'};${r[2]?'color:'+(r[3]==='navy'||r[3]==='gold'?'#fff':'var(--t1)'):''}">${r[1]}</td>
    </tr>`).join('')}
  </table>`;

  $('prev-pagares-n').textContent = pagares.length > 0 ? pagares.length : 'Contado';

  if(pagares.length>0){
    $('cierre-pagares').innerHTML = `
      <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin:12px 0 6px">Esquema de pagos / Pagarés</div>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="background:var(--s2)"><th style="padding:6px 12px;text-align:left">Pagaré #</th><th style="padding:6px 12px;text-align:left">Fecha</th><th style="padding:6px 12px;text-align:right">Monto</th></tr></thead>
        <tbody>${pagares.map(p=>`<tr style="border-bottom:1px solid var(--s2)"><td style="padding:5px 12px">${p.n}/${plazo}</td><td style="padding:5px 12px">${p.fecha.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'})}</td><td style="padding:5px 12px;text-align:right;font-weight:600">${mxn(p.monto)}</td></tr>`).join('')}
        <tr style="background:var(--s2);font-weight:700"><td colspan="2" style="padding:6px 12px">Total</td><td style="padding:6px 12px;text-align:right">${mxn(vDesembolso)}</td></tr>
        </tbody>
      </table>`;
  } else {
    $('cierre-pagares').innerHTML = '';
  }
}

function updateCierrePreview(){
  if(!_cierreData) return;
  const {ap,l,m,numCliente,folio,vTotalVivienda,vTotalOp,vDesembolso,pagares,plazo} = _cierreData;
  const nombre = $('c-nombre').value||'—';
  $('cierre-preview-resumen').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12.5px">
      <div><b>Cliente:</b> ${nombre}</div>
      <div><b>No. Cliente:</b> ${numCliente}</div>
      <div><b>Lote:</b> ${l.clave} — Mz ${l.mz} Lote ${l.lote}</div>
      <div><b>Modelo:</b> ${m.nombre}</div>
      <div><b>Valor vivienda:</b> ${mxn(vTotalVivienda)}</div>
      <div><b>Valor total operación:</b> ${mxn(vTotalOp)}</div>
      <div><b>Apartado:</b> ${mxn(_cierreData.apartado)}</div>
      <div><b>Monto a pagar:</b> ${mxn(Math.max(0,vDesembolso))}</div>
      <div><b>Esquema:</b> ${plazo>0?plazo+' pago(s)':'Contado'}</div>
      <div><b>Folio recibo:</b> ${folio}</div>
    </div>`;
}

function recolectarDatosCierreForm(){
  return {
    nombre: $('c-nombre').value.trim(),
    curp: $('c-curp').value.trim(),
    rfc: $('c-rfc').value,
    nacimiento: $('c-nacimiento').value,
    sexo: $('c-sexo').value,
    estadoCivil: $('c-estado-civil').value,
    regimen: $('c-regimen').value,
    lugarNac: $('c-lugar-nac').value,
    nacionalidad: $('c-nacionalidad').value,
    cel: $('c-cel').value,
    email: $('c-email').value,
    calle: $('c-calle').value,
    colonia: $('c-colonia').value,
    cp: $('c-cp').value,
    ciudad: $('c-ciudad').value,
    municipio: $('c-municipio').value,
    conyugeNombre: $('c-conyuge-nombre').value,
    conyugeCurp: $('c-conyuge-curp').value,
    conyugeRfc: $('c-conyuge-rfc').value,
    conyugeNac: $('c-conyuge-nac').value,
    conyugeCel: $('c-conyuge-cel').value,
    refNombre: $('c-ref-nombre').value,
    refParentesco: $('c-ref-parentesco').value,
    refCel: $('c-ref-cel').value,
    empresa: $('c-empresa').value,
    puesto: $('c-puesto').value,
    ingresos: $('c-ingresos').value,
    comprobacion: $('c-comprobacion').value,
    tipoCredito: $('c-tipo-credito').value,
    banco: $('c-banco').value,
    plazoCredito: $('c-plazo-credito').value,
    num_cliente: _cierreData.numCliente,
    credito: _cierreData.credito,
    vTotalOp: _cierreData.vTotalOp,
    vDesembolso: _cierreData.vDesembolso,
    pagares: _cierreData.pagares,
  };
}




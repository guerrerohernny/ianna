/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/documentos.module.js
   Generadores de documentos: recibos, formato de apartado, datos generales, cartas, carátula, contrato completo, pagarés.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
let _docQueue = [];
const _DOC_GENERATORS = [
  {label:'Recibo de Apartado', fn:'imprimirReciboApartado'},
  {label:'Formato de Apartado de Vivienda', fn:'imprimirFormatoApartado'},
  {label:'Datos Generales del Solicitante', fn:'imprimirDatosGenerales'},
  {label:'Carta de Autorización de Uso de Datos', fn:'imprimirCartaAutorizacion'},
  {label:'Carta Compromiso Restricción de Efectivo', fn:'imprimirCartaRestriccion'},
  {label:'Carátula del Contrato', fn:'imprimirCaratula'},
  {label:'Contrato de Compraventa', fn:'imprimirContrato'},
  {label:'Pagarés', fn:'imprimirPagares', soloSiHayPagares:true},
];

async function descargarCierreZIP(){
  if(!_cierreData){ toast('Genera el cierre primero','err'); return; }
  // SIEMPRE guardar datos primero
  guardarDatosCierre();
  const nombre = $('c-nombre').value.trim();
  if(!nombre){ toast('Captura el nombre del cliente en la pestaña 1','err'); cierreTab(0); return; }
  const curp = $('c-curp').value.trim();
  if(!curp){ toast('Captura el CURP del cliente','err'); cierreTab(0); return; }

  calcCierre();
  const snap = construirSnapshotCierre();
  DS.update('apartados',_cierreData.ap.id,{ doc_snapshot: snap, folio_recibo: IANNA_MOTOR.asegurarFolioCierre(), cierre_generado: true });
  _cierreData.ap.cierre_generado = true;
  // Registrar todos los documentos del expediente
  Object.keys(DOC_LABELS).forEach(fn=>{
    if(fn==='imprimirPagares'&&!(_cierreData.pagares&&_cierreData.pagares.length)) return;
    registrarDocumento(_cierreData.ap.id, fn, DOC_LABELS[fn]);
  });

  // Generate ALL documents in ONE single window (avoids popup blocker completely)
  generarDocumentosCierreUnificado();
  renderApartados();
  closeM('m-cierre');
  toast('✓ Documentos generados. Usa Ctrl+P en la nueva ventana para guardar como PDF','ok',6000);
}

// ════════════════════════════════════════════════
// PDF GENERATORS — Cada documento abre en nueva ventana
// ════════════════════════════════════════════════


function getClienteData(){
  // Si el documento se regenera desde el expediente, usar el snapshot guardado (datos congelados al momento de generar)
  if(_cierreData && _cierreData.cliSnapshot){
    return {..._cierreData.cliSnapshot, numCliente:_cierreData.numCliente||_cierreData.cliSnapshot.numCliente||''};
  }
  return {
    // ── Financieros (tab 2) — se guardan y restauran junto con los datos del cliente ──
    fin_credito: $('c-credito')?.value||'',
    fin_descuento: $('c-descuento')?.value||'',
    fin_pago_adic: $('c-pago-adic')?.value||'',
    fin_plazo: $('c-plazo')?.value||'',
    fin_fecha_primer_pago: $('c-fecha-primer-pago')?.value||'',
    fin_forma_pago: $('c-forma-pago')?.value||'',
    nombre: $('c-nombre').value.trim(),
    curp: ($('c-curp').value.trim()||'').toUpperCase(),
    rfc: ($('c-rfc').value.trim()||'').toUpperCase(),
    nacimiento: $('c-nacimiento').value||'',
    sexo: $('c-sexo').value||'H',
    estadoCivil: $('c-estado-civil').value||'Soltero(a)',
    regimen: $('c-regimen').value||'',
    lugarNac: $('c-lugar-nac').value||'Culiacán',
    nacionalidad: $('c-nacionalidad').value||'Mexicana',
    cel: $('c-cel').value||'',
    email: $('c-email').value||'',
    calle: $('c-calle').value||'',
    colonia: $('c-colonia').value||'',
    cp: $('c-cp').value||'',
    ciudad: $('c-ciudad').value||'Culiacán',
    municipio: $('c-municipio').value||'Culiacán',
    conyugeNombre: $('c-conyuge-nombre').value||'',
    conyugeCurp: ($('c-conyuge-curp').value||'').toUpperCase(),
    conyugeRfc: ($('c-conyuge-rfc').value||'').toUpperCase(),
    conyugeNac: $('c-conyuge-nac').value||'',
    conyugeCel: $('c-conyuge-cel').value||'',
    refNombre: $('c-ref-nombre').value||'',
    refParentesco: $('c-ref-parentesco').value||'',
    refCel: $('c-ref-cel').value||'',
    empresa: $('c-empresa').value||'',
    puesto: $('c-puesto').value||'',
    ingresos: $('c-ingresos').value||'',
    comprobacion: $('c-comprobacion').value||'',
    tipoCredito: $('c-tipo-credito').value||'',
    banco: $('c-banco').value||'',
    plazoCredito: $('c-plazo-credito').value||'',
    numCliente: _cierreData.numCliente,
  };
}

function getPDF_Header(logoB64, titulo, fecha, mza, lote){
  return `<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:14px">
      <img src="${VA_LOGO}" style="height:52px">
      <div>
        <div style="font-weight:800;font-size:14px;color:#1E3D0F">DESARROLLADORA PALIZ</div>
        <div style="font-size:11px;color:#555">BLVD. FRANCISCO I. MADERO #1051 COL. CENTRO C.P. 80000</div>
        <div style="font-size:11px;color:#555">CULIACÁN, SINALOA | Tel: 667 147 8576</div>
      </div>
    </div>
    <div style="border:2px solid #1E3D0F;border-radius:6px;padding:6px 14px;text-align:right">
      <div style="font-size:10px;font-weight:700;color:#1E3D0F">FOLIO</div>
      <div style="font-size:18px;font-weight:800;color:#C9963C">${_cierreData.folio?'No. '+_cierreData.folio.padStart(8,'0'):''}</div>
    </div>
  </div>
  <div style="text-align:center;background:#1E3D0F;color:#fff;padding:8px;border-radius:6px;font-weight:700;font-size:14px;margin-bottom:14px;letter-spacing:.5px">${titulo}</div>
  <div style="display:flex;gap:20px;font-size:12px;margin-bottom:10px">
    <span><b>Fecha:</b> ${fecha}</span>
    <span><b>Manzana:</b> ${mza}</span>
    <span><b>Lote:</b> ${lote}</span>
  </div>`;
}

function imprimirReciboApartado(){
  if(!_cierreData) return;
  const {ap,l,folio} = _cierreData;
  const cli = getClienteData();
  const P = getP();
  const hoy = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  const monto = ap.monto_enganche||50000;
  const montoPalabras = numToLetras(monto);
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Recibo Apartado ${folio}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#1a1a1a}
  .borde{border:2px solid #1E3D0F;border-radius:8px;padding:18px}
  table{width:100%;border-collapse:collapse}td{padding:4px 6px}
  .sep{border-bottom:1px solid #ccc;margin:10px 0}
  .concepto-box{display:flex;gap:20px;margin:10px 0}
  .chk{display:inline-block;width:14px;height:14px;border:1.5px solid #333;margin-right:4px;vertical-align:middle}
  .chk{position:relative}.chk.sel{background:#1E3D0F;print-color-adjust:exact;-webkit-print-color-adjust:exact}.chk.sel::after{content:'✕';position:absolute;left:0;right:0;top:-2px;text-align:center;color:#1E3D0F;font-weight:900;font-size:11px;line-height:15px;text-shadow:0 0 2px #fff,0 0 2px #fff}
  .firma-line{border-top:1.5px solid #333;margin-top:40px;padding-top:6px;text-align:center;font-weight:700;font-size:11px}
  @media print{button{display:none!important}@page{size:letter;margin:10mm}}</style></head><body>
  <div class="borde">
    <table><tr>
      <td style="width:140px"><img src="${VA_LOGO}" style="width:120px"></td>
      <td style="text-align:center">
        <div style="font-weight:800;font-size:16px;color:#1E3D0F">DESARROLLADORA PALIZ</div>
        <div style="font-size:11px">BLVD. FRANCISCO I. MADERO #1051 COL. CENTRO C.P. 80000</div>
        <div style="font-size:11px">CULIACÁN, SINALOA</div>
      </td>
      <td style="text-align:right;width:140px;border:2px solid #1E3D0F;border-radius:6px;padding:8px">
        <div style="font-size:10px;font-weight:700">FOLIO</div>
        <div style="font-size:11px;font-weight:700">No. ${String(folio).padStart(8,'0')}</div>
        <div style="font-size:16px;font-weight:800;color:#C9963C">$ ${mxn(monto).replace('$','')}</div>
      </td>
    </tr></table>
    <div class="sep"></div>
    <table>
      <tr><td><b>DESARROLLO:</b> VALLE DE ARAGÓN</td><td><b>MANZANA:</b> ${l.mz}</td><td><b>LOTE:</b> ${l.lote}</td></tr>
      <tr><td colspan="3"><b>RECIBIMOS DE:</b> ${cli.numCliente} &nbsp; ${cli.nombre.toUpperCase()}</td></tr>
      <tr><td colspan="3"><b>LA CANTIDAD DE:</b> <span style="font-size:14px;font-weight:800;color:#1E3D0F">$ ${mxn(monto).replace('$','')}</span></td></tr>
      <tr><td colspan="3"><b>(${montoPalabras})</b></td></tr>
    </table>
    <div class="sep"></div>
    <div><b>POR CONCEPTO DE:</b>
      <div class="concepto-box">
        <label><span class="chk sel"></span>APARTADO</label>
        <label><span class="chk"></span>ENGANCHE</label>
        <label><span class="chk"></span>MENSUALIDAD</label>
        <label><span class="chk"></span>INTERÉS MORATORIO</label>
      </div>
    </div>
    <div><b>OBSERVACIONES:</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
    <div class="sep"></div>
    <div><b>DISTRIBUCIÓN DEL PAGO:</b> &nbsp; Pago a Capital: ${mxn(monto).replace('$','')} &nbsp;&nbsp; Interés Moratorio: 0.00</div>
    <div style="margin-top:6px"><b>Forma de pago:</b> ${(_cierreData.formaPago||$('c-forma-pago')?.value||'TRANSFERENCIA ELECTRÓNICA DE FONDOS')}</div>
    <div class="sep"></div>
    <table><tr>
      <td style="width:50%;text-align:center"><div class="firma-line">ELABORÓ</div></td>
      <td style="text-align:center">
        <div style="text-align:right;font-size:11px">ADMINISTRACIÓN</div>
        <div class="firma-line">CULIACÁN, SINALOA &nbsp;&nbsp; ${hoy}</div>
      </td>
    </tr></table>
  </div>
  <button onclick="window.print()" style="margin-top:16px;padding:8px 20px;background:#1E3D0F;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir</button>
  </body></html>`);
  win.document.close();
}

// numToLetras: ahora vive en utils/formatos.util.js (Motor de Formatos único)


function imprimirFormatoApartado(){
  if(!_cierreData) return;
  const {ap,l,m,folio,vTotalVivienda,gastosCalc,vGastos,vTotalOp,apartado,credito,descuento,pagoAdic,vDesembolso,pagares,plazo,vConstrAdic,constrAdicDesc,constrAdicM2,vLoteAdic,loteAdicData} = _cierreData;
  const cli = getClienteData();
  const P = getP(); const pExc=P.precio_m2_exc||9000; const pFrac=P.precio_m2_lote_adicional||13000;
  const vCasa=m.precio; const vExc=l.excedente*pExc;
  const fracM2=l.fraccion_fusionada?(l.fraccion_m2_adicional||0):0;
  const vFrac=fracM2*(l.fraccion_precio_m2||pFrac); const vPlus=l.plusvalia||0;
  const hoy=new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});
  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Formato de Apartado</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:20px;color:#1a1a1a}
  table{width:100%;border-collapse:collapse}td,th{padding:5px 8px;border:1px solid #ccc}th{background:#1E3D0F;color:#fff;font-size:11px}
  .total-row td{background:#1E3D0F;color:#fff;font-weight:700} .sub-total td{background:#e8f5e9;font-weight:700}
  .gold-row td{background:#C9963C;color:#fff;font-weight:700;font-size:13px}
  .firma{border-top:1.5px solid #333;margin-top:50px;padding-top:6px;text-align:center;font-size:10px;font-weight:700}
  @media print{button{display:none!important}@page{size:letter;margin:10mm}}</style></head><body>
  <table style="margin-bottom:12px;border:none"><tr>
    <td style="border:none;width:120px"><img src="${VA_LOGO}" style="width:100px"></td>
    <td style="border:none;text-align:center"><div style="font-size:16px;font-weight:800;background:#1E3D0F;color:#fff;padding:8px;border-radius:4px">FORMATO DE APARTADO DE VIVIENDA</div><br>
      <div style="font-size:12px"><b>FECHA:</b> ${hoy} &nbsp;&nbsp; <b>NOMBRE DEL CLIENTE:</b> ${cli.nombre}</div></td>
  </tr></table>
  <table style="margin-bottom:8px"><tr><th>LOTE</th><th>MANZANA</th><th>LOTE</th><th>MODELO</th><th>PROTOTIPO (M2 ED)</th><th>M2 SUPERFICIE</th><th>DIRECCIÓN OFICIAL</th></tr>
  <tr><td>${l.clave}</td><td>${l.mz}</td><td>${l.lote}</td><td>${m.nombre}</td><td>${m.construccion||'—'}m²</td><td>${f3(l.terreno)}</td><td>${l.dir_oficial||'—'}</td></tr></table>
  <table style="margin-bottom:8px"><tr>
    <th>PRECIO VIVIENDA</th><th>PRECIO EXCEDENTE</th><th>PLUSVALÍA</th>${fracM2>0?'<th>FRACCIÓN</th>':''}<th>DESCUENTO</th><th>PRECIO TOTAL</th>
  </tr><tr>
    <td>$${mxn(vCasa).replace('$','')}</td><td>$${mxn(vExc).replace('$','')}</td><td>$${mxn(vPlus).replace('$','')}</td>${fracM2>0?`<td>$${mxn(vFrac).replace('$','')}</td>`:''}<td>$${mxn(descuento).replace('$','')}</td><td><b>$${mxn(vTotalVivienda).replace('$','')}</b></td>
  </tr></table>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px">
  <table>
    <tr><th colspan="2">CORRIDA FINANCIERA</th></tr>
    <tr><td>Valor Vivienda</td><td style="text-align:right">$${mxn(vCasa).replace('$','')}</td></tr>
    ${l.excedente>0?`<tr><td>Terreno Excedente (${f3(l.excedente)}m²)</td><td style="text-align:right">$${mxn(vExc).replace('$','')}</td></tr>`:''}
    ${fracM2>0?`<tr><td>Fracción Fusionada (${f3(fracM2)}m²)</td><td style="text-align:right">$${mxn(vFrac).replace('$','')}</td></tr>`:''}
    ${vPlus>0?`<tr><td>Plusvalía — ${l.tipo}</td><td style="text-align:right">$${mxn(vPlus).replace('$','')}</td></tr>`:''}
    ${vConstrAdic>0?`<tr><td>Construcción Adicional${constrAdicDesc?' — '+constrAdicDesc:''}</td><td style="text-align:right">$${mxn(vConstrAdic).replace('$','')}</td></tr>`:''}
    ${vLoteAdic>0?`<tr><td>Lote Adicional ${loteAdicData?loteAdicData.clave:''}</td><td style="text-align:right">$${mxn(vLoteAdic).replace('$','')}</td></tr>`:''}
    <tr class="sub-total"><td>VALOR TOTAL DE LA VIVIENDA</td><td style="text-align:right">$${mxn(vTotalVivienda).replace('$','')}</td></tr>
    ${(gastosCalc||[]).map(g=>`<tr><td>${g.nombre}</td><td style="text-align:right">$${mxn(g.monto).replace('$','')}</td></tr>`).join('')}
    <tr class="sub-total"><td>TOTAL GASTOS DE OPERACIÓN</td><td style="text-align:right">$${mxn(vGastos).replace('$','')}</td></tr>
    <tr class="total-row"><td>VALOR TOTAL DE LA OPERACIÓN</td><td style="text-align:right">$${mxn(vTotalOp).replace('$','')}</td></tr>
    <tr><td>Apartado</td><td style="text-align:right">$${mxn(apartado).replace('$','')}</td></tr>
    ${descuento>0?`<tr><td>Descuento</td><td style="text-align:right">$${mxn(descuento).replace('$','')}</td></tr>`:''}
    ${pagoAdic>0?`<tr><td>Pago Adicional</td><td style="text-align:right">$${mxn(pagoAdic).replace('$','')}</td></tr>`:''}
    ${credito>0?`<tr><td>Crédito</td><td style="text-align:right">$${mxn(credito).replace('$','')}</td></tr>`:''}
    <tr class="gold-row"><td>MONTO A PAGAR</td><td style="text-align:right">$${mxn(Math.max(0,vDesembolso)).replace('$','')}</td></tr>
  </table>
  <table>
    <tr><th>PAGARÉ #</th><th>FECHA DE PAGO</th><th>IMPORTE</th></tr>
    ${(pagares||[]).map(p=>`<tr><td>${p.n}/${plazo}</td><td>${p.fecha.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'})}</td><td style="text-align:right">$${mxn(p.monto).replace('$','')}</td></tr>`).join('')}
    ${(pagares||[]).length>0?`<tr class="sub-total"><td colspan="2">SUMA</td><td style="text-align:right">$${mxn(Math.max(0,vDesembolso)).replace('$','')}</td></tr>`:'<tr><td colspan="3" style="text-align:center;color:#888">CONTADO</td></tr>'}
  </table></div>
  <table style="border:none"><tr>
    <td style="border:none;width:33%;text-align:center"><div class="firma">${cli.nombre}<br>FIRMA DEL CLIENTE</div></td>
    <td style="border:none;width:33%;text-align:center"><div class="firma">${_cierreData.asesorNombre||CU.nombre}<br>FIRMA DEL ASESOR DE VENTAS</div></td>
    <td style="border:none;width:33%;text-align:center"><div class="firma">${getP().gerente||'Gerente de Ventas'}<br>GERENTE DE VENTAS</div></td>
  </tr></table>
  <button onclick="window.print()" style="margin-top:16px;padding:8px 20px;background:#1E3D0F;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Imprimir</button>
  </body></html>`);
  win.document.close();
}

function imprimirDatosGenerales(){
  if(!_cierreData) return;
  const {l} = _cierreData;
  const cli = getClienteData();
  const hoy = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  // Convención de captura: "Apellido Paterno Materno Nombre(s)"
  const partes=(cli.nombre||'').trim().split(/\s+/);
  const apPat=partes[0]||'', apMat=partes[1]||'', nombres=partes.slice(2).join(' ');
  const cPartes=(cli.conyugeNombre||'').trim().split(/\s+/);
  const cPat=cPartes[0]||'', cMat=cPartes[1]||'', cNoms=cPartes.slice(2).join(' ');
  const rPartes=(cli.refNombre||'').trim().split(/\s+/);
  const rPat=rPartes[0]||'', rMat=rPartes[1]||'', rNoms=rPartes.slice(2).join(' ');
  const fNac=cli.nacimiento?new Date(cli.nacimiento+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'}):'';
  // Edad calculada a partir de fecha de nacimiento
  let edad='';
  if(cli.nacimiento){ const b=new Date(cli.nacimiento+'T12:00:00'); const t=new Date(); let e=t.getFullYear()-b.getFullYear(); if(t.getMonth()<b.getMonth()||(t.getMonth()===b.getMonth()&&t.getDate()<b.getDate())) e--; edad=String(e); }
  const dom=[cli.calle,cli.colonia].filter(Boolean).join('. ');
  const cel=fmtTelVal(cli.cel||'');
  const ing=cli.ingresos?('$ '+mxn(parseMoneyInput(cli.ingresos)).replace('$','')):'';
  // Celda estilo PALIZ: recuadro con el dato y etiqueta debajo
  const box=(val,lbl,flex)=>`<div style="flex:${flex||1};min-width:0"><div class="cbx">${val||'&nbsp;'}</div><div class="clb">${lbl}</div></div>`;
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Información del Cliente</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Calibri,Arial,sans-serif;font-size:11.5px;padding:18px 28px;color:#1a1a1a}
  .row{display:flex;gap:12px;margin-bottom:7px;align-items:flex-start}
  .grupo{display:flex;gap:7px;flex:3}
  .lado{display:flex;gap:7px;flex:1.1}
  .cbx{border:1.5px solid #1a1a1a;min-height:20px;padding:1px 6px;font-size:11.5px;text-align:center;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .clb{font-size:8.8px;text-align:center;color:#333;margin-top:1px}
  .sec{text-align:center;font-weight:700;font-size:12px;margin:9px 0 6px}
  .firma{border-top:1.5px solid #333;margin-top:38px;padding-top:5px;text-align:center;font-size:10px;font-weight:700}
  @media print{button{display:none!important}@page{size:letter;margin:9mm}}</style></head><body>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <img src="${VA_LOGO}" style="height:62px">
    <div style="font-size:18px;font-weight:800;letter-spacing:.5px">INFORMACIÓN DEL CLIENTE</div>
    <div style="text-align:right;font-size:10.5px"><b>Fecha:</b> ${hoy}<br><b>Mza:</b> ${l.mz} &nbsp; <b>Lote:</b> ${l.lote}</div>
  </div>
  <!-- Datos personales -->
  <div class="row">
    <div class="grupo">${box(nombres||cli.nombre,'Nombre (s)')}${box(apPat,'Apellido paterno')}${box(apMat,'Apellido materno')}</div>
    <div class="lado">${box(fNac,'Fecha de nacimiento')}</div>
  </div>
  <div class="row">
    <div class="grupo">${box(dom,'Domicilio',2)}${box(cli.cp,'Código postal',.7)}${box(cli.ciudad,'Ciudad')}</div>
    <div class="lado">${box(cli.lugarNac,'Lugar de nacimiento')}</div>
  </div>
  <div class="row">
    <div class="grupo">${box(cel,'Celular')}${box(cli.email,'Correo electrónico',2)}</div>
    <div class="lado">${box(edad,'Edad',.8)}${box('','Peso',.8)}${box('','Estatura',.8)}</div>
  </div>
  <div class="row">
    <div class="grupo">${box('','Nivel de estudios')}${box(cli.estadoCivil,'Estado civil')}${box(cli.rfc,'RFC')}</div>
    <div class="lado">${box(cli.curp,'CURP')}</div>
  </div>
  <!-- Cónyuge -->
  <div class="sec">Información del cónyuge</div>
  <div class="row">
    <div class="grupo">${box(cNoms||cli.conyugeNombre,'Nombre (s)')}${box(cPat,'Apellido paterno')}${box(cMat,'Apellido materno')}</div>
    <div class="lado">${box(cli.conyugeNac?new Date(cli.conyugeNac+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'}):'','Fecha de nacimiento')}</div>
  </div>
  <div class="row">
    <div class="grupo">${box(fmtTelVal(cli.conyugeCel||''),'Celular')}${box('','Correo electrónico',2)}</div>
    <div class="lado">${box('','Edad',.8)}${box('','Peso',.8)}${box('','Estatura',.8)}</div>
  </div>
  <!-- Referencia familiar -->
  <div class="sec">Referencia familiar</div>
  <div class="row">
    <div class="grupo">${box(rNoms||cli.refNombre,'Nombre (s)')}${box(rPat,'Apellido paterno')}${box(rMat,'Apellido materno')}</div>
    <div class="lado">${box(fmtTelVal(cli.refCel||''),'Celular')}</div>
  </div>
  <div class="row">
    <div class="grupo">${box('','Domicilio',2)}${box('','Código postal',.7)}${box('','Ciudad')}</div>
    <div class="lado">${box(cli.refParentesco,'Parentesco')}</div>
  </div>
  <!-- Referencia personal -->
  <div class="sec">Referencia personal</div>
  <div class="row">
    <div class="grupo">${box('','Nombre (s)')}${box('','Apellido paterno')}${box('','Apellido materno')}</div>
    <div class="lado">${box('','Celular')}</div>
  </div>
  <div class="row">
    <div class="grupo">${box('','Domicilio',2)}${box('','Código postal',.7)}${box('','Ciudad')}</div>
    <div class="lado">${box('','Tiempo de conocerse')}</div>
  </div>
  <!-- Información laboral -->
  <div class="sec">Información laboral</div>
  <div class="row">
    <div class="grupo">${box(cli.empresa,'Nombre de la empresa en que labora',2)}${box(cli.puesto,'Puesto')}</div>
    <div class="lado">${box(ing,'Sueldo mensual bruto')}</div>
  </div>
  <div class="row">
    <div class="grupo">${box('','Domicilio',2)}${box('','Código postal',.7)}${box('','Ciudad')}</div>
    <div class="lado">${box('','Antigüedad')}</div>
  </div>
  <!-- Crédito -->
  <div class="sec">Tipo de crédito solicitado</div>
  <div class="row">
    <div class="grupo">${box((cli.tipoCredito||'').toUpperCase(),'Tipo de crédito')}${box(cli.banco,'Banco / Institución')}${box(cli.plazoCredito,'Plazo')}</div>
    <div class="lado">${box(cli.comprobacion,'Forma de comprobar ingresos')}</div>
  </div>
  <div style="display:flex;gap:60px;margin-top:6px">
    <div style="flex:1"><div class="firma">${cli.nombre}<br>NOMBRE Y FIRMA DEL CLIENTE</div></div>
    <div style="flex:1"><div class="firma">${_cierreData.asesorNombre||CU.nombre}<br>NOMBRE Y FIRMA DEL ASESOR</div></div>
  </div>
  <button onclick="window.print()" style="margin-top:20px;padding:8px 20px;background:#1E3D0F;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Imprimir</button>
  </body></html>`);
  win.document.close();
}

function imprimirCartaAutorizacion(){
  if(!_cierreData) return;
  const cli = getClienteData();
  const hoy = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Carta Autorización</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:16px;padding:20px 26px;line-height:2.1;color:#1a1a1a;text-align:justify}
  .firma{border-top:2px solid #333;margin:150px auto 0;padding-top:10px;text-align:center;font-size:15px;font-weight:700;width:70%}
  @media print{button{display:none!important}@page{size:letter;margin:12mm}}</style></head><body>
  <div style="text-align:center;margin-bottom:26px"><img src="${VA_LOGO}" style="height:110px"></div>
  <h2 style="text-align:center;color:#1E3D0F;margin-bottom:30px;font-size:20px;letter-spacing:.5px">CARTA DE AUTORIZACIÓN DE USO DE DATOS</h2>
  <p style="text-align:right;margin-bottom:26px">Culiacán, Sinaloa a ${hoy}</p>
  <p>Yo, <strong>${cli.nombre}</strong>, autorizo expresamente, de manera informada y voluntaria, a <strong>Desarrolladora Paliz, S. A. de C. V.</strong>, el tratamiento de mis datos personales, incluyendo su obtención, recopilación, uso, almacenamiento y transferencia, conforme a las finalidades establecidas en el aviso de privacidad integral, el cual me fue puesto a disposición previamente a la firma de la presente.</p>
  <p style="margin-top:22px">Asimismo, manifiesto que conozco los derechos de acceso, rectificación, cancelación y oposición (derechos ARCO) que me asisten conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, y que puedo ejercerlos en cualquier momento en el domicilio de <strong>Desarrolladora Paliz, S. A. de C. V.</strong></p>
  <p style="margin-top:22px">Firmo la presente por mi propio derecho, dándome por enterado(a) y aceptando los términos aquí descritos.</p>
  <div class="firma">${cli.nombre}<br><span style="font-weight:400;font-size:12.5px">NOMBRE Y FIRMA</span></div>
  <button onclick="window.print()" style="margin-top:24px;padding:8px 20px;background:#1E3D0F;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir</button>
  </body></html>`);
  win.document.close();
}

function imprimirCartaRestriccion(){
  if(!_cierreData) return;
  const cli = getClienteData();
  const hoy = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Carta Restricción Efectivo</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:14.5px;padding:16px 26px;line-height:1.8;color:#1a1a1a;text-align:justify}
  .firma{border-top:2px solid #333;margin:70px auto 0;padding-top:10px;text-align:center;font-size:15px;font-weight:700;width:70%;page-break-inside:avoid}
  @media print{button{display:none!important}@page{size:letter;margin:11mm}}</style></head><body>
  <div style="text-align:center;margin-bottom:16px"><img src="${VA_LOGO}" style="height:88px"></div>
  <h2 style="text-align:center;color:#1E3D0F;margin-bottom:20px;font-size:19px;letter-spacing:.5px">CARTA COMPROMISO DE RESTRICCIÓN DE EFECTIVO</h2>
  <p style="text-align:right;margin-bottom:18px">Culiacán, Sinaloa a ${hoy}</p>
  <p>Yo, <strong>${cli.nombre}</strong>, declaro que el vendedor/ejecutivo <strong>${_cierreData.asesorNombre||CU.nombre}</strong> me informó sobre la restricción de operaciones en efectivo que, de acuerdo a la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita (LFPIORPI) en su artículo 32, fracción I, le prohíbe a <strong>Desarrolladora Paliz, S. A. de C. V.</strong>, en el cumplimiento de dichas obligaciones, liquidar o pagar, así como aceptar la liquidación, de actos u operaciones mediante el uso de monedas y billetes en moneda nacional o divisas y metales preciosos, en la constitución o transmisión de derechos reales sobre bienes inmuebles por un valor igual o superior al equivalente de 8,025 (ocho mil veinticinco) veces Unidades de Medida y Actualización (UMA) diaria, o su respectivo tipo de cambio en moneda extranjera.</p>
  <p style="margin-top:20px">Por lo anterior, me comprometo a realizar mis apartados, pagos, liquidaciones o cualquier otra transacción relacionada con la constitución o transmisión de derechos reales sobre bienes inmuebles con cualquier instrumento monetario distinto al efectivo, como lo pueden ser cheque o transferencia electrónica. En caso de incumplimiento, conozco y acepto una penalización del 5% (cinco por ciento) sobre la suma en efectivo que haya operado.</p>
  <p style="margin-top:20px">Firmo por mi propio derecho, me doy por enterado(a) y acepto los términos y condiciones antes descritos.</p>
  <div class="firma">${cli.nombre}<br><span style="font-weight:400;font-size:12.5px">NOMBRE Y FIRMA</span></div>
  <button onclick="window.print()" style="margin-top:24px;padding:8px 20px;background:#1E3D0F;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🖨 Imprimir</button>
  </body></html>`);
  win.document.close();
}

function imprimirCaratula(){
  if(!_cierreData) return;
  const {ap,l,m,vTotalVivienda,vTotalOp,vGastos,apartado,credito,vDesembolso,pagares,plazo} = _cierreData;
  const cli = getClienteData();
  const P = getP();
  const hoy = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Carátula Contrato</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px;padding:12px 16px;color:#1a1a1a}
  table{width:100%;border-collapse:collapse}td,th{padding:2.5px 6px;border:1px solid #aaa}
  .hdr{background:#1E3D0F;color:#fff;font-weight:700;padding:3.5px 6px;font-size:10px}
  .titulo{text-align:center;font-size:12.5px;font-weight:800;color:#1E3D0F;margin:5px 0;text-transform:uppercase}
  .firma{border-top:1.5px solid #333;margin-top:26px;padding-top:5px;text-align:center;font-size:9.5px;font-weight:700}
  @media print{button{display:none!important}@page{size:letter;margin:8mm}}</style></head><body>
  <div style="text-align:center;margin-bottom:6px"><img src="${VA_LOGO}" style="height:42px"></div>
  <div class="titulo">CONTRATO DE ADHESIÓN DE COMPRAVENTA DE VIVIENDA EN PREVENTA</div>
  <div class="titulo" style="font-size:10px;margin:3px 0 6px">PRIVADAS VALLE DE ARAGÓN — CULIACÁN, SIN. A ${hoy}</div>
  <table style="margin-bottom:8px">
    <tr><td class="hdr" colspan="2">1. LUGAR Y FECHA</td></tr>
    <tr><td>Culiacán, Sinaloa a ${hoy}</td><td><b>Número de Cliente:</b> ${cli.numCliente}</td></tr>
  </table>
  <table style="margin-bottom:8px">
    <tr><td class="hdr" colspan="4">2. DATOS DEL VENDEDOR</td></tr>
    <tr><td><b>Razón Social</b></td><td colspan="3">DESARROLLADORA PALIZ, S. A. DE C. V.</td></tr>
    <tr><td><b>RFC</b></td><td>DPA170222RB8</td><td><b>Tel.</b></td><td>667 147 8576</td></tr>
    <tr><td><b>Apoderado</b></td><td colspan="3">LIZBETH GUADALUPE ZAMUDIO RUIZ</td></tr>
    <tr><td><b>Domicilio</b></td><td colspan="3">BLVD. FRANCISCO I. MADERO #1051 COL. CENTRO C.P. 80000, CULIACÁN, SINALOA</td></tr>
    <tr><td><b>Correo</b></td><td colspan="3">valledearagon@desarrolladorapaliz.com</td></tr>
  </table>
  <table style="margin-bottom:8px">
    <tr><td class="hdr" colspan="4">3. DATOS DEL COMPRADOR</td></tr>
    <tr><td><b>Nombre</b></td><td colspan="3">${cli.nombre}</td></tr>
    <tr><td><b>RFC</b></td><td>${cli.rfc}</td><td><b>CURP</b></td><td>${cli.curp}</td></tr>
    <tr><td><b>Domicilio</b></td><td colspan="3">${cli.calle}, ${cli.colonia}, CP ${cli.cp}, ${cli.ciudad}, ${cli.municipio}</td></tr>
    <tr><td><b>Celular</b></td><td>${cli.cel}</td><td><b>Correo</b></td><td>${cli.email}</td></tr>
  </table>
  <table style="margin-bottom:8px">
    <tr><td class="hdr" colspan="4">4. DATOS DE LA UNIDAD PRIVATIVA</td></tr>
    <tr><td><b>Desarrollo</b></td><td>Valle de Aragón</td><td><b>Manzana</b></td><td>${l.mz}</td></tr>
    <tr><td><b>Lote</b></td><td>${l.lote}</td><td><b>Clave</b></td><td>${l.clave}</td></tr>
    <tr><td><b>Modelo</b></td><td>${m.nombre}</td><td><b>Construcción m²</b></td><td>${m.construccion||'—'}</td></tr>
    <tr><td><b>Superficie (m²)</b></td><td>${f3(l.terreno)}</td><td><b>Excedente (m²)</b></td><td>${f3(l.excedente)}</td></tr>
    <tr><td><b>Dirección oficial</b></td><td colspan="3">${l.dir_oficial||'—'}</td></tr>
    <tr><td><b>Fecha entrega</b></td><td>30 de junio de 2026</td><td><b>Fecha escritura</b></td><td>—</td></tr>
    <tr><td><b>Notario</b></td><td colspan="3">LIC. MANUEL GUILLERMO GARCIA RENDON, Notaría Pública 160</td></tr>
  </table>
  <table style="margin-bottom:8px">
    <tr><td class="hdr" colspan="2">5. PRECIO Y FORMA DE PAGO</td></tr>
    <tr><td><b>Precio de lista:</b></td><td>$${mxn(vTotalVivienda).replace('$','')}</td></tr>
    <tr><td><b>Gastos de operación (Est.):</b></td><td>$${mxn(vGastos).replace('$','')}</td></tr>
    <tr><td><b>Precio total de la operación:</b></td><td><b>$${mxn(vTotalOp).replace('$','')}</b></td></tr>
    <tr><td><b>Apartado:</b></td><td>$${mxn(apartado).replace('$','')}</td></tr>
    ${credito>0?`<tr><td><b>Crédito hipotecario:</b></td><td>$${mxn(credito).replace('$','')}</td></tr>`:''}
    <tr><td><b>Monto a pagar (desembolso):</b></td><td><b>$${mxn(Math.max(0,vDesembolso)).replace('$','')}</b></td></tr>
    <tr><td><b>Esquema:</b></td><td>${plazo>0?plazo+' pago(s) mensuales':'Contado'}</td></tr>
  </table>
  <table style="margin-bottom:8px">
    <tr><td class="hdr" colspan="2">8. DATOS BANCARIOS PARA PAGOS</td></tr>
    <tr><td><b>Beneficiario:</b></td><td>DESARROLLADORA PALIZ, S. A. DE C. V.</td></tr>
    <tr><td><b>Institución:</b></td><td>BANCO DEL BAJÍO (BANBAJIO)</td></tr>
    <tr><td><b>No. de cuenta:</b></td><td>0474632860201</td></tr>
    <tr><td><b>CLABE interbancaria:</b></td><td>030730900044165477</td></tr>
  </table>
  <table style="border:none;margin-top:16px"><tr>
    <td style="border:none;text-align:center"><div class="firma">LIZBETH GUADALUPE ZAMUDIO RUIZ<br>EL VENDEDOR<br>DESARROLLADORA PALIZ, S.A. DE C.V.</div></td>
    <td style="border:none;text-align:center"><div class="firma">${cli.nombre}<br>EL COMPRADOR</div></td>
  </tr></table>
  <button onclick="window.print()" style="margin-top:16px;padding:8px 20px;background:#1E3D0F;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Imprimir</button>
  </body></html>`);
  win.document.close();
}

function imprimirContrato(){
  if(!_cierreData) return;
  const cli = getClienteData();
  const win = window.open('','_blank');
  // ═══ CONTRATO COMPLETO — réplica fiel del contrato de adhesión de Desarrolladora Paliz (29 cláusulas) ═══
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Contrato de Compraventa — ${cli.nombre}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11.5px;padding:28px 34px;line-height:1.75;color:#1a1a1a;text-align:justify}
  p{margin-bottom:9px}
  h2{font-size:12px;text-align:center;margin:16px 0 10px;letter-spacing:1px}
  table.civ{width:100%;border-collapse:collapse;margin:10px 0;font-size:11px}
  table.civ td,table.civ th{border:1px solid #555;padding:5px 8px;text-align:left;vertical-align:top}
  table.civ th{background:#efefef;font-weight:700}
  .firmas{margin-top:60px;page-break-inside:avoid}
  .firma-line{border-top:1.5px solid #333;width:65%;margin:70px auto 0;padding-top:8px;font-size:11.5px;font-weight:700;text-align:center}
  @media print{button{display:none!important}@page{size:letter;margin:16mm}}</style></head><body>
<div style="text-align:center;margin-bottom:14px"><img src="${VA_LOGO}" style="height:75px"></div>
  <p>CONTRATO DE ADHESIÓN DE COMPRAVENTA DE VIVIENDA EN PREVENTA (EN LO SUCESIVO EL CONTRATO) QUE SE CELEBRA EN LA FECHA SEÑALADA EN EL RECUADRO MARCADO COMO APARTADO 1 UNO DE LA CARÁTULA DEL CONTRATO, (EN LO SUCESIVO LA CARÁTULA), ENTRE <strong>DESARROLLADORA PALIZ, S.A. DE C.V.</strong>, A TRAVÉS DE SUS APODERADOS SEÑALADOS EN EL APARTADO 2 DOS DE LA CARÁTULA Y A QUIEN EN LO SUCESIVO Y PARA EFECTOS DE ESTE CONTRATO SE LE DENOMINARÁ COMO EL <strong>VENDEDOR</strong> Y POR LA OTRA PARTE LA PERSONA SEÑALADA EN EL APARTADO 3 TRES DE LA CARÁTULA, <strong>${cli.nombre.toUpperCase()}</strong>, Y A QUIEN EN LO SUCESIVO SE LE DENOMINARÁ COMO EL <strong>COMPRADOR</strong>, A TODOS ELLOS EN SU CONJUNTO EN LO SUCESIVO SE LES DENOMINARÁ COMO LAS <strong>PARTES</strong>.</p>
  <h2>CONTRATO DE ADHESIÓN DE COMPRAVENTA DE VIVIENDA EN PREVENTA.</h2>
  <h2>D E C L A R A C I O N E S:</h2>
  <p><strong>1.- DEL VENDEDOR:</strong></p>
  <p><strong>1.1.-</strong> Que es una sociedad mercantil legalmente constituida conforme a las leyes de la República Mexicana.</p>
  <p><strong>1.2.-</strong> Que quienes la vienen representando cuentan con las facultades legales suficientes para celebrar el presente contrato, mismas que no les han sido limitadas ni revocadas en forma alguna.</p>
  <p><strong>1.3.-</strong> Que dentro de su objeto social de forma enunciativa, más no limitativa, está la construcción, compraventa, administración, ejecución, promoción por cuenta propia o por conducto de terceros de toda clase de inmuebles o desarrollos inmobiliarios.</p>
  <p><strong>1.4.-</strong> Que su domicilio fiscal y su Registro Federal de Contribuyentes son los establecidos en la CARÁTULA.</p>
  <p><strong>1.5.-</strong> Que bajo protesta de decir verdad, cuenta con las facultades necesarias para realizar la comercialización de la UNIDAD PRIVATIVA identificada en el apartado 4 cuatro de la CARÁTULA (en lo sucesivo la UNIDAD PRIVATIVA), y que previamente a la celebración del presente contrato, toda la documentación que legitima su propiedad fue puesta a disposición de EL COMPRADOR, en el domicilio de EL VENDEDOR, así como en el propio desarrollo inmobiliario.</p>
  <p><strong>1.6.-</strong> Que la UNIDAD PRIVATIVA forma parte de un desarrollo inmobiliario el cual se regirá mediante el Régimen de Propiedad en Condominio (en lo sucesivo denominado el "Condominio").</p>
  <p><strong>1.7.-</strong> Que cuenta con las autorizaciones, licencias, uso de suelo, permisos necesarios, factibilidad técnica y servicios básicos para el desarrollo, consecución, preventa y venta de las unidades privativas resultantes a comercializar el inmueble objeto del presente contrato, y que el mismo no se encuentra sujeta a algún régimen especial como puede ser de manera enunciativa más no limitativa ejidal o comunal.</p>
  <p><strong>1.8.-</strong> Que previo a la celebración del presente contrato exhibió y explicó a EL COMPRADOR, el proyecto ejecutivo de construcción completo, así como que, puso a su disposición las licencias y permisos, planos arquitectónicos y la maqueta digital, el Régimen de Propiedad en Condominio y los respectivos Reglamentos a los cuales se sujeta la UNIDAD PRIVATIVA, en el domicilio de EL VENDEDOR, en donde han sido puestos a su disposición, los cuales puede consultar en todo momento en las oficinas de EL VENDEDOR.</p>
  <p><strong>1.9.-</strong> Puso a disposición de EL COMPRADOR, toda la información y documentación relativa jurídica, administrativa y estado actual registral de la UNIDAD PRIVATIVA objeto del presente contrato, así como la carta de derechos de EL COMPRADOR, y el Programa Interno de Protección Civil, de manera digital, mismos que están a su disposición en las oficinas de EL VENDEDOR.</p>
  <p><strong>1.10.-</strong> Que, al momento de la escrituración de la UNIDAD PRIVATIVA, esta deberá estar libre de todo gravamen y limitación de dominio, para su futura transmisión a EL COMPRADOR, si para el momento de llevar a cabo la celebración del presente contrato la UNIDAD PRIVATIVA o el macrolote del cual se desprenderá la misma, se encuentra comprometida mediante la existencia de garantía Hipoteca, Fiduciaria o de cualquier otra forma comprometida, EL VENDEDOR presentará a EL COMPRADOR la información y documentación soporte, en el entendido de que, bajo ninguna circunstancia se podrá transmitir la UNIDAD PRIVATIVA en escritura pública, si la misma continúa con alguna limitación de dominio.</p>
  <p><strong>2.- DE EL COMPRADOR:</strong></p>
  <p><strong>2.1.-</strong> Que cuenta con la capacidad legal suficiente para comparecer a la celebración del presente contrato, conforme a la información que se señala en el apartado 3 tres de la CARÁTULA.</p>
  <p><strong>2.2.-</strong> Que su domicilio y Registro Federal de Contribuyentes son los establecidos en la CARÁTULA.</p>
  <p><strong>2.3.-</strong> Que conoce perfectamente el Desarrollo Inmobiliario y las especificaciones del mismo en el cual se ubica la UNIDAD PRIVATIVA, mismas que le fueron exhibidas y explicadas por EL VENDEDOR.</p>
  <p><strong>2.4.-</strong> Que de conformidad con lo previsto por la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita (en lo sucesivo la LFPIORPI), declara bajo protesta de decir verdad que, no existen dueños beneficiarios respecto de la UNIDAD PRIVATIVA objeto del presente contrato, y que los recursos con los que abonará los anticipos y el precio total de operación de este contrato son de su exclusividad y los ha obtenido en actividades lícitas desempeñadas por él.</p>
  <p><strong>2.5.-</strong> Que es conforme de toda conformidad en sujetarse al Reglamento de Administración del Régimen de Propiedad en condominio que en su caso se constituya o se haya constituido y demás reglamentos que tengan relación con la UNIDAD PRIVATIVA, así como formar parte y acatar las disposiciones de la asociación de condóminos antes referida.</p>
  <p><strong>2.6-</strong> Que actúa en nombre propio y que es el único beneficiario de los actos que se contienen en el presente documento.</p>
  <h2>C L Á U S U L A S:</h2>
  <p><strong>PRIMERA. - OBJETO.</strong> Por medio del presente contrato, EL VENDEDOR vende en preventa a EL COMPRADOR la UNIDAD PRIVATIVA, descrita en el apartado 4 cuatro de la CARÁTULA.</p>
  <p>La UNIDAD PRIVATIVA objeto del presente CONTRATO tendrá las características, extensión del terreno aproximado (en caso de ser vivienda horizontal), superficie de construcción, tipo de estructura, superficie aproximada, medidas y linderos, previstas en el apartado 4 cuatro de la CARÁTULA, así como las instalaciones, especificaciones, acabados, accesorios, lugares de estacionamiento, servicios incluyendo los básicos, áreas de uso común con otros inmuebles y porcentaje de indiviso referido en el "Anexo D" de la CARÁTULA, manifestando EL COMPRADOR que, conoce la ubicación y el entorno del desarrollo inmobiliario, así como que el equipamiento urbano y rutas de transporte son los que determine la autoridad correspondiente.</p>
  <p>Las PARTES aceptan que la UNIDAD PRIVATIVA es una vivienda aún en construcción, por lo que, EL VENDEDOR se obliga a que ésta será concluida a más tardar en la fecha establecida en el apartado 4.- cuarto de la CARÁTULA.</p>
  <p><strong>SEGUNDA. - PRECIO Y FORMA DE PAGO:</strong></p>
  <p><strong>2.1.- Precio:</strong> Las partes convienen en que el precio total de la unidad materia de esta compraventa, será la cantidad prevista en el apartado 6 seis de la CARÁTULA, mismo que ya cuenta con los descuentos aplicables, según se establece en el apartado 5 cinco de la CARÁTULA y se pagará de conformidad a lo siguiente:</p>
  <p>a.- Un enganche a pagarse en términos y condiciones de lo establecido en el apartado 7 siete de la CARÁTULA.</p>
  <p>b.- El remanente al precio total de la unidad, después de descuentos, se pagará de conformidad a lo establecido en el apartado 7 siete de la CARÁTULA.</p>
  <p>b.1.- Para el caso de que, uno de los pagos se encuentre condicionado a la escrituración de la UNIDAD PRIVATIVA, en términos de lo previsto en el apartado 7 siete de la CARÁTULA, y en concordancia con la cláusula novena del CONTRATO, se considerará incumplimiento de EL COMPRADOR, si no acude a la notaría pública designada en términos del presente contrato, en la fecha precisada en la notificación que en su momento le notifique EL VENDEDOR.</p>
  <p>En relación con los anticipos y/o pagos descritos con antelación, y una vez llegadas las fechas establecidas para su realización, EL COMPRADOR se obliga a enviar a EL VENDEDOR a la dirección establecida en el apartado 2 dos de la CARÁTULA, con atención al departamento de cobranza o bien, al correo electrónico descrito en el apartado 12 doce de la CARÁTULA, los comprobantes de dichos abonos, a más tardar 5 cinco días naturales posteriores a la fecha en que se debió haber efectuado cada uno de ellos, los cuales serán recibidos "salvo buen cobro" por parte de EL VENDEDOR.</p>
  <p>Asimismo, EL COMPRADOR deberá conservar en todo momento los comprobantes de los movimientos bancarios con los que acredite el cumplimiento de sus obligaciones, pues en su momento deberá exhibirlos para el proceso de escrituración.</p>
  <p>Las partes manifiestan que, en caso de que cualquiera de las fechas de pago señaladas en la CARÁTULA, se tratase de un día inhábil, conforme a la legislación mexicana, el pago deberá ser liquidado el día hábil siguiente a la fecha de vencimiento del mismo.</p>
  <p>Las cantidades de dinero antes referidas en esta cláusula, serán consideradas como anticipos o aportaciones a cuenta del PRECIO TOTAL DE LA UNIDAD sin que por ellas se pueda comprender la propiedad ni la posesión de LA UNIDAD PRIVATIVA, la cual será transmitida única y exclusivamente hasta en tanto no se realice el pago del precio total de la UNIDAD PRIVATIVA y se lleve a cabo la escritura correspondiente, siempre y cuando EL COMPRADOR hubiere cumplido con todas y cada una de las obligaciones que asume, ya que este contrato se celebra con reserva de dominio hasta que no sea pagado el precio total de la unidad y se hubiere cumplido con la obligaciones del presente contrato en tiempo y forma.</p>
  <p>Las partes expresamente convienen en que, para el caso de que el avalúo realizado a la UNIDAD PRIVATIVA para efectos de escrituración, arroje un valor distinto al precio total de la unidad, establecida en este contrato, EL COMPRADOR se obliga a pagar dicha UNIDAD PRIVATIVA el precio que ha quedado pactado en esta cláusula, como precio total de la unidad.</p>
  <p>El precio total de la unidad, es en moneda nacional, en caso de expresarse en moneda extranjera, se estará al tipo de cambio que rija en el lugar y fecha en que se realice el pago, de conformidad con la legislación aplicable.</p>
  <p>Los conceptos de pago a cargo de EL COMPRADOR, deben ser cubiertos con el método de pago referido anteriormente y atendiendo lo previsto en el apartado 8 ocho de la CARÁTULA, y en caso de que el saldo a pagarse contra la escrituración provenga de un crédito que vaya a ser otorgado a EL COMPRADOR, por una institución de crédito o de financiamiento tercera, será por cuenta y riesgo de EL COMPRADOR, la obtención de dicho crédito y el pago puntual del saldo en los términos en que se obliga en este contrato, sin que pueda haber ninguna excepción al pago en caso de que por cualquier motivo no obtenga el crédito.</p>
  <p><strong>2.1.1. Intereses.</strong> La falta de pago oportuno de uno o más pagos o de cualquiera de las cantidades que se deban de cubrir a favor de EL VENDEDOR generarán el pago de intereses moratorios a razón del 2% (dos por ciento) mensual, sobre saldos vencidos o en su defecto, EL VENDEDOR podrá optar por la rescisión del presente contrato y solicitar el pago efectivo de la pena convencional, y lo dispuesto para tal efecto en el contrato. Los intereses correspondientes empezarán a generarse desde el día siguiente a aquel en que debió de efectuarse el pago correspondiente y hasta que sea liquidado totalmente la cantidad adeudada y sus accesorios.</p>
  <p><strong>2.2.- Lugar de Pago:</strong> Las cantidades objeto del presente Contrato se pagarán en el domicilio convencional de EL VENDEDOR señalado en el punto 2 dos la CARÁTULA, entre estas los intereses y cualquier otra obligación económica a su cargo, sin necesidad de recordatorio o previo cobro, pudiendo elegir para el pago, entre las siguientes opciones que a continuación se establecen;</p>
  <p>a) Por medio de cheque bancario (en lo sucesivo "cheque") depositado a la cuenta señalada en el apartado 8 de la carátula. Cualquier cheque se recibirá "salvo buen cobro" de la totalidad de la cantidad amparada por el mismo.</p>
  <p>En caso que la cantidad amparada por el cheque no pudiera ser cobrada en forma total, EL COMPRADOR se compromete a liquidar el adeudo correspondiente e intereses generados de conformidad con el numeral 2.1 de la presente clausula, a favor de EL VENDEDOR.</p>
  <p>b) Mediante depósito bancario en la cuenta que al efecto se establece en el apartado 8 de la CARÁTULA, bajo el entendido de que, para pagos en efectivo, no se podrán efectuar por un valor igual o superior al equivalente a 8,025 (ocho mil veinticinco) veces Unidades de Medida y Actualización (UMA) diaria, o su respectivo tipo de cambio en moneda extranjera, conforme a lo establecido en la LFPIORPI.</p>
  <p>c) Mediante transferencia electrónica en la cuenta que al efecto se establece en el apartado 8 ocho de la CARÁTULA del presente Contrato.</p>
  <p>De conformidad con la LFPIORPI será responsabilidad exclusiva de EL COMPRADOR el resguardar sus comprobantes originales, para efectos de su entrega y acreditación posterior a la Notaría donde se llevará a cabo la escrituración definitiva de la UNIDAD PRIVATIVA, la forma de pago y fechas en que se efectuaron cada uno de los pagos correspondientes al precio total de la unidad, en los términos del artículo 33 de la citada ley.</p>
  <p>Salvo lo antes precisado y en los términos señalados, EL COMPRADOR conviene y se da por enterado de que los agentes, vendedores, promotores, comisionistas, gerentes, directores, etc., NO están facultados para recibir dinero en efectivo en nombre EL VENDEDOR, y/o recibir cheques a nombre de persona distinta a la señalada en la carátula y por consiguiente EL COMPRADOR no podrá reclamar obligación alguna a cargo de EL VENDEDOR por la cantidades entregadas a los agentes, vendedores, promotores, comisionistas, gerentes, directores, y demás, por lo que EL VENDEDOR no reconocerá y por ende no sé hará responsable de pagos efectuados en forma distinta a lo expresado en los incisos a), b) y c) de la presente cláusula.</p>
  <p>El VENDEDOR deberá emitir las facturas correspondientes a el COMPRADOR, mismas que deberán contar con los requerimientos fiscales vigentes.</p>
  <p><strong>TERCERA. - GESTIONES Y GASTOS OPERATIVOS.</strong> Gastos Operativos. - En virtud del presente contrato, es posible que se generen gastos operativos, distintos del precio total de la unidad, por concepto que pueden ser de manera enunciativa más no limitativa, tales como investigación, apertura de crédito, avalúo, gastos de escrituración, impuestos, derechos de registro, administración, entre otros, los cuales, EL COMPRADOR, desde este momento reconoce que serán a su cuenta y cargo, obligándose a pagarlos atendiendo las requisiciones de estos.</p>
  <p>En caso de terminación de este contrato, todos los pagos que EL COMPRADOR haya realizado por concepto de gastos operativos tales como el avalúo entre otros, no serán considerados como parte del precio y por lo tanto no serán devueltos a EL COMPRADOR en caso de terminación del contrato, únicamente le serán devueltos aquellos gastos no comprobados por EL VENDEDOR en términos del párrafo anterior.</p>
  <p><strong>Información para gestionar crédito.</strong> En caso de que el COMPRADOR requiera información de la UNIDAD PRIVATIVA para el otorgamiento de un crédito, EL VENDEDOR en este acto se obliga a entregar a EL COMPRADOR toda la información razonable de la UNIDAD PRIVATIVA que se requiera con el fin de que éste último cumpla con los requisitos que cualquier institución acreditante establezca para el otorgamiento del crédito.</p>
  <p><strong>CUARTA. - CANCELACIÓN DE LA COMPRAVENTA.</strong> - EL COMPRADOR cuenta con un plazo de 5 cinco días hábiles posteriores a la firma del contrato para solicitar la cancelación del presente contrato, sin responsabilidad alguna de su parte, mediante aviso que por escrito realice, de conformidad a lo establecido en la cláusula Vigésima. Este aviso necesariamente se deberá dar al domicilio de EL VENDEDOR, debidamente recibido con el sello de EL VENDEDOR. Independientemente de la notificación prevista, será requisito indispensable que se celebre la cancelación respectiva al contrato, en un plazo que no podrá exceder de 15 quince días contados a partir de la recepción de la notificación por parte de EL VENDEDOR. Ante la cancelación del contrato, EL VENDEDOR se obliga a reintegrar todas las cantidades a EL COMPRADOR, mediante cheque, dentro de los 15 días hábiles siguientes a la celebración de la cancelación en comento. En caso de que no se restituyeren las cantidades a EL COMPRADOR dentro del plazo establecido, EL VENDEDOR deberá pagar a su contraparte un interés moratorio a razón del 6% seis por ciento anual sobre la cantidad no devuelta por el tiempo que medie el retraso.</p>
  <p><strong>QUINTA.- RÉGIMEN DE PROPIEDAD EN CONDOMINIO.</strong> La UNIDAD PRIVATIVA se encontrará sujeta a un Régimen de Propiedad en Condominio (en lo sucesivo el CONDOMINIO) por lo que EL COMPRADOR quedará obligado a respetar las servidumbres, limitaciones y áreas comunes propias del CONDOMINIO, así como a efectuar el pago puntual de las cuotas de mantenimiento y administración del CONDOMINIO y/o asociación de condóminos que en su caso se constituya o que ya se encuentre constituido, y en caso de su incumplimiento, los intereses moratorios y penas convencionales que se generen, siendo en su perjuicio exclusivo cualquier acción que ejerciten los órganos del CONDOMINIO y/o asociación de condóminos en su caso, respecto de la UNIDAD PRIVATIVA y los derechos de copropiedad en áreas comunes que le correspondan, siendo responsable directo éste último de cualquier daño o perjuicio que esos actos u omisiones causen a EL VENDEDOR.</p>
  <p>EL COMPRADOR se obliga a pagar puntual y oportunamente las cuotas de mantenimiento, dichas cantidades deberán de cubrirse desde el momento en que se realice la entrega de la posesión física de la UNIDAD PRIVATIVA o, que sea puesta a disposición de EL COMPRADOR, en el entendido de que, previo a la escrituración respectiva, deberá acompañar el certificado de no adeudo de cuotas de mantenimiento.</p>
  <p><strong>SEXTA.- DESTINO Y DESLINDE DE LA UNIDAD PRIVATIVA.-</strong> Se establece como limitación de uso para la UNIDAD PRIVATIVA, la precisada dentro del apartado 4 cuarto de la CARÁTULA.</p>
  <p>El COMPRADOR tendrá prohibido realizar cualquier alteración a la UNIDAD PRIVATIVA sin previa autorización del VENDEDOR y/o de conformidad con lo establecido en el Reglamento del Condominio, según sea el caso.</p>
  <p>Las partes acuerdan que, en caso de diferencia en la superficie al momento de llevar a cabo la entrega física de la UNIDAD PRIVATIVA, las partes, mediante la celebración y firma del acta de entrega que se genere ante dicho evento, deberán aceptar de común acuerdo la continuación de dicha operación atendiendo los siguientes supuestos:</p>
  <p>a) En caso de que resultara diferencia a favor de EL COMPRADOR, en cuanto la superficie del UNIDAD PRIVATIVA, el valor por metro cuadrado será el precisado en el apartado 5 cinco de la CARÁTULA, autoriza irrevocablemente a EL VENDEDOR en su caso destinar dicho saldo a amortizar el pago de capital e intereses derivados del presente contrato, y en su caso, a las cuotas de mantenimiento, cuotas de la asociación civil, predial, cuotas de servicios de agua potable y alcantarillado, siempre y cuando le haya sido entregada o puesta a su disposición la UNIDAD PRIVATIVA, honorarios fiduciarios y cualquier otra aplicable a la UNIDAD PRIVATIVA, y que deba ser pagada por EL COMPRADOR, quedando lo anterior a elección de EL VENDEDOR o;</p>
  <p>b) En caso de que resultare alguna diferencia en la superficie de la UNIDAD PRIVATIVA a cargo de El COMPRADOR deberá pagar el monto resultante en cantidad liquida de conformidad con el apartado 5 cinco de la CARÁTULA a más tardar dentro de los 3 tres días hábiles posteriores a la fecha en que se lleve a cabo la entrega de posesión física de la UNIDAD PRIVATIVA, so pena de hacerse acreedor al cobro de intereses en los términos pactados en la cláusula segunda.</p>
  <p>c) Las partes acuerdan que, las diferencias no deberán ser mayores a un 10% diez por ciento, ya sea a la baja o al alza, en caso contrario será facultad del COMPRADOR, el dar por terminado el presente contrato o a su propio criterio continuar con operación respetando en todo momento el precio por metro cuadrado previsto en la CARÁTULA.</p>
  <p>EL COMPRADOR se obliga a respetar el uso habitacional de la UNIDAD PRIVATIVA, por lo que le está prohibido instalar en el mismo cualquier tipo de comercio. A fin de preservar el entorno urbanístico y arquitectónico del lugar en donde se encuentra ubicada la UNIDAD PRIVATIVA, en su caso, EL COMPRADOR se obliga a obtener de las autoridades correspondientes, las autorizaciones necesarias a efecto de realizarle cualquier modificación. Asimismo, EL COMPRADOR se obliga a cumplir con el reglamento y las disposiciones del Régimen de Propiedad en Condominio, de los cuales es parte la UNIDAD PRIVATIVA.</p>
  <p><strong>SÉPTIMA.- EVICCIÓN, VICIOS OCULTOS Y RESPONSABILIDAD CIVIL.-</strong> EL COMPRADOR cuenta con los siguientes plazos para ejercer las acciones civiles relacionadas con la UNIDAD PRIVATIVA, ante las autoridades jurisdiccionales:</p>
  <table class="civ">
    <tr><th>Acción Civil</th><th>Plazo en el cual prescribe la acción</th><th>Disposiciones Jurídicas y Legislación Aplicable</th></tr>
    <tr><td>Responsabilidad Civil</td><td>2 años</td><td>Código Civil Federal, artículo 1161, fracción V, y/o equivalentes del Código Civil del Estado de Sinaloa</td></tr>
    <tr><td>Vicios Ocultos</td><td>6 meses</td><td>Código Civil Federal, artículos 2142 y 2149, y/o equivalentes del Código Civil del Estado de Sinaloa</td></tr>
    <tr><td>Evicción</td><td>10 años</td><td>Código Civil Federal, artículo 1159, y/o equivalentes del Código Civil del Estado de Sinaloa</td></tr>
  </table>
  <p><strong>OCTAVA.- RESERVA DE DOMINIO Y POSESIÓN.</strong></p>
  <p><strong>8.1.-</strong> Se establece reserva de dominio en favor de EL VENDEDOR sobre la UNIDAD PRIVATIVA objeto del presente contrato, la cual permanecerá vigente hasta el día del pago de la totalidad de las prestaciones económicas que se originan en este contrato a cargo del COMPRADOR y una vez que se lleve a cabo a su favor la correspondiente escritura de cancelación de dicha reserva.</p>
  <p><strong>8.2.-</strong> EL VENDEDOR entregará a EL COMPRADOR la posesión jurídica y/o material de la UNIDAD PRIVATIVA, siempre que EL COMPRADOR realice el pago total del precio total de la unidad, salvo que EL VENDEDOR a criterio propio, opte por entregar y/o poner a disposición de EL COMPRADOR la UNIDAD PRIVATIVA, sin haber recibido la totalidad del pago del precio total de la unidad, y no exista impedimento legal alguno para realizar dicha entrega, sin que esto se considere una obligación a su cargo.</p>
  <p>Para que se tenga cumplido lo anterior, bastará con la notificación por escrito que EL VENDEDOR haga en el domicilio convencional de EL COMPRADOR, en el que se le indique la fecha, hora y lugar de entrega de su UNIDAD PRIVATIVA, misma que se entenderá con quien se encuentre en dicho domicilio.</p>
  <p>EL VENDEDOR se responsabiliza del mantenimiento de la UNIDAD PRIVATIVA desde este momento y hasta la fecha en que ésta transmita a EL COMPRADOR la posesión física de la misma, a partir de ese momento EL COMPRADOR se obliga a pagar puntualmente y oportunamente las cuotas de mantenimiento, cuotas por los servicios de agua potable y alcantarillado, impuesto predial y cualquier otro concepto derivado de las obligaciones asumidas y pactadas en el presente contrato, cantidades que deberán de cubrirse desde el momento en que se realice la entrega de la posesión física de la UNIDAD PRIVATIVA o, que sea puesta a disposición de EL COMPRADOR, aún en el supuesto de que no la hubiese recibido o no haya acudido al acto de la entrega, so pena de considerarse incumplimiento al presente contrato, para lo cual serían aplicables las consecuencias previstas en el mismo.</p>
  <p>El retraso en la fecha de entrega de LA UNIDAD PRIVATIVA fijada en la notificación a que se ha hecho referencia, y una vez que la autoridad haya emitido la habitabilidad, dará lugar al pago de una pena igual al interés legal anual, por cada día de retraso de EL VENDEDOR; salvo que EL VENDEDOR acredite fehacientemente que dicho incumplimiento es consecuencia del caso fortuito o fuerza mayor que afecte directamente a EL VENDEDOR o a la UNIDAD PRIVATIVA, pudiéndose pactar para tal caso, sin responsabilidad alguna, una nueva fecha de entrega; asimismo, EL VENDEDOR queda liberado de dicha responsabilidad si por alguna razón EL COMPRADOR no acudiere a las citas de entrega de la UNIDAD PRIVATIVA.</p>
  <p>EL VENDEDOR debe entregar la UNIDAD PRIVATIVA con acceso a las instalaciones y condiciones necesarias para la provisión y suministro de los servicios básicos de energía eléctrica, abastecimiento de agua potable y desalojo de aguas residuales, aprovechamiento de gas L.P. o gas natural según aplique y se establezca en el Anexo D; lo cual ya está incluido en el precio de venta de la UNIDAD PRIVATIVA, por lo que, EL COMPRADOR, no debe pagar ningún costo adicional por los conceptos enunciados, salvo que EL COMPRADOR deberá adquirir por su cuenta el tanque de gas y contrato de servicio de gas, así como los contratos y medidores de energía eléctrica y de agua potable. En caso de que EL VENDEDOR entregue la vivienda sin las instalaciones antes mencionadas, deberá compensar a EL COMPRADOR, por concepto de daños y perjuicios con el 10% diez por ciento del precio pagado por la compradora en virtud de la compraventa.</p>
  <p>Al momento de entregar la UNIDAD PRIVATIVA, EL VENDEDOR, conjuntamente con EL COMPRADOR, realizarán una revisión ocular al tenor de lo pactado por las partes en el "acta de entrega - recepción" misma que deberá asentar el estado y componentes con los que se recibe la UNIDAD PRIVATIVA.</p>
  <p>Si una vez que EL COMPRADOR, se encuentre en pleno uso y goce de la UNIDAD PRIVATIVA, éste se percata de la existencia de diferencias entre las características reales de la UNIDAD PRIVATIVA con las manifestaciones hechas y descritas en la comercialización realizada en su momento y establecida en los promocionales de dicha UNIDAD PRIVATIVA y/o de defectos o fallas en la misma, debe notificar dicha situación a EL VENDEDOR por escrito de acuerdo al procedimiento del área de postventa o de atención a clientes de EL VENDEDOR, que se le hubiere indicado al momento de recibir la UNIDAD PRIVATIVA. EL COMPRADOR, debe especificar las diferencias que requieran ser subsanadas y/o los defectos o fallas que deben ser reparados. EL VENDEDOR se obliga a efectuar las adecuaciones y/o reparaciones necesarias en el plazo que acuerde con el EL COMPRADOR una vez hecha la validación física de la garantía a atender. En todo caso, para los efectos de lo señalado en este párrafo, las partes se estarán a lo establecido en el presente contrato con relación a las garantías, defectos o fallas, así como en la póliza de garantía que deberá entregar EL VENDEDOR en favor de EL COMPRADOR.</p>
  <p><strong>NOVENA. - ESCRITURACIÓN DE LA UNIDAD PRIVATIVA.</strong></p>
  <p><strong>9.1.-</strong> Este Contrato se elevará a escritura pública ante el notario que seleccione EL COMPRADOR, de conformidad a lo establecido en los apartados 4 cuarto y 10.1. diez punto uno de la CARÁTULA, el cual se deberá seleccionar desde la firma del presente CONTRATO, una vez que hayan sido liquidadas totalmente las obligaciones a cargo de EL COMPRADOR, incluyendo el pago de los impuestos, servicios, cuotas de mantenimiento y en general erogaciones que se hayan generado desde el momento de la entrega y/o puesta a disposición de la UNIDAD PRIVATIVA, siempre y cuando a EL VENDEDOR tenga la posibilidad legal de llevar a cabo dicha escrituración y cuente con todas las autorizaciones y permisos necesarios, en el entendido de que la transmisión se realizará libre de gravámenes, limitaciones de dominio o anotaciones preventivas y al corriente en el pago de las contribuciones que lo gravan. En el supuesto de que la compradora no comparezca a la firma de la escritura pública referida, sin causa que lo justifique, la vendedora podrá optar por rescindir el presente contrato y aplicar los daños y perjuicios que se prevén en este contrato para el incumplimiento de EL COMPRADOR.</p>
  <p><strong>9.2.- Notificación para Escrituración.</strong> - Se llevará a cabo en los siguientes términos:</p>
  <p>a) <strong>Primera Notificación para Escrituración:</strong> EL VENDEDOR notificará por escrito a EL COMPRADOR y/o ante cualquier persona que se encuentre en el domicilio convencional o correo electrónico designados en la CARÁTULA; el día, mes, año, hora y lugar en el cual debe comparecer ante notario público para la firma de la Escritura Pública. Será obligación de EL COMPRADOR hacer llegar toda la información y documentación que requiera el notario, con una anticipación no menor a 7 siete días hábiles previos a la firma de la escritura, se acompaña a manera de referencia un Check List (listado) de la documentación que el notario pudiera solicitar en su momento, mismo que se integra al presente contrato a manera de Anexo B, el cual se denomina "Documentación de identificación de EL COMPRADOR".</p>
  <p>b) <strong>Segunda Notificación para Escrituración:</strong> En caso de que EL COMPRADOR no se presente a la cita referida en el párrafo que antecede, EL VENDEDOR le notificará por segunda y última ocasión a EL COMPRADOR la nueva fecha para que EL COMPRADOR comparezca a la firma de la escritura pública esta nueva fecha de la segunda notificación, deberá tener como fecha de verificativo, por lo menos 15 quince días hábiles siguientes a la fecha en que se debió de haber celebrado la escritura de acuerdo a la primera notificación, apercibiéndolo de que en caso de no comparecer, será acreedor de la penalización establecida en el presente punto, además de las cantidades así pactadas, entre estas, los gastos administrativos correspondientes a la UNIDAD PRIVATIVA.</p>
  <p>c) <strong>No Comparecencia:</strong> En caso de que EL COMPRADOR, no comparezca a la cita indicada en la segunda notificación para escrituración y por tanto, no se lleve a cabo la celebración de dicha escritura, EL VENDEDOR podrá dar por rescindido y/o terminado totalmente el presente contrato, entregando en el domicilio convencional de EL COMPRADOR una notificación de rescisión total (en lo sucesivo la "Notificación de Rescisión Total"), misma que será efectiva en un plazo de 5 (cinco) días a partir de la fecha establecida en dicha notificación.</p>
  <p>EL COMPRADOR acepta expresamente que este contrato quedará rescindido y/o terminado totalmente, sin necesidad de declaración judicial y liberará a EL VENDEDOR de cualquier obligación a su cargo, en el supuesto descrito en el inciso c) anterior de la presente cláusula.</p>
  <p>La notificación antes aludida se deberá realizar con acuse de recibido y enviar al domicilio convencional señalado por EL COMPRADOR en la CARÁTULA, en el caso de que no pudiese existir un acuse de recibo de la notificación antes precisada, ambas partes acuerdan expresamente que quedará a elección unilateral de EL VENDEDOR elegir entre cualquiera de las siguientes opciones de conformidad con el apartado 3 de la CARÁTULA: (i) enviar dicha notificación por e-mail a la dirección de correo electrónico o bien, (ii) notificarlo en el domicilio convencional.</p>
  <p>En caso de quedar rescindido el presente contrato en virtud del procedimiento anterior, se estará a lo establecido en el inciso 15.3 de la cláusula decimoquinta.</p>
  <p><strong>DÉCIMA.- GARANTÍAS, DEFECTOS Y FALLAS.</strong></p>
  <p><strong>Garantía.</strong> La UNIDAD PRIVATIVA objeto del contrato cuenta con garantía, misma que tiene una vigencia de 5 cinco años, para cuestiones estructurales; de 3 tres años, para impermeabilización; y para los demás elementos será de 1 un año. Dichos plazos, son irrenunciables y se contarán a partir de la entrega real o puesta a su disposición de la UNIDAD PRIVATIVA.</p>
  <p>Al tenor de la garantía, EL VENDEDOR debe cubrir sin costo alguno para EL COMPRADOR cualquier acto tendiente a la reparación de los defectos o fallas que presente la UNIDAD PRIVATIVA.</p>
  <p><strong>Defectos o fallas.</strong> En caso de que EL COMPRADOR, haya hecho valer la garantía establecida en la cláusula del contrato, y, no obstante, persistan los defectos o fallas imputables a EL VENDEDOR, se estará a lo dispuesto en la carta de derechos que forma parte integrante del presente contrato como Anexo G, denominado "Carta de Derechos de EL COMPRADOR".</p>
  <p><strong>Disposiciones PROFECO.</strong></p>
  <p><strong>Defectos o fallas.-</strong> En caso de que EL COMPRADOR haya hecho valer las garantías establecidas en el contrato y no obstante continúen los defectos o fallas imputables a EL VENDEDOR, este se obliga de nueva cuenta a realizar todas las reparaciones necesarias para corregirlas de inmediato, así como a otorgarle a la compradora:</p>
  <p>a) En caso de defectos o fallas graves (aquellos que afecten la estructura o las instalaciones del inmueble comprometiendo el uso pleno o la seguridad del mismo, o bien, impidiendo que EL COMPRADOR use, goce y disfrute la UNIDAD PRIVATIVA conforme a su naturaleza o destino), EL VENDEDOR realizará una bonificación del 20% del precio total de la compraventa establecido en la cláusula segunda del contrato.</p>
  <p>b) En el caso de defectos o fallas leves (aquellos que no sean graves), una bonificación del 5% sobre el valor de la reparación.</p>
  <p>En caso de que los defectos o fallas graves sean determinados por EL VENDEDOR como de imposible reparación, éste podrá optar, desde el momento en que se le exija el cumplimiento de la garantía, por sustituir la UNIDAD PRIVATIVA, asumiendo los gastos relacionados con dicha sustitución, sin que haya lugar a la bonificación.</p>
  <p>En caso de que, en cumplimiento de la garantía, EL VENDEDOR decida reparar los defectos o fallas graves y no lo haga, quedará sujeta a la bonificación y EL COMPRADOR podrá optar por cualquiera de las acciones señaladas a continuación: Solicitar la sustitución de la UNIDAD PRIVATIVA, en cuyo caso EL VENDEDOR asumirá todos los gastos relacionados con la misma; o solicitar la rescisión del contrato, en cuyo caso EL VENDEDOR tendrá la obligación de reintegrarle el monto pagado, así la pena convencional prevista en el contrato.</p>
  <p>A fin de determinar lo previsto anteriormente, será indispensable que un perito experto en la materia determine las fallas graves o leves que se reclamen, siguiendo además el proceso de notificación y los canales previstos en el contrato.</p>
  <p><strong>DÉCIMA PRIMERA.- PROYECTO ARQUITECTÓNICO, REGLAMENTO, SERVIDUMBRES Y RESTRICCIONES DE CONSTRUCCIÓN.</strong> El COMPRADOR en éste acto reconoce que la UNIDAD PRIVATIVA que adquiere, es un inmueble aún en construcción por EL VENDEDOR, con apego a ciertas especificaciones físicas, técnicas y de construcción, según se desprende de los Anexos del contrato.</p>
  <p>Una vez entregada la UNIDAD PRIVATIVA totalmente construida a EL COMPRADOR, si este considera necesario o bajo su criterio y propia decisión necesita realizar y/o realiza alguna construcción, adaptación, mejora o de cualquier forma modifica la construcción y las especificaciones físicas y técnicas con las cuales se le entrega la UNIDAD PRIVATIVA, deberá contar con los permisos y autorizaciones necesarias para tal efecto. EL COMPRADOR presentará ante el comité de construcción, para su aprobación, previamente a cualquier edificación o construcción, el proyecto respectivo, mismo que deberá ajustarse y sujetarse a los requisitos y disposiciones del Reglamento de Diseño, Construcción e Imagen del Desarrollo Inmobiliario en el que se localiza la UNIDAD PRIVATIVA, así como, del Reglamento de Administración del existente o futuro Régimen de Propiedad en Condominio y demás Reglamentos, por lo que EL COMPRADOR se obliga expresamente a respetarlos en todas sus partes, por ende se obligan expresamente a respetar las servidumbres y restricciones de construcción, que se señalan tanto en esos Reglamentos como en el plano que firmado por las partes forma parte integrante del presente contrato como anexo A, además de las que para el efecto, señalen las autoridades municipales. Ante la construcción y/o modificación que señala el párrafo anterior, EL COMPRADOR será el único responsable ante terceros.</p>
  <p><strong>Terminación de construcciones.</strong> De acuerdo con lo señalado en la cláusula primera, EL VENDEDOR estima que la construcción del desarrollo inmobiliario y de la unidad privativa concluya en un plazo que no excederá del día establecido en el apartado 4 cuarto de la CARÁTULA (en lo sucesivo el plazo de terminación de la UNIDAD PRIVATIVA) sin embargo, si por causas no previstas, como pudieran ser caso fortuito o fuerza mayor, ajenas a EL VENDEDOR, causas de la naturaleza o de autoridad que lo retrasen, que no serán responsabilidad de ninguna de las partes, y en ese caso el plazo estimado para concluir la construcción se extenderá hasta que se resuelva esa contingencia ajena a las partes. Se entenderá cumplido el plazo de terminación aun cuando las obras sobre las áreas comunes y/o el Desarrollo Inmobiliario se encuentren en un avance del 90% noventa por ciento, siempre y cuando por lo menos estas posibiliten un acceso seguro, adecuado y en condiciones razonables de uso de la Unidad Privativa. En caso que EL VENDEDOR requiera modificar el proyecto ejecutivo del desarrollo inmobiliario en el cual se encontrará de la UNIDAD PRIVATIVA, o la propia UNIDAD PRIVATIVA, presentado al momento de celebrar el presente CONTRATO, durante la obra, debe notificar dicha situación a EL COMPRADOR; debiendo esta última autorizar de forma expresa por escrito, continuar con la compra de la UNIDAD PRIVATIVA, o solicitar la devolución de las cantidades que hubiere pagado a EL VENDEDOR, así como el pago de intereses al tipo legal sobre las cantidades que hubiere entregado a EL VENDEDOR en cumplimiento de este contrato, únicamente cuando las modificaciones sean sobre la forma, características y especificaciones del Condominio, las características y medidas de las áreas comunes del condominio y todo aquello que sea esencial y particular de la UNIDAD PRIVATIVA objeto de este contrato, salvo que sea por orden de autoridad, ya que en las demás características del desarrollo inmobiliario EL VENDEDOR se reserva el derecho de hacer modificaciones al proyecto. Si llegara el caso de existir diferencias entre la superficie de la UNIDAD PRIVATIVA y las resultantes a la conclusión de su edificación definitiva, que puedan variar más de un 5% cinco por ciento, las partes ajustarán el precio de la operación previsto en la CLÁUSULA SEGUNDA y el apartado 5 Quinto de la Carátula, a razón del precio por metro cuadrado que se estableció en la cláusula segunda del presente contrato, en protección de EL COMPRADOR.</p>
  <p><strong>DÉCIMA SEGUNDA. - OBLIGACIONES Y DERECHOS DE LAS PARTES. Obligaciones.</strong></p>
  <p><strong>I) EL VENDEDOR queda obligado, a lo siguiente:</strong></p>
  <p>a) No celebrar ni comprometer la venta de la UNIDAD PRIVATIVA con ningún tercero, mientras EL COMPRADOR cumpla con lo pactado en este Contrato y sus adjuntos.</p>
  <p>b) Hacer la entrega física y/o jurídica de la UNIDAD PRIVATIVA a EL COMPRADOR de acuerdo con las disposiciones pactadas en el presente contrato.</p>
  <p>c) Brindar información y publicidad veraz, clara y actualizada de la UNIDAD PRIVATIVA y sus características.</p>
  <p>d) Poner a disposición de EL COMPRADOR la información y documentación de la UNIDAD PRIVATIVA.</p>
  <p>e) No condicionar la compraventa a la contratación de servicio(s) adicional(es).</p>
  <p>f) Respetar el derecho de EL COMPRADOR a cancelar la operación de consumo sin responsabilidad alguna dentro de los 5 cinco días hábiles contados a partir de la firma del contrato.</p>
  <p>g) En su caso, construir la vivienda con apego a las características y condiciones ofrecidas.</p>
  <p>h) Cumplir con las obligaciones previstas en este contrato como lo son: a) Transferir la propiedad de la UNIDAD PRIVATIVA a EL COMPRADOR; b) Entregar a EL COMPRADOR, la UNIDAD PRIVATIVA en los términos y plazos acordados; c) Responsabilizarse de los daños y perjuicios ocasionados a EL COMPRADOR si procede con dolo o mala fe en la contratación; d) Garantizar la calidad de la UNIDAD PRIVATIVA; e) Responder ante evicción o vicios ocultos.</p>
  <p><strong>II) EL COMPRADOR queda obligado a lo siguiente:</strong></p>
  <p>a) Destinar la UNIDAD PRIVATIVA al uso señalado en la CARÁTULA y de acuerdo con las disposiciones del Reglamento de Administración del Régimen de Propiedad en Condominio y del Reglamento de Diseño, Construcción e Imagen del Desarrollo Inmobiliario donde se ubica la UNIDAD PRIVATIVA.</p>
  <p>b) Cumplir con todas y cada una de las obligaciones que se precisan en el presente contrato, incluidas las obligaciones de pago en un precio cierto y en dinero, en los tiempos y fechas previstos en la CARÁTULA.</p>
  <p>c) Cumplir con el pago de las obligaciones a su cargo, incluido el pago de derechos, impuestos, contribuciones, servicios, cuotas de mantenimiento y las diversas erogaciones correspondientes.</p>
  <p><strong>Derechos:</strong></p>
  <p><strong>I) EL VENDEDOR tiene derecho, a lo siguiente:</strong></p>
  <p>a) Recibir por la entrega de la UNIDAD PRIVATIVA objeto del contrato un precio cierto y en dinero.</p>
  <p>b) Recibir los pagos en el tiempo, lugar y forma acordados.</p>
  <p><strong>II) EL COMPRADOR tiene derecho, a lo siguiente:</strong></p>
  <p>a) Recibir y obtener lo relativo a las obligaciones establecidas a EL VENDEDOR, incluida recibir la información y publicidad veraz, y actualizada de la UNIDAD PRIVATIVA, recibir la documentación e información relativa a la UNIDAD PRIVATIVA; cancelar la operación dentro de los 5 cinco días hábiles siguientes a la firma del CONTRATO; recibir la propiedad de la UNIDAD PRIVATIVA en los términos acordados; exigir la reparación del daño o perjuicios ocasionados en caso de que EL VENDEDOR proceda con dolo o mala fe; ejercer las garantías sobre la UNIDAD PRIVATIVA, ejercer la acción civil ante la evicción o vicios ocultos.</p>
  <p><strong>DÉCIMA TERCERA. - EROGACIONES E IMPUESTOS.</strong></p>
  <p>Todos los gastos, honorarios, impuestos, derechos y cualesquier otras erogaciones, que se causen con motivo del presente contrato, así como por la celebración de la escritura respectiva, el avalúo inmobiliario, gastos de escrituración, honorarios, impuestos, derechos y comisiones o gastos aplicables por apertura de crédito, en su caso, por cuenta de EL COMPRADOR con la excepción del Impuesto sobre la Renta, el cual cubrirá directamente EL VENDEDOR.</p>
  <p>Sin perjuicio de lo anterior, a partir de que EL COMPRADOR reciba la posesión física de la UNIDAD PRIVATIVA o ésta sea puesta a su disposición, todos los gastos, honorarios, impuestos, derechos de toda clase y cualesquier otras erogaciones, relacionados con la UNIDAD PRIVATIVA, serán por cuenta de EL COMPRADOR, considerando lo establecido en la cláusula SEXTA del presente contrato, incluyendo de manera enunciativa más no limitativa, los honorarios fiduciarios, predial, gastos administrativos de la UNIDAD PRIVATIVA.</p>
  <p>Para el caso de que el COMPRADOR, incumpla con dichas obligaciones, le serán aplicables las consecuencias previstas en el contrato, de igual forma, será el único responsable ante terceros y autoridades, por la falta de dichos pagos, así pues, se obliga a sacar en paz y a salvo al VENDEDOR, así como a cubrir los gastos en los que incurra este último, para atender los reclamos de terceros y autoridades por los conceptos antes descritos en un plazo que no podrá exceder de 15 quince días, contados a partir de la fecha en que se haya notificado al COMPRADOR el suceso que origine o genere los citados gastos.</p>
  <p><strong>DÉCIMA CUARTA. - CESIÓN.</strong> Las partes acuerdan que EL COMPRADOR no podrá ceder sus derechos y/u obligaciones, sin previo consentimiento por escrito de EL VENDEDOR, sí al momento de pretender llevar a cabo dicha cesión, ya ha sido liquidado el precio total de operación" y únicamente se encuentre pendiente la escrituración donde se formalice la citada operación.</p>
  <p>Cualquier otra cesión de derechos, diversa a la señalada previamente, deberá ser autorizada por EL VENDEDOR, toda vez que dicha operación sería materia de otro contrato.</p>
  <p><strong>DÉCIMA QUINTA. - RESCISIÓN DEL CONTRATO.</strong></p>
  <p><strong>15.1. Causales de Rescisión.</strong> Serán causales de rescisión de este Contrato, además de las establecidas por la ley, las que a continuación se establecen:</p>
  <p>a) Que, en su caso, no se pueda hacer efectivo él o los cheques entregados por EL COMPRADOR, y no se haya enmendado tal circunstancia por EL COMPRADOR, dentro del plazo otorgado para tal efecto.</p>
  <p>b) La falta de pago de una o más exhibiciones a cargo de EL COMPRADOR, así como si transcurrió más de 01 (un) mes desde la fecha en que se le requiera el pago a EL COMPRADOR de alguna cantidad generada a favor de EL VENDEDOR de conformidad con las obligaciones asumidas en el presente Contrato y no se cubriera ese adeudo dentro del plazo establecido en la CARÁTULA.</p>
  <p>c) Que la UNIDAD PRIVATIVA no sea destinada al uso que se establece en el presente Contrato;</p>
  <p>d) Que EL COMPRADOR no comparezca a la firma de la escritura en los términos establecidos en el presente;</p>
  <p>e) La falta de entrega de la UNIDAD PRIVATIVA por EL VENDEDOR a EL COMPRADOR, aún y cuando este último se encuentre en cumplimiento a las obligaciones del contrato, y en los supuestos previstos en el mismo.</p>
  <p>f) La negativa en la escrituración de la UNIDAD PRIVATIVA por EL VENDEDOR a EL COMPRADOR, aún y cuando este último se encuentre en cumplimiento a las obligaciones del contrato, y en los supuestos previstos en el mismo.</p>
  <p>g) La falta de cumplimiento a cualquiera de las obligaciones contenidas en este contrato, a cargo de las partes.</p>
  <p>Independientemente de lo anterior, las partes aceptan y reconocen que si llegado el último día del plazo establecido para la escrituración de la UNIDAD PRIVATIVA de conformidad a lo dispuesto en la CARÁTULA y hasta en tanto EL VENDEDOR, no hubiere notificado la fecha de escrituración, en términos de lo establecido en el presente contrato y salvo lo previsto en el mismo para dicho caso en particular, EL COMPRADOR podrá elegir cualquiera de las siguientes opciones: (i) Dar por rescindido el presente contrato para lo cual se aplicará la pena convencional establecida en la cláusula décima sexta, o (ii) continuar con el contrato, liberando a la VENDEDOR de cualquier obligación de pago pactada en el presente contrato, su carátula o sus respectivos anexos, comprometiéndose EL VENDEDOR a llevar a cabo la escritura pública a más tardar 30 treinta días después de que estuviera en posibilidad legal de hacerlo. Una vez que EL VENDEDOR cuente con todos los permisos, autorizaciones, datos de registro y demás instrumentos necesarios para llevar a cabo la escrituración, notificará al COMPRADOR dicha situación, conforme al procedimiento establecido en el presente Contrato.</p>
  <p><strong>15.2 Procedimiento para la rescisión:</strong></p>
  <p>En el supuesto de que alguna de las partes incurra en cualquiera de las causas de rescisión antes señaladas, se estará a lo que establece el siguiente procedimiento:</p>
  <p>1) La parte afectada dará al responsable de la afectación un primer aviso de incumplimiento en el que establecerá la causal incurrida de las establecidas con anterioridad a efectos de que, el responsable de la afectación pueda subsanar dicho incumplimiento en el plazo de 15 quince días a partir de la fecha de dicha notificación.</p>
  <p>En caso de que el responsable de la afectación no subsane dicho incumplimiento dentro del plazo estipulado anteriormente, la parte afectada podrá escoger entre exigir el cumplimiento o la resolución de la obligación, y para el pago de los daños y perjuicios se estarán a lo pactado en el presente contrato según corresponda.</p>
  <p>2) En caso de actualizarse cualquier causal de rescisión conforme al presente contrato, las partes aceptan expresamente que el mismo quedará rescindido, sin necesidad de declaración judicial, entendiéndose que a partir del momento en que sea efectiva dicha rescisión, EL VENDEDOR tendrá la libre disposición de la UNIDAD PRIVATIVA pudiendo enajenarlo a terceros sin responsabilidad alguna.</p>
  <p>Las notificaciones antes aludidas se deberán realizar a los domicilios convencionales y correos electrónicos designados por cada una de las partes en la CARÁTULA.</p>
  <p><strong>15.3. Consecuencias de la rescisión:</strong></p>
  <p>Las PARTES acuerdan que la rescisión del presente contrato tendrá los siguientes efectos y consecuencias:</p>
  <p>a) El contrato se rescinde, quedando sin efecto legal alguno.</p>
  <p>b) EL VENDEDOR devolverá a EL COMPRADOR cualquier cantidad entregada hasta el momento de la rescisión total del presente contrato, menos (i) la cantidad que en su caso se haya establecido por concepto de pena convencional, (ii) las cantidades acumuladas por adeudos de derechos, impuestos, contribuciones, servicios, cuotas de mantenimiento y las diversas erogaciones correspondientes, en caso de que la rescisión sea a cargo de EL COMPRADOR, con la finalidad de entregar a EL VENDEDOR la UNIDAD PRIVATIVA libre de cualquier adeudo;</p>
  <p>c) Dado que EL VENDEDOR se reservó el dominio de la UNIDAD PRIVATIVA, y el contrato quedaría sin efectos, EL VENDEDOR tendrá la libre disposición de la UNIDAD PRIVATIVA, por lo que podrá enajenarla a terceros sin responsabilidad alguna.</p>
  <p>d) Para el caso de que, EL VENDEDOR se encuentre en algún supuesto de incumplimiento, EL COMPRADOR podrá rescindir el contrato solicitando la devolución de las cantidades entregadas más la cantidad que en su caso se haya establecido por concepto de pena convencional, en un plazo que no podrá superar los 15 quince días hábiles una vez rescindido el contrato, so pena del pago de intereses moratorios a razón del interés legal. EL VENDEDOR se podrá liberar de esa obligación haciendo la consignación ante juzgado en términos de lo previsto previamente en el contrato.</p>
  <p>e) En los casos de operaciones en que el precio deba cubrirse en exhibiciones periódicas, cuando EL COMPRADOR haya pagado más de la tercera parte del precio total de la unidad en los pagos convenidos, y EL VENDEDOR exija la rescisión o cumplimiento del contrato por mora, EL COMPRADOR tendrá derecho a optar por la rescisión o por el pago del adeudo vencido más los intereses moratorios generados de conformidad con los párrafos antepenúltimo y penúltimo de la cláusula segunda, siempre y cuando lo haga en un plazo no mayor de 5 cinco días naturales contado a partir de la fecha en que EL VENDEDOR le haya notificado la rescisión del contrato por su incumplimiento. Las cantidades que se hicieren efectivas o fueren pagadas por EL COMPRADOR se aplicarán en este orden: (i) a las cuotas determinadas por el Régimen de Propiedad en Condominio y/o por asamblea de la asociación de condóminos antes citada; (ii) a intereses moratorios; (iii) a intereses ordinarios; (iv) pago de cualquier cantidad que se deba de liquidar de acuerdo al presente contrato, entre ellas las cantidades más los intereses correspondientes generados por el descuento; y (v) a capital, en estricto orden de vencimiento.</p>
  <p>Las partes con el objeto de establecer las consecuencias que se deriven del incumplimiento en el que incurra cada una de ellas, respecto de las obligaciones que cada una asume en este contrato, en atención a la libertad para pactar y determinar sus estipulaciones contractuales, están de acuerdo en que se sancione a cada una de ellas respecto del incumplimiento en el que cada una de ellas incurra, en la forma como ha quedado establecido en las diversas cláusulas del contrato.</p>
  <p>No podrá hacerse efectivo el reclamo de los daños y perjuicios cuando el obligado a ellos no haya podido cumplir el contrato por hecho de su contraparte, caso fortuito o fuerza insuperable. Adicionalmente para el caso de que alguna de las partes se encuentre en alguna causal de incumplimiento generada por algún caso fortuito o de fuerza mayor, deberá notificar a la otra parte en un plazo que no podrá exceder de quince días contados a partir de la fecha que origine la causa de fuerza mayor o el caso fortuito, a fin de que, la otra parte manifieste lo que a su derecho proceda.</p>
  <p><strong>15.4. Construcciones y Mejoras, en caso de rescisión o terminación:</strong></p>
  <p>No serán materia de pago o reembolso alguno, las variaciones, modificaciones, construcciones y mejoras que hubiese llevado a cabo EL COMPRADOR sobre la UNIDAD PRIVATIVA, por sí o a través de terceros; para el caso de que, se terminara o rescindiera el presente contrato, el COMPRADOR se obliga a devolver el bien en el mismo estado en el que le fue entregado, puesto a disposición, utilizado o apropiado, bajo su exclusiva responsabilidad y costo.</p>
  <p>EL COMPRADOR, renuncia expresamente a cualquier acción que pudiese ejercer para el reembolso de tales variaciones, modificaciones, construcciones y mejoras.</p>
  <p><strong>DÉCIMA SEXTA. - PENA CONVENCIONAL EN CASO DE RESCISIÓN.</strong> En caso de rescisión de este contrato por incumplimiento a una o a varias de las obligaciones asumidas en el mismo, las partes acuerdan que la que incumpla por causas imputables a sí misma deberá pagar a la otra parte, por concepto de pena convencional el 10% (diez por ciento) del precio total de la UNIDAD PRIVATIVA, después de descuentos de conformidad a lo señalado en la CARÁTULA, para lo cual se deberá cumplir con los términos, condiciones o procesos establecidos en el presente contrato para cada caso en particular.</p>
  <p>Si el incumplimiento es ocasionado por EL COMPRADOR, éste expresamente autoriza por este medio a EL VENDEDOR para que el monto de la pena, se le retenga de las cantidades entregadas al amparo del presente contrato y sea destinado a cubrir la cantidad correspondiente por pena convencional y una vez no existiendo adeudos a su cargo, le sean devueltas las cantidades resultantes sin interés alguno, dentro de los 15 (quince) días hábiles siguientes a la fecha en la cual le sea notificado por escrito a EL VENDEDOR la información necesaria para que ésta pueda reintegrar en favor de EL COMPRADOR las cantidades resultantes de la misma forma que fueron cubiertas de conformidad con la LFPIORPI.</p>
  <p>Para efectos de entregar el remanente del saldo a favor de EL COMPRADOR y una vez que haya quedado rescindido o terminado el presente Contrato y, en su caso hecha la restitución de la entrega de la posesión física de la UNIDAD PRIVATIVA, éste último deberá notificar por escrito a EL VENDEDOR los datos de la cuenta bancaria en donde desea le sea depositada la cantidad resultante, una vez que se hubiesen dado los supuestos antes señalados y se hubiesen liquidado todas las cantidades resultantes a favor de EL VENDEDOR.</p>
  <p><strong>DÉCIMA SÉPTIMA.- PROCEDER EN CASO DEL FALLECIMIENTO DE EL COMPRADOR.-</strong> En caso de fallecimiento de EL COMPRADOR antes de la firma de la escritura pública de compraventa, desde este momento EL COMPRADOR instruye a EL VENDEDOR para que todas las cantidades de dinero que hubiere anticipado por virtud de este contrato, le sean entregadas a sus sucesor(es) legítimo(s) por medio del representante legal de la sucesión que se abra en su momento, quedando terminado este contrato de manera inmediata con la muerte de EL COMPRADOR, sin ninguna responsabilidad para EL VENDEDOR, y sin que generen penalización alguna ni intereses de ninguna índole, y desde luego que EL VENDEDOR podrá disponer libremente de la UNIDAD PRIVATIVA objeto de este contrato, en la manera que mejor convenga a sus intereses.</p>
  <p>Para el caso de que, el precio total de la unidad, haya sido cubierto previo al fallecimiento de EL COMPRADOR, y antes de la firma de la escritura pública de compraventa, su(s) sucesor(es) legítimo(s) por medio del representante legal de la sucesión que se abra en su momento, se verían obligados en los términos del presente contrato, por lo que respecta a la escrituración de la UNIDAD PRIVATIVA.</p>
  <p><strong>DÉCIMA OCTAVA. - CONSENTIMIENTO.</strong> Las partes acuerdan que no tendrán validez alguna, los acuerdos, pactos ya sean verbales o escritos que alguna de ellas argumente haber celebrado con promotores, vendedores, asesores, u otra persona, que sean distintos a lo pactado en el presente contrato.</p>
  <p><strong>DÉCIMA NOVENA.- FUSIÓN Y SUBDIVISIÓN.-</strong> EL COMPRADOR manifiesta su conformidad y está consciente que, la UNIDAD PRIVATIVA no podrá fusionarse con dos o más UNIDADES PRIVATIVAS del desarrollo inmobiliario señalado en la Carátula para constituirse en una sola de mayor superficie; o bien o subdividirse en fracciones que den como resultado paños no menores a la superficie de ésta UNIDAD PRIVATIVA, en virtud de que son unidades privativas previamente o en proceso de construcción, con estructuras según se requieren al actual proyecto.</p>
  <p><strong>VIGÉSIMA.- NOTIFICACIONES.</strong> Las partes establecen que cualquier notificación, aviso, documentación y/o información relacionada con el presente contrato deberá ser en forma escrita y podrá hacerse a través de mensajería privada, correo electrónico o correo certificado con acuse de recibo, siempre que sean dirigidas al domicilio y correo electrónico de la parte destinataria, según lo pactado en la CARÁTULA, bajo el entendido que se entenderán con la persona que se encuentre presente al momento de realizar el aviso, notificación y/o entrega de documentación e información correspondiente.</p>
  <p><strong>VIGÉSIMA PRIMERA. - DOMICILIOS CONVENCIONALES.</strong> Para los efectos de este contrato, las partes establecen como domicilios convencionales, para recibir cualquier clase de aviso, notificación, documentos e información, los señalados en los apartados 2 dos y 3 tres de la CARATULA.</p>
  <p>Cualquiera de las partes podrá notificar a la otra de manera fehaciente un nuevo domicilio al cual deban dirigirse todos los avisos y notificaciones relacionados con el presente documento, mediante simple aviso por escrito enviado al domicilio o correo electrónico establecidos en el apartado 2 dos y 3 tres de la CARÁTULA, con una anticipación mínima de 10 (diez) días naturales a aquél en el que deba producirse el cambio de domicilio, en caso contrario, cualquier aviso o comunicación enviado a la otra parte al último domicilio registrado, surtirá plenos efectos.</p>
  <p><strong>VIGÉSIMA SEGUNDA. - PROTECCIÓN DE DATOS PERSONALES Y AVISO DE PRIVACIDAD.</strong> EL VENDEDOR reconoce que, debido al objeto del presente contrato, ésta pudiere tener acceso a información de EL COMPRADOR que puede contener datos personales de éste y/o personas relacionadas con éste, y viceversa, por lo que las partes aceptan el tratamiento, obtención, recopilación y almacenamiento de sus datos personales que hayan sido proporcionados. Con independencia de lo anterior, EL COMPRADOR podrá consultar el Aviso de Privacidad de EL VENDEDOR en la dirección indicada en el apartado 2 de la CARATULA.</p>
  <p><strong>VIGÉSIMA TERCERA. - PREVENCIÓN DE OPERACIONES CON RECURSOS ILÍCITOS.</strong> EL COMPRADOR manifiesta que los recursos con los cuales se obliga a adquirir la UNIDAD PRIVATIVA son de procedencia lícita, producto de actividades realizadas dentro del marco de la LFPIORPI, por lo que se obliga a proporcionar a EL VENDEDOR cualquier información que le sea requerida. EL VENDEDOR manifiesta que realizó la identificación de los comparecientes a través de los documentos oficiales que exhibieron a la celebración del presente documento, así como que ha dado cumplimiento a las demás obligaciones que la LFPIORPI, incluyendo requerir al cliente o usuario la información sobre su actividad u ocupación, basándose entre otros, en los avisos de inscripción y actualización de actividades presentados para efectos del Registro Federal de Contribuyentes.</p>
  <p>En el caso de que indebidamente EL COMPRADOR realice uno o más pagos en efectivo en la cuenta de EL VENDEDOR antes señalada y que dichas cantidades superen en conjunto o individualmente lo equivalente a 8,025 (Ocho mil veinticinco) Unidades de Medida y Actualización (UMA) diarias conforme a la LFPIORPI, en este acto acepta y faculta expresamente a EL VENDEDOR para que ésta le retenga discrecionalmente como sanción por incumplimiento a la citada ley el 20% (veinte por ciento) sobre la cantidad que exceda el monto autorizado y que la cantidad restante una vez descontado dicho monto, sea reintegrada a EL COMPRADOR de conformidad con el ya señalado ordenamiento, en el caso de que no sean suficientes los remanentes de donde se vayan a cobrar o que dicho depósito sea el último a que esté obligado EL COMPRADOR a realizar, EL COMPRADOR expresamente acepta que no se le escriture en definitiva la UNIDAD PRIVATIVA, hasta en tanto y no pague dicha cantidad, así como a la sanción anteriormente establecida, no obstante de las consecuencias que en su caso esto conlleve, pues EL VENDEDOR por ningún motivo tendrá responsabilidad alguna al respecto.</p>
  <p>Lo anterior independientemente de los avisos y notificaciones correspondientes que EL VENDEDOR realizará a las autoridades por el incumplimiento de EL COMPRADOR a la LFPIORPI.</p>
  <p>En caso de que, por una causa atribuible a EL COMPRADOR, exista en contra de EL VENDEDOR alguna sanción, prevención, apercibimiento, multa o contingencia legal de cualquier índole derivado de incumplimientos a lo dispuesto en la presente clausula, EL COMPRADOR se obliga a responder solidariamente con ésta última para la debida atención y/o solución de los rubros antes referidos.</p>
  <p><strong>VIGÉSIMA CUARTA.- COMPETENCIA ADMINISTRATIVA DE LA PROCURADURÍA FEDERAL DEL CONSUMIDOR (PROFECO).-</strong> Ante cualquier controversia que se suscite sobre la interpretación o cumplimiento del presente CONTRATO, EL COMPRADOR puede acudir a la PROFECO, la cual tiene funciones de autoridad administrativa encargada de promover y proteger los derechos e intereses de los consumidores y procurar la equidad y certeza jurídica en las relaciones de consumo, desde su ámbito competencial.</p>
  <p><strong>VIGÉSIMA QUINTA.- PLAZOS PARA QUE EL COMPRADOR EJERZA ACCIONES CIVILES RELACIONADAS CON LA UNIDAD PRIVATIVA.</strong> EL COMPRADOR cuenta con los plazos establecidos en la cláusula séptima de este contrato, para el ejercicio de acciones civiles ante las autoridades jurisdiccionales pertinentes.</p>
  <p><strong>VIGÉSIMA SEXTA.- REGISTRO DEL MODELO DE CONTRATO DE ADHESIÓN.-</strong> El presente modelo de contrato de adhesión está en proceso de inscripción en el Registro Público de Contratos de Adhesión de PROFECO.</p>
  <p><strong>VIGÉSIMA SÉPTIMA.- LEGISLACIÓN APLICABLE Y SUJECIÓN A TRIBUNALES.-</strong> Para la interpretación y cumplimiento de este contrato, así como para el ejercicio de cualquier acción judicial derivada del mismo, EL VENDEDOR y EL COMPRADOR, considerarán como aplicables, en lo conducente, la legislación Mercantil aplicable en los Estados Unidos Mexicanos y supletoriamente en lo no previsto se aplicarán las disposiciones del Código Civil Federal, y/o equivalentes del Código Civil del Estado de Sinaloa y se someten a la jurisdicción y competencia de los Tribunales aplicables al lugar de celebración del presente contrato, renunciando a cualquier fuero que pudiera corresponderles, en razón de sus domicilios presentes o futuros.</p>
  <p>Las PARTES contratantes, incluso si en lo futuro cambiaran su nacionalidad mexicana por alguna extranjera, renuncian expresamente a invocar la protección y a hacer valer la aplicación de cualquier ley, reglamento, decreto, acuerdo o disposición legal, de cualquier índole, distinta de las precisadas en el párrafo precedente.</p>
  <p><strong>VIGÉSIMA OCTAVA. - ANEXOS.</strong> - LAS PARTES acuerdan que el presente contrato y los anexos, forman parte integral del mismo y expresan su conformidad respecto de su contenido, siendo éstos los que se establecen dentro del apartado 9 nueve de la aludida CARÁTULA.</p>
  <p><strong>VIGÉSIMA NOVENA. - ENCABEZADOS.</strong> - Los encabezados o títulos de las cláusulas se incluyen para facilitar el contenido y lectura del presente Contrato, de ninguna manera podrán interpretarse como parte de la cláusula.</p>
  <p style="margin-top:20px;font-weight:700;text-align:justify">LEÍDO QUE FUE POR LAS PARTES EL PRESENTE CONTRATO DE ADHESIÓN DE COMPRAVENTA DE VIVIENDA DE BIEN INMUEBLE DESTINADO A CASA HABITACIÓN Y ANEXOS, CONVIENEN LAS PARTES EN RATIFICAR SU CONTENIDO, PARA LO CUAL SE SUSCRIBE POR DUPLICADO EL PRESENTE CONTRATO. QUEDANDO DOS EJEMPLARES EN PODER DE EL VENDEDOR Y UN EJEMPLAR EN PODER DE EL COMPRADOR.</p>
  <div class="firmas">
    <p style="font-weight:700;text-align:center;margin-top:40px">EL VENDEDOR<br>DESARROLLADORA PALIZ S.A. DE C.V.<br>REPRESENTADA EN ESTE ACTO POR</p>
    <div class="firma-line">LIZBETH GUADALUPE ZAMUDIO RUIZ</div>
    <p style="font-weight:700;text-align:center;margin-top:60px">EL COMPRADOR</p>
    <div class="firma-line">${cli.nombre.toUpperCase()}</div>
  </div>
  <button onclick="window.print()" style="margin-top:24px;padding:8px 20px;background:#1E3D0F;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Imprimir / Guardar PDF</button>
  </body></html>`);
  win.document.close();
}

function imprimirPagares(){
  if(!_cierreData||!_cierreData.pagares.length) return;
  const {l,m,pagares,plazo,folio} = _cierreData;
  const cli = getClienteData();
  const win = window.open('','_blank');
  const pagaresHTML = pagares.map((p,idx)=>`
    <div style="border:2px solid #1E3D0F;border-radius:8px;padding:16px;margin-bottom:20px;page-break-inside:avoid;${idx<pagares.length-1?'page-break-after:always;':''}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <img src="${VA_LOGO}" style="height:40px">
        <div style="text-align:center;font-weight:800;font-size:14px;color:#1E3D0F">PAGARÉ ${p.n}/${plazo}</div>
        <div style="text-align:right"><div style="font-size:10px;color:#666">Folio recibo</div><div style="font-weight:700;color:#C9963C">${folio}</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px">
        <tr><td style="padding:4px;width:50%;border-bottom:1px solid #eee"><b>Lote:</b> ${l.clave} — Mz ${l.mz} Lote ${l.lote}</td><td style="padding:4px;border-bottom:1px solid #eee"><b>Modelo:</b> ${m.nombre}</td></tr>
        <tr><td style="padding:4px;border-bottom:1px solid #eee"><b>Cliente:</b> ${cli.nombre}</td><td style="padding:4px;border-bottom:1px solid #eee"><b>Fecha de pago:</b> ${p.fecha.toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})}</td></tr>
      </table>
      <div style="text-align:center;margin:14px 0;padding:12px;background:#f0fdf4;border-radius:6px">
        <div style="font-size:11px;color:#666">MONTO A PAGAR</div>
        <div style="font-size:26px;font-weight:800;color:#1E3D0F">$${mxn(p.monto).replace('$','')}</div>
        <div style="font-size:11px;color:#666">(${numToLetras(p.monto)})</div>
      </div>
      <div style="font-size:10.5px;color:#555;margin-bottom:12px">Pago mediante transferencia electrónica a cuenta BANBAJIO 0474632860201, CLABE 030730900044165477, a nombre de DESARROLLADORA PALIZ, S.A. DE C.V.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px">
        <div style="border-top:1.5px solid #333;padding-top:6px;text-align:center;font-size:10px;font-weight:700">${cli.nombre}<br>EL DEUDOR</div>
        <div style="border-top:1.5px solid #333;padding-top:6px;text-align:center;font-size:10px;font-weight:700">DESARROLLADORA PALIZ S.A. DE C.V.<br>EL ACREEDOR</div>
      </div>
    </div>`).join('');
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Pagarés</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:20px;color:#1a1a1a}
  @media print{button{display:none!important}@page{size:letter;margin:15mm}}</style></head><body>
  <h2 style="text-align:center;color:#1E3D0F;margin-bottom:20px">PAGARÉS — ${cli.nombre}</h2>
  ${pagaresHTML}
  <button onclick="window.print()" style="margin-top:16px;padding:8px 20px;background:#1E3D0F;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Imprimir todos los pagarés</button>
  </body></html>`);
  win.document.close();
}


// ═══ HTML GETTERS for unified document window ═══
function getReciboHTML(){ return _captureDocHTML(imprimirReciboApartado); }
function getFormatoHTML(){ return _captureDocHTML(imprimirFormatoApartado); }
function getDatosGeneralesHTML(){ return _captureDocHTML(imprimirDatosGenerales); }
function getCartaAutorizacionHTML(){ return _captureDocHTML(imprimirCartaAutorizacion); }
function getCartaRestriccionHTML(){ return _captureDocHTML(imprimirCartaRestriccion); }
function getCaratulaHTML(){ return _captureDocHTML(imprimirCaratula); }
function getContratoHTML(){ return _captureDocHTML(imprimirContrato); }
function getPagaresHTML(){ return _captureDocHTML(imprimirPagares); }

function _captureDocHTML(fn){
  // Temporarily intercept window.open to capture the HTML content
  const origOpen = window.open;
  let captured = '';
  window.open = function(){
    return {
      document: {
        write(html){ captured = html; },
        close(){}
      },
      focus(){}
    };
  };
  try { fn(); } catch(e){ console.error('Doc gen error:', e); }
  window.open = origOpen;
  // Extract just the body content (between <body> and </body>)
  const bodyMatch = captured.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return bodyMatch ? bodyMatch[1].replace(/<button[^>]*>.*?<\/button>/gi,'') : captured;
}

function generarDocumentosCierreUnificado(){
  var win = window.open('','_blank');
  if(!win){ toast('Tu navegador bloqueo la ventana. Permite ventanas emergentes.','err',5000); return; }
  var sections = [];
  var generators = [
    {fn:getReciboHTML, title:'Recibo de Apartado'},
    {fn:getFormatoHTML, title:'Formato de Apartado de Vivienda'},
    {fn:getDatosGeneralesHTML, title:'Datos Generales del Solicitante'},
    {fn:getCartaAutorizacionHTML, title:'Carta de Autorizacion de Uso de Datos'},
    {fn:getCartaRestriccionHTML, title:'Carta Compromiso de Restriccion de Efectivo'},
    {fn:getCaratulaHTML, title:'Caratula del Contrato'},
    {fn:getContratoHTML, title:'Contrato de Compraventa'}
  ];
  if(_cierreData.pagares&&_cierreData.pagares.length>0) generators.push({fn:getPagaresHTML, title:'Pagares'});
  generators.forEach(function(g){ try{ sections.push({title:g.title,html:g.fn()}); }catch(e){ console.error('Error:'+g.title,e); } });
  var nombre = $('c-nombre').value||'Cliente';
  var lote = _cierreData.l.clave||'';
  var h = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cierre '+nombre+'</title>';
  h += '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a1a}';
  h += '.doc-section{page-break-after:always;padding:28px;min-height:90vh}.doc-section:last-child{page-break-after:auto}';
  h += '.doc-title{background:#1E3D0F;color:#fff;text-align:center;padding:10px;border-radius:6px;font-size:14px;font-weight:700;margin-bottom:16px}';
  h += 'table{width:100%;border-collapse:collapse}td,th{padding:5px 8px;border:1px solid #ccc}th{background:#1E3D0F;color:#fff;font-size:11px}';
  h += '.firma{border-top:1.5px solid #333;margin-top:50px;padding-top:6px;text-align:center;font-size:10px;font-weight:700}';
  h += '@media print{button{display:none!important}.doc-nav{display:none!important}@page{size:letter;margin:12mm}}</style></head><body>';
  h += '<div class="doc-nav" style="position:fixed;top:0;left:0;right:0;background:#1E3D0F;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:999">';
  h += '<span>Expediente de cierre — '+nombre+' — Lote '+lote+'</span>';
  h += '<button onclick="window.print()" style="background:#C9963C;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-weight:700">Imprimir / Guardar PDF</button></div>';
  h += '<div style="margin-top:50px">';
  for(var i=0;i<sections.length;i++){
    h += '<div class="doc-section"><div class="doc-title">'+sections[i].title+'</div>'+sections[i].html+'</div>';
  }
  h += '</div></body></html>';
  win.document.write(h);
  win.document.close();
}


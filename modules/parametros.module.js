/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/parametros.module.js
   Módulo Parámetros (precios, gastos, modelos, UMA...).
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// PARÁMETROS
// ================================================================
function renderParametros(){
  const P=getP();
  try{ renderPoliticaComercial(); }catch(e){ console.error('renderPoliticaComercial',e); }
  $('pm-solo').value=P.precio_m2_solo||14500;
  $('pm-exc').value=P.precio_m2_exc||9000;
  $('pm-adic').value=P.precio_m2_lote_adicional||13000;
  $('pm-esq').value=P.plus_esquina||50000;
  $('pm-pq').value=P.plus_parque||50000;
  $('pm-ep').value=P.plus_esq_pq||75000;
  $('pm-dev').value=P.desarrollo||'Valle de Aragón';
  $('pm-emp').value=P.empresa||'PALIZ DESARROLLOS';
  $('pm-ger').value=P.gerente||'';
  $('pm-ases').value=P.asesor_default||'';
  renderModelosTable();
  renderGastosTable();
  renderInstTable();
}
function renderGastosTable(){
  const P=getP();
  const gastos=P.gastos_operacion||MASTER_PARAMS.gastos_operacion;
  const TIPOS=['fijo','pct_vivienda','pct_credito'];
  $('gastos-tbody').innerHTML=gastos.map((g,i)=>`<tr>
    <td><input type="text" value="${g.nombre}" onchange="updateGasto(${i},'nombre',this.value)" style="width:160px;border:1px solid var(--bd2);border-radius:5px;padding:3px 6px;font-size:12px"></td>
    <td><select onchange="updateGasto(${i},'tipo',this.value)" style="border:1px solid var(--bd2);border-radius:5px;padding:3px 6px;font-size:12px">${TIPOS.map(t=>`<option value="${t}" ${g.tipo===t?'selected':''}>${t}</option>`).join('')}</select></td>
    <td><input type="number" value="${g.valor}" step="0.0001" onchange="updateGasto(${i},'valor',parseFloat(this.value))" style="width:90px;border:1px solid var(--bd2);border-radius:5px;padding:3px 6px;font-size:12px"></td>
    <td><input type="checkbox" ${g.activo?'checked':''} onchange="updateGasto(${i},'activo',this.checked)"></td>
    <td><button class="btn btn-red btn-xs" onclick="deleteGasto(${i})">✕</button></td>
  </tr>`).join('');
}
function updateGasto(i,field,val){ const P=getP(); const g=P.gastos_operacion||MASTER_PARAMS.gastos_operacion; g[i][field]=val; DS.saveParams({gastos_operacion:g}); }
function deleteGasto(i){ const P=getP(); const g=[...(P.gastos_operacion||[])]; g.splice(i,1); DS.saveParams({gastos_operacion:g}); renderGastosTable(); }
function addGastoRow(){ const P=getP(); const g=[...(P.gastos_operacion||[])]; g.push({id:'gasto_'+Date.now(),nombre:'Nuevo concepto',tipo:'fijo',valor:0,activo:true}); DS.saveParams({gastos_operacion:g}); renderGastosTable(); }
function renderInstTable(){
  const P=getP();
  const inst=P.instituciones||MASTER_PARAMS.instituciones;
  $('inst-tbody').innerHTML=inst.map((it,i)=>`<tr>
    <td><input type="text" value="${it.nombre}" onchange="updateInst(${i},'nombre',this.value)" style="width:140px;border:1px solid var(--bd2);border-radius:5px;padding:3px 6px;font-size:12px"></td>
    <td><input type="checkbox" ${it.activo?'checked':''} onchange="updateInst(${i},'activo',this.checked)"></td>
    <td><button class="btn btn-red btn-xs" onclick="deleteInst(${i})">✕</button></td>
  </tr>`).join('');
}
function updateInst(i,field,val){ const P=getP(); const inst=P.instituciones||MASTER_PARAMS.instituciones; inst[i][field]=val; DS.saveParams({instituciones:inst}); }
function deleteInst(i){ const P=getP(); const inst=[...(P.instituciones||[])]; inst.splice(i,1); DS.saveParams({instituciones:inst}); renderInstTable(); }
function addInstRow(){ const P=getP(); const inst=[...(P.instituciones||[])]; inst.push({id:'inst_'+Date.now(),nombre:'Nueva institución',activo:true}); DS.saveParams({instituciones:inst}); renderInstTable(); }
function renderModelosTable(){
  const mods=DS.getModelos();
  $('modelos-tbody').innerHTML=mods.map((m,i)=>`<tr>
    <td><input type="text" value="${m.nombre}" onchange="updateModelo(${i},'nombre',this.value)" style="width:80px;border:1px solid var(--bd2);border-radius:5px;padding:3px 6px;font-size:12px"></td>
    <td><input type="number" value="${m.precio}" onchange="updateModelo(${i},'precio',this.value)" style="width:90px;border:1px solid var(--bd2);border-radius:5px;padding:3px 6px;font-size:12px"></td>
    <td><input type="number" value="${m.construccion}" onchange="updateModelo(${i},'construccion',this.value)" style="width:70px;border:1px solid var(--bd2);border-radius:5px;padding:3px 6px;font-size:12px"></td>
    <td><input type="number" value="${m.recamaras}" onchange="updateModelo(${i},'recamaras',this.value)" style="width:50px;border:1px solid var(--bd2);border-radius:5px;padding:3px 6px;font-size:12px"></td>
    <td><input type="number" value="${m.banos}" step="0.5" onchange="updateModelo(${i},'banos',this.value)" style="width:50px;border:1px solid var(--bd2);border-radius:5px;padding:3px 6px;font-size:12px"></td>
    <td><input type="checkbox" ${m.activo?'checked':''} onchange="updateModelo(${i},'activo',this.checked)"></td>
    <td><button class="btn btn-red btn-xs" onclick="deleteModelo(${i})">✕</button></td>
  </tr>`).join('');
}
function updateModelo(i,field,val){
  const mods=DS.getModelos();
  if(field==='precio'||field==='construccion'||field==='recamaras'||field==='banos') mods[i][field]=parseFloat(val)||0;
  else mods[i][field]=val;
  DS.db.modelos=mods; DS._save(DS.db);
}
function deleteModelo(i){
  const mods=DS.getModelos(); const mod=mods[i]; if(!mod) return;
  // ── MOTOR: un modelo usado en operaciones no se elimina — se desactiva ──
  if(IANNA_MOTOR.modeloEnUso(mod.id)){
    mods[i]={...mod, activo:false}; DS.db.modelos=mods; DS._save(DS.db); renderModelosTable();
    IANNA_MOTOR.auditar('modelos', mod.id, 'DESACTIVAR_MODELO', {activo:true}, {activo:false}, 'Eliminación protegida: modelo con operaciones en historial');
    toast(`"${mod.nombre}" tiene operaciones en su historial: se desactivó (no se elimina) ✓`,'warn',5000);
    return;
  }
  mods.splice(i,1); DS.db.modelos=mods; DS._save(DS.db); renderModelosTable();
  IANNA_MOTOR.auditar('modelos', mod.id, 'ELIMINAR_MODELO', {nombre:mod.nombre}, {}, 'Eliminación física: sin operaciones');
}
function addModeloRow(){
  const mods=DS.getModelos();
  mods.push({id:'MOD_'+uid(),nombre:'Nuevo',precio:0,construccion:0,recamaras:3,banos:2.5,desc:'',activo:true});
  DS.db.modelos=mods; DS._save(DS.db); renderModelosTable();
}
function saveParametros(){
  DS.saveParams({precio_m2_solo:parseFloat($('pm-solo').value)||14500,precio_m2_exc:parseFloat($('pm-exc').value)||9000,precio_m2_lote_adicional:parseFloat($('pm-adic').value)||13500,plus_esquina:parseFloat($('pm-esq').value)||50000,plus_parque:parseFloat($('pm-pq').value)||50000,plus_esq_pq:parseFloat($('pm-ep').value)||75000,desarrollo:$('pm-dev').value.trim(),empresa:$('pm-emp').value.trim(),gerente:$('pm-ger').value.trim(),asesor_default:$('pm-ases').value.trim()});
  toast('Parámetros guardados ✓ — todo el sistema actualizado','ok');
}


// ══ FASE 1.9: Política Comercial editable desde Parámetros ══════
function renderPoliticaComercial(){
  const pol = IANNA_COM.politicaActual();
  $('pc-version').textContent = pol.version;
  $('pc-bc-viv').checked = !!pol.base_comisionable.precio_vivienda;
  $('pc-bc-exc').checked = !!pol.base_comisionable.excedente_terreno;
  $('pc-bc-plus').checked = !!pol.base_comisionable.plusvalia;
  $('pc-bc-adic').checked = !!pol.base_comisionable.adicional;
  $('pc-bc-gastos').checked = !!pol.base_comisionable.gastos_operacion;
  $('pc-desc').checked = !!pol.aplicar_descuento;
  $('pc-pct-ad').value = (pol.porcentajes.asesor_directo*100).toFixed(3);
  $('pc-pct-ab').value = (pol.porcentajes.asesor_broker*100).toFixed(3);
  $('pc-pct-ge').value = (pol.porcentajes.gerente*100).toFixed(3);
  $('pc-pct-bk').value = (pol.porcentajes.broker*100).toFixed(3);
  const da = pol.distribucion_asesor||[];
  const dg = pol.distribucion_gerente||[];
  $('pc-dist-a1').value = ((da[0]?.pct||0)*100).toFixed(0);
  $('pc-dist-a2').value = ((da[1]?.pct||0)*100).toFixed(0);
  $('pc-dist-g1').value = ((dg[0]?.pct||0)*100).toFixed(0);
  $('pc-dist-g2').value = ((dg[1]?.pct||0)*100).toFixed(0);
  $('pc-pen-apt').value = (((pol.penalizaciones?.cancelacion_apartado?.valor)||0)*100).toFixed(2);
  $('pc-pen-ven').value = (((pol.penalizaciones?.cancelacion_venta?.valor)||0)*100).toFixed(2);
}
function guardarPoliticaComercial(){
  const a1 = parseFloat($('pc-dist-a1').value)||0, a2 = parseFloat($('pc-dist-a2').value)||0;
  const g1 = parseFloat($('pc-dist-g1').value)||0, g2 = parseFloat($('pc-dist-g2').value)||0;
  if(Math.abs((a1+a2)-100) > 0.01){ toast('La distribución del asesor debe sumar 100%','err'); return; }
  if(Math.abs((g1+g2)-100) > 0.01){ toast('La distribución del gerente debe sumar 100%','err'); return; }
  const nueva = {
    base_comisionable: {
      precio_vivienda:    $('pc-bc-viv').checked,
      excedente_terreno:  $('pc-bc-exc').checked,
      plusvalia:          $('pc-bc-plus').checked,
      adicional:          $('pc-bc-adic').checked,
      gastos_operacion:   $('pc-bc-gastos').checked,
    },
    aplicar_descuento: $('pc-desc').checked,
    porcentajes: {
      asesor_directo:  (parseFloat($('pc-pct-ad').value)||0)/100,
      asesor_broker:   (parseFloat($('pc-pct-ab').value)||0)/100,
      gerente:         (parseFloat($('pc-pct-ge').value)||0)/100,
      broker:          (parseFloat($('pc-pct-bk').value)||0)/100,
    },
    distribucion_asesor:  [ { parte:'firma', pct:a1/100 }, { parte:'escrituracion', pct:a2/100 } ],
    distribucion_gerente: [ { parte:'firma', pct:g1/100 }, { parte:'escrituracion', pct:g2/100 } ],
    penalizaciones: {
      cancelacion_apartado: { tipo:'porcentaje', valor:(parseFloat($('pc-pen-apt').value)||0)/100, exhibiciones:1, retencion_comisiones:false },
      cancelacion_venta:    { tipo:'porcentaje', valor:(parseFloat($('pc-pen-ven').value)||0)/100, exhibiciones:1, retencion_comisiones:false, distribucion:[] },
    },
  };
  const guardada = IANNA_COM.guardarPolitica(nueva, 'Cambio manual desde Parámetros');
  renderPoliticaComercial();
  toast('Política Comercial guardada como '+guardada.version+' ✓','ok');
}

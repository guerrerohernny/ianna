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
function deleteModelo(i){ const mods=DS.getModelos(); mods.splice(i,1); DS.db.modelos=mods; DS._save(DS.db); renderModelosTable(); }
function addModeloRow(){
  const mods=DS.getModelos();
  mods.push({id:'MOD_'+uid(),nombre:'Nuevo',precio:0,construccion:0,recamaras:3,banos:2.5,desc:'',activo:true});
  DS.db.modelos=mods; DS._save(DS.db); renderModelosTable();
}
function saveParametros(){
  DS.saveParams({precio_m2_solo:parseFloat($('pm-solo').value)||14500,precio_m2_exc:parseFloat($('pm-exc').value)||9000,precio_m2_lote_adicional:parseFloat($('pm-adic').value)||13500,plus_esquina:parseFloat($('pm-esq').value)||50000,plus_parque:parseFloat($('pm-pq').value)||50000,plus_esq_pq:parseFloat($('pm-ep').value)||75000,desarrollo:$('pm-dev').value.trim(),empresa:$('pm-emp').value.trim(),gerente:$('pm-ger').value.trim(),asesor_default:$('pm-ases').value.trim()});
  toast('Parámetros guardados ✓ — todo el sistema actualizado','ok');
}


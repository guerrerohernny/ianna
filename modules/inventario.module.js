/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/inventario.module.js
   Módulo Inventario: grid/tabla, lotes, división, fusión y separación de fracciones.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// INVENTARIO
// ================================================================
function renderInventario(){
  const fMz=$('f-inv-mz')?.value||'';
  const fEst=$('f-inv-est')?.value||'';
  const fTipo=$('f-inv-tipo')?.value||'';
  const q=($('s-inv')?.value||'').toLowerCase();
  let lots=[...DS.db.inventario];

  // Auto-assign estados based on rules:
  lots=lots.map(l=>{
    let est=l.estado;
    // Entrega Rápida: has modelo + no apartado/vendido
    if(l.modelo_asignado&&!['Apartado','Vendido','Casa Muestra','Subdividido'].includes(est)) est='Entrega Rápida';
    // Lote Especial: has fraccion_fusionada flag
    if(l.fraccion_fusionada&&est==='Disponible') est='Lote Especial';
    return {...l, estado_display:est};
  });

  // Filter: hide Subdivididos unless explicitly requested
  if(fEst==='__subdivididos__'){
    lots=lots.filter(l=>l.estado==='Subdividido');
  } else {
    lots=lots.filter(l=>l.estado!=='Subdividido');
    if(fEst) lots=lots.filter(l=>(l.estado_display||l.estado)===fEst);
  }
  if(fMz) lots=lots.filter(l=>String(l.mz)===fMz);
  if(fTipo) lots=lots.filter(l=>l.tipo===fTipo||l.tipo.includes(fTipo));
  if(q) lots=lots.filter(l=>l.clave.toLowerCase().includes(q)||String(l.mz).includes(q)||String(l.lote).includes(q)||(l.cliente_asignado||'').toLowerCase().includes(q));

  // Sort: strictly by manzana then by lote clave — each lot stays in its original position
  lots.sort((a,b)=>{
    const aMz=Number(a.mz); const bMz=Number(b.mz);
    if(aMz!==bMz) return aMz-bMz;
    // Within same manzana: sort by clave numerically (801 < 802 < 803...)
    return a.clave.localeCompare(b.clave, undefined, {numeric:true});
  });

  // KPIs jerárquicos (from all non-subdivididos)
  // DISPONIBLES engloba: puros + Especiales + Entrega Rápida (todo lo vendible)
  const all=DS.db.inventario.filter(l=>l.estado!=='Subdividido');
  const noVendibles=['Apartado','Vendido','Casa Muestra'];
  const allEnt=all.filter(l=>l.modelo_asignado&&!noVendibles.includes(l.estado)).length; // Entrega Rápida
  const allEsp=all.filter(l=>!l.modelo_asignado&&!noVendibles.includes(l.estado)&&(l.estado==='Lote Especial'||l.fraccion_fusionada)).length; // Especiales
  const allDispPuros=all.filter(l=>!l.modelo_asignado&&!l.fraccion_fusionada&&l.estado==='Disponible').length;
  const allDispTotal=allDispPuros+allEsp+allEnt;
  const allApt=all.filter(l=>l.estado==='Apartado').length;
  const allVend=all.filter(l=>l.estado==='Vendido').length;
  $('inv-kpi').innerHTML=`
    <div class="kpi-card" style="grid-column:span 2;background:#d1fae5;border:1px solid #a7f3d0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div>
          <div class="kpi-lbl" style="color:#065f46">1. Disponibles</div>
          <div class="kpi-val" style="color:#065f46">${allDispTotal}</div>
          <div class="kpi-sub" style="color:#047857">Todo lo vendible</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;padding-top:2px;min-width:150px">
          <div style="display:flex;justify-content:space-between;align-items:center;background:#ecfdf5;border-radius:6px;padding:3px 8px;font-size:11px;color:#065f46"><span>Lotes disponibles</span><b>${allDispPuros}</b></div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:#ede9fe;border-radius:6px;padding:3px 8px;font-size:11px;color:#6d28d9"><span>Especiales</span><b>${allEsp}</b></div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:#fed7aa;border-radius:6px;padding:3px 8px;font-size:11px;color:#c2410c"><span>Entrega Rápida</span><b>${allEnt}</b></div>
        </div>
      </div>
    </div>
    <div class="kpi-card" style="background:#fef9c3;border:1px solid #fde68a">
      <div class="kpi-lbl" style="color:#854d0e">2. Apartados</div>
      <div class="kpi-val" style="color:#854d0e">${allApt}</div>
      <div class="kpi-sub" style="color:#a16207">En proceso</div>
    </div>
    <div class="kpi-card" style="background:#fee2e2;border:1px solid #fecaca">
      <div class="kpi-lbl" style="color:#991b1b">3. Vendidos</div>
      <div class="kpi-val" style="color:#991b1b">${allVend}</div>
      <div class="kpi-sub" style="color:#b91c1c">Cerrados</div>
    </div>`;

  const CM={
    'Disponible':'l-disp','Entrega Rápida':'l-rapida','Lote Especial':'l-especial',
    'Casa Muestra':'l-muestra','Apartado':'l-apt','Vendido':'l-vend','Subdividido':'l-sub'
  };

  // Grid view
  $('inv-grid-c').innerHTML=lots.length===0
    ?'<div class="empty" style="grid-column:1/-1"><div class="empty-i">🏠</div><p>Sin lotes con estos filtros.</p></div>'
    :lots.map(l=>{
      const estDisp=l.estado_display||l.estado;
      const cls=CM[estDisp]||'l-disp';
      const fusionBadge=l.fraccion_fusionada?`<div class="fusion-badge">+Frac</div>`:'';
      const clienteTxt=l.cliente_asignado?`<div style="font-size:8.5px;margin-top:2px;font-weight:600;opacity:.85">${l.cliente_asignado.split(' ')[0]}</div>`:'';
      const modeloTxt=l.modelo_asignado?`<div style="font-size:8px;opacity:.75">${l.modelo_asignado}</div>`:'';
      return `<div class="lc ${cls}" onclick="openLoteDetail('${l.clave}')">
        ${l.fraccion_de?'<div style="font-size:8px;font-weight:700;opacity:.7;margin-bottom:1px">FRACC.</div>':''}
        <div class="lc-cl">${l.clave}</div>
        <div class="lc-m2">${f3(l.terreno)}m²</div>
        ${fusionBadge}${modeloTxt}${clienteTxt}
      </div>`;
    }).join('');

  // Tabla view
  $('inv-tabla-body').innerHTML=lots.map(l=>{
    const estDisp=l.estado_display||l.estado;
    const sc={Disponible:'#10b981','Entrega Rápida':'#f97316','Lote Especial':'#8b5cf6','Casa Muestra':'#3b82f6',Apartado:'#eab308',Vendido:'#ef4444',Subdividido:'#94a3b8'}[estDisp]||'#8896a7';
    return `<tr ${l.fraccion_de?'style="background:#fafbff"':''}>
      <td style="font-weight:700">${l.clave}${l.fraccion_de?'<span style="font-size:10px;color:var(--t3);margin-left:4px">fracc.</span>':''}</td>
      <td>${l.mz}</td><td>${l.lote}</td>
      <td><span class="badge" style="background:${sc}18;color:${sc}"><span class="bdot" style="background:${sc}"></span>${estDisp}</span></td>
      <td style="font-size:12px">${l.modelo_asignado||'—'}</td>
      <td style="font-size:12px;font-weight:${l.cliente_asignado?'600':'400'}">${l.cliente_asignado||'—'}</td>
      <td>${f3(l.terreno)}</td><td>${f3(l.excedente)}</td>
      <td>${l.plusvalia?mxn(l.plusvalia):'—'}</td>
      <td style="font-size:12px">${l.tipo}</td>
      <td><button class="btn btn-out btn-xs" onclick="openLoteDetail('${l.clave}')">Ver</button></td>
    </tr>`;
  }).join('');
}

function setInvView(m){
  IVIEW=m;
  $('inv-view-grid').style.display=m==='grid'?'block':'none';
  $('inv-view-tabla').style.display=m==='tabla'?'block':'none';
  $('iv-grid').className='btn btn-sm '+(m==='grid'?'btn-navy':'btn-out');
  $('iv-tabla').className='btn btn-sm '+(m==='tabla'?'btn-navy':'btn-out');
}
function openLoteDetail(clave){
  const l=getLote(clave); if(!l) return;
  $('ld-ttl').textContent=`Clave ${l.clave} — Mz ${l.mz} Lote ${l.lote}`;
  const estDisp=l.modelo_asignado&&!['Apartado','Vendido','Casa Muestra','Subdividido'].includes(l.estado)?'Entrega Rápida':(l.fraccion_fusionada&&l.estado==='Lote Especial'?'Lote Especial':l.estado);
  const sc={'Disponible':'#10b981','Entrega Rápida':'#f97316','Lote Especial':'#8b5cf6','Casa Muestra':'#3b82f6','Apartado':'#eab308','Vendido':'#ef4444','Subdividido':'#94a3b8'}[estDisp]||'#8896a7';
  // Fracciones derivadas (si este lote fue subdividido)
  const detRows=[
    ['Clave',l.clave],['Manzana',l.mz],['Lote',l.lote],
    ['Estado',`<span class="badge" style="background:${sc}18;color:${sc}">${estDisp}</span>`],
    ['Terreno',f3(l.terreno)+' m²'],['Excedente',f3(l.excedente)+' m²'],
    ['Plusvalía',l.plusvalia?mxn(l.plusvalia):'—'],['Tipo',l.tipo],
  ];
  if(l.modelo_asignado) detRows.push(['Modelo',`<b>${l.modelo_asignado}</b>`]);
  if(l.cliente_asignado) detRows.push(['Cliente',`<b>${l.cliente_asignado}</b>`]);
  if(l.fecha_operacion) detRows.push(['Fecha op.',fD(l.fecha_operacion)]);
  if(l.fraccion_fusionada) detRows.push(['Fracción',`${f3(l.fraccion_m2_adicional||0)}m² de lote ${l.fraccion_de||'—'}`]);
  const fracciones=DS.db.inventario.filter(x=>x.lote_origen===clave);
  $('ld-body').innerHTML=`<div class="infop">${detRows.map(r=>`<div class="ir"><span class="il">${r[0]}</span><span class="iv">${r[1]}</span></div>`).join('')}</div>`
  +(fracciones.length?`<div style="margin-top:12px;border-top:1px solid var(--bd);padding-top:10px"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Fracciones generadas</div>${fracciones.map(f=>{const fc={Disponible:'#10b981',Apartado:'#eab308',Vendido:'#ef4444'}[f.estado]||'#8896a7';return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;font-size:12px"><b>${f.clave}</b>&nbsp;${f3(f.terreno)}m²<span class="badge" style="background:${fc}18;color:${fc};font-size:10px">${f.estado}</span></div>`;}).join('')}</div>`:'')+
  (l.lote_origen?`<div style="margin-top:8px;padding:7px 10px;background:var(--s2);border-radius:6px;font-size:12px;color:var(--t2)">✂️ Fracción del lote <b>${l.lote_origen}</b></div>`:'');
  const isG=CU.rol==='gerente'||CU.rol==='administrador';
  let footBtns=`<button class="btn btn-out" onclick="closeM('m-lote')">Cerrar</button>`;
  const vendible=['Disponible','Entrega Rápida','Lote Especial'].includes(estDisp);
  if(vendible) footBtns+=`<button class="btn btn-gold" onclick="closeM('m-lote');openApartadoFlow('${clave}')">📋 Apartar</button>`;
  if(l.fraccion_fusionada&&isG) footBtns+=`<button class="btn btn-out btn-sm" style="margin-left:8px" onclick="closeM('m-lote');openSepararFraccion('${clave}')">✂️ Separar fracción</button>`;
  if(l.estado==='Subdividido'&&isG) footBtns+=`<button class="btn btn-green btn-sm" style="margin-left:8px" onclick="reactivarLote('${clave}')">🔄 Reactivar</button>`;
  if(isG) footBtns+=`<button class="btn btn-navy btn-sm" style="margin-left:8px" onclick="closeM('m-lote');openLoteModal('${clave}')">✏️ Editar</button>`;
  $('ld-foot').innerHTML=footBtns;
  openM('m-lote');
}
function openSepararFraccion(clave){
  const l=getLote(clave); if(!l||!l.fraccion_fusionada){toast('Este lote no tiene fracción fusionada','warn');return;}
  const P=getP();
  const pFrac=l.fraccion_precio_m2||P.precio_m2_lote_adicional||13000;
  const pExc=l.excedente_precio_m2||P.precio_m2_exc||9000;
  const fracM2=l.fraccion_m2_adicional||0;
  $('sep-info').innerHTML=`Este lote tiene fusionada una fracción de <b>${f3(fracM2)}m²</b> proveniente del lote <b>${l.fraccion_de||'—'}</b>.<br>Al separar, el lote vuelve a <b>${f3(l.terreno-fracM2)}m²</b>.`;
  const disponibles=DS.db.inventario.filter(x=>x.clave!==clave&&x.mz===l.mz&&!['Apartado','Vendido','Casa Muestra','Subdividido'].includes(x.estado));
  $('sep-lote-dest').innerHTML='<option value="">— Selecciona lote destino —</option>'+disponibles.map(x=>`<option value="${x.clave}">Clave ${x.clave} — ${f3(x.terreno)}m²</option>`).join('');
  // ── ¿Se puede reactivar el lote original? Solo si TODAS las fracciones derivadas están en lotes disponibles ──
  const orig=l.fraccion_de||'';
  const lOriginal=orig?getLote(orig):null;
  const hermanos=orig?DS.db.inventario.filter(x=>x.fraccion_fusionada&&x.fraccion_de===orig):[];
  const noDisp=hermanos.filter(x=>['Apartado','Vendido','Casa Muestra'].includes(x.estado));
  const puedeReactivar=!!(lOriginal&&lOriginal.estado==='Subdividido'&&hermanos.length>0&&noDisp.length===0);
  const rWrap=$('sep-opt-reactivar-wrap'), rRadio=$('sep-modo-reactivar'), rDesc=$('sep-reactivar-desc');
  if(puedeReactivar){
    rRadio.disabled=false; rWrap.style.opacity='1'; rWrap.style.cursor='pointer';
    rDesc.innerHTML=`Ambas fracciones están disponibles. Se retiran las fracciones de <b>${hermanos.map(h=>h.clave).join('</b> y <b>')}</b> (regresan a su tamaño original) y el lote <b>${orig}</b> (${f3(lOriginal.terreno)}m²) vuelve a estar <b>Disponible</b>.`;
  } else {
    rRadio.disabled=true; rWrap.style.opacity='.55'; rWrap.style.cursor='not-allowed';
    rDesc.innerHTML=noDisp.length
      ?`⛔ No disponible: la fracción en <b>${noDisp.map(h=>h.clave+' ('+h.estado+')').join('</b>, <b>')}</b> ya está comprometida. Solo puedes reasignar esta fracción a otro lote disponible.`
      :`⛔ No disponible: no se encontró el lote original subdividido.`;
  }
  $('sep-modo-reasignar').checked=true;
  sepModoChange();
  window._separacionPendiente={clave,fracM2,pFrac,pExc,orig,puedeReactivar};
  openM('m-separar');
}
function sepModoChange(){
  const reactivar=$('sep-modo-reactivar')?.checked;
  $('sep-dest-wrap').style.display=reactivar?'none':'block';
}
function reactivarLote(clave){
  const l=getLote(clave); if(!l||l.estado!=='Subdividido') return;
  // Advertir si existen fracciones activas
  const fracciones=DS.db.inventario.filter(x=>x.lote_origen===clave);
  const fracActivas=fracciones.filter(x=>x.estado!=='Vendido');
  let advertencia=`¿Reactivar el lote ${clave} (${f3(l.terreno)}m²) a estado Disponible?\n\nEsta acción permite volver a usar el lote original.`;
  if(fracActivas.length){
    const detalle=fracActivas.map(f=>`• ${f.clave}: ${f3(f.terreno)}m² — ${f.estado}`).join('\n');
    advertencia+=`\n\n⚠️ ADVERTENCIA: Existen ${fracActivas.length} fracción(es) derivada(s) aún activa(s):\n${detalle}\n\nReactivar el lote original NO elimina las fracciones. Ambos coexistirán en el inventario. ¿Deseas continuar?`;
  }
  if(!confirm(advertencia)) return;
  const now=new Date().toISOString();
  const li=DS.db.inventario.findIndex(x=>x.clave===clave);
  if(li<0) return;
  const hist=[...(l.historial||[]),{estadoAnterior:'Subdividido',estadoNuevo:'Disponible',fecha:now,usuario:CU.id,nota:'Lote reactivado manualmente por gerente'+(fracActivas.length?` — ${fracActivas.length} fracción(es) activa(s) coexistirán`:'')}];
  DS.db.inventario[li]={...DS.db.inventario[li],estado:'Disponible',historial:hist};
  DS._save(DS.db);
  closeM('m-lote');
  renderInventario(); populateSelects();
  toast(`Lote ${clave} reactivado a Disponible ✓`,'ok',4000);
}
function openLoteModal(clave=null){
  const isEdit=!!clave;
  $('le-ttl').textContent=isEdit?`Editar Lote ${clave}`:'Nuevo Lote';
  $('le-id').value=clave||'';
  $('le-del-btn').style.display=isEdit?'inline-flex':'none';
  $('le-div-preview').style.display='none';
  // Populate modelo select for lote edit
  const todosModelos=DS.getModelos();
  $('le-modelo').innerHTML='<option value="">— Sin modelo —</option>'+todosModelos.map(m=>`<option value="${m.nombre}">${m.nombre}</option>`).join('');

  if(isEdit){
    const l=getLote(clave);
    $('le-mz').value=l.mz; $('le-lote').value=l.lote; $('le-ter').value=f3(l.terreno);
    $('le-exc').value=f3(l.excedente); $('le-plus').value=l.plusvalia||0; $('le-tipo').value=l.tipo||'—';
    $('le-est').value=l.estado;
    $('le-modelo').value=l.modelo_asignado||'';
    $('le-cliente').value=l.cliente_asignado||'';
    $('le-fecha-op').value=l.fecha_operacion||'';
    $('le-dir-oficial').value=l.dir_oficial||'';
    const esSub=l.estado==='Subdividido';
    ['le-ter','le-exc','le-plus','le-tipo','le-est'].forEach(f=>{$(f).disabled=esSub;});
    $('le-dividir-wrap').style.display=(!esSub)?'block':'none';
    const hist=l.historial||[];
    if(hist.length){
      $('le-historial').style.display='block';
      $('le-hist-list').innerHTML=hist.slice(-5).reverse().map(h=>`<div style="font-size:12px;padding:6px 0;border-bottom:1px solid var(--bd2)"><b>${h.estadoNuevo}</b> · ${fD(h.fecha)} · ${getUser(h.usuario).nombre.split(' ')[0]}${h.nota?` · ${h.nota}`:''}</div>`).join('');
    } else $('le-historial').style.display='none';
  } else {
    ['le-mz','le-lote','le-ter','le-exc','le-plus'].forEach(f=>{$(f).value='';$(f).disabled=false;});
    $('le-tipo').value='—'; $('le-tipo').disabled=false;
    $('le-est').value='Disponible'; $('le-est').disabled=false;
    $('le-dividir-wrap').style.display='none';
    $('le-historial').style.display='none';
  }
  openM('m-lote-edit');
}
function dividirIgual(){
  const ter=parseFloat($('le-ter').value)||0;
  if(!ter){ toast('Guarda el terreno primero','err'); return; }
  $('le-div-preview').style.display='block';
  $('le-div-a').value=(ter/2).toFixed(3);
  calcDivision();
}
function dividirManual(){
  const ter=parseFloat($('le-ter').value)||0;
  if(!ter){ toast('Guarda el terreno primero','err'); return; }
  $('le-div-preview').style.display='block';
  $('le-div-a').value=''; $('le-div-b').value=''; $('le-div-result').textContent='';
  $('le-div-a').focus();
}
function calcDivision(){
  const ter=parseFloat($('le-ter').value)||0;
  const a=parseFloat($('le-div-a').value)||0;
  const b=parseFloat((ter-a).toFixed(3)); // 3 decimales precisión
  $('le-div-b').value=b>0?b:'';
  const clave=$('le-id').value;
  const l=clave?getLote(clave):null;
  if(a>0&&b>0&&a<ter){
    const vA=a*14500+(l?l.plusvalia||0:0); // full precision preview
    const vB=b*14500;
    $('le-div-result').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
      <div style="background:#f0fdf4;border-radius:8px;padding:10px;font-size:12px"><b>${clave}A</b><br>${f3(a)}m² · ${mxn(vA)}</div>
      <div style="background:#eff6ff;border-radius:8px;padding:10px;font-size:12px"><b>${clave}B</b><br>${f3(b)}m² · ${mxn(vB)}</div></div>`;
  } else { $('le-div-result').textContent=a>=ter?'⚠ El lote A no puede ser igual o mayor al original':''; }
}
function confirmarDivision(){
  const clave=$('le-id').value; if(!clave){toast('No hay lote seleccionado','err');return;}
  const l=getLote(clave); if(!l){toast('Lote no encontrado','err');return;}
  const terA=parseFloat($('le-div-a').value)||0;
  const terB=parseFloat($('le-div-b').value)||0;
  if(!terA||!terB||terA<=0||terB<=0){toast('Define los m² de cada fracción','err');return;}
  if(Math.abs(terA+terB-l.terreno)>0.001){toast('Los m² no suman el total del lote original','err');return;}
  const disponiblesEnMz=DS.db.inventario.filter(x=>x.clave!==clave&&x.mz===l.mz&&!['Apartado','Vendido','Casa Muestra','Subdividido'].includes(x.estado));
  if(disponiblesEnMz.length<2){toast('Se necesitan al menos 2 lotes disponibles en la manzana para fusionar','err');return;}
  const opts=disponiblesEnMz.map(x=>`<option value="${x.clave}">Clave ${x.clave} — Lote ${x.lote} (${f3(x.terreno)}m²)</option>`).join('');
  $('fusion-ttl').textContent=`Dividir Lote ${clave} y fusionar fracciones`;
  $('fusion-info').innerHTML=`
    <b>Fracción A: ${f3(terA)}m²</b> — precio: $13,500/m²<br>
    <b>Fracción B: ${f3(terB)}m²</b> — precio: $13,500/m²<br><br>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
      <div><label style="font-size:11px;font-weight:700;color:#1e40af;display:block;margin-bottom:4px">Fracción A → fusionar con:</label>
        <select id="fusion-dest-a" onchange="previewFusion()" style="width:100%;border:1.5px solid #bfdbfe;border-radius:6px;padding:6px 8px;font-size:12.5px"><option value="">— Selecciona —</option>${opts}</select></div>
      <div><label style="font-size:11px;font-weight:700;color:#1e40af;display:block;margin-bottom:4px">Fracción B → fusionar con:</label>
        <select id="fusion-dest-b" onchange="previewFusion()" style="width:100%;border:1.5px solid #bfdbfe;border-radius:6px;padding:6px 8px;font-size:12.5px"><option value="">— Selecciona —</option>${opts}</select></div>
    </div>`;
  $('fusion-preview').style.display='none';
  window._divisionPendiente={clave,l,terA,terB};
  closeM('m-lote-edit'); openM('m-fusion');
}
function previewFusion(){
  const da=$('fusion-dest-a')?.value; const db=$('fusion-dest-b')?.value;
  if(!da||!db||!window._divisionPendiente){$('fusion-preview').style.display='none';return;}
  const {terA,terB}=window._divisionPendiente;
  const P=getP(); const pFrac=P.precio_m2_lote_adicional||13000; const pExc=P.precio_m2_exc||9000;
  const lA=getLote(da); const lB=getLote(db); if(!lA||!lB) return;
  const terAR=lA.terreno+terA; const terBR=lB.terreno+terB;
  $('fusion-preview').style.display='block';
  $('fusion-preview-content').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div style="background:#f0fdf4;border-radius:8px;padding:10px;font-size:12px"><b>Lote ${da} ampliado</b><br>
      Original: ${f3(lA.terreno)}m² + Fracción A: ${f3(terA)}m²<br>
      Excedente orig (${f3(lA.excedente)}m²) × ${mxn(pExc)}/m² = ${mxn(lA.excedente*pExc)}<br>
      Fracción (${f3(terA)}m²) × ${mxn(pFrac)}/m² = ${mxn(terA*pFrac)}<br>
      <b style="color:#065f46">Nuevo total: ${f3(terAR)}m²</b></div>
    <div style="background:#eff6ff;border-radius:8px;padding:10px;font-size:12px"><b>Lote ${db} ampliado</b><br>
      Original: ${f3(lB.terreno)}m² + Fracción B: ${f3(terB)}m²<br>
      Excedente orig (${f3(lB.excedente)}m²) × ${mxn(pExc)}/m² = ${mxn(lB.excedente*pExc)}<br>
      Fracción (${f3(terB)}m²) × ${mxn(pFrac)}/m² = ${mxn(terB*pFrac)}<br>
      <b style="color:#1e40af">Nuevo total: ${f3(terBR)}m²</b></div></div>`;
}
function confirmarFusion(){
  const da=$('fusion-dest-a')?.value; const db=$('fusion-dest-b')?.value;
  if(!da||!db){toast('Selecciona lote destino para cada fracción','err');return;}
  if(da===db){toast('No puedes fusionar ambas fracciones en el mismo lote','err');return;}
  if(!window._divisionPendiente){toast('Error: recarga y vuelve a intentarlo','err');return;}
  const {clave,l,terA,terB}=window._divisionPendiente;
  const lA=getLote(da); const lB=getLote(db);
  if(!lA||!lB){toast('Lote destino no encontrado','err');return;}
  const P=getP(); const pFrac=P.precio_m2_lote_adicional||13000; const pExc=P.precio_m2_exc||9000;
  const now=new Date().toISOString();
  // 1. Ocultar lote original como Subdividido
  const liOrig=DS.db.inventario.findIndex(x=>x.clave===clave);
  if(liOrig>=0) DS.db.inventario[liOrig]={...DS.db.inventario[liOrig],estado:'Subdividido',
    historial:[...(DS.db.inventario[liOrig].historial||[]),
    {estadoAnterior:l.estado,estadoNuevo:'Subdividido',fecha:now,usuario:CU.id,nota:`Fusionado: FracA(${f3(terA)}m²)→${da}, FracB(${f3(terB)}m²)→${db}`}]};
  // 2. Crecer Lote A
  const liA=DS.db.inventario.findIndex(x=>x.clave===da);
  if(liA>=0){
    const nTerA=parseFloat((lA.terreno+terA).toFixed(3));
    DS.db.inventario[liA]={...DS.db.inventario[liA],terreno:nTerA,valor_terreno:nTerA*14500+lA.plusvalia,
      fraccion_fusionada:true,fraccion_de:clave,fraccion_m2_adicional:parseFloat(terA.toFixed(3)),
      fraccion_precio_m2:pFrac,excedente_precio_m2:pExc,estado:'Lote Especial',
      historial:[...(DS.db.inventario[liA].historial||[]),
      {estadoAnterior:lA.estado,estadoNuevo:'Lote Especial',fecha:now,usuario:CU.id,nota:`+Fracción A de ${clave} (${f3(terA)}m²)`}]};
  }
  // 3. Crecer Lote B
  const liB=DS.db.inventario.findIndex(x=>x.clave===db);
  if(liB>=0){
    const nTerB=parseFloat((lB.terreno+terB).toFixed(3));
    DS.db.inventario[liB]={...DS.db.inventario[liB],terreno:nTerB,valor_terreno:nTerB*14500+lB.plusvalia,
      fraccion_fusionada:true,fraccion_de:clave,fraccion_m2_adicional:parseFloat(terB.toFixed(3)),
      fraccion_precio_m2:pFrac,excedente_precio_m2:pExc,estado:'Lote Especial',
      historial:[...(DS.db.inventario[liB].historial||[]),
      {estadoAnterior:lB.estado,estadoNuevo:'Lote Especial',fecha:now,usuario:CU.id,nota:`+Fracción B de ${clave} (${f3(terB)}m²)`}]};
  }
  DS._save(DS.db); delete window._divisionPendiente;
  closeM('m-fusion'); renderInventario(); populateSelects();
  toast(`Lote ${clave} → ${da} y ${db} crecidos como Lote Especial ✓`,'ok',5000);
}
function confirmarSeparacion(){
  if(!window._separacionPendiente){toast('Recarga y vuelve a intentarlo','err');return;}
  // ── MODO REACTIVAR: devolver todas las fracciones y reactivar el lote original ──
  if($('sep-modo-reactivar')?.checked){
    const {orig,puedeReactivar}=window._separacionPendiente;
    if(!puedeReactivar){toast('No es posible reactivar: una fracción ya está comprometida','err');return;}
    const lOriginal=getLote(orig);
    const hermanos=DS.db.inventario.filter(x=>x.fraccion_fusionada&&x.fraccion_de===orig);
    const noDisp=hermanos.filter(x=>['Apartado','Vendido','Casa Muestra'].includes(x.estado));
    if(!lOriginal||lOriginal.estado!=='Subdividido'||noDisp.length){toast('Ya no es posible reactivar: verifica el estado de las fracciones','err');return;}
    if(!confirm(`¿Reactivar el lote original ${orig} (${f3(lOriginal.terreno)}m²)?\n\nSe retiran las fracciones de: ${hermanos.map(h=>h.clave).join(', ')}\n(cada lote regresa a su tamaño y estado original)\ny el lote ${orig} vuelve a Disponible.`)) return;
    const now=new Date().toISOString();
    // 1. Retirar la fracción de cada lote anfitrión
    hermanos.forEach(h=>{
      const hi=DS.db.inventario.findIndex(x=>x.clave===h.clave);
      if(hi<0) return;
      const fm2=h.fraccion_m2_adicional||0;
      const nT=parseFloat((h.terreno-fm2).toFixed(3));
      DS.db.inventario[hi]={...DS.db.inventario[hi],terreno:nT,valor_terreno:nT*14500+(h.plusvalia||0),
        fraccion_fusionada:false,fraccion_de:null,fraccion_m2_adicional:0,estado:'Disponible',
        historial:[...(h.historial||[]),{estadoAnterior:h.estado,estadoNuevo:'Disponible',fecha:now,usuario:CU.id,nota:`Fracción (${f3(fm2)}m²) devuelta — lote original ${orig} reactivado`}]};
    });
    // 2. Reactivar el lote original
    const oi=DS.db.inventario.findIndex(x=>x.clave===orig);
    if(oi>=0){
      DS.db.inventario[oi]={...DS.db.inventario[oi],estado:'Disponible',
        historial:[...(lOriginal.historial||[]),{estadoAnterior:'Subdividido',estadoNuevo:'Disponible',fecha:now,usuario:CU.id,nota:`Lote reactivado — fracciones devueltas por ${hermanos.map(h=>h.clave).join(', ')}`}]};
    }
    DS._save(DS.db); delete window._separacionPendiente;
    closeM('m-separar'); renderInventario(); populateSelects();
    toast(`Lote ${orig} reactivado ✓ — fracciones devueltas`,'ok',5000);
    return;
  }
  // ── MODO REASIGNAR (comportamiento original) ──
  const dest=$('sep-lote-dest').value;
  if(!dest){toast('Selecciona lote destino','err');return;}
  const {clave,fracM2,pFrac,pExc}=window._separacionPendiente;
  const lOrig=getLote(clave); const lDest=getLote(dest);
  if(!lOrig||!lDest){toast('Lote no encontrado','err');return;}
  const now=new Date().toISOString();
  // Quitar fracción del lote origen
  const liO=DS.db.inventario.findIndex(x=>x.clave===clave);
  if(liO>=0){const nT=parseFloat((lOrig.terreno-fracM2).toFixed(3));
    DS.db.inventario[liO]={...DS.db.inventario[liO],terreno:nT,valor_terreno:nT*14500+lOrig.plusvalia,
      fraccion_fusionada:false,fraccion_de:null,fraccion_m2_adicional:0,estado:'Disponible',
      historial:[...(lOrig.historial||[]),{estadoAnterior:'Lote Especial',estadoNuevo:'Disponible',fecha:now,usuario:CU.id,nota:`Fracción (${f3(fracM2)}m²) reasignada a ${dest}`}]};}
  // Agregar fracción al lote destino
  const liD=DS.db.inventario.findIndex(x=>x.clave===dest);
  if(liD>=0){const nT=parseFloat((lDest.terreno+fracM2).toFixed(3));
    DS.db.inventario[liD]={...DS.db.inventario[liD],terreno:nT,valor_terreno:nT*14500+lDest.plusvalia,
      fraccion_fusionada:true,fraccion_de:lOrig.fraccion_de||clave,fraccion_m2_adicional:fracM2,fraccion_precio_m2:pFrac,excedente_precio_m2:pExc,estado:'Lote Especial',
      historial:[...(lDest.historial||[]),{estadoAnterior:lDest.estado,estadoNuevo:'Lote Especial',fecha:now,usuario:CU.id,nota:`Fracción (${f3(fracM2)}m²) de ${clave}`}]};}
  DS._save(DS.db); delete window._separacionPendiente;
  closeM('m-separar'); renderInventario(); populateSelects();
  toast(`Fracción separada de ${clave} → fusionada con ${dest} ✓`,'ok',4000);
}
function saveLote(){
  const mz=parseInt($('le-mz').value); const loteNum=$('le-lote').value.trim();
  const ter=parseFloat($('le-ter').value); const exc=parseFloat($('le-exc').value)||0;
  const plus=parseFloat($('le-plus').value)||0; const tipo=$('le-tipo').value;
  const est=$('le-est').value;
  if(!mz||!loteNum||!ter){ toast('Manzana, lote y terreno son requeridos','err'); return; }
  // FIX: declare all vars at top level so both if/else can use them
  const modeloAsg=$('le-modelo').value||'';
  const clienteAsg=$('le-cliente').value.trim();
  const fechaOp=$('le-fecha-op').value||'';
  let estFinal=est;
  if(modeloAsg&&['Disponible','Lote Especial'].includes(est)) estFinal='Entrega Rápida';
  const P=getP();
  const valor_terreno=ter*14500+plus; // full precision, no premature round
  const clave=$('le-id').value;
  const histEntry={estadoAnterior:clave?getLote(clave)?.estado:'',estadoNuevo:estFinal,fecha:new Date().toISOString(),usuario:CU.id,nota:''};
  if(clave){
    const li=DS.db.inventario.findIndex(l=>l.clave===clave);
    if(li>=0){
      const old=DS.db.inventario[li];
      const hist=[...(old.historial||[])];
      if(old.estado!==estFinal) hist.push({...histEntry});
      DS.db.inventario[li]={...old,mz,lote:loteNum,terreno:parseFloat(ter.toFixed(3)),excedente:parseFloat(exc.toFixed(3)),plusvalia:plus,tipo_ubicacion:tipo,tipo,estado:estFinal,valor_terreno,modelo_asignado:modeloAsg,cliente_asignado:clienteAsg,fecha_operacion:fechaOp,dir_oficial:$('le-dir-oficial').value.trim(),historial:hist};
      DS._save(DS.db);
    }
    toast('Lote actualizado ✓','ok');
  } else {
    const loteEsNumero=/^\d+$/.test(String(loteNum));
    const nuevaClave=String(mz)+(loteEsNumero?String(loteNum).padStart(2,'0'):String(loteNum));
    if(DS.db.inventario.some(x=>x.clave===nuevaClave)){ toast(`Ya existe un lote con clave ${nuevaClave}`,'err'); return; }
    DS.db.inventario.push({clave:nuevaClave,mz,lote:loteNum,estado:estFinal,terreno:parseFloat(ter.toFixed(3)),excedente:parseFloat(exc.toFixed(3)),precio_m2:9000,plusvalia:plus,valor_terreno,tipo,modelo_asignado:modeloAsg,cliente_asignado:clienteAsg,fecha_operacion:fechaOp,dir_oficial:$('le-dir-oficial').value.trim(),historial:[histEntry]});
    DS._save(DS.db);
    toast('Lote creado ✓','ok');
  }
  closeM('m-lote-edit'); renderInventario(); populateSelects();
}
function deleteLote(){
  const clave=$('le-id').value; if(!clave) return;
  const l=getLote(clave);
  if(l?.estado!=='Disponible'){ toast('Solo se pueden eliminar lotes Disponibles','warn'); return; }
  if(!confirm(`¿Eliminar lote ${clave}? Esta acción no se puede deshacer.`)) return;
  DS.db.inventario=DS.db.inventario.filter(l=>l.clave!==clave);
  DS._save(DS.db);
  closeM('m-lote-edit'); renderInventario(); populateSelects();
  toast('Lote eliminado','warn');
}


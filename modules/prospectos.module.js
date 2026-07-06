/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/prospectos.module.js
   Módulo Prospectos/CRM: lista, kanban, ficha, seguimientos, recordatorios.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// PROSPECTOS
// ================================================================
function renderProspectos(){ populateSelects(); filterProsp(); }
function filterProsp(){
  const q=($('s-prosp')?.value||'').toLowerCase();
  const se=$('f-est')?.value||'';
  const sa=$('f-asesor-p')?.value||'';
  const sf=$('f-fuente')?.value||'';
  let list=CU.rol==='gerente'||CU.rol==='administrador'?DS.find('prospectos'):DS.find('prospectos',{asesor:CU.id});
  // Filtro por estatus
  if(se==='__todos__'){
    // mostrar todos sin filtro
  } else if(se!==''){
    list=list.filter(p=>p.estatus===se);
  } else {
    // Vista default: solo activos
    list=list.filter(p=>!ESTATUS_INACTIVOS.includes(p.estatus));
  }
  if(q){
    const qNorm=q.replace(/\s+/g,'');
    list=list.filter(p=>p.nombre.toLowerCase().includes(q)||(p.telefono||'').replace(/\s+/g,'').includes(qNorm)||(p.correo||'').toLowerCase().includes(q));
  }
  if(sa) list=list.filter(p=>p.asesor===sa);
  if(sf) list=list.filter(p=>p.fuente===sf);
  list.sort((a,b)=>new Date(b.fechaRegistro)-new Date(a.fechaRegistro));
  if(PVIEW==='lista') renderListaView(list);
  else renderKanbanView(list);
}
function setView(m){
  PVIEW=m;
  $('view-lista').style.display=m==='lista'?'block':'none';
  $('view-kanban').style.display=m==='kanban'?'block':'none';
  $('v-lista').className='btn btn-sm '+(m==='lista'?'btn-navy':'btn-out');
  $('v-kanban').className='btn btn-sm '+(m==='kanban'?'btn-navy':'btn-out');
  filterProsp();
}
function renderListaView(list){
  const tb=$('prosp-tbody');
  if(!list.length){ tb.innerHTML=`<tr><td colspan="8"><div class="empty"><div class="empty-i">👥</div><p>Sin prospectos con estos filtros.</p></div></td></tr>`; return; }
  tb.innerHTML=list.map(p=>{const a=getUser(p.asesor);return `<tr style="cursor:pointer" onclick="openDetalle('${p.id}')">
    <td><div style="font-weight:600">${p.nombre}</div><div style="font-size:11.5px;color:var(--t3)">${p.telefono}</div></td>
    <td style="color:var(--t2)">${p.fuente||'—'}</td>
    <td style="font-weight:500">${mxn(p.presupuesto)}</td>
    <td>${scoreBadge(p)}</td>
    <td><div style="display:flex;align-items:center;gap:6px"><div class="av" style="width:24px;height:24px;font-size:10px">${a.nombre.charAt(0)}</div>${a.nombre.split(' ')[0]}</div></td>
    <td>${sBadge(p.estatus)}</td>
    <td style="color:var(--t3);font-size:12px">${fDS(p.fechaRegistro)}</td>
    <td onclick="event.stopPropagation()"><button class="btn btn-out btn-xs" onclick="openDetalle('${p.id}')">Ver</button></td>
  </tr>`;}).join('');
}
function renderKanbanView(list){
  $('kanban-board').innerHTML=ESTATUS_ACTIVOS.map(est=>{
    const cs=list.filter(p=>p.estatus===est);
    return `<div class="k-col" ondragover="kDragOver(event)" ondrop="kDrop(event,'${est}')" data-est="${est}">
      <div class="k-hdr"><div class="k-ttl">${est}</div><div class="k-cnt">${cs.length}</div></div>
      <div class="k-cards">${cs.length===0?'<div class="k-empty">Arrastra aquí</div>':cs.map(p=>{const a=getUser(p.asesor);return `<div class="k-card" draggable="true" onclick="openDetalle('${p.id}')" ondragstart="kDragStart(event,'${p.id}')" ondragend="kDragEnd(event)" data-pid="${p.id}"><div class="k-nm">${p.nombre}</div><div class="k-ph">${p.telefono}</div><div class="k-ft"><div style="font-size:11px;color:var(--t3)">${a.nombre.split(' ')[0]}</div>${scoreBadge(p)}</div></div>`;}).join('')}</div>
    </div>`;
  }).join('');
}
function auditLog(tabla,id,accion,antes,despues){ DS.audit(tabla,id,accion,antes,despues); }
let _dragPid=null;
function kDragStart(e,pid){ _dragPid=pid; e.currentTarget.style.opacity='.45'; e.dataTransfer.effectAllowed='move'; }
function kDragEnd(e){ e.currentTarget.style.opacity='1'; document.querySelectorAll('.k-col').forEach(c=>c.classList.remove('k-drag-over')); }
function kDragOver(e){ e.preventDefault(); e.dataTransfer.dropEffect='move'; e.currentTarget.closest('.k-col')?.classList.add('k-drag-over'); }
function kDrop(e,nuevoEst){
  e.preventDefault();
  document.querySelectorAll('.k-col').forEach(c=>c.classList.remove('k-drag-over','k-drag-over-cita','k-drag-over-apt','k-drag-over-seg'));
  if(!_dragPid) return;
  const p=DS.findOne('prospectos',_dragPid);
  if(!p||p.estatus===nuevoEst){ _dragPid=null; return; }
  _dragPrevEst=p.estatus; // store previous for cancel

  if(nuevoEst==='Cita agendada'){
    // Show cita modal
    const d=new Date(); d.setDate(d.getDate()+1);
    $('kc-fecha').value=d.toISOString().split('T')[0];
    $('kc-hora').value='10:00'; $('kc-nota').value='';
    openM('m-kanban-cita'); return;
  }
  if(nuevoEst==='Apartado'){
    // Must create apartado — open flow, cancel = revert
    openApartadoFlow();
    // Auto-select this prospecto in the apartado modal
    setTimeout(()=>{ if($('ap-cli')) $('ap-cli').value=_dragPid; fillAsesor(); },100);
    return;
  }
  if(nuevoEst==='Seguimiento'){
    const d=new Date(); d.setDate(d.getDate()+3);
    $('ks-fecha').value=d.toISOString().split('T')[0];
    $('ks-hora').value='10:00'; $('ks-nota').value='';
    openM('m-kanban-seg'); return;
  }
  // Default: move immediately
  doKanbanMove(_dragPid, nuevoEst, p.estatus);
}
let _dragPrevEst=null;
function cancelKanbanAction(){
  // Revert the kanban drag — no state change
  _dragPid=null; _dragPrevEst=null;
  $$('.mbd.open').forEach(m=>m.classList.remove('open'));
  filterProsp();
}
function confirmKanbanCita(){
  const fecha=$('kc-fecha').value; if(!fecha){toast('Selecciona una fecha','err');return;}
  const pid=_dragPid; const prev=_dragPrevEst;
  if(!pid) return;
  doKanbanMove(pid,'Cita agendada',prev);
  DS.create('recordatorios',{prospectoId:pid,tipo:'Cita agendada',fecha,hora:$('kc-hora').value,nota:$('kc-nota').value.trim()||'Cita en desarrollo',estado:'pendiente',usuario:CU.id});
  closeM('m-kanban-cita'); _dragPid=null; _dragPrevEst=null;
  toast('Cita agendada y recordatorio creado ✓','ok');
}
function confirmKanbanSeg(){
  const fecha=$('ks-fecha').value; if(!fecha){toast('Selecciona una fecha','err');return;}
  const pid=_dragPid; const prev=_dragPrevEst;
  if(!pid) return;
  doKanbanMove(pid,'Seguimiento',prev);
  DS.create('recordatorios',{prospectoId:pid,tipo:'Seguimiento WhatsApp',fecha,hora:$('ks-hora').value,nota:$('ks-nota').value.trim()||'Seguimiento por WhatsApp',estado:'pendiente',usuario:CU.id});
  closeM('m-kanban-seg'); _dragPid=null; _dragPrevEst=null;
  toast('Movido a Seguimiento — recordatorio creado ✓','ok');
}
function doKanbanMove(pid, nuevoEst, anterior){
  DS.update('prospectos',pid,{estatus:nuevoEst});
  const now=new Date().toISOString();
  DS.create('seguimientos',{prospectoId:pid,tipo:'Nota interna',nota:`Kanban: ${anterior} → ${nuevoEst}`,fecha:now,usuario:CU.id,estatusCambio:nuevoEst});
  auditLog('prospectos',pid,'KANBAN_MOVE',{estatus:anterior},{estatus:nuevoEst});
  // ── FASE 1.9: sincronizar automáticamente la Oportunidad de esta Persona ──
  try{ IANNA_OPO.sincronizarDesdeProspecto(pid, nuevoEst); }catch(e){ console.error('sincronizar Oportunidad',e); }
  filterProsp(); updateBell();
}
function openProspectoModal(editId=null){
  populateSelects();
  $('mp-ttl').textContent=editId?'Editar Prospecto':'Nuevo Prospecto';
  $('mp-id').value=editId||'';
  if(editId){
    const p=DS.findOne('prospectos',editId);
    $('mp-nm').value=p.nombre; $('mp-ph').value=p.telefono; $('mp-em').value=p.correo||'';
    $('mp-fue').value=p.fuente||'Facebook'; $('mp-ec').value=p.estadoCivil||'Soltero'; onFuenteChange(); if(p.brokerId) setTimeout(()=>$('mp-broker').value=p.brokerId,50);
    $('mp-pre').value=p.presupuesto?p.presupuesto.toLocaleString('es-MX'):''; $('mp-eng').value=p.enganche?p.enganche.toLocaleString('es-MX'):''; $('mp-ing').value=p.ingresos?p.ingresos.toLocaleString('es-MX'):'';
    $('mp-est').value=p.estatus; $('mp-ases').value=p.asesor||''; $('mp-com').value=p.comentarios||'';
    $('mp-ases-wrap').style.display='';
  } else {
    ['mp-nm','mp-ph','mp-em','mp-pre','mp-eng','mp-ing','mp-com'].forEach(f=>$(f).value='');
    $('mp-fue').value='Facebook'; $('mp-ec').value='Soltero'; $('mp-est').value='Nuevo'; $('mp-broker-wrap').style.display='none';
    if(CU.rol==='asesor'){ $('mp-ases').value=CU.id; $('mp-ases-wrap').style.display='none'; }
    else $('mp-ases-wrap').style.display='';
  }
  openM('m-prosp');
}
function saveProspecto(){
  const nm=$('mp-nm').value.trim(), ph=$('mp-ph').value.trim();
  if(!nm||!ph){ toast('Nombre y teléfono son requeridos','err'); return; }
  const pid=$('mp-id').value;
  const data={nombre:nm,telefono:fmtTelVal(ph),correo:$('mp-em').value.trim(),fuente:$('mp-fue').value,estadoCivil:$('mp-ec').value,presupuesto:parseMoneyInput($('mp-pre').value),enganche:parseMoneyInput($('mp-eng').value),ingresos:parseMoneyInput($('mp-ing').value),estatus:$('mp-est').value,asesor:CU.rol==='asesor'?CU.id:$('mp-ases').value,comentarios:$('mp-com').value.trim(),brokerId:$('mp-fue').value==='Broker'?$('mp-broker').value:null};
  // ── MOTOR: cliente único — jamás dos expedientes para la misma persona ──
  const valDup=IANNA_MOTOR.validarProspectoUnico({telefono:data.telefono, correo:data.correo, editId:pid||undefined});
  if(!valDup.ok){ IANNA_MOTOR.bloquear('prospectos', valDup.dup.id, 'CREAR_PROSPECTO_DUPLICADO', valDup.errores.join(' ')); return; }
  if(pid){
    const antesP=DS.findOne('prospectos',pid)||{};
    DS.update('prospectos',pid,data);
    IANNA_MOTOR.auditar('prospectos', pid, 'EDITAR_PROSPECTO', {nombre:antesP.nombre, telefono:antesP.telefono, estatus:antesP.estatus}, {nombre:data.nombre, telefono:data.telefono, estatus:data.estatus}, 'Edición de expediente');
    toast('Prospecto actualizado ✓','ok');
  }
  else { data.fechaRegistro=new Date().toISOString(); DS.create('prospectos',data); IANNA_MOTOR.auditar('prospectos', data.telefono, 'CREAR_PROSPECTO', {}, {nombre:data.nombre, telefono:data.telefono}, 'Alta de prospecto'); toast('Prospecto registrado ✓','ok'); }
  closeM('m-prosp'); filterProsp(); renderDashboard(); updateBell();
}
function onFuenteChange(){
  const isBroker=$('mp-fue').value==='Broker';
  $('mp-broker-wrap').style.display=isBroker?'':'none';
}
function editProspecto(id){ closeM('m-det'); setTimeout(()=>openProspectoModal(id),150); }
function eliminarProspecto(pid){
  if(!pid) return;
  const p=DS.findOne('prospectos',pid);
  // ── MOTOR: eliminaciones protegidas — la información histórica NO se borra ──
  const chk=IANNA_MOTOR.puedeEliminarProspecto(pid);
  if(!chk.fisico){
    const r=chk.relaciones;
    const det=[r.apartados?`${r.apartados} apartado(s)/venta(s)`:null, r.seguimientos?`${r.seguimientos} seguimiento(s)`:null, r.cotizaciones?`${r.cotizaciones} cotización(es)`:null].filter(Boolean).join(', ');
    if(!confirm(`"${p?.nombre}" tiene información relacionada (${det}).\n\nPor integridad, el expediente NO se elimina: se marcará como INACTIVO (se oculta de las vistas y conserva todo su historial).\n\n¿Marcar como Inactivo?`)) return;
    DS.update('prospectos',pid,{estatus:'Inactivo', inactivado_fecha:new Date().toISOString(), inactivado_usuario:CU.id});
    IANNA_MOTOR.auditar('prospectos', pid, 'INACTIVAR_PROSPECTO', {estatus:p?.estatus}, {estatus:'Inactivo', relaciones:det}, 'Eliminación protegida: expediente con historial pasa a Inactivo');
    closeM('m-det'); filterProsp(); renderDashboard();
    toast(`"${p?.nombre}" marcado como Inactivo — historial conservado ✓`,'warn');
    return;
  }
  if(!confirm(`¿Eliminar a "${p?.nombre}" permanentemente? (No tiene historial relacionado.)`)) return;
  DS.delete('prospectos',pid);
  IANNA_MOTOR.auditar('prospectos', pid, 'ELIMINAR_PROSPECTO', {nombre:p?.nombre}, {}, 'Eliminación física: expediente sin relaciones');
  closeM('m-det'); filterProsp(); renderDashboard();

  toast('Prospecto eliminado','warn');
}
function openDetalle(pid){
  CU_PID=pid;
  const p=DS.findOne('prospectos',pid); if(!p) return;
  $('det-nm').textContent=p.nombre;
  $('det-meta').textContent=`📅 ${fD(p.fechaRegistro)} · ${p.fuente||'—'} · Score ${calcScore(p)}/100`;
  const t=(p.telefono||'').replace(/\D/g,'');
  $('det-wa').href=`https://wa.me/52${t}?text=Hola%20${encodeURIComponent(p.nombre.split(' ')[0])}%2C%20le%20contactamos%20de%20Valle%20de%20Arag%C3%B3n.`;
  // Mostrar botón eliminar solo a gerente
  $$('.nav-admin').forEach(el=>{ if(el.id==='as-del-btn') el.style.display=CU.rol==='gerente'||CU.rol==='administrador'?'inline-flex':'none'; });
  const a=getUser(p.asesor);
  const brokerRow=p.brokerId?[['Broker',DS.findOne('brokers',p.brokerId)?.nombre||'—']]:[];
  $('det-info').innerHTML='<div style="font-size:10.5px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Ficha del prospecto</div>'+[['Teléfono',p.telefono],['Correo',p.correo||'—'],['Fuente',p.fuente||'—'],...brokerRow,['Estado civil',p.estadoCivil||'—'],['Presupuesto',mxn(p.presupuesto)],['Enganche',mxn(p.enganche)],['Ingresos/mes',mxn(p.ingresos)],['Asesor',a.nombre],['Estatus',sBadge(p.estatus)],['Score',scoreBadge(p)]].map(r=>`<div class="ir"><span class="il">${r[0]}</span><span class="iv">${r[1]}</span></div>`).join('');
  // Comentarios visibles directamente
  $('det-coment-txt').textContent=p.comentarios||'Sin comentarios registrados.';
  $('det-coment-card').style.display=p.comentarios?'block':'block';
  // Botones de estatus
  $('det-est-btns').innerHTML=ESTATUS_ACTIVOS.concat(ESTATUS_INACTIVOS).map(s=>`<button class="btn btn-xs ${p.estatus===s?'btn-navy':'btn-out'}" onclick="cambiarEstatus('${pid}','${s}')">${s}</button>`).join('');
  renderTimeline(pid);
  renderDocsProspecto(pid);
  $$('#m-det .tab').forEach((t,i)=>t.classList.toggle('active',i===0));
  $$('#m-det .tp').forEach((t,i)=>t.classList.toggle('active',i===0));
  $('rec-fecha').value=new Date().toISOString().split('T')[0];
  openM('m-det');
}
function renderTimeline(pid){
  const p=DS.findOne('prospectos',pid); if(!p) return;
  const segs=DS.find('seguimientos',{prospectoId:pid}).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  const recs=DS.find('recordatorios',{prospectoId:pid});
  const ICO={Llamada:'📞',WhatsApp:'📱','Visita al desarrollo':'🏠',Email:'📧','Nota interna':'📝',Registro:'✨'};
  const BG={Llamada:'#eff6ff',WhatsApp:'#f0fdf4','Visita al desarrollo':'#fff7ed',Email:'#fdf4ff','Nota interna':'#f8fafc',Registro:'#fdf3e3'};
  const items=[{tipo:'Registro',nota:p.comentarios||'Prospecto registrado',fecha:p.fechaRegistro,usuario:p.asesor},...segs];
  $('det-tl').innerHTML=items.map(s=>`<div class="tl-i"><div class="tl-ico" style="background:${BG[s.tipo]||'#f8fafc'}">${ICO[s.tipo]||'📌'}</div><div class="tl-b"><div class="tl-h"><div class="tl-lbl">${s.tipo}${s.estatusCambio?` → ${sBadge(s.estatusCambio)}`:''}</div><div class="tl-dt">${fD(s.fecha)} · ${getUser(s.usuario).nombre.split(' ')[0]}</div></div><div class="tl-note">${s.nota||''}</div></div></div>`).join('')
  +(recs.length?`<div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--bd)"><div style="font-size:10.5px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px">Recordatorios</div>${recs.map(r=>`<div class="ali ${r.estado==='completado'?'info':'warn'}" style="margin-bottom:6px"><div style="font-size:15px">${r.estado==='completado'?'✅':'🔔'}</div><div><div class="al-ttl">${r.tipo}</div><div class="al-sub">${fD(r.fecha)} ${r.hora||''} · ${r.nota||''}</div></div>${r.estado==='pendiente'?`<button class="btn btn-xs btn-out" style="margin-left:auto;flex-shrink:0" onclick="completarRec('${r.id}')">✓</button>`:''}</div>`).join('')}</div>`:'');
}
function cambiarEstatus(pid,est){
  DS.update('prospectos',pid,{estatus:est});
  DS.create('seguimientos',{prospectoId:pid,tipo:'Nota interna',nota:`Estatus actualizado a: ${est}`,fecha:new Date().toISOString(),usuario:CU.id,estatusCambio:est});
  openDetalle(pid); toast('Estatus actualizado','ok');
}
function saveSeg(){
  const nota=$('seg-nota').value.trim(); if(!nota){ toast('Escribe una descripción','err'); return; }
  const est=$('seg-est').value;
  DS.create('seguimientos',{prospectoId:CU_PID,tipo:$('seg-tipo').value,nota,fecha:new Date().toISOString(),usuario:CU.id,estatusCambio:est||null});
  if(est) DS.update('prospectos',CU_PID,{estatus:est});
  $('seg-nota').value=''; renderTimeline(CU_PID); openDetalle(CU_PID); toast('Seguimiento registrado ✓','ok');
}
function saveRec(){
  const fecha=$('rec-fecha').value; if(!fecha){ toast('Selecciona una fecha','err'); return; }
  DS.create('recordatorios',{prospectoId:CU_PID,tipo:$('rec-tipo').value,fecha,hora:$('rec-hora').value,nota:$('rec-nota').value.trim(),estado:'pendiente',usuario:CU.id});
  renderTimeline(CU_PID); updateBell(); toast('Recordatorio creado ✓','ok');
}
function completarRec(rid){ DS.update('recordatorios',rid,{estado:'completado'}); renderTimeline(CU_PID); updateBell(); toast('Completado ✓','ok'); }
function detTab(btn,pane){
  $$('#m-det .tab').forEach(t=>t.classList.remove('active'));
  $$('#m-det .tp').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active'); $(pane).classList.add('active');
}

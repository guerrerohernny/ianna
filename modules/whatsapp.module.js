/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/whatsapp.module.js
   Módulo WhatsApp CRM (modo simulación; conexión real a Cloud API en fase futura).
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// WHATSAPP CRM
// ================================================================
let _waCurrent=null; // current conversation prospecto id

function renderWhatsApp(){
  populateSelects();
  renderWaConvList();
}

function renderWaConvList(){
  const prosp=CU.rol==='gerente'||CU.rol==='administrador'?DS.find('prospectos'):DS.find('prospectos',{asesor:CU.id});
  // Sort by last message date
  const convs=prosp.map(p=>{
    const segs=DS.find('seguimientos',{prospectoId:p.id}).filter(s=>s.tipo==='WhatsApp'||s.tipo==='Llamada');
    const last=segs.length?segs[0]:null;
    return {...p,_lastMsg:last?.nota||p.comentarios||'',_lastDate:last?.fecha||p.fechaRegistro};
  }).sort((a,b)=>new Date(b._lastDate)-new Date(a._lastDate));
  const q=($('wa-search-inp')?.value||'').toLowerCase();
  const filtered=q?convs.filter(p=>p.nombre.toLowerCase().includes(q)||p.telefono.includes(q)):convs;
  $('wa-conv-list').innerHTML=filtered.length===0?'<div class="empty" style="padding:30px"><div class="empty-i">💬</div><p>Sin conversaciones.</p></div>':filtered.map(p=>{
    const isActive=_waCurrent===p.id;
    return `<div class="wa-conv-item${isActive?' active':''}" onclick="openWaConv('${p.id}')">
      <div class="wa-av">${p.nombre.charAt(0)}</div>
      <div style="flex:1;min-width:0">
        <div class="wa-name">${p.nombre}</div>
        <div class="wa-preview">${p._lastMsg||'Sin mensajes'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="wa-time">${fDS(p._lastDate)}</div>
        ${sBadge(p.estatus).replace('class="badge"','class="badge" style="font-size:9.5px;padding:1px 6px"')}
      </div>
    </div>`;
  }).join('');
}
function filterWaConvs(){ renderWaConvList(); }

function openWaConv(pid){
  _waCurrent=pid;
  renderWaConvList(); // update active state
  const p=DS.findOne('prospectos',pid); if(!p) return;
  // Build chat area
  const segs=DS.find('seguimientos',{prospectoId:pid}).sort((a,b)=>new Date(a.fecha)-new Date(b.fecha));
  const msgs=segs.filter(s=>['WhatsApp','Llamada','Visita al desarrollo','Email','Nota interna'].includes(s.tipo));
  const icoMap={WhatsApp:'📱',Llamada:'📞','Visita al desarrollo':'🏠',Email:'📧','Nota interna':'📝'};
  const tel=(p.telefono||'').replace(/\D/g,'');
  $('wa-chat-area').innerHTML=`
    <div class="wa-chat-hdr">
      <div class="wa-av">${p.nombre.charAt(0)}</div>
      <div style="flex:1"><div style="font-size:14px;font-weight:700">${p.nombre}</div><div style="font-size:12px;color:var(--t3)">${p.telefono} · ${p.estatus}</div></div>
      <a href="https://wa.me/52${tel}?text=Hola%20${encodeURIComponent(p.nombre.split(' ')[0])}%2C%20le%20contactamos%20de%20Valle%20de%20Arag%C3%B3n." target="_blank" class="btn btn-green btn-sm">📱 Abrir WhatsApp</a>
      <button class="btn btn-gold btn-sm" style="margin-left:6px" onclick="openDetalle('${pid}')">Ver ficha</button>
    </div>
    <div class="wa-msgs" id="wa-msgs-${pid}">
      ${msgs.length===0?'<div style="text-align:center;padding:30px;color:#8896a7;font-size:13px">Sin conversaciones registradas.<br>Los mensajes de WhatsApp se mostrarán aquí.</div>':msgs.map(s=>{
        const isNote=s.tipo==='Nota interna';
        if(isNote) return `<div class="wa-note">📝 Nota interna: ${s.nota||'—'}<div class="wa-ts">${fD(s.fecha)} · ${getUser(s.usuario).nombre.split(' ')[0]}</div></div>`;
        const out=s.usuario===CU.id;
        return `<div class="wa-bubble ${out?'out':'in'}">${icoMap[s.tipo]||'📌'} ${s.nota||'—'}<div class="wa-ts">${new Date(s.fecha).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})} · ${getUser(s.usuario).nombre.split(' ')[0]}</div></div>`;
      }).join('')}
    </div>
    <div class="wa-input-bar">
      <select id="wa-tipo-msg" style="padding:8px;border:1.5px solid var(--bd2);border-radius:8px;font-size:12.5px;color:var(--t2)"><option value="WhatsApp">💬 WhatsApp</option><option value="Llamada">📞 Llamada</option><option value="Nota interna">📝 Nota interna</option><option value="Email">📧 Email</option></select>
      <textarea id="wa-msg-txt" rows="1" placeholder="Escribe un mensaje o nota…" onkeydown="waMsgKeydown(event,'${pid}')"></textarea>
      <button class="btn btn-gold btn-ico" onclick="sendWaMsg('${pid}')" title="Enviar">➤</button>
    </div>`;
  // Info panel
  const a=getUser(p.asesor);
  $('wa-info-content').innerHTML=`
    <div style="text-align:center;margin-bottom:14px"><div class="wa-av" style="width:56px;height:56px;font-size:20px;margin:0 auto 8px">${p.nombre.charAt(0)}</div><div style="font-weight:700">${p.nombre}</div><div style="font-size:11px;color:var(--t3)">${p.telefono}</div></div>
    ${[['Estatus',sBadge(p.estatus)],['Fuente',p.fuente||'—'],['Presupuesto',mxn(p.presupuesto)],['Asesor',a.nombre.split(' ')[0]],['Registro',fDS(p.fechaRegistro)]].map(r=>`<div class="ir"><span class="il" style="font-size:11.5px">${r[0]}</span><span class="iv" style="font-size:11.5px">${r[1]}</span></div>`).join('')}
    <div style="margin-top:14px;border-top:1px solid var(--bd);padding-top:12px">
      <div style="font-size:10.5px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Etiquetas</div>
      <div>${['Activo','Interesado','Listo para cierre','Seguimiento','En espera'].map(tag=>`<span class="wa-tag" style="background:var(--s2);color:var(--t2)" onclick="addWaTag('${pid}','${tag}')">${tag}</span>`).join('')}</div>
    </div>
    <div style="margin-top:12px">
      <button class="btn btn-out btn-sm" style="width:100%;margin-bottom:6px" onclick="openDetalle('${pid}')">📋 Ver ficha completa</button>
      <button class="btn btn-out btn-sm" style="width:100%" onclick="navTo('apartados',document.querySelector('[data-page=apartados]'))">📋 Crear apartado</button>
    </div>`;
  // Auto-scroll to bottom
  setTimeout(()=>{ const el=$(`wa-msgs-${pid}`); if(el) el.scrollTop=el.scrollHeight; },50);
}

function waMsgKeydown(e,pid){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendWaMsg(pid); } }

function sendWaMsg(pid){
  const txt=$('wa-msg-txt')?.value?.trim(); if(!txt) return;
  const tipo=$('wa-tipo-msg')?.value||'WhatsApp';
  DS.create('seguimientos',{prospectoId:pid,tipo,nota:txt,fecha:new Date().toISOString(),usuario:CU.id,estatusCambio:null});
  auditLog('seguimientos',pid,'CREATE',null,{tipo,nota:txt});
  $('wa-msg-txt').value='';
  openWaConv(pid); // refresh chat
  renderWaConvList();
}

function addWaTag(pid,tag){
  toast(`Etiqueta "${tag}" aplicada al prospecto`,'ok');
  // Future: DS.update('prospectos',pid,{tags:[...(p.tags||[]),tag]})
}

function simulateNewMsg(){
  const prosp=CU.rol==='gerente'||CU.rol==='administrador'?DS.find('prospectos'):DS.find('prospectos',{asesor:CU.id});
  if(!prosp.length){ toast('No hay prospectos','warn'); return; }
  const p=prosp[Math.floor(Math.random()*prosp.length)];
  const msgs=['Hola, me interesa información sobre los lotes disponibles','¿Cuál es el precio del modelo Ambel?','¿Tienen algo disponible en manzana 9?','Buenos días, ¿siguen teniendo disponibilidad?'];
  const msg=msgs[Math.floor(Math.random()*msgs.length)];
  DS.create('seguimientos',{prospectoId:p.id,tipo:'WhatsApp',nota:msg,fecha:new Date().toISOString(),usuario:p.asesor,estatusCambio:null});
  renderWaConvList();
  if(_waCurrent===p.id) openWaConv(p.id);
  toast(`Nuevo mensaje simulado de ${p.nombre.split(' ')[0]}`,'ok');
}

function openWaConfig(){
  const cfg=JSON.parse(localStorage.getItem('va_wa_config')||'{}');
  if($('wa-phone-id')) $('wa-phone-id').value=cfg.phoneId||'';
  if($('wa-token')) $('wa-token').value=cfg.token||'';
  if($('wa-verify')) $('wa-verify').value=cfg.verify||'';
  if($('wa-numero')) $('wa-numero').value=cfg.numero||'';
  if($('wa-asignacion')) $('wa-asignacion').value=cfg.asignacion||'gerente';
  openM('m-wa-config');
}
function saveWaConfig(){
  const cfg={phoneId:$('wa-phone-id').value.trim(),token:$('wa-token').value.trim(),verify:$('wa-verify').value.trim(),numero:$('wa-numero').value.trim(),asignacion:$('wa-asignacion').value};
  localStorage.setItem('va_wa_config',JSON.stringify(cfg));
  closeM('m-wa-config');
  toast('Configuración de WhatsApp guardada ✓','ok');
}
// ================================================================
// WHATSAPP CRM
// ================================================================
let WA_ACTIVE_CONV=null;



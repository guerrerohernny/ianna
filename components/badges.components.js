/* ════════════════════════════════════════════════════════════════
   IANNA CRM — components/badges.components.js
   Componentes visuales compartidos: badges de estatus, score, selects poblados, alertas/campana.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// Estatus inactivos (se ocultan por defecto)
const ESTATUS_INACTIVOS=['No interesado','No le alcanza','Compró en otro lado'];
const ESTATUS_ACTIVOS=['Nuevo','Contactado','Cita agendada','Visitó desarrollo','Seguimiento','Apartado','Venta'];

function sBadge(est){
  const M={'Nuevo':'#3b82f6','Contactado':'#8b5cf6','Cita agendada':'#f59e0b','Visitó desarrollo':'#06b6d4','Seguimiento':'#6366f1','Apartado':'#f97316','Venta':'#10b981','No interesado':'#ef4444','No le alcanza':'#dc2626','Compró en otro lado':'#991b1b'};
  const c=M[est]||'#8896a7';
  return `<span class="badge" style="background:${c}18;color:${c}"><span class="bdot" style="background:${c}"></span>${est}</span>`;
}
function calcScore(p){
  let s=0;
  if(p.presupuesto>=2500000)s+=30;else if(p.presupuesto>=1800000)s+=22;else if(p.presupuesto>=1200000)s+=14;else s+=6;
  if(p.enganche>=500000)s+=25;else if(p.enganche>=250000)s+=16;else s+=6;
  if(p.ingresos>=70000)s+=20;else if(p.ingresos>=40000)s+=13;else s+=5;
  if(p.estadoCivil==='Casado')s+=10;else s+=5;
  s+=Math.min(DS.find('seguimientos',{prospectoId:p.id}).length*5,10);
  return Math.min(s,100);
}
function scoreBadge(p){ const s=calcScore(p); return `<span class="score ${s>=70?'sc-h':s>=40?'sc-m':'sc-l'}">${s}</span>`; }

function populateSelects(){
  const ases=DS.find('usuarios',{rol:'asesor',activo:true});
  const opts=ases.map(a=>`<option value="${a.id}">${a.nombre}</option>`).join('');
  ['mp-ases','ap-ases','f-asesor-p','r-asesor','ing-asesor','imp-ases-def'].forEach(sid=>{
    const el=$(sid); if(!el) return;
    const pre=(['f-asesor-p','r-asesor','ing-asesor'].includes(sid))?'<option value="">Todos</option>':'';
    el.innerHTML=pre+opts;
  });
  // Lotes disponibles
  // Include Disponible + Entrega Rápida + Lote Especial (all sellable)
  const disp=DS.db.inventario.filter(l=>['Disponible','Entrega Rápida','Lote Especial'].includes(l.estado_display||l.estado));
  // Lote principal: solo lotes NO fraccionados (es_fraccion=false o undefined)
  const dispPrinc=disp.filter(l=>!l.es_fraccion);
  // Lote adicional: todos los disponibles (incluye fracciones)
  const loteOpt=l=>`<option value="${l.clave}">Clave ${l.clave}${l.es_fraccion?' ['+l.fraccion_tipo+']':''} — Mz ${l.mz} L${l.lote} — ${f3(l.terreno)}m² — ${mxn(l.valor_terreno)}</option>`;
  $('ap-lote').innerHTML='<option value="">— Selecciona un lote disponible —</option>'+dispPrinc.map(loteOpt).join('');
  const apAdicEl=$('ap-lote-adic');
  if(apAdicEl) apAdicEl.innerHTML='<option value="">— Selecciona lote adicional —</option>'+disp.map(loteOpt).join('');
  // Modelos (Morello: solo Manzana 10) — se refresca también al cambiar de lote
  refreshModelosApartado();
  // Brokers del asesor actual para selector en modal prospecto
  const misB=CU.rol==='gerente'||CU.rol==='administrador'?DS.find('brokers',{activo:true}):DS.find('brokers').filter(b=>b.asesorId===CU.id&&b.activo);
  const mpBroker=$('mp-broker');
  if(mpBroker) mpBroker.innerHTML='<option value="">— Selecciona broker —</option>'+misB.map(b=>`<option value="${b.id}">${b.nombre} · ${b.telefono||''}</option>`).join('');
  // Prospectos para apartado
  const prs=CU.rol==='gerente'||CU.rol==='administrador'?DS.find('prospectos'):DS.find('prospectos',{asesor:CU.id});
  $('ap-cli').innerHTML=prs.map(p=>`<option value="${p.id}">${p.nombre} · ${p.telefono}</option>`).join('');
}

function buildAlerts(){
  const al=[];
  const allP=CU.rol==='gerente'||CU.rol==='administrador'?DS.find('prospectos'):DS.find('prospectos',{asesor:CU.id});
  const now=Date.now();
  allP.filter(p=>!ESTATUS_INACTIVOS.includes(p.estatus)&&p.estatus!=='Venta').forEach(p=>{
    const segs=DS.find('seguimientos',{prospectoId:p.id});
    const last=segs.length?new Date(segs[0].fecha).getTime():new Date(p.fechaRegistro).getTime();
    if(now-last>2592000000) al.push({type:'warn',icon:'⚠️',title:p.nombre,sub:`Sin contacto +30 días · ${p.estatus}`});
  });
  DS.find('recordatorios').filter(r=>r.estado==='pendiente'&&(CU.rol==='gerente'||CU.rol==='administrador'||r.usuario===CU.id)).forEach(r=>{
    const diff=new Date(r.fecha+'T'+(r.hora||'00:00'))-new Date();
    if(diff<0) al.push({type:'danger',icon:'🔴',title:r.tipo,sub:`Vencido — ${fD(r.fecha)}`});
    else if(diff<86400000) al.push({type:'info',icon:'🔔',title:r.tipo,sub:`Hoy ${r.hora||''}`});
  });
  return al;
}
function updateBell(){ $('bell-dot').classList.toggle('on',buildAlerts().length>0); }


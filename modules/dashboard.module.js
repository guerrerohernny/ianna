/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/dashboard.module.js
   Módulo Dashboard.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// DASHBOARD
// ================================================================
function renderDashboard(){
  if(!CU) return;
  const per=$('dash-periodo')?.value||'mes';
  const cut=new Date();
  if(per==='semana') cut.setDate(cut.getDate()-7);
  else if(per==='mes') cut.setMonth(cut.getMonth()-1);
  else cut.setFullYear(cut.getFullYear()-1);
  const allP=CU.rol==='gerente'||CU.rol==='administrador'?DS.find('prospectos'):DS.find('prospectos',{asesor:CU.id});
  const pP=allP.filter(p=>new Date(p.fechaRegistro)>=cut);
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const nvHoy=allP.filter(p=>{const d=new Date(p.fechaRegistro);d.setHours(0,0,0,0);return d.getTime()===hoy.getTime();}).length;
  const citas=pP.filter(p=>p.estatus==='Cita agendada').length;
  const visitas=pP.filter(p=>p.estatus==='Visitó desarrollo').length;
  const apts=pP.filter(p=>p.estatus==='Apartado').length;
  const ventas=pP.filter(p=>p.estatus==='Venta').length;
  const activos=pP.filter(p=>!ESTATUS_INACTIVOS.includes(p.estatus)).length;
  const conv=activos?Math.round(ventas/activos*100):0;
  const inv=DS.db.inventario.filter(l=>l.estado!=='Subdividido');
  // Disponibles = todo lo vendible: puros + Especiales + Entrega Rápida (misma fórmula que Inventario)
  const iD=inv.filter(l=>!['Apartado','Vendido','Casa Muestra'].includes(l.estado)).length;
  const iA=inv.filter(l=>l.estado==='Apartado').length;
  const iV=inv.filter(l=>l.estado==='Vendido').length;
  const isG=CU.rol==='gerente'||CU.rol==='administrador';
  const kpis=isG?[
    {ico:'🏠',bg:'#eff6ff',lbl:'Lotes disponibles',val:iD,sub:`de ${inv.length} totales`},
    {ico:'📋',bg:'#fff7ed',lbl:'Apartados',val:iA,sub:'En proceso'},
    {ico:'✅',bg:'#f0fdf4',lbl:'Vendidos',val:iV,sub:'Lotes cerrados'},
    {ico:'👥',bg:'#f5f3ff',lbl:'Prospectos',val:pP.length,sub:'En el periodo'},
    {ico:'✨',bg:'#fdf4ff',lbl:'Nuevos hoy',val:nvHoy,sub:'Hoy'},
    {ico:'📅',bg:'#fffbeb',lbl:'Citas',val:citas,sub:'Agendadas'},
    {ico:'📋',bg:'#fff7ed',lbl:'Apartados',val:apts,sub:'Del periodo'},
    {ico:'💰',bg:'#f0fdf4',lbl:'Ventas',val:ventas,sub:conv+'% conversión'},
  ]:[
    {ico:'👥',bg:'#eff6ff',lbl:'Mis prospectos',val:pP.length,sub:'En el periodo'},
    {ico:'✨',bg:'#fdf4ff',lbl:'Nuevos hoy',val:nvHoy,sub:'Hoy'},
    {ico:'📅',bg:'#fffbeb',lbl:'Mis citas',val:citas,sub:'Agendadas'},
    {ico:'🏠',bg:'#fff7ed',lbl:'Visitas',val:visitas,sub:'Al desarrollo'},
    {ico:'📋',bg:'#fff7ed',lbl:'Mis apartados',val:apts,sub:'Del periodo'},
    {ico:'💰',bg:'#f0fdf4',lbl:'Mis ventas',val:ventas,sub:conv+'% conversión'},
    {ico:'📊',bg:'#f5f3ff',lbl:'Conversión',val:conv+'%',sub:'Activos → Venta'},
    {ico:'💵',bg:'#fefce8',lbl:'Mis ingresos',val:calcMisIngresos(),sub:'Comisión acum.'},
  ];
  $('kpi-grid').innerHTML=kpis.map(k=>`<div class="kpi-card"><div class="kpi-ico" style="background:${k.bg}">${k.ico}</div><div class="kpi-lbl">${k.lbl}</div><div class="kpi-val">${k.val}</div><div class="kpi-sub">${k.sub}</div></div>`).join('');
  // Pipeline solo activos
  const ESTS=['Nuevo','Contactado','Cita agendada','Visitó desarrollo','Seguimiento','Apartado','Venta'];
  const COLS=['#3b82f6','#8b5cf6','#f59e0b','#06b6d4','#6366f1','#f97316','#10b981'];
  const maxP=Math.max(...ESTS.map(e=>allP.filter(p=>p.estatus===e).length),1);
  $('dash-pipe').innerHTML=ESTS.map((e,i)=>{const c=allP.filter(p=>p.estatus===e).length;return `<div class="chr"><div class="chl">${e}</div><div class="cht"><div class="chf" style="width:${Math.round(c/maxP*100)}%;background:${COLS[i]}"></div></div><div class="chv">${c}</div></div>`;}).join('');
  // Alerts
  // ── TAREAS DEL DÍA ────────────────────────────────────────────
  const todayStr=new Date().toISOString().split('T')[0];
  const allPN=CU.rol==='gerente'||CU.rol==='administrador'?DS.find('prospectos'):DS.find('prospectos',{asesor:CU.id});
  const now30=Date.now();
  // Sin contacto +30 días
  const nc30=allPN.filter(p=>{
    if(ESTATUS_INACTIVOS.includes(p.estatus)||p.estatus==='Venta') return false;
    const segs=DS.find('seguimientos',{prospectoId:p.id});
    const last=segs.length?new Date(segs[0].fecha).getTime():new Date(p.fechaRegistro).getTime();
    return (now30-last)>2592000000; // 30 days in ms
  });
  $('dash-nc-cnt').textContent=nc30.length;
  $('dash-no-contacto').innerHTML=nc30.length===0?'<div style="text-align:center;padding:12px;color:var(--t3);font-size:12.5px">✓ Todos contactados</div>':nc30.slice(0,4).map(p=>`<div class="ali danger" style="margin-bottom:5px" onclick="openDetalle('${p.id}');closeM('m-det')"><div style="font-size:14px">👤</div><div><div class="al-ttl">${p.nombre}</div><div class="al-sub">${p.estatus} · ${p.telefono}</div></div></div>`).join('')+(nc30.length>4?`<div style="font-size:11.5px;color:var(--t3);text-align:center;padding:6px">+${nc30.length-4} más</div>`:'');
  // Citas de hoy
  const citasHoy=DS.find('recordatorios').filter(r=>(CU.rol==='gerente'||CU.rol==='administrador'||r.usuario===CU.id)&&r.fecha===todayStr&&r.tipo.includes('Cita')&&r.estado==='pendiente');
  $('dash-citas-cnt').textContent=citasHoy.length;
  $('dash-citas-hoy').innerHTML=citasHoy.length===0?'<div style="text-align:center;padding:12px;color:var(--t3);font-size:12.5px">✓ Sin citas hoy</div>':citasHoy.map(r=>{const p=DS.findOne('prospectos',r.prospectoId);return `<div class="ali warn" style="margin-bottom:5px"><div style="font-size:14px">📅</div><div><div class="al-ttl">${p?p.nombre:'—'}</div><div class="al-sub">${r.hora||'Sin hora'} · ${r.nota||''}</div></div></div>`;}).join('');
  // WhatsApps pendientes (recordatorios tipo WhatsApp/Seguimiento)
  const waPend=DS.find('recordatorios').filter(r=>(CU.rol==='gerente'||CU.rol==='administrador'||r.usuario===CU.id)&&r.estado==='pendiente'&&(r.tipo.includes('WhatsApp')||r.tipo.includes('Seguimiento')));
  $('dash-wa-cnt').textContent=waPend.length;
  $('dash-wa-pend').innerHTML=waPend.length===0?'<div style="text-align:center;padding:12px;color:var(--t3);font-size:12.5px">✓ Sin pendientes</div>':waPend.slice(0,4).map(r=>{const p=DS.findOne('prospectos',r.prospectoId);return `<div class="ali info" style="margin-bottom:5px"><div style="font-size:14px">📱</div><div><div class="al-ttl">${p?p.nombre:'—'}</div><div class="al-sub">${fD(r.fecha)} ${r.hora||''}</div></div></div>`;}).join('')+(waPend.length>4?`<div style="font-size:11.5px;color:var(--t3);text-align:center;padding:6px">+${waPend.length-4} más</div>`:'');
  // Recordatorios vencidos
  const recVenc=DS.find('recordatorios').filter(r=>(CU.rol==='gerente'||CU.rol==='administrador'||r.usuario===CU.id)&&r.estado==='pendiente'&&new Date(r.fecha+'T'+(r.hora||'23:59'))<new Date());
  $('dash-rec-cnt').textContent=recVenc.length;
  $('dash-recordatorios').innerHTML=recVenc.length===0?'<div style="text-align:center;padding:12px;color:var(--t3);font-size:12.5px">✓ Sin vencidos</div>':recVenc.slice(0,4).map(r=>{const p=DS.findOne('prospectos',r.prospectoId);return `<div class="ali danger" style="margin-bottom:5px"><div style="font-size:14px">🔔</div><div><div class="al-ttl">${p?p.nombre:'—'}</div><div class="al-sub">Venció: ${fD(r.fecha)} · ${r.tipo}</div></div><button class="btn btn-xs btn-out" style="margin-left:auto;flex-shrink:0" onclick="completarRec('${r.id}')">✓</button></div>`;}).join('')+(recVenc.length>4?`<div style="font-size:11.5px;color:var(--t3);text-align:center;padding:6px">+${recVenc.length-4} más</div>`:'');
  // Ranking/Recordatorios
  if(isG){
    $('rank-ttl').textContent='🏆 Ranking de asesores';
    const rd=DS.find('usuarios',{rol:'asesor'}).map(a=>({n:a.nombre,v:allP.filter(p=>p.asesor===a.id&&p.estatus==='Venta').length,p:allP.filter(p=>p.asesor===a.id).length})).sort((a,b)=>b.v-a.v);
    const mv=Math.max(...rd.map(r=>r.v),1);
    $('dash-rank').innerHTML=rd.map((r,i)=>{const rc=i===0?'r1':i===1?'r2':i===2?'r3':'rn_';return `<div class="ri"><div class="rn ${rc}">${i+1}</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${r.n.split(' ')[0]}</div><div style="font-size:11px;color:var(--t3)">${r.p} prospectos</div></div><div class="rbw"><div class="rb" style="width:${Math.round(r.v/mv*100)}%"></div></div><div style="font-size:13px;font-weight:700;min-width:18px;text-align:right">${r.v}</div></div>`;}).join('');
  } else {
    $('rank-ttl').textContent='📅 Mis próximos seguimientos';
    const recs=DS.find('recordatorios').filter(r=>r.usuario===CU.id&&r.estado==='pendiente').sort((a,b)=>new Date(a.fecha)-new Date(b.fecha)).slice(0,5);
    $('dash-rank').innerHTML=recs.length===0?'<div style="text-align:center;padding:20px;color:var(--t3);font-size:13px">Sin recordatorios pendientes ✓</div>':recs.map(r=>{const p=DS.findOne('prospectos',r.prospectoId);return `<div class="ri"><div style="font-size:18px">${r.tipo.includes('llamada')?'📞':r.tipo.includes('cita')?'📅':'🔁'}</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${p?p.nombre:'—'}</div><div style="font-size:11px;color:var(--t3)">${r.tipo} · ${fD(r.fecha)} ${r.hora||''}</div></div></div>`;}).join('');
  }
}
function calcMisIngresos(){
  if(!CU) return '$0';
  const P=getP();
  const ventas=DS.find('apartados',{asesor:CU.id}).filter(a=>a.estatus==='Venta');
  const total=ventas.reduce((s,a)=>s+(a.valor_operacion||0)*(P.comision_asesor_pct||0.02),0);
  return mxn(total);
}


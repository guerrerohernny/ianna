/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/brokers.module.js
   Módulo Brokers.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// NAVIGATION
// ================================================================
// ════════════════════════════════════════════════════════════════
// BROKERS
// ════════════════════════════════════════════════════════════════
function renderBrokers(){
  const isG=CU.rol==='gerente'||CU.rol==='administrador';
  const brokers=isG?DS.find('brokers'):DS.find('brokers').filter(b=>b.asesorId===CU.id);
  $('brokers-kpi').innerHTML=[
    {lbl:'Brokers activos',val:brokers.filter(b=>b.activo).length},
    {lbl:'Total brokers',val:brokers.length},
    {lbl:'Prospectos referidos',val:DS.find('prospectos').filter(p=>p.brokerId&&brokers.some(b=>b.id===p.brokerId)).length},
  ].map(k=>`<div class="kpi-card"><div class="kpi-lbl">${k.lbl}</div><div class="kpi-val">${k.val}</div></div>`).join('');
  $('brokers-grid').innerHTML=brokers.length===0
    ?'<div class="empty" style="grid-column:1/-1"><div class="empty-i">🤝</div><p>Sin brokers registrados aún.</p></div>'
    :brokers.map(b=>{
      const refCount=DS.find('prospectos').filter(p=>p.brokerId===b.id).length;
      const ventasCount=DS.find('apartados').filter(a=>a.broker_id===b.id&&a.estatus==='Venta').length;
      return `<div class="card" style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
          <div><div style="font-weight:700;font-size:14.5px">${b.nombre}</div><div style="font-size:12px;color:var(--t3)">${b.telefono||'—'}</div></div>
          <span class="badge" style="background:${b.activo?'#d1fae5':'#fee2e2'};color:${b.activo?'#065f46':'#991b1b'}">${b.activo?'Activo':'Inactivo'}</span>
        </div>
        <div style="display:flex;gap:14px;font-size:12px;color:var(--t2);margin-top:10px">
          <div>📋 ${refCount} referido(s)</div>
          <div>🏠 ${ventasCount} venta(s)</div>
        </div>
        <div style="display:flex;gap:6px;margin-top:12px">
          <button class="btn btn-out btn-xs" onclick="openBrokerModal('${b.id}')">Editar</button>
        </div>
      </div>`;
    }).join('');
}
function openBrokerModal(id){
  toast(id?'Editar broker: '+id:'Función de alta de broker disponible próximamente','warn');
}


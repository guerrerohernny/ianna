/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/auditoria.module.js
   Módulo Auditoría.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ════════════════════════════════════════════════════════════════
// AUDITORÍA
// ════════════════════════════════════════════════════════════════
function renderAuditoria(){
  const logs=(DS.db.auditoria||[]).slice(0,200);
  $('aud-tbody').innerHTML=logs.length===0
    ?'<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--t3)">Sin registros de auditoría aún.</td></tr>'
    :logs.map(l=>`<tr>
      <td style="font-size:11.5px;color:var(--t3)">${new Date(l.fecha).toLocaleString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
      <td style="font-size:12px">${l.usuarioNombre||'—'}</td>
      <td style="font-size:12px">${l.tabla}</td>
      <td><span class="badge" style="background:#e0f2fe;color:#075985;font-size:10.5px">${l.accion}</span></td>
      <td style="font-size:11px;color:var(--t3)">${l.registroId||'—'}</td>
      <td style="font-size:11px;color:var(--t3);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(l.despues||'').replace(/"/g,'&quot;')}">${(l.despues||'').slice(0,60)}</td>
    </tr>`).join('');
}


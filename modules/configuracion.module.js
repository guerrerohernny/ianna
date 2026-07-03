/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/configuracion.module.js
   Módulo Configuración: asesores y Supabase.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// CONFIGURACIÓN — ASESORES
// ================================================================
function renderConfiguracion(){ renderAsesoresGrid(); }
function renderAsesoresGrid(){
  const ases=DS.find('usuarios',{rol:'asesor'});
  $('asesores-grid').innerHTML=ases.map(a=>{
    const miP=DS.find('prospectos',{asesor:a.id});
    const v=miP.filter(p=>p.estatus==='Venta').length;
    const cv=miP.length?Math.round(v/miP.length*100):0;
    return `<div class="card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div class="av" style="width:44px;height:44px;font-size:17px;flex-shrink:0">${a.avatar?`<img src="${a.avatar}" alt="">`:a.nombre.charAt(0)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.nombre}</div>
          <div style="font-size:11.5px;font-weight:600;color:${a.activo?'var(--green)':'var(--red)'};">${a.activo?'● Activo':'● Inactivo'}</div>
        </div>
        <button class="btn btn-ghost btn-ico" onclick="openAsesorModal('${a.id}')">✏️</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center;border-top:1px solid var(--bd);padding-top:12px">
        <div><div style="font-size:20px;font-weight:700">${miP.length}</div><div style="font-size:11px;color:var(--t3)">Prospectos</div></div>
        <div><div style="font-size:20px;font-weight:700;color:var(--gold)">${v}</div><div style="font-size:11px;color:var(--t3)">Ventas</div></div>
        <div><div style="font-size:20px;font-weight:700">${cv}%</div><div style="font-size:11px;color:var(--t3)">Conversión</div></div>
      </div>
      <div style="margin-top:10px;font-size:12px;color:var(--t3);line-height:1.7">📧 ${a.correo}<br>📞 ${a.telefono||'—'}<br>📅 Alta: ${fD(a.fechaAlta)}</div>
    </div>`;
  }).join('')||'<div style="color:var(--t3);font-size:13px;padding:20px">Sin asesores.</div>';
}
function openAsesorModal(aid=null){
  $('mas-ttl').textContent=aid?'Editar Asesor':'Nuevo Asesor';
  $('as-id').value=aid||'';
  $('as-pw-lbl').textContent=aid?'Nueva contraseña (vacío = sin cambio)':'Contraseña *';
  $('as-del-btn').style.display=aid?'inline-flex':'none';
  if(aid){ const a=DS.findOne('usuarios',aid); $('as-nm').value=a.nombre; $('as-em').value=a.correo; $('as-ph').value=a.telefono||''; $('as-pw').value=''; $('as-act').value=String(a.activo); }
  else { ['as-nm','as-em','as-ph','as-pw'].forEach(f=>$(f).value=''); $('as-act').value='true'; }
  openM('m-asesor');
}
function saveAsesor(){
  const nm=$('as-nm').value.trim(), em=$('as-em').value.trim(), pw=$('as-pw').value;
  if(!nm||!em){ toast('Nombre y correo son requeridos','err'); return; }
  const aid=$('as-id').value;
  if(aid){ const patch={nombre:nm,correo:em,telefono:fmtTelVal($('as-ph').value),activo:$('as-act').value==='true'}; if(pw){ if(pw.length<4){ toast('Contraseña mín. 4 caracteres','err'); return; } patch.pass=pw; } DS.update('usuarios',aid,patch); toast('Asesor actualizado ✓','ok'); }
  else { if(!pw||pw.length<4){ toast('Contraseña requerida (mín. 4)','err'); return; } if(DS.find('usuarios').some(u=>u.correo===em)){ toast('Ese correo ya existe','err'); return; } DS.create('usuarios',{nombre:nm,correo:em,pass:pw,telefono:fmtTelVal($('as-ph').value),rol:'asesor',activo:true,fechaAlta:new Date().toISOString(),avatar:''}); toast('Asesor creado ✓','ok'); }
  closeM('m-asesor'); renderAsesoresGrid(); populateSelects();
}
function deleteAsesor(){
  const aid=$('as-id').value; if(!aid) return;
  if(DS.find('prospectos',{asesor:aid}).length){ toast('Reasigna los prospectos primero','warn'); return; }
  if(!confirm('¿Eliminar este asesor permanentemente?')) return;
  DS.delete('usuarios',aid); closeM('m-asesor'); renderAsesoresGrid(); populateSelects(); toast('Asesor eliminado','warn');
}
function cfgTab(btn,pane){ $$('#page-configuracion .tab').forEach(t=>t.classList.remove('active')); $$('#page-configuracion .tp').forEach(t=>t.classList.remove('active')); btn.classList.add('active'); $(pane).classList.add('active'); }

// ================================================================
// SUPABASE CONNECTION
// ================================================================
async function connectSupabase(){
  const url=$('sb-url').value.trim(), key=$('sb-key').value.trim();
  if(!url||!key){ toast('Ingresa URL y API Key','err'); return; }
  try {
    const res=await fetch(`${url}/rest/v1/`, {headers:{'apikey':key,'Authorization':`Bearer ${key}`}});
    if(res.ok||res.status===400){
      localStorage.setItem('va_sb_url',url); localStorage.setItem('va_sb_key',key);
      $('sb-conn-badge').className='sb-conn'; $('sb-conn-badge').innerHTML='<span>🟢</span><span id="sb-conn-txt2">Supabase conectado</span>';
      toast('Supabase conectado exitosamente ✓','ok');
    } else { toast('Error de conexión: '+res.status,'err'); }
  } catch(e){ toast('No se pudo conectar. Verifica URL y Key.','err'); }
}
function copiarSQL(){ navigator.clipboard.writeText(SUPABASE_SCHEMA).then(()=>toast('SQL copiado ✓','ok')).catch(()=>toast('Usa Ctrl+A en el recuadro','warn')); }


/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/perfil.module.js
   Módulo Mi Perfil.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// PERFIL
// ================================================================
function renderPerfil(){
  $('pf-nm').value=CU.nombre; $('pf-em').value=CU.correo;
  $('pf-ph').value=CU.telefono||''; $('pf-pw').value=''; $('pf-pw2').value='';
  $('pc-nm').textContent=CU.nombre;
  $('pc-rl').textContent=CU.rol==='gerente'||CU.rol==='administrador'?'Gerente de Ventas':'Asesor Comercial';
  $('pc-em').textContent='✉️ '+CU.correo;
  $('pc-ph').textContent='📞 '+(CU.telefono||'Sin teléfono');
  $('pc-av').innerHTML=CU.avatar?`<img src="${CU.avatar}" alt="">`:CU.nombre.charAt(0);
  $('pc-av-t')&&($('pc-av-t').textContent=CU.nombre.charAt(0));
}
function savePerfil(){
  const nm=$('pf-nm').value.trim(), em=$('pf-em').value.trim();
  const pw=$('pf-pw').value, pw2=$('pf-pw2').value;
  if(!nm||!em){ toast('Nombre y correo son requeridos','err'); return; }
  if(pw&&pw!==pw2){ toast('Las contraseñas no coinciden','err'); return; }
  if(pw&&pw.length<4){ toast('Contraseña mínimo 4 caracteres','err'); return; }
  const patch={nombre:nm,correo:em,telefono:fmtTelVal($('pf-ph').value)};
  if(pw) patch.pass=pw;
  DS.update('usuarios',CU.id,patch); CU={...CU,...patch};
  $('sb-nm').textContent=CU.nombre; updateSbAv(); renderPerfil();
  toast('Perfil actualizado ✓','ok');
}


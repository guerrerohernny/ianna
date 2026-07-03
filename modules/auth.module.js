/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/auth.module.js
   Autenticación y sesión.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// AUTH
// ================================================================
function doLogin(){
  const em=$('li-email').value.trim(), pw=$('li-pass').value;
  const u=DS.find('usuarios').find(u=>u.correo===em&&u.pass===pw&&u.activo); // admin/gerente/asesor all valid
  if(!u){ $('lerr').style.display='block'; return; }
  CU=u; $('lerr').style.display='none';
  // Render everything FIRST (while app is still hidden) to avoid a blank-screen flash
  applyCU();
  populateSelects();
  navTo('dashboard',document.querySelector('[data-page=dashboard]'));
  $('sql-schema').textContent=SUPABASE_SCHEMA;
  // Only NOW reveal the app — content is already painted, no flash
  $('login-screen').style.display='none'; $('app').style.display='block';
}
// li-pass keydown handled in DOMContentLoaded below
function doLogout(){ CU=null; $('app').style.display='none'; $('login-screen').style.display='flex'; }

function applyCU(){
  const isG=CU.rol==='gerente'||CU.rol==='administrador';
  $$('.nav-admin').forEach(el=>el.style.display=isG?'':'none');
  $('sb-nm').textContent=CU.nombre;
  $('sb-rl').textContent=CU.rol==='administrador'?'Administrador':isG?'Gerente de Ventas':'Asesor Comercial';
  updateSbAv(); updateBell();
  const h=new Date().getHours();
  $('dash-greet').textContent=(h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches')+', '+CU.nombre.split(' ')[0];
  $('dash-fecha').textContent=new Date().toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}
function updateSbAv(){
  $('sb-av').innerHTML=CU.avatar?`<img src="${CU.avatar}" alt="">`:CU.nombre.charAt(0);
}


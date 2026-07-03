/* ════════════════════════════════════════════════════════════════
   IANNA CRM — app.init.js
   Inicialización de la aplicación (bindings de login).
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ── BIND LOGIN EVENTS (safe: all functions already defined above) ──
document.addEventListener('DOMContentLoaded', function() {
  var btnLogin = document.getElementById('btn-login-submit');
  if(btnLogin) btnLogin.addEventListener('click', function(){ doLogin(); });
  var passInput = document.getElementById('li-pass');
  if(passInput) passInput.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
});
// Fallback: also bind immediately in case DOMContentLoaded already fired
(function(){
  var btnLogin = document.getElementById('btn-login-submit');
  if(btnLogin) btnLogin.addEventListener('click', function(){ doLogin(); });
})();


/* ════════════════════════════════════════════════════════════════
   IANNA CRM — utils/utils.js
   Utilidades puras reutilizables: formateo de moneda, fechas, teléfonos, selectores DOM.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// HELPERS
// ================================================================
const $=s=>document.getElementById(s);
const $$=s=>document.querySelectorAll(s);
// ID único permanente: marca de tiempo + aleatorio (a prueba de colisiones)
const uid=()=>'_'+Date.now().toString(36)+Math.random().toString(36).substr(2,7);

function mxn(n){ return '$'+Math.round(n||0).toLocaleString('es-MX'); } // Round only at display
function parseMoneyInput(v){ return parseFloat(String(v||'').replace(/,/g,''))||0; }
function formatMoneyInput(el){
  const raw=parseMoneyInput(el.value);
  const caret=el.selectionStart;
  const lenBefore=el.value.length;
  el.value = raw? raw.toLocaleString('es-MX') : '';
  const lenAfter=el.value.length;
  const newPos=Math.max(0,(caret||0)+(lenAfter-lenBefore));
  try{ el.setSelectionRange(newPos,newPos); }catch(e){}
}
function f3(n){ return Number(n||0).toFixed(3); } // 3 decimales para superficies — NUNCA menos
function fD(iso){ if(!iso) return '—'; return new Date(iso).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}); }
function fDS(iso){ if(!iso) return '—'; return new Date(iso).toLocaleDateString('es-MX',{day:'2-digit',month:'short'}); }
function fmtTelVal(raw){ if(!raw) return ''; const d=String(raw).replace(/\D/g,''); if(d.length===10) return d.slice(0,3)+' '+d.slice(3,6)+' '+d.slice(6); if(d.length===7) return d.slice(0,3)+' '+d.slice(3); return raw; }
function fmtTel(inp){ const v=inp.value; inp.value=fmtTelVal(v); }
function getUser(id){ return DS.findOne('usuarios',id)||{nombre:'Sin asignar',id:''}; }
function getLote(c){ return (DS.db.inventario||[]).find(l=>l.clave===String(c)); }
function getMod(id){ return DS.getModelos().find(m=>m.id===id); }
function getP(){ return DS.getParams(); }


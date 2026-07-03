/* ════════════════════════════════════════════════════════════════
   IANNA CRM — components/feedback.components.js
   Componentes de feedback: toast y modales (openM/closeM).
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
function toast(msg,type='',dur=3200){
  const b=$('tbx'), t=document.createElement('div');
  t.className='toast '+(type==='ok'?'ok':type==='err'?'err':type==='warn'?'warn':'');
  t.innerHTML=`<span>${type==='ok'?'✓':type==='err'?'✕':type==='warn'?'⚠':'ℹ'}</span><span>${msg}</span>`;
  b.appendChild(t); setTimeout(()=>t.remove(),dur);
}
function openM(id){ $(id).classList.add('open'); }
function closeM(id){ $(id).classList.remove('open'); }
$$('.mbd').forEach(b=>b.addEventListener('click',e=>{ if(e.target===b) b.classList.remove('open'); }));
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') $$('.mbd.open').forEach(m=>m.classList.remove('open'));
  if(!CU) return;
  if(e.key==='n'&&!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) openProspectoModal();
});


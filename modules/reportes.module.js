/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/reportes.module.js
   Módulo Reportes.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
function renderReportes(){
  populateSelects();
  const per=$('r-periodo')?.value||'mes';
  const fAs=$('r-asesor')?.value||'';
  const cut=new Date();
  if(per==='semana') cut.setDate(cut.getDate()-7);
  else if(per==='mes') cut.setMonth(cut.getMonth()-1);
  else cut.setFullYear(cut.getFullYear()-1);
  let prosp=CU.rol==='gerente'||CU.rol==='administrador'?DS.find('prospectos'):DS.find('prospectos',{asesor:CU.id});
  prosp=prosp.filter(p=>new Date(p.fechaRegistro)>=cut);
  if(fAs) prosp=prosp.filter(p=>p.asesor===fAs);
  const v=prosp.filter(p=>p.estatus==='Venta').length;
  const mn=DS.find('apartados').filter(a=>a.estatus==='Venta').reduce((s,a)=>s+(a.valor_operacion||0),0);
  const activos=prosp.filter(p=>!ESTATUS_INACTIVOS.includes(p.estatus)).length;
  const cv=activos?Math.round(v/activos*100):0;
  const apt=prosp.filter(p=>p.estatus==='Apartado').length;
  $('rep-kpi').innerHTML=[{lbl:'Prospectos',val:prosp.length},{lbl:'Activos',val:activos},{lbl:'Ventas',val:v},{lbl:'Apartados',val:apt},{lbl:'Conversión',val:cv+'%'},{lbl:'Valor vendido',val:mxn(mn)}].map(k=>`<div class="kpi-card"><div class="kpi-lbl">${k.lbl}</div><div class="kpi-val" style="font-size:20px">${k.val}</div></div>`).join('');
  const ESTS=['Nuevo','Contactado','Cita agendada','Visitó desarrollo','Seguimiento','Apartado','Venta','No interesado','No le alcanza','Compró en otro lado'];
  const COLS=['#3b82f6','#8b5cf6','#f59e0b','#06b6d4','#6366f1','#f97316','#10b981','#ef4444','#dc2626','#991b1b'];
  const maxE=Math.max(...ESTS.map(e=>prosp.filter(p=>p.estatus===e).length),1);
  $('rep-ch-est').innerHTML=ESTS.map((e,i)=>{const c=prosp.filter(p=>p.estatus===e).length;return `<div class="chr"><div class="chl">${e}</div><div class="cht"><div class="chf" style="width:${Math.round(c/maxE*100)}%;background:${COLS[i]}"></div></div><div class="chv">${c}</div></div>`;}).join('');
  const FUES=['Facebook','Instagram','TikTok','Google','Referido','Cartel','Expo','Agencia','Guardia','Broker','Otro'];
  const FCOLS=['#1877f2','#e1306c','#000','#ea4335','#34a853','#f59e0b','#8b5cf6','#06b6d4','#6b7280','#f97316','#8896a7'];
  const maxF=Math.max(...FUES.map(f=>prosp.filter(p=>p.fuente===f).length),1);
  $('rep-ch-fue').innerHTML=FUES.map((f,i)=>{const c=prosp.filter(p=>p.fuente===f).length;return `<div class="chr"><div class="chl">${f}</div><div class="cht"><div class="chf" style="width:${Math.round(c/maxF*100)}%;background:${FCOLS[i]}"></div></div><div class="chv">${c}</div></div>`;}).join('');
  const ases=DS.find('usuarios',{rol:'asesor'}).filter(a=>!fAs||a.id===fAs);
  $('rep-tbody').innerHTML=ases.map(a=>{
    const ap=prosp.filter(p=>p.asesor===a.id);
    const av=ap.filter(p=>p.estatus==='Venta').length;
    const actv=ap.filter(p=>!ESTATUS_INACTIVOS.includes(p.estatus)).length;
    const ac=actv?Math.round(av/actv*100):0;
    return `<tr><td><div style="display:flex;align-items:center;gap:8px"><div class="av" style="width:26px;height:26px;font-size:10px">${a.nombre.charAt(0)}</div>${a.nombre}</div></td><td>${ap.length}</td><td>${ap.filter(p=>p.estatus==='Cita agendada').length}</td><td>${ap.filter(p=>p.estatus==='Visitó desarrollo').length}</td><td>${ap.filter(p=>p.estatus==='Apartado').length}</td><td style="font-weight:700;color:var(--gold)">${av}</td><td><span class="score ${ac>=30?'sc-h':ac>=15?'sc-m':'sc-l'}">${ac}%</span></td></tr>`;
  }).join('')||'<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--t3)">Sin datos</td></tr>';
}


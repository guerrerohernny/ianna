/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/importar.module.js
   Importación/Exportación masiva CSV/XLSX.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// IMPORTACIÓN MASIVA
// ================================================================
function openImportModal(){
  IMP_ROWS=[];
  $$('#m-import .tab').forEach((t,i)=>t.classList.toggle('active',i===0));
  $$('#m-import .tp').forEach((t,i)=>t.classList.toggle('active',i===0));
  $('imp-do-btn').style.display='none';
  // Mostrar/ocultar selector de asesor según rol
  const adefWrap=$('imp-ases-def-wrap');
  if(adefWrap) adefWrap.style.display=CU.rol==='asesor'?'none':'';
  openM('m-import');
}
function impTab(btn,pane){ $$('#m-import .tab').forEach(t=>t.classList.remove('active')); $$('#m-import .tp').forEach(t=>t.classList.remove('active')); btn.classList.add('active'); $(pane).classList.add('active'); }
function loadImportFile(inp){
  const file=inp.files[0]; if(!file) return;
  const ext=file.name.split('.').pop().toLowerCase();
  const reader=new FileReader();
  reader.onload=function(e){
    let data;
    if(ext==='csv'){
      const txt=e.target.result;
      const lines=txt.split('\n').filter(l=>l.trim());
      const headers=lines[0].split(',').map(h=>h.trim().replace(/"/g,'').toLowerCase());
      data=lines.slice(1).map(l=>{ const vals=l.split(',').map(v=>v.trim().replace(/"/g,'')); return Object.fromEntries(headers.map((h,i)=>[h,vals[i]||''])); });
    } else {
      const wb=XLSX.read(e.target.result,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      data=XLSX.utils.sheet_to_json(ws,{defval:''});
      data=data.map(r=>{ const nr={}; Object.keys(r).forEach(k=>{ nr[k.toLowerCase().trim()]=String(r[k]||'').trim(); }); return nr; });
    }
    processImportData(data);
  };
  if(ext==='csv') reader.readAsText(file,'UTF-8');
  else reader.readAsArrayBuffer(file);
}
function processImportData(rows){
  const MAP={nombre:['nombre','name','full name','nombre completo'],telefono:['telefono','teléfono','tel','phone','celular','móvil'],correo:['correo','email','e-mail','correo electronico'],fuente:['fuente','source','origen'],asesor:['asesor','vendedor','agent'],comentarios:['comentarios','notas','notes','comments'],estatus:['estatus','status','estado']};
  const existing=DS.find('prospectos').map(p=>p.telefono.replace(/\D/g,''));
  IMP_ROWS=rows.map(r=>{
    const mapped={};
    Object.entries(MAP).forEach(([field,keys])=>{ const k=keys.find(k=>r[k]!==undefined); mapped[field]=k?r[k]:''; });
    mapped.telefono=fmtTelVal(mapped.telefono);
    const tel=(mapped.telefono||'').replace(/\D/g,'');
    const isDup=tel&&existing.includes(tel);
    const isOk=mapped.nombre&&mapped.telefono;
    return {...mapped,_status:isDup?'dup':isOk?'ok':'err',_raw:r};
  });
  const ok=IMP_ROWS.filter(r=>r._status==='ok').length;
  const dup=IMP_ROWS.filter(r=>r._status==='dup').length;
  const err=IMP_ROWS.filter(r=>r._status==='err').length;
  $('imp-summary').innerHTML=[{l:'✅ Para importar',v:ok,c:'#f0fdf4'},{l:'🔄 Duplicados',v:dup,c:'#fef3c7'},{l:'❌ Incompletos',v:err,c:'#fef2f2'}].map(s=>`<div style="background:${s.c};border-radius:8px;padding:10px 16px;font-size:13px;font-weight:600">${s.l}: <span style="font-size:18px">${s.v}</span></div>`).join('');
  const head='<tr>'+['Estado','Nombre','Teléfono','Correo','Fuente','Estatus'].map(h=>`<th>${h}</th>`).join('')+'</tr>';
  const body=IMP_ROWS.map(r=>{const bg=r._status==='dup'?'import-row-dup':r._status==='err'?'import-row-err':'import-row-ok';return `<tr class="${bg}"><td style="font-size:11px">${r._status==='ok'?'✅':r._status==='dup'?'🔄':'❌'}</td><td>${r.nombre||'—'}</td><td>${r.telefono||'—'}</td><td style="font-size:11px">${r.correo||'—'}</td><td>${r.fuente||'—'}</td><td>${r.estatus||'Nuevo'}</td></tr>`;}).join('');
  $('imp-table-wrap').innerHTML=`<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
  $('imp-do-btn').style.display=ok>0?'inline-flex':'none';
  impTab($('imp-prev-tab'),'imp-preview');
}
function doImport(){
  const defAses=CU.rol==='asesor'?CU.id:($('imp-ases-def').value||CU.id);
  const VALID_STATUS=ESTATUS_ACTIVOS.concat(ESTATUS_INACTIVOS);
  let cnt=0;
  IMP_ROWS.filter(r=>r._status==='ok').forEach(r=>{
    const est=VALID_STATUS.includes(r.estatus)?r.estatus:'Nuevo';
    // Si es asesor: siempre asignar a sí mismo, ignorar columna Asesor del archivo
    let asesorId=defAses;
    if(CU.rol!=='asesor'&&r.asesor){
      const match=DS.find('usuarios').find(u=>u.nombre.toLowerCase().includes(r.asesor.toLowerCase()));
      if(match) asesorId=match.id;
    }
    DS.create('prospectos',{nombre:r.nombre,telefono:r.telefono,correo:r.correo||'',fuente:r.fuente||'Otro',estadoCivil:'Soltero',presupuesto:0,enganche:0,ingresos:0,estatus:est,comentarios:r.comentarios||'',asesor:asesorId,fechaRegistro:new Date().toISOString()});
    cnt++;
  });
  $('imp-result-body').innerHTML=`<div style="font-size:36px;margin-bottom:12px">✅</div><div style="font-size:18px;font-weight:700;color:var(--green);margin-bottom:8px">${cnt} prospectos importados</div><div style="font-size:13px;color:var(--t3)">Los registros ya están disponibles en el módulo de Prospectos.</div>`;
  $('imp-do-btn').style.display='none';
  impTab($('imp-res-tab'),'imp-result');
  renderProspectos(); renderDashboard();
  toast(`${cnt} prospectos importados ✓`,'ok');
}
function downloadTemplate(){
  const ws=XLSX.utils.json_to_sheet([{Nombre:'Luis Herrera',Teléfono:'667 123 4567',Correo:'luis@gmail.com',Fuente:'Facebook',Asesor:'',Comentarios:'Interesado en casa de 3 recámaras',Estatus:'Nuevo'}]);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Prospectos');
  XLSX.writeFile(wb,'Plantilla_Prospectos_VA.xlsx');
}

// ================================================================
// EXPORTACIÓN
// ================================================================
function exportarProspectos(){
  let list=CU.rol==='gerente'||CU.rol==='administrador'?DS.find('prospectos'):DS.find('prospectos',{asesor:CU.id});
  const fEst=$('f-est')?.value||'';
  if(fEst&&fEst!=='__todos__') list=list.filter(p=>p.estatus===fEst);
  else if(!fEst) list=list.filter(p=>!ESTATUS_INACTIVOS.includes(p.estatus));
  const data=list.map(p=>({'Nombre':p.nombre,'Teléfono':p.telefono,'Correo':p.correo||'','Fuente':p.fuente||'','Estatus':p.estatus,'Presupuesto':p.presupuesto||0,'Enganche':p.enganche||0,'Ingresos':p.ingresos||0,'Estado Civil':p.estadoCivil||'','Asesor':getUser(p.asesor).nombre,'Fecha Alta':fD(p.fechaRegistro),'Comentarios':p.comentarios||''}));
  const ws=XLSX.utils.json_to_sheet(data);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Prospectos');
  XLSX.writeFile(wb,`Prospectos_VA_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast(`${data.length} prospectos exportados ✓`,'ok');
}


/* ════════════════════════════════════════════════════════════════
   IANNA CRM — business/healthcheck.business.js
   VERIFICACIÓN AUTOMÁTICA DE INTEGRIDAD (Fase 1.5)
   ────────────────────────────────────────────────────────────────
   Al iniciar sesión un gerente/administrador, el sistema revisa
   silenciosamente la consistencia de toda la información. Si hay
   hallazgos, avisa con discreción; el reporte completo vive en
   Configuración → 🩺 Verificación de integridad.
   ════════════════════════════════════════════════════════════════ */

window.IANNA_HEALTH = {

  run(){
    const H=[]; const add=(nivel,area,detalle)=>H.push({nivel,area,detalle});
    const aps=DS.find('apartados')||[];
    const inv=DS.db.inventario||[];
    const activos=aps.filter(a=>a.estatus==='Activo'||a.estatus==='Venta');

    // 1 · Folios duplicados
    IANNA_FOLIOS.duplicados().forEach(d=>add('critico','Folios',`Folio ${d.folio} repetido en: ${d.ubicaciones.join(' · ')}`));

    // 2 · Dos operaciones activas sobre la misma vivienda
    const porLote={};
    activos.forEach(a=>{ [a.clave_lote,a.clave_lote_adicional].filter(Boolean).forEach(c=>{ (porLote[c]=porLote[c]||[]).push(a); }); });
    Object.entries(porLote).forEach(([c,ops])=>{ if(ops.length>1) add('critico','Unicidad',`Lote ${c} con ${ops.length} operaciones activas simultáneas (${ops.map(o=>o.estatus).join(' + ')}).`); });

    // 3 · Coherencia lote ↔ operación
    inv.forEach(l=>{
      const op=activos.find(a=>a.clave_lote===l.clave||a.clave_lote_adicional===l.clave);
      if(l.estado==='Vendido' && (!op||op.estatus!=='Venta')) add('critico','Inventario',`Lote ${l.clave} figura Vendido sin venta activa que lo respalde.`);
      if(l.estado==='Apartado' && (!op)) add('critico','Inventario',`Lote ${l.clave} figura Apartado sin apartado/venta activa.`);
      if(op&&op.estatus==='Venta'&&l.estado!=='Vendido') add('critico','Inventario',`Lote ${l.clave} tiene venta activa pero su estado es "${l.estado}".`);
      if(op&&op.estatus==='Activo'&&!['Apartado'].includes(l.estado)) add('advertencia','Inventario',`Lote ${l.clave} tiene apartado activo pero su estado es "${l.estado}".`);
      if(l.estado==='Disponible'&&l.cliente_asignado&&!op) add('advertencia','Inventario',`Lote ${l.clave} Disponible conserva cliente asignado ("${l.cliente_asignado}") sin operación activa.`);
    });

    // 4 · Referencias rotas
    aps.forEach(a=>{
      if(!DS.findOne('prospectos',a.prospectoId)) add('critico','Referencias',`Operación ${a.estatus} (Lote ${a.clave_lote}) apunta a un prospecto inexistente.`);
      if(!getLote(a.clave_lote)) add('critico','Referencias',`Operación de ${a.estatus} apunta al lote ${a.clave_lote}, que no existe en inventario.`);
      if(a.clave_lote_adicional&&!getLote(a.clave_lote_adicional)) add('critico','Referencias',`Lote adicional ${a.clave_lote_adicional} no existe (operación en ${a.clave_lote}).`);
      if(a.modelo_id&&a.modelo_id!=='SOLO_TERRENO'&&!getMod(a.modelo_id)) add('advertencia','Referencias',`Modelo "${a.modelo_id}" de la operación en ${a.clave_lote} ya no existe en el catálogo.`);
      if(a.asesor&&!getUser(a.asesor).id) add('advertencia','Referencias',`El asesor de la operación en ${a.clave_lote} no existe.`);
      if(a.estatus==='Venta'&&!(a.total_operacion>0)) add('advertencia','Ventas',`Venta en ${a.clave_lote} sin total de operación.`);
      (a.pagos||[]).forEach(p=>{ if(!(parseInt(p.folio)>0)) add('critico','Cobranza',`Pago de ${mxn(p.monto||0)} en ${a.clave_lote} sin folio válido.`); });
    });

    // 5 · Prospectos duplicados (mismo teléfono)
    const tel={}; const norm=t=>String(t||'').replace(/\D/g,'');
    (DS.find('prospectos')||[]).forEach(p=>{ const t=norm(p.telefono); if(t.length>=10){ (tel[t]=tel[t]||[]).push(p.nombre); } });
    Object.entries(tel).forEach(([t,noms])=>{ if(noms.length>1) add('advertencia','Clientes',`Teléfono ${t} en ${noms.length} expedientes: ${noms.join(', ')}. Cada cliente debe conservar un único expediente.`); });

    // 6 · Fracciones y subdivisiones
    inv.forEach(l=>{
      if(l.fraccion_fusionada&&l.fraccion_de&&!getLote(l.fraccion_de)) add('advertencia','Fracciones',`Lote ${l.clave} referencia al original ${l.fraccion_de}, que ya no existe.`);
      if(l.estado==='Subdividido'&&!inv.some(x=>x.fraccion_de===l.clave&&x.fraccion_fusionada)) add('advertencia','Fracciones',`Lote ${l.clave} figura Subdividido sin fracciones vivas que lo respalden.`);
    });

    return H;
  },

  // Chequeo silencioso al iniciar sesión (solo gerente/administrador)
  checkSilencioso(){
    try{
      const H=this.run();
      window._healthFindings=H;
      const crit=H.filter(h=>h.nivel==='critico').length;
      if(H.length){
        toast(`🩺 Verificación de integridad: ${H.length} hallazgo(s)${crit?` · ${crit} crítico(s)`:''} — revisa Configuración`, crit?'err':'warn', 7000);
        IANNA_MOTOR.auditar('sistema','healthcheck','HEALTH_CHECK',{},{hallazgos:H.length,criticos:crit},'Verificación automática al iniciar sesión');
      }
      return H;
    }catch(e){ console.error('healthcheck',e); return []; }
  },
};

// Reporte visual (Configuración → 🩺 Verificación de integridad)
function abrirReporteIntegridad(){
  const H=IANNA_HEALTH.run();
  window._healthFindings=H;
  const cont=$('health-body');
  if(!H.length){
    cont.innerHTML='<div style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:700;margin-top:8px;color:#166534">Integridad verificada — sin hallazgos</div><div style="font-size:12px;color:var(--t3);margin-top:4px">Folios, unicidad de viviendas, coherencia de inventario, referencias y expedientes: todo consistente.</div></div>';
  } else {
    const grp={critico:'🔴 Críticos',advertencia:'🟡 Advertencias'};
    cont.innerHTML=['critico','advertencia'].map(niv=>{
      const items=H.filter(h=>h.nivel===niv);
      if(!items.length) return '';
      return `<div style="margin-bottom:14px"><div style="font-weight:700;font-size:13px;margin-bottom:8px">${grp[niv]} (${items.length})</div>`+
        items.map(h=>`<div style="display:flex;gap:8px;padding:8px 10px;border:1px solid ${niv==='critico'?'#fecaca':'#fde68a'};background:${niv==='critico'?'#fef2f2':'#fffbeb'};border-radius:8px;margin-bottom:6px;font-size:12.5px"><span style="flex-shrink:0;font-weight:700;color:${niv==='critico'?'#991b1b':'#92400e'}">${h.area}</span><span style="color:#334155">${h.detalle}</span></div>`).join('')+'</div>';
    }).join('');
  }
  openM('m-health');
  IANNA_MOTOR.auditar('sistema','healthcheck','HEALTH_CHECK_MANUAL',{},{hallazgos:H.length},'Verificación manual desde Configuración');
}

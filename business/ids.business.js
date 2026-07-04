/* ════════════════════════════════════════════════════════════════
   IANNA CRM — business/ids.business.js
   IDENTIFICADORES PERMANENTES (Fase 1.8)
   ────────────────────────────────────────────────────────────────
   Cada registro principal recibe un identificador público permanente
   (PRO-000001, APT-000001, VEN-000001…) además de su id interno.
   · Los consecutivos por prefijo son persistentes y NUNCA se
     reutilizan (solo avanzan), aunque el registro se elimine.
   · El id interno no se toca: el público es aditivo (campo
     `id_publico`), por lo que ninguna referencia existente se rompe.
   · La migración inicial asigna públicos a todo lo existente en
     orden de creación, una sola vez, y queda auditada.

   Clave física de ubicación: M###-L### (manzana y lote a 3 dígitos),
   derivada y persistida en cada lote como `clave_fisica`. No
   sustituye al id interno ni a la clave operativa.
   ════════════════════════════════════════════════════════════════ */

window.IANNA_IDS = {

  PREFIJOS: {
    prospecto:'PRO', cliente:'CLI', lote:'LOT', venta:'VEN', apartado:'APT',
    pago:'PAG', recibo:'REC', contrato:'CON', cancelacion:'CAN', comision:'COM',
    auditoria:'AUD', operacion:'OPE', gerente:'GER', asesor:'ASE', broker:'BRK',
    proyecto:'PRY', empresa:'EMP',
  },

  // Emite el siguiente identificador del tipo. Consecutivo persistente, jamás reutilizado.
  asignar(tipo){
    const pref=this.PREFIJOS[tipo]; if(!pref){ console.error('IANNA_IDS: tipo desconocido',tipo); return null; }
    if(!DS.db.id_seq) DS.db.id_seq={};
    DS.db.id_seq[pref]=(DS.db.id_seq[pref]||0)+1;
    DS._save(DS.db);
    return pref+'-'+String(DS.db.id_seq[pref]).padStart(6,'0');
  },

  // Clave física de ubicación: M###-L###
  claveFisica(l){
    if(!l) return '';
    const num=v=>String(parseInt(String(v).replace(/\D/g,''))||0).padStart(3,'0');
    return 'M'+num(l.mz)+'-L'+num(l.lote);
  },

  /* ── MIGRACIÓN ÚNICA: asigna públicos y claves físicas a lo existente ── */
  migrar(){
    if(DS.db.migracion_ids_v1) return false;   // ya corrió
    const orden=(a,b)=>new Date(a.fechaRegistro||a.fecha_apartado||a.fecha||0)-new Date(b.fechaRegistro||b.fecha_apartado||b.fecha||0);
    let n=0;

    // Prospectos (y CLI para quienes ya compraron)
    (DS.db.prospectos||[]).slice().sort(orden).forEach(p=>{
      if(!p.id_publico){ p.id_publico=this.asignar('prospecto'); n++; }
    });
    // Inventario: LOT + clave física
    (DS.db.inventario||[]).forEach(l=>{
      if(!l.id_publico){ l.id_publico=this.asignar('lote'); n++; }
      if(!l.clave_fisica){ l.clave_fisica=this.claveFisica(l); }
    });
    // Apartados: APT siempre; VEN además si es venta; CON si tiene contrato generado
    (DS.db.apartados||[]).slice().sort(orden).forEach(a=>{
      if(!a.id_publico){ a.id_publico=this.asignar('apartado'); n++; }
      if((a.estatus==='Venta'||a.estatus==='Venta Cancelada')&&!a.id_venta){ a.id_venta=this.asignar('venta'); }
      if(a.cierre_generado&&!a.id_contrato){ a.id_contrato=this.asignar('contrato'); }
      // CLI al comprador
      if(a.estatus==='Venta'){ const p=DS.findOne('prospectos',a.prospectoId); if(p&&!p.id_cliente){ p.id_cliente=this.asignar('cliente'); } }
      // Pagos: PAG
      (a.pagos||[]).forEach(pg=>{ if(!pg.id_publico){ pg.id_publico=this.asignar('pago'); } });
    });
    // Cancelaciones
    (DS.db.cancelaciones||[]).slice().reverse().forEach(c=>{ if(!c.id_publico){ c.id_publico=this.asignar('cancelacion'); } });
    // Usuarios por rol
    (DS.db.usuarios||[]).forEach(u=>{
      if(!u.id_publico){ u.id_publico=this.asignar(u.rol==='gerente'||u.rol==='administrador'?'gerente':'asesor'); }
    });
    // Brokers
    (DS.db.brokers||[]).forEach(b=>{ if(!b.id_publico){ b.id_publico=this.asignar('broker'); } });

    DS.db.migracion_ids_v1={fecha:new Date().toISOString(), asignados:n};
    DS._save(DS.db);
    try{ IANNA_MOTOR.auditar('sistema','ids','MIGRACION_IDS_PUBLICOS',{},{asignados:n},'Asignación única de identificadores permanentes a registros existentes'); }catch(e){}
    return true;
  },

  // Asignaciones automáticas para registros NUEVOS (llamadas desde el motor)
  alCrearProspecto(p){ if(p&&!p.id_publico){ DS.update('prospectos',p.id,{id_publico:this.asignar('prospecto')}); } },
  alCrearApartado(a){ if(a&&!a.id_publico){ DS.update('apartados',a.id,{id_publico:this.asignar('apartado')}); } },
  alConvertirVenta(a){
    const patch={};
    if(a&&!a.id_venta) patch.id_venta=this.asignar('venta');
    if(a&&!a.id_contrato) patch.id_contrato=this.asignar('contrato');
    if(Object.keys(patch).length) DS.update('apartados',a.id,patch);
    const p=a&&DS.findOne('prospectos',a.prospectoId);
    if(p&&!p.id_cliente) DS.update('prospectos',p.id,{id_cliente:this.asignar('cliente')});
  },
  alCrearLote(clave){ const l=getLote(clave); if(l&&!l.id_publico){ const i=DS.db.inventario.findIndex(x=>x.clave===clave); DS.db.inventario[i]={...l,id_publico:this.asignar('lote'),clave_fisica:this.claveFisica(l)}; DS._save(DS.db);} },
};

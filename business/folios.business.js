/* ════════════════════════════════════════════════════════════════
   IANNA CRM — business/folios.business.js
   FOLIOS ÚNICOS E IRREPETIBLES (Fase 1.5)
   ────────────────────────────────────────────────────────────────
   Fuente única de folios para TODOS los documentos oficiales:
   recibos de apartado, pagos de cobranza, cancelaciones y futuros
   (contratos, comprobantes, estados de cuenta).

   Garantías:
   · peek()   → consulta el siguiente disponible SIN consumirlo
                (para vistas previas; reabrir un cierre no gasta folios).
   · emitir() → asigna en firme: escanea TODAS las fuentes existentes,
                salta automáticamente cualquier colisión, registra la
                emisión (tipo, referencia, usuario, fecha) y avanza el
                consecutivo persistente.
   · duplicados() → detecta folios repetidos existentes (Health Check).
   ════════════════════════════════════════════════════════════════ */

window.IANNA_FOLIOS = {

  // Recolecta todos los folios en uso, de todas las fuentes
  _enUso(){
    const usados = new Map(); // folio → [ubicaciones]
    const add=(f,donde)=>{ const n=parseInt(f); if(!n) return; if(!usados.has(n)) usados.set(n,[]); usados.get(n).push(donde); };
    (DS.find('apartados')||[]).forEach(a=>{
      if(a.folio_recibo) add(a.folio_recibo, `Recibo de apartado — ${a.clave_lote} (${a.estatus})`);
      (a.pagos||[]).forEach(p=>add(p.folio, `Recibo de pago ${p.concepto||''} — ${a.clave_lote}`));
    });
    (DS.db.cancelaciones||[]).forEach(c=>add(c.folio, `Cancelación — ${c.clave_lote||''}`));
    (DS.db.folios_registro||[]).forEach(r=>add(r.folio, `Registro (${r.tipo})`));
    return usados;
  },

  // Siguiente folio disponible (NO consume)
  peek(){
    const usados=this._enUso();
    const maxUsado = usados.size ? Math.max(...usados.keys()) : 299;
    const seq = DS.db.folio_seq||0;
    return String(Math.max(maxUsado, seq, 299)+1).padStart(8,'0');
  },

  // Emite un folio en firme: único garantizado, con registro y auditoría
  emitir(tipo, referencia){
    const usados=this._enUso();
    let n = Math.max(usados.size?Math.max(...usados.keys()):299, DS.db.folio_seq||0, 299)+1;
    while(usados.has(n)) n++;                     // salto automático de colisiones
    if(!DS.db.folios_registro) DS.db.folios_registro=[];
    DS.db.folios_registro.push({folio:n, tipo:tipo||'documento', ref:String(referencia||''), usuario:(typeof CU!=='undefined'&&CU)?CU.id:'system', fecha:new Date().toISOString()});
    if(DS.db.folios_registro.length>5000) DS.db.folios_registro=DS.db.folios_registro.slice(-5000);
    DS.db.folio_seq=n;
    DS._save(DS.db);
    return String(n).padStart(8,'0');
  },

  // Folios repetidos existentes en el sistema (para Health Check)
  duplicados(){
    const out=[];
    this._enUso().forEach((lugares,folio)=>{
      // El registro de emisión no cuenta como duplicado contra el documento que lo usa
      const docs=lugares.filter(l=>!l.startsWith('Registro ('));
      if(docs.length>1) out.push({folio:String(folio).padStart(8,'0'), ubicaciones:docs});
    });
    return out;
  },
};

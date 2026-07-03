/* ════════════════════════════════════════════════════════════════
   IANNA CRM — services/dataStore.service.js
   DataStore (DS): capa única de acceso a datos (localStorage). Los módulos NO tocan localStorage directamente.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
// ================================================================
// DATA STORE — Preparado para Supabase (reemplaza métodos con fetch)
// ================================================================
const DS_KEY = 'va_crm_v5_1782782740'; // v5: cache-bust forzado
const DS = {
  _db: null,
  get db() { if (!this._db) this._db = this._load(); return this._db; },
  _load() { try { const d=localStorage.getItem(DS_KEY); return d?JSON.parse(d):this._seed(); } catch(e){ return this._seed(); } },
  _save(db) { try { localStorage.setItem(DS_KEY,JSON.stringify(db)); } catch(e){} return db; },
  _seed() {
    const db = {
      usuarios:[
        {id:'u0',nombre:'Administrador PALIZ',correo:'admin@va.com',pass:'admin2026',rol:'administrador',telefono:'667 000 0000',activo:true,fechaAlta:new Date().toISOString(),avatar:''},
        {id:'u1',nombre:'José Rafael Patrón Osuna',correo:'gerente@va.com',pass:'1234',rol:'gerente',telefono:'667 426 5145',activo:true,fechaAlta:new Date().toISOString(),avatar:''},
        {id:'u2',nombre:'Ana López Martínez',correo:'asesor@va.com',pass:'1234',rol:'asesor',telefono:'667 111 2222',activo:true,fechaAlta:new Date().toISOString(),avatar:''},
        {id:'u3',nombre:'Roberto Sánchez Vega',correo:'roberto@va.com',pass:'1234',rol:'asesor',telefono:'667 333 4444',activo:true,fechaAlta:new Date().toISOString(),avatar:''},
        {id:'u4',nombre:'María García Torres',correo:'maria@va.com',pass:'1234',rol:'asesor',telefono:'667 555 6666',activo:true,fechaAlta:new Date().toISOString(),avatar:''},
      ],
      prospectos:[],seguimientos:[],recordatorios:[],
      inventario:JSON.parse(JSON.stringify(MASTER_INV)).map(l=>({...l,historial:[]})),
      apartados:[],
      params:{...MASTER_PARAMS},
      modelos:JSON.parse(JSON.stringify(MASTER_MOD)),
      brokers:[],
      auditoria:[],
      cotizaciones:[],
      conversaciones:[],
    };
    // Demo prospectos — solo activos
    const NS=['Luis Herrera Díaz','Sofía Torres Ruiz','Pedro Ramírez Luna','Carmen Vega Mora','Jorge Castillo Gil','Valeria Ruiz Peña','Andrés Flores Cruz','Daniela Morales Ríos','Fernando Aguilar Soto','Claudia Jiménez Paz'];
    const ES=['Nuevo','Contactado','Cita agendada','Visitó desarrollo','Seguimiento','Contactado','Nuevo','Cita agendada','Visitó desarrollo','Seguimiento'];
    const AS=['u2','u3','u4'];
    const FS=['Facebook','Instagram','TikTok','Google','Referido','Cartel','Agencia','Broker','Guardia','Expo'];
    NS.forEach((n,i)=>{
      const id='p'+(i+1);
      const d=new Date(); d.setDate(d.getDate()-Math.floor(Math.random()*22));
      db.prospectos.push({id,nombre:n,telefono:fmtTelVal('667'+Math.floor(1000000+Math.random()*9000000)),correo:n.split(' ')[0].toLowerCase()+(Math.floor(10+Math.random()*90))+'@gmail.com',fuente:FS[i],fechaRegistro:d.toISOString(),presupuesto:1500000+Math.floor(Math.random()*2500000),enganche:200000+Math.floor(Math.random()*500000),ingresos:25000+Math.floor(Math.random()*70000),estadoCivil:['Soltero','Casado','Divorciado'][i%3],comentarios:'Interesado en casa de 3 recámaras. Tiene crédito INFONAVIT. Busca zona tranquila.',asesor:AS[i%AS.length],estatus:ES[i]});
      if(i<8) db.seguimientos.push({id:'s'+id,prospectoId:id,tipo:'Llamada',nota:'Contacto inicial realizado. Prospecto muestra interés en modelos disponibles.',fecha:new Date(d.getTime()+86400000).toISOString(),usuario:AS[i%AS.length],estatusCambio:ES[i]});
    });
    localStorage.setItem(DS_KEY,JSON.stringify(db));
    return db;
  },
  find(col,filter={}) { let d=[...(this.db[col]||[])]; Object.entries(filter).forEach(([k,v])=>{ if(v!==undefined&&v!=='') d=d.filter(r=>r[k]===v); }); return d; },
  findOne(col,id) { return (this.db[col]||[]).find(r=>r.id===id); },
  create(col,data) { data.id=data.id||uid(); if(!this.db[col]) this.db[col]=[]; this.db[col].unshift(data); this._save(this.db); return data; },
  update(col,id,patch) { const i=(this.db[col]||[]).findIndex(r=>r.id===id); if(i<0) return null; this.db[col][i]={...this.db[col][i],...patch}; this._save(this.db); return this.db[col][i]; },
  delete(col,id) { if(!this.db[col]) return; this.db[col]=this.db[col].filter(r=>r.id!==id); this._save(this.db); },
  getParams() { return this.db.params||{...MASTER_PARAMS}; },
  saveParams(p) { this.db.params={...this.db.params,...p}; this._save(this.db); },
  getModelos() { return this.db.modelos||JSON.parse(JSON.stringify(MASTER_MOD)); },
  audit(tabla,registroId,accion,antes,despues){
    if(!this.db.auditoria) this.db.auditoria=[];
    this.db.auditoria.unshift({id:'_'+Math.random().toString(36).substr(2,9),tabla,registroId:String(registroId||''),accion,usuarioId:typeof CU!=='undefined'&&CU?CU.id:'system',usuarioNombre:typeof CU!=='undefined'&&CU?CU.nombre:'system',antes:JSON.stringify(antes||{}),despues:JSON.stringify(despues||{}),fecha:new Date().toISOString()});
    if(this.db.auditoria.length>2000) this.db.auditoria=this.db.auditoria.slice(0,2000);
    this._save(this.db);
  },
};


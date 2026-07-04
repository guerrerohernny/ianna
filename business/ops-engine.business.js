/* ════════════════════════════════════════════════════════════════
   IANNA CRM — business/ops-engine.business.js
   MOTOR DE OPERACIONES (Fase 1.8)
   ────────────────────────────────────────────────────────────────
   FILOSOFÍA: ningún módulo es dueño de la información. Los módulos
   presentan información y SOLICITAN operaciones; este motor es el
   único que ejecuta procesos empresariales, siempre con el mismo
   pipeline:

     1. Validar reglas de negocio (IANNA_MOTOR / IANNA_OPERACIONES)
     2. Validar máquina de estados (IANNA_ESTADOS)
     3. Analizar impacto
     4. Mostrar consecuencias al usuario
     5. Solicitar confirmación
     6. Ejecutar
     7. Sincronizar todos los módulos afectados (IANNA_SYNC)
     8. Registrar auditoría (IANNA_MOTOR.auditar)
     9. Registrar historial permanente (nunca se elimina)
    10. Confirmar resultado

   Las funciones públicas existentes (convertirVenta, cancelarVenta,
   cancelarApartadoModal, saveApartado) se convirtieron en
   SOLICITANTES: enrutan hacia este motor. La UI no cambió.
   ════════════════════════════════════════════════════════════════ */

/* ── SINCRONIZACIÓN CENTRAL ─────────────────────────────────────── */
window.IANNA_SYNC = {
  _mapa(){
    return {
      inventario:  ()=>{ try{ renderInventario(); }catch(e){} },
      apartados:   ()=>{ try{ renderApartados(); }catch(e){} },
      prospectos:  ()=>{ try{ filterProsp(); }catch(e){} },
      ingresos:    ()=>{ try{ renderIngresos(); }catch(e){} },
      cobranza:    ()=>{ try{ if(typeof _cierreData!=='undefined'&&_cierreData) renderCobranza(); }catch(e){} },
      dashboard:   ()=>{ try{ renderDashboard(); }catch(e){} },
      reportes:    ()=>{ try{ if(document.getElementById('page-reportes')?.classList.contains('active')) renderReportes(); }catch(e){} },
      auditoria:   ()=>{ try{ if(document.getElementById('page-auditoria')?.classList.contains('active')) renderAuditoria(); }catch(e){} },
      brokers:     ()=>{ try{ if(document.getElementById('page-brokers')?.classList.contains('active')) renderBrokers(); }catch(e){} },
    };
  },
  refrescar(modulos){
    const m=this._mapa();
    (modulos&&modulos.length?modulos:Object.keys(m)).forEach(k=>{ if(m[k]) m[k](); });
  },
};

/* ── HISTORIAL PERMANENTE DE OPERACIONES ────────────────────────── */
window.IANNA_HISTORIAL = {
  registrar({tipo, registroId, idPublico, estadoAnterior, estadoNuevo, motivo, resultado, detalle}){
    if(!DS.db.historial_operaciones) DS.db.historial_operaciones=[];
    const f=new Date();
    DS.db.historial_operaciones.unshift({
      id: IANNA_IDS.asignar('operacion'),
      tipo, registro:String(registroId||''), id_publico:idPublico||'',
      usuario:(typeof CU!=='undefined'&&CU)?CU.id:'system',
      usuarioNombre:(typeof CU!=='undefined'&&CU)?CU.nombre:'system',
      fecha:f.toISOString().split('T')[0], hora:f.toTimeString().slice(0,8),
      estadoAnterior:estadoAnterior||'', estadoNuevo:estadoNuevo||'',
      motivo:motivo||'', resultado:resultado||'ok', detalle:detalle||'',
    });
    // Historial PERMANENTE: sin recorte automático (persistencia externa en fase Supabase)
    DS._save(DS.db);
  },
  de(registroId){ return (DS.db.historial_operaciones||[]).filter(h=>h.registro===String(registroId)); },
};

/* ── MOTOR DE OPERACIONES ───────────────────────────────────────── */
window.IANNA_OPS = {

  // Registro de operaciones ejecutables. Cada una declara su pipeline.
  _ops: {},

  registrar(tipo, def){ this._ops[tipo]=def; },

  /* Pipeline único. payload libre por operación.
     def = {
       validar(payload) → {ok, errores[]}
       estadoObjetivo(payload) → nombre de estado destino (o null si no transiciona)
       impacto(payload) → {consecuencias:string, modulos:[...], estadoAnterior, registroId, idPublico}
       ejecutar(payload) → {ok, resultado, estadoNuevo?}   (solo escribe; sin confirms)
       confirmar:true|false  (si false, la UI ya confirmó — p.ej. modal propio)
     } */
  ejecutar(tipo, payload={}){
    const def=this._ops[tipo];
    if(!def){ toast('Operación no registrada: '+tipo,'err'); return {ok:false}; }

    // 1 · Reglas de negocio
    const val=def.validar?def.validar(payload):{ok:true,errores:[]};
    if(!val.ok){
      IANNA_MOTOR.bloquear(def.tabla||'operaciones', payload.aid||tipo, ('OP_'+tipo).toUpperCase(), val.errores.join(' '));
      IANNA_HISTORIAL.registrar({tipo, registroId:payload.aid, estadoAnterior:def._estAnt, resultado:'bloqueada', motivo:val.errores.join(' ')});
      return {ok:false, errores:val.errores};
    }

    // 2 · Máquina de estados
    const imp=def.impacto?def.impacto(payload):{};
    const destino=def.estadoObjetivo?def.estadoObjetivo(payload):null;
    if(destino){
      const tr=IANNA_ESTADOS.puedeTransicionar(imp.estadoAnterior, destino);
      if(!tr.ok){
        IANNA_MOTOR.bloquear(def.tabla||'operaciones', payload.aid||tipo, ('OP_'+tipo).toUpperCase(), tr.razon);
        IANNA_HISTORIAL.registrar({tipo, registroId:payload.aid, estadoAnterior:imp.estadoAnterior, estadoNuevo:destino, resultado:'bloqueada', motivo:tr.razon});
        return {ok:false, errores:[tr.razon]};
      }
    }

    // 3-5 · Impacto → consecuencias → confirmación
    if(def.confirmar!==false && imp.consecuencias){
      if(!confirm(imp.consecuencias)){
        IANNA_HISTORIAL.registrar({tipo, registroId:imp.registroId||payload.aid, idPublico:imp.idPublico, estadoAnterior:imp.estadoAnterior, estadoNuevo:destino||imp.estadoAnterior, resultado:'cancelada por el usuario', motivo:payload.motivo||''});
        return {ok:false, cancelada:true};
      }
    }

    // 6 · Ejecutar (el ejecutor solo escribe; validaciones ya pasaron)
    let res;
    try{ res=def.ejecutar(payload)||{ok:true}; }
    catch(e){
      console.error('IANNA_OPS',tipo,e);
      IANNA_HISTORIAL.registrar({tipo, registroId:imp.registroId||payload.aid, estadoAnterior:imp.estadoAnterior, resultado:'error: '+e.message, motivo:payload.motivo||''});
      toast('La operación no pudo completarse: '+e.message,'err');
      return {ok:false, error:e};
    }
    if(res.ok===false){
      IANNA_HISTORIAL.registrar({tipo, registroId:imp.registroId||payload.aid, estadoAnterior:imp.estadoAnterior, resultado:'no ejecutada', motivo:res.motivo||''});
      return res;
    }

    // 7 · Sincronización automática de módulos afectados
    IANNA_SYNC.refrescar(imp.modulos || (destino?IANNA_ESTADOS.modulosDe(destino):[]));

    // 8 · Auditoría (los ejecutores también auditan detalle fino; aquí queda la operación)
    IANNA_MOTOR.auditar(def.tabla||'operaciones', imp.registroId||payload.aid||tipo, ('OP_'+tipo).toUpperCase(),
      {estado:imp.estadoAnterior}, {estado:res.estadoNuevo||destino||imp.estadoAnterior, ...(res.resumen||{})}, payload.motivo||def.descripcion||'');

    // 9 · Historial permanente
    IANNA_HISTORIAL.registrar({tipo, registroId:imp.registroId||payload.aid, idPublico:imp.idPublico,
      estadoAnterior:imp.estadoAnterior, estadoNuevo:res.estadoNuevo||destino||imp.estadoAnterior,
      motivo:payload.motivo||'', resultado:'ok', detalle:res.detalle||''});

    // 10 · Resultado
    return {ok:true, ...res};
  },

  // Operaciones permitidas/prohibidas para el modal ⚙ Operaciones
  catalogoPara(ap){
    const est=IANNA_ESTADOS.estadoDe(ap);
    const d=IANNA_ESTADOS.get(est)||{permitidas:[],prohibidas:[]};
    const NOMBRES={
      editar_apartado:'✏️ Editar apartado', generar_cierre:'📄 Cierre y documentos',
      contrato_firmado:'🤝 Contrato firmado — Registrar venta', cancelacion_apartado:'✕ Cancelar apartado',
      cancelacion_venta:'✕ Cancelar venta', cobranza:'💰 Cobranza', registrar_pago:'🧾 Registrar pago',
      correccion_administrativa:'🔓 Corrección administrativa', crear_apartado:'➕ Nuevo apartado',
      cambio_lote:'📍 Cambio de lote', cambio_modelo:'🏠 Cambio de modelo',
      cambio_cliente:'👤 Cambio de cliente', cambio_asesor:'🧑‍💼 Cambio de asesor', transferencia:'🔁 Transferencia',
    };
    const ACCIONES={
      editar_apartado:(a)=>editarApartado(a.id), generar_cierre:(a)=>generarCierre(a.id),
      contrato_firmado:(a)=>convertirVenta(a.id), cancelacion_apartado:(a)=>cancelarApartadoModal(a.id),
      cancelacion_venta:(a)=>openCancelarVenta(a.id), cobranza:(a)=>abrirCobranzaVenta(a.id),
      registrar_pago:(a)=>{ a.estatus==='Venta'?abrirCobranzaVenta(a.id):(generarCierre(a.id),cierreTab(3)); },
      correccion_administrativa:(a)=>{ abrirCobranzaVenta(a.id); setCierreLock(false); },
      cambio_lote:()=>IANNA_OPERACIONES.cambio_lote.ejecutar(), cambio_modelo:()=>IANNA_OPERACIONES.cambio_modelo.ejecutar(),
      cambio_cliente:()=>IANNA_OPERACIONES.cambio_cliente.ejecutar(), cambio_asesor:()=>IANNA_OPERACIONES.cambio_asesor.ejecutar(),
      transferencia:()=>IANNA_OPERACIONES.transferencia.ejecutar(),
    };
    const FUTURAS=['cambio_lote','cambio_modelo','cambio_cliente','cambio_asesor','transferencia'];
    return {
      estado:est,
      documentos:IANNA_ESTADOS.documentosDe(est),
      permitidas:d.permitidas.filter(o=>NOMBRES[o]).map(o=>({op:o, nombre:NOMBRES[o], futura:FUTURAS.includes(o), accion:ACCIONES[o]})),
      prohibidas:d.prohibidas.filter(o=>NOMBRES[o]).map(o=>({op:o, nombre:NOMBRES[o]})),
    };
  },
};

/* ── REGISTRO DE OPERACIONES CRÍTICAS ───────────────────────────── */
// contrato_firmado: Apartado → Contrato firmado
IANNA_OPS.registrar('contrato_firmado', {
  tabla:'apartados', descripcion:'Contrato firmado — conversión a venta',
  validar:({aid})=>IANNA_MOTOR.validarConversionVenta(DS.findOne('apartados',aid)),
  estadoObjetivo:()=>'Contrato firmado',
  impacto:({aid})=>{
    const ap=DS.findOne('apartados',aid); const p=DS.findOne('prospectos',ap.prospectoId);
    return {registroId:aid, idPublico:ap.id_publico, estadoAnterior:IANNA_ESTADOS.estadoDe(ap),
      modulos:IANNA_ESTADOS.modulosDe('Contrato firmado'),
      consecuencias:`¿Confirmar CONTRATO FIRMADO de ${p?.nombre||'el cliente'} — Lote ${ap.clave_lote}?\n\nEsta operación realizará automáticamente:\n\n• Convertir el apartado en VENTA (estado: Contrato firmado).\n• Marcar el lote como Vendido en el inventario.\n• Activar comisiones del asesor y del gerente en Ingresos.\n• Asignar identificadores permanentes de venta y contrato.\n• Registrar auditoría e historial.\n\n¿Continuar?`};
  },
  ejecutar:({aid})=>{
    const r=_ejecutarContratoFirmado(aid);
    const ap=DS.findOne('apartados',aid);
    IANNA_IDS.alConvertirVenta(ap);
    return {ok:r!==false, estadoNuevo:'Contrato firmado', resumen:{id_venta:ap.id_venta, id_contrato:ap.id_contrato}};
  },
});

// cancelacion_venta: Contrato firmado → Cancelado | Apartado (reversión)
IANNA_OPS.registrar('cancelacion_venta', {
  tabla:'apartados', descripcion:'Cancelación formal de venta',
  validar:({aid})=>IANNA_OPERACIONES.cancelacion_venta.validar(DS.findOne('apartados',aid)),
  estadoObjetivo:({destino})=>destino==='Apartado'?'Apartado':'Cancelado',
  impacto:({aid,destino})=>{
    const ap=DS.findOne('apartados',aid);
    return {registroId:aid, idPublico:ap.id_venta||ap.id_publico, estadoAnterior:IANNA_ESTADOS.estadoDe(ap),
      modulos:IANNA_ESTADOS.modulosDe('Cancelado'),
      consecuencias:IANNA_MOTOR.consecuenciasCancelacionVenta(ap,destino)};
  },
  ejecutar:({aid,motivo,destino})=>{
    _ejecutarCancelacionVenta(aid,motivo,destino);
    return {ok:true, estadoNuevo:destino==='Apartado'?'Apartado':'Cancelado'};
  },
});

// cancelacion_apartado: Apartado → Cancelado
IANNA_OPS.registrar('cancelacion_apartado', {
  tabla:'apartados', descripcion:'Cancelación formal de apartado',
  validar:({aid})=>IANNA_OPERACIONES.cancelacion_apartado.validar(DS.findOne('apartados',aid)),
  estadoObjetivo:()=>'Cancelado',
  impacto:({aid})=>{
    const ap=DS.findOne('apartados',aid);
    return {registroId:aid, idPublico:ap.id_publico, estadoAnterior:IANNA_ESTADOS.estadoDe(ap),
      modulos:IANNA_ESTADOS.modulosDe('Cancelado'),
      consecuencias:IANNA_MOTOR.consecuenciasCancelacionApartado(ap)};
  },
  ejecutar:({aid})=>{ _ejecutarCancelacionApartado(aid); return {ok:true, estadoNuevo:'Cancelado'}; },
});

// correccion_administrativa: sin transición; auditada por el módulo de cobranza
IANNA_OPS.registrar('correccion_administrativa', {
  tabla:'apartados', descripcion:'Corrección administrativa sobre venta cerrada', confirmar:false,
  validar:()=>({ok:true,errores:[]}),
  estadoObjetivo:()=>null,
  impacto:({aid})=>{ const ap=DS.findOne('apartados',aid); return {registroId:aid, idPublico:ap?.id_venta||ap?.id_publico, estadoAnterior:IANNA_ESTADOS.estadoDe(ap), modulos:[]}; },
  ejecutar:()=>({ok:true}),
});

/* ── MODAL ⚙ OPERACIONES (los módulos solo solicitan) ───────────── */
function abrirOperaciones(aid){
  const ap=DS.findOne('apartados',aid); if(!ap) return;
  const p=DS.findOne('prospectos',ap.prospectoId);
  const l=getLote(ap.clave_lote);
  const cat=IANNA_OPS.catalogoPara(ap);
  window._opsApId=aid;
  $('ops-titulo').textContent=`${p?.nombre||'Cliente'} — Lote ${ap.clave_lote}${l?.clave_fisica?' ('+l.clave_fisica+')':''}`;
  $('ops-body').innerHTML=`
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;font-size:11.5px">
      <span class="badge" style="background:#1E3D0F;color:#fff">Estado: ${cat.estado}</span>
      ${ap.id_publico?`<span class="badge" style="background:#f1f5f9;color:#334155">${ap.id_publico}</span>`:''}
      ${ap.id_venta?`<span class="badge" style="background:#f1f5f9;color:#334155">${ap.id_venta}</span>`:''}
      ${ap.id_contrato?`<span class="badge" style="background:#f1f5f9;color:#334155">${ap.id_contrato}</span>`:''}
      ${p?.id_cliente?`<span class="badge" style="background:#f1f5f9;color:#334155">${p.id_cliente}</span>`:(p?.id_publico?`<span class="badge" style="background:#f1f5f9;color:#334155">${p.id_publico}</span>`:'')}
    </div>
    <div style="font-weight:700;font-size:12.5px;margin-bottom:8px">Operaciones permitidas en este estado</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      ${cat.permitidas.map((o,i)=>`<button class="btn ${o.futura?'btn-out':'btn-navy'}" style="justify-content:flex-start;font-size:12.5px" onclick="ejecutarOpDesdeModal(${i})">${o.nombre}${o.futura?' <span style="opacity:.55;font-size:10px;margin-left:4px">(próxima fase)</span>':''}</button>`).join('')||'<div style="color:var(--t3);font-size:12px">Ninguna — estado terminal.</div>'}
    </div>
    ${cat.prohibidas.length?`<div style="font-weight:700;font-size:12.5px;margin-bottom:6px;color:var(--t3)">No disponibles en "${cat.estado}"</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${cat.prohibidas.map(o=>`<span class="badge" style="background:#f8fafc;color:#94a3b8;border:1px dashed #e2e8f0">${o.nombre}</span>`).join('')}</div>`:''}
    ${cat.documentos.length?`<div style="font-size:11px;color:var(--t3)">📎 Documentos de esta etapa: ${cat.documentos.join(' · ')}</div>`:''}
    <div style="font-size:11px;color:var(--t3);margin-top:10px">🕓 Historial: ${IANNA_HISTORIAL.de(aid).length} operación(es) registradas sobre este expediente.</div>`;
  window._opsCat=cat;
  openM('m-operaciones');
}
function ejecutarOpDesdeModal(i){
  const cat=window._opsCat; const ap=DS.findOne('apartados',window._opsApId);
  if(!cat||!ap) return;
  const o=cat.permitidas[i]; if(!o) return;
  closeM('m-operaciones');
  o.accion(ap);
}

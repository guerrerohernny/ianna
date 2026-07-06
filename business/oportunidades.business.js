/* ════════════════════════════════════════════════════════════════
   IANNA CRM — business/oportunidades.business.js
   MOTOR DE OPORTUNIDADES (Fase 1.9)
   ────────────────────────────────────────────────────────────────
   Una Oportunidad representa la INTENCIÓN COMERCIAL de una Persona
   en un Proyecto específico, aún sin formalizar apartado ni venta.

   Modelo:
   · Una Persona puede tener MÚLTIPLES Oportunidades activas,
     incluso en distintos Proyectos.
   · Cada Oportunidad tiene ciclo de vida propio en el pipeline.
   · Al ganarse, genera una Operación (APT-) y queda enlazada
     como registro histórico permanente.
   · Al perderse, se conserva con motivo — es data comercial valiosa.

   Estrategia de compatibilidad (crítica):
   · El kanban actual sigue mostrando y moviendo tarjetas SIN CAMBIOS.
   · Cada movimiento en el pipeline se sincroniza automáticamente
     con la Oportunidad correspondiente (creada implícitamente si
     el prospecto aún no tiene una).
   · Los prospectos existentes NO se migran forzadamente: se crea
     su Oportunidad cuando se toca la tarjeta por primera vez.
   ════════════════════════════════════════════════════════════════ */

window.IANNA_OPO = (function(){

  // Estados del pipeline (coinciden con los estatus actuales del prospecto para compatibilidad,
  // más los estados de cierre propios de la Oportunidad).
  const ESTADOS = [
    'Nueva', 'Contactada', 'Cita agendada', 'Visitó desarrollo',
    'Cotización enviada', 'Negociando', 'Ganada', 'Perdida', 'En pausa'
  ];

  // Mapa de compatibilidad: estatus internos del prospecto ↔ estados de Oportunidad.
  // Los estatus antiguos se traducen sin pérdida.
  const MAPA_COMPAT = {
    'Nuevo':'Nueva', 'Contactado':'Contactada', 'Cita agendada':'Cita agendada',
    'Visitó desarrollo':'Visitó desarrollo', 'Cotización enviada':'Cotización enviada',
    'Negociando':'Negociando', 'Seguimiento':'En pausa', 'Apartado':'Ganada',
    'Cliente':'Ganada', 'Inactivo':'Perdida',
    'No interesado':'Perdida', 'No le alcanza':'Perdida', 'Compró en otro lado':'Perdida',
  };
  const MAPA_INVERSO = {
    'Nueva':'Nuevo', 'Contactada':'Contactado', 'Cita agendada':'Cita agendada',
    'Visitó desarrollo':'Visitó desarrollo', 'Cotización enviada':'Cotización enviada',
    'Negociando':'Negociando', 'Ganada':'Apartado', 'Perdida':'No interesado', 'En pausa':'Seguimiento',
  };

  /* ──────────────────────────────────────────────────────────────
     API: consultas
     ────────────────────────────────────────────────────────────── */
  function todas(){ return DS.db.oportunidades || []; }
  function dePersona(pid){ return todas().filter(o => o.personaId === pid); }
  function activasDePersona(pid){ return dePersona(pid).filter(o => o.estado !== 'Ganada' && o.estado !== 'Perdida'); }
  function porId(id){ return todas().find(o => o.id === id) || null; }

  // Devuelve la Oportunidad activa asociada a un prospecto (o la crea si no existe).
  // Estrategia de compatibilidad: cada prospecto tiene AL MENOS una Oportunidad implícita
  // que refleja su estatus actual en el kanban.
  function oportunidadImplicita(personaId){
    const existentes = activasDePersona(personaId);
    if(existentes.length > 0) return existentes[0];
    const p = DS.findOne('prospectos', personaId);
    if(!p) return null;
    return crear({
      personaId,
      proyectoId: (window.IANNA_CONFIG?.empresa?.id) || 'valle-de-aragon',
      estado: MAPA_COMPAT[p.estatus] || 'Nueva',
      origen: p.fuente || '',
      presupuesto: p.presupuesto || 0,
      asesor_asignado: p.asesor,
      _implicita: true,
      _motivo: 'Oportunidad creada implícitamente por compatibilidad con kanban',
    });
  }

  /* ──────────────────────────────────────────────────────────────
     API: creación y actualización
     ────────────────────────────────────────────────────────────── */
  function crear(datos){
    if(!DS.db.oportunidades) DS.db.oportunidades = [];
    const o = {
      id: uid(),
      id_publico: IANNA_IDS.asignar('operacion').replace('OPE-','OPO-'), // reusa el consecutivo persistente
      personaId: datos.personaId,
      proyectoId: datos.proyectoId || 'valle-de-aragon',
      clave_lote_interes: datos.clave_lote_interes || null,
      modelo_id_interes:  datos.modelo_id_interes || null,
      presupuesto:        datos.presupuesto || 0,
      plazo_estimado:     datos.plazo_estimado || '',
      origen:             datos.origen || '',
      estado:             datos.estado || 'Nueva',
      motivo_perdida:     '',
      asesor_asignado:    datos.asesor_asignado || (typeof CU!=='undefined'&&CU?CU.id:null),
      broker_id:          datos.broker_id || null,
      score:              datos.score || 0,
      probabilidad_cierre:datos.probabilidad_cierre || 0,
      operacionId:        null,
      _implicita:         !!datos._implicita,
      fecha_creacion:     new Date().toISOString(),
      fecha_ultimo_contacto: new Date().toISOString(),
      historial: [{ estado: datos.estado || 'Nueva', fecha: new Date().toISOString(), usuario: (typeof CU!=='undefined'&&CU?CU.id:'system'), motivo: datos._motivo || 'Alta de Oportunidad' }],
    };
    DS.db.oportunidades.push(o);
    DS._save(DS.db);
    try{ IANNA_MOTOR.auditar('oportunidades', o.id, 'CREAR_OPORTUNIDAD', {}, { id_publico:o.id_publico, personaId:o.personaId, proyectoId:o.proyectoId, estado:o.estado }, datos._motivo || 'Alta de Oportunidad'); }catch(e){}
    return o;
  }

  // Transición de estado — pasa por el pipeline de reglas.
  function transicionar(oportunidadId, nuevoEstado, motivo){
    const o = porId(oportunidadId);
    if(!o) return { ok:false, error:'Oportunidad no encontrada' };
    if(!ESTADOS.includes(nuevoEstado)) return { ok:false, error:'Estado no reconocido: '+nuevoEstado };
    if(o.estado === nuevoEstado) return { ok:true, sinCambio:true };
    if(o.estado === 'Ganada') return { ok:false, error:'Una Oportunidad Ganada no puede cambiar de estado (ya generó una Operación).' };
    if(o.estado === 'Perdida' && !['Nueva','Contactada','En pausa'].includes(nuevoEstado)){
      return { ok:false, error:'Una Oportunidad Perdida solo puede reabrirse a Nueva, Contactada o En pausa.' };
    }
    const anterior = o.estado;
    o.estado = nuevoEstado;
    o.fecha_ultimo_contacto = new Date().toISOString();
    if(!o.historial) o.historial = [];
    o.historial.push({ estado: nuevoEstado, anterior, fecha: new Date().toISOString(), usuario: (typeof CU!=='undefined'&&CU?CU.id:'system'), motivo: motivo || '' });
    // Guardar
    const i = DS.db.oportunidades.findIndex(x => x.id === oportunidadId);
    DS.db.oportunidades[i] = o;
    DS._save(DS.db);
    try{ IANNA_MOTOR.auditar('oportunidades', oportunidadId, 'TRANSICION_OPORTUNIDAD', { estado:anterior }, { estado:nuevoEstado }, motivo || `${anterior} → ${nuevoEstado}`); }catch(e){}
    return { ok:true, oportunidad:o };
  }

  // Al ganarse una Oportunidad, se enlaza a la Operación creada.
  function marcarGanada(oportunidadId, operacionId){
    const o = porId(oportunidadId); if(!o) return;
    o.estado = 'Ganada';
    o.operacionId = operacionId;
    o.fecha_ganada = new Date().toISOString();
    if(!o.historial) o.historial = [];
    o.historial.push({ estado:'Ganada', fecha:o.fecha_ganada, usuario:(typeof CU!=='undefined'&&CU?CU.id:'system'), motivo:'Operación generada: '+operacionId });
    const i = DS.db.oportunidades.findIndex(x => x.id === oportunidadId);
    DS.db.oportunidades[i] = o;
    DS._save(DS.db);
    try{ IANNA_MOTOR.auditar('oportunidades', oportunidadId, 'OPORTUNIDAD_GANADA', {}, { operacionId }, 'Conversión a Operación'); }catch(e){}
    return o;
  }

  function marcarPerdida(oportunidadId, motivo){
    const o = porId(oportunidadId); if(!o) return;
    o.estado = 'Perdida';
    o.motivo_perdida = motivo || '';
    o.fecha_perdida = new Date().toISOString();
    if(!o.historial) o.historial = [];
    o.historial.push({ estado:'Perdida', fecha:o.fecha_perdida, usuario:(typeof CU!=='undefined'&&CU?CU.id:'system'), motivo: motivo || 'Sin motivo especificado' });
    const i = DS.db.oportunidades.findIndex(x => x.id === oportunidadId);
    DS.db.oportunidades[i] = o;
    DS._save(DS.db);
    try{ IANNA_MOTOR.auditar('oportunidades', oportunidadId, 'OPORTUNIDAD_PERDIDA', {}, { motivo }, motivo); }catch(e){}
    return o;
  }

  /* ──────────────────────────────────────────────────────────────
     SINCRONIZACIÓN BIDIRECCIONAL con el estatus del prospecto
     (compatibilidad con kanban existente)
     ────────────────────────────────────────────────────────────── */

  // Se llama desde el kanban al mover una tarjeta: refleja el cambio en la Oportunidad.
  function sincronizarDesdeProspecto(personaId, nuevoEstatusProspecto){
    const o = oportunidadImplicita(personaId);
    if(!o) return;
    const estadoOpo = MAPA_COMPAT[nuevoEstatusProspecto] || nuevoEstatusProspecto;
    if(ESTADOS.includes(estadoOpo) && o.estado !== estadoOpo && o.estado !== 'Ganada'){
      transicionar(o.id, estadoOpo, `Sincronizado desde kanban: prospecto → "${nuevoEstatusProspecto}"`);
    }
  }

  return {
    ESTADOS, MAPA_COMPAT, MAPA_INVERSO,
    todas, dePersona, activasDePersona, porId, oportunidadImplicita,
    crear, transicionar, marcarGanada, marcarPerdida,
    sincronizarDesdeProspecto,
  };
})();

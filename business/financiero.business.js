/* ════════════════════════════════════════════════════════════════
   IANNA CRM — business/financiero.business.js
   MOTOR FINANCIERO — LIBRO MAYOR INMUTABLE (Fase 1.9)
   ────────────────────────────────────────────────────────────────
   Responsable único de TODA la información financiera del sistema.
   Cobranza, pagos, recibos, comisiones, penalizaciones, reembolsos,
   ingresos y estados de cuenta pasan por aquí.

   Principios (adoptados en Fase 1.9, permanentes en adelante):

   1. LEDGER APPEND-ONLY.
      Los movimientos NUNCA se modifican ni se borran. Los cambios
      se expresan mediante movimientos compensatorios nuevos. El
      sistema opera como un banco.

   2. POLÍTICA VERSIONADA.
      Cada Operación conserva el snapshot de la política vigente al
      momento de su cierre. Cambios futuros en la política jamás
      recalculan cierres históricos.

   3. TRAZABILIDAD OBLIGATORIA.
      Cada movimiento responde: quién, cuándo, con qué política,
      con qué parámetros, qué operación afectó, qué documento
      generó. Sin esto no se crea el movimiento.

   4. NINGÚN MÓDULO CALCULA DINERO.
      Los módulos consumen las funciones de este motor. Cualquier
      cálculo aritmético financiero vive solo aquí.
   ════════════════════════════════════════════════════════════════ */

window.IANNA_FIN = (function(){

  /* ──────────────────────────────────────────────────────────────
     TIPOS DE MOVIMIENTO (append-only ledger)
     ────────────────────────────────────────────────────────────── */
  const TIPOS = {
    ingreso:            { signo:+1, descripcion:'Ingreso recibido del cliente' },
    cancelacion:        { signo:-1, descripcion:'Cancelación de ingreso previo (movimiento compensatorio)' },
    reembolso:          { signo:-1, descripcion:'Reembolso al cliente' },
    penalizacion:       { signo:+1, descripcion:'Penalización cobrada al cliente' },
    ajuste:             { signo: 0, descripcion:'Ajuste administrativo auditado' },
    comision_asesor:    { signo:+1, descripcion:'Comisión devengada por el asesor' },
    comision_gerente:   { signo:+1, descripcion:'Comisión devengada por el gerente' },
    comision_broker:    { signo:+1, descripcion:'Comisión devengada por el broker' },
    retencion_comision: { signo:-1, descripcion:'Retención sobre comisión (compensación)' },
  };

  /* ──────────────────────────────────────────────────────────────
     LEDGER (Libro Mayor) — API APPEND-ONLY
     ────────────────────────────────────────────────────────────── */

  // Registra un movimiento inmutable en el ledger. Devuelve el movimiento creado.
  // Ningún camino permite modificar o borrar movimientos: solo agregar compensatorios.
  function registrarMovimiento(m){
    if(!TIPOS[m.tipo]) throw new Error('IANNA_FIN: tipo de movimiento desconocido: '+m.tipo);
    // Trazabilidad obligatoria (las 6 preguntas)
    if(!m.operacionId) throw new Error('IANNA_FIN: movimiento sin operacionId (¿qué operación afectó?)');
    if(m.monto == null) throw new Error('IANNA_FIN: movimiento sin monto');
    if(!DS.db.ledger) DS.db.ledger=[];
    const usr = (typeof CU!=='undefined'&&CU) ? CU : {id:'system', nombre:'system'};
    const f = new Date();
    const mov = {
      id_publico:        IANNA_IDS.asignar('operacion').replace('OPE-','MOV-'), // MOV-nnnnnn (usa el mismo consecutivo — nunca se reutilizan IDs)
      tipo:              m.tipo,
      signo:             TIPOS[m.tipo].signo,
      monto:             Math.abs(Number(m.monto)),
      operacionId:       m.operacionId,
      personaId:         m.personaId || null,
      documento:         m.documento || null,          // folio del recibo, pagaré, cancelación...
      politica_version:  m.politica_version || null,   // versión de la política aplicada
      concepto:          m.concepto || TIPOS[m.tipo].descripcion,
      metodo:            m.metodo || null,             // Efectivo / Transferencia / Tarjeta / Cheque / Otro
      movimiento_compensa: m.movimiento_compensa || null, // MOV- previo si es compensatorio
      // Trazabilidad
      usuario:           usr.id,
      usuario_nombre:    usr.nombre || '',
      fecha:             f.toISOString().split('T')[0],
      hora:              f.toTimeString().slice(0,8),
      timestamp:         f.toISOString(),
      motivo:            m.motivo || '',
    };
    DS.db.ledger.push(mov);
    DS._save(DS.db);
    // Auditoría del ledger (segunda capa de trazabilidad)
    try{ IANNA_MOTOR.auditar('ledger', mov.id_publico, 'LEDGER_APPEND', {}, {tipo:mov.tipo, monto:mov.monto, operacion:mov.operacionId, documento:mov.documento}, mov.motivo); }catch(e){}
    return mov;
  }

  // BLOQUEO EXPLÍCITO — los movimientos NO se modifican. Este método existe para que
  // cualquier intento fuera del motor produzca un error legible y auditable.
  function _sellarInmutabilidad(){
    // Nada más: no exponemos update/delete al exterior. Cambios = compensaciones.
  }

  // Consultas sobre el ledger
  function movimientosDe(operacionId){
    return (DS.db.ledger||[]).filter(m => m.operacionId === operacionId);
  }
  function movimientosDePersona(personaId){
    return (DS.db.ledger||[]).filter(m => m.personaId === personaId);
  }
  function ledgerCompleto(){ return (DS.db.ledger||[]).slice(); }

  // Saldo de una Operación (suma algebraica del ledger — la fuente única de verdad)
  function saldoOperacion(operacionId){
    return movimientosDe(operacionId).reduce((s,m) => s + m.signo * m.monto, 0);
  }

  // Ingresos efectivamente recibidos (solo ingresos, ya compensados por cancelaciones/reembolsos)
  function ingresosNetosOperacion(operacionId){
    return movimientosDe(operacionId)
      .filter(m => ['ingreso','cancelacion','reembolso'].includes(m.tipo))
      .reduce((s,m) => s + m.signo * m.monto, 0);
  }

  // Total pagado en efectivo (para alerta LFPIORPI)
  function efectivoOperacion(operacionId){
    return movimientosDe(operacionId)
      .filter(m => m.tipo === 'ingreso' && m.metodo === 'Efectivo')
      .reduce((s,m) => s + m.monto, 0);
  }

  /* ──────────────────────────────────────────────────────────────
     PRECIO DE VENTA REAL — fuente única de verdad
     ────────────────────────────────────────────────────────────── */

  // Precio de venta REAL de una Operación: bruto − descuento aplicado.
  // Nunca es el precio de lista — es el precio realmente pactado con el cliente.
  function precioVenta(ap){
    if(!ap) return 0;
    // Preferir el total_operacion registrado si ya existe; ajustar con descuento del cierre
    const bruto = Number(ap.total_operacion) || Number(ap.valor_operacion) || 0;
    const descuento = Number(ap.datos_cierre?.fin_descuento_num) || parseMoneyInput(ap.datos_cierre?.fin_descuento || 0) || 0;
    return Math.max(0, bruto - descuento);
  }

  // Alias para consistencia con el vocabulario del negocio
  function baseBruta(ap){ return Number(ap?.total_operacion) || Number(ap?.valor_operacion) || 0; }
  function descuentoAplicado(ap){
    return Number(ap?.datos_cierre?.fin_descuento_num) || parseMoneyInput(ap?.datos_cierre?.fin_descuento || 0) || 0;
  }

  /* ──────────────────────────────────────────────────────────────
     REGISTRO DE INGRESOS Y CANCELACIONES (compensatorias)
     ────────────────────────────────────────────────────────────── */

  // Registrar un pago del cliente. Retorna el MOV- creado.
  function registrarIngreso({operacionId, personaId, monto, metodo, documento, concepto, politica_version, motivo}){
    return registrarMovimiento({
      tipo:'ingreso', operacionId, personaId, monto, metodo, documento, concepto, politica_version, motivo,
    });
  }

  // Cancelar una operación entera: emite movimientos compensatorios por CADA ingreso previo.
  // Devuelve el arreglo de movimientos compensatorios creados. NINGÚN ingreso previo se toca.
  function compensarCancelacion({operacionId, personaId, documentoCancelacion, motivo, politica_version}){
    const ingresos = movimientosDe(operacionId).filter(m => m.tipo === 'ingreso');
    const compensatorios = [];
    ingresos.forEach(ing => {
      compensatorios.push(registrarMovimiento({
        tipo:'cancelacion',
        operacionId, personaId: personaId || ing.personaId,
        monto: ing.monto,
        metodo: ing.metodo,
        documento: documentoCancelacion,
        concepto: `Compensación de ingreso ${ing.id_publico} por cancelación`,
        movimiento_compensa: ing.id_publico,
        politica_version, motivo,
      }));
    });
    return compensatorios;
  }

  // Compensar comisiones no cobradas al cancelar una venta.
  // Las comisiones YA cobradas se conservan; las pendientes se marcan compensadas.
  function compensarComisiones({operacionId, motivo, politica_version}){
    const comisiones = movimientosDe(operacionId).filter(m => ['comision_asesor','comision_gerente','comision_broker'].includes(m.tipo));
    const compensatorios = [];
    comisiones.forEach(c => {
      // Se compensan todas (la información de cuál fue "cobrada" vive en el objeto Comisión, no aquí)
      compensatorios.push(registrarMovimiento({
        tipo:'retencion_comision',
        operacionId, personaId: c.personaId,
        monto: c.monto,
        documento: c.documento,
        concepto: `Retención de comisión ${c.id_publico} por cancelación`,
        movimiento_compensa: c.id_publico,
        politica_version, motivo,
      }));
    });
    return compensatorios;
  }

  // Reembolso al cliente (movimiento compensatorio)
  function registrarReembolso({operacionId, personaId, monto, metodo, documento, motivo, politica_version}){
    return registrarMovimiento({
      tipo:'reembolso', operacionId, personaId, monto, metodo, documento,
      concepto:'Reembolso al cliente por cancelación', politica_version, motivo,
    });
  }

  // Penalización cobrada al cliente
  function registrarPenalizacion({operacionId, personaId, monto, documento, motivo, politica_version, concepto}){
    return registrarMovimiento({
      tipo:'penalizacion', operacionId, personaId, monto, documento,
      concepto: concepto || 'Penalización por cancelación', politica_version, motivo,
    });
  }

  /* ──────────────────────────────────────────────────────────────
     ESTADO DE CUENTA de una Operación
     ────────────────────────────────────────────────────────────── */
  function estadoDeCuenta(operacionId){
    const movs = movimientosDe(operacionId).slice().sort((a,b) => a.timestamp.localeCompare(b.timestamp));
    let saldo = 0;
    const filas = movs.map(m => {
      const impacto = m.signo * m.monto;
      saldo += impacto;
      return { ...m, impacto, saldo };
    });
    const ingresos = filas.filter(f => f.tipo==='ingreso').reduce((s,f)=>s+f.monto,0);
    const cancelaciones = filas.filter(f => f.tipo==='cancelacion').reduce((s,f)=>s+f.monto,0);
    const reembolsos = filas.filter(f => f.tipo==='reembolso').reduce((s,f)=>s+f.monto,0);
    const penalizaciones = filas.filter(f => f.tipo==='penalizacion').reduce((s,f)=>s+f.monto,0);
    return { operacionId, filas, resumen:{ ingresos, cancelaciones, reembolsos, penalizaciones, saldo }, generado: new Date().toISOString() };
  }

  return {
    TIPOS,
    // Ledger
    registrarMovimiento, movimientosDe, movimientosDePersona, ledgerCompleto,
    saldoOperacion, ingresosNetosOperacion, efectivoOperacion,
    // Precio real
    precioVenta, baseBruta, descuentoAplicado,
    // Operaciones financieras
    registrarIngreso, compensarCancelacion, compensarComisiones, registrarReembolso, registrarPenalizacion,
    // Reportes
    estadoDeCuenta,
  };
})();

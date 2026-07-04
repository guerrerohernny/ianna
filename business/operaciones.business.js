/* ════════════════════════════════════════════════════════════════
   IANNA CRM — business/operaciones.business.js
   CATÁLOGO DE OPERACIONES DE NEGOCIO (Fase 1.5)
   ────────────────────────────────────────────────────────────────
   Registro central de operaciones sensibles. Las ventas NUNCA se
   editan: todo cambio es una NUEVA operación relacionada que pasa
   por sus validaciones y deja auditoría.

   estado:'activa'    → implementada y operando en el sistema.
   estado:'preparada' → validaciones listas; la ejecución llega en
                        fases futuras (la estructura ya existe).
   ════════════════════════════════════════════════════════════════ */

window.IANNA_OPERACIONES = {

  cancelacion_venta: {
    estado:'activa',
    descripcion:'Cancela una venta con contrato: resumen de consecuencias, folio de cancelación, liberación o reversión del lote, limpieza de comisiones, auditoría.',
    validar:(ap)=> ap&&ap.estatus==='Venta' ? {ok:true,errores:[]} : {ok:false,errores:['Solo puede cancelarse una operación con estatus Venta.']},
  },

  cancelacion_apartado: {
    estado:'activa',
    descripcion:'Cancela un apartado activo: consecuencias, folio, liberación del lote, auditoría.',
    validar:(ap)=> ap&&ap.estatus==='Activo' ? {ok:true,errores:[]} : {ok:false,errores:['Solo puede cancelarse un apartado Activo.']},
  },

  cambio_lote: {
    estado:'preparada',
    descripcion:'Mueve la operación de un cliente a otra vivienda: cancela+recrea vinculadas, conserva folio de expediente, recalcula precios.',
    validar:({ap, claveDestino})=>{
      const e=[];
      if(!ap||!['Activo','Venta'].includes(ap.estatus)) e.push('La operación debe estar Activa o ser una Venta.');
      const l=getLote(claveDestino);
      if(!l) e.push(`El lote destino ${claveDestino} no existe.`);
      else if(IANNA_MOTOR.operacionActivaDeLote(claveDestino)) e.push(`El lote destino ${claveDestino} ya está comprometido.`);
      return {ok:e.length===0, errores:e};
    },
    ejecutar(){ toast('Cambio de lote: flujo disponible en la siguiente fase. Por ahora: cancelación formal + nuevo apartado.','warn',6000); },
  },

  cambio_cliente: {
    estado:'preparada',
    descripcion:'Sustituye al comprador de una operación conservando la vivienda y el historial.',
    validar:({ap, nuevoProspectoId})=>{
      const e=[];
      if(!ap) e.push('Operación no encontrada.');
      if(!DS.findOne('prospectos',nuevoProspectoId)) e.push('El nuevo cliente no existe.');
      return {ok:e.length===0, errores:e};
    },
    ejecutar(){ toast('Cambio de cliente: flujo disponible en la siguiente fase.','warn',6000); },
  },

  cambio_modelo: {
    estado:'preparada',
    descripcion:'Cambia el modelo de vivienda de una operación (revalida reglas por manzana y precios).',
    validar:({ap, nuevoModeloId, claveLote})=>{
      const e=[]; const l=getLote(claveLote||ap?.clave_lote);
      if(nuevoModeloId==='MORELLO'&&l&&String(l.mz)!=='10') e.push('El modelo Morello solo se construye en la Manzana 10.');
      return {ok:e.length===0, errores:e};
    },
    ejecutar(){ toast('Cambio de modelo: flujo disponible en la siguiente fase.','warn',6000); },
  },

  cambio_asesor: {
    estado:'preparada',
    descripcion:'Reasigna el asesor de una operación/cliente y recalcula comisiones pendientes.',
    validar:({nuevoAsesorId})=> getUser(nuevoAsesorId)?.id ? {ok:true,errores:[]} : {ok:false,errores:['El asesor destino no existe.']},
    ejecutar(){ toast('Reasignación de asesor: flujo disponible en la siguiente fase.','warn',6000); },
  },

  correccion_administrativa: {
    estado:'activa',
    descripcion:'Corrección de datos del expediente de una venta (desbloqueo explícito). No altera la operación: queda auditada con antes/después.',
    validar:()=>({ok:true,errores:[]}),
  },

  liberacion_inventario: {
    estado:'preparada',
    descripcion:'Liberación controlada de viviendas (p. ej. apartados vencidos) con notificación y auditoría.',
    validar:()=>({ok:true,errores:[]}),
    ejecutar(){ toast('Liberación de inventario: flujo disponible en la siguiente fase.','warn',6000); },
  },

  transferencia: {
    estado:'preparada',
    descripcion:'Transferencia de operación entre proyectos de la desarrolladora (multi-proyecto).',
    validar:()=>({ok:true,errores:[]}),
    ejecutar(){ toast('Transferencias: flujo disponible en fases multi-proyecto.','warn',6000); },
  },
};

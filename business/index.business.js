/* ════════════════════════════════════════════════════════════════
   IANNA CRM — business/index.business.js
   REGISTRO DE REGLAS DE NEGOCIO
   ────────────────────────────────────────────────────────────────
   Carpeta /business: aquí viven las reglas de negocio del sistema,
   separadas de la interfaz y del acceso a datos.

   Residentes actuales (Fase 1, movidos intactos):
   · cancelaciones.business.js — cancelación/reversión de ventas.

   Reglas planeadas (fases futuras — estructura preparada):
   · cambios-lote.business.js       — cambio de lote de un cliente
   · cambio-cliente.business.js     — sustitución de comprador
   · reasignaciones.business.js     — reasignación de asesor/broker
   · penalizaciones.business.js     — penas convencionales (10%)
   · liberacion-inventario.business.js — liberación programada
   · comisiones.business.js         — recálculo de comisiones
   ════════════════════════════════════════════════════════════════ */

window.IANNA_BUSINESS = {
  registradas: ['motor','folios','operaciones','healthcheck','cancelaciones','estados','ids','ops-engine'],
  planeadas: ['cambios-lote','cambio-cliente','reasignaciones','penalizaciones','liberacion-inventario','comisiones'],
};

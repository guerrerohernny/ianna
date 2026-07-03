/* ════════════════════════════════════════════════════════════════
   IANNA CRM — config/app.config.js
   CONFIGURACIÓN CENTRAL DEL SISTEMA
   ────────────────────────────────────────────────────────────────
   IANNA CRM es la plataforma. Cada desarrolladora inmobiliaria es
   una IMPLEMENTACIÓN definida por esta configuración.

   FASE 1: este archivo define la configuración pero los módulos aún
   conservan sus valores originales incrustados (para garantizar cero
   cambios de comportamiento). En FASE 2, los módulos y plantillas de
   documentos se conectarán a IANNA_CONFIG, de modo que instalar el
   sistema para otra desarrolladora sea únicamente editar este archivo.

   Instalación independiente (preparado, no implementado):
   una misma versión del sistema podrá desplegarse en distintos
   servidores modificando solamente config/ (empresa, storage, API).
   ════════════════════════════════════════════════════════════════ */

window.IANNA_CONFIG = {

  // ── Plataforma ──
  app: {
    nombre: 'IANNA CRM',
    version: '1.0.0-fase1',
    fase: 'Fase 1 — Refactorización de arquitectura',
  },

  // ── Implementación actual (Fase 2: única fuente de verdad de marca) ──
  empresa: {
    id: 'valle-de-aragon',
    desarrollo: 'Valle de Aragón',
    subtitulo: 'CRM PRO · PALIZ DESARROLLOS',
    razonSocial: 'DESARROLLADORA PALIZ, S. A. DE C. V.',
    rfc: 'DPA170222RB8',
    telefono: '667 147 8576',
    domicilio: 'BLVD. FRANCISCO I. MADERO #1051 COL. CENTRO C.P. 80000, CULIACÁN, SINALOA',
    ciudad: 'Culiacán',
    estado: 'Sinaloa',
    correo: 'valledearagon@desarrolladorapaliz.com',
    apoderadoLegal: 'LIZBETH GUADALUPE ZAMUDIO RUIZ',
    logo: 'assets/img/logo.png',   // archivo editable; en runtime se usa VA_LOGO (base64) para documentos offline
  },

  // ── Cumplimiento normativo ──
  normativo: {
    umaDiaria: 117.31,             // sincronizado con parámetros (uma_diaria); actualizar cada año fiscal
    topeEfectivoUMA: 8025,         // LFPIORPI art. 32
  },

  // ── Persistencia (Fase futura: por-servidor) ──
  storage: {
    driver: 'localStorage',        // futuro: 'supabase'
    supabase: { url: '', anonKey: '' },   // se capturan hoy desde Configuración; aquí vivirán por instalación
  },

  // ── Integraciones (preparado) ──
  integraciones: {
    whatsapp: { habilitado: false, phoneNumberId: '', webhook: '' },
  },
};

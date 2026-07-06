# IANNA CRM — ROADMAP

**Documento maestro del proyecto.** No es código: es la brújula. Toda decisión de arquitectura debe ser consistente con este plan; si una implementación entra en conflicto con el roadmap, se detiene y se documenta antes de continuar.

**Última actualización:** inicio Fase 1.9 · **Estado activo:** Fase 1.9 en curso.

---

## Principios permanentes

Estos principios son innegociables. Toda fase, presente y futura, debe respetarlos:

1. **Separación de dominios estricta.** CRM, Comercial, Financiero y Administración son responsables únicos de su información. Ningún módulo cruza fronteras: consume motores.
2. **Ningún módulo es dueño de la información.** La información vive en los motores; los módulos presentan y solicitan.
3. **Toda decisión de negocio es trazable.** Quién, cuándo, con qué política, con qué parámetros, qué operación afectó, qué documentos generó. Si el sistema no responde estas seis preguntas para un cálculo, la implementación se reconsidera.
4. **Ledger inmutable.** Los movimientos financieros nunca se modifican ni se borran. Los cambios se expresan mediante movimientos compensatorios. El sistema opera como un banco, no como una hoja de cálculo.
5. **Políticas versionadas.** Cada operación conserva la versión de política con la que se cerró. Los cierres históricos jamás se recalculan al cambiar la política actual.
6. **Estabilidad sobre agresividad.** Prefiero arquitectura sólida y estable a reorganización agresiva. Si una implementación compromete el núcleo, se documenta para una fase posterior en lugar de introducir complejidad.
7. **Compatibilidad hacia atrás.** Cada fase carga los datos de las anteriores sin migración forzada. Los datos viejos siguen legibles; los nuevos usan la política vigente al momento de crearse.

---

## Vocabulario oficial

Estas tres separaciones son fundacionales y no volverán a mezclarse:

- **Persona** — el individuo. Puede empezar como Prospecto y convertirse en Cliente. Nunca cambia de identidad. Una Persona vive muchos años en el CRM.
- **Operación** — una intención o proceso comercial. Puede terminar en Venta, Cancelación, Reubicación, o no concretarse. Una Persona puede tener muchas Operaciones durante su vida.
- **Expediente** — el conjunto documental generado por una Operación. Contratos, recibos, pagarés, cobranza, auditoría — todo pertenece al Expediente de esa Operación. Un Cliente con tres compras tiene un solo expediente de identidad y tres expedientes de operación.

Ver `DOMAIN_MODEL.md` para el modelo completo.

---

## Fase 1 — Arquitectura *(completada)*

Refactorización de monolito a arquitectura modular profesional. Cero cambios funcionales; el comportamiento del sistema quedó idéntico al del archivo único original — verificado con concatenación byte-idéntica y suite de regresión. Estableció los cimientos: `/config`, `/utils`, `/components`, `/services`, `/business`, `/modules`, `/assets/css` estratificados. Capa de servicios de entidades como fachada preparada para migración a Supabase. `IANNA_CONFIG` como base para multiempresa. Responsive scaffolded en `99-responsive.css`.

---

## Fase 1.5 — Integridad *(completada)*

Motor de Reglas de Negocio central: toda operación sensible valida primero, escribe después; los bloqueos quedan auditados. Folios únicos e irrepetibles con salto de colisiones automático (bug raíz corregido: recibos y pagos ya no comparten numeración; reabrir un cierre nunca reasigna folio). Inventario protegido, unicidad de vivienda garantizada, cliente único, eliminaciones protegidas (histórico se marca Inactivo, jamás se borra). Health Check al iniciar sesión que detecta duplicados, referencias rotas e incoherencias.

---

## Fase 1.8 — Motor de Operaciones *(completada)*

Núcleo operativo con la filosofía adoptada de forma permanente: los módulos son solicitantes, el motor es el único que ejecuta procesos. Pipeline unificado (validar → máquina de estados → impacto → confirmación → ejecutar → sincronizar → auditar → historial permanente). Máquina de Estados con 12 estados (Disponible → Apartado → Contrato firmado → Enganche → Cobranza → Liquidado → Escrituración → Entregado → Postventa + Cancelado/Reubicado/Suspendido/Rescindido) ampliable sin tocar el núcleo. Identificadores permanentes (PRO, CLI, LOT, APT, VEN, CON, PAG, REC, CAN, COM, AUD, OPE, GER, ASE, BRK, PRY, EMP) con consecutivos que jamás se reutilizan. Clave física de ubicación `M###-L###`. Botón único ⚙ Operaciones sustituye acciones dispersas. Historial permanente `historial_operaciones` que nunca se elimina.

---

## Fase 1.9 — Consolidación *(en curso)*

Consolidación del núcleo operativo, comercial y financiero. Sin nuevas funcionalidades: se corrigen inconsistencias detectadas en uso real y se termina de definir el modelo de negocio de la plataforma. Cuatro nuevas piezas se documentan al mismo tiempo que se implementan:

- **Motor Financiero** con Libro Mayor inmutable (ledger append-only). Ingresos, pagos, cancelaciones, reembolsos, penalizaciones y comisiones son movimientos con `MOV-nnnnnn`. Nada se modifica ni se borra: los cambios se expresan mediante movimientos compensatorios.
- **Motor de Comisiones con política versionada.** Base comisionable configurable (qué conceptos comisionan), distribución configurable (100 %, 50/50, 20/50/30, cualquier split), penalizaciones parametrizables. Cada Operación guarda un snapshot de la política vigente al momento del cierre; los cierres históricos conservan su cálculo original aunque la política actual cambie.
- **Motor de Formatos único.** `MXN`, `M2` (siempre 3 decimales para no distorsionar valor por m²), `TEL`, `PCT`, `NUM_A_LETRAS` (corrige el "undefined" en montos de millones), `FOLIO`. Todo el sistema consume aquí.
- **Pipeline Comercial como vista.** Kanban deja de ser módulo independiente; representa el Pipeline sincronizado bidireccionalmente con las fichas. Mover una tarjeta y editar la ficha pasan por el mismo Motor de Operaciones — los estados nunca divergen.

Además: pagarés con folio propio (cada uno un documento independiente reimprimible), parámetros reorganizados en 8 pestañas (Empresa, Comercial, Inventario, Financiero, Documentos, Usuarios, Integraciones, Sistema), auditoría financiera que responde las seis preguntas de trazabilidad.

**Criterio de éxito:** el sistema mantiene consistencia desde cualquier punto de entrada; las 54 pruebas existentes siguen verdes; nuevas pruebas cubren sincronización pipeline↔ficha, cliente con múltiples operaciones, folios únicos de pagarés, cálculo de comisiones con descuento y con base configurable, cancelaciones financieras, ledger inmutable, integridad documental e integridad de IDs permanentes; y hay E2E por rol (asesor, gerente, administrador).

---

## Fase 2 — Multiempresa

**Objetivo:** IANNA CRM deja de ser una instalación por desarrolladora. Una misma instancia atiende múltiples desarrolladoras y proyectos, con jerarquías de usuarios y aislamiento estricto entre organizaciones. Nadie de una empresa ve datos de otra.

**Alcance previsto:**
- Entidad **Empresa** (`EMP-`) y **Proyecto** (`PRY-`) como raíces del modelo. Todas las entidades cuelgan de un proyecto; todos los proyectos cuelgan de una empresa.
- Selector de empresa/proyecto en el shell; el resto del sistema opera transparente.
- Jerarquía de usuarios: Administrador de plataforma, Administrador de empresa, Gerente de proyecto, Asesor, Broker externo. Roles con permisos configurables.
- Configuración por empresa (marca, datos legales, políticas comerciales, plantillas de documentos). `IANNA_CONFIG.empresa` deja de ser constante — se carga por empresa activa.
- Plantillas de contratos y documentos por empresa (hoy están hard-coded para PALIZ).
- Reportes agregados a nivel empresa y desagregados por proyecto.
- Auditoría particionada por empresa; el health check corre por empresa.
- Migración transparente: la instalación actual de Valle de Aragón se convierte en la empresa "PALIZ Desarrollos" con su proyecto "Valle de Aragón". Ningún dato existente se pierde.

**Requisito de arquitectura:** los motores actuales ya reciben el `IANNA_CONFIG` en runtime, no en carga. Este trabajo confirma que fue una buena decisión de Fase 1.

---

## Fase 3 — Supabase

**Objetivo:** persistencia real, sincronización en tiempo real, respaldos, autenticación robusta y trabajo simultáneo entre asesores.

**Alcance previsto:**
- Backend Supabase con Row-Level Security por empresa y por rol.
- El `DataStore` (hoy `localStorage`) migra a un servicio que envuelve Postgres; los módulos no notan la diferencia porque desde Fase 1 consumen `services/entidades.service.js`, no localStorage directo. Esta migración se planeó desde el inicio.
- Sincronización en tiempo real: cuando un asesor modifica una operación, el gerente ve el cambio sin refrescar.
- Ledger financiero persiste en tabla dedicada con constraint de append-only a nivel de base de datos.
- Auditoría a tabla dedicada, particionada por fecha, retenida por política de la empresa.
- Autenticación real (email + OTP o SSO); JWT en cada request.
- Respaldos automáticos y punto-en-tiempo restore.
- Modo offline: el sistema sigue funcionando sin red y sincroniza al recuperar conexión (el cache local es la ventaja de haber empezado con localStorage — la ruta offline-first sigue siendo la misma).

**Riesgo consciente:** migración de datos. Cada empresa que ya opera con localStorage tiene un export/import automático a Supabase la primera vez que activa la conexión.

---

## Fase 4 — Aplicación móvil

**Objetivo:** el asesor trabaja desde el celular; el gerente aprueba desde el celular; el cliente firma desde el celular.

**Alcance previsto:**
- App nativa (Capacitor o React Native — decisión al inicio de la fase). El backend es el mismo Supabase de Fase 3.
- Pantallas nativas para: cotización rápida en visita, alta de prospecto con foto + WhatsApp, captura de pago con recibo firmado en pantalla, agenda con geolocalización de citas, notificaciones push.
- Firma electrónica del comprador en documentos (recibos, cartas). La firma se almacena en el expediente con timestamp e IP.
- Cámara para adjuntar identificación oficial, comprobantes de domicilio y de ingresos al expediente digital.
- WhatsApp CRM real (Cloud API) integrado al flujo — hoy la simulación queda intacta como base.
- Modo offline robusto (asesores en zonas de baja cobertura) sincronizando en cuanto hay red.

**Prerequisito:** Fase 3 completada.

---

## Fase 5 — IA y automatizaciones

**Objetivo:** IANNA CRM deja de ser un sistema pasivo y empieza a proponer. La IA no reemplaza al asesor; le da superpoderes.

**Alcance previsto:**
- **Scoring predictivo de prospectos.** El sistema aprende del histórico qué combinación de origen, comportamiento y perfil convierte mejor, y ordena el pipeline por probabilidad de cierre.
- **Recomendador de lote.** Dado el presupuesto, plazo y preferencias de un prospecto, sugiere el lote/modelo con mejor ajuste, considerando inventario vivo y precios actuales.
- **Detección de riesgo de cancelación.** El sistema alerta al gerente cuando una venta muestra patrones históricos de cancelación (pagos atrasados, cambios de contacto, silencio prolongado).
- **Asistente conversacional para asesor.** Preguntas en lenguaje natural sobre inventario, cliente o comisión resueltas al instante con respuesta trazable (siempre citando la operación/movimiento que respalda la respuesta — el principio de trazabilidad se conserva incluso en IA).
- **Automatizaciones no-code.** Reglas configurables: "si un apartado lleva 15 días sin pago, avisar al asesor y al gerente"; "si un prospecto responde por WhatsApp fuera de horario, agendar seguimiento al día siguiente 10 AM". El motor de reglas de negocio existente ya es la base natural para esto.
- **Análisis de conversaciones de WhatsApp** para clasificar interés, extraer objeciones y sugerir siguiente acción.
- **Redacción asistida** de mensajes de seguimiento con contexto del expediente.

**Requisito de arquitectura:** todo lo que la IA proponga debe pasar por el mismo Motor de Operaciones y quedar auditado con la fuente "IA — modelo X versión Y" además del usuario que aprobó la acción. Ninguna acción se ejecuta automáticamente sin registro. La trazabilidad es innegociable.

---

## Fases posteriores (visión, sin fecha)

- **Marketplace de plantillas** de contratos, cartas y flujos por tipo de proyecto (vertical, horizontal, industrial, comercial), curados por IANNA.
- **Portal del cliente** para consultar su expediente, pagar, agendar visitas y firmar documentos.
- **Integración notarial y bancaria** (avalúos, créditos hipotecarios, verificación de identidad, factura electrónica CFDI 4.0).
- **Módulo de posventa** con tickets, garantías y satisfacción.
- **Business Intelligence** con dashboards ejecutivos por empresa y benchmarking anónimo entre desarrolladoras.

Cada nueva fase debe justificarse contra los principios permanentes. Si una funcionalidad no puede respetarlos, se rediseña.

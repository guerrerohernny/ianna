# IANNA CRM — Arquitectura (Fase 1)

**IANNA CRM** es la plataforma. **Valle de Aragón** es su primera implementación.

Esta fase es exclusivamente de refactorización: el sistema funciona **exactamente igual** que antes. El único cambio es la estructura interna. Garantía técnica: la concatenación de los archivos JS y CSS en su orden de carga es **byte-idéntica** al código del archivo único original — mismo programa, distinta organización — verificado además con 34 pruebas automatizadas y pruebas end-to-end en navegador real.

---

## Estructura del proyecto

```
/index.html                  Markup completo de la aplicación (vistas y modales, intacto)
/vercel.json                 Configuración de despliegue (sirve archivos estáticos)

/config/                     CONFIGURACIÓN
  app.config.js              IANNA_CONFIG: plataforma, empresa, normativo, storage, integraciones
  empresa.config.js          Constantes de la implementación (formas de pago, etc.)
  seed.data.js               Datos maestros semilla (inventario, modelos, parámetros)
  app.state.js               Estado global de sesión

/utils/                      UTILIDADES
  utils.js                   Helpers puros: moneda, fechas, teléfonos, selectores

/components/                 COMPONENTES REUTILIZABLES
  feedback.components.js     Toast y modales
  badges.components.js       Badges de estatus, score, selects, alertas

/services/                   ACCESO A DATOS
  dataStore.service.js       DS: capa única de persistencia (localStorage)
  entidades.service.js       prospectosService, inventarioService, apartadosService,
                             usuariosService, brokersService, pagosService, parametrosService
  expediente.service.js      Snapshots inmutables y registro de documentos
  supabase.service.js        Esquema SQL y conexión (sincronización: fase futura)

/business/                   REGLAS DE NEGOCIO
  index.business.js          Registro de reglas (actuales y planeadas)
  cancelaciones.business.js  Cancelación/reversión de ventas (primer residente)

/modules/                    MÓDULOS (uno por pantalla, independientes)
  auth, navigation, dashboard, prospectos, inventario, apartados,
  ingresos, reportes, parametros, perfil, configuracion, importar,
  whatsapp, cotizador, cierre, cierre-acciones, cobranza, documentos,
  brokers, auditoria

/assets/
  css/  01-base · 02-layout · 03-components · 04-modules · 99-responsive
  img/  logo.png (editable)
  js/   logo.asset.js (base64 para documentos offline)

/app.init.js                 Arranque de la aplicación
```

## Decisiones de diseño (Fase 1)

- **Scripts clásicos en orden, no ES Modules.** Toda la app usa funciones globales (handlers `onclick` en el markup). Los scripts clásicos preservan ese contrato al 100%, funcionan tanto en Vercel como abriendo `index.html` con doble clic, y eliminan cualquier riesgo de romper handlers. La migración a módulos ES puede hacerse en una fase posterior, módulo por módulo.
- **Corte por responsabilidad preservando el orden de ejecución.** Cada archivo es un segmento íntegro del programa original; el orden de carga reproduce el orden original. Cero reordenamientos = cero cambios de comportamiento.
- **Capa de servicios en modo fachada.** Los servicios de entidades ya existen y encapsulan a DS; los módulos actuales siguen llamando a DS directamente (intacto). En Fase 2 los módulos migran a servicios y cambiar el backend (localStorage → Supabase) será transparente.
- **Configuración lista para multiempresa e instalación independiente.** `IANNA_CONFIG` centraliza marca, datos legales, normativo (UMA/LFPIORPI), storage e integraciones. En Fase 2 las plantillas de documentos y la UI leerán de aquí; instalar el sistema para otra desarrolladora será editar `/config`.
- **Responsive preparado.** `99-responsive.css` carga al final (gana la cascada) con los breakpoints del proyecto documentados; las correcciones por dispositivo de la Fase 2 se escriben ahí sin tocar los estilos base.
- **HTML íntegro en index.html.** Separar el markup en parciales requiere un sistema de build o inyección por fetch (rompe file:// y agrega complejidad sin beneficio en esta fase).

## Cómo agregar un módulo nuevo (Fase 2+)

1. Crear `modules/nuevo.module.js` con su `renderNuevo()`.
2. Agregar su `<div class="page" id="page-nuevo">` en `index.html` y su entrada en el sidebar.
3. Registrar la ruta en `modules/navigation.module.js` (mapa `R`).
4. Enlazar el script en `index.html` (después de sus dependencias).
Los módulos no se llaman entre sí directamente: se comunican vía servicios y render propio.

## Despliegue

Vercel sirve el directorio tal cual (`vercel.json` con `handle: filesystem`). Subir el contenido completo del proyecto al repositorio; no se requiere build.

## Fase 1.5 — Integridad de datos, motor de reglas y seguridad operativa

Sobre la arquitectura de la Fase 1 se añadió la capa de integridad. Principio rector: **es imposible generar información inconsistente por accidente**; toda operación sensible pasa por el motor antes de ejecutarse, y si una regla falla, la operación se cancela completa (validar primero, escribir después) y el intento queda auditado.

**Componentes nuevos en `/business`:**
- `motor.business.js` — `IANNA_MOTOR`: validaciones centralizadas (unicidad de vivienda, conversión a venta, cliente único, protección de inventario, eliminaciones protegidas), auditoría automática (usuario, fecha, acción, antes, después, motivo) y bloqueos con mensaje explicativo + registro del intento.
- `folios.business.js` — `IANNA_FOLIOS`: fuente única de folios para TODOS los documentos (recibos, pagos, cancelaciones y futuros). `peek()` consulta sin consumir (vistas previas); `emitir()` asigna en firme escaneando todas las fuentes, salta colisiones automáticamente y registra cada emisión (`folios_registro` + consecutivo persistente `folio_seq`). **Corrige el bug raíz detectado:** el generador anterior solo veía recibos de apartado (los pagos de cobranza colisionaban) y reabrir un cierre reasignaba folio; ahora el folio de un documento emitido jamás cambia.
- `operaciones.business.js` — `IANNA_OPERACIONES`: catálogo central. Activas: cancelación de venta/apartado, corrección administrativa. Preparadas con validaciones reales (ejecución en fases futuras): cambio de lote, cambio de cliente, cambio de modelo, cambio de asesor, liberación de inventario, transferencias.
- `healthcheck.business.js` — `IANNA_HEALTH`: verificación automática al iniciar sesión (gerente/administrador) y bajo demanda en Configuración → 🩺. Revisa: folios duplicados, dos operaciones activas sobre la misma vivienda, coherencia lote↔operación, referencias rotas (prospecto/lote/modelo/asesor inexistentes), pagos sin folio, ventas sin total, expedientes duplicados por teléfono y fracciones huérfanas.

**Reglas aplicadas en los módulos (las ventas no se editan; todo cambio es una operación relacionada):**
- Inventario protegido: un lote con venta o apartado activo no se edita ni elimina; un lote Disponible con historial tampoco se elimina.
- Apartados: unicidad validada al crear/editar; conversión a venta validada (jamás doble venta); edición bloqueada fuera de estatus Activo.
- Cancelaciones: resumen completo de consecuencias antes de confirmar, registro formal en `cancelaciones` con folio único propio y auditoría antes/después.
- Cliente único: alta bloqueada si el teléfono/correo ya pertenece a otro expediente.
- Eliminaciones protegidas: prospecto con historial → estatus Inactivo; asesor con historial → desactivado; modelo en uso → desactivado. Solo lo que no tiene relaciones se elimina físicamente (auditado).
- Corrección administrativa: desbloquear/guardar sobre una venta queda auditado con antes/después.
- `uid()` reforzado (timestamp + aleatorio): identificadores permanentes a prueba de colisiones.

## Fase 1.8 — Motor de Operaciones, Máquina de Estados e Identificadores Permanentes

Sobre las Fases 1 y 1.5 se construye el **núcleo operativo**. Filosofía de arquitectura adoptada de forma permanente:

> **Ningún módulo es dueño de la información.** Los módulos presentan información y **solicitan operaciones**; el Motor de Operaciones es el único autorizado a modificar información crítica, siempre bajo el mismo pipeline: reglas de negocio → máquina de estados → impacto → confirmación → ejecución → sincronización → auditoría → historial permanente.

**Componentes nuevos en `/business`:**
- `estados.business.js` — `IANNA_ESTADOS`: máquina de estados con 12 estados (Disponible → Apartado → Contrato firmado → Enganche → Cobranza → Liquidado → Escrituración → Entregado → Postventa, más Cancelado, Reubicado, Suspendido y Rescindido). Cada uno declara **desde**, **hacia**, **operaciones permitidas**, **prohibidas**, **documentos exigidos** y **módulos a refrescar**. Ampliable con `registrar(nombre, def)` sin tocar el núcleo. `estadoDe(ap)` mapea los estatus internos existentes a estados de la máquina, preservando compatibilidad total con la data actual.
- `ids.business.js` — `IANNA_IDS`: identificadores permanentes (PRO-, CLI-, LOT-, APT-, VEN-, PAG-, REC-, CON-, CAN-, COM-, AUD-, OPE-, GER-, ASE-, BRK-, PRY-, EMP-) con consecutivos persistentes que **jamás se reutilizan**. La migración inicial asigna IDs y **clave física de ubicación** `M###-L###` a todo lo existente, una única vez, auditada. Los nuevos registros reciben su ID al crearse desde el motor.
- `ops-engine.business.js` — `IANNA_OPS` (motor), `IANNA_SYNC` (sincronización central de módulos) y `IANNA_HISTORIAL` (historial permanente de operaciones, con su propio ID OPE- y sin borrado automático). El motor implementa el pipeline unificado y expone `catalogoPara(ap)`, que alimenta el modal **⚙ Operaciones**.

**Inversión de módulos a solicitantes.** Las funciones públicas de la UI (`convertirVenta`, `cancelarVenta`, `cancelarApartadoModal`) siguen existiendo — no cambian handlers ni firmas — pero ahora son **una línea**: piden la operación al motor. Los cuerpos originales quedaron renombrados a `_ejecutarContratoFirmado`, `_ejecutarCancelacionVenta`, `_ejecutarCancelacionApartado` (ejecutores puros que solo escriben; las validaciones, consecuencias y confirmaciones las hace el motor, una sola vez). El botón único **⚙ Operaciones** en Apartados abre el modal con las acciones permitidas por la máquina de estados para el registro actual — incluidas las operaciones futuras (cambio de lote/modelo/cliente/asesor, transferencia) visibles pero marcadas como "próxima fase".

**Sincronización.** `IANNA_SYNC.refrescar([modulos])` es la única ruta que refresca UI tras una operación; cada estado declara qué módulos toca (inventario, apartados, ingresos, cobranza, dashboard, reportes, auditoría). Los módulos no se llaman entre sí.

**Historial permanente.** Toda operación queda en `historial_operaciones` con: id OPE-, tipo, registro afectado, id público, usuario, fecha, hora, estado anterior, estado nuevo, motivo, resultado (ok/bloqueada/cancelada por el usuario/error) y detalle. Nunca se elimina.

**Decisiones conscientes documentadas (estabilidad > agresividad):**
- Los estados posteriores a "Contrato firmado" (Enganche, Cobranza, Liquidado, Escrituración, Entregado, Postventa) están **declarados y transitables por el motor**, pero ningún flujo comercial los recorre aún: llegan en fases futuras sin modificar este núcleo.
- Las operaciones futuras (`cambio_lote`, `cambio_modelo`, `cambio_cliente`, `cambio_asesor`, `transferencia`) están **registradas en `IANNA_OPERACIONES` con validaciones reales**, expuestas en ⚙ Operaciones y bloqueadas de ejecución con toast informativo. La UX está lista para la Fase 2 sin deuda de arquitectura.
- El estatus interno de los registros (`estatus:'Activo'|'Venta'|…`) se conserva porque toda la base de datos existente lo referencia; la máquina lo interpreta vía `estadoDe(ap)`. Migrarlo a `estado_maquina` directo sería un cambio mecánico posterior sin implicaciones lógicas.
- El historial se persiste íntegro en `localStorage` en esta fase; su migración a un almacén dedicado llega junto con Supabase (Fase multi-empresa).

## Fase 1.9 — Consolidación del núcleo operativo, comercial y financiero

Esta fase corrige inconsistencias detectadas en uso real y termina de definir el modelo de negocio de la plataforma. Adopta como principios permanentes el ledger inmutable, la política versionada y la trazabilidad obligatoria (6 preguntas). Ver `ROADMAP.md` y `DOMAIN_MODEL.md` — actualizados como referencia oficial.

**Nuevos motores en `/business` y `/utils`:**
- `utils/formatos.util.js` — `IANNA_FMT`: **motor de formatos único**. MXN, M2 (siempre 3 decimales), TEL, PCT, FOLIO, NUM_A_LETRAS. Corrige el bug del `undefined` en montos de millones. Verificado hasta 999,999,999,999 pesos. Alias de compatibilidad para `numToLetras`.
- `business/financiero.business.js` — `IANNA_FIN`: **Libro Mayor inmutable (append-only)**. Movimientos con `MOV-nnnnnn` permanentes, jamás modificables. Los cambios se expresan mediante movimientos compensatorios (cancelación, reembolso, retención de comisión). Trazabilidad obligatoria: cada movimiento responde las 6 preguntas.
- `business/comisiones.business.js` — `IANNA_COM`: **política comercial versionada**. Base comisionable configurable (gastos administrativos excluidos por default), descuentos aplicados a la base, distribución configurable, penalizaciones parametrizables. Cada Operación conserva **snapshot inmutable** de la política vigente al firmarse — los cierres históricos jamás se recalculan.
- `business/oportunidades.business.js` — `IANNA_OPO`: **motor de Oportunidades**. Una Persona puede tener múltiples Oportunidades activas simultáneas (incluso en distintos Proyectos). Al ganarse, la Oportunidad genera una Operación y queda enlazada permanentemente. Sincronización bidireccional automática con el kanban existente (compatibilidad total sin migración forzada).

**Integraciones transversales:**
- La operación `contrato_firmado` ahora **congela la política**, **congela los pagarés con folio único por cada uno** (id permanente REC-, estado, historial), **devenga comisiones en el ledger** y **registra el ingreso del apartado**.
- Cobranza registra pagos en el ledger inmutable.
- Cancelaciones emiten movimientos compensatorios de ingresos y comisiones (nada se borra), aplicando la penalización según la política snapshot de la Operación.
- Kanban existente conecta automáticamente al motor de Oportunidades: mover una tarjeta sincroniza la Oportunidad; convertir a venta la marca Ganada.

**Nueva UI:**
- Sección "Política Comercial (versionada)" en Parámetros: base comisionable con checkboxes por concepto, porcentajes por rol, distribución configurable con validación de suma 100%, penalizaciones. Cada guardado incrementa la versión (v1 → v2 → v3…) y conserva historial.

**Decisiones documentadas de esta fase (estabilidad > agresividad):**

- **La reorganización visual de Parámetros en 8 pestañas se pospone a una iteración menor.** Se añadió la sección crítica de Política Comercial versionada — indispensable para el motor. La reagrupación por pestañas Empresa/Comercial/Inventario/Financiero/Documentos/Usuarios/Integraciones/Sistema es cosmética y no bloqueante; introducirla ahora aumentaba superficie de UI sin beneficio funcional en esta fase.
- **Oportunidad como capa aditiva compatible.** No se reescribe el kanban; se conecta al motor de Oportunidades por debajo. Cada prospecto obtiene una Oportunidad implícita al primer movimiento en el kanban. Esta estrategia respeta la compatibilidad total con datos existentes y permite migrar la UI del pipeline a "una tarjeta por Oportunidad" en una fase futura sin urgencia.
- **Migración de comisiones históricas: NO se recalculan.** Las ventas cerradas antes de esta fase mantienen su cálculo original. La política snapshot congelada garantiza que los cierres nuevos usan la política actual y los antiguos su política de la época — como si fueran contratos firmados en su momento.
- **IDs MOV- comparten el consecutivo persistente con OPE- (mismo pool numérico).** Simplificación consciente: ambos son eventos permanentes del sistema, un pool único evita fragmentación. La distinción de prefijo mantiene la claridad visual (MOV-000042 vs OPE-000042 son entidades distintas aunque compartan número — el prefijo es identificador de tipo).
- **Descuento aplicado a la base comisionable: configurable, default ON.** El default correcto por consultoría inmobiliaria es aplicar descuento (no comisionar sobre precio de lista). La política permite desactivarlo si la empresa lo requiere.

**Cobertura de pruebas (67/67 verdes):** 21 base + 24 Fase 1.5 + 9 Fase 1.8 + 13 Fase 1.9 nuevas cubren formatos, ledger inmutable, compensación, política versionada, snapshot inmutable en la Operación, devengo automático al firmar, pagarés con folio único, sincronización kanban↔Oportunidad, Persona con múltiples Oportunidades, guardado de política con incremento de versión. **E2E integral en Chromium** por rol (gerente y asesor) sin un solo error de consola.

## Pendientes explícitos para Fase 2 (decisión consciente: estabilidad > agresividad)

- Migrar llamadas `DS.*` de los módulos a los servicios de entidades.
- Conectar plantillas de documentos a `IANNA_CONFIG.empresa` (hoy conservan sus textos originales para garantizar salida idéntica).
- Renombrados de funciones y deduplicación fina (hacerlos junto con pruebas por módulo).
- Responsive real por dispositivo en `99-responsive.css`.

# IANNA CRM — DOMAIN MODEL

**Referencia oficial del modelo de negocio.** Este documento define las entidades del sistema, sus responsabilidades y sus relaciones. Cualquier código, refactor o nueva funcionalidad debe consultar y respetar este modelo. Cuando el modelo cambie, este documento se actualiza **antes** que el código.

Modelo activo desde Fase 1.9.

---

## Los cuatro conceptos fundacionales

Estas cuatro separaciones son el eje del modelo y **nunca vuelven a mezclarse**:

### Persona

- El individuo. Identidad real, humana.
- Puede empezar como **Prospecto** (`PRO-`) y convertirse en **Cliente** (`CLI-`) cuando cierra una venta.
- Una Persona **jamás cambia de identidad**. El mismo Prospecto que compró hace tres años sigue siendo la misma Persona.
- Vive muchos años en el CRM. Recibe seguimiento aunque ya sea Cliente (recompras futuras, referidos, mantenimiento de relación).
- **Nunca se duplica.** El mismo teléfono o correo pertenece a una única Persona, aunque compre en tres proyectos distintos.

### Oportunidad

- Una **intención comercial** que aún no se ha formalizado. `OPO-nnnnnn`.
- Se sitúa entre Persona y Operación: la Persona muestra interés en un Proyecto y un Lote/modelo, se le da seguimiento, se cotiza, se negocia — todo esto es la Oportunidad. Cuando finalmente firma un apartado, la Oportunidad se cierra como Ganada y **genera** una Operación formal.
- Una Persona puede tener **muchas Oportunidades simultáneas**, incluso en Proyectos distintos. Un Cliente que ya compró puede tener Oportunidades activas nuevas.
- Sus estados son propios del pipeline comercial (Nueva, Contactada, Cita agendada, Visitó, Cotización, Negociando, Ganada, Perdida, En pausa) y no se confunden con los estados de una Operación (Apartado, Contrato firmado, Escrituración…).

### Operación

- Una intención o proceso comercial **formalizada**. `APT-nnnnnn` (apartado) y `VEN-nnnnnn` (venta) cuando se firma.
- Puede terminar en: **venta cerrada, cancelación, reubicación** o **no concretarse**.
- Una Persona puede tener **muchas Operaciones** durante su vida. Cada compra es una Operación independiente que **hereda al Cliente**, no lo reinventa.
- Cada Operación conserva el snapshot de la política comercial vigente al momento de su cierre; los cambios de política futuros no la afectan.

### Oportunidad (`OPO-nnnnnn`)

- **Intención comercial** que aún no se ha convertido en Operación formal (apartado o venta).
- Se ubica entre **Persona** y **Operación** en el pipeline: representa el interés real de una Persona en un Proyecto y un Lote/modelo específico, con seguimiento comercial vivo pero sin compromiso financiero todavía.
- Una Persona puede tener **múltiples Oportunidades activas** simultáneamente, incluso en distintos Proyectos (por ejemplo, un Cliente que ya compró una residencia y hoy evalúa una segunda propiedad en preventa de playa).
- Ciclo de vida propio (independiente de la Operación):
  - **Nueva** → **Contactada** → **Cita agendada** → **Visitó desarrollo** → **Cotización enviada** → **Negociando** → *(desenlace)*
  - Desenlaces posibles: **Ganada** (genera Operación formal `APT-` y el pipeline muestra la conversión), **Perdida** (con motivo: precio, ubicación, no le alcanza, se fue con competencia…), **En pausa** (seguimiento a largo plazo).
- **Cada Oportunidad conserva su historial completo** aunque termine perdida — es información comercial valiosa para reintentos futuros, campañas, análisis de tasa de conversión y aprendizaje.

**Campos clave:** `id_publico` (OPO-), `personaId` (siempre — Prospecto o Cliente), `proyectoId`, `clave_lote_interes` (opcional — el Lote específico de interés), `modelo_id_interes` (opcional), `presupuesto`, `plazo_estimado`, `origen`, `estado` (Nueva, Contactada, Cita agendada, Visitó desarrollo, Cotización enviada, Negociando, Ganada, Perdida, En pausa), `motivo_perdida` (si aplica), `asesor_asignado`, `broker_id` (si aplica), `score` (calidad del lead), `probabilidad_cierre`, `fecha_creacion`, `fecha_ultimo_contacto`, `operacionId` (si Ganada, referencia a la Operación que generó).

**Reglas:**
- Una Oportunidad Ganada **jamás elimina la Oportunidad**: se conserva como registro histórico y se enlaza a la Operación que generó (`operacionId`). El expediente comercial de la Persona muestra ambos.
- Una Persona puede tener Oportunidades ganadas del pasado + Oportunidades activas nuevas en paralelo. Ambas coexisten en el pipeline.
- Perder una Oportunidad **no cierra el vínculo con la Persona**: la Persona sigue en el CRM, disponible para nuevas Oportunidades futuras.
- Las Oportunidades no tocan el Motor Financiero: no generan movimientos hasta convertirse en Operación (al firmar apartado).
- El seguimiento (recordatorios, WhatsApp, campañas) puede vincularse tanto a la Persona como a una Oportunidad específica.

**Dominio propietario:** Comercial (estado, transiciones, conversión) + CRM (seguimiento diario, comunicación).

### Expediente

- El conjunto documental generado por **una** Operación.
- Contratos, recibos, pagarés, cobranza, cartas, auditoría, historial: todo pertenece al Expediente de esa Operación.
- Un Cliente con tres compras tiene **una identidad de Cliente** y **tres Expedientes** (uno por Operación).
- El Expediente sobrevive a la Operación: aunque la venta se cancele, el Expediente se conserva íntegro con la cancelación como movimiento compensatorio.

---

## Sobre el Pipeline Comercial

El Pipeline Comercial es una **representación visual del estado de las Oportunidades**, no de las Personas. Cada tarjeta en el kanban es una Oportunidad concreta con su Persona, su Proyecto de interés y su estado actual. Una Persona con dos intereses activos (por ejemplo, "Juan Pérez interesado en Valle de Aragón" y "Juan Pérez interesado en Playa Norte") aparece **dos veces** en el pipeline — una tarjeta por Oportunidad. Esto refleja la realidad comercial: cada intención se gestiona por separado, aunque el Cliente sea el mismo.

Mover una tarjeta en el pipeline **es una operación** sobre la Oportunidad y pasa por el Motor de Operaciones (validaciones, auditoría, sincronización con la ficha de la Persona). La ficha de la Persona muestra todas sus Oportunidades activas y ganadas; editar el estado desde la ficha actualiza la tarjeta del pipeline automáticamente. Los dos flujos comparten motor: **jamás divergen**.

Cuando una Oportunidad se marca como Ganada, el motor abre el asistente de creación de Apartado (mismo flujo que desde Inventario). Al confirmar, se crea la Operación y se enlaza a la Oportunidad. Si el usuario cancela el asistente, la Oportunidad queda en su estado previo — no hay cambio silencioso.

## Diagrama de relaciones

```
                          ┌────────────────────┐
                          │      Persona       │
                          │  PRO-nnnnnn        │
                          │  (Prospecto/       │
                          │   Cliente)         │
                          └──────────┬─────────┘
                                     │  1..*
                                     │  (una Persona puede tener
                                     ▼   muchas Oportunidades)
                          ┌────────────────────┐
                          │    Oportunidad     │  ← Pipeline Comercial
                          │  OPO-nnnnnn        │    administra el estado
                          │  (intención sin    │    de la Oportunidad
                          │   compromiso)      │    (Persona × Proyecto)
                          └──────────┬─────────┘
                                     │  0..1  (al Ganarse)
                                     ▼
                          ┌────────────────────┐         ┌────────────────────┐
                          │     Operación      │◄────────│      Lote          │
                          │  APT-nnnnnn        │  1 ..1  │  LOT-nnnnnn        │
                          │  VEN-nnnnnn        │         │  M###-L###         │
                          │  CON-nnnnnn        │         └────────┬───────────┘
                          └──────────┬─────────┘                  │
                                     │                            │  N ..1
                                     │  1..1                      ▼
                                     ▼                    ┌──────────────┐
                          ┌────────────────────┐          │   Proyecto   │
                          │    Expediente      │          │  PRY-nnnnnn  │
                          │  (contratos, pagos,│          └──────┬───────┘
                          │  recibos, cartas,  │                 │  N ..1
                          │  auditoría)        │                 ▼
                          └──────────┬─────────┘          ┌──────────────┐
                                     │                    │   Empresa    │
                                     │  1..*              │  EMP-nnnnnn  │
                                     ▼                    └──────────────┘
                          ┌────────────────────┐
                          │  Movimiento        │
                          │  Financiero        │
                          │  MOV-nnnnnn        │
                          │  (Libro Mayor      │
                          │   inmutable)       │
                          └────────────────────┘

Al cerrar la primera venta:
   Persona(PRO-x) → adquiere identidad CLI-y (permanente)
   Se genera la Operación (VEN-z, CON-w)
   El Expediente queda anclado a la Operación

Recompras:
   La misma Persona (CLI-y) genera nuevas Operaciones (VEN-z2, VEN-z3...)
   Cada una con su propio Expediente
   Nunca se crea CLI-y2 para la misma Persona
```

---

## Entidades

### Prospecto (`PRO-nnnnnn`)

Origen comercial de una Persona. Es la Persona en su etapa inicial.

**Campos clave:** `id_publico`, `nombre`, `telefono`, `correo`, `estatus` (Nuevo, Contactado, Cita agendada, …), `asesor`, `fuente`, `presupuesto`, `fechaRegistro`.

**Reglas:** unicidad por teléfono y por correo (una Persona = un expediente). Al inactivarse conserva su historial y estatus se marca `Inactivo`. La eliminación física solo es posible si no tiene operaciones ni seguimientos.

**Dominio propietario:** CRM.

### Cliente (`CLI-nnnnnn`)

Persona que ya cerró al menos una Operación. Es el mismo `id_publico` PRO- de siempre, más un `id_cliente` CLI- adicional que no reemplaza al primero — lo **añade**.

**Reglas:** un Cliente jamás se duplica. Si una Persona con `CLI-y` inicia una nueva Operación, se reutiliza. Un Cliente sigue participando del pipeline comercial: puede recibir seguimiento, campañas, agendarse, incluso volver a ser lead sobre otro proyecto. **Ser Cliente no lo saca del CRM.**

**Dominio propietario:** CRM (identidad) + Comercial (participación en pipeline).

### Operación (`APT-nnnnnn`, `VEN-nnnnnn`)

Un proceso comercial completo sobre una vivienda. Es la unidad de trabajo del sistema.

**Ciclo de vida (Máquina de Estados):** Disponible → **Apartado** → Contrato firmado → Enganche → Cobranza → Liquidado → Escrituración → Entregado → Postventa. Estados especiales: Cancelado, Reubicado, Suspendido, Rescindido.

**Campos clave:** `id_publico` (APT-), `id_venta` (VEN-, al firmar contrato), `id_contrato` (CON-, al generar cierre), `prospectoId`, `clave_lote`, `clave_lote_adicional`, `modelo_id`, `asesor`, `broker_id`, `estatus`, `estado_maquina`, `total_operacion`, `pagos[]`, `datos_cierre`, `doc_snapshot`, `politica_snapshot` (Fase 1.9).

**Reglas:** una vivienda jamás tiene dos Operaciones activas simultáneas. Una Operación en Venta no se edita — todo cambio es una nueva Operación relacionada o una corrección administrativa auditada. Cancelar no borra: genera movimientos compensatorios.

**Dominio propietario:** Comercial.

### Proyecto (`PRY-nnnnnn`)

El desarrollo inmobiliario que agrupa lotes, modelos y parámetros. Ejemplo: "Valle de Aragón".

**Campos clave:** `id_publico`, `nombre`, `empresa_id`, `parametros`, `plantillas_documentos`.

**Reglas:** todo Lote pertenece a un Proyecto; todo Proyecto a una Empresa (activo desde Fase 2). Los parámetros comerciales (precios, gastos, política de comisiones) son propios del Proyecto.

**Dominio propietario:** Administración.

### Empresa (`EMP-nnnnnn`)

La desarrolladora. Ejemplo: "Desarrolladora PALIZ, S.A. de C.V.". Preparada desde Fase 1; activa multiempresa en Fase 2.

**Campos clave:** razón social, RFC, domicilio, apoderado legal, logo, plantillas, políticas por defecto.

**Dominio propietario:** Administración.

### Lote (`LOT-nnnnnn`, clave física `M###-L###`)

Una vivienda o terreno físico dentro de un Proyecto.

**Campos clave:** `id_publico`, `clave` (operativa), `clave_fisica` (`M006-L007`), `mz`, `lote`, `estado` (Disponible, Apartado, Vendido, Casa Muestra, Lote Especial, Subdividido), `modelo_asignado`, `precio_terreno`, `superficie` (con 3 decimales de precisión), `excedente`, `plusvalia`.

**Reglas:** un Lote con Operación activa no se edita ni elimina. La superficie siempre se expresa con 3 decimales — reducirla a 2 decimales distorsiona el valor por m². Un Lote Vendido o Disponible con historial de Operaciones no se elimina; solo se marcan Inactivo o pasan por operación de rescisión.

**Dominio propietario:** Administración.

### Movimiento Financiero (`MOV-nnnnnn`)

Registro individual en el **Libro Mayor (Ledger)** del Motor Financiero. **Inmutable**: una vez creado no se modifica ni se borra.

**Campos clave:** `id_publico` (MOV-), `tipo` (ingreso, cancelacion, reembolso, penalizacion, comision_asesor, comision_gerente, ajuste), `monto`, `signo` (positivo o negativo), `operacionId`, `personaId`, `documento` (folio del recibo/pagaré/cancelación asociado), `politica_version`, `usuario`, `fecha`, `hora`, `motivo`, `movimiento_compensa` (referencia a MOV- previo si es compensación).

**Reglas:** append-only. Cualquier cambio requiere un movimiento compensatorio nuevo. La suma algebraica del ledger de una Operación siempre refleja su saldo real. El sistema opera como un banco: no se corrige, se compensa.

**Dominio propietario:** Financiero.

### Comisión (`COM-nnnnnn`)

Derecho de cobro de un asesor o gerente sobre una Operación cerrada. Es un tipo de Movimiento Financiero con reglas propias.

**Campos clave:** `id_publico`, `operacionId`, `beneficiario` (usuario), `rol` (asesor / gerente), `base_comisionable` (monto sobre el que se calcula), `porcentaje`, `total`, `distribucion` (array de partes: `[{parte:'Firma', pct:0.5, cobrada:true}, {parte:'Escrituración', pct:0.5, cobrada:false}]`), `politica_version`.

**Reglas:**
- La base comisionable es el precio realmente vendido, **no** el precio de lista. Descuentos, gastos administrativos, avalúo y escrituración se excluyen por configuración de política.
- La política aplicada se **snapshot** en la Operación: aunque la política de la empresa cambie mañana, esta comisión conserva su cálculo original.
- El cobro por parte (firma, escrituración…) es configurable por Empresa/Proyecto. El default es 50 / 50.
- Al cancelar una venta, la comisión **no se borra**: se emite un movimiento compensatorio negativo en el ledger. La bandera `cobrada` conserva su historia.
- Las penalizaciones (retenciones a comisiones futuras, cobros al asesor por cancelación imputable) son movimientos independientes.

**Dominio propietario:** Financiero.

### Expediente

No es una entidad de tabla — es un **agrupador** que contiene todos los documentos y movimientos anclados a una Operación. Vive dentro de la Operación y se compone de:
- Documentos generados (`doc_snapshot`, `documentos[]`): contrato, carátula, datos generales, cartas, pagarés individuales, recibos, cancelación.
- Ledger de movimientos financieros de esa Operación.
- Historial de operaciones (transiciones de estado, correcciones administrativas).
- Auditoría fina (cada campo modificado, por quién, cuándo).

**Regla:** el Expediente es la unidad de reconstrucción histórica. Ante una aclaración con el SAT, con el cliente o con el juzgado, se abre el Expediente de la Operación y **todo está ahí**: cifras, política aplicada, firmas, movimientos, autoría, tiempos.

---

## Dominios y sus fronteras

Cada dominio es responsable único de su información. Los módulos consumen motores; los motores no se llaman entre sí salvo por interfaces explícitas.

### CRM

**Responsable de:** Personas (Prospectos y Clientes en su faceta de identidad), agenda, seguimientos, recordatorios, campañas, comunicación, WhatsApp, historial comercial.

**Consume:** Motor de Operaciones para cambios de estatus del prospecto.

**Nunca:** calcula dinero, decide precios, define política comercial.

### Comercial

**Responsable de:** Pipeline Comercial (que administra el estado de **Oportunidades**, cada una asociada a una Persona y a un Proyecto — no únicamente el estado de la Persona), Oportunidades, Cotizaciones, Apartados, Operaciones, Contratos, Máquina de Estados, conversión Prospecto → Cliente al ganar la primera Oportunidad.

**Consume:** Motor de Operaciones (obligatorio), Motor Financiero (para cifras), Motor de Formatos.

**Nunca:** modifica el ledger financiero, edita el catálogo de modelos ni el inventario físico.

### Financiero

**Responsable de:** Cobranza, pagos, recibos, pagarés, comisiones, penalizaciones, reembolsos, estados de cuenta, ingresos, ledger de movimientos.

**Consume:** Motor Financiero, Motor de Comisiones, Motor de Formatos.

**Nunca:** cambia el estatus de una Operación por sí mismo (solicita al Motor de Operaciones), altera datos de la Persona, decide qué modelo se vende.

### Administración

**Responsable de:** Inventario, Proyectos, Empresas, Usuarios, Roles, Parámetros, Plantillas de documentos, Auditoría, Configuración del sistema.

**Consume:** su propia capa.

**Nunca:** ejecuta operaciones comerciales ni movimientos financieros.

---

## Ciclo de vida completo — ejemplo trazable

Ilustra cómo un solo cierre respeta los cuatro dominios y los principios de trazabilidad.

**1. Origen (CRM):**
El asesor Ana crea al Prospecto **PRO-000018 "Juan Pérez"**. Ana registra sus datos, fuente de captación y presupuesto.

**2. Oportunidad (Comercial):**
Como Juan mostró interés en Valle de Aragón, Ana genera la Oportunidad **OPO-000047** vinculando la Persona con el Proyecto. Registra seguimientos, agenda una cita, envía WhatsApp — todo queda anclado a esta Oportunidad. Estado en el pipeline: *Nueva → Contactada → Cita agendada → Visitó desarrollo*. La tarjeta se mueve en el kanban; el Motor de Operaciones sincroniza la ficha.

**3. Cotización (Comercial):**
Juan se decide por el lote **LOT-000107 (M006-L012)**, modelo Ambel. Ana cotiza (Motor Financiero calcula la corrida, Motor de Formatos muestra `$1,850,000.00` y `144.000 m²`). La cotización queda en el expediente comercial de la Oportunidad. Estado: *Cotización enviada → Negociando*.

**4. Apartado (Ganada) (Comercial + Financiero):**
Motor de Operaciones ejecuta la operación `crear_apartado` (transición Disponible → Apartado). Se genera **APT-000041** y se cierra la Oportunidad **OPO-000047** como **Ganada**, dejando el vínculo `operacionId = APT-000041` para reconstrucción histórica. Motor Financiero registra un movimiento `MOV-000203 · ingreso · $80,000 · efectivo` con folio de recibo `REC-000301`. Auditoría automática. Ana recibe recibo automático con `EFECTIVO` como forma de pago. El Health Check del sistema no reporta anomalías.

**5. Contrato firmado (Comercial + Financiero, transición de estado):**
Motor de Operaciones ejecuta `contrato_firmado` con confirmación de consecuencias. Transición Apartado → Contrato firmado. Se genera **VEN-000019** y **CON-000019**. La Persona adquiere identidad de Cliente **CLI-000012** (permanente, se conserva incluso si esta venta se cancela años después). Se generan los 12 pagarés como documentos independientes: `REC-000305, REC-000306, …, REC-000316` — cada uno con su propio folio, estado (Pendiente) e historial. Se calculan las comisiones con política snapshot (v3 vigente hoy): asesor 2 % sobre base comisionable de $1,750,000 (bruto − descuento de $100,000, gastos excluidos) = $35,000, distribución 50/50; gerente 0.5 %  = $8,750, distribución 50/50. Movimientos en el ledger: `MOV-000204 · comision_asesor · $17,500 (parte firma) · pendiente`, `MOV-000205 · comision_asesor · $17,500 (parte escrituración) · pendiente`, y análogos para gerente. Se registra el snapshot de política en la Operación.

**6. Cobranza (Financiero):**
Juan paga las mensualidades. Cada pago es un `MOV- · ingreso` con folio propio en el ledger. El pagaré correspondiente actualiza su estado a Pagado. Motor Financiero calcula el saldo pendiente; el Motor de Formatos lo muestra siempre con formato `$xxx,xxx.xx`. La alerta LFPIORPI monitorea el efectivo acumulado contra el tope de 8,025 UMA.

**7. Cancelación hipotética (compensatoria, no destructiva):**
Si Juan cancela 18 meses después, el Motor de Operaciones ejecuta `cancelacion_venta`. Nada se borra: se emite `MOV- · cancelacion · −$total` compensando el ingreso original, `MOV- · reembolso · −$saldo_a_devolver`, `MOV- · penalizacion · +$monto_penalizacion` según la política snapshot registrada en su día. La comisión ya cobrada queda; la no cobrada se compensa con un `MOV- · comision_asesor · −$monto` (retención). El ledger conserva **toda** la historia. El Expediente queda íntegro con la venta original, sus pagos, sus documentos, y encima la cancelación con sus movimientos compensatorios. La trazabilidad responde las seis preguntas: quién canceló, cuándo, con qué política, qué operación, qué documentos generó.

Este ciclo respeta los cuatro dominios, la máquina de estados, el ledger inmutable, la política versionada y la trazabilidad total. **Es el estándar de referencia del sistema.**

---

## Principios de trazabilidad (obligatorios para todo cálculo)

Cualquier cálculo importante del sistema debe responder estas seis preguntas. Si alguna implementación no puede responderlas, se reconsidera antes de continuar.

1. **¿Quién lo realizó?** — Usuario identificado.
2. **¿Cuándo?** — Timestamp con fecha y hora.
3. **¿Con qué política?** — Versión de la política vigente (snapshot).
4. **¿Con qué parámetros?** — Base comisionable, distribución, penalización, descuento aplicado — todos capturados.
5. **¿Qué operación afectó?** — `APT-` / `VEN-` / `CON-` de referencia.
6. **¿Qué documentos generó?** — Folios de recibos, cartas, cancelaciones, movimientos.

Este documento se actualiza cuando cambia el modelo, siempre antes que el código.

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

## Pendientes explícitos para Fase 2 (decisión consciente: estabilidad > agresividad)

- Migrar llamadas `DS.*` de los módulos a los servicios de entidades.
- Conectar plantillas de documentos a `IANNA_CONFIG.empresa` (hoy conservan sus textos originales para garantizar salida idéntica).
- Renombrados de funciones y deduplicación fina (hacerlos junto con pruebas por módulo).
- Responsive real por dispositivo en `99-responsive.css`.

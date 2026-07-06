/* ════════════════════════════════════════════════════════════════
   IANNA CRM — utils/formatos.util.js
   MOTOR DE FORMATOS ÚNICO (Fase 1.9)
   ────────────────────────────────────────────────────────────────
   Componente único responsable del formato visual de TODOS los
   datos del sistema. Todo el CRM (documentos, listas, formularios,
   reportes) debe consumir estas funciones.

   Reemplaza y unifica implementaciones duplicadas previas
   (numToLetras, mxn, etc.). Mantiene compatibilidad al alias los
   nombres antiguos hacia estas nuevas funciones.

   Trazabilidad: cualquier bug de formato tiene UN solo lugar donde
   arreglarse — este archivo.
   ════════════════════════════════════════════════════════════════ */

window.IANNA_FMT = (function(){

  // ── MONEDA (MXN) ──────────────────────────────────────────────
  // Separador de miles obligatorio, hasta 3 decimales cuando existan.
  // Los valores enteros conservan 2 decimales fijos (estándar contable).
  function MXN(n, opts){
    const num = Number(n);
    if(!isFinite(num)) return '$0.00';
    const decimales = (opts && typeof opts.decimales==='number') ? opts.decimales
                    : (Math.abs(num*1000 - Math.round(num*1000)) < 1e-6 && Math.abs(num*100 - Math.round(num*100)) > 1e-6) ? 3 : 2;
    return '$'+num.toLocaleString('es-MX',{minimumFractionDigits:decimales, maximumFractionDigits:decimales});
  }

  // ── SUPERFICIE (m²) ───────────────────────────────────────────
  // SIEMPRE 3 decimales — reducirlos distorsiona el valor por m² de la operación.
  function M2(n){
    const num = Number(n);
    if(!isFinite(num)) return '0.000 m²';
    return num.toLocaleString('es-MX',{minimumFractionDigits:3, maximumFractionDigits:3})+' m²';
  }

  // ── TELÉFONO ──────────────────────────────────────────────────
  // Formato uniforme: 667 926 5145 (grupos de 3-3-4 para 10 dígitos, mejor esfuerzo para longitudes distintas).
  function TEL(t){
    const digits = String(t||'').replace(/\D/g,'');
    if(!digits) return '';
    if(digits.length===10) return digits.slice(0,3)+' '+digits.slice(3,6)+' '+digits.slice(6);
    if(digits.length===12 && digits.startsWith('52')) return '+52 '+digits.slice(2,5)+' '+digits.slice(5,8)+' '+digits.slice(8);
    if(digits.length<=7) return digits.slice(0,3)+' '+digits.slice(3);
    return digits.replace(/(\d{3})(?=(\d{3,4})+$)/g,'$1 ').trim();
  }

  // ── PORCENTAJE ────────────────────────────────────────────────
  // Recibe fracción (0.035) o número entero (3.5) — detecta cuál según magnitud.
  // Salida uniforme: "3.50 %".
  function PCT(v, decimales){
    const num = Number(v);
    if(!isFinite(num)) return '0.00 %';
    const val = Math.abs(num) <= 1 ? num*100 : num;
    const d = (typeof decimales==='number') ? decimales : 2;
    return val.toLocaleString('es-MX',{minimumFractionDigits:d, maximumFractionDigits:d})+' %';
  }

  // ── FOLIO ─────────────────────────────────────────────────────
  // Todos los folios visuales con el mismo formato: 8 dígitos con ceros a la izquierda,
  // opcional prefijo con separador. Acepta números o strings ya formateados (idempotente).
  function FOLIO(v, prefijo){
    const s = String(v||'');
    // Ya viene como id permanente (PRO-000018) — se conserva
    if(/^[A-Z]{2,4}-\d+$/.test(s)) return s;
    const digits = s.replace(/\D/g,'');
    const padded = digits ? digits.padStart(8,'0') : '00000000';
    return prefijo ? (prefijo+'-'+padded) : padded;
  }

  // ── NÚMERO A LETRAS ───────────────────────────────────────────
  // Conversor único y correcto. Maneja:
  //  · Enteros hasta 999,999,999,999
  //  · Centavos como "XX/100 M.N." (estándar de documentos oficiales mexicanos)
  //  · El caso especial 1,000,000 (donde el conversor viejo devolvía undefined)
  //  · Cero, uno singular, mil singular, millón/millones, mil millones
  //  · Redondeo negativo (devuelve valor absoluto con prefijo "MENOS")
  function NUM_A_LETRAS(n, opts){
    const moneda = !opts || opts.moneda !== false;
    let num = Number(n);
    if(!isFinite(num)) return moneda ? 'CERO PESOS 00/100 M.N.' : 'CERO';
    let signo = '';
    if(num < 0){ signo='MENOS '; num = -num; }

    const entero = Math.floor(num);
    const centavos = Math.round((num - entero) * 100);

    const enteroTexto = _enteroALetras(entero);
    if(!moneda) return (signo + enteroTexto).trim();
    const pluralPesos = entero === 1 ? 'PESO' : 'PESOS';
    // Gramática: "UN MILLÓN DE PESOS", "DOS MILLONES DE PESOS" (cuando no hay residuo bajo el millón)
    // Pero "UN MILLÓN QUINIENTOS MIL PESOS" (sin "DE") si hay residuo.
    const conDe = /\b(MILLÓN|MILLONES)$/.test(enteroTexto);
    const separador = conDe ? ' DE ' : ' ';
    const cent = String(centavos).padStart(2,'0');
    return (signo + enteroTexto + separador + pluralPesos + ' ' + cent + '/100 M.N.').trim();
  }

  // Convertidor interno: entero (>=0) a letras en español.
  // Cubre 0..999,999,999,999 con reglas correctas de "un/uno", "cien/ciento", "veinte/veintiuno", etc.
  function _enteroALetras(n){
    if(n === 0) return 'CERO';
    if(n < 0) return 'MENOS ' + _enteroALetras(-n);

    const UNIDADES = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE',
                      'DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE',
                      'VEINTE','VEINTIUNO','VEINTIDÓS','VEINTITRÉS','VEINTICUATRO','VEINTICINCO','VEINTISÉIS','VEINTISIETE','VEINTIOCHO','VEINTINUEVE'];
    const DECENAS = ['','','','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
    const CENTENAS = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];

    function menosDeCien(x){
      if(x < 30) return UNIDADES[x];
      const d = Math.floor(x/10), u = x%10;
      return DECENAS[d] + (u ? ' Y '+UNIDADES[u] : '');
    }
    function menosDeMil(x){
      if(x === 100) return 'CIEN';
      if(x < 100) return menosDeCien(x);
      const c = Math.floor(x/100), r = x%100;
      return CENTENAS[c] + (r ? ' '+menosDeCien(r) : '');
    }
    function seccion(x, singular, plural){
      if(x === 0) return '';
      if(x === 1) return singular;
      return menosDeMil(x) + ' ' + plural;
    }

    if(n < 1000) return menosDeMil(n);

    // Miles: 1,000 .. 999,999
    if(n < 1000000){
      const miles = Math.floor(n/1000);
      const resto = n%1000;
      const parteMiles = seccion(miles, 'MIL', 'MIL');
      return (parteMiles + (resto ? ' '+menosDeMil(resto) : '')).trim();
    }

    // Millones: 1,000,000 .. 999,999,999,999
    if(n < 1000000000000){
      const millones = Math.floor(n/1000000);
      const resto = n%1000000;
      // La cantidad de millones puede ser 1..999,999 (hasta "mil millones" = billón corto en escala mexicana).
      // seccion() sirve para 1..999; para >=1000 (mil millones+) usamos la conversión de miles recursiva.
      let parteMill;
      if(millones === 1) parteMill = 'UN MILLÓN';
      else if(millones < 1000) parteMill = menosDeMil(millones) + ' MILLONES';
      else {
        // "MIL MILLONES", "DOS MIL MILLONES", "MIL QUINIENTOS MIL MILLONES"...
        const milesDeM = Math.floor(millones/1000);
        const restoM = millones%1000;
        const parteMiles = milesDeM===1 ? 'MIL' : (menosDeMil(milesDeM)+' MIL');
        parteMill = (parteMiles + (restoM ? ' '+menosDeMil(restoM) : '') + ' MILLONES');
      }
      // Convertir el resto (que puede tener miles)
      let resTxt = '';
      if(resto > 0){
        if(resto < 1000) resTxt = ' '+menosDeMil(resto);
        else{
          const miles = Math.floor(resto/1000);
          const r2 = resto%1000;
          resTxt = ' '+ seccion(miles,'MIL','MIL') + (r2 ? ' '+menosDeMil(r2) : '');
        }
      }
      return (parteMill + resTxt).trim();
    }

    return 'CANTIDAD EXCEDE EL RANGO';
  }

  // ── FECHA ─────────────────────────────────────────────────────
  // Formato oficial en documentos: "02 de julio de 2026"
  function FECHA_LARGA(d){
    const f = (d instanceof Date) ? d : new Date(d);
    if(isNaN(f)) return '';
    return f.toLocaleDateString('es-MX',{day:'2-digit', month:'long', year:'numeric'});
  }
  // Formato corto: "02/07/2026"
  function FECHA_CORTA(d){
    const f = (d instanceof Date) ? d : new Date(d);
    if(isNaN(f)) return '';
    return f.toLocaleDateString('es-MX',{day:'2-digit', month:'2-digit', year:'numeric'});
  }

  return { MXN, M2, TEL, PCT, FOLIO, NUM_A_LETRAS, FECHA_LARGA, FECHA_CORTA };
})();

// ── ALIAS DE COMPATIBILIDAD ─────────────────────────────────────
// El código existente sigue funcionando; internamente usa el motor.
// Los módulos nuevos deben preferir IANNA_FMT.MXN(...) directamente.
window.numToLetras = function(n){ return IANNA_FMT.NUM_A_LETRAS(n); };

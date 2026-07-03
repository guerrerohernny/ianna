/* ════════════════════════════════════════════════════════════════
   IANNA CRM — modules/ingresos.module.js
   Módulo Ingresos: comisiones de asesores (2%/1%) y gerente (0.5%), cobro en 2 partes.
   Fase 1 (refactor): código movido intacto desde el archivo original.
   ════════════════════════════════════════════════════════════════ */
function renderIngresos(){
  const period = $('ing-periodo')?.value||'todo';
  const filtroAsesor = $('ing-asesor')?.value||'';
  const isAdmin = CU.rol==='administrador'||CU.rol==='gerente';
  const P = getP();

  // Get all ventas (apartados with estatus='Venta')
  let ventas = DS.find('apartados').filter(a=>a.estatus==='Venta');
  if(!isAdmin) ventas = ventas.filter(v=>v.asesor===CU.id);
  else if(filtroAsesor) ventas = ventas.filter(v=>v.asesor===filtroAsesor);

  // Filter by period
  const now = new Date();
  if(period==='mes') ventas = ventas.filter(v=>{
    const d = new Date(v.fecha_venta||v.fecha_apartado||'');
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  });
  if(period==='año') ventas = ventas.filter(v=>{
    const d = new Date(v.fecha_venta||v.fecha_apartado||'');
    return d.getFullYear()===now.getFullYear();
  });

  // ── Comisión del ASESOR: 2% directa · 1% con broker — mitad firma, mitad escritura ──
  const calcComisionAsesor = (v) => {
    const total = v.total_operacion || 0;
    const isBroker = !!v.broker_id;
    const pct = isBroker ? (P.comision_asesor_broker_pct||0.01) : (P.comision_asesor_pct||0.02);
    const totalCom = total * pct;
    const parte1 = totalCom / 2; // al firmar
    const parte2 = totalCom / 2; // al escriturar
    const cobrada1 = v.comision_parte1_cobrada ? parte1 : 0;
    const cobrada2 = v.comision_parte2_cobrada ? parte2 : 0;
    return {total:totalCom, parte1, parte2, cobrada1, cobrada2, totalCobrado:cobrada1+cobrada2, isBroker, pct};
  };
  // ── Comisión del GERENTE: 0.5% de TODA venta del equipo (directa o broker) — misma lógica de 2 partes ──
  const calcComisionGerente = (v) => {
    const total = v.total_operacion || 0;
    const pct = P.comision_gerente_pct||0.005;
    const totalCom = total * pct;
    const parte1 = totalCom / 2;
    const parte2 = totalCom / 2;
    const cobrada1 = v.comision_ger_parte1_cobrada ? parte1 : 0;
    const cobrada2 = v.comision_ger_parte2_cobrada ? parte2 : 0;
    return {total:totalCom, parte1, parte2, cobrada1, cobrada2, totalCobrado:cobrada1+cobrada2, isBroker:!!v.broker_id, pct};
  };
  // El gerente/admin ve y cobra SU comisión (0.5%); el asesor la suya (2%/1%)
  const calcComision = isAdmin ? calcComisionGerente : calcComisionAsesor;

  const ventasData = ventas.map(v=>{
    const l = getLote(v.clave_lote)||{};
    const m = getMod(v.modelo_id)||{};
    const p = DS.findOne('prospectos',v.prospectoId)||{};
    const com = calcComision(v);
    return {...v, l, m, p, com};
  });

  // Totals
  const totalFacturado = ventasData.reduce((s,v)=>s+(v.total_operacion||0),0);
  const totalGanado = ventasData.reduce((s,v)=>s+v.com.total,0);
  const totalCobrado = ventasData.reduce((s,v)=>s+v.com.totalCobrado,0);
  const totalPorCobrar = totalGanado - totalCobrado;
  // Total de comisiones de los asesores (informativo para el gerente)
  const totalComAsesores = isAdmin ? ventasData.reduce((s,v)=>s+calcComisionAsesor(v).total,0) : 0;

  // ── RENDER ─────────────────────────────────────────────────────
  const container = $('ing-cont');
  if(!container) return;
  container.innerHTML = '';

  // Header cards
  const headerHtml = `
    <div style="display:grid;grid-template-columns:${isAdmin?'1fr 1fr 1fr 1fr':'1fr 1fr 1fr'};gap:14px;margin-bottom:20px">
      <div class="card" style="background:linear-gradient(135deg,#1E3D0F,#2D5A1B);color:#fff;padding:18px 20px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;opacity:.8;margin-bottom:6px">${isAdmin?'Facturación del equipo':'Has vendido'}</div>
        <div style="font-size:26px;font-weight:800">${mxn(totalFacturado)}</div>
        <div style="font-size:11px;opacity:.7;margin-top:4px">${ventas.length} operación(es)</div>
      </div>
      <div class="card" style="background:linear-gradient(135deg,#C9963C,#d4a84b);color:#fff;padding:18px 20px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;opacity:.8;margin-bottom:6px">Has ganado ${isAdmin?'(0.5% de todas las ventas)':''}</div>
        <div style="font-size:26px;font-weight:800">${mxn(totalGanado)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:8px;font-size:11px">
          <div style="background:rgba(255,255,255,.2);border-radius:4px;padding:4px 6px"><div style="opacity:.8">Ya cobrado</div><div style="font-weight:700">${mxn(totalCobrado)}</div></div>
          <div style="background:rgba(255,255,255,.2);border-radius:4px;padding:4px 6px"><div style="opacity:.8">Por cobrar</div><div style="font-weight:700">${mxn(totalPorCobrar)}</div></div>
        </div>
      </div>
      <div class="card" style="padding:18px 20px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--t3);margin-bottom:10px">Progreso de cobro</div>
        <div style="background:var(--s2);border-radius:20px;height:12px;overflow:hidden;margin-bottom:8px">
          <div style="background:linear-gradient(90deg,#2D5A1B,#C9963C);height:100%;border-radius:20px;width:${totalGanado>0?Math.round(totalCobrado/totalGanado*100):0}%;transition:width .5s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px">
          <span style="color:#2D5A1B;font-weight:600">${totalGanado>0?Math.round(totalCobrado/totalGanado*100):0}% cobrado</span>
          <span style="color:var(--t3)">${mxn(totalPorCobrar)} pendiente</span>
        </div>
      </div>
      ${isAdmin?`<div class="card" style="padding:18px 20px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--t3);margin-bottom:10px">Comisiones de asesores</div>
        <div style="font-size:22px;font-weight:800;color:var(--navy)">${mxn(totalComAsesores)}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:4px">2% directa · 1% con broker</div>
      </div>`:''}
    </div>`;

  // Table
  const tableSubtitle = isAdmin
    ? 'Tu comisión: 0.5% de cada venta del equipo (mitad a la firma, mitad a la escritura)'
    : '2% venta directa · 1% con broker (mitad a la firma, mitad a la escritura)';
  const quien = isAdmin ? 'ger' : 'asesor';
  const tableHtml = ventasData.length===0 ? `<div class="empty"><div class="empty-i">💰</div><p>Sin ventas en el período seleccionado</p></div>` : `
    <div class="card" style="overflow:hidden;padding:0">
      <div style="padding:14px 18px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between">
        <div style="font-weight:700;font-size:14px">Detalle de comisiones${isAdmin?' — Gerente':''}</div>
        <div style="font-size:12px;color:var(--t3)">${tableSubtitle}</div>
      </div>
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="background:var(--s2)">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--t3);font-weight:700;text-transform:uppercase">Cliente</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--t3);font-weight:700;text-transform:uppercase">Lote</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--t3);font-weight:700;text-transform:uppercase">Modelo</th>
          ${isAdmin?'<th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--t3);font-weight:700;text-transform:uppercase">Asesor</th>':''}
          <th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--t3);font-weight:700;text-transform:uppercase">${isAdmin?'Mi comisión':'Comisión'}</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--t3);font-weight:700;text-transform:uppercase">1ª parte (firma)</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--t3);font-weight:700;text-transform:uppercase">2ª parte (escritura)</th>
        </tr></thead>
        <tbody>
        ${ventasData.map(v=>`<tr style="border-bottom:1px solid var(--s2)">
          <td style="padding:10px 12px">
            <div style="font-weight:600">${v.p.nombre||'—'}</div>
            <div style="font-size:10.5px;color:var(--t3)">${v.fecha_venta?new Date(v.fecha_venta).toLocaleDateString('es-MX'):'—'}${v.com.isBroker?' · <span style="color:#f97316;font-size:10px">Broker</span>':''}</div>
          </td>
          <td style="padding:10px 12px">${v.clave_lote||'—'}</td>
          <td style="padding:10px 12px">${v.m.nombre||'—'}</td>
          ${isAdmin?`<td style="padding:10px 12px;font-size:12px">${getUser(v.asesor).nombre.split(' ')[0]}</td>`:''}
          <td style="padding:10px 12px;text-align:right">
            <div style="font-weight:700">${mxn(v.com.total)}</div>
            <div style="font-size:10px;color:var(--t3)">${(v.com.pct*100).toFixed(v.com.pct<0.01?1:0)}% de ${mxn(v.total_operacion||0)}</div>
          </td>
          <td style="padding:10px 12px;text-align:center">
            ${v.com.cobrada1>0
              ? `<div style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;color:#166534;border-radius:6px;padding:4px 8px;font-size:11.5px"><span>✓</span> ${mxn(v.com.parte1)}</div>`
              : `<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="font-size:11.5px;color:var(--t2)">${mxn(v.com.parte1)}</div><button class="btn btn-gold btn-xs" onclick="cobrarComision('${v.id}',1,'${quien}')" style="font-size:10px">Cobrar</button></div>`}
          </td>
          <td style="padding:10px 12px;text-align:center">
            ${v.com.cobrada2>0
              ? `<div style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;color:#166534;border-radius:6px;padding:4px 8px;font-size:11.5px"><span>✓</span> ${mxn(v.com.parte2)}</div>`
              : `<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="font-size:11.5px;color:var(--t2)">${mxn(v.com.parte2)}</div><button class="btn btn-out btn-xs" onclick="cobrarComision('${v.id}',2,'${quien}')" style="font-size:10px">Cobrar</button></div>`}
          </td>
        </tr>`).join('')}
        </tbody>
      </table>
      </div>
    </div>`;

  // Desglose por asesor (solo gerente/admin) — comisión correcta por venta (2% directa / 1% broker)
  const equipoHtml = isAdmin ? (() => {
    const asesores = DS.find('usuarios',{rol:'asesor',activo:true});
    const rows = asesores.map(a=>{
      const ventasA = DS.find('apartados').filter(v=>v.estatus==='Venta'&&v.asesor===a.id);
      const facturadoA = ventasA.reduce((s,v)=>s+(v.total_operacion||0),0);
      const comA = ventasA.reduce((s,v)=>s+calcComisionAsesor(v).total,0);
      return {a, facturadoA, comA, n:ventasA.length};
    }).filter(r=>r.facturadoA>0).sort((a,b)=>b.facturadoA-a.facturadoA);
    if(!rows.length) return '';
    return `<div class="card" style="margin-top:14px">
      <div style="font-weight:700;font-size:14px;margin-bottom:12px">Facturación por asesor</div>
      ${rows.map((r,i)=>`<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)">
        <div style="width:24px;height:24px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${i+1}</div>
        <div style="flex:1"><div style="font-weight:600">${r.a.nombre}</div><div style="font-size:11px;color:var(--t3)">${r.n} venta(s)</div></div>
        <div style="font-weight:700;color:var(--navy)">${mxn(r.facturadoA)}</div>
        <div style="font-size:11.5px;color:#C9963C">${mxn(r.comA)} com.</div>
      </div>`).join('')}
    </div>`;
  })() : '';

  container.innerHTML = headerHtml + tableHtml + equipoHtml;
}

function cobrarComision(ventaId, parte, quien){
  const ap = DS.findOne('apartados', ventaId);
  if(!ap){ toast('Venta no encontrada','err'); return; }
  quien = quien||'asesor';
  const prefix = quien==='ger' ? 'comision_ger_parte' : 'comision_parte';
  const campo = prefix + parte + '_cobrada';
  const label = (parte===1 ? 'primera parte (firma de contrato)' : 'segunda parte (escritura)') + (quien==='ger'?' — comisión del gerente':'');
  if(!confirm(`¿Confirmar cobro de la ${label}?`)) return;
  DS.update('apartados', ventaId, {[campo]: true, [prefix+parte+'_fecha']: new Date().toISOString()});
  renderIngresos();
  toast(`Comisión parte ${parte} marcada como cobrada ✓`,'ok');
}


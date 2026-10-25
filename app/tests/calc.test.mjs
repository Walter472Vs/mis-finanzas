import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/calc.js';
import { plantillaPeru, plantillaGenerica, PLANTILLAS } from '../js/plantillas.js';

// Perfil de ejemplo: sueldo en soles + freelance en dólares.
function perfilEjemplo() {
  const p = plantillaPeru();
  p.tc = 3.5;
  p.presupuestoGastos = 3000;
  p.ahorroMensual = 4210;
  p.ingresos = [
    { id: 'sueldo', nombre: 'Sueldo', monto: 4800, moneda: 'PEN', dia: 28, categoria: 'sueldo', impuestoPct: 0, nota: '' },
    { id: 'free', nombre: 'Freelance', monto: 2000, moneda: 'USD', dia: 15, categoria: 'freelance', impuestoPct: 8, nota: 'Emite tu recibo' },
  ];
  const b = (id) => p.bolsas.find((x) => x.id === id);
  b('impuestos').valor = 210; // fijo
  Object.assign(b('depa'), { valor: 80, meta: 80000, metaMinima: 40000, fechaMeta: '2028-10-01' });
  b('emergencia').meta = 18000;
  return p;
}

const estadoEjemplo = () => C.estadoInicial(perfilEjemplo());

test('plantillas válidas, con ids únicos y reparto que suma 100%', () => {
  for (const [k, t] of Object.entries(PLANTILLAS)) {
    const p = t.crear();
    assert.doesNotThrow(() => C.validarPerfil(p), k);
    assert.ok(p.bolsas.some((b) => b.id === p.metaPrincipal), k);
    assert.equal(C.sumaPorcentajes(p), 100, k);
  }
  assert.equal(plantillaGenerica().moneda, 'USD');
  assert.equal(plantillaPeru().monedaSecundaria, 'USD');
});

test('fechas: diasEntre, sumarDias y sumarMeses (fin de mes)', () => {
  assert.equal(C.diasEntre('2026-10-25', '2026-11-24'), 30);
  assert.equal(C.sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(C.sumarMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(C.sumarMeses('2026-11-15', 3), '2027-02-15');
});

test('conversión a moneda principal y formato', () => {
  const p = perfilEjemplo();
  assert.equal(C.aPrincipal(100, 'USD', p), 350);
  assert.equal(C.aPrincipal(100, 'PEN', p), 100);
  assert.equal(C.desdePrincipal(350, 'USD', p), 100);
  assert.match(C.formatoMoneda(1234.5, 'PEN'), /1,234\.50/);
});

test('reparto mensual: primero montos fijos, luego porcentajes', () => {
  const r = C.repartoMensual(perfilEjemplo());
  assert.equal(r.impuestos, 210);
  assert.equal(r.depa, 3200); // 80% de (4210 − 210)
  assert.equal(r.etf, 700);
  assert.equal(r.cripto, 100);
  assert.equal(r.emergencia, 0);
});

test('plan del día de pago: proporcional al ingreso, con impuesto y conversión', () => {
  const p = perfilEjemplo();
  // Ingreso total = 4800 + 2000×3.5 = 11,800 → el freelance pesa 7000/11800.
  const plan = C.planDiaPago(p, p.ingresos[1]);
  assert.equal(plan.titulo, 'Día 15 — Freelance');
  assert.equal(plan.pasos[0], 'Emite tu recibo');
  assert.equal(plan.montos.impuesto, 560); // 8% de 7000
  assert.equal(plan.montos.gastos, C.redondear((3000 * 7000) / 11800));
  const etf = plan.pasos.find((s) => s.startsWith('ETF'));
  assert.ok(/US\$|USD/.test(etf) && etf.includes('118.64'), etf); // la bolsa ETF está en dólares: 415.25 / 3.5
  const total = plan.montos.destinos.reduce((s, d) => s + d.monto, 0) + C.planDiaPago(p, p.ingresos[0]).montos.destinos.reduce((s, d) => s + d.monto, 0);
  assert.ok(Math.abs(total - 4210) < 0.05, `el ahorro se reparte completo: ${total}`);
});

test('interés de plazo fijo con TEA y base 360', () => {
  assert.equal(C.redondear(C.interesPF(10000, 6, 360)), 600);
  assert.equal(C.redondear(C.interesPF(10000, 6, 180)), 295.63);
  const pf = { monto: 10000, tasa: 6, inicio: '2026-01-01', vencimiento: C.sumarDias('2026-01-01', 360) };
  const a = C.infoPF(pf, C.sumarDias('2026-01-01', 180));
  assert.equal(a.interesDevengado, 295.63);
  assert.equal(a.avance, 0.5);
  assert.equal(C.infoPF(pf, '2027-06-01').interesDevengado, 600);
});

test('alertas de plazos fijos y concentración por entidad', () => {
  const e = estadoEjemplo();
  e.plazos = [
    { id: 'a', entidad: 'Caja X', monto: 50000, moneda: 'PEN', tasa: 5, bolsa: 'depa', inicio: '2026-01-01', vencimiento: '2026-11-05' },
    { id: 'b', entidad: 'Caja X', monto: 5000, moneda: 'USD', tasa: 5, bolsa: 'depa', inicio: '2026-01-01', vencimiento: '2027-03-01' },
    { id: 'c', entidad: 'Caja Z', monto: 1000, moneda: 'PEN', tasa: 5, bolsa: 'depa', inicio: '2026-01-01', vencimiento: '2026-10-30', estado: 'cerrado' },
  ];
  assert.deepEqual(C.alertasPF(e.plazos, '2026-10-25', 15).map((x) => x.pf.id), ['a']);
  assert.deepEqual(C.concentracionPorEntidad(e), { 'Caja X': 67500 });
});

test('saldos: soles, dólares, retiros, intereses cobrados, PF y valor de mercado', () => {
  const e = estadoEjemplo();
  e.movimientos = [
    { id: '1', fecha: '2026-10-25', tipo: 'aporte', categoria: 'etf', monto: 100, moneda: 'USD', tc: 3.4 },
    { id: '2', fecha: '2026-01-01', tipo: 'aporte', categoria: 'depa', monto: 10000, moneda: 'PEN' },
    { id: '3', fecha: '2026-10-26', tipo: 'retiro', categoria: 'depa', monto: 1000, moneda: 'PEN' },
    { id: '4', fecha: '2026-10-27', tipo: 'aporte', categoria: 'depa', monto: 50, moneda: 'PEN', rendimiento: true },
  ];
  e.plazos = [{ id: 'p', entidad: 'Caja', monto: 9000, moneda: 'PEN', tasa: 6, bolsa: 'depa', inicio: '2026-01-01', vencimiento: C.sumarDias('2026-01-01', 360) }];
  const s = C.saldosPorBolsa(e, C.sumarDias('2026-01-01', 180));
  assert.equal(s.etf.aportado, 340);
  assert.equal(s.etf.valor, 350);
  assert.equal(s.etf.rendimiento, 10);
  assert.equal(s.depa.aportado, 9000);
  assert.equal(s.depa.valor, C.redondear(9050 + C.interesPF(9000, 6, 180)));
  e.valoraciones.etf = { monto: 120, moneda: 'USD', fecha: '2026-10-27' };
  const s2 = C.saldosPorBolsa(e);
  assert.equal(s2.etf.valor, 420);
  assert.equal(s2.etf.rendimientoPct, 23.53);
});

test('progreso de meta: %, mínimo, fecha estimada y aporte necesario', () => {
  const e = estadoEjemplo();
  e.movimientos = [{ id: '1', fecha: '2026-10-25', tipo: 'aporte', categoria: 'depa', monto: 20000, moneda: 'PEN' }];
  const pr = C.progresoMeta(e, C.saldosPorBolsa(e), 'depa', '2026-11-01');
  assert.equal(pr.pct, 25);
  assert.equal(pr.pctMinimo, 50);
  assert.equal(pr.falta, 60000);
  assert.equal(pr.aporteMensual, 3200);
  assert.equal(pr.meses, 19); // ceil(60000 / 3200)
  assert.equal(pr.fechaEstimada, '2028-06-01');
  assert.equal(pr.aTiempo, true);
  assert.ok(pr.necesarioMensual > 2000 && pr.necesarioMensual < 3200);
  assert.equal(C.progresoMeta(e, C.saldosPorBolsa(e), 'no-existe'), null);
});

test('serie del patrimonio: meses continuos, acumulado, snapshots y variación', () => {
  const e = estadoEjemplo();
  e.movimientos = [
    { fecha: '2026-11-03', tipo: 'aporte', categoria: 'depa', monto: 1000, moneda: 'PEN' },
    { fecha: '2027-02-10', tipo: 'aporte', categoria: 'depa', monto: 500, moneda: 'PEN' },
  ];
  e.snapshots = { '2027-01': 1200 };
  const s = C.seriePatrimonio(e, '2027-02-20');
  assert.deepEqual(s.map((x) => x.mes), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepEqual(s.map((x) => x.valor), [1000, 1000, 1200, 1500]);
  assert.deepEqual(C.variacion(s), { absoluta: 300, pct: 25 });
});

test('resumen del mes: sin asignar y tasa de ahorro (intereses no cuentan)', () => {
  const p = perfilEjemplo();
  const movs = [
    { fecha: '2026-11-15', tipo: 'ingreso', categoria: 'freelance', monto: 1000, moneda: 'USD', tc: 3.4 },
    { fecha: '2026-11-20', tipo: 'gasto', categoria: 'comida', monto: 400, moneda: 'PEN' },
    { fecha: '2026-11-28', tipo: 'aporte', categoria: 'depa', monto: 1700, moneda: 'PEN' },
    { fecha: '2026-11-29', tipo: 'aporte', categoria: 'depa', monto: 99, moneda: 'PEN', rendimiento: true },
    { fecha: '2026-11-01', tipo: 'aporte', categoria: 'emergencia', monto: 5000, moneda: 'PEN', inicial: true },
    { fecha: '2026-12-01', tipo: 'gasto', categoria: 'comida', monto: 999, moneda: 'PEN' },
  ];
  const r = C.resumenMes(movs, '2026-11', p);
  assert.equal(r.ingresos, 3400);
  assert.equal(r.sinAsignar, 1300);
  assert.equal(r.tasaAhorro, 50);
  assert.equal(r.gastosPorCategoria.comida, 400);
});

test('recordatorios: días de pago, eventos (anual, trimestral, mensual), fin de mes y PF', () => {
  const e = estadoEjemplo();
  e.perfil.ingresos.push({ id: 'fin', nombre: 'Bono', monto: 100, moneda: 'PEN', dia: 31, categoria: 'otro', impuestoPct: 0, nota: '' });
  e.plazos.push({ id: 'p', entidad: 'Caja Cusco', monto: 5000, moneda: 'PEN', tasa: 7, bolsa: 'depa', inicio: '2026-05-01', vencimiento: '2026-11-20' });
  const r = C.recordatorios(e, '2026-11-10', 21);
  const titulos = r.map((x) => x.titulo);
  assert.ok(titulos.includes('Día 15 — Freelance'));
  assert.ok(titulos.includes('Día 28 — Sueldo'));
  assert.ok(titulos.includes('Depósito CTS de noviembre'));
  assert.ok(titulos.includes('Vence plazo fijo — Caja Cusco'));
  assert.ok(r.some((x) => x.titulo === 'Día 31 — Bono' && x.fecha === '2026-11-30'), 'noviembre no tiene 31: usa el 30');
  assert.ok(r.some((x) => x.titulo === 'Exporta tu respaldo' && x.fecha === '2026-12-01'));
  const ene = C.recordatorios(e, '2027-01-01', 3).map((x) => x.titulo);
  assert.ok(ene.includes('Revisión trimestral'));
  const feb = C.recordatorios(e, '2027-02-01', 3).map((x) => x.titulo);
  assert.ok(!feb.includes('Revisión trimestral'));
});

test('ICS válido: pagos mensuales, eventos y alarmas de PF', () => {
  const e = estadoEjemplo();
  e.plazos.push({ id: 'p', entidad: 'Caja; Cusco', monto: 5000, moneda: 'PEN', tasa: 7, bolsa: 'depa', inicio: '2026-05-01', vencimiento: '2027-05-01' });
  const ics = C.generarICS(e, '2026-10-25');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes('RRULE:FREQ=MONTHLY;BYMONTHDAY=15'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261115'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261028'));
  assert.ok(ics.includes('RRULE:FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=2'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261215'));
  assert.ok(ics.includes('TRIGGER;RELATED=START:-P15D'));
  assert.ok(ics.includes('Caja\\; Cusco'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, (ics.match(/END:VEVENT/g) || []).length);
});

test('CSV: ida y vuelta y errores claros según el perfil', () => {
  const p = perfilEjemplo();
  const movs = [
    { id: 'a', fecha: '2026-10-25', tipo: 'gasto', categoria: 'comida', monto: 25.5, moneda: 'PEN', tc: 3.43, nota: 'Pollo, "a la brasa"\ncon papas' },
    { id: 'b', fecha: '2026-10-26', tipo: 'aporte', categoria: 'etf', monto: 100, moneda: 'USD', tc: 3.44, nota: '' },
  ];
  const vuelta = C.parsearCSV(C.movimientosACSV(movs), p);
  assert.equal(vuelta[0].nota, movs[0].nota);
  assert.equal(vuelta[1].moneda, 'USD');
  assert.throws(() => C.parsearCSV('fecha,tipo\n2026-01-01,gasto\n', p), /Falta la columna/);
  assert.throws(() => C.parsearCSV('fecha,tipo,categoria,monto,moneda\n2026-01-01,gasto,comida,-5,PEN\n', p), /Monto inválido/);
  assert.throws(() => C.parsearCSV('fecha,tipo,categoria,monto,moneda\n2026-01-01,gasto,etf,5,PEN\n', p), /no existe/);
});

test('respaldo: valida y rechaza datos corruptos', () => {
  const e = estadoEjemplo();
  e.configurado = true;
  const r = C.validarRespaldo(JSON.parse(JSON.stringify(e)));
  assert.equal(r.perfil.tc, 3.5);
  assert.throws(() => C.validarRespaldo({ version: 99, movimientos: [], plazos: [] }), /Versión/);
  assert.throws(() => C.validarRespaldo({ ...e, plazos: [{ entidad: 'X', monto: 0 }] }), /Plazo fijo inválido/);
  const dup = JSON.parse(JSON.stringify(e));
  dup.perfil.bolsas.push({ ...dup.perfil.bolsas[0] });
  assert.throws(() => C.validarRespaldo(dup), /repetidos/);

});

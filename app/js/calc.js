// Lógica pura (sin DOM) para poder probarla con `node --test`.
// Todo depende del perfil del usuario (estado.perfil): monedas, ingresos, bolsas, categorías y eventos.

import { plantillaGenerica } from './plantillas.js';

export const VERSION_DATOS = 2;

export const TIPOS = {
  gasto: 'Gasto',
  ingreso: 'Ingreso',
  aporte: 'Ahorro / inversión',
  retiro: 'Retiro',
};

export function estadoInicial(perfil = plantillaGenerica()) {
  return {
    version: VERSION_DATOS,
    configurado: false,
    perfil,
    movimientos: [],
    plazos: [],
    valoraciones: {}, // { bolsaId: { monto, moneda, fecha } } valor de mercado ingresado a mano
    snapshots: {}, // { 'YYYY-MM': patrimonio en moneda principal }
    hechos: {}, // { 'YYYY-MM-DD:clave': true } recordatorios marcados como hechos
    reglas: {}, // { 'RAPPI PERU': 'comida' } categorías aprendidas al revisar capturas
  };
}

// ---------- Fechas ----------

export function hoyISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function partes(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

const pad = (n) => String(n).padStart(2, '0');

export function diasEntre(desdeISO, hastaISO) {
  const a = partes(desdeISO);
  const b = partes(hastaISO);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

export function sumarDias(iso, n) {
  const { y, m, d } = partes(iso);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function sumarMeses(iso, n) {
  const { y, m, d } = partes(iso);
  const total = y * 12 + (m - 1) + n;
  const yy = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${yy}-${pad(mm)}-${pad(Math.min(d, diasDelMes(yy, mm)))}`;
}

export function diasDelMes(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function mesDe(iso) {
  return iso.slice(0, 7);
}

export function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Día de pago efectivo: si el mes no tiene ese día (p. ej. 31), se usa el último día.
function diaEfectivo(dia, y, m) {
  return Math.min(dia, diasDelMes(y, m));
}

// ---------- Dinero ----------

export function aPrincipal(monto, moneda, perfil, tc = perfil.tc) {
  if (moneda === perfil.moneda || !moneda) return monto;
  if (moneda === perfil.monedaSecundaria) return monto * tc;
  return monto;
}

export function desdePrincipal(monto, moneda, perfil) {
  if (moneda === perfil.monedaSecundaria && perfil.tc > 0) return monto / perfil.tc;
  return monto;
}

export function redondear(n, dec = 2) {
  const f = 10 ** dec;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function formatoMoneda(n, moneda = 'PEN', { decimales = 2 } = {}) {
  try {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda, minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n);
  } catch {
    return `${moneda} ${n.toFixed(decimales)}`;
  }
}

// ---------- Perfil: búsquedas ----------

export function bolsa(perfil, id) {
  return perfil.bolsas.find((b) => b.id === id);
}

export function categoriasDe(perfil, tipo) {
  if (tipo === 'ingreso') return perfil.categoriasIngreso;
  if (tipo === 'gasto') return perfil.categoriasGasto;
  return perfil.bolsas;
}

export function categoria(perfil, tipo, id) {
  return categoriasDe(perfil, tipo).find((c) => c.id === id);
}

// ---------- Reparto del ahorro ----------

export function sumaPorcentajes(perfil) {
  return redondear(perfil.bolsas.filter((b) => b.modo === 'pct').reduce((s, b) => s + (Number(b.valor) || 0), 0));
}

// Monto mensual (en moneda principal) que recibe cada bolsa:
// primero las de monto fijo, y el resto del ahorro se reparte según los porcentajes.
export function repartoMensual(perfil) {
  const fijos = perfil.bolsas.filter((b) => b.modo === 'fijo').reduce((s, b) => s + (Number(b.valor) || 0), 0);
  const resto = Math.max((perfil.ahorroMensual || 0) - fijos, 0);
  const out = {};
  for (const b of perfil.bolsas) out[b.id] = redondear(b.modo === 'fijo' ? Number(b.valor) || 0 : (resto * (Number(b.valor) || 0)) / 100);
  return out;
}

export function ingresoMensualTotal(perfil) {
  return perfil.ingresos.reduce((s, i) => s + aPrincipal(Number(i.monto) || 0, i.moneda, perfil), 0);
}

// Instrucciones para el día de pago de un ingreso. El ahorro y el presupuesto se reparten
// entre los días de pago en proporción a lo que aporta cada ingreso.
export function planDiaPago(perfil, ingreso) {
  const total = ingresoMensualTotal(perfil);
  const montoPrincipal = aPrincipal(Number(ingreso.monto) || 0, ingreso.moneda, perfil);
  const proporcion = total > 0 ? montoPrincipal / total : 0;
  const M = (n, mon = perfil.moneda) => formatoMoneda(n, mon);
  const pasos = [];
  if (ingreso.nota) pasos.push(ingreso.nota);
  const impuesto = redondear((montoPrincipal * (Number(ingreso.impuestoPct) || 0)) / 100);
  if (impuesto > 0) pasos.push(`Aparta ${M(impuesto)} para impuestos (${ingreso.impuestoPct}% de ${M(montoPrincipal)}).`);
  const gastos = redondear((perfil.presupuestoGastos || 0) * proporcion);
  if (gastos > 0) pasos.push(`Pasa ${M(gastos)} a tu cuenta de gastos.`);
  const reparto = repartoMensual(perfil);
  const destinos = [];
  for (const b of perfil.bolsas) {
    const monto = redondear(reparto[b.id] * proporcion);
    if (monto <= 0) continue;
    const enMonedaBolsa = b.moneda && b.moneda !== perfil.moneda ? ` (${M(redondear(desdePrincipal(monto, b.moneda, perfil)), b.moneda)})` : '';
    pasos.push(`${b.nombre}: ${M(monto)}${enMonedaBolsa}.`);
    destinos.push({ bolsa: b.id, monto });
  }
  return {
    titulo: `Día ${ingreso.dia} — ${ingreso.nombre}`,
    pasos,
    montos: { impuesto, gastos, destinos, proporcion: redondear(proporcion, 4) },
  };
}

// Movimientos que genera "Registrar y repartir" para un pago real.
// Escala el plan del día según el monto real recibido (si llegó más o menos de lo previsto).
export function movimientosDePago(perfil, ingreso, montoReal, fecha, tc = perfil.tc) {
  const plan = planDiaPago(perfil, ingreso);
  const previsto = Number(ingreso.monto) || 0;
  const factor = previsto > 0 ? montoReal / previsto : 0;
  const lineas = [{ tipo: 'ingreso', categoria: ingreso.categoria, monto: redondear(montoReal), moneda: ingreso.moneda, nota: ingreso.nombre }];
  if (plan.montos.impuesto > 0 && categoria(perfil, 'gasto', 'impuestos')) {
    lineas.push({ tipo: 'gasto', categoria: 'impuestos', monto: redondear(plan.montos.impuesto * factor), moneda: perfil.moneda, nota: `Impuesto de ${ingreso.nombre} (${ingreso.impuestoPct}%)` });
  }
  for (const d of plan.montos.destinos) {
    const b = bolsa(perfil, d.bolsa);
    const enMoneda = redondear(desdePrincipal(d.monto * factor, b.moneda || perfil.moneda, { ...perfil, tc }));
    if (enMoneda > 0) lineas.push({ tipo: 'aporte', categoria: b.id, monto: enMoneda, moneda: b.moneda || perfil.moneda, nota: `Reparto de ${ingreso.nombre}` });
  }
  return lineas.map((l) => ({ ...l, fecha, tc }));
}

// ---------- Avisos bancarios (texto copiado de una notificación, SMS o correo) ----------

function aNumero(s) {
  // Acepta 1,234.50 · 1.234,50 · 1234.5 · 4500
  const limpio = s.replace(/\s/g, '');
  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');
  let n;
  if (ultimaComa > ultimoPunto) n = /,\d{1,2}$/.test(limpio) ? limpio.replace(/\./g, '').replace(',', '.') : limpio.replace(/,/g, '');
  else n = limpio.replace(/,/g, '');
  return Number(n);
}

const MONEDA_TEXTO = [
  [/US\s?\$|USD|U\$S|d[oó]lares?/i, 'USD'],
  [/S\/\.?|PEN|soles?/i, 'PEN'],
  [/€|EUR|euros?/i, 'EUR'],
  [/MXN|COP|CLP|ARS/i, null],
];

// Extrae monto, moneda y fecha de un aviso bancario y sugiere a qué ingreso corresponde.
export function parsearAviso(texto, perfil) {
  if (!texto || typeof texto !== 'string') return null;
  const t = texto.replace(/ /g, ' ');
  const patron = /(US\s?\$|USD|U\$S|S\/\.?|PEN|EUR|€|\$)\s*([0-9][0-9.,]*[0-9]|[0-9])|([0-9][0-9.,]*[0-9])\s*(USD|PEN|soles|d[oó]lares|EUR)/gi;
  const candidatos = [];
  for (const m of t.matchAll(patron)) {
    const simbolo = m[1] || m[4];
    const monto = aNumero(m[2] || m[3]);
    if (!(monto > 0)) continue;
    let moneda = null;
    for (const [re, cod] of MONEDA_TEXTO) {
      if (re.test(simbolo)) {
        moneda = cod;
        break;
      }
    }
    if (!moneda && simbolo === '$') moneda = perfil.monedaSecundaria === 'USD' || perfil.moneda === 'USD' ? 'USD' : null;
    if (moneda) candidatos.push({ monto, moneda, pos: m.index });
  }
  if (!candidatos.length) return null;
  // Preferimos el monto que aparece cerca de palabras de abono/depósito; si no, el primero.
  const claves = /abono|dep[oó]sit|recib|transferencia|ingreso|haber|pago de planilla|remuneraci/i;
  const idxClave = t.search(claves);
  const elegido = idxClave >= 0 ? candidatos.reduce((a, b) => (Math.abs(b.pos - idxClave) < Math.abs(a.pos - idxClave) ? b : a)) : candidatos[0];

  let fecha = null;
  const f1 = t.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  const f2 = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (f2) fecha = `${f2[1]}-${f2[2]}-${f2[3]}`;
  else if (f1) {
    const y = f1[3].length === 2 ? `20${f1[3]}` : f1[3];
    const d = Number(f1[1]);
    const mo = Number(f1[2]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) fecha = `${y}-${pad(mo)}-${pad(d)}`;
  }

  // Ingreso sugerido: misma moneda y monto más parecido (tolerancia de 25%).
  let ingreso = null;
  let mejor = Infinity;
  for (const i of perfil.ingresos) {
    if (i.moneda !== elegido.moneda || !(i.monto > 0)) continue;
    const dif = Math.abs(i.monto - elegido.monto) / i.monto;
    if (dif < mejor && dif <= 0.25) {
      mejor = dif;
      ingreso = i;
    }
  }
  return { monto: elegido.monto, moneda: elegido.moneda, fecha, ingreso };
}

// ---------- Lectura de capturas con IA ----------

// Clave corta de un comercio o descripción para recordar su categoría ("RAPPI*PERU 123" → "RAPPI PERU").
export function claveRegla(descripcion) {
  return String(descripcion || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .join(' ');
}

// Esquema JSON que debe devolver la IA (structured outputs).
export function esquemaExtraccion(perfil) {
  const cats = [...new Set([...perfil.categoriasGasto.map((c) => c.id), ...perfil.categoriasIngreso.map((c) => c.id)])];
  return {
    type: 'object',
    additionalProperties: false,
    required: ['movimientos', 'plazosFijos'],
    properties: {
      movimientos: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['fecha', 'descripcion', 'monto', 'moneda', 'tipo', 'categoria'],
          properties: {
            fecha: { type: 'string', description: 'YYYY-MM-DD' },
            descripcion: { type: 'string' },
            monto: { type: 'number', description: 'Siempre positivo' },
            moneda: { type: 'string', enum: ['PEN', 'USD', 'EUR'] },
            tipo: { type: 'string', enum: ['gasto', 'ingreso', 'transferencia_propia'] },
            categoria: { type: 'string', enum: cats },
          },
        },
      },
      plazosFijos: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['entidad', 'monto', 'moneda', 'tasa', 'inicio', 'vencimiento'],
          properties: {
            entidad: { type: 'string' },
            monto: { type: 'number' },
            moneda: { type: 'string', enum: ['PEN', 'USD', 'EUR'] },
            tasa: { type: 'number', description: 'TEA en %' },
            inicio: { type: 'string', description: 'YYYY-MM-DD' },
            vencimiento: { type: 'string', description: 'YYYY-MM-DD' },
          },
        },
      },
    },
  };
}

export function promptExtraccion(perfil, hoy, reglas = {}) {
  const lista = (cs) => cs.map((c) => `${c.id} (${c.nombre})`).join(', ');
  const aprendidas = Object.entries(reglas).slice(0, 40).map(([k, v]) => `${k} → ${v}`).join('; ');
  return [
    `Hoy es ${hoy}. Estas son capturas de pantalla de apps bancarias peruanas (BCP, Interbank u otras) de una persona.`,
    'Extrae cada movimiento visible una sola vez. No inventes movimientos que no se vean.',
    'Reglas:',
    '- monto siempre positivo; "tipo" indica la dirección: gasto (cargo, compra, pago, retiro), ingreso (abono, sueldo, depósito recibido) o transferencia_propia (entre cuentas de la misma persona, a su plazo fijo, cambio de moneda propio).',
    '- Si la fecha no muestra el año, usa el año actual; si eso la deja en el futuro, usa el año anterior. Formato YYYY-MM-DD.',
    `- categoria para gastos: ${lista(perfil.categoriasGasto)}.`,
    `- categoria para ingresos: ${lista(perfil.categoriasIngreso)}.`,
    '- Para transferencia_propia usa la categoría que mejor encaje (por ejemplo "otros").',
    `- Sus ingresos habituales: ${perfil.ingresos.map((i) => `${i.nombre} (~${i.monto} ${i.moneda}, día ${i.dia})`).join('; ') || 'no indicados'}.`,
    aprendidas ? `- Categorías que la persona ya eligió antes para estos comercios: ${aprendidas}.` : '',
    '- Si una captura muestra la constancia o el detalle de un depósito a plazo fijo, agrégalo en plazosFijos (entidad, monto, moneda, TEA %, fecha de inicio y de vencimiento) y NO lo repitas en movimientos.',
    '- Si no hay nada, devuelve listas vacías.',
  ]
    .filter(Boolean)
    .join('\n');
}

const MONEDAS_VALIDAS = /^[A-Z]{3}$/;

// Convierte la respuesta de la IA en propuestas listas para revisar: valida, aplica reglas aprendidas
// y marca posibles duplicados (misma fecha, monto, moneda y tipo que un movimiento ya registrado).
export function normalizarExtraccion(json, perfil, existentes = [], reglas = {}) {
  const fechaOk = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f || '');
  const movimientos = (json?.movimientos || [])
    .filter((m) => m && Number(m.monto) > 0 && MONEDAS_VALIDAS.test(m.moneda || '') && fechaOk(m.fecha))
    .map((m) => {
      const esTransferencia = m.tipo === 'transferencia_propia';
      const tipo = m.tipo === 'ingreso' ? 'ingreso' : 'gasto';
      const cats = tipo === 'ingreso' ? perfil.categoriasIngreso : perfil.categoriasGasto;
      const aprendida = reglas[claveRegla(m.descripcion)];
      let cat = aprendida && cats.some((c) => c.id === aprendida) ? aprendida : m.categoria;
      if (!cats.some((c) => c.id === cat)) cat = (cats.find((c) => /^otro/.test(c.id)) || cats.at(-1))?.id;
      const monto = redondear(Number(m.monto));
      const duplicado = existentes.some((e) => e.fecha === m.fecha && e.moneda === m.moneda && e.tipo === tipo && Math.abs(e.monto - monto) < 0.005);
      return { fecha: m.fecha, descripcion: String(m.descripcion || '').slice(0, 120), monto, moneda: m.moneda, tipo, categoria: cat, transferencia: esTransferencia, duplicado, incluir: !esTransferencia && !duplicado };
    });
  const plazos = (json?.plazosFijos || [])
    .filter((x) => x && x.entidad && Number(x.monto) > 0 && Number(x.tasa) >= 0 && fechaOk(x.inicio) && fechaOk(x.vencimiento) && diasEntre(x.inicio, x.vencimiento) > 0)
    .map((x) => ({ entidad: String(x.entidad).slice(0, 60), monto: redondear(Number(x.monto)), moneda: x.moneda, tasa: Number(x.tasa), inicio: x.inicio, vencimiento: x.vencimiento, incluir: true }));
  return { movimientos, plazos };
}

// ---------- Ajuste de saldo real ----------

// Movimiento que lleva el saldo de una bolsa al saldo real informado.
// Si es interés o rendimiento, no cuenta como aporte (no infla lo "aportado").
export function movimientoAjuste(saldoActual, saldoReal, bolsaId, moneda, fecha, esRendimiento = true) {
  const dif = redondear(saldoReal - saldoActual);
  if (dif === 0) return null;
  return {
    id: nuevoId(),
    fecha,
    tipo: dif > 0 ? 'aporte' : 'retiro',
    categoria: bolsaId,
    monto: Math.abs(dif),
    moneda,
    nota: esRendimiento ? 'Ajuste de saldo (intereses)' : 'Ajuste de saldo',
    ...(esRendimiento ? { rendimiento: true } : {}),
  };
}

// ---------- Plazos fijos ----------

// Interés con TEA (convención de año de 360 días).
export function interesPF(monto, teaPct, dias) {
  if (dias <= 0) return 0;
  return monto * ((1 + teaPct / 100) ** (dias / 360) - 1);
}

export function infoPF(pf, hoy = hoyISO()) {
  const plazo = diasEntre(pf.inicio, pf.vencimiento);
  const transcurridos = Math.min(Math.max(diasEntre(pf.inicio, hoy), 0), plazo);
  const interesFinal = interesPF(pf.monto, pf.tasa, plazo);
  const diasRestantes = diasEntre(hoy, pf.vencimiento);
  return {
    plazo,
    diasRestantes,
    avance: plazo > 0 ? transcurridos / plazo : 1,
    interesFinal: redondear(interesFinal),
    interesDevengado: redondear(interesPF(pf.monto, pf.tasa, transcurridos)),
    montoFinal: redondear(pf.monto + interesFinal),
    vencido: diasRestantes < 0,
  };
}

export function alertasPF(plazos, hoy, diasAviso) {
  return plazos
    .filter((pf) => pf.estado !== 'cerrado')
    .map((pf) => ({ pf, ...infoPF(pf, hoy) }))
    .filter((x) => x.diasRestantes <= diasAviso)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
}

export function concentracionPorEntidad(estado) {
  const p = estado.perfil;
  const out = {};
  for (const pf of estado.plazos) {
    if (pf.estado === 'cerrado') continue;
    out[pf.entidad] = (out[pf.entidad] || 0) + aPrincipal(pf.monto, pf.moneda, p);
  }
  return out;
}

// ---------- Saldos y patrimonio ----------

export function saldosPorBolsa(estado, hoy = hoyISO()) {
  const p = estado.perfil;
  const res = {};
  for (const b of p.bolsas) res[b.id] = { aportado: 0, neto: {}, interesPF: 0, valor: 0, rendimiento: 0, rendimientoPct: 0 };
  for (const m of estado.movimientos) {
    if (m.tipo !== 'aporte' && m.tipo !== 'retiro') continue;
    const r = res[m.categoria];
    if (!r) continue;
    const signo = m.tipo === 'aporte' ? 1 : -1;
    // Lo aportado se mide con el tipo de cambio del día; los intereses cobrados (m.rendimiento) no cuentan como aporte.
    if (!m.rendimiento) r.aportado += signo * aPrincipal(m.monto, m.moneda, p, m.tc || p.tc);
    r.neto[m.moneda] = (r.neto[m.moneda] || 0) + signo * m.monto;
  }
  for (const pf of estado.plazos) {
    if (pf.estado === 'cerrado') continue;
    const r = res[pf.bolsa];
    if (r) r.interesPF += aPrincipal(infoPF(pf, hoy).interesDevengado, pf.moneda, p);
  }
  for (const [id, r] of Object.entries(res)) {
    const val = estado.valoraciones?.[id];
    const neto = Object.entries(r.neto).reduce((s, [mon, v]) => s + aPrincipal(v, mon, p), 0);
    r.valor = redondear(val ? aPrincipal(val.monto, val.moneda, p) : neto + r.interesPF);
    r.aportado = redondear(r.aportado);
    r.interesPF = redondear(r.interesPF);
    r.rendimiento = redondear(r.valor - r.aportado);
    r.rendimientoPct = r.aportado > 0 ? redondear((r.rendimiento / r.aportado) * 100) : 0;
  }
  return res;
}

export function patrimonioTotal(saldos) {
  return redondear(Object.values(saldos).reduce((s, r) => s + r.valor, 0));
}

// Avance hacia la meta de una bolsa y fecha estimada al ritmo del plan (sin contar intereses).
export function progresoMeta(estado, saldos, bolsaId, hoy = hoyISO()) {
  const p = estado.perfil;
  const b = bolsa(p, bolsaId);
  if (!b) return null;
  const valor = saldos[bolsaId]?.valor || 0;
  const meta = Number(b.meta) || 0;
  const falta = Math.max(meta - valor, 0);
  const aporte = repartoMensual(p)[bolsaId] || 0;
  const meses = falta === 0 ? 0 : aporte > 0 ? Math.ceil(falta / aporte) : null;
  const fechaEstimada = meses == null ? null : sumarMeses(hoy, meses);
  const mesesHastaMeta = b.fechaMeta ? Math.max(Math.ceil(diasEntre(hoy, b.fechaMeta) / 30.44), 0) : null;
  return {
    bolsa: b,
    valor,
    meta,
    pct: meta > 0 ? Math.min((valor / meta) * 100, 100) : 0,
    pctMinimo: b.metaMinima > 0 ? Math.min((valor / b.metaMinima) * 100, 100) : null,
    falta: redondear(falta),
    aporteMensual: aporte,
    meses,
    fechaEstimada,
    aTiempo: b.fechaMeta && fechaEstimada ? fechaEstimada <= b.fechaMeta : null,
    necesarioMensual: mesesHastaMeta ? redondear(falta / mesesHastaMeta) : null,
  };
}

// Serie mensual continua: usa los snapshots guardados y, si falta alguno, el aporte neto acumulado.
export function seriePatrimonio(estado, hoy = hoyISO()) {
  const p = estado.perfil;
  const porMes = {};
  for (const m of estado.movimientos) {
    if (m.tipo !== 'aporte' && m.tipo !== 'retiro') continue;
    const mes = mesDe(m.fecha);
    porMes[mes] = (porMes[mes] || 0) + (m.tipo === 'aporte' ? 1 : -1) * aPrincipal(m.monto, m.moneda, p, m.tc || p.tc);
  }
  const conocidos = [...Object.keys(porMes), ...Object.keys(estado.snapshots || {}), mesDe(hoy)].sort();
  const meses = [];
  let [y, m] = conocidos[0].split('-').map(Number);
  for (;;) {
    const mes = `${y}-${pad(m)}`;
    if (mes > conocidos.at(-1)) break;
    meses.push(mes);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  let acum = 0;
  return meses.map((mes) => {
    acum += porMes[mes] || 0;
    return { mes, valor: redondear(estado.snapshots?.[mes] ?? acum) };
  });
}

export function variacion(serie) {
  if (serie.length < 2) return null;
  const [a, b] = serie.slice(-2).map((x) => x.valor);
  return { absoluta: redondear(b - a), pct: a ? redondear(((b - a) / Math.abs(a)) * 100, 1) : null };
}

export function resumenMes(movimientos, mes, perfil) {
  const r = { ingresos: 0, gastos: 0, aportes: 0, retiros: 0, gastosPorCategoria: {} };
  for (const m of movimientos) {
    if (mesDe(m.fecha) !== mes) continue;
    const v = aPrincipal(m.monto, m.moneda, perfil, m.tc || perfil.tc);
    if (m.tipo === 'ingreso') r.ingresos += v;
    else if (m.tipo === 'gasto') {
      r.gastos += v;
      r.gastosPorCategoria[m.categoria] = (r.gastosPorCategoria[m.categoria] || 0) + v;
    } else if (m.tipo === 'aporte' && !m.rendimiento && !m.inicial) r.aportes += v; // saldos iniciales e intereses no son ahorro del mes
    else if (m.tipo === 'retiro') r.retiros += v;
  }
  r.sinAsignar = r.ingresos - r.gastos - r.aportes + r.retiros;
  r.tasaAhorro = r.ingresos > 0 ? ((r.aportes - r.retiros) / r.ingresos) * 100 : 0;
  for (const k of ['ingresos', 'gastos', 'aportes', 'retiros', 'sinAsignar', 'tasaAhorro']) r[k] = redondear(r[k]);
  for (const k of Object.keys(r.gastosPorCategoria)) r.gastosPorCategoria[k] = redondear(r.gastosPorCategoria[k]);
  return r;
}

// ---------- Recordatorios ----------

function eventoEnFecha(ev, y, m, d) {
  const dia = diaEfectivo(ev.dia, y, m);
  if (d !== dia) return false;
  if (ev.frecuencia === 'mensual') return true;
  if (ev.frecuencia === 'trimestral') return (((m - ev.mes) % 3) + 3) % 3 === 0;
  return m === ev.mes;
}

export function recordatorios(estado, hoy = hoyISO(), horizonte = 7) {
  const p = estado.perfil;
  const out = [];
  for (let i = 0; i <= horizonte; i++) {
    const f = sumarDias(hoy, i);
    const { y, m, d } = partes(f);
    const push = (clave, r) => out.push({ fecha: f, enDias: i, clave: `${f}:${clave}`, ...r });
    for (const ing of p.ingresos) {
      if (d === diaEfectivo(ing.dia, y, m)) {
        const plan = planDiaPago(p, ing);
        push(`pago-${ing.id}`, { tipo: 'pago', icono: 'banknote', titulo: plan.titulo, detalle: `Reparte tu ingreso de ${ing.nombre}.`, pasos: plan.pasos });
      }
    }
    for (const ev of p.eventos) {
      if (eventoEnFecha(ev, y, m, d)) push(ev.id, { tipo: 'evento', icono: 'calendar', titulo: ev.titulo, detalle: ev.detalle });
    }
  }
  for (const a of alertasPF(estado.plazos, hoy, p.alertaPFdias)) {
    out.push({
      tipo: 'pf',
      icono: 'landmark',
      fecha: a.pf.vencimiento,
      enDias: a.diasRestantes,
      clave: `${a.pf.vencimiento}:pf-${a.pf.id}`,
      titulo: a.vencido ? `Plazo fijo vencido — ${a.pf.entidad}` : `Vence plazo fijo — ${a.pf.entidad}`,
      detalle: `${formatoMoneda(a.pf.monto, a.pf.moneda)} al ${a.pf.tasa}% → ≈ ${formatoMoneda(a.montoFinal, a.pf.moneda)}. Decide: renovar, cambiar de entidad o usarlo.`,
    });
  }
  return out.sort((a, b) => a.enDias - b.enDias);
}

// ---------- Calendario (.ics) ----------

const icsFecha = (iso) => iso.replaceAll('-', '');
const icsTexto = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

function vevento({ uid, inicio, titulo, descripcion, rrule, alarmas = ['PT9H'], stamp }) {
  const l = ['BEGIN:VEVENT', `UID:${uid}@mis-finanzas`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsFecha(inicio)}`, `DTEND;VALUE=DATE:${icsFecha(sumarDias(inicio, 1))}`, `SUMMARY:${icsTexto(titulo)}`, `DESCRIPTION:${icsTexto(descripcion)}`];
  if (rrule) l.push(`RRULE:${rrule}`);
  for (const t of alarmas) l.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsTexto(titulo)}`, `TRIGGER;RELATED=START:${t}`, 'END:VALARM');
  l.push('END:VEVENT');
  return l;
}

// Próxima fecha >= desde que cumple la condición del evento.
function proximaFecha(desde, cumple) {
  for (let i = 0; i < 800; i++) {
    const f = sumarDias(desde, i);
    const { y, m, d } = partes(f);
    if (cumple(y, m, d)) return f;
  }
  return desde;
}

export function generarICS(estado, desde = hoyISO()) {
  const p = estado.perfil;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mis Finanzas//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Mis finanzas'];
  for (const ing of p.ingresos) {
    const plan = planDiaPago(p, ing);
    const byDay = ing.dia >= 31 ? -1 : ing.dia;
    const inicio = proximaFecha(desde, (y, m, d) => d === diaEfectivo(ing.dia, y, m));
    l.push(...vevento({ uid: `pago-${ing.id}`, inicio, titulo: plan.titulo, descripcion: plan.pasos.join('\n'), rrule: `FREQ=MONTHLY;BYMONTHDAY=${byDay}`, stamp }));
  }
  for (const ev of p.eventos) {
    const inicio = proximaFecha(desde, (y, m, d) => eventoEnFecha(ev, y, m, d));
    const rrule = ev.frecuencia === 'mensual' ? `FREQ=MONTHLY;BYMONTHDAY=${ev.dia}` : ev.frecuencia === 'trimestral' ? `FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=${ev.dia}` : 'FREQ=YEARLY';
    l.push(...vevento({ uid: `ev-${ev.id}`, inicio, titulo: ev.titulo, descripcion: ev.detalle || '', rrule, stamp }));
  }
  for (const pf of estado.plazos) {
    if (pf.estado === 'cerrado' || diasEntre(desde, pf.vencimiento) < 0) continue;
    const info = infoPF(pf, desde);
    l.push(
      ...vevento({
        uid: `pf-${pf.id}`,
        inicio: pf.vencimiento,
        titulo: `Vence plazo fijo — ${pf.entidad}`,
        descripcion: `${formatoMoneda(pf.monto, pf.moneda)} al ${pf.tasa}% → ≈ ${formatoMoneda(info.montoFinal, pf.moneda)}`,
        alarmas: [`-P${p.alertaPFdias}D`, '-P1D'],
        stamp,
      }),
    );
  }
  l.push('END:VCALENDAR');
  return l.join('\r\n') + '\r\n';
}

// ---------- CSV / JSON ----------

const COLUMNAS_CSV = ['id', 'fecha', 'tipo', 'categoria', 'monto', 'moneda', 'tc', 'nota'];

function celda(v) {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function movimientosACSV(movs) {
  return [COLUMNAS_CSV.join(','), ...movs.map((m) => COLUMNAS_CSV.map((c) => celda(m[c])).join(','))].join('\n') + '\n';
}

export function parsearCSV(texto, perfil) {
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  const [cab, ...datos] = filas.filter((f) => f.some((x) => x !== ''));
  if (!cab) return [];
  const idx = Object.fromEntries(cab.map((c, i) => [c.trim(), i]));
  for (const c of ['fecha', 'tipo', 'categoria', 'monto', 'moneda']) {
    if (!(c in idx)) throw new Error(`Falta la columna "${c}" en el CSV`);
  }
  return datos.map((f) =>
    validarMovimiento(
      {
        id: f[idx.id] || nuevoId(),
        fecha: f[idx.fecha],
        tipo: f[idx.tipo],
        categoria: f[idx.categoria],
        monto: Number(f[idx.monto]),
        moneda: f[idx.moneda],
        tc: idx.tc != null && f[idx.tc] ? Number(f[idx.tc]) : undefined,
        nota: idx.nota != null ? f[idx.nota] : '',
      },
      perfil,
    ),
  );
}

export function validarMovimiento(m, perfil) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha)) throw new Error(`Fecha inválida: ${m.fecha}`);
  if (!TIPOS[m.tipo]) throw new Error(`Tipo inválido: ${m.tipo}`);
  if (!categoria(perfil, m.tipo, m.categoria)) throw new Error(`Categoría "${m.categoria}" no existe para ${TIPOS[m.tipo]}. Créala en Ajustes.`);
  if (!Number.isFinite(m.monto) || m.monto <= 0) throw new Error(`Monto inválido: ${m.monto}`);
  if (!/^[A-Z]{3}$/.test(m.moneda || '')) throw new Error(`Moneda inválida: ${m.moneda}`);
  return m;
}

export function validarPerfil(p) {
  if (!p || typeof p !== 'object') throw new Error('Perfil inválido');
  if (!/^[A-Z]{3}$/.test(p.moneda || '')) throw new Error('Moneda principal inválida');
  for (const lista of ['ingresos', 'bolsas', 'categoriasGasto', 'categoriasIngreso', 'eventos']) {
    if (!Array.isArray(p[lista])) throw new Error(`Falta la lista "${lista}" en el perfil`);
    const ids = p[lista].map((x) => x.id);
    if (new Set(ids).size !== ids.length) throw new Error(`Hay ids repetidos en "${lista}"`);
  }
  return p;
}

export function validarRespaldo(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('El archivo no es un respaldo válido');
  if (obj.version !== VERSION_DATOS) throw new Error(`Versión de datos no soportada: ${obj.version}`);
  if (!Array.isArray(obj.movimientos) || !Array.isArray(obj.plazos)) throw new Error('Faltan movimientos o plazos');
  const perfil = validarPerfil({ ...plantillaGenerica(), ...obj.perfil });
  obj.movimientos.forEach((m) => validarMovimiento(m, perfil));
  for (const pf of obj.plazos) {
    if (!pf.entidad || !(pf.monto > 0) || !(pf.tasa >= 0) || !pf.inicio || !pf.vencimiento) throw new Error(`Plazo fijo inválido: ${JSON.stringify(pf)}`);
  }
  return { ...estadoInicial(perfil), ...obj, perfil, configurado: obj.configurado ?? true };
}

// Solo el perfil (sin movimientos): para compartir una configuración o cargar la tuya en otro teléfono.
export function exportarPerfil(estado) {
  return { tipo: 'perfil-mis-finanzas', version: VERSION_DATOS, perfil: estado.perfil };
}

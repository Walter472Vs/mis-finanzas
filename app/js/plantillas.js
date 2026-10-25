// Plantillas de perfil. Cualquiera puede partir de una y editar todo después en Ajustes.

export const MONEDAS = {
  PEN: 'Sol peruano (S/)',
  USD: 'Dólar estadounidense (US$)',
  EUR: 'Euro (€)',
  MXN: 'Peso mexicano',
  COP: 'Peso colombiano',
  CLP: 'Peso chileno',
  ARS: 'Peso argentino',
  BOB: 'Boliviano',
  BRL: 'Real brasileño',
  GBP: 'Libra esterlina',
};

export const COLORES = ['#22d3ee', '#a78bfa', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#fb7185', '#2dd4bf', '#c084fc', '#94a3b8'];

export const ICONOS_BOLSA = ['shield-check', 'house', 'trending-up', 'bitcoin', 'vault', 'receipt', 'piggy-bank', 'plane', 'graduation-cap', 'car', 'gem', 'rocket', 'gift', 'baby', 'heart-pulse', 'wallet', 'landmark', 'target'];

export const ICONOS_CATEGORIA = ['house', 'utensils', 'car', 'bus', 'fuel', 'party-popper', 'shopping-bag', 'shirt', 'heart-pulse', 'dumbbell', 'graduation-cap', 'book-open', 'tv', 'music', 'smartphone', 'users', 'baby', 'dog', 'plane', 'gift', 'receipt', 'zap', 'briefcase', 'laptop', 'coins', 'banknote', 'percent', 'hand-coins', 'sparkles', 'circle-dollar-sign'];

const base = () => ({
  nombre: '',
  moneda: 'USD',
  monedaSecundaria: null,
  tc: 1,
  tcFecha: '',
  tcFuente: 'Manual',
  tcAuto: true,
  tema: 'oscuro',
  acento: '#22d3ee',
  ocultarMontos: false,
  presupuestoGastos: 0,
  ahorroMensual: 0,
  alertaPFdias: 15,
  limitePorEntidad: 0,
  metaPrincipal: null,
  ingresos: [],
  bolsas: [],
  categoriasGasto: [
    { id: 'hogar', nombre: 'Hogar', icono: 'house' },
    { id: 'comida', nombre: 'Comida', icono: 'utensils' },
    { id: 'transporte', nombre: 'Transporte', icono: 'car' },
    { id: 'salidas', nombre: 'Salidas', icono: 'party-popper' },
    { id: 'compras', nombre: 'Compras', icono: 'shopping-bag' },
    { id: 'salud', nombre: 'Salud', icono: 'heart-pulse' },
    { id: 'educacion', nombre: 'Educación', icono: 'graduation-cap' },
    { id: 'suscripciones', nombre: 'Suscripciones', icono: 'tv' },
    { id: 'familia', nombre: 'Familia', icono: 'users' },
    { id: 'impuestos', nombre: 'Impuestos', icono: 'receipt' },
    { id: 'otros', nombre: 'Otros', icono: 'sparkles' },
  ],
  categoriasIngreso: [
    { id: 'sueldo', nombre: 'Sueldo', icono: 'briefcase' },
    { id: 'freelance', nombre: 'Freelance', icono: 'laptop' },
    { id: 'bono', nombre: 'Bono', icono: 'gift' },
    { id: 'intereses', nombre: 'Intereses', icono: 'percent' },
    { id: 'otro', nombre: 'Otro ingreso', icono: 'coins' },
  ],
  eventos: [
    { id: 'trimestral', titulo: 'Revisión trimestral', detalle: 'Compara tasas y revisa tu plan.', frecuencia: 'trimestral', mes: 1, dia: 2 },
    { id: 'respaldo', titulo: 'Exporta tu respaldo', detalle: 'Ajustes → Exportar todo (JSON).', frecuencia: 'mensual', mes: 1, dia: 1 },
  ],
});

export function plantillaGenerica() {
  const p = base();
  p.ingresos = [{ id: 'ing1', nombre: 'Sueldo', monto: 0, moneda: 'USD', dia: 30, categoria: 'sueldo', impuestoPct: 0, nota: '' }];
  p.bolsas = [
    { id: 'emergencia', nombre: 'Fondo de emergencia', icono: 'shield-check', color: '#34d399', moneda: 'USD', modo: 'pct', valor: 30, meta: 0, metaMinima: 0, fechaMeta: '' },
    { id: 'meta', nombre: 'Mi meta', icono: 'target', color: '#22d3ee', moneda: 'USD', modo: 'pct', valor: 50, meta: 0, metaMinima: 0, fechaMeta: '' },
    { id: 'inversion', nombre: 'Inversiones', icono: 'trending-up', color: '#a78bfa', moneda: 'USD', modo: 'pct', valor: 20, meta: 0, metaMinima: 0, fechaMeta: '' },
  ];
  p.metaPrincipal = 'meta';
  return p;
}

// Perú: incluye gratificaciones, CTS, utilidades, SUNAT y montos de referencia 2026.
export function plantillaPeru() {
  const p = base();
  Object.assign(p, {
    moneda: 'PEN',
    monedaSecundaria: 'USD',
    tc: 3.43,
    tcFecha: '2026-10-21',
    tcFuente: 'Manual (SUNAT 21/10/2026)',
    limitePorEntidad: 60000,
  });
  p.ingresos = [{ id: 'ing1', nombre: 'Sueldo', monto: 0, moneda: 'PEN', dia: 28, categoria: 'sueldo', impuestoPct: 0, nota: '' }];
  p.categoriasIngreso = [
    { id: 'sueldo', nombre: 'Sueldo', icono: 'briefcase' },
    { id: 'freelance', nombre: 'Honorarios (4ta)', icono: 'laptop' },
    { id: 'gratificacion', nombre: 'Gratificación', icono: 'gift' },
    { id: 'cts', nombre: 'CTS (retiro)', icono: 'vault' },
    { id: 'utilidades', nombre: 'Utilidades', icono: 'coins' },
    { id: 'intereses', nombre: 'Intereses', icono: 'percent' },
    { id: 'otro', nombre: 'Otro ingreso', icono: 'hand-coins' },
  ];
  p.bolsas = [
    { id: 'emergencia', nombre: 'Fondo de emergencia', icono: 'shield-check', color: '#34d399', moneda: 'PEN', modo: 'pct', valor: 0, meta: 0, metaMinima: 0, fechaMeta: '' },
    { id: 'depa', nombre: 'Departamento', icono: 'house', color: '#22d3ee', moneda: 'PEN', modo: 'pct', valor: 80, meta: 0, metaMinima: 0, fechaMeta: '' },
    { id: 'etf', nombre: 'ETF', icono: 'trending-up', color: '#a78bfa', moneda: 'USD', modo: 'pct', valor: 17.5, meta: 0, metaMinima: 0, fechaMeta: '' },
    { id: 'cripto', nombre: 'Cripto', icono: 'bitcoin', color: '#fbbf24', moneda: 'USD', modo: 'pct', valor: 2.5, meta: 0, metaMinima: 0, fechaMeta: '' },
    { id: 'cts', nombre: 'CTS', icono: 'vault', color: '#60a5fa', moneda: 'PEN', modo: 'pct', valor: 0, meta: 0, metaMinima: 0, fechaMeta: '' },
    { id: 'impuestos', nombre: 'Reserva impuestos', icono: 'receipt', color: '#f472b6', moneda: 'PEN', modo: 'fijo', valor: 0, meta: 0, metaMinima: 0, fechaMeta: '' },
  ];
  p.metaPrincipal = 'depa';
  p.eventos = [
    { id: 'renta-anual', titulo: 'Declaración anual de renta (SUNAT)', detalle: 'Cronograma por último dígito de RUC (mar–abr).', frecuencia: 'anual', mes: 3, dia: 15 },
    { id: 'utilidades', titulo: 'Revisar pago de utilidades', detalle: 'Hasta 30 días después del vencimiento de la DJ anual.', frecuencia: 'anual', mes: 5, dia: 1 },
    { id: 'cts-may', titulo: 'Depósito CTS de mayo', detalle: 'Verifica el depósito (hasta el 15).', frecuencia: 'anual', mes: 5, dia: 15 },
    { id: 'grati-jul', titulo: 'Gratificación de julio', detalle: 'Sueldo + 9% de bonificación extraordinaria.', frecuencia: 'anual', mes: 7, dia: 15 },
    { id: 'cts-nov', titulo: 'Depósito CTS de noviembre', detalle: 'Verifica el depósito (hasta el 15).', frecuencia: 'anual', mes: 11, dia: 15 },
    { id: 'grati-dic', titulo: 'Gratificación de diciembre', detalle: 'Sueldo + 9% de bonificación extraordinaria.', frecuencia: 'anual', mes: 12, dia: 15 },
    { id: 'trimestral', titulo: 'Revisión trimestral', detalle: 'Compara tasas (SBS Retasas) y abre el siguiente plazo fijo.', frecuencia: 'trimestral', mes: 1, dia: 2 },
    { id: 'respaldo', titulo: 'Exporta tu respaldo', detalle: 'Ajustes → Exportar todo (JSON).', frecuencia: 'mensual', mes: 1, dia: 1 },
  ];
  return p;
}

export const PLANTILLAS = {
  peru: { nombre: 'Perú', descripcion: 'Soles + dólares, gratificaciones, CTS, utilidades y SUNAT', crear: plantillaPeru },
  generica: { nombre: 'Genérica', descripcion: 'Cualquier país; tú defines monedas, metas y eventos', crear: plantillaGenerica },
};

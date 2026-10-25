// Gráficos en <canvas>, sin librerías externas (funcionan offline). Toman los colores del tema.

function tema() {
  const css = getComputedStyle(document.documentElement);
  const v = (n, d) => css.getPropertyValue(n).trim() || d;
  return { texto: v('--suave', '#8d99b3'), tenue: v('--tenue', '#5b6680'), borde: v('--borde', 'rgba(255,255,255,.1)'), acento: v('--acento', '#22d3ee'), acento2: v('--acento-2', '#a78bfa'), ok: v('--ok', '#34d399'), mal: v('--mal', '#fb7185') };
}

function preparar(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  canvas.width = Math.round(ancho * dpr);
  canvas.height = Math.round(alto * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);
  ctx.font = '500 11px system-ui, -apple-system, sans-serif';
  return { ctx, ancho, alto, t: tema() };
}

function compacto(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return n.toFixed(0);
}

function sinDatos(ctx, alto, t) {
  ctx.fillStyle = t.texto;
  ctx.font = '13px system-ui';
  ctx.fillText('Sin datos todavía', 8, alto / 2);
}

// Dona con leyenda. datos: [{ etiqueta, valor, color }]
export function dona(canvas, datos) {
  const { ctx, ancho, alto, t } = preparar(canvas);
  const items = datos.filter((d) => d.valor > 0);
  const total = items.reduce((s, d) => s + d.valor, 0);
  if (!total) return sinDatos(ctx, alto, t);
  const r = Math.min(ancho * 0.42, alto) / 2 - 6;
  const cx = r + 6;
  const cy = alto / 2;
  const grosor = r * 0.32;
  let ang = -Math.PI / 2;
  ctx.lineCap = 'round';
  for (const d of items) {
    const a = (d.valor / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = grosor;
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 10;
    ctx.arc(cx, cy, r - grosor / 2, ang + 0.04, ang + a - 0.04);
    ctx.stroke();
    ang += a;
  }
  ctx.shadowBlur = 0;
  const x0 = cx + r + 18;
  const fila = 20;
  let y = cy - (items.length * fila) / 2 + 12;
  ctx.font = '500 12px system-ui, -apple-system, sans-serif';
  for (const d of items) {
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(x0 + 4, y - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.texto;
    const etiqueta = d.etiqueta.length > 16 ? d.etiqueta.slice(0, 15) + '…' : d.etiqueta;
    ctx.fillText(`${etiqueta}  ${((d.valor / total) * 100).toFixed(0)}%`, x0 + 14, y);
    y += fila;
  }
}

// Área con degradado. puntos: [{ mes, valor }]
export function area(canvas, puntos, { meta } = {}) {
  const { ctx, ancho, alto, t } = preparar(canvas);
  const izq = 38;
  const abajo = 22;
  const w = ancho - izq - 10;
  const h = alto - abajo - 10;
  const max = Math.max(...puntos.map((p) => p.valor), meta || 0, 1) * 1.12;
  const x = (i) => izq + (puntos.length === 1 ? w / 2 : (i / (puntos.length - 1)) * w);
  const y = (v) => 10 + h - (v / max) * h;
  ctx.strokeStyle = t.borde;
  ctx.fillStyle = t.tenue;
  for (let k = 0; k <= 3; k++) {
    const v = (max / 3) * k;
    ctx.beginPath();
    ctx.setLineDash([2, 4]);
    ctx.moveTo(izq, y(v));
    ctx.lineTo(izq + w, y(v));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText(compacto(v), 2, y(v) + 4);
  }
  const paso = Math.ceil(puntos.length / 6);
  puntos.forEach((p, i) => {
    if (i % paso && i !== puntos.length - 1) return;
    const e = p.mes.slice(2).replace('-', '/');
    const tw = ctx.measureText(e).width;
    ctx.fillText(e, Math.min(Math.max(x(i) - tw / 2, izq), ancho - tw - 2), alto - 4);
  });
  if (meta) {
    ctx.strokeStyle = t.acento2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(izq, y(meta));
    ctx.lineTo(izq + w, y(meta));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const grad = ctx.createLinearGradient(0, 10, 0, 10 + h);
  grad.addColorStop(0, t.acento + '66');
  grad.addColorStop(1, t.acento + '00');
  ctx.beginPath();
  puntos.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p.valor)) : ctx.moveTo(x(i), y(p.valor))));
  ctx.lineTo(x(puntos.length - 1), 10 + h);
  ctx.lineTo(x(0), 10 + h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  puntos.forEach((p, i) => (i ? ctx.lineTo(x(i), y(p.valor)) : ctx.moveTo(x(i), y(p.valor))));
  ctx.strokeStyle = t.acento;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = t.acento;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;
  const u = puntos.length - 1;
  ctx.fillStyle = t.acento;
  ctx.beginPath();
  ctx.arc(x(u), y(puntos[u].valor), 4.5, 0, Math.PI * 2);
  ctx.fill();
}

// Línea mínima para la tarjeta principal.
export function sparkline(canvas, valores) {
  const { ctx, ancho, alto, t } = preparar(canvas);
  if (valores.length < 2) return;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;
  const x = (i) => (i / (valores.length - 1)) * (ancho - 4) + 2;
  const y = (v) => alto - 4 - ((v - min) / rango) * (alto - 8);
  const grad = ctx.createLinearGradient(0, 0, ancho, 0);
  grad.addColorStop(0, t.acento2);
  grad.addColorStop(1, t.acento);
  ctx.beginPath();
  valores.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.shadowColor = t.acento;
  ctx.shadowBlur = 10;
  ctx.stroke();
}

// Barras horizontales (positivos y negativos). datos: [{ etiqueta, valor, color }]
export function barras(canvas, datos, { sufijo = '' } = {}) {
  canvas.style.height = `${Math.max(datos.length, 1) * 30}px`;
  const { ctx, ancho, alto, t } = preparar(canvas);
  if (!datos.length) return sinDatos(ctx, alto, t);
  const etiquetaW = 96;
  const valorW = 58;
  const w = ancho - etiquetaW - valorW;
  const fila = alto / datos.length;
  const maxAbs = Math.max(...datos.map((d) => Math.abs(d.valor)), 0.0001);
  const hayNeg = datos.some((d) => d.valor < 0);
  const cero = etiquetaW + (hayNeg ? w / 2 : 0);
  const escala = (hayNeg ? w / 2 : w) / maxAbs;
  ctx.font = '500 12px system-ui, -apple-system, sans-serif';
  datos.forEach((d, i) => {
    const yy = i * fila;
    ctx.fillStyle = t.texto;
    ctx.fillText(d.etiqueta.length > 13 ? d.etiqueta.slice(0, 12) + '…' : d.etiqueta, 0, yy + fila / 2 + 4);
    ctx.fillStyle = t.borde;
    ctx.beginPath();
    ctx.roundRect(etiquetaW, yy + fila / 2 - 4, w, 8, 4);
    ctx.fill();
    const largo = d.valor * escala;
    ctx.fillStyle = d.valor >= 0 ? d.color || t.ok : t.mal;
    ctx.beginPath();
    ctx.roundRect(largo >= 0 ? cero : cero + largo, yy + fila / 2 - 4, Math.max(Math.abs(largo), 3), 8, 4);
    ctx.fill();
    ctx.fillStyle = d.valor >= 0 ? t.ok : t.mal;
    ctx.fillText(`${d.valor >= 0 ? '+' : ''}${d.valor.toFixed(1)}${sufijo}`, ancho - valorW + 8, yy + fila / 2 + 4);
  });
}

import * as C from './calc.js';
import * as DB from './db.js';
import * as G from './charts.js';
import { icono as I } from './icons.js';
import { PLANTILLAS, MONEDAS, COLORES, ICONOS_BOLSA, ICONOS_CATEGORIA } from './plantillas.js';

let estado;
let vista = 'inicio';
let mesVista = C.mesDe(C.hoyISO());
let filtroTipo = 'todos';
let pasoAsistente = 0;
let plantillaElegida = null;
let panelActual = null;

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const colorSeguro = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#22d3ee');
const P = () => estado.perfil;

// Monto formateado; se difumina si el usuario activa "ocultar montos".
function M(n, moneda = P().moneda, decimales = 2) {
  return `<span class="monto-privado">${esc(C.formatoMoneda(n, moneda, { decimales }))}</span>`;
}

const VISTAS = { inicio: 'Inicio', movimientos: 'Movimientos', plazos: 'Plazos fijos', avisos: 'Avisos', ajustes: 'Ajustes' };

// ---------- Utilidades ----------

function avisar(texto) {
  const el = $('#aviso');
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => (el.hidden = true), 2800);
}

async function guardar() {
  estado.snapshots[C.mesDe(C.hoyISO())] = C.patrimonioTotal(C.saldosPorBolsa(estado));
  await DB.guardar(estado);
}

let temporizadorGuardado;
function guardarLuego() {
  clearTimeout(temporizadorGuardado);
  temporizadorGuardado = setTimeout(guardar, 300);
}

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function opciones(lista, sel) {
  return lista.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(t)}</option>`).join('');
}

function monedasPerfil() {
  return [P().moneda, P().monedaSecundaria].filter(Boolean);
}

function fechaRelativa(n) {
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n < 0) return `Hace ${-n} d`;
  return `En ${n} d`;
}

function mesLargo(iso) {
  const [y, m] = iso.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
}

function fechaCorta(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

function burbuja(nombreIcono, color, chica = false) {
  return `<span class="burbuja${chica ? ' chica' : ''}" style="--c:${colorSeguro(color)}">${I(nombreIcono, { tam: chica ? 17 : 20 })}</span>`;
}

function anillo(pct, color, centro) {
  const r = 50;
  const c = 2 * Math.PI * r;
  return `<div class="anillo">
    <svg width="116" height="116" viewBox="0 0 116 116" aria-hidden="true">
      <defs><linearGradient id="g-anillo" x1="0" x2="1"><stop offset="0" stop-color="${colorSeguro(color)}"/><stop offset="1" stop-color="var(--acento-2)"/></linearGradient></defs>
      <circle cx="58" cy="58" r="${r}" fill="none" stroke="var(--vidrio-2)" stroke-width="10"/>
      <circle cx="58" cy="58" r="${r}" fill="none" stroke="url(#g-anillo)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(pct, 100) / 100)}" style="filter:drop-shadow(0 0 6px ${colorSeguro(color)})"/>
    </svg>
    <div class="centro">${centro}</div>
  </div>`;
}

function datosCategoria(tipo, id) {
  const c = C.categoria(P(), tipo, id);
  if (!c) return { nombre: id, icono: 'circle', color: '#94a3b8' };
  return { nombre: c.nombre, icono: c.icono, color: tipo === 'aporte' || tipo === 'retiro' ? c.color : tipo === 'ingreso' ? '#34d399' : '#fb7185' };
}

// ---------- Tema ----------

function aplicarTema() {
  const p = P();
  const raiz = document.documentElement;
  raiz.dataset.tema = p.tema || 'oscuro';
  raiz.style.setProperty('--acento', colorSeguro(p.acento));
  document.body.classList.toggle('oculto-montos', !!p.ocultarMontos);
  const oscuro = p.tema === 'oscuro' || (p.tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]').setAttribute('content', oscuro ? '#05070f' : '#eef2fb');
}

// ---------- Paneles inferiores ----------

function abrirPanel(html, acciones = {}, alMontar) {
  const capa = $('#capa-panel');
  capa.innerHTML = `<div class="fondo-panel" data-accion="cerrar-panel"></div><div class="panel" role="dialog" aria-modal="true"><div class="asa"></div>${html}</div>`;
  panelActual = { acciones };
  alMontar?.($('.panel', capa));
  requestAnimationFrame(() => $$('.fondo-panel, .panel', capa).forEach((e) => e.classList.add('abierto')));
}

function cerrarPanel() {
  const capa = $('#capa-panel');
  $$('.fondo-panel, .panel', capa).forEach((e) => e.classList.remove('abierto'));
  panelActual = null;
  setTimeout(() => {
    if (!panelActual) capa.innerHTML = '';
  }, 260);
}

function cabeceraPanel(titulo) {
  return `<div class="panel-cabecera"><h2>${esc(titulo)}</h2><button class="boton-icono" data-accion="cerrar-panel" aria-label="Cerrar">${I('x', { tam: 18 })}</button></div>`;
}

// Panel de nuevo movimiento / edición.
function panelMovimiento(mov = null) {
  const p = P();
  const s = {
    tipo: mov?.tipo || 'gasto',
    categoria: mov?.categoria || null,
    moneda: mov?.moneda || p.moneda,
  };
  const pintar = (panel) => {
    const cats = C.categoriasDe(p, s.tipo);
    if (!cats.some((c) => c.id === s.categoria)) s.categoria = cats[0]?.id || null;
    $('#pm-tipos', panel).innerHTML = Object.entries(C.TIPOS).map(([k, v]) => `<button type="button" data-accion="pm-tipo" data-v="${k}" aria-pressed="${s.tipo === k}">${esc(v)}</button>`).join('');
    $('#pm-cats', panel).innerHTML = cats.length
      ? cats.map((c) => {
          const d = datosCategoria(s.tipo, c.id);
          return `<button type="button" data-accion="pm-cat" data-v="${esc(c.id)}" aria-pressed="${s.categoria === c.id}" style="--c:${colorSeguro(d.color)}">${burbuja(c.icono, d.color, true)}<span>${esc(c.nombre)}</span></button>`;
        }).join('')
      : '<p class="suave">No hay categorías. Créalas en Ajustes.</p>';
    $('#pm-moneda', panel).textContent = s.moneda;
    $('#pm-tc-fila', panel).hidden = s.moneda === p.moneda;
  };
  const atajos = p.ingresos.filter((i) => i.monto > 0);
  abrirPanel(
    `${cabeceraPanel(mov ? 'Editar movimiento' : 'Nuevo movimiento')}
    ${!mov && atajos.length ? `<div class="fila" style="overflow-x:auto;gap:8px;margin-bottom:12px">${atajos.map((i) => `<button class="chip" style="min-height:34px" data-accion="pm-atajo" data-id="${esc(i.id)}">${I('zap', { tam: 14 })} ${esc(i.nombre)}</button>`).join('')}</div>` : ''}
    <div class="segmentado" id="pm-tipos"></div>
    <div class="monto-grande"><input id="pm-monto" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" value="${mov ? mov.monto : ''}" aria-label="Monto"><button type="button" id="pm-moneda" data-accion="pm-moneda" ${p.monedaSecundaria ? '' : 'disabled'}></button></div>
    <div class="rejilla" id="pm-cats" style="margin-top:8px"></div>
    <div class="grid2">
      <div><label class="campo" for="pm-fecha">Fecha</label><input id="pm-fecha" type="date" value="${mov?.fecha || C.hoyISO()}"></div>
      <div id="pm-tc-fila"><label class="campo" for="pm-tc">Tipo de cambio</label><input id="pm-tc" type="number" inputmode="decimal" step="0.001" value="${mov?.tc || p.tc}"></div>
    </div>
    <label class="campo" for="pm-nota">Nota</label><input id="pm-nota" maxlength="200" value="${esc(mov?.nota || '')}" placeholder="Opcional">
    <div class="botones"><button class="primario ancho" data-accion="pm-guardar">${I('check')} Guardar</button>${mov ? `<button class="peligro ancho" data-accion="pm-borrar">${I('trash-2')} Borrar</button>` : ''}</div>`,
    {
      'pm-tipo': (el) => {
        s.tipo = el.dataset.v;
        pintar($('.panel'));
      },
      'pm-cat': (el) => {
        s.categoria = el.dataset.v;
        pintar($('.panel'));
      },
      'pm-moneda': () => {
        s.moneda = s.moneda === p.moneda ? p.monedaSecundaria : p.moneda;
        pintar($('.panel'));
      },
      'pm-atajo': (el) => {
        const i = p.ingresos.find((x) => x.id === el.dataset.id);
        Object.assign(s, { tipo: 'ingreso', categoria: i.categoria, moneda: i.moneda });
        $('#pm-monto').value = i.monto;
        $('#pm-nota').value = i.nombre;
        pintar($('.panel'));
      },
      'pm-guardar': async () => {
        try {
          const m = C.validarMovimiento(
            {
              id: mov?.id || C.nuevoId(),
              fecha: $('#pm-fecha').value,
              tipo: s.tipo,
              categoria: s.categoria,
              monto: Number($('#pm-monto').value),
              moneda: s.moneda,
              tc: Number($('#pm-tc').value) || p.tc,
              nota: $('#pm-nota').value.trim(),
              ...(mov?.rendimiento ? { rendimiento: true } : {}),
            },
            p,
          );
          if (mov) estado.movimientos[estado.movimientos.findIndex((x) => x.id === mov.id)] = m;
          else estado.movimientos.push(m);
          await guardar();
          cerrarPanel();
          avisar(mov ? 'Movimiento actualizado' : 'Movimiento guardado');
          render();
        } catch (err) {
          avisar(err.message);
        }
      },
      'pm-borrar': async () => {
        if (!confirm('¿Borrar este movimiento?')) return;
        estado.movimientos = estado.movimientos.filter((x) => x.id !== mov.id);
        await guardar();
        cerrarPanel();
        render();
      },
    },
    (panel) => {
      pintar(panel);
      if (!mov) setTimeout(() => $('#pm-monto', panel)?.focus(), 300);
    },
  );
}

function panelPlazo() {
  const p = P();
  const hoy = C.hoyISO();
  abrirPanel(
    `${cabeceraPanel('Nuevo plazo fijo')}
    <label class="campo" for="pf-entidad">Entidad</label><input id="pf-entidad" maxlength="60" list="pf-entidades" placeholder="Ej. Caja Cusco">
    <datalist id="pf-entidades">${[...new Set(estado.plazos.map((x) => x.entidad))].map((e) => `<option>${esc(e)}</option>`).join('')}</datalist>
    <div class="grid2">
      <div><label class="campo" for="pf-monto">Monto</label><input id="pf-monto" type="number" inputmode="decimal" step="0.01" min="1"></div>
      <div><label class="campo" for="pf-moneda">Moneda</label><select id="pf-moneda">${opciones(monedasPerfil().map((m) => [m, m]), p.moneda)}</select></div>
      <div><label class="campo" for="pf-tasa">Tasa TEA (%)</label><input id="pf-tasa" type="number" inputmode="decimal" step="0.01" min="0" max="50"></div>
      <div><label class="campo" for="pf-bolsa">Bolsa</label><select id="pf-bolsa">${opciones(p.bolsas.map((b) => [b.id, b.nombre]), p.metaPrincipal)}</select></div>
      <div><label class="campo" for="pf-inicio">Inicio</label><input id="pf-inicio" type="date" value="${hoy}"></div>
      <div><label class="campo" for="pf-venc">Vencimiento</label><input id="pf-venc" type="date" value="${C.sumarDias(hoy, 360)}"></div>
    </div>
    <div class="fila" style="gap:6px;margin-top:10px;flex-wrap:wrap">${[90, 180, 270, 360, 540, 720].map((d) => `<button class="chip" style="min-height:32px" data-accion="pf-plazo" data-d="${d}">${d} días</button>`).join('')}</div>
    <label class="fila" style="margin-top:14px"><input type="checkbox" id="pf-aporte"> <span class="suave">Registrar también como aporte a la bolsa (si aún no lo registraste)</span></label>
    <div class="botones"><button class="primario ancho" data-accion="pf-guardar">${I('check')} Guardar plazo fijo</button></div>`,
    {
      'pf-plazo': (el) => ($('#pf-venc').value = C.sumarDias($('#pf-inicio').value || hoy, Number(el.dataset.d))),
      'pf-guardar': async () => {
        const pf = {
          id: C.nuevoId(),
          entidad: $('#pf-entidad').value.trim(),
          monto: Number($('#pf-monto').value),
          moneda: $('#pf-moneda').value,
          tasa: Number($('#pf-tasa').value),
          bolsa: $('#pf-bolsa').value,
          inicio: $('#pf-inicio').value,
          vencimiento: $('#pf-venc').value,
          estado: 'activo',
        };
        if (!pf.entidad || !(pf.monto > 0) || !(pf.tasa >= 0)) return avisar('Completa entidad, monto y tasa');
        if (C.diasEntre(pf.inicio, pf.vencimiento) <= 0) return avisar('El vencimiento debe ser posterior al inicio');
        estado.plazos.push(pf);
        if ($('#pf-aporte').checked) estado.movimientos.push({ id: C.nuevoId(), fecha: pf.inicio, tipo: 'aporte', categoria: pf.bolsa, monto: pf.monto, moneda: pf.moneda, tc: p.tc, nota: `Plazo fijo ${pf.entidad}` });
        await guardar();
        cerrarPanel();
        avisar('Guardado. Descarga de nuevo el calendario para su aviso.');
        render();
      },
    },
  );
}

function panelCobrar(pf) {
  const i = C.infoPF(pf);
  abrirPanel(
    `${cabeceraPanel(`Cerrar ${pf.entidad}`)}
    <p class="suave">El interés cobrado se suma a la bolsa como rendimiento (no como aporte).</p>
    <label class="campo" for="pc-int">Interés cobrado (${esc(pf.moneda)})</label>
    <input id="pc-int" type="number" inputmode="decimal" step="0.01" min="0" value="${i.vencido ? i.interesFinal : i.interesDevengado}">
    <div class="botones"><button class="primario ancho" data-accion="pc-ok">${I('check')} Cerrar plazo fijo</button></div>`,
    {
      'pc-ok': async () => {
        const v = Number($('#pc-int').value);
        pf.estado = 'cerrado';
        if (v > 0) estado.movimientos.push({ id: C.nuevoId(), fecha: C.hoyISO(), tipo: 'aporte', categoria: pf.bolsa, monto: v, moneda: pf.moneda, tc: P().tc, nota: `Intereses ${pf.entidad}`, rendimiento: true });
        await guardar();
        cerrarPanel();
        avisar('Plazo fijo cerrado');
        render();
      },
    },
  );
}

function panelValor() {
  const p = P();
  const actual = (id) => estado.valoraciones[id];
  abrirPanel(
    `${cabeceraPanel('Valor de mercado')}
    <p class="suave">Escribe lo que ves hoy en tu bróker o exchange. Si lo quitas, se usa lo aportado (+ intereses de plazos fijos).</p>
    <div class="grid2">
      <div><label class="campo" for="pv-bolsa">Bolsa</label><select id="pv-bolsa">${opciones(p.bolsas.map((b) => [b.id, b.nombre]), p.bolsas.find((b) => b.moneda !== p.moneda)?.id)}</select></div>
      <div><label class="campo" for="pv-moneda">Moneda</label><select id="pv-moneda">${opciones(monedasPerfil().map((m) => [m, m]), p.monedaSecundaria || p.moneda)}</select></div>
    </div>
    <label class="campo" for="pv-monto">Valor actual</label><input id="pv-monto" type="number" inputmode="decimal" step="0.01" min="0">
    <p class="tenue" id="pv-actual"></p>
    <div class="botones"><button class="primario ancho" data-accion="pv-ok">${I('check')} Guardar</button><button class="ancho" data-accion="pv-quitar">Quitar valor manual</button></div>`,
    {
      'pv-ok': async () => {
        const v = $('#pv-monto').value;
        if (v === '' || Number(v) < 0) return avisar('Ingresa un valor');
        estado.valoraciones[$('#pv-bolsa').value] = { monto: Number(v), moneda: $('#pv-moneda').value, fecha: C.hoyISO() };
        await guardar();
        cerrarPanel();
        render();
      },
      'pv-quitar': async () => {
        delete estado.valoraciones[$('#pv-bolsa').value];
        await guardar();
        cerrarPanel();
        render();
      },
    },
    (panel) => {
      const mostrar = () => {
        const a = actual($('#pv-bolsa', panel).value);
        $('#pv-actual', panel).textContent = a ? `Valor manual actual: ${C.formatoMoneda(a.monto, a.moneda)} (${a.fecha})` : 'Sin valor manual.';
      };
      $('#pv-bolsa', panel).addEventListener('change', mostrar);
      mostrar();
    },
  );
}

function panelIconos(lista, idx, catalogo) {
  abrirPanel(
    `${cabeceraPanel('Elige un ícono')}<div class="rejilla-iconos">${catalogo.map((n) => `<button data-accion="icono-ok" data-n="${n}" aria-label="${n}">${I(n)}</button>`).join('')}</div>`,
    {
      'icono-ok': (el) => {
        P()[lista][idx].icono = el.dataset.n;
        guardarLuego();
        cerrarPanel();
        render();
      },
    },
  );
}

// ---------- Editores reutilizables (Ajustes y asistente) ----------

function campoNum(lista, i, k, etiqueta, valor, extra = '') {
  return `<div><label class="campo">${etiqueta}</label><input type="number" inputmode="decimal" step="any" data-l="${lista}" data-i="${i}" data-k="${k}" value="${esc(valor ?? '')}" ${extra}></div>`;
}

function editorIngresos() {
  const p = P();
  return `${p.ingresos.map((ing, i) => `
    <div class="item-editable">
      <div class="fila-superior">${burbuja('banknote', '#34d399', true)}<input data-l="ingresos" data-i="${i}" data-k="nombre" value="${esc(ing.nombre)}" aria-label="Nombre del ingreso"><button class="boton-icono" data-accion="quitar" data-l="ingresos" data-i="${i}" aria-label="Quitar">${I('trash-2', { tam: 17 })}</button></div>
      <div class="grid3">
        ${campoNum('ingresos', i, 'monto', 'Monto', ing.monto, 'min="0"')}
        <div><label class="campo">Moneda</label><select data-l="ingresos" data-i="${i}" data-k="moneda">${opciones(monedasPerfil().map((m) => [m, m]), ing.moneda)}</select></div>
        ${campoNum('ingresos', i, 'dia', 'Día de pago', ing.dia, 'min="1" max="31" step="1"')}
      </div>
      <div class="grid2">
        <div><label class="campo">Categoría</label><select data-l="ingresos" data-i="${i}" data-k="categoria">${opciones(p.categoriasIngreso.map((c) => [c.id, c.nombre]), ing.categoria)}</select></div>
        ${campoNum('ingresos', i, 'impuestoPct', 'Apartar impuesto (%)', ing.impuestoPct, 'min="0" max="60"')}
      </div>
      <label class="campo">Instrucción extra para ese día (opcional)</label>
      <input data-l="ingresos" data-i="${i}" data-k="nota" value="${esc(ing.nota)}" placeholder="Ej. Emite tu recibo por honorarios">
    </div>`).join('')}
    <button class="ancho" data-accion="agregar" data-l="ingresos">${I('plus')} Agregar ingreso</button>`;
}

function editorBolsas() {
  const p = P();
  return `${p.bolsas.map((b, i) => `
    <div class="item-editable">
      <div class="fila-superior">
        <button class="boton-icono" style="width:42px;height:42px;border-radius:14px;color:${colorSeguro(b.color)}" data-accion="elegir-icono" data-l="bolsas" data-i="${i}" aria-label="Cambiar ícono">${I(b.icono)}</button>
        <input data-l="bolsas" data-i="${i}" data-k="nombre" value="${esc(b.nombre)}" aria-label="Nombre de la bolsa">
        <button class="boton-icono" data-accion="quitar" data-l="bolsas" data-i="${i}" aria-label="Quitar">${I('trash-2', { tam: 17 })}</button>
      </div>
      <div class="grid2">
        <div><label class="campo">Aporte mensual</label><select data-l="bolsas" data-i="${i}" data-k="modo">${opciones([['pct', '% del ahorro'], ['fijo', 'Monto fijo']], b.modo)}</select></div>
        ${campoNum('bolsas', i, 'valor', b.modo === 'fijo' ? `Monto (${p.moneda})` : 'Porcentaje (%)', b.valor, 'min="0"')}
        ${campoNum('bolsas', i, 'meta', `Meta (${p.moneda})`, b.meta, 'min="0"')}
        ${campoNum('bolsas', i, 'metaMinima', 'Meta mínima', b.metaMinima, 'min="0"')}
        <div><label class="campo">Fecha meta</label><input type="date" data-l="bolsas" data-i="${i}" data-k="fechaMeta" value="${esc(b.fechaMeta)}"></div>
        <div><label class="campo">Moneda</label><select data-l="bolsas" data-i="${i}" data-k="moneda">${opciones(monedasPerfil().map((m) => [m, m]), b.moneda)}</select></div>
      </div>
      <label class="campo">Color</label>
      <div class="swatches">${COLORES.map((c) => `<button style="--c:${c}" data-accion="color" data-l="bolsas" data-i="${i}" data-c="${c}" aria-pressed="${b.color === c}" aria-label="Color ${c}"></button>`).join('')}</div>
    </div>`).join('')}
    <button class="ancho" data-accion="agregar" data-l="bolsas">${I('plus')} Agregar bolsa o meta</button>`;
}

function editorCategorias(lista) {
  return `${P()[lista].map((c, i) => `
    <div class="fila" style="margin-bottom:8px">
      <button class="boton-icono" style="width:42px;height:42px;border-radius:14px" data-accion="elegir-icono" data-l="${lista}" data-i="${i}" aria-label="Cambiar ícono">${I(c.icono)}</button>
      <input data-l="${lista}" data-i="${i}" data-k="nombre" value="${esc(c.nombre)}" aria-label="Nombre de la categoría">
      <button class="boton-icono" data-accion="quitar" data-l="${lista}" data-i="${i}" aria-label="Quitar">${I('trash-2', { tam: 17 })}</button>
    </div>`).join('')}
    <button class="ancho" data-accion="agregar" data-l="${lista}">${I('plus')} Agregar categoría</button>`;
}

function editorEventos() {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m, i) => [i + 1, m]);
  return `${P().eventos.map((ev, i) => `
    <div class="item-editable">
      <div class="fila-superior">${burbuja('calendar', '#a78bfa', true)}<input data-l="eventos" data-i="${i}" data-k="titulo" value="${esc(ev.titulo)}" aria-label="Título"><button class="boton-icono" data-accion="quitar" data-l="eventos" data-i="${i}" aria-label="Quitar">${I('trash-2', { tam: 17 })}</button></div>
      <div class="grid3">
        <div><label class="campo">Frecuencia</label><select data-l="eventos" data-i="${i}" data-k="frecuencia">${opciones([['mensual', 'Mensual'], ['trimestral', 'Trimestral'], ['anual', 'Anual']], ev.frecuencia)}</select></div>
        <div><label class="campo">${ev.frecuencia === 'trimestral' ? 'Desde' : 'Mes'}</label><select data-l="eventos" data-i="${i}" data-k="mes" data-t="n" ${ev.frecuencia === 'mensual' ? 'disabled' : ''}>${opciones(meses, ev.mes)}</select></div>
        ${campoNum('eventos', i, 'dia', 'Día', ev.dia, 'min="1" max="31" step="1"')}
      </div>
      <label class="campo">Detalle</label><input data-l="eventos" data-i="${i}" data-k="detalle" value="${esc(ev.detalle)}">
    </div>`).join('')}
    <button class="ancho" data-accion="agregar" data-l="eventos">${I('plus')} Agregar recordatorio</button>`;
}

function resumenPresupuesto() {
  const p = P();
  const ingresos = C.ingresoMensualTotal(p);
  const impuestos = p.ingresos.reduce((s, i) => s + (C.aPrincipal(Number(i.monto) || 0, i.moneda, p) * (Number(i.impuestoPct) || 0)) / 100, 0);
  const libre = ingresos - impuestos - (p.presupuestoGastos || 0) - (p.ahorroMensual || 0);
  return `<table class="tabla">
    <tr><td>Ingresos del plan</td><td>${M(ingresos)}</td></tr>
    <tr><td>− Impuestos apartados</td><td>${M(impuestos)}</td></tr>
    <tr><td>− Gastos</td><td>${M(p.presupuestoGastos || 0)}</td></tr>
    <tr><td>− Ahorro</td><td>${M(p.ahorroMensual || 0)}</td></tr>
    <tr><td><b>Libre / sin asignar</b></td><td class="${libre < 0 ? 'negativo' : 'positivo'}"><b>${M(libre)}</b></td></tr>
  </table>`;
}

function chipSumaPct() {
  const s = C.sumaPorcentajes(P());
  return `<span class="chip ${Math.abs(s - 100) < 0.01 ? 'ok' : 'mal'}">${s}% del ahorro repartido</span>`;
}

// ---------- Vistas ----------

function vistaInicio() {
  const p = P();
  const saldos = C.saldosPorBolsa(estado);
  const total = C.patrimonioTotal(saldos);
  const serie = C.seriePatrimonio(estado);
  const va = C.variacion(serie);
  const meta = p.metaPrincipal ? C.progresoMeta(estado, saldos, p.metaPrincipal) : null;
  const mes = C.resumenMes(estado.movimientos, C.mesDe(C.hoyISO()), p);
  const pctGasto = p.presupuestoGastos ? (mes.gastos / p.presupuestoGastos) * 100 : 0;
  const prox = C.recordatorios(estado, C.hoyISO(), 14).filter((r) => !estado.hechos[r.clave]).slice(0, 4);
  const topGastos = Object.entries(mes.gastosPorCategoria).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const tarjetaMeta = meta
    ? `<section class="tarjeta entrar">
        <div class="tarjeta-titulo">${I('target', { tam: 15 })} Meta principal<button class="fantasma accion" data-accion="ir" data-v="ajustes">Editar</button></div>
        <div class="fila" style="gap:16px">
          ${anillo(meta.pct, meta.bolsa.color, `<div><b>${meta.pct.toFixed(0)}%</b><small>de la meta</small></div>`)}
          <div class="columna crecer">
            <div class="fila">${burbuja(meta.bolsa.icono, meta.bolsa.color, true)}<b>${esc(meta.bolsa.nombre)}</b></div>
            <div class="mediano" style="margin-top:6px">${M(meta.valor, p.moneda, 0)}</div>
            <div class="suave">de ${M(meta.meta, p.moneda, 0)} · faltan ${M(meta.falta, p.moneda, 0)}</div>
            ${meta.pctMinimo != null ? `<div class="tenue">Mínimo: ${meta.pctMinimo.toFixed(0)}%</div>` : ''}
            <div style="margin-top:6px">${meta.meta === 0 ? '<span class="chip alerta">Define el monto de la meta</span>' : meta.meses === 0 ? `<span class="chip ok">${I('sparkles', { tam: 13 })} ¡Meta alcanzada!</span>` : meta.fechaEstimada ? `<span class="chip ${meta.aTiempo === false ? 'alerta' : 'acento'}">${I('rocket', { tam: 13 })} ${esc(mesLargo(meta.fechaEstimada))}</span>` : '<span class="chip alerta">Asigna un % de ahorro</span>'}</div>
          </div>
        </div>
        ${meta.necesarioMensual != null && meta.falta > 0 ? `<p class="tenue" style="margin:10px 0 0">Para llegar al ${esc(fechaCorta(meta.bolsa.fechaMeta))} ${esc(meta.bolsa.fechaMeta.slice(0, 4))} necesitas ${M(meta.necesarioMensual, p.moneda, 0)}/mes; hoy aportas ${M(meta.aporteMensual, p.moneda, 0)}/mes.</p>` : ''}
      </section>`
    : '';

  return `
  <section class="tarjeta heroe entrar">
    <div class="fila entre"><span class="etiqueta">${I('wallet', { tam: 15 })} Patrimonio neto</span>${va ? `<span class="chip ${va.absoluta >= 0 ? 'ok' : 'mal'}">${I(va.absoluta >= 0 ? 'trending-up' : 'trending-down', { tam: 13 })} ${va.pct != null ? `${va.pct > 0 ? '+' : ''}${va.pct}%` : ''} este mes</span>` : ''}</div>
    <div class="grande">${M(total)}</div>
    <canvas id="g-spark" class="alto-60" aria-hidden="true"></canvas>
    <div class="fila" style="margin-top:10px;flex-wrap:wrap;gap:6px">
      ${p.monedaSecundaria ? `<span class="chip">${I('arrow-left-right', { tam: 13 })} 1 ${esc(p.monedaSecundaria)} = ${p.tc.toFixed(3)} ${esc(p.moneda)}</span>` : ''}
      <span class="chip">${I('piggy-bank', { tam: 13 })} ${mes.tasaAhorro.toFixed(0)}% de ahorro este mes</span>
    </div>
  </section>

  ${tarjetaMeta}

  <div class="tarjeta-titulo" style="margin:4px 2px 10px">${I('vault', { tam: 15 })} Bolsas<button class="fantasma accion" data-accion="panel-valor">Valor de mercado</button></div>
  <div class="carrusel">${p.bolsas.map((b) => {
    const s = saldos[b.id];
    const pct = b.meta > 0 ? Math.min((s.valor / b.meta) * 100, 100) : null;
    return `<article class="tarjeta">
      <div class="fila entre">${burbuja(b.icono, b.color)}${s.aportado > 0 && s.rendimiento !== 0 ? `<span class="chip ${s.rendimiento >= 0 ? 'ok' : 'mal'}">${s.rendimientoPct > 0 ? '+' : ''}${s.rendimientoPct}%</span>` : ''}</div>
      <div class="suave" style="margin-top:10px">${esc(b.nombre)}</div>
      <div class="mediano">${M(s.valor, p.moneda, 0)}</div>
      ${pct != null ? `<div class="barra" style="--c:${colorSeguro(b.color)};margin-top:8px"><span style="width:${pct}%"></span></div><div class="tenue" style="margin-top:4px">${pct.toFixed(0)}% de ${M(b.meta, p.moneda, 0)}</div>` : `<div class="tenue" style="margin-top:4px">${b.modo === 'fijo' ? `${M(b.valor, p.moneda, 0)}/mes` : `${b.valor}% del ahorro`}</div>`}
    </article>`;
  }).join('')}</div>

  <section class="tarjeta entrar">
    <div class="tarjeta-titulo">${I('calendar', { tam: 15 })} ${esc(mesLargo(C.hoyISO()))}<button class="fantasma accion" data-accion="ir" data-v="movimientos">Ver todo</button></div>
    <div class="grid3">
      <div class="columna">${burbuja('arrow-down-left', '#34d399', true)}<span class="tenue" style="margin-top:6px">Ingresos</span><b>${M(mes.ingresos, p.moneda, 0)}</b></div>
      <div class="columna">${burbuja('arrow-up-right', '#fb7185', true)}<span class="tenue" style="margin-top:6px">Gastos</span><b>${M(mes.gastos, p.moneda, 0)}</b></div>
      <div class="columna">${burbuja('piggy-bank', p.acento, true)}<span class="tenue" style="margin-top:6px">Ahorro</span><b>${M(mes.aportes - mes.retiros, p.moneda, 0)}</b></div>
    </div>
    ${p.presupuestoGastos ? `<div class="fila entre" style="margin-top:14px"><span class="suave">Presupuesto de gastos</span><span class="suave">${pctGasto.toFixed(0)}%</span></div><div class="barra" style="--c:${pctGasto > 100 ? '#fb7185' : pctGasto > 85 ? '#fbbf24' : '#34d399'};margin-top:6px"><span style="width:${Math.min(pctGasto, 100)}%"></span></div>` : ''}
    ${topGastos.length ? `<ul class="lista" style="margin-top:10px">${topGastos.map(([id, v]) => {
      const c = datosCategoria('gasto', id);
      return `<li>${burbuja(c.icono, '#fb7185', true)}<div class="crecer"><div class="fila entre"><span class="titulo">${esc(c.nombre)}</span><span class="monto">${M(v, p.moneda, 0)}</span></div><div class="barra" style="--c:#fb7185;height:5px;margin-top:6px"><span style="width:${(v / (mes.gastos || 1)) * 100}%"></span></div></div></li>`;
    }).join('')}</ul>` : ''}
    ${mes.sinAsignar > 1 ? `<p class="tenue" style="margin:10px 0 0">${I('info', { tam: 13 })} ${M(mes.sinAsignar, p.moneda, 0)} sin asignar este mes (ingresos − gastos − ahorro).</p>` : ''}
  </section>

  ${prox.length ? `<section class="tarjeta entrar"><div class="tarjeta-titulo">${I('bell', { tam: 15 })} Próximo<button class="fantasma accion" data-accion="ir" data-v="avisos">Todos</button></div><ul class="lista">${prox.map((r) => `<li class="pulsable" data-accion="ir" data-v="avisos">${burbuja(r.icono, r.tipo === 'pf' ? '#fbbf24' : r.tipo === 'pago' ? '#34d399' : '#a78bfa', true)}<div class="crecer columna"><span class="titulo">${esc(r.titulo)}</span><span class="tenue">${esc(fechaCorta(r.fecha))}</span></div><span class="chip ${r.enDias <= 0 ? 'alerta' : ''}">${fechaRelativa(r.enDias)}</span></li>`).join('')}</ul></section>` : ''}

  <div class="dos-columnas">
    <section class="tarjeta"><div class="tarjeta-titulo">${I('chart-line', { tam: 15 })} Evolución</div><canvas id="g-area" class="alto-200" aria-label="Evolución del patrimonio"></canvas></section>
    <section class="tarjeta"><div class="tarjeta-titulo">${I('chart-pie', { tam: 15 })} Composición</div><canvas id="g-dona" class="alto-170" aria-label="Composición del patrimonio"></canvas></section>
  </div>

  <section class="tarjeta" style="margin-top:14px">
    <div class="tarjeta-titulo">${I('trending-up', { tam: 15 })} Rendimiento por bolsa</div>
    <canvas id="g-barras" aria-label="Rendimiento por bolsa"></canvas>
    <table class="tabla" style="margin-top:10px">
      <tr class="tenue"><td>Bolsa</td><td>Aportado</td><td>Valor</td></tr>
      ${p.bolsas.filter((b) => saldos[b.id].aportado || saldos[b.id].valor).map((b) => `<tr><td>${esc(b.nombre)}</td><td>${M(saldos[b.id].aportado, p.moneda, 0)}</td><td>${M(saldos[b.id].valor, p.moneda, 0)}</td></tr>`).join('')}
    </table>
  </section>`;
}

function dibujarGraficos() {
  const p = P();
  const saldos = C.saldosPorBolsa(estado);
  const serie = C.seriePatrimonio(estado);
  if ($('#g-spark')) G.sparkline($('#g-spark'), serie.map((s) => s.valor));
  if ($('#g-area')) G.area($('#g-area'), serie);
  if ($('#g-dona')) G.dona($('#g-dona'), p.bolsas.map((b) => ({ etiqueta: b.nombre, valor: saldos[b.id].valor, color: colorSeguro(b.color) })));
  if ($('#g-barras')) G.barras($('#g-barras'), p.bolsas.filter((b) => saldos[b.id].aportado > 0).map((b) => ({ etiqueta: b.nombre, valor: saldos[b.id].rendimientoPct, color: colorSeguro(b.color) })), { sufijo: '%' });
}

function vistaMovimientos() {
  const p = P();
  const mes = C.resumenMes(estado.movimientos, mesVista, p);
  const grupos = {};
  estado.movimientos
    .map((m, i) => [m, i])
    .filter(([m]) => C.mesDe(m.fecha) === mesVista && (filtroTipo === 'todos' || m.tipo === filtroTipo || (filtroTipo === 'aporte' && m.tipo === 'retiro')))
    .sort(([a, i], [b, j]) => b.fecha.localeCompare(a.fecha) || j - i)
    .forEach(([m]) => (grupos[m.fecha] ||= []).push(m));
  const filtros = [['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos'], ['aporte', 'Ahorro']];
  return `
  <section class="tarjeta entrar">
    <div class="fila entre">
      <button class="boton-icono" data-accion="mes" data-d="-1" aria-label="Mes anterior">${I('chevron-left')}</button>
      <b style="text-transform:capitalize">${esc(mesLargo(mesVista + '-01'))}</b>
      <button class="boton-icono" data-accion="mes" data-d="1" aria-label="Mes siguiente">${I('chevron-right')}</button>
    </div>
    <div class="grid3" style="margin-top:14px;text-align:center">
      <div><div class="tenue">Ingresos</div><b class="positivo">${M(mes.ingresos, p.moneda, 0)}</b></div>
      <div><div class="tenue">Gastos</div><b class="negativo">${M(mes.gastos, p.moneda, 0)}</b></div>
      <div><div class="tenue">Ahorro</div><b>${M(mes.aportes - mes.retiros, p.moneda, 0)}</b></div>
    </div>
  </section>
  <div class="segmentado" style="margin-bottom:12px">${filtros.map(([k, t]) => `<button data-accion="filtro" data-v="${k}" aria-pressed="${filtroTipo === k}">${t}</button>`).join('')}</div>
  <section class="tarjeta">
    ${Object.keys(grupos).length ? Object.entries(grupos).map(([fecha, movs]) => `
      <div class="grupo-dia">${esc(fechaCorta(fecha))}</div>
      <ul class="lista">${movs.map((m) => {
        const c = datosCategoria(m.tipo, m.categoria);
        const negativo = m.tipo === 'gasto' || m.tipo === 'retiro';
        return `<li class="pulsable" data-accion="editar-mov" data-id="${esc(m.id)}">${burbuja(c.icono, c.color, true)}<div class="crecer columna"><span class="titulo">${esc(c.nombre)}</span><span class="tenue">${esc(C.TIPOS[m.tipo])}${m.nota ? ' · ' + esc(m.nota) : ''}</span></div><span class="monto ${negativo ? 'negativo' : m.tipo === 'ingreso' ? 'positivo' : ''}">${negativo ? '−' : '+'}${M(m.monto, m.moneda)}</span></li>`;
      }).join('')}</ul>`).join('') : `<div class="vacio">${burbuja('receipt', p.acento)}<p>Sin movimientos este mes.</p><button class="primario" data-accion="nuevo-mov">${I('plus')} Registrar</button></div>`}
  </section>`;
}

function vistaPlazos() {
  const p = P();
  const activos = estado.plazos.filter((x) => x.estado !== 'cerrado').sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
  const cerrados = estado.plazos.filter((x) => x.estado === 'cerrado');
  const capital = activos.reduce((s, x) => s + C.aPrincipal(x.monto, x.moneda, p), 0);
  const porCobrar = activos.reduce((s, x) => s + C.aPrincipal(C.infoPF(x).interesFinal, x.moneda, p), 0);
  const excesos = p.limitePorEntidad > 0 ? Object.entries(C.concentracionPorEntidad(estado)).filter(([, v]) => v > p.limitePorEntidad) : [];
  return `
  <section class="tarjeta heroe entrar">
    <span class="etiqueta">${I('landmark', { tam: 15 })} Capital en plazos fijos</span>
    <div class="grande">${M(capital)}</div>
    <div class="fila" style="gap:6px;flex-wrap:wrap"><span class="chip ok">${I('percent', { tam: 13 })} +${M(porCobrar, p.moneda, 0)} al vencer</span><span class="chip">${activos.length} activos</span></div>
    ${excesos.length ? `<p class="chip alerta" style="margin-top:10px">${I('triangle-alert', { tam: 13 })} Más de ${M(p.limitePorEntidad, p.moneda, 0)} en ${excesos.map(([e]) => esc(e)).join(', ')}</p>` : ''}
  </section>
  <button class="primario ancho" style="margin-bottom:14px" data-accion="nuevo-pf">${I('plus')} Nuevo plazo fijo</button>
  ${activos.length ? activos.map((x) => {
    const i = C.infoPF(x);
    const b = C.bolsa(p, x.bolsa);
    const color = b?.color || p.acento;
    const chip = i.vencido ? '<span class="chip mal">Vencido</span>' : i.diasRestantes <= p.alertaPFdias ? `<span class="chip alerta">${i.diasRestantes} días</span>` : `<span class="chip">${i.diasRestantes} días</span>`;
    return `<article class="tarjeta entrar">
      <div class="fila">${burbuja('landmark', color)}<div class="crecer columna"><b>${esc(x.entidad)}</b><span class="tenue">${esc(b?.nombre || '')} · ${x.tasa}% TEA</span></div>${chip}</div>
      <div class="fila entre" style="margin-top:12px"><span class="mediano">${M(x.monto, x.moneda)}</span><span class="positivo">+${M(i.interesFinal, x.moneda)}</span></div>
      <div class="barra" style="--c:${colorSeguro(color)};margin-top:10px"><span style="width:${(i.avance * 100).toFixed(1)}%"></span></div>
      <div class="fila entre tenue" style="margin-top:6px"><span>${esc(fechaCorta(x.inicio))}</span><span>Devengado ${M(i.interesDevengado, x.moneda)}</span><span>${esc(fechaCorta(x.vencimiento))}</span></div>
      <div class="botones"><button class="chico" data-accion="cobrar-pf" data-id="${esc(x.id)}">${I('hand-coins', { tam: 16 })} Cobrar</button><button class="chico peligro" data-accion="borrar-pf" data-id="${esc(x.id)}">${I('trash-2', { tam: 16 })}</button></div>
    </article>`;
  }).join('') : `<section class="tarjeta vacio">${burbuja('landmark', p.acento)}<p>Aún no registras plazos fijos.</p></section>`}
  ${cerrados.length ? `<section class="tarjeta"><details><summary>${I('chevron-right', { tam: 16, clase: 'ico-giro' })} Cerrados (${cerrados.length})</summary><ul class="lista">${cerrados.map((x) => `<li><div class="crecer columna"><b>${esc(x.entidad)}</b><span class="tenue">${M(x.monto, x.moneda)} · ${x.tasa}% · ${esc(x.vencimiento)}</span></div></li>`).join('')}</ul></details></section>` : ''}`;
}

function vistaAvisos() {
  const p = P();
  const lista = C.recordatorios(estado, C.hoyISO(), 35);
  const permiso = 'Notification' in window ? Notification.permission : 'no-soportado';
  return `
  <section class="tarjeta heroe entrar">
    <span class="etiqueta">${I('calendar-clock', { tam: 15 })} Recordatorios en tu calendario</span>
    <p class="suave" style="margin:8px 0 0">Las apps web no pueden programar alarmas con la app cerrada (sobre todo en iPhone). Agrega estos recordatorios al <b>calendario de tu teléfono</b> y te avisará siempre.</p>
    <div class="botones">
      <button class="primario" data-accion="ics">${I('download')} Descargar calendario</button>
      <button data-accion="notificaciones" ${permiso === 'no-soportado' ? 'disabled' : ''}>${I('bell')} ${permiso === 'granted' ? 'Notificaciones activas' : 'Activar notificaciones'}</button>
    </div>
    <p class="tenue" style="margin:10px 0 0">Incluye tus días de pago, tus eventos y el vencimiento de cada plazo fijo (aviso ${p.alertaPFdias} días antes). Vuelve a descargarlo cuando cambies algo.</p>
  </section>
  <section class="tarjeta">
    <div class="tarjeta-titulo">${I('list', { tam: 15 })} Próximos 35 días</div>
    ${lista.length ? `<ul class="lista">${lista.map((r) => `
      <li style="align-items:flex-start">
        <input type="checkbox" data-accion="hecho" data-clave="${esc(r.clave)}" ${estado.hechos[r.clave] ? 'checked' : ''} aria-label="Marcar como hecho" style="margin-top:10px">
        ${burbuja(r.icono, r.tipo === 'pf' ? '#fbbf24' : r.tipo === 'pago' ? '#34d399' : '#a78bfa', true)}
        <div class="crecer columna">
          <div class="fila entre"><span class="titulo">${esc(r.titulo)}</span><span class="chip ${r.enDias <= 0 ? 'alerta' : ''}">${fechaRelativa(r.enDias)}</span></div>
          <span class="tenue">${esc(fechaCorta(r.fecha))}${r.detalle ? ' · ' + esc(r.detalle) : ''}</span>
          ${r.pasos?.length ? `<ol class="pasos">${r.pasos.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
        </div>
      </li>`).join('')}</ul>` : `<div class="vacio">${burbuja('bell', p.acento)}<p>Nada en los próximos días.</p></div>`}
  </section>`;
}

// Secciones de Ajustes abiertas: se recuerdan para no cerrarlas al repintar.
const seccionesAbiertas = new Set(['Perfil y monedas']);

function seccion(iconoNombre, titulo, contenido) {
  return `<section class="tarjeta"><details data-seccion="${esc(titulo)}" ${seccionesAbiertas.has(titulo) ? 'open' : ''}><summary>${burbuja(iconoNombre, P().acento, true)}<span class="crecer">${esc(titulo)}</span>${I('chevron-right', { tam: 18, clase: 'ico-giro' })}</summary><div style="margin-top:12px">${contenido}</div></details></section>`;
}

function vistaAjustes() {
  const p = P();
  const monedas = Object.entries(MONEDAS);
  return `
  ${seccion('user', 'Perfil y monedas', `
    <label class="campo">Tu nombre</label><input data-p="nombre" value="${esc(p.nombre)}" placeholder="¿Cómo te llamamos?">
    <div class="grid2">
      <div><label class="campo">Moneda principal</label><select data-p="moneda">${opciones(monedas, p.moneda)}</select></div>
      <div><label class="campo">Moneda secundaria</label><select data-p="monedaSecundaria">${opciones([['', 'Ninguna'], ...monedas.filter(([k]) => k !== p.moneda)], p.monedaSecundaria || '')}</select></div>
    </div>
    ${p.monedaSecundaria ? `<div class="grid2"><div><label class="campo">Tipo de cambio (1 ${esc(p.monedaSecundaria)} = ? ${esc(p.moneda)})</label><input type="number" inputmode="decimal" step="0.001" data-p="tc" value="${p.tc}"></div><div><label class="campo">Fuente</label><div class="tenue" style="padding-top:12px">${esc(p.tcFuente)}<br>${esc(p.tcFecha)}</div></div></div>
    <div class="botones"><button data-accion="consultar-tc">${I('refresh-cw')} Consultar tipo de cambio</button></div>
    <p class="tenue">Fuente pública de referencia (open.er-api.com). Para impuestos usa el tipo de cambio oficial de tu país.</p>` : ''}`)}

  ${seccion('palette', 'Apariencia', `
    <label class="campo">Tema</label>
    <div class="segmentado">${[['oscuro', 'Oscuro', 'moon'], ['claro', 'Claro', 'sun'], ['auto', 'Auto', 'monitor-smartphone']].map(([k, t, ic]) => `<button data-accion="tema" data-v="${k}" aria-pressed="${p.tema === k}">${I(ic, { tam: 16 })} ${t}</button>`).join('')}</div>
    <label class="campo">Color de acento</label>
    <div class="swatches">${COLORES.map((c) => `<button style="--c:${c}" data-accion="acento" data-c="${c}" aria-pressed="${p.acento === c}" aria-label="Acento ${c}"></button>`).join('')}</div>
    <label class="fila" style="margin-top:14px"><input type="checkbox" data-p="ocultarMontos" ${p.ocultarMontos ? 'checked' : ''}> <span>Ocultar montos (modo privado)</span></label>`)}

  ${seccion('briefcase', 'Ingresos y días de pago', `<p class="tenue">Cada ingreso genera un recordatorio en su día de pago con cuánto apartar y a dónde.</p>${editorIngresos()}`)}

  ${seccion('wallet', 'Presupuesto y ahorro', `
    <div class="grid2">
      <div><label class="campo">Gastos al mes (${esc(p.moneda)})</label><input type="number" inputmode="decimal" data-p="presupuestoGastos" value="${p.presupuestoGastos}"></div>
      <div><label class="campo">Ahorro al mes (${esc(p.moneda)})</label><input type="number" inputmode="decimal" data-p="ahorroMensual" value="${p.ahorroMensual}"></div>
    </div>
    <div id="resumen-presupuesto" style="margin-top:12px">${resumenPresupuesto()}</div>`)}

  ${seccion('target', 'Bolsas y metas', `
    <div class="grid2"><div><label class="campo">Meta principal (inicio)</label><select data-p="metaPrincipal">${opciones([['', 'Ninguna'], ...p.bolsas.map((b) => [b.id, b.nombre])], p.metaPrincipal || '')}</select></div><div style="padding-top:34px" id="suma-pct">${chipSumaPct()}</div></div>
    <p class="tenue">Las bolsas de "monto fijo" se llenan primero; el resto del ahorro se reparte según los porcentajes (deben sumar 100%).</p>
    ${editorBolsas()}`)}

  ${seccion('sliders-horizontal', 'Categorías', `
    <h3 class="suave" style="margin-bottom:10px">Gastos</h3>${editorCategorias('categoriasGasto')}
    <h3 class="suave" style="margin:18px 0 10px">Ingresos</h3>${editorCategorias('categoriasIngreso')}`)}

  ${seccion('bell', 'Recordatorios y plazos fijos', `
    <div class="grid2">
      <div><label class="campo">Avisar vencimiento de PF (días antes)</label><input type="number" inputmode="numeric" data-p="alertaPFdias" value="${p.alertaPFdias}" min="1" max="90"></div>
      <div><label class="campo">Máximo por entidad (${esc(p.moneda)}, 0 = sin límite)</label><input type="number" inputmode="decimal" data-p="limitePorEntidad" value="${p.limitePorEntidad}"></div>
    </div>
    <h3 class="suave" style="margin:16px 0 10px">Eventos</h3>${editorEventos()}`)}

  ${seccion('download', 'Respaldo y datos', `
    <p class="tenue">Tus datos viven solo en este teléfono. Exporta un respaldo cada mes y guárdalo en tu nube.</p>
    <div class="botones">
      <button class="primario" data-accion="exportar-json">${I('download')} Respaldo completo</button>
      <button data-accion="exportar-csv">${I('file-text')} Movimientos CSV</button>
      <button data-accion="exportar-perfil">${I('user')} Solo configuración</button>
      <button data-accion="importar">${I('upload')} Importar</button>
    </div>
    <div class="botones"><button data-accion="asistente">${I('wand-sparkles')} Abrir asistente inicial</button><button class="peligro" data-accion="borrar-todo">${I('trash-2')} Borrar todo</button></div>`)}

  ${seccion('info', 'Privacidad y créditos', `
    <p class="suave">Sin servidor, sin conexión a bancos, sin claves. La app solo usa internet para actualizarse y para consultar el tipo de cambio cuando tú lo pides.</p>
    <p class="tenue">Íconos: Lucide (licencia ISC). Datos v${C.VERSION_DATOS}.</p>`)}`;
}

// ---------- Asistente inicial ----------

const PASOS_ASISTENTE = 6;

function vistaAsistente() {
  const p = P();
  const indicador = `<div class="pasos-indicador">${Array.from({ length: PASOS_ASISTENTE }, (_, i) => `<span class="${i <= pasoAsistente ? 'hecho' : ''}"></span>`).join('')}</div>`;
  const pasos = [
    () => `
      <div class="logo">${I('sparkles', { tam: 34 })}</div>
      <h1>Tu dinero, con rumbo</h1>
      <p class="suave">Registra, ahorra por metas y recibe recordatorios en tus días de pago. Todo se queda en tu teléfono.</p>
      <h3 class="suave" style="margin:22px 0 10px">Elige una plantilla</h3>
      ${Object.entries(PLANTILLAS).map(([k, t]) => `<button class="opcion" data-accion="plantilla" data-v="${k}" aria-pressed="${plantillaElegida === k}">${burbuja(k === 'peru' ? 'landmark' : 'globe', k === 'peru' ? '#fb7185' : '#22d3ee')}<span class="columna"><b>${esc(t.nombre)}</b><span class="tenue">${esc(t.descripcion)}</span></span></button>`).join('')}
      <button class="opcion" data-accion="importar">${burbuja('upload', '#a78bfa')}<span class="columna"><b>Importar respaldo o configuración</b><span class="tenue">Archivo .json exportado desde la app</span></span></button>`,
    () => `
      <h1>Sobre ti</h1><p class="suave">Puedes cambiar todo después en Ajustes.</p>
      <label class="campo">Nombre</label><input data-p="nombre" value="${esc(p.nombre)}" placeholder="Tu nombre">
      <div class="grid2">
        <div><label class="campo">Moneda principal</label><select data-p="moneda">${opciones(Object.entries(MONEDAS), p.moneda)}</select></div>
        <div><label class="campo">Moneda secundaria</label><select data-p="monedaSecundaria">${opciones([['', 'Ninguna'], ...Object.entries(MONEDAS).filter(([k]) => k !== p.moneda)], p.monedaSecundaria || '')}</select></div>
      </div>
      ${p.monedaSecundaria ? `<label class="campo">Tipo de cambio (1 ${esc(p.monedaSecundaria)} = ? ${esc(p.moneda)})</label><input type="number" inputmode="decimal" step="0.001" data-p="tc" value="${p.tc}">` : ''}`,
    () => `<h1>Tus ingresos</h1><p class="suave">Agrega cada fuente de ingreso con su día de pago. Si eres independiente, indica qué % apartar para impuestos.</p>${editorIngresos()}`,
    () => `
      <h1>Gastos y ahorro</h1><p class="suave">Cuánto gastas y cuánto quieres ahorrar al mes.</p>
      <div class="grid2">
        <div><label class="campo">Gastos al mes</label><input type="number" inputmode="decimal" data-p="presupuestoGastos" value="${p.presupuestoGastos}"></div>
        <div><label class="campo">Ahorro al mes</label><input type="number" inputmode="decimal" data-p="ahorroMensual" value="${p.ahorroMensual}"></div>
      </div>
      <div id="resumen-presupuesto" class="tarjeta" style="margin-top:16px">${resumenPresupuesto()}</div>`,
    () => `
      <h1>Bolsas y metas</h1><p class="suave">¿Para qué ahorras? Asigna a cada bolsa un % de tu ahorro o un monto fijo, y una meta si tiene.</p>
      <div class="grid2"><div><label class="campo">Meta principal</label><select data-p="metaPrincipal">${opciones([['', 'Ninguna'], ...p.bolsas.map((b) => [b.id, b.nombre])], p.metaPrincipal || '')}</select></div><div style="padding-top:34px" id="suma-pct">${chipSumaPct()}</div></div>
      <div style="margin-top:12px">${editorBolsas()}</div>`,
    () => `
      <h1>Saldos de hoy</h1><p class="suave">¿Ya tienes algo ahorrado? Escríbelo para empezar con tu foto real (en ${esc(p.moneda)}).</p>
      ${p.bolsas.map((b) => `<div class="fila" style="margin-top:10px">${burbuja(b.icono, b.color, true)}<label class="crecer" for="saldo-${esc(b.id)}">${esc(b.nombre)}</label><input id="saldo-${esc(b.id)}" data-saldo="${esc(b.id)}" type="number" inputmode="decimal" min="0" placeholder="0" style="max-width:150px"></div>`).join('')}`,
  ];
  return `<div class="asistente">${indicador}<div class="cuerpo entrar">${pasos[pasoAsistente]()}</div>
    <div class="pie">${pasoAsistente > 0 ? `<button data-accion="asistente-atras">${I('chevron-left')} Atrás</button>` : ''}<button class="primario" data-accion="asistente-siguiente" ${pasoAsistente === 0 && !plantillaElegida ? 'disabled' : ''}>${pasoAsistente === PASOS_ASISTENTE - 1 ? `${I('rocket')} Empezar` : `Siguiente ${I('chevron-right')}`}</button></div></div>`;
}

// ---------- Render ----------

function render() {
  aplicarTema();
  const enAsistente = !estado.configurado;
  document.body.classList.toggle('en-asistente', enAsistente);
  $('#cabecera').hidden = enAsistente;
  $('#navegacion').hidden = enAsistente;
  if (enAsistente) {
    $('#contenido').innerHTML = vistaAsistente();
    return;
  }
  const p = P();
  const pendientes = C.recordatorios(estado, C.hoyISO(), 2).filter((r) => r.enDias <= 0 && !estado.hechos[r.clave]).length;
  $('#cabecera').innerHTML = `
    <div class="avatar">${esc((p.nombre || '?').trim().charAt(0).toUpperCase() || '?')}</div>
    <div class="saludo"><small>${esc(new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }))}</small><b>${vista === 'inicio' ? `Hola${p.nombre ? ', ' + esc(p.nombre.split(' ')[0]) : ''}` : esc(VISTAS[vista])}</b></div>
    <button class="boton-icono" data-accion="privado" aria-label="${p.ocultarMontos ? 'Mostrar' : 'Ocultar'} montos">${I(p.ocultarMontos ? 'eye-off' : 'eye', { tam: 18 })}</button>
    <button class="boton-icono" data-accion="ir" data-v="avisos" aria-label="Avisos">${I('bell', { tam: 18 })}${pendientes ? `<span class="insignia">${pendientes}</span>` : ''}</button>`;
  $$('#navegacion [data-v]').forEach((b) => (b.dataset.v === vista ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  const vistas = { inicio: vistaInicio, movimientos: vistaMovimientos, plazos: vistaPlazos, avisos: vistaAvisos, ajustes: vistaAjustes };
  $('#contenido').innerHTML = vistas[vista]();
  if (vista === 'inicio') requestAnimationFrame(dibujarGraficos);
}

function ir(v) {
  if (!VISTAS[v]) return;
  vista = v;
  history.replaceState(null, '', `#${v}`);
  render();
  window.scrollTo({ top: 0 });
}

// ---------- Acciones (delegación de eventos) ----------

const ACCIONES = {
  ir: (el) => ir(el.dataset.v),
  'cerrar-panel': cerrarPanel,
  'nuevo-mov': () => panelMovimiento(),
  'editar-mov': (el) => panelMovimiento(estado.movimientos.find((m) => m.id === el.dataset.id)),
  'nuevo-pf': panelPlazo,
  'cobrar-pf': (el) => panelCobrar(estado.plazos.find((x) => x.id === el.dataset.id)),
  'borrar-pf': async (el) => {
    if (!confirm('¿Borrar este plazo fijo? (no borra los aportes registrados)')) return;
    estado.plazos = estado.plazos.filter((x) => x.id !== el.dataset.id);
    await guardar();
    render();
  },
  'panel-valor': panelValor,
  mes: (el) => {
    mesVista = C.mesDe(C.sumarMeses(`${mesVista}-01`, Number(el.dataset.d)));
    render();
  },
  filtro: (el) => {
    filtroTipo = el.dataset.v;
    render();
  },
  privado: () => {
    P().ocultarMontos = !P().ocultarMontos;
    guardarLuego();
    render();
  },
  hecho: (el) => {
    if (el.checked) estado.hechos[el.dataset.clave] = true;
    else delete estado.hechos[el.dataset.clave];
    guardarLuego();
  },
  ics: () => {
    descargar('mis-finanzas.ics', C.generarICS(estado), 'text/calendar;charset=utf-8');
    avisar('Abre el archivo para agregarlo a tu calendario');
  },
  notificaciones: async () => {
    const r = await Notification.requestPermission();
    avisar(r === 'granted' ? 'Te avisaré al abrir la app' : 'Permiso denegado');
    if (r === 'granted') notificarPendientes(true);
    render();
  },
  tema: (el) => {
    P().tema = el.dataset.v;
    guardarLuego();
    render();
  },
  acento: (el) => {
    P().acento = el.dataset.c;
    guardarLuego();
    render();
  },
  color: (el) => {
    P()[el.dataset.l][Number(el.dataset.i)].color = el.dataset.c;
    guardarLuego();
    render();
  },
  'elegir-icono': (el) => panelIconos(el.dataset.l, Number(el.dataset.i), el.dataset.l === 'bolsas' ? ICONOS_BOLSA : ICONOS_CATEGORIA),
  agregar: (el) => {
    const l = el.dataset.l;
    const p = P();
    const id = C.nuevoId();
    const nuevos = {
      ingresos: { id, nombre: 'Nuevo ingreso', monto: 0, moneda: p.moneda, dia: 1, categoria: p.categoriasIngreso[0]?.id || '', impuestoPct: 0, nota: '' },
      bolsas: { id, nombre: 'Nueva bolsa', icono: 'piggy-bank', color: COLORES[p.bolsas.length % COLORES.length], moneda: p.moneda, modo: 'pct', valor: 0, meta: 0, metaMinima: 0, fechaMeta: '' },
      categoriasGasto: { id, nombre: 'Nueva categoría', icono: 'sparkles' },
      categoriasIngreso: { id, nombre: 'Nueva categoría', icono: 'coins' },
      eventos: { id, titulo: 'Nuevo recordatorio', detalle: '', frecuencia: 'anual', mes: 1, dia: 1 },
    };
    p[l].push(nuevos[l]);
    guardarLuego();
    render();
  },
  quitar: (el) => {
    const l = el.dataset.l;
    const item = P()[l][Number(el.dataset.i)];
    const tipos = { bolsas: ['aporte', 'retiro'], categoriasGasto: ['gasto'], categoriasIngreso: ['ingreso'] }[l];
    if (tipos) {
      const usos = estado.movimientos.filter((m) => tipos.includes(m.tipo) && m.categoria === item.id).length + (l === 'bolsas' ? estado.plazos.filter((x) => x.bolsa === item.id).length : 0);
      if (usos) return avisar(`No se puede quitar: tiene ${usos} movimiento(s) o plazo(s) asociados`);
    }
    if (!confirm(`¿Quitar "${item.nombre || item.titulo}"?`)) return;
    P()[l].splice(Number(el.dataset.i), 1);
    if (l === 'bolsas' && P().metaPrincipal === item.id) P().metaPrincipal = P().bolsas[0]?.id || null;
    guardarLuego();
    render();
  },
  'consultar-tc': async () => {
    avisar('Consultando…');
    try {
      const p = P();
      const j = await conTiempo(`https://open.er-api.com/v6/latest/${encodeURIComponent(p.monedaSecundaria)}`);
      const tc = j?.rates?.[p.moneda];
      if (j.result !== 'success' || !tc) throw new Error('respuesta inesperada');
      Object.assign(p, { tc: Number(tc.toFixed(3)), tcFecha: C.hoyISO(), tcFuente: 'open.er-api.com (referencial)' });
      await guardar();
      avisar(`1 ${p.monedaSecundaria} = ${p.tc} ${p.moneda}`);
      render();
    } catch (err) {
      avisar(`No se pudo consultar (${err.message}). Ingrésalo a mano.`);
    }
  },
  'exportar-json': () => descargar(`finanzas-respaldo-${C.hoyISO()}.json`, JSON.stringify(estado, null, 2), 'application/json'),
  'exportar-csv': () => descargar(`finanzas-movimientos-${C.hoyISO()}.csv`, C.movimientosACSV(estado.movimientos), 'text/csv;charset=utf-8'),
  'exportar-perfil': () => descargar('finanzas-configuracion.json', JSON.stringify(C.exportarPerfil(estado), null, 2), 'application/json'),
  importar: () => $('#archivo-importar').click(),
  asistente: () => {
    estado.configurado = false;
    pasoAsistente = 1;
    plantillaElegida = 'actual';
    render();
  },
  'borrar-todo': async () => {
    if (!confirm('¿Borrar TODOS los datos de este teléfono? Exporta un respaldo antes.')) return;
    if (!confirm('Última confirmación: no se puede deshacer.')) return;
    await DB.borrarTodo();
    estado = C.estadoInicial();
    pasoAsistente = 0;
    plantillaElegida = null;
    await guardar();
    render();
  },
  plantilla: (el) => {
    plantillaElegida = el.dataset.v;
    const nombre = P().nombre;
    estado.perfil = PLANTILLAS[plantillaElegida].crear();
    estado.perfil.nombre = nombre;
    guardarLuego();
    render();
  },
  'asistente-atras': () => {
    pasoAsistente = Math.max(pasoAsistente - 1, 0);
    render();
  },
  'asistente-siguiente': async () => {
    if (pasoAsistente < PASOS_ASISTENTE - 1) {
      pasoAsistente++;
      render();
      window.scrollTo({ top: 0 });
      return;
    }
    for (const inp of $$('[data-saldo]')) {
      const v = Number(inp.value);
      if (v > 0) estado.movimientos.push({ id: C.nuevoId(), fecha: C.hoyISO(), tipo: 'aporte', categoria: inp.dataset.saldo, monto: v, moneda: P().moneda, tc: P().tc, nota: 'Saldo inicial', inicial: true });
    }
    estado.configurado = true;
    await guardar();
    vista = 'inicio';
    render();
    avisar('¡Listo! Ahora agrega los recordatorios a tu calendario desde Avisos.');
  },
};

function alCambiarCampo(el) {
  const p = P();
  const valor = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.dataset.t === 'n' ? (el.value === '' ? 0 : Number(el.value)) : el.value;
  let repintar = false;
  if (el.dataset.p) {
    const k = el.dataset.p;
    p[k] = k === 'monedaSecundaria' || k === 'metaPrincipal' ? valor || null : valor;
    if (k === 'tc') Object.assign(p, { tcFuente: 'Manual', tcFecha: C.hoyISO() });
    if (k === 'moneda' && p.monedaSecundaria === p.moneda) p.monedaSecundaria = null;
    repintar = ['moneda', 'monedaSecundaria', 'ocultarMontos', 'metaPrincipal'].includes(k);
  } else if (el.dataset.l) {
    const item = p[el.dataset.l][Number(el.dataset.i)];
    item[el.dataset.k] = valor;
    repintar = ['modo', 'frecuencia'].includes(el.dataset.k);
  } else return;
  guardarLuego();
  if (repintar) render();
  else {
    if ($('#resumen-presupuesto')) $('#resumen-presupuesto').innerHTML = resumenPresupuesto();
    if ($('#suma-pct')) $('#suma-pct').innerHTML = chipSumaPct();
  }
}

async function importarArchivo(archivo) {
  try {
    const texto = await archivo.text();
    if (archivo.name.toLowerCase().endsWith('.csv')) {
      const nuevos = C.parsearCSV(texto, P());
      const ids = new Set(estado.movimientos.map((m) => m.id));
      const agregar = nuevos.filter((m) => !ids.has(m.id));
      estado.movimientos.push(...agregar);
      await guardar();
      avisar(`${agregar.length} movimientos importados`);
    } else {
      const json = JSON.parse(texto);
      if (json.tipo === 'perfil-mis-finanzas') {
        estado.perfil = C.validarPerfil({ ...PLANTILLAS.generica.crear(), ...json.perfil });
        plantillaElegida = 'importada';
        avisar('Configuración cargada');
      } else {
        const nuevo = C.validarRespaldo(json);
        if (estado.movimientos.length && !confirm('Esto reemplazará TODOS tus datos actuales. ¿Continuar?')) return;
        estado = nuevo;
        avisar('Respaldo restaurado');
      }
      await guardar();
    }
    render();
  } catch (err) {
    avisar(`Error al importar: ${err.message}`);
  }
}

// ---------- Red y notificaciones ----------

async function conTiempo(url, ms = 7000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function notificarPendientes(forzar = false) {
  if (!estado?.configurado || !('Notification' in window) || Notification.permission !== 'granted') return;
  const hoy = C.hoyISO();
  const clave = `notificado-${hoy}`;
  if (!forzar && sessionStorage.getItem(clave)) return;
  const pendientes = C.recordatorios(estado, hoy, 1).filter((r) => r.enDias <= 0 && !estado.hechos[r.clave]);
  if (!pendientes.length) return;
  sessionStorage.setItem(clave, '1');
  const reg = await navigator.serviceWorker?.getRegistration();
  const cuerpo = pendientes.map((r) => r.titulo).join(' · ');
  if (reg) reg.showNotification('Mis Finanzas', { body: cuerpo, icon: 'icons/icon-192.png', tag: clave });
  else new Notification('Mis Finanzas', { body: cuerpo });
}

// ---------- Arranque ----------

async function iniciar() {
  try {
    estado = await DB.cargar();
    if (estado && estado.version !== C.VERSION_DATOS) estado = C.validarRespaldo(estado);
  } catch (err) {
    console.error(err);
    estado = null;
  }
  if (!estado) {
    estado = C.estadoInicial();
    await guardar();
  }
  DB.pedirPersistencia();

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-accion]');
    if (!el || el.type === 'checkbox') return;
    const accion = el.dataset.accion;
    const fn = panelActual?.acciones[accion] || ACCIONES[accion];
    if (fn) {
      e.preventDefault();
      fn(el);
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.type === 'checkbox' && el.dataset.accion) return ACCIONES[el.dataset.accion]?.(el);
    if (el.id === 'archivo-importar') {
      if (el.files[0]) importarArchivo(el.files[0]);
      el.value = '';
      return;
    }
    if (el.closest('#contenido')) alCambiarCampo(el);
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && panelActual && cerrarPanel());
  document.addEventListener(
    'toggle',
    (e) => {
      const s = e.target.dataset?.seccion;
      if (s) e.target.open ? seccionesAbiertas.add(s) : seccionesAbiertas.delete(s);
    },
    true,
  );
  window.addEventListener('hashchange', () => {
    const v = location.hash.slice(1);
    if (VISTAS[v] && v !== vista) ir(v);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => estado.configurado && render());
  let ancho = window.innerWidth;
  window.addEventListener('resize', () => {
    if (vista === 'inicio' && window.innerWidth !== ancho) {
      ancho = window.innerWidth;
      dibujarGraficos();
    }
  });

  for (const el of $$('[data-icono]')) el.outerHTML = I(el.dataset.icono, { tam: Number(el.dataset.tam) || 22, grosor: el.dataset.tam ? 2.5 : 2 });
  const h = location.hash.slice(1);
  if (VISTAS[h]) vista = h;
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(() => notificarPendientes()).catch(console.error);
  }
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && notificarPendientes());
}

iniciar();

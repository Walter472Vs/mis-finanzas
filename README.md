# Mis Finanzas: plan y app

| Archivo / carpeta | Qué es |
|---|---|
| `FASE1_INVESTIGACION.md` | Investigación con fuentes: impuestos, beneficios, plazos fijos, ETFs e hipotecario (solo en la computadora, no se sube) |
| `PLAN.md` | Plan financiero personal (solo en la computadora, no se sube) |
| [app/](app/) | La app para el celular (PWA). La puede usar cualquier persona |
| `mi-respaldo-inicial.json` | **Tu** configuración ya cargada, lista para importar. Es privada: está en `.gitignore` |

---

## La app

### Qué hace
- **Asistente inicial** en 6 pasos:
  1. Plantilla (**Perú** o **Genérica**).
  2. Nombre y monedas.
  3. Ingresos y días de pago.
  4. Gastos y ahorro.
  5. Bolsas y metas.
  6. Saldos iniciales.
- **Todo se puede configurar** y editar después en *Ajustes*:
  - **Nombre**, **moneda principal y secundaria** (PEN, USD, EUR, MXN, COP, CLP, ARS, BOB, BRL, GBP) y **tipo de cambio**, que escribes a mano o consultas en internet.
  - **Ingresos**: nombre, monto, moneda, día de pago, % de impuesto a apartar e instrucción extra para ese día.
  - **Bolsas y metas** (emergencia, depa, ETF, viaje…): ícono, color, moneda, aporte (% del ahorro o monto fijo), meta, meta mínima y fecha meta.
  - **Categorías** de gastos e ingresos, con su ícono.
  - **Recordatorios**: mensuales, trimestrales o anuales, por ejemplo gratificaciones, CTS o declaración de renta.
  - **Tema** (oscuro, claro o automático), **color de acento** y **modo privado** (difumina los montos).
- **Inicio**:
  - Patrimonio neto, con variación mensual y una mini gráfica.
  - **Anillo de progreso** de tu meta principal, con la fecha estimada al ritmo actual y cuánto necesitas al mes para llegar a tu fecha.
  - Carrusel de bolsas.
  - Resumen del mes: presupuesto, top de gastos, tasa de ahorro y dinero "sin asignar".
  - Próximos recordatorios.
  - Gráficos de evolución, composición y rendimiento.
- **Registrar**: botón **+** central que abre un panel desde abajo. Tiene montos grandes, cuadrícula de categorías con íconos y atajos por cada ingreso. Para editar o borrar un movimiento, tócalo en la lista.
- **Plazos fijos**:
  - Interés devengado, interés al vencer y barra de avance.
  - Aviso N días antes del vencimiento.
  - Alerta si superas tu límite por entidad.
  - Al "cobrarlo", el interés se suma a la bolsa como rendimiento.
- **Días de pago**: te dice cuánto apartar para impuestos, gastos y cada bolsa. El reparto es proporcional a lo que aporta cada ingreso, y te convierte a dólares lo que va a bolsas en dólares.
- **Calendario (.ics)** con todos tus recordatorios, para que tu teléfono te avise aunque la app esté cerrada.
- **Automatizaciones:**
  - **Pegar aviso del banco**: pegas el texto de la notificación, el SMS o el correo de abono, y la app detecta el monto, la moneda, la fecha y a qué ingreso corresponde.
  - **Registrar y repartir**: con un toque se crean el ingreso, el impuesto y los aportes a cada bolsa según tu plan. Si llegó más o menos de lo previsto, el reparto se ajusta solo.
  - **Tipo de cambio automático** una vez al día (se puede desactivar).
  - **Ajustar saldo**: tocas una bolsa, escribes el saldo real de tu cuenta y la diferencia se registra como interés.
- **Respaldo**:
  - Respaldo completo (JSON).
  - Movimientos (CSV).
  - Solo configuración (JSON), para compartirla con otra persona sin tus datos.
- **Sin conexión**, con los datos **solo en tu teléfono**. No hay bancos, claves ni nube.

### Diseño
Estilo oscuro "futurista" inspirado en apps como Revolut, Copilot Money y Monarch:
- Fondo con aurora de color y tarjetas con efecto de vidrio esmerilado.
- Tarjeta principal con borde degradado y montos grandes.
- Barra de navegación flotante con botón de acción central.
- Paneles que se deslizan desde abajo (*bottom sheets*).
- Íconos de **[Lucide](https://lucide.dev)** (licencia ISC), incluidos dentro de la app para que funcionen sin conexión.
- Respeta el área segura del iPhone (notch y barra inferior) y la preferencia de "reducir movimiento".

### Stack
| Decisión | Por qué |
|---|---|
| HTML + CSS + JavaScript (módulos ES), sin frameworks | No hay que compilar nada ni mantener dependencias. Se publica copiando la carpeta. |
| Íconos Lucide copiados en `js/icons.js` | Funcionan offline y no se carga código de terceros desde un CDN. |
| Gráficos propios en `<canvas>` | Lo mismo: sin librerías externas cerca de tus datos financieros. |
| IndexedDB + almacenamiento persistente | Es el guardado local más robusto del navegador. |
| Service worker "red primero" | Con internet siempre carga la última versión; sin internet usa la copia guardada. |
| Recordatorios con `.ics` | Una PWA no puede programar alarmas confiables con la app cerrada (en iPhone necesitaría un servidor de push). El calendario del teléfono sí te avisa siempre. |

### Estructura
```
app/
  index.html             estructura base
  styles.css             diseño (temas, vidrio, paneles, navegación)
  manifest.webmanifest   datos para instalarla
  sw.js                  service worker (offline)
  js/calc.js             lógica pura: reparto, metas, intereses, recordatorios, ICS, CSV, respaldos
  js/plantillas.js       plantillas Perú y Genérica, monedas, colores, íconos
  js/app.js              interfaz: asistente, vistas, paneles, editores
  js/charts.js           gráficos
  js/icons.js            íconos Lucide
  js/db.js               IndexedDB
  tests/calc.test.mjs    18 pruebas
```

### Pruebas
```bash
cd app && npm test
```
Cubren:
- las plantillas,
- las fechas, incluidos los días de pago a fin de mes,
- la conversión de monedas,
- el reparto del ahorro (montos fijos y porcentajes),
- el plan de cada día de pago,
- el interés y las alertas de plazos fijos, y la concentración por entidad,
- los saldos en varias monedas, el progreso y la fecha estimada de las metas,
- la serie del patrimonio y el resumen del mes,
- los recordatorios mensuales, trimestrales y anuales,
- el formato del archivo .ics,
- el CSV,
- la validación de respaldos y la migración desde la versión anterior.

Para probarla en tu computadora:
```bash
cd app && python -m http.server 8080
```

---

## Publicarla gratis

### Opción A: GitHub Pages (recomendada; corre las pruebas en cada cambio)
1. Crea un repositorio en github.com, por ejemplo `mis-finanzas`.
2. Sube **solo la app**. Así `PLAN.md` y `FASE1_INVESTIGACION.md`, que tienen tus sueldos, no quedan públicos:
   ```bash
   git init
   ```
   ```bash
   git add app .github .gitignore README.md
   ```
   ```bash
   git commit -m "App de finanzas"
   ```
   ```bash
   git branch -M main
   ```
   ```bash
   git remote add origin https://github.com/TU_USUARIO/mis-finanzas.git
   ```
   ```bash
   git push -u origin main
   ```
3. En GitHub, ve a **Settings → Pages → Source: "GitHub Actions"**.
4. En 1–2 minutos estará en `https://TU_USUARIO.github.io/mis-finanzas/`.

### Opción B: Netlify (sin git)
1. Entra a app.netlify.com/drop.
2. Arrastra la carpeta `app`.
3. Listo: te da una URL `https://xxx.netlify.app`.

### Opción C: Vercel
1. Importa el repositorio en vercel.com.
2. En **Root Directory**, pon `app`. En **Framework**, elige "Other".

---

## Instalarla en tu celular

### iPhone (Safari)
1. Abre la URL en **Safari**.
2. Toca **Compartir** y luego **Agregar a pantalla de inicio**.
3. Ábrela **desde el ícono**: se ve a pantalla completa, como una app nativa, y funciona sin conexión.
4. En el asistente, elige **"Importar respaldo o configuración"** y selecciona `mi-respaldo-inicial.json`. Para tenerlo en el iPhone, mándatelo por AirDrop o súbelo a iCloud Drive. Con eso la app queda con tu perfil, tus metas y tu fondo de emergencia.
5. Ve a **Avisos → Descargar calendario**, abre el archivo y toca **Agregar todo**.

Notas para iPhone:
- Los datos de la app instalada están separados de los de Safari. Úsala siempre desde el ícono.
- iOS puede borrar los datos de webs que no usas en mucho tiempo. Una app agregada a la pantalla de inicio está protegida, pero igual **exporta un respaldo cada mes**. Ya viene un recordatorio configurado para eso.
- No hace falta App Store ni cuenta de desarrollador.

### Automatizar los avisos del banco con Atajos (iPhone)
Una app web no puede leer tus notificaciones ni tus correos, y la app no se conecta a tu banco a propósito. Lo que sí puedes hacer es que un **Atajo de iOS** copie el aviso por ti:

1. En la app de tu banco (BCP, Interbank…), activa los **avisos de abono por SMS o correo**. Las notificaciones *push* de la app del banco no las puede leer un Atajo.
2. Abre **Atajos → Automatización → Nueva automatización**:
   - **Si te llegan por SMS**: elige **Mensaje**, con **Remitente** = el número o nombre del banco y **El mensaje contiene** = "abono".
   - **Si te llegan por correo**: elige **Correo**, con **Remitente** = el correo de notificaciones del banco y **El asunto contiene** = "abono" o "constancia".
   - Elige **Ejecutar inmediatamente**.
3. Agrega estas dos acciones:
   - **Copiar al portapapeles** → *Entrada del atajo* (el contenido del mensaje).
   - **Mostrar notificación** → "Abre Mis Finanzas y toca Pegar aviso".
4. Cuando llegue tu sueldo, abre la app y toca **Pegar aviso → Pegar del portapapeles → Registrar y repartir**.

Si tu banco usa un formato que la app no reconoce, copia un aviso de ejemplo (sin números de cuenta) y se ajusta el lector.

### Android (Chrome)
Abre la URL en Chrome y toca **⋮ → Instalar app**. Chrome genera e instala un **WebAPK**, que es un APK real firmado por Google.

### ¿Y un APK o una app de App Store?
| Plataforma | Opción | Costo | Comentario |
|---|---|---|---|
| Android | Instalar desde Chrome (WebAPK) | Gratis | Lo más simple. Ya es un APK |
| Android | **PWABuilder** (pwabuilder.com) → paquete Android | Gratis | Genera un `.apk`/`.aab` a partir de tu URL publicada. Lo instalas directo o lo subes a Google Play (registro único de US$ 25) |
| iPhone | **Agregar a pantalla de inicio** | Gratis | La opción recomendada |
| iPhone | Envolverla con Capacitor y compilar en Xcode | Necesitas una Mac. Con Apple ID gratis la app caduca cada 7 días; para que dure o ir a la App Store, US$ 99 al año | Solo vale la pena si quieres publicarla en la App Store |

---

## Respaldo y privacidad
- Tus datos viven **solo en el teléfono**. Exporta un respaldo cada mes (*Ajustes → Respaldo y datos*).
- **Respaldo completo**: restaura todo y **reemplaza** lo que haya. **Solo configuración**: sirve para pasarle tu plantilla a otra persona sin tus movimientos. **CSV**: para Excel o Sheets; al importarlo, agrega movimientos.
- La app solo usa internet para actualizarse y para consultar el tipo de cambio cuando tú lo pides (open.er-api.com, que es un valor de referencia). Para impuestos, usa el tipo de cambio oficial (SUNAT/SBS en Perú).
- El `.gitignore` evita subir respaldos y tu `mi-respaldo-inicial.json` al repositorio.

### Sincronización en la nube (opcional, no incluida)
| Opción | Ventaja | Riesgos |
|---|---|---|
| Exportar el JSON a iCloud o Drive a mano | Simple; tú controlas el archivo | El archivo queda sin cifrar en tu nube: usa verificación en dos pasos |
| Igual que lo anterior, pero **cifrado** (por ejemplo con Cryptomator o un zip con contraseña) | Si alguien entra a tu nube, no puede leerlo | Si pierdes la contraseña, pierdes el respaldo |
| Sincronización automática (Firebase o Supabase) | Varios dispositivos con los mismos datos | Tus finanzas quedan en el servidor de un tercero. Un error en las reglas de acceso expone tus datos. Necesitas iniciar sesión y mantenerla |

---

## Validar con profesionales
La app y el plan **no reemplazan a un contador ni a un asesor financiero**.

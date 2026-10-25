// Lectura de capturas bancarias con Claude (opcional). Usa la clave de API del propio usuario,
// guardada solo en su teléfono. Las imágenes se envían a Anthropic para leerlas.
import { esquemaExtraccion, promptExtraccion } from './calc.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.133.0/+esm';
const MODELO = 'claude-opus-5-5';
const LADO_MAXIMO = 1568; // px: más grande no mejora la lectura y cuesta más

// Reduce y comprime la captura antes de enviarla (menos tokens, más rápido).
export async function prepararImagen(archivo) {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { mediaType: 'image/jpeg', data: dataUrl.split(',')[1], vista: dataUrl };
}

export async function leerCapturas(apiKey, imagenes, perfil, hoy, reglas) {
  const { default: Anthropic } = await import(SDK_URL);
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const contenido = [
    ...imagenes.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })),
    { type: 'text', text: promptExtraccion(perfil, hoy, reglas) },
  ];
  let respuesta;
  try {
    respuesta = await client.beta.messages.create({
      model: MODELO,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: esquemaExtraccion(perfil) } },
      messages: [{ role: 'user', content: contenido }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('La clave de API no es válida. Revísala en Ajustes.');
    if (err instanceof Anthropic.PermissionDeniedError) throw new Error('Tu clave no tiene permiso para este modelo.');
    if (err instanceof Anthropic.RateLimitError) throw new Error('Demasiadas solicitudes o sin saldo. Intenta en un minuto o revisa tu saldo en console.anthropic.com.');
    if (err instanceof Anthropic.BadRequestError) throw new Error(`Solicitud rechazada: ${err.message}`);
    if (err instanceof Anthropic.APIConnectionError) throw new Error('Sin conexión con Anthropic. Revisa tu internet.');
    if (err instanceof Anthropic.APIError) throw new Error(`Error de la API (${err.status ?? '?'}): ${err.message}`);
    throw err;
  }
  if (respuesta.stop_reason === 'refusal') throw new Error('La IA no pudo procesar estas imágenes. Prueba con otras capturas.');
  if (respuesta.stop_reason === 'max_tokens') throw new Error('Demasiados movimientos en una sola vez. Sube menos capturas por tanda.');
  const texto = respuesta.content.find((b) => b.type === 'text')?.text;
  if (!texto) throw new Error('La IA no devolvió resultados.');
  return { datos: JSON.parse(texto), uso: respuesta.usage };
}

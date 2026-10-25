// Persistencia local en IndexedDB. Todo el estado se guarda como un solo documento.

const NOMBRE_BD = 'finanzas-pwa';
const ALMACEN = 'estado';
const CLAVE = 'principal';

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOMBRE_BD, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(ALMACEN);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function transaccion(modo, fn) {
  const bd = await abrir();
  return new Promise((resolve, reject) => {
    const tx = bd.transaction(ALMACEN, modo);
    const req = fn(tx.objectStore(ALMACEN));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export function cargar() {
  return transaccion('readonly', (s) => s.get(CLAVE));
}

export function guardar(estado) {
  return transaccion('readwrite', (s) => s.put(estado, CLAVE));
}

export function borrarTodo() {
  return transaccion('readwrite', (s) => s.delete(CLAVE));
}

// La clave de API se guarda aparte del estado para que nunca salga en los respaldos exportados.
const CLAVE_API = 'clave-api-anthropic';

export function cargarClaveApi() {
  return transaccion('readonly', (s) => s.get(CLAVE_API));
}

export function guardarClaveApi(clave) {
  return transaccion('readwrite', (s) => s.put(clave, CLAVE_API));
}

export function borrarClaveApi() {
  return transaccion('readwrite', (s) => s.delete(CLAVE_API));
}

// Pide al navegador que no borre los datos si falta espacio (importante en iPhone).
export async function pedirPersistencia() {
  if (navigator.storage?.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

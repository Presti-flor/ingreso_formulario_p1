const { google } = require('googleapis');

// ⚠️ IMPORTANTE: NO loguear las credenciales en producción
// console.log(process.env.google_sheets_credentials); // Debug solo local si lo necesitas

const creds = JSON.parse(process.env.google_sheets_credentials);

// Autenticación con Google API
const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// ID de tu hoja de Google Sheets
const SPREADSHEET_ID = '1QLMdDyv78yY52QRj7poCcAnj9Rh9jVL-Y5EUF81xnLE';

// Generar un ID único (fallback si no viene id desde el form/QR)
function generateUniqueId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomPart}`;
}

/**
 * Verifica si ya existe un registro con el mismo ID **y bloque** en la hoja.
 * Estructura de columnas en la hoja "Ingreso Fin y Nac":
 * A: fecha
 * B: bloque
 * C: variedad
 * D: tamano
 * E: tallos
 * F: etapa
 * G: tipo
 * H: id
 */
async function existsSameRecord({ id, bloque }) {
  if (!id || !bloque) return false; // sin id o sin bloque no hacemos control
  const bloqueStr = String(bloque).trim();

  try {
    // Leemos A:H para tener bloque (B) e id (H)
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Ingreso Fin y Nac!A:H',
    });

    const rows = resp.data.values || [];

    const found = rows.some(row => {
      const sheetBloque = (row[1] || '').toString().replace(/[^0-9]/g, '').trim(); // Columna B
      const sheetId = (row[7] || '').toString().trim();                             // Columna H
      return sheetId === idStr && sheetBloque === bloqueStr;
    });

    console.log(
      '[existsSameRecord] ID',
      idStr,
      'Bloque',
      bloqueStr,
      '=>',
      found ? 'DUPLICADO' : 'libre'
    );
    return found;
  } catch (error) {
    console.error('Error verificando duplicado en Google Sheets:', error);
    // En caso de error, por seguridad dejamos continuar (false)
    return false;
  }
}

// Función para agregar una nueva fila
// Espera un objeto: { id, fecha, bloque, variedad, tallos, etapa, tipo, tamano }
async function addRecord(data) {
  const sanitizedBloque = String(data.bloque || '').replace(/[^0-9]/g, '');

  // Si el servidor/envía un id, usamos ese. Si no, generamos uno.
  const finalId = data.id || generateUniqueId();

  // Depuración sana
  console.log('Datos antes de enviar a Google Sheets:', {
    fecha: data.fecha,
    bloque: sanitizedBloque,
    variedad: data.variedad,
    tamano: data.tamano,
    tallos: data.tallos,
    etapa: data.etapa,
    tipo: data.tipo,
    id: finalId,
  });

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Ingreso Fin y Nac!A2', // La hoja y rango base
      valueInputOption: 'RAW',
      resource: {
        values: [
          [
            data.fecha,                 // A: fecha
            sanitizedBloque,            // B: bloque
            data.variedad || '',        // C: variedad
            data.tamano || '',          // D: tamano
            data.tallos ?? '',          // E: tallos
            data.etapa || '',           // F: etapa
            data.tipo || '',            // G: tipo
            finalId,                    // H: id
          ],
        ],
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error al guardar en Google Sheets:', error);
    throw error;
  }
}

module.exports = { addRecord, existsSameRecord };
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
 * Verifica si ya existe un registro con el mismo ID en la hoja.
 * Asumimos que el ID se guarda en la columna H (8ª columna),
 * porque en addRecord lo estamos enviando como último valor.
 */
async function existsSameRecord({ id }) {
  if (!id) return false; // sin id no hacemos control

  const idStr = String(id).trim();

  try {
    // Leemos solo la columna H (ID) de la hoja
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Ingreso Fin y Nac!H:H', // Columna H completa
    });

    const rows = resp.data.values || [];

    // rows es un array de arrays: [[id1],[id2],...]
    const found = rows.some(row => {
      const cell = (row[0] || '').toString().trim();
      return cell === idStr;
    });

    console.log('[existsSameRecord] ID', idStr, '=>', found ? 'DUPLICADO' : 'libre');
    return found;
  } catch (error) {
    console.error('Error verificando duplicado en Google Sheets:', error);
    // En caso de error, por seguridad dejamos continuar (false)
    return false;
  }
}

// Función para agregar una nueva fila
// Espera un objeto: { id, fecha, bloque, variedad, tallos, etapa, tipo, tamaño }
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
            data.tamano || '',          // D: tamaño
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
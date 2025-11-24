const { google } = require('googleapis');

// Obtener las credenciales desde la variable de entorno
console.log(process.env.google_sheets_credentials); // Debug
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

// Función para agregar una nueva fila
async function addRecord(data) {
  const sanitizedBloque = String(data.bloque || '').replace(/[^0-9]/g, '');

  // Si el servidor/envía un id, usamos ese. Si no, generamos uno.
  const finalId = data.id || generateUniqueId();

  // OJO: el servidor manda `tamano` (sin ñ)
  const tamano = data.tamano || data.tamaño || ''; 

  // Depuración
  console.log('Datos antes de enviar a Google Sheets:', {
    fecha: data.fecha,
    bloque: sanitizedBloque,
    variedad: data.variedad,
    tamano,
    numero_tallos: data.numero_tallos,
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
            data.fecha,                         // A: fecha
            sanitizedBloque,                    // B: bloque
            data.variedad || '',                // C: variedad
            tamano,                             // D: tamaño
            data.numero_tallos ?? '',           // E: numero_tallos
            data.etapa || '',                   // F: etapa
            data.tipo || '',                    // G: tipo
            finalId,                            // H: id (form/QR o generado)
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

module.exports = { addRecord };
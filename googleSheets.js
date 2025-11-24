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

// Generar un ID único (timestamp + parte aleatoria)
function generateUniqueId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomPart}`;
}

// Función para agregar una nueva fila
async function addRecord(data) {
  const sanitizedBloque = data.bloque.replace(/[^0-9]/g, '');
  const uniqueId = generateUniqueId();

  // Depuración
  console.log('Datos antes de enviar a Google Sheets:', {
    fecha: data.fecha,
    bloque: sanitizedBloque,
    variedad: data.variedad,
    tamaño: data.tamaño,
    numero_tallos: data.numero_tallos,
    etapa: data.etapa,
    tipo: data.tipo,
    uniqueId,
  });

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Ingreso Fin y Nac!A2', // La hoja y rango base
      valueInputOption: 'RAW',
      resource: {
        values: [
          [
            data.fecha,
            sanitizedBloque,
            data.variedad,
            data.tamaño,
            data.numero_tallos,
            data.etapa,
            data.tipo,
            uniqueId, // 👈 Última columna
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
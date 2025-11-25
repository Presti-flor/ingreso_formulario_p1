const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
// Solo importamos addRecord y existsSameRecord desde googleSheets
const { addRecord, existsSameRecord } = require('./googleSheets');

const app = express();
const port = 8080;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 🔌 Conexión a PostgreSQL (Railway / misma BD del otro servicio)//////

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // con Railway casi siempre lo dejamos así
  },
});

/*
  Asegúrate que en PostgreSQL tengas algo así (adaptado a tu diseño de ID NO autoincremental):

  CREATE TABLE IF NOT EXISTS registrosp1 (
    id        TEXT NOT NULL,
    fecha     DATE NOT NULL,
    bloque    NUMERIC NOT NULL,   -- 👈 ahora numérico/decimal
    variedad  TEXT NOT NULL,
    tallos    INTEGER NOT NULL,
    tamano    TEXT,
    etapa     TEXT,
    tipo      TEXT
  );
*/

// 👉 Función para guardar formulario en PostgreSQL
async function saveToPostgresForm({ id, fecha, bloque, variedad, tallos, tamano, etapa, tipo }) {
  const query = `
    INSERT INTO registrosp1
      (id,  fecha, bloque, variedad, tallos, etapa, tipo, tamano)
    VALUES
      ($1,  $2,    $3,     $4,      $5,     $6,   $7,   $8)
    RETURNING *;
  `;

  const values = [
    id,                         // id (texto, tú lo defines)
    fecha,                      // fecha 'YYYY-MM-DD'
    bloque !== null ? Number(bloque) : null, // bloque numérico (decimal/integer)
    variedad,                   // variedad
    tallos,                     // tallos (número)
    etapa || null,              // etapa
    tipo || null,               // tipo
    tamano || null,             // tamano
  ];

  console.log('🧪 INSERT Form → Postgres', { query, values });
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

// ====== IP Whitelist Setup ======
app.set('trust proxy', true);
const ALLOWED_IPS = (process.env.ALLOWED_IPS || '181.78.78.61,186.102.115.133,186.102.51.69,186.102.77.146,190.61.45.230,192.168.10.23,192.168.10.1,186.102.62.30,186.102.55.56')
  .split(',')
  .map(ip => ip.trim())
  .filter(Boolean);

function getClientIp(req) {
  let ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress || '';
  if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
  return ip;
}

function ipWhitelist(req, res, next) {
  if (!ALLOWED_IPS.length) return next();
  const ip = getClientIp(req);
  const ok = ALLOWED_IPS.some(allowed => ip === allowed || (allowed.endsWith('.') && ip.startsWith(allowed)));
  if (!ok) {
    console.warn(`Bloqueado: IP ${ip} no permitida`);
    return res.status(403).send('Acceso denegado: IP no autorizada para enviar formularios.');
  }
  next();
}

/** ================== Reglas de tamano (negocio) ================== */
function allowedSizes(variedad, bloque) {
  const v = (variedad || '').toLowerCase().trim();
  const b = String(bloque || '').trim();
  if (v === 'freedom') return ['largo', 'corto', 'ruso'];
  if (v === 'vendela' && b === '1') return ['ruso', 'na']; // NA se muestra pero se guarda vacío
  return [];
}

function isSizeAllowed(variedad, bloque, tamano) {
  const t = (tamano || '').toLowerCase().trim();
  return allowedSizes(variedad, bloque).includes(t);
}

// Si el tamano es "na" => guardar en blanco. Si es válido, devolver en minúsculas.
// tipo = nacional => jamás guarda tamano.
function normalizeSizeForStorage(variedad, bloque, tamano, tipo) {
  if ((tipo || '').toLowerCase() === 'nacional') return null; // nacional jamás guarda tamano
  const t = (tamano || '').toLowerCase().trim();
  if (!isSizeAllowed(variedad, bloque, t)) return null; // inválidos => no guardar
  if (t === 'na') return null; // NA => celda vacía
  return t; // 'largo' | 'corto' | 'ruso'
}

/** =============== Helper: variedades de FIN DE CORTE (reusado) =============== */
function getFinCorteConfig(bloque) {
  const b = String(bloque);
  /**
   * Aquí mantenemos exactamente las variedades de FIN DE CORTE,
   * y las usamos también para el formulario NACIONAL.
   */
  if (b === '3') {
    return {
      variedades: [
        { value: 'freedom', label: 'Freedom' },
      ],
      seleccionVariedad: 'freedom',
    };
  } else if (b === '4') {
    return {
      variedades: [
        { value: 'freedom', label: 'Freedom' },
      ],
      seleccionVariedad: 'freedom',
    };
  } else if (b === '5') {
    return {
      variedades: [
        { value: 'freedom', label: 'Freedom' },
        { value: 'moody blue', label: 'Moody Blue' },
        { value: 'queen berry', label: 'Queen Berry' },
        { value: 'pink mondial', label: 'Pink Mondial' },
        { value: 'white ohora', label: 'White Ohora' },
        { value: 'pink ohora', label: 'Pink Ohora' },
      ],
      seleccionVariedad: 'freedom',
    };
  } else if (b === '1.1') {
    return {
      variedades: [
        { value: 'freedom', label: 'Freedom' },
      ],
      seleccionVariedad: 'freedom',
    };
  } else if (b === '6') {
    return {
      variedades: [
        { value: 'freedom', label: 'Freedom' },
      ],
      seleccionVariedad: 'freedom',
    };
  } else if (b === '8') {
    return {
      variedades: [
        { value: 'vendela', label: 'Vendela' },
        { value: 'quick sand', label: 'Quick Sand' },
        { value: 'tifany', label: 'Tifany' },
        { value: 'yellow bikini', label: 'Yellow Bikini' },
      ],
      seleccionVariedad: 'vendela',
    };
  } else if (b === '1') {
    return {
      variedades: [
        { value: 'freedom', label: 'Freedom' },
      ],
      seleccionVariedad: 'freedom',
    };
  } else if (b === '2') {
    return {
      variedades: [
        { value: 'freedom', label: 'Freedom' },
      ],
      seleccionVariedad: 'freedom',
    };
  } else if (b === '7') {
    return {
      variedades: [
        { value: 'mondial', label: 'Mondial' },
        { value: 'moody blue', label: 'Moody Blue' },
        { value: 'queen berry', label: 'Queen Berry' },
        { value: 'momentum', label: 'Momentum' },
      ],
      seleccionVariedad: 'mondial',
    };
  } else if (b === '12') {
    return {
      variedades: [
        { value: 'freedom', label: 'Freedom' },
      ],
      seleccionVariedad: 'freedom',
    };
  } else if (b === '9') {
    return {
      variedades: [
        { value: 'vendela', label: 'Vendela' },
        { value: 'hummer', label: 'Hummer' },
        { value: 'coral reff', label: 'Coral Reff' },
        { value: 'pink floyd', label: 'Pink Floyd' },
      ],
      seleccionVariedad: 'vendela',
    };
  } else if (b === '10') {
    return {
      variedades: [
        { value: 'mondial', label: 'Mondial' },
        { value: 'hummer', label: 'Hummer' },
        { value: 'hilux', label: 'Hilux' },
        { value: 'blessing', label: 'Blessing' },
      ],
      seleccionVariedad: 'mondial',
    };
  } else if (b === '11') {
    return {
      variedades: [
        { value: 'vendela', label: 'Vendela' },
      ],
      seleccionVariedad: 'vendela',
    };
  }

  // Por defecto, sin variedades
  return { variedades: [], seleccionVariedad: '' };
}

/** =============== LÓGICA CENTRAL: PROCESAR + ANTIDUPLICADO =============== */
async function processAndSaveForm({ id, variedad, tamano, tallos, etapa, bloque, tipo, force }) {
  if (!id) throw new Error('Falta el parámetro id');
  if (!variedad || !bloque || !tallos) {
    throw new Error('Faltan datos obligatorios: variedad, bloque, tallos');
  }

  const tallosNum = parseInt(tallos, 10);
  if (isNaN(tallosNum) || tallosNum < 1) {
    throw new Error('El campo tallos debe ser un número positivo');
  }

  // 👇 bloque como texto (para Sheets / lógica)
  const bloqueNorm = (bloque || '').toString().trim();
  if (!bloqueNorm) {
    throw new Error('Bloque inválido');
  }

  // 👇 bloque como número (para la base de datos NUMERIC/DECIMAL)
  const bloqueNum = Number(bloqueNorm);
  if (Number.isNaN(bloqueNum)) {
    throw new Error('Bloque debe ser numérico/decimal');
  }

  const fecha = new Date().toISOString().split('T')[0];
  const tipoNorm = (tipo || '').toLowerCase();

  // Normalizar tamano para almacenar (en BD: "tamano")
  const sizeForStorage = normalizeSizeForStorage(variedad, bloqueNorm, tamano, tipoNorm);

  // Objeto para Google Sheets (coincide con googleSheets.js)
  const dataToSave = {
    id,
    fecha,
    bloque: bloqueNorm,      // 👈 para Sheets lo dejamos como texto
    variedad,
    tallos: tallosNum,
    etapa: etapa || '',
    tipo: tipoNorm,
  };

  if (sizeForStorage !== null) {
    dataToSave.tamano = sizeForStorage;
  }

  // Antiduplicado basado en Google Sheets: ID + bloque únicos en la hoja
  if (!force) {
    const yaExiste = await existsSameRecord({
      id,
      bloque: bloqueNorm,   // aquí usamos el "código" de bloque tal cual
    });

    if (yaExiste) {
      const err = new Error('Este código ya fue registrado antes para este bloque.');
      err.code = 'DUPLICATE';
      throw err;
    }
  }

  // 🟢 1) Guardar en PostgreSQL (misma tabla que el otro sistema)
  await saveToPostgresForm({
    id,
    fecha,
    bloque: bloqueNum,          // 👈 numérico para la BD
    variedad,
    tallos: tallosNum,
    tamano: sizeForStorage,     // aquí usamos "tamano" para la columna de Postgres
    etapa: etapa || '',
    tipo: tipoNorm,
  });

  // 🟢 2) Guardar en Google Sheets (flujo original)
  await addRecord(dataToSave);

  console.log('✅ [FORM] Registrado correctamente (Postgres + Sheets):', {
    id,
    fecha,
    bloque: bloqueNorm,
    variedad,
    tallos: tallosNum,
    tamano: sizeForStorage,
    etapa,
    tipo: tipoNorm,
  });

  return dataToSave;
}

// ==================== RUTA PRINCIPAL ==========================
app.get('/', (req, res) => {
  const bloque = req.query.bloque || '3';
  const etapa = req.query.etapa || '';
  const tipo = req.query.tipo || '';
  const id = req.query.id || ''; // ⬅️ ID VIENE POR QUERY

  // ======= FORMULARIO TIPO NACIONAL (tema naranja) =============
  if (tipo === 'nacional') {
    // 👇 Ahora nacional usa las MISMAS variedades que fin de corte
    const { variedades } = getFinCorteConfig(bloque);

    return res.send(`
      <html lang="es">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Formulario Tallos Nacional</title>
        <link rel="stylesheet" type="text/css" href="/style.css"/>
        <style>
          body.theme-nacional-orange {
            background: #fdfdfd;
            color: #d85b00;
            font-family: 'Poppins', sans-serif;
          }
          .form-container {
            background: #ffffff;
            border: 2px solid #ffb366;
            border-radius: 15px;
            width: 90%;
            max-width: 500px;
            margin: 40px auto;
            box-shadow: 0 6px 18px rgba(0,0,0,0.1);
            padding: 2em;
          }
          h1.title, h2.subtitle {
            color: #d85b00;
          }
          label {
            font-weight: bold;
            color: #b64a00;
          }
          input, select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ffb366;
            border-radius: 5px;
            margin-bottom: 15px;
            color: #333;
          }
          input[type=submit] {
            background: #d85b00;
            color: #fff;
            font-weight: bold;
            cursor: pointer;
            transition: 0.3s;
          }
          input[type=submit]:hover {
            background: #ff8c1a;
          }
        </style>
      </head>
      <body class="theme-nacional-orange">
        <div class="form-container">
          <h1 class="title">REGISTRO NACIONAL</h1>
          <h2 class="subtitle">Bloque ${bloque} ${etapa ? `- Etapa: ${etapa.charAt(0).toUpperCase() + etapa.slice(1)}` : ''}</h2>
          <p><strong>ID:</strong> ${id || '(sin ID)'}</p>
          <form action="/submit" method="POST">
            <label for="bloque">Bloque:</label>
            <p style="font-size: 1.5em; padding: 10px;">${bloque}</p><br><br>

            <label for="variedad">Variedad:</label>
            <select name="variedad" required>
              ${variedades.map(v => `<option value="${v.value}">${v.label}</option>`).join('')}
            </select><br><br>

            <label for="numero_tallos">Número de tallos:</label>
            <input type="number" name="numero_tallos" required><br><br>

            <input type="hidden" name="bloque" value="${bloque}" />
            <input type="hidden" name="etapa" value="${etapa}" />
            <input type="hidden" name="tipo" value="nacional" />
            <input type="hidden" name="id" value="${id}" />

            <input type="submit" value="Enviar">
          </form>
        </div>
      </body>
      </html>
    `);
  }

  // ======= FORMULARIO FIN DE CORTE =============
  const { variedades, seleccionVariedad } = getFinCorteConfig(bloque);

  res.send(`
    <html lang="es">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Formulario Fin de Corte</title>
      <link rel="stylesheet" type="text/css" href="/style.css"/>
      <style>
        .tamano-options { display:flex; gap:8px; flex-wrap:wrap; }
        .tamano-option { padding:8px 12px; border:1px solid #999; border-radius:6px; cursor:pointer; user-select:none; }
        .tamano-option.selected { border-color:#007bff; box-shadow:0 0 0 2px rgba(0,123,255,.2); }
        .hidden { display:none !important; }
      </style>
    </head>
    <body class="theme-default">
      <div class="form-container">
        <h1>FIN DE CORTE — REGISTRO</h1>
        <h2>Bloque ${bloque} ${etapa ? `— Etapa: ${etapa.charAt(0).toUpperCase() + etapa.slice(1)}` : ''}</h2>
        <p><strong>ID:</strong> ${id || '(sin ID)'}</p>

        <form action="/submit" method="POST" id="registroForm">
          <label for="bloque">Bloque:</label>
          <p style="font-size: 1.3em; padding: 8px 0 2px;">${bloque}</p>

          <label for="variedad">Variedad:</label>
          <select name="variedad" required id="variedadSelect">
            ${variedades.map(v => `<option value="${v.value}" ${v.value===seleccionVariedad?'selected':''}>${v.label}</option>`).join('')}
          </select><br>

          <div id="tamanoSection" class="hidden">
            <label for="tamano">Elija Tamano:</label>
            <div class="tamano-options" id="tamanoOptions"></div>
            <input type="hidden" name="tamano" />
          </div><br>

          <label for="numero_tallos">Número de tallos:</label>
          <input type="number" name="numero_tallos" required><br>

          <input type="hidden" name="etapa" value="${etapa}" />
          <input type="hidden" name="bloque" value="${bloque}" />
          <input type="hidden" name="tipo" value="fin_corte" />
          <input type="hidden" name="id" value="${id}" />

          <input type="submit" value="Enviar">
        </form>
      </div>

      <script>
        function allowedSizes(variedad, bloque){
          const v = (variedad || '').toLowerCase().trim();
          const b = String(bloque || '').trim();
          if (v === 'freedom') return ['largo','corto','ruso'];
          if (v === 'vendela' && b === '1') return ['ruso','na'];
          return [];
        }

        function renderSizeOptions(){
          const variedad = document.getElementById('variedadSelect').value;
          const bloque = '${bloque}';
          const opts = allowedSizes(variedad, bloque);

          const section = document.getElementById('tamanoSection');
          const container = document.getElementById('tamanoOptions');
          const hiddenInput = document.querySelector('input[name="tamano"]');

          container.innerHTML = '';
          hiddenInput.value = '';

          if (opts.length === 0){
            section.classList.add('hidden');
            return;
          }

          section.classList.remove('hidden');
          opts.forEach(t => {
            const div = document.createElement('div');
            div.className = 'tamano-option';
            div.textContent = t.toUpperCase();
            div.dataset.value = t;
            div.onclick = function(){
              document.querySelectorAll('.tamano-option').forEach(x => x.classList.remove('selected'));
              div.classList.add('selected');
              hiddenInput.value = div.dataset.value;
            };
            container.appendChild(div);
          });
          container.querySelector('.tamano-option')?.click();
        }

        document.getElementById('variedadSelect').addEventListener('change', renderSizeOptions);
        window.onload = renderSizeOptions;

        document.getElementById('registroForm').onsubmit = function(e){
          const numInput = document.querySelector('input[name="numero_tallos"]');
          const num = (numInput.value || '').trim();
          numInput.value = num;
          if(!num || isNaN(num) || Number(num) < 1){
            e.preventDefault(); alert('Número de tallos inválido.'); return;
          }
          const visible = !document.getElementById('tamanoSection').classList.contains('hidden');
          if(visible && !document.querySelector('input[name="tamano"]').value){
            e.preventDefault(); alert('Seleccione el tamano.'); return;
          }
        }
      </script>
    </body>
    </html>
  `);
});

// ==================== RUTA POST ============================
app.post('/submit', ipWhitelist, async (req, res) => {
  const { id, variedad, tamano, numero_tallos, etapa, bloque, tipo, force } = req.body;
  const forceFlag = force === 'true' || force === '1';

  // Mapeamos a los nombres internos que usa la lógica
  const tallos = numero_tallos;

  console.log('[SUBMIT]', {
    fromIp: getClientIp(req),
    id,
    variedad,
    tamano,
    tallos,
    etapa,
    bloque,
    tipo,
    forceFlag,
  });

  try {
    const saved = await processAndSaveForm({
      id,
      variedad,
      tamano,
      tallos,
      etapa,
      bloque,
      tipo,
      force: forceFlag,
    });

    // ✅ Registro exitoso
    return res.send(`
      <html lang="es">
      <head><meta charset="UTF-8"><title>Registro exitoso</title></head>
      <body style="font-family:sans-serif; text-align:center; margin-top:50px;">
         <h1 style="font-size:40px; color:green;">✅ Registro guardado en base de datos</h1>
         <p><strong>ID:</strong> ${saved.id}</p>
         <p><strong>Variedad:</strong> ${saved.variedad}</p>
         <p><strong>Bloque:</strong> ${saved.bloque}</p>
         <p><strong>Tallos:</strong> ${saved.tallos}</p>
         ${saved.tamano ? `<p><strong>Tamano:</strong> ${saved.tamano}</p>` : ''}
      </body>
      </html>
    `);
  } catch (error) {
    console.error('[ERROR /submit]', error);

    const esDoble =
      error.code === 'DUPLICATE' ||
      (typeof error.message === 'string' && error.message.toLowerCase().includes('ya fue registrado'));

    if (esDoble) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Código ya registrado</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #ffedd5;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              color: #111827;
              padding: 16px;
            }
            .card {
              max-width: 680px;
              width: 100%;
              background: #ffffff;
              border-radius: 24px;
              box-shadow: 0 18px 45px rgba(15, 23, 42, 0.28);
              padding: 32px 28px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <main class="card">
            <h1>⚠️ Este código ya fue registrado</h1>
            <p>Si crees que es un error, contacta con el administrador.</p>
          </main>
        </body>
        </html>
      `);
    }

    return res.status(500).send(`
      <h1>Error interno al procesar el formulario</h1>
      <p>${error.message}</p>
    `);
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
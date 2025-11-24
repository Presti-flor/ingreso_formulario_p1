const express = require('express');
const bodyParser = require('body-parser');
// AHORA IMPORTA existsSameRecord TAMBIÉN
const { addRecord, existsSameRecord } = require('./googleSheets');

const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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

/** ================== Reglas de tamaño (negocio) ================== */
function allowedSizes(variedad, bloque) {
  const v = (variedad || '').toLowerCase().trim();
  const b = String(bloque || '').trim();
  if (v === 'freedom') return ['largo', 'corto', 'ruso'];
  if (v === 'vendela' && b === '1') return ['na']; // NA se muestra pero se guarda vacío
  return [];
}

function isSizeAllowed(variedad, bloque, tamano) {
  const t = (tamano || '').toLowerCase().trim();
  return allowedSizes(variedad, bloque).includes(t);
}

// Si el tamaño es "na" => guardar en blanco (no enviar campo). Si es válido, devolver en minúsculas.
function normalizeSizeForStorage(variedad, bloque, tamano, tipo) {
  if ((tipo || '').toLowerCase() === 'nacional') return null; // nacional jamás guarda tamaño
  const t = (tamano || '').toLowerCase().trim();
  if (!isSizeAllowed(variedad, bloque, t)) return null; // inválidos => no guardar
  if (t === 'na') return null; // NA => celda vacía
  return t; // 'largo' | 'corto' | 'ruso'
}

/** =============== LÓGICA CENTRAL: PROCESAR + ANTIDUPLICADO =============== */
async function processAndSaveForm({ id, variedad, tamano, numero_tallos, etapa, bloque, tipo, force }) {
  if (!id) throw new Error('Falta el parámetro id');
  if (!variedad || !bloque || !numero_tallos) {
    throw new Error('Faltan datos obligatorios: variedad, bloque, numero_tallos');
  }

  const tallosNum = parseInt(numero_tallos, 10);
  if (isNaN(tallosNum) || tallosNum < 1) {
    throw new Error('El campo número de tallos debe ser un número positivo');
  }

  const sanitizedBloque = (bloque || '').replace(/[^0-9]/g, '');
  const fecha = new Date().toISOString().split('T')[0];
  const tipoNorm = (tipo || '').toLowerCase();

  // Normalizar tamaño para guardar
  const sizeForStorage = normalizeSizeForStorage(variedad, sanitizedBloque, tamano, tipoNorm);

  const dataToSave = {
    id,
    fecha,
    bloque: sanitizedBloque,
    variedad,
    numero_tallos: tallosNum,
    etapa: etapa || '',
    tipo: tipoNorm,
  };

  if (sizeForStorage !== null) {
    dataToSave.tamano = sizeForStorage;
  }

  // Antiduplicado estilo /api/registrar
  if (!force) {
    const yaExiste = await existsSameRecord({
      id,
      fecha,
      bloque: sanitizedBloque,
      variedad,
      numero_tallos: tallosNum,
      tamano: sizeForStorage || '',
      etapa: etapa || '',
      tipo: tipoNorm,
    });

    if (yaExiste) {
      const err = new Error('Este código ya fue registrado antes.');
      err.code = 'DUPLICATE';
      throw err;
    }
  }

  await addRecord(dataToSave);

  console.log('✅ [FORM] Registrado correctamente:', {
    id,
    fecha,
    bloque: sanitizedBloque,
    variedad,
    numero_tallos: tallosNum,
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
  const id = req.query.id || ''; // ⬅️ ID VIENE POR QUERY (igual que en el QR)

  // ======= FORMULARIO TIPO NACIONAL (tema naranja) =============
  if (tipo === 'nacional') {
    let variedades = [];
    if (bloque === '3') {
      variedades = [
        { value: 'momentum', label: 'Momentum' },
        { value: 'quick sand', label: 'Quick Sand' },
        { value: 'pink floyd', label: 'Pink Floyd' },
        { value: 'freedom', label: 'Freedom' },
      ];
    } else if (bloque === '4') {
      variedades = [
        { value: 'freedom', label: 'Freedom' },
        { value: 'hilux', label: 'Hilux' },
      ];
    } else if (bloque === '5' || bloque === '6') {
      variedades = [{ value: 'freedom', label: 'Freedom' }];
    } else if (bloque === '7') {
      variedades = [
        { value: 'candlelight', label: 'Candlelight' },
        { value: 'deep purple', label: 'Deep Purple' },
      ];
    } else if (bloque === '8') {
      variedades = [
        { value: 'star platinum', label: 'Star Platinum' },
        { value: 'candlelight', label: 'Candlelight' },
        { value: 'sommersand', label: 'Sommersand' },
        { value: 'freedom', label: 'Freedom' },
      ];
    } else if (bloque === '1') {
      variedades = [
        { value: 'vendela', label: 'Vendela' },
        { value: 'pink floyd', label: 'Pink Floyd' },
      ];
    } else if (bloque === '2') {
      variedades = [
        { value: 'coral reff', label: 'Coral Reff' },
        { value: 'hummer', label: 'Hummer' },
      ];
    } else if (bloque === '9') {
      variedades = [
        { value: 'freedom', label: 'Freedom' },
      ];
    } else if (bloque === '10') {
      variedades = [
        { value: 'shimmer', label: 'Shimmer'},
        { value: 'freedom', label: 'Freedom'},
      ];
    } else if (bloque === '11') {
      variedades = [
        { value: 'pink mondial', label: 'Pink Mondial'},
        { value: 'whithe ohora', label: 'Whithe Ohora'},
        { value: 'pink ohora', label: 'Pink Ohora'},
        { value: 'mondial', label: 'Mondial'},
      ];
    } else if (bloque === '12') {
      variedades = [
        { value: 'mondial', label: 'Mondial'},
        { value: 'blessing', label: 'Blessing'},
        { value: 'pink amareto', label: 'Pink Amareto'},
        { value: 'sommersand', label: 'Sommersand'},
      ];
    } else if (bloque === '13') {
      variedades = [
        { value: 'freedom', label: 'Freedom'},
      ];
    }

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
  let variedades = [];
  let seleccionVariedad = 'momentum';

  if (bloque === '3') {
    variedades = [
      { value: 'momentum', label: 'Momentum' },
      { value: 'quick sand', label: 'Quick Sand' },
      { value: 'pink floyd', label: 'Pink Floyd' },
      { value: 'freedom', label: 'Freedom' },
    ];
  } else if (bloque === '4') {
    variedades = [
      { value: 'freedom', label: 'Freedom' },
      { value: 'hilux', label: 'Hilux' },
    ];
    seleccionVariedad = 'freedom';
  } else if (bloque === '5' || bloque === '6') {
    variedades = [{ value: 'freedom', label: 'Freedom' }];
    seleccionVariedad = 'freedom';
  } else if (bloque === '7') {
    variedades = [
      { value: 'candlelight', label: 'Candlelight' },
      { value: 'deep purple', label: 'Deep Purple' },
    ];
    seleccionVariedad = 'candlelight';
  } else if (bloque === '8') {
    variedades = [
      { value: 'star platinum', label: 'Star Platinum' },
      { value: 'candlelight', label: 'Candlelight' },
      { value: 'sommersand', label: 'Sommersand' },
      { value: 'freedom', label: 'Freedom' },
    ];
    seleccionVariedad = 'star platinum';
  } else if (bloque === '1') {
    variedades = [
      { value: 'vendela', label: 'Vendela' },
      { value: 'pink floyd', label: 'Pink Floyd' },
    ];
    seleccionVariedad = 'vendela';
  } else if (bloque === '2') {
    variedades = [
      { value: 'coral reff', label: 'Coral Reff' },
      { value: 'hummer', label: 'Hummer' },
    ];
    seleccionVariedad = 'coral reff';
  } else if (bloque === '9') {
    variedades = [
      { value: 'freedom', label: 'Freedom' },
    ];
    seleccionVariedad = 'freedom';
  } else if (bloque === '10') {
    variedades = [
      { value: 'shimmer', label: 'Shimmer'},
      { value: 'freedom', label: 'Freedom'},
    ];
    seleccionVariedad = 'shimmer';
  } else if (bloque === '11') {
    variedades = [
      { value: 'pink mondial', label: 'Pink Mondial'},
      { value: 'whithe ohora', label: 'Whithe Ohora'},
      { value: 'pink ohora', label: 'Pink Ohora'},
      { value: 'mondial', label: 'Mondial'},
    ];
    seleccionVariedad = 'pink mondial';
  } else if (bloque === '12') {
    variedades = [
      { value: 'mondial', label: 'Mondial'},
      { value: 'blessing', label: 'Blessing'},
      { value: 'pink amareto', label: 'Pink Amareto'},
      { value: 'sommersand', label: 'Sommersand'},
    ];
    seleccionVariedad = 'mondial';
  } else if (bloque === '13') {
    variedades = [
      { value: 'freedom', label: 'Freedom'},
    ];
    seleccionVariedad = 'freedom';
  }

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
            <label for="tamano">Elija Tamaño:</label>
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
            e.preventDefault(); alert('Seleccione el tamaño.'); return;
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

  console.log('[SUBMIT]', { fromIp: getClientIp(req), id, variedad, tamano, numero_tallos, etapa, bloque, tipo, forceFlag });

  try {
    const saved = await processAndSaveForm({
      id,
      variedad,
      tamano,
      numero_tallos,
      etapa,
      bloque,
      tipo,
      force: forceFlag,
    });

    // ✅ Registro exitoso (puedes embellecer igual que el otro server si quieres)
    return res.send(`
      <html lang="es">
      <head><meta charset="UTF-8"><title>Registro exitoso</title></head>
      <body style="font-family:sans-serif; text-align:center; margin-top:50px;">
         <h1 style="font-size:40px; color:green;">✅ Registro guardado en base de datos</h1>
         <p><strong>ID:</strong> ${saved.id}</p>
         <p><strong>Variedad:</strong> ${saved.variedad}</p>
         <p><strong>Bloque:</strong> ${saved.bloque}</p>
         <p><strong>Número de tallos:</strong> ${saved.numero_tallos}</p>
         ${saved.tamano ? `<p><strong>Tamaño:</strong> ${saved.tamano}</p>` : ''}
      </body>
      </html>
    `);
  } catch (error) {
    console.error('[ERROR /submit]', error);

    // Duplicado => mostrar tarjeta de advertencia con botón "Registrar de todas formas"
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
              background: #ffedd5; /* naranja suave */
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
            .chip {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              font-size: 0.95rem;
              padding: 6px 14px;
              border-radius: 999px;
              background: rgba(248, 113, 113, 0.1);
              color: #7f1d1d;
              margin-bottom: 14px;
            }
            .chip-dot {
              width: 8px;
              height: 8px;
              border-radius: 999px;
              background: #f97316;
            }
            .big-emoji {
              font-size: 3.2rem;
              margin-bottom: 10px;
            }
            .title {
              font-size: 2.2rem;
              font-weight: 800;
              margin-bottom: 8px;
              color: #7c2d12;
            }
            .body {
              font-size: 1.05rem;
              line-height: 1.5;
              margin-top: 8px;
            }
            .highlight {
              font-weight: 700;
            }
            .btn {
              display: inline-block;
              margin-top: 24px;
              padding: 16px 40px;
              border-radius: 999px;
              border: none;
              font-size: 1.15rem;
              font-weight: 700;
              cursor: pointer;
              text-decoration: none;
              transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.1s ease;
              box-shadow: 0 12px 28px rgba(22, 163, 74, 0.45);
            }
            .btn:active {
              transform: scale(0.97);
              box-shadow: none;
            }
            .btn-confirm {
              background: #22c55e;
              color: #032013;
            }
            .btn-confirm:hover {
              background: #16a34a;
            }
            .small {
              font-size: 0.85rem;
              margin-top: 16px;
              color: #4b5563;
            }
          </style>
        </head>
        <body>
          <main class="card">
            <div class="chip">
              <span class="chip-dot"></span>
              Posible doble registro
            </div>
            <div class="big-emoji">⚠️</div>
            <h1 class="title">Este código ya fue registrado</h1>
            <div class="body">
              <p>
                ID: <span class="highlight">${id || '(sin ID)'}</span><br/>
                Variedad: <span class="highlight">${variedad}</span><br/>
                Bloque: <span class="highlight">${bloque}</span><br/>
                Tallos: <span class="highlight">${numero_tallos}</span>
                ${tamano ? `<br/>Tamaño: <span class="highlight">${tamano}</span>` : ''}
              </p>
              <p style="margin-top:10px;">
                Solo continúa si estás <span class="highlight">seguro</span> de que quieres registrar nuevamente.
              </p>
              <form method="POST" action="/submit">
                <input type="hidden" name="id" value="${id || ''}" />
                <input type="hidden" name="variedad" value="${variedad || ''}" />
                <input type="hidden" name="tamano" value="${tamano || ''}" />
                <input type="hidden" name="numero_tallos" value="${numero_tallos || ''}" />
                <input type="hidden" name="etapa" value="${etapa || ''}" />
                <input type="hidden" name="bloque" value="${bloque || ''}" />
                <input type="hidden" name="tipo" value="${tipo || ''}" />
                <input type="hidden" name="force" value="true" />
                <button type="submit" class="btn btn-confirm">
                  Registrar de todas formas
                </button>
              </form>
              <p class="small">
                Si no deseas duplicar el registro, simplemente cierra esta ventana.
              </p>
            </div>
          </main>
        </body>
        </html>
      `);
    }

    // Error general
    res.status(500).send('Hubo un error al guardar los datos: ' + (error.message || 'Error desconocido'));
  }
});

// ==================== INICIO DEL SERVIDOR ====================
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
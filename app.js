const express = require('express');
const bodyParser = require('body-parser');
const { addRecord } = require('./googleSheets');

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

// ==================== RUTA PRINCIPAL ==========================
app.get('/', (req, res) => {
  const bloque = req.query.bloque || '3';
  const etapa = req.query.etapa || '';
  const tipo = req.query.tipo || '';

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
      ]
    } else if (bloque === '12') {
      variedades = [
        { value: 'mondial', label: 'Mondial'},
        { value: 'blessing', label: 'Blessing'},
        { value: 'pink amareto', label: 'Pink Amareto'},
        { value: 'sommersand', label: 'Sommersand'},
      ]
    } else if (bloque === '13') {
      variedades = [
        { value: 'freedom', label: 'Freedom'},
      ]
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
            background: #fdfdfd; /* mismo fondo neutro */
            color: #d85b00; /* tono naranja */
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
  const { variedad, tamano, numero_tallos, etapa, bloque, tipo } = req.body;

  const sanitizedBloque = (bloque || '').replace(/[^0-9]/g, '');
  const sanitizedNumeroTallos = parseInt(numero_tallos, 10);
  const fecha = new Date().toISOString().split('T')[0];

  const data = {
    fecha,
    bloque: sanitizedBloque,
    variedad,
    numero_tallos: sanitizedNumeroTallos,
    etapa: etapa || '',
    tipo: tipo || '',
  };

  const sizeForStorage = normalizeSizeForStorage(variedad, sanitizedBloque, tamano, tipo);
  if (sizeForStorage !== null) {
    data.tamaño = sizeForStorage;
  }

  console.log('[SUBMIT]', { fromIp: getClientIp(req), data });

  try {
    await addRecord(data);
    res.send(`
      <html lang="es">
      <head><meta charset="UTF-8"><title>Registro exitoso</title></head>
      <body style="font-family:sans-serif; text-align:center; margin-top:50px;">
         <h1 style="font-size:70px; color:green;">✅ Registro guardado en base de datos</h1>
      </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send('Hubo un error al guardar los datos.');
  }
});

// ==================== INICIO DEL SERVIDOR ====================
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
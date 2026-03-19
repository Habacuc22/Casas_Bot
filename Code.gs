/**
 * ============================================================
 *  CuentasBot — Bot de gestión de gastos compartidos
 *  Bloque 1: Setup, configuración y utilidades base
 *
 *  Conexión: Telegram ↔ Google Apps Script ↔ Google Sheets
 *
 *  INSTRUCCIONES DE CONFIGURACIÓN:
 *  1. Completar los datos en setup() con tu token, sheet ID y webhook URL.
 *  2. Ejecutar setup() UNA SOLA VEZ desde el editor de Apps Script.
 *  3. Publicar como Web App (Implementar → Nueva implementación → Web App,
 *     ejecutar como "Yo", acceso "Cualquier persona").
 *  4. Ejecutar setWebhook() para conectar con Telegram.
 *  5. Abrir el bot en Telegram y escribir /start.
 *
 *  ESTRUCTURA DE HOJAS:
 *  ┌──────────────────┬────────────────────────────────────────────────────┐
 *  │ Configuracion    │ Impuestos fijos y casas participantes por impuesto │
 *  │ Gastos           │ Registro de cada gasto cargado                     │
 *  │ Transferencias   │ Registro de cada transferencia recibida            │
 *  │ SaldosMensuales  │ Saldo final por casa y por mes                     │
 *  │ Log              │ Registro de todas las interacciones                │
 *  └──────────────────┴────────────────────────────────────────────────────┘
 *
 *  IMPUESTOS FIJOS VÁLIDOS (definidos en hoja Configuracion):
 *  epe · agua · gas · tgi · api · internet · cable
 *  Se cargan escribiendo: epe 343400   |   agua 15000 25/3
 *
 *  ESTADOS DE UN GASTO:
 *  programado → mes futuro, no afecta cálculo actual
 *  activo     → mes actual, suma al cálculo
 *  pagado     → completamente saldado
 * ============================================================
 */


// ============================================================
//  ZONA HORARIA
// ============================================================
const TIMEZONE = 'America/Argentina/Buenos_Aires';


// ============================================================
//  NOMBRES DE HOJAS
// ============================================================
const HOJA_CONFIGURACION   = 'Configuracion';
const HOJA_GASTOS          = 'Gastos';
const HOJA_TRANSFERENCIAS  = 'Transferencias';
const HOJA_SALDOS          = 'SaldosMensuales';
const HOJA_LOG             = 'Log';


// ============================================================
//  ÍNDICES DE COLUMNAS — HOJA GASTOS (base 0)
//  A=Fecha · B=Nombre · C=Monto · D=Tipo · E=Estado
//  F=Vencimiento · G=Casa1 · H=Casa2 · I=Casa3 · J=ChatID
// ============================================================
const GCOL_FECHA        = 0;  // Fecha de carga
const GCOL_NOMBRE       = 1;  // Nombre del impuesto o gasto
const GCOL_MONTO        = 2;  // Monto total
const GCOL_TIPO         = 3;  // 'fijo' o 'eventual'
const GCOL_ESTADO       = 4;  // 'programado', 'activo', 'pagado'
const GCOL_VENCIMIENTO  = 5;  // Fecha de vencimiento (puede ser vacía)
const GCOL_CASA1        = 6;  // Monto que le corresponde a Casa 1
const GCOL_CASA2        = 7;  // Monto que le corresponde a Casa 2
const GCOL_CASA3        = 8;  // Monto que le corresponde a Casa 3
const GCOL_CHATID       = 9;  // ID del chat de Telegram


// ============================================================
//  ÍNDICES DE COLUMNAS — HOJA TRANSFERENCIAS (base 0)
//  A=Fecha · B=Casa · C=Monto · D=ChatID
// ============================================================
const TCOL_FECHA   = 0;
const TCOL_CASA    = 1;
const TCOL_MONTO   = 2;
const TCOL_CHATID  = 3;


// ============================================================
//  ÍNDICES DE COLUMNAS — HOJA SALDOSMENSUALS (base 0)
//  A=Mes · B=Año · C=SaldoCasa1 · D=SaldoCasa2 · E=SaldoCasa3
// ============================================================
const SCOL_MES     = 0;
const SCOL_ANIO    = 1;
const SCOL_CASA1   = 2;
const SCOL_CASA2   = 3;
const SCOL_CASA3   = 4;


// ============================================================
//  TIPOS DE GASTO
// ============================================================
const TIPO_FIJO     = 'fijo';
const TIPO_EVENTUAL = 'eventual';


// ============================================================
//  ESTADOS DE UN GASTO
// ============================================================
const ESTADO_PROGRAMADO = 'programado';
const ESTADO_ACTIVO     = 'activo';
const ESTADO_PAGADO     = 'pagado';


// ============================================================
//  IMPUESTOS FIJOS VÁLIDOS
//  Estos son los únicos nombres que el bot reconoce como
//  impuesto fijo. Deben coincidir con los de la hoja Configuracion.
// ============================================================
const IMPUESTOS_VALIDOS = ['epe', 'agua', 'gas', 'tgi', 'api', 'internet', 'cable'];


// ============================================================
//  CASAS
// ============================================================
const CASAS = {
  casa1: { nombre: 'Casa 1', integrantes: 'Nombre1'  },
  casa2: { nombre: 'Casa 2', integrantes: 'Nombre2'  },
  casa3: { nombre: 'Casa 3', integrantes: 'Nombre3'  }
};


// ============================================================
//  SETUP INICIAL — ejecutar UNA SOLA VEZ
//  Crea las hojas, pone los encabezados y guarda la
//  configuración sensible en PropertiesService (no en el código).
// ============================================================
function setup() {
  const props = PropertiesService.getUserProperties();

  // ── COMPLETAR ANTES DE EJECUTAR ──────────────────────────
  props.setProperty('TELEGRAM_TOKEN', 'TU_TOKEN_DE_TELEGRAM_AQUI');
  props.setProperty('SHEET_ID',       'TU_ID_DE_GOOGLE_SHEETS_AQUI');
  props.setProperty('WEBHOOK_URL',    'URL_DE_TU_WEB_APP_AQUI');

  // Tu ID numérico de Telegram.
  // Para saberlo: escribile a @userinfobot en Telegram.
  props.setProperty('ADMIN_IDS', JSON.stringify([123456789]));
  // ────────────────────────────────────────────────────────

  const ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));

  _crearHoja(ss, HOJA_CONFIGURACION,  ['Impuesto', 'Casa1', 'Casa2', 'Casa3']);
  _crearHoja(ss, HOJA_GASTOS,         ['Fecha', 'Nombre', 'Monto', 'Tipo', 'Estado', 'Vencimiento', 'Casa1', 'Casa2', 'Casa3', 'ChatID']);
  _crearHoja(ss, HOJA_TRANSFERENCIAS, ['Fecha', 'Casa', 'Monto', 'ChatID']);
  _crearHoja(ss, HOJA_SALDOS,         ['Mes', 'Año', 'SaldoCasa1', 'SaldoCasa2', 'SaldoCasa3']);
  _crearHoja(ss, HOJA_LOG,            ['Fecha', 'ChatID', 'Mensaje', 'Respuesta']);

  // Cargar configuración inicial de impuestos fijos
  _cargarConfiguracionInicial(ss);

  Logger.log('✅ CuentasBot configurado correctamente.');
  Logger.log('👉 Siguiente paso: publicá la Web App y ejecutá setWebhook()');
}


/**
 * Crea una hoja si no existe, o la deja si ya existe.
 * Pone los encabezados con formato visual.
 */
function _crearHoja(ss, nombre, encabezados) {
  let hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    Logger.log('📄 Hoja creada: ' + nombre);
  }
  const rango = hoja.getRange(1, 1, 1, encabezados.length);
  rango.setValues([encabezados]);
  rango.setFontWeight('bold');
  rango.setBackground('#4A90D9');
  rango.setFontColor('#FFFFFF');
}


/**
 * Carga la tabla de participación inicial en la hoja Configuracion.
 * Refleja exactamente la tabla del README.
 * Si la hoja ya tiene datos no la pisa.
 */
function _cargarConfiguracionInicial(ss) {
  const hoja = ss.getSheetByName(HOJA_CONFIGURACION);
  if (hoja.getLastRow() > 1) {
    Logger.log('ℹ️  Configuracion ya tiene datos, no se sobreescribe.');
    return;
  }

  // Formato: [impuesto, casa1_participa, casa2_participa, casa3_participa]
  // true = participa, false = no participa
  const datos = [
    ['epe',      true,  true,  true ],
    ['agua',     true,  true,  true ],
    ['gas',      true,  true,  true ],
    ['tgi',      true,  true,  true ],
    ['api',      true,  true,  true ],
    ['internet', true,  true,  false],
    ['cable',    false, false, true ],
  ];

  hoja.getRange(2, 1, datos.length, 4).setValues(datos);
  Logger.log('✅ Configuracion inicial cargada.');
}


// ============================================================
//  CONECTAR WEBHOOK
//  Ejecutar después de publicar la Web App.
// ============================================================
function setWebhook() {
  const config = getConfig();
  const url    = `https://api.telegram.org/bot${config.token}/setWebhook?url=${config.webhookUrl}`;
  const resp   = UrlFetchApp.fetch(url).getContentText();
  Logger.log('Webhook: ' + resp);
}


// ============================================================
//  CONFIGURACIÓN Y SEGURIDAD
// ============================================================

/** Lee los valores guardados en PropertiesService. */
function getConfig() {
  const props   = PropertiesService.getUserProperties();
  const token   = props.getProperty('TELEGRAM_TOKEN');
  const sheetId = props.getProperty('SHEET_ID');
  if (!token || !sheetId) throw new Error('Ejecutá setup() primero.');
  return {
    token,
    sheetId,
    webhookUrl: props.getProperty('WEBHOOK_URL')
  };
}

/** Devuelve el array de IDs de Telegram autorizados. */
function getAdminIds() {
  const ids = PropertiesService.getUserProperties().getProperty('ADMIN_IDS');
  return ids ? JSON.parse(ids) : [];
}

/** Devuelve true si el chatId está autorizado. */
function isAuthorized(chatId) {
  return getAdminIds().includes(chatId);
}


// ============================================================
//  ESTADO DE CONVERSACIÓN
//  Cuando el bot necesita esperar una respuesta del usuario
//  (ej: qué casas participan en un gasto eventual) guarda
//  el estado aquí. Se limpia cuando la conversación termina.
// ============================================================

/**
 * Guarda el estado de conversación de un chat.
 * El estado es un objeto JS que se serializa como JSON.
 * Ejemplo: { accion: 'esperando_casas', gasto: 'electricista', monto: 25000 }
 */
function setEstadoConversacion(chatId, estado) {
  const props = PropertiesService.getUserProperties();
  props.setProperty('estado_' + chatId, JSON.stringify(estado));
}

/**
 * Lee el estado de conversación de un chat.
 * Devuelve null si no hay estado pendiente.
 */
function getEstadoConversacion(chatId) {
  const props = PropertiesService.getUserProperties();
  const raw   = props.getProperty('estado_' + chatId);
  return raw ? JSON.parse(raw) : null;
}

/** Borra el estado de conversación (fin del flujo). */
function limpiarEstadoConversacion(chatId) {
  PropertiesService.getUserProperties().deleteProperty('estado_' + chatId);
}


// ============================================================
//  ACCESO A HOJAS
// ============================================================

/** Devuelve una hoja por nombre. Lanza error si no existe. */
function getHoja(nombreHoja) {
  const config = getConfig();
  const ss     = SpreadsheetApp.openById(config.sheetId);
  const hoja   = ss.getSheetByName(nombreHoja);
  if (!hoja) throw new Error(`La hoja "${nombreHoja}" no existe. Ejecutá setup() primero.`);
  return hoja;
}


// ============================================================
//  LECTURA DE CONFIGURACIÓN DE IMPUESTOS
//  Lee la hoja Configuracion y devuelve qué casas participan
//  en cada impuesto.
// ============================================================

/**
 * Devuelve un objeto con la configuración de todos los impuestos.
 * Ejemplo de resultado:
 * {
 *   epe:      { casa1: true, casa2: true, casa3: true  },
 *   internet: { casa1: true, casa2: true, casa3: false },
 *   cable:    { casa1: false, casa2: false, casa3: true }
 * }
 */
function getConfiguracionImpuestos() {
  const hoja    = getHoja(HOJA_CONFIGURACION);
  const lastRow = hoja.getLastRow();
  if (lastRow <= 1) return {};

  const datos = hoja.getRange(2, 1, lastRow - 1, 4).getValues();
  const config = {};

  datos.forEach(fila => {
    const nombre = (fila[0] || '').toString().trim().toLowerCase();
    if (!nombre) return;
    config[nombre] = {
      casa1: fila[1] === true || fila[1] === 'TRUE' || fila[1] === true,
      casa2: fila[2] === true || fila[2] === 'TRUE' || fila[2] === true,
      casa3: fila[3] === true || fila[3] === 'TRUE' || fila[3] === true
    };
  });

  return config;
}


// ============================================================
//  UTILIDADES DE FECHA
// ============================================================

/** Devuelve la fecha/hora actual en zona horaria argentina. */
function ahoraAR() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Parsea una fecha en formato dd/mm (ej: "25/3") y devuelve
 * un objeto Date con ese día y mes del año más cercano.
 * Si la fecha ya pasó en el mes actual, asume el mes siguiente.
 * Si corresponde a un mes futuro, lo marca como programado.
 */
function parsearFecha(str) {
  const partes = str.split('/');
  if (partes.length !== 2) return null;
  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1; // mes base 0
  if (isNaN(dia) || isNaN(mes) || dia < 1 || dia > 31 || mes < 0 || mes > 11) return null;

  const ahora = ahoraAR();
  const fecha = new Date(ahora.getFullYear(), mes, dia);

  // Si el mes indicado ya pasó este año, asume el año siguiente
  if (fecha < ahora && mes < ahora.getMonth()) {
    fecha.setFullYear(ahora.getFullYear() + 1);
  }

  return fecha;
}

/**
 * Determina el estado de un gasto según su fecha de vencimiento.
 * Si la fecha pertenece al mes actual → activo
 * Si la fecha pertenece a un mes futuro → programado
 * Sin fecha → activo (asume mes actual)
 */
function determinarEstado(fechaVencimiento) {
  if (!fechaVencimiento) return ESTADO_ACTIVO;

  const ahora   = ahoraAR();
  const mesActual  = ahora.getMonth();
  const anioActual = ahora.getFullYear();
  const mesFecha   = fechaVencimiento.getMonth();
  const anioFecha  = fechaVencimiento.getFullYear();

  if (anioFecha > anioActual || (anioFecha === anioActual && mesFecha > mesActual)) {
    return ESTADO_PROGRAMADO;
  }
  return ESTADO_ACTIVO;
}

/** Formatea una fecha como dd/MM/yyyy. */
function formatearFecha(fecha) {
  if (!fecha || !(fecha instanceof Date)) return '—';
  return Utilities.formatDate(fecha, TIMEZONE, 'dd/MM/yyyy');
}

/** Nombre del mes en español. mesIndex = 0..11 */
function nombreMes(mesIndex) {
  return ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
          'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mesIndex];
}

/**
 * Infiere el año para consultas de historial.
 * Si el mes pedido ya pasó en el año actual → devuelve año actual.
 * Si el mes pedido aún no llegó este año → devuelve año anterior.
 * Ejemplo: pedir "noviembre" en marzo 2026 → 2025
 */
function inferirAnio(mesIndex) {
  const ahora = ahoraAR();
  if (mesIndex < ahora.getMonth()) return ahora.getFullYear();
  if (mesIndex === ahora.getMonth()) return ahora.getFullYear();
  return ahora.getFullYear() - 1;
}


// ============================================================
//  UTILIDADES DE FORMATO
// ============================================================

/** Formatea un monto en pesos con centavos. 15000.5 → "$15.000,50" */
function fmt(monto) {
  const abs = Math.abs(monto);
  return '$' + abs.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Formatea un monto sin centavos para montos redondos. 15000 → "$15.000" */
function fmtRedondo(monto) {
  return '$' + Math.round(Math.abs(monto)).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/**
 * Divide un monto exactamente entre las casas que participan.
 * Garantiza que la suma de las partes sea exactamente igual al total,
 * distribuyendo los centavos sobrantes en las primeras casas.
 *
 * Ejemplo: $100 entre 3 casas → $33,34 + $33,33 + $33,33
 *
 * @param {number} montoTotal  - Monto total a dividir (puede tener centavos)
 * @param {boolean[]} participa - Array de 3 booleanos [casa1, casa2, casa3]
 * @returns {number[]} Array de 3 montos [montoCasa1, montoCasa2, montoCasa3]
 */
function dividirMonto(montoTotal, participa) {
  const cantidadCasas = participa.filter(Boolean).length;
  if (cantidadCasas === 0) return [0, 0, 0];

  // Trabajamos en centavos para evitar errores de punto flotante
  const totalCentavos = Math.round(montoTotal * 100);
  const parteBase     = Math.floor(totalCentavos / cantidadCasas);
  const sobrante      = totalCentavos - parteBase * cantidadCasas;

  const resultado = [0, 0, 0];
  let casasAsignadas = 0;

  for (let i = 0; i < 3; i++) {
    if (!participa[i]) continue;
    // Las primeras "sobrante" casas reciben 1 centavo extra
    resultado[i] = (casasAsignadas < sobrante)
      ? (parteBase + 1) / 100
      : parteBase / 100;
    casasAsignadas++;
  }

  return resultado;
}


// ============================================================
//  LOG DE INTERACCIONES
// ============================================================

/** Registra cada mensaje recibido y la respuesta enviada. */
function registrarLog(chatId, mensaje, respuesta) {
  try {
    const hoja  = getHoja(HOJA_LOG);
    const ahora = Utilities.formatDate(ahoraAR(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    hoja.appendRow([ahora, chatId, mensaje, respuesta]);
  } catch (e) {
    Logger.log('Error al registrar log: ' + e.toString());
  }
}


// ============================================================
//  PUNTO DE ENTRADA — recibe los mensajes de Telegram
// ============================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Mensaje de texto normal
    if (data.message && data.message.text) {
      procesarMensaje(data.message);
      return HtmlService.createHtmlOutput('OK');
    }

    // Respuesta a botones inline (corregir / eliminar)
    if (data.callback_query) {
      procesarCallbackQuery(data.callback_query);
      return HtmlService.createHtmlOutput('OK');
    }

  } catch (err) {
    Logger.log('Error en doPost: ' + err.toString());
  }
  return HtmlService.createHtmlOutput('OK');
}


// ============================================================
//  ENVÍO DE MENSAJES A TELEGRAM
// ============================================================

/** Envía un mensaje de texto plano. */
function sendMessage(chatId, texto) {
  try {
    const r = UrlFetchApp.fetch(
      `https://api.telegram.org/bot${getConfig().token}/sendMessage`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ chat_id: chatId, text: texto }),
        muteHttpExceptions: true
      }
    );
    if (r.getResponseCode() !== 200) Logger.log('Error sendMessage: ' + r.getContentText());
  } catch (err) {
    Logger.log('Excepción sendMessage: ' + err.toString());
  }
}

/** Envía un mensaje con formato Markdown. */
function sendMarkdown(chatId, texto) {
  try {
    const r = UrlFetchApp.fetch(
      `https://api.telegram.org/bot${getConfig().token}/sendMessage`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
        muteHttpExceptions: true
      }
    );
    if (r.getResponseCode() !== 200) Logger.log('Error sendMarkdown: ' + r.getContentText());
  } catch (err) {
    Logger.log('Excepción sendMarkdown: ' + err.toString());
  }
}

/**
 * Envía un mensaje con botones inline.
 * Los botones se definen como un array de filas,
 * cada fila es un array de botones.
 *
 * Ejemplo de botones:
 * [
 *   [{ text: '✏️ Corregir',  callback_data: 'corregir_1'  }],
 *   [{ text: '🗑️ Eliminar', callback_data: 'eliminar_1'  }],
 *   [{ text: '❌ Cancelar',  callback_data: 'cancelar'    }]
 * ]
 */
function sendConBotones(chatId, texto, botones) {
  try {
    const r = UrlFetchApp.fetch(
      `https://api.telegram.org/bot${getConfig().token}/sendMessage`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: chatId,
          text: texto,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: botones }
        }),
        muteHttpExceptions: true
      }
    );
    if (r.getResponseCode() !== 200) Logger.log('Error sendConBotones: ' + r.getContentText());
  } catch (err) {
    Logger.log('Excepción sendConBotones: ' + err.toString());
  }
}

/**
 * Edita un mensaje ya enviado (usado para actualizar el mensaje
 * después de que el usuario presiona un botón inline).
 */
function editarMensaje(chatId, messageId, nuevoTexto) {
  try {
    UrlFetchApp.fetch(
      `https://api.telegram.org/bot${getConfig().token}/editMessageText`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: nuevoTexto,
          parse_mode: 'Markdown'
        }),
        muteHttpExceptions: true
      }
    );
  } catch (err) {
    Logger.log('Excepción editarMensaje: ' + err.toString());
  }
}

/**
 * Responde a un callback_query (obligatorio después de recibir
 * el tap en un botón inline, para que Telegram quite el "loading").
 */
function responderCallback(callbackQueryId, texto) {
  try {
    UrlFetchApp.fetch(
      `https://api.telegram.org/bot${getConfig().token}/answerCallbackQuery`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: texto || ''
        }),
        muteHttpExceptions: true
      }
    );
  } catch (err) {
    Logger.log('Excepción responderCallback: ' + err.toString());
  }
}


// ============================================================
//  MENSAJE DE AYUDA
// ============================================================
function enviarAyuda(chatId) {
  sendMarkdown(chatId,
    `📋 *Comandos disponibles*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +

    `*Cargar impuesto fijo:*\n` +
    `\`epe 343400\`  —  carga EPE sin fecha\n` +
    `\`agua 15000 25/3\`  —  carga con vencimiento\n` +
    `_Impuestos: epe · agua · gas · tgi · api · internet · cable_\n\n` +

    `*Cargar gasto eventual:*\n` +
    `\`electricista 25000\`  —  el bot pregunta qué casas participan\n\n` +

    `*Registrar transferencia:*\n` +
    `\`pago casa1 30000\`\n` +
    `\`pago casa3 15000\`\n\n` +

    `*Ver resumen:*\n` +
    `/resumen  —  todas las casas\n` +
    `/resumen_casa1  —  solo Casa 1 (listo para screenshot)\n` +
    `/resumen_casa2  —  solo Casa 2\n` +
    `/resumen_casa3  —  solo Casa 3\n\n` +

    `*Ver historial de meses anteriores:*\n` +
    `/historial_noviembre  —  infiere el año automáticamente\n` +
    `/historial_marzo\n\n` +

    `*Ver próximos vencimientos:*\n` +
    `/vencimientos\n\n` +

    `*Corregir o eliminar un gasto del mes actual:*\n` +
    `/corregir  —  te muestra los gastos con botones\n` +
    `/eliminar  —  te muestra los gastos con botones\n\n` +

    `*Esta ayuda:*\n` +
    `/ayuda\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🔒 _Bot privado. Solo vos podés usarlo._`
  );
}


// ============================================================
//  MENSAJE DE ERROR DE FORMATO
// ============================================================
function enviarFormatoIncorrecto(chatId) {
  sendMessage(chatId,
    '⚠️ No entendí ese mensaje.\n\n' +
    'Para ver todos los comandos escribí /ayuda'
  );
}



/**
 * ============================================================
 *  CuentasBot — Bloque 2: Procesador de mensajes y carga de gastos
 *
 *  Este bloque contiene:
 *  · procesarMensaje() — enrutador principal de todos los mensajes
 *  · Carga de impuestos fijos (epe, agua, gas, etc.)
 *  · Carga de gastos eventuales (flujo conversacional de 2 pasos)
 *  · Registro de transferencias (pago casa1 30000)
 * ============================================================
 */


// ============================================================
//  NOMBRES DE MESES — para el comando historial
// ============================================================
const MESES_TEXTO = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
};


// ============================================================
//  PROCESADOR PRINCIPAL DE MENSAJES
//  Es el primer lugar donde llega cada mensaje.
//  Decide qué función llamar según lo que escribió Nombre2.
// ============================================================
function procesarMensaje(message) {
  const chatId = message.chat.id;
  const text   = (message.text || '').trim();

  // ── Seguridad: solo Nombre2 puede usar el bot ───────────────
  if (!isAuthorized(chatId)) {
    sendMessage(chatId, '🚫 Acceso denegado. Este bot es privado.');
    Logger.log('Intento no autorizado desde chatId: ' + chatId);
    return;
  }

  registrarLog(chatId, text, '');

  // ── Si hay un flujo conversacional pendiente, continuar ───
  // Esto ocurre cuando el bot está esperando que Nombre2 responda
  // con los números de casas para un gasto eventual.
  const estadoPendiente = getEstadoConversacion(chatId);
  if (estadoPendiente) {
    continuarFlujoConversacional(chatId, text, estadoPendiente);
    return;
  }

  // ── Comandos con slash ────────────────────────────────────
  const textLower = text.toLowerCase();

  if (textLower === '/start' || textLower === '/ayuda') {
    enviarAyuda(chatId);
    return;
  }

  if (textLower === '/resumen') {
    mostrarResumen(chatId, null);
    return;
  }

  if (textLower === '/resumen_casa1') { mostrarResumen(chatId, 'casa1'); return; }
  if (textLower === '/resumen_casa2') { mostrarResumen(chatId, 'casa2'); return; }
  if (textLower === '/resumen_casa3') { mostrarResumen(chatId, 'casa3'); return; }

  if (textLower === '/vencimientos') {
    mostrarVencimientos(chatId);
    return;
  }

  if (textLower === '/corregir') {
    iniciarCorreccion(chatId);
    return;
  }

  if (textLower === '/eliminar') {
    iniciarEliminacion(chatId);
    return;
  }

  // Historial: /historial_noviembre, /historial_marzo, etc.
  const matchHistorial = textLower.match(/^\/historial_(\w+)$/);
  if (matchHistorial) {
    const nombreMesPedido = matchHistorial[1];
    if (MESES_TEXTO.hasOwnProperty(nombreMesPedido)) {
      const mesIndex = MESES_TEXTO[nombreMesPedido];
      const anio     = inferirAnio(mesIndex);
      mostrarHistorial(chatId, mesIndex, anio);
    } else {
      sendMessage(chatId, '⚠️ Mes no reconocido.\nEjemplo: /historial_noviembre');
    }
    return;
  }

  // ── Texto libre: impuesto fijo o gasto eventual ───────────
  // Formato impuesto fijo:   epe 343400   |   agua 15000 25/3
  // Formato gasto eventual:  electricista 25000   |   pintura 80000 15/4
  // Formato transferencia:   pago casa1 30000

  // Transferencia
  const matchPago = text.match(/^pago\s+(casa[123])\s+([\d.,]+)$/i);
  if (matchPago) {
    const casa  = matchPago[1].toLowerCase();
    const monto = parsearMonto(matchPago[2]);
    if (monto <= 0) {
      sendMessage(chatId, '⚠️ El monto debe ser mayor a cero.\nEjemplo: pago casa1 30000');
      return;
    }
    registrarTransferencia(chatId, casa, monto, message.date);
    return;
  }

  // Impuesto fijo o gasto eventual: "nombre monto" o "nombre monto fecha"
  const matchGasto = text.match(/^(\S+)\s+([\d.,]+)(?:\s+(\d{1,2}\/\d{1,2}))?$/i);
  if (matchGasto) {
    const nombreGasto = matchGasto[1].toLowerCase();
    const monto       = parsearMonto(matchGasto[2]);
    const fechaStr    = matchGasto[3] || null;

    if (monto <= 0) {
      enviarFormatoIncorrecto(chatId);
      return;
    }

    if (IMPUESTOS_VALIDOS.includes(nombreGasto)) {
      // Es un impuesto fijo
      cargarImpuestoFijo(chatId, nombreGasto, monto, fechaStr, message.date);
    } else {
      // Es un gasto eventual — iniciar flujo conversacional
      iniciarGastoEventual(chatId, nombreGasto, monto, fechaStr);
    }
    return;
  }

  // Si no coincide con nada
  enviarFormatoIncorrecto(chatId);
}


// ============================================================
//  PARSEAR MONTO
//  Convierte "343400", "343.400" o "343,400" en el número 343400.
// ============================================================
function parsearMonto(str) {
  // Elimina puntos de miles y reemplaza coma decimal por punto
  const limpio = str.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}


// ============================================================
//  CARGAR IMPUESTO FIJO
//  Ej: "epe 343400"  |  "agua 15000 25/3"
//
//  Lee la configuración de casas participantes de la hoja
//  Configuracion, divide el monto y lo registra en Gastos.
// ============================================================
function cargarImpuestoFijo(chatId, nombreImpuesto, monto, fechaStr, timestampUnix) {
  const configImpuestos = getConfiguracionImpuestos();

  if (!configImpuestos[nombreImpuesto]) {
    sendMessage(chatId,
      `⚠️ El impuesto "${nombreImpuesto}" no está en la configuración.\n` +
      `Impuestos válidos: ${IMPUESTOS_VALIDOS.join(' · ')}`
    );
    return;
  }

  const participacion = configImpuestos[nombreImpuesto];
  const participa     = [participacion.casa1, participacion.casa2, participacion.casa3];
  const partes        = dividirMonto(monto, participa);

  let fechaVencimiento = null;
  if (fechaStr) {
    fechaVencimiento = parsearFecha(fechaStr);
    if (!fechaVencimiento) {
      sendMessage(chatId,
        `⚠️ Fecha inválida: "${fechaStr}".\n` +
        `Usá el formato dd/mm. Ejemplo: 25/3`
      );
      return;
    }
  }

  const estado     = determinarEstado(fechaVencimiento);
  const fechaCarga = new Date(timestampUnix * 1000);
  const fechaAR    = Utilities.formatDate(fechaCarga, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const vencStr    = fechaVencimiento
    ? Utilities.formatDate(fechaVencimiento, TIMEZONE, 'yyyy-MM-dd')
    : '';

  const hoja = getHoja(HOJA_GASTOS);
  hoja.appendRow([
    fechaAR,
    nombreImpuesto,
    monto,
    TIPO_FIJO,
    estado,
    vencStr,
    partes[0],
    partes[1],
    partes[2],
    chatId
  ]);

  // ── Armar respuesta ────────────────────────────────────────
  const casasParticipantes = [];
  if (participacion.casa1) casasParticipantes.push(`Casa 1: ${fmt(partes[0])}`);
  if (participacion.casa2) casasParticipantes.push(`Casa 2: ${fmt(partes[1])}`);
  if (participacion.casa3) casasParticipantes.push(`Casa 3: ${fmt(partes[2])}`);

  const estadoEmoji = estado === ESTADO_PROGRAMADO ? '📅 Programado' : '✅ Activo';
  const vencDisplay = fechaVencimiento ? `📆 Vence: ${formatearFecha(fechaVencimiento)}\n` : '';

  sendMarkdown(chatId,
    `✅ *${nombreImpuesto.toUpperCase()} registrado*\n\n` +
    `💰 Total: *${fmt(monto)}*\n` +
    `${vencDisplay}` +
    `📊 Estado: ${estadoEmoji}\n\n` +
    `*Participación por casa:*\n` +
    casasParticipantes.map(c => `  · ${c}`).join('\n')
  );
}


// ============================================================
//  GASTO EVENTUAL — Paso 1: iniciar flujo
//  El bot registra el gasto en estado pendiente y le pregunta
//  a Nombre2 qué casas participan.
// ============================================================
function iniciarGastoEventual(chatId, nombreGasto, monto, fechaStr) {
  // Guardar el estado: estamos esperando que Nombre2 diga qué casas
  setEstadoConversacion(chatId, {
    accion:    'esperando_casas_eventual',
    nombre:    nombreGasto,
    monto:     monto,
    fechaStr:  fechaStr || null
  });

  const fechaInfo = fechaStr ? ` (vence ${fechaStr})` : '';

  sendMarkdown(chatId,
    `📝 *Gasto eventual: ${nombreGasto}*\n` +
    `💰 Monto: *${fmt(monto)}*${fechaInfo}\n\n` +
    `¿Qué casas participan?\n\n` +
    `Respondé con los números separados por espacio:\n` +
    `\`1\` → Solo Casa 1 (Nombre1)\n` +
    `\`2\` → Solo Casa 2 (Nombre2)\n` +
    `\`3\` → Solo Casa 3 (Nombre3)\n` +
    `\`1 2\` → Casa 1 y Casa 2\n` +
    `\`1 2 3\` → Las tres casas\n\n` +
    `_Escribí /cancelar para cancelar._`
  );
}


// ============================================================
//  FLUJO CONVERSACIONAL — continuación
//  Llega acá cuando hay un estado pendiente guardado.
// ============================================================
function continuarFlujoConversacional(chatId, text, estado) {
  // Cancelar siempre disponible
  if (text.toLowerCase() === '/cancelar') {
    limpiarEstadoConversacion(chatId);
    sendMessage(chatId, '❌ Operación cancelada.');
    return;
  }

  switch (estado.accion) {
    case 'esperando_casas_eventual':
      completarGastoEventual(chatId, text, estado);
      break;
    case 'esperando_nuevo_monto':
      completarCorreccionMonto(chatId, text, estado);
      break;
    default:
      limpiarEstadoConversacion(chatId);
      enviarFormatoIncorrecto(chatId);
  }
}


// ============================================================
//  GASTO EVENTUAL — Paso 2: registrar con las casas elegidas
// ============================================================
function completarGastoEventual(chatId, text, estado) {
  // Parsear la respuesta: "1 3", "1 2 3", "2", etc.
  const numeros = text.trim().split(/\s+/).map(n => parseInt(n, 10));
  const validos = numeros.every(n => [1, 2, 3].includes(n));

  if (!validos || numeros.length === 0) {
    sendMessage(chatId,
      '⚠️ Respuesta inválida.\nEscribí los números de las casas separados por espacio.\nEjemplo: 1 3   o   1 2 3'
    );
    return;
  }

  const participa = [
    numeros.includes(1),
    numeros.includes(2),
    numeros.includes(3)
  ];

  const partes = dividirMonto(estado.monto, participa);

  let fechaVencimiento = null;
  if (estado.fechaStr) {
    fechaVencimiento = parsearFecha(estado.fechaStr);
    if (!fechaVencimiento) {
      limpiarEstadoConversacion(chatId);
      sendMessage(chatId, `⚠️ Fecha inválida: "${estado.fechaStr}". Volvé a cargar el gasto.`);
      return;
    }
  }

  const estadoGasto = determinarEstado(fechaVencimiento);
  const ahora       = ahoraAR();
  const fechaAR     = Utilities.formatDate(ahora, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const vencStr     = fechaVencimiento
    ? Utilities.formatDate(fechaVencimiento, TIMEZONE, 'yyyy-MM-dd')
    : '';

  const hoja = getHoja(HOJA_GASTOS);
  hoja.appendRow([
    fechaAR,
    estado.nombre,
    estado.monto,
    TIPO_EVENTUAL,
    estadoGasto,
    vencStr,
    partes[0],
    partes[1],
    partes[2],
    chatId
  ]);

  limpiarEstadoConversacion(chatId);

  // ── Armar respuesta ────────────────────────────────────────
  const casasParticipantes = [];
  if (participa[0]) casasParticipantes.push(`Casa 1: ${fmt(partes[0])}`);
  if (participa[1]) casasParticipantes.push(`Casa 2: ${fmt(partes[1])}`);
  if (participa[2]) casasParticipantes.push(`Casa 3: ${fmt(partes[2])}`);

  const estadoEmoji = estadoGasto === ESTADO_PROGRAMADO ? '📅 Programado' : '✅ Activo';
  const vencDisplay = fechaVencimiento ? `📆 Vence: ${formatearFecha(fechaVencimiento)}\n` : '';

  sendMarkdown(chatId,
    `✅ *${estado.nombre} registrado*\n\n` +
    `💰 Total: *${fmt(estado.monto)}*\n` +
    `${vencDisplay}` +
    `📊 Estado: ${estadoEmoji}\n\n` +
    `*Participación por casa:*\n` +
    casasParticipantes.map(c => `  · ${c}`).join('\n')
  );
}


// ============================================================
//  REGISTRAR TRANSFERENCIA
//  Formato: "pago casa1 30000"
//  Registra que esa casa transfirió dinero a Nombre2.
// ============================================================
function registrarTransferencia(chatId, casa, monto, timestampUnix) {
  const fechaCarga = new Date(timestampUnix * 1000);
  const fechaAR    = Utilities.formatDate(fechaCarga, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const fechaMuestra = Utilities.formatDate(fechaCarga, TIMEZONE, 'dd/MM/yyyy HH:mm');

  const hoja = getHoja(HOJA_TRANSFERENCIAS);
  hoja.appendRow([fechaAR, casa, monto, chatId]);

  const nombreCasa = CASAS[casa] ? CASAS[casa].nombre : casa;

  sendMarkdown(chatId,
    `✅ *Transferencia registrada*\n\n` +
    `🏠 ${nombreCasa}\n` +
    `💰 Monto: *${fmt(monto)}*\n` +
    `📅 Fecha: ${fechaMuestra}`
  );
}
/**
 * ============================================================
 *  CuentasBot — Bloque 3: Cálculo de saldos y reportes
 *
 *  Este bloque contiene:
 *  · Cálculo de saldos en tiempo real por casa y por mes
 *  · /resumen — reporte completo de todas las casas
 *  · /resumen_casaX — reporte individual listo para screenshot
 *  · /historial_mes — reporte de un mes cerrado
 *  · /vencimientos — próximos vencimientos
 *  · Cierre automático de fin de mes
 * ============================================================
 */


// ============================================================
//  OBTENER GASTOS DEL MES ACTIVO
//  Devuelve todos los gastos con estado 'activo' que pertenecen
//  al mes y año indicados.
// ============================================================
function getGastosDelMes(mesIndex, anio) {
  const hoja    = getHoja(HOJA_GASTOS);
  const lastRow = hoja.getLastRow();
  if (lastRow <= 1) return [];

  const prefijo = `${anio}-${String(mesIndex + 1).padStart(2, '0')}`;
  const gastos  = [];

  for (let s = 2; s <= lastRow; s += 1000) {
    const e     = Math.min(s + 999, lastRow);
    const batch = hoja.getRange(s, 1, e - s + 1, 10).getValues();

    batch.forEach((fila, idx) => {
      const fechaRaw = fila[GCOL_FECHA];
      const fecha    = fechaRaw instanceof Date ? fechaRaw : new Date(fechaRaw);
      if (isNaN(fecha.getTime())) return;

      const mesFila = Utilities.formatDate(fecha, TIMEZONE, 'yyyy-MM');
      if (mesFila !== prefijo) return;

      const estado = (fila[GCOL_ESTADO] || '').toString().trim();
      if (estado !== ESTADO_ACTIVO) return;

      gastos.push({
        fila:    s + idx,
        nombre:  (fila[GCOL_NOMBRE] || '').toString().trim(),
        monto:   parseFloat(fila[GCOL_MONTO]) || 0,
        tipo:    (fila[GCOL_TIPO]   || '').toString().trim(),
        estado:  estado,
        venc:    fila[GCOL_VENCIMIENTO] ? new Date(fila[GCOL_VENCIMIENTO]) : null,
        casa1:   parseFloat(fila[GCOL_CASA1]) || 0,
        casa2:   parseFloat(fila[GCOL_CASA2]) || 0,
        casa3:   parseFloat(fila[GCOL_CASA3]) || 0,
      });
    });
  }

  return gastos;
}


// ============================================================
//  OBTENER TRANSFERENCIAS DEL MES
//  Devuelve el total transferido por cada casa en el mes.
// ============================================================
function getTransferenciasDelMes(mesIndex, anio) {
  const hoja    = getHoja(HOJA_TRANSFERENCIAS);
  const lastRow = hoja.getLastRow();
  const totales = { casa1: 0, casa2: 0, casa3: 0 };
  if (lastRow <= 1) return totales;

  const prefijo = `${anio}-${String(mesIndex + 1).padStart(2, '0')}`;

  for (let s = 2; s <= lastRow; s += 1000) {
    const e     = Math.min(s + 999, lastRow);
    const batch = hoja.getRange(s, 1, e - s + 1, 4).getValues();

    batch.forEach(fila => {
      const fechaRaw = fila[TCOL_FECHA];
      const fecha    = fechaRaw instanceof Date ? fechaRaw : new Date(fechaRaw);
      if (isNaN(fecha.getTime())) return;
      if (Utilities.formatDate(fecha, TIMEZONE, 'yyyy-MM') !== prefijo) return;

      const casa  = (fila[TCOL_CASA] || '').toString().trim().toLowerCase();
      const monto = parseFloat(fila[TCOL_MONTO]) || 0;
      if (totales.hasOwnProperty(casa)) totales[casa] += monto;
    });
  }

  return totales;
}


// ============================================================
//  OBTENER SALDO ARRASTRADO DEL MES ANTERIOR
//  Lee la hoja SaldosMensuales para traer el saldo que quedó
//  pendiente del mes anterior.
// ============================================================
function getSaldoArrastrado(mesIndex, anio) {
  const hoja    = getHoja(HOJA_SALDOS);
  const lastRow = hoja.getLastRow();
  const vacio   = { casa1: 0, casa2: 0, casa3: 0 };
  if (lastRow <= 1) return vacio;

  // Mes anterior
  let mesAnterior = mesIndex - 1;
  let anioAnterior = anio;
  if (mesAnterior < 0) { mesAnterior = 11; anioAnterior--; }

  const datos = hoja.getRange(2, 1, lastRow - 1, 5).getValues();
  const fila  = datos.find(f =>
    parseInt(f[SCOL_MES], 10) === mesAnterior + 1 &&
    parseInt(f[SCOL_ANIO], 10) === anioAnterior
  );

  if (!fila) return vacio;

  return {
    casa1: parseFloat(fila[SCOL_CASA1]) || 0,
    casa2: parseFloat(fila[SCOL_CASA2]) || 0,
    casa3: parseFloat(fila[SCOL_CASA3]) || 0
  };
}


// ============================================================
//  CALCULAR SALDOS DEL MES
//  Junta gastos + transferencias + saldo arrastrado y devuelve
//  el saldo actual de cada casa.
//
//  Saldo positivo = la casa le debe plata a Nombre2.
//  Saldo cero     = todo saldado.
// ============================================================
function calcularSaldos(mesIndex, anio) {
  const gastos        = getGastosDelMes(mesIndex, anio);
  const transferencias = getTransferenciasDelMes(mesIndex, anio);
  const arrastrado    = getSaldoArrastrado(mesIndex, anio);

  // Total que le corresponde pagar a cada casa este mes
  let totalCasa1 = 0, totalCasa2 = 0, totalCasa3 = 0;
  gastos.forEach(g => {
    totalCasa1 += g.casa1;
    totalCasa2 += g.casa2;
    totalCasa3 += g.casa3;
  });

  // Saldo = lo que debe pagar + arrastre − lo que ya transfirió
  // Positivo = aún debe. Negativo = pagó de más (a favor).
  return {
    gastos,
    transferencias,
    arrastrado,
    totalCorresponde: { casa1: totalCasa1, casa2: totalCasa2, casa3: totalCasa3 },
    saldo: {
      casa1: Math.round((totalCasa1 + arrastrado.casa1 - transferencias.casa1) * 100) / 100,
      casa2: Math.round((totalCasa2 + arrastrado.casa2 - transferencias.casa2) * 100) / 100,
      casa3: Math.round((totalCasa3 + arrastrado.casa3 - transferencias.casa3) * 100) / 100,
    }
  };
}


// ============================================================
//  /resumen — Reporte completo de todas las casas
// ============================================================
function mostrarResumen(chatId, casaFiltro) {
  const ahora    = ahoraAR();
  const mes      = ahora.getMonth();
  const anio     = ahora.getFullYear();
  const datos    = calcularSaldos(mes, anio);
  const { gastos, transferencias, arrastrado, totalCorresponde, saldo } = datos;

  if (gastos.length === 0 && !arrastrado.casa1 && !arrastrado.casa2 && !arrastrado.casa3) {
    sendMessage(chatId, `📭 No hay gastos cargados en ${nombreMes(mes)} ${anio}.`);
    return;
  }

  // ── Resumen individual por casa ───────────────────────────
  if (casaFiltro) {
    const idx   = parseInt(casaFiltro.replace('casa', ''), 10) - 1;
    const keys  = ['casa1', 'casa2', 'casa3'];
    const key   = keys[idx];
    const info  = CASAS[casaFiltro];

    let msg = `🏠 *${info.nombre} — ${info.integrantes}*\n`;
    msg    += `📅 ${nombreMes(mes)} ${anio}\n`;
    msg    += `━━━━━━━━━━━━━━━━━━\n\n`;

    if (gastos.length > 0) {
      msg += `*Detalle:*\n`;
      gastos.forEach(g => {
        const parteKey = key; // 'casa1', 'casa2' o 'casa3'
        const parteCasa = g[parteKey];
        if (parteCasa === 0) return; // esta casa no participa en este gasto
        msg += `  · ${g.nombre.toUpperCase()}: ${fmt(g.monto)} → ${fmt(parteCasa)}\n`;
      });
      msg += '\n';
    }

    if (arrastrado[key] !== 0) {
      const signo = arrastrado[key] > 0 ? '🔴 Deuda arrastrada' : '🟢 Favor arrastrado';
      msg += `${signo}: *${fmt(Math.abs(arrastrado[key]))}*\n`;
    }

    msg += `\n━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 *Total que te corresponde: ${fmt(totalCorresponde[key])}*\n`;


    if (arrastrado[key] !== 0) {
      msg += `↩️ Arrastre: ${arrastrado[key] > 0 ? '+' : ''}${fmt(arrastrado[key])}\n`;
    }

    msg += '\n';
    if (saldo[key] > 0.009) {
      msg += `🔴 *Saldo pendiente: ${fmt(saldo[key])}*`;
    } else if (saldo[key] < -0.009) {
      msg += `🟢 *Saldo a favor: ${fmt(Math.abs(saldo[key]))}*`;
    } else {
      msg += `✅ *Todo saldado*`;
    }

    sendMarkdown(chatId, msg);
    return;
  }

  // ── Resumen completo — todas las casas ────────────────────
  let msg = `📋 *Resumen — ${nombreMes(mes)} ${anio}*\n`;
  msg    += `━━━━━━━━━━━━━━━━━━\n\n`;

  if (gastos.length > 0) {
    msg += `*Gastos del mes:*\n`;
    gastos.forEach(g => {
      msg += `\n*${g.nombre.toUpperCase()}* — Total: ${fmt(g.monto)}\n`;
      if (g.casa1 > 0) msg += `  Casa 1: ${fmt(g.casa1)}\n`;
      if (g.casa2 > 0) msg += `  Casa 2: ${fmt(g.casa2)}\n`;
      if (g.casa3 > 0) msg += `  Casa 3: ${fmt(g.casa3)}\n`;
      if (g.venc)       msg += `  📆 Vence: ${formatearFecha(g.venc)}\n`;
    });
    msg += `\n━━━━━━━━━━━━━━━━━━\n`;
  }

  // Totales por casa
  ['casa1', 'casa2', 'casa3'].forEach((key, i) => {
    const info = CASAS[key];
    const tc   = totalCorresponde[key];
    const tr   = transferencias[key];
    const arr  = arrastrado[key];
    const sal  = saldo[key];

    if (tc === 0 && tr === 0 && arr === 0) return;

    msg += `\n🏠 *${info.nombre}*\n`;
    if (tc > 0)         msg += `  Corresponde: ${fmt(tc)}\n`;
    if (tr > 0)         msg += `  Transferido: ${fmt(tr)}\n`;
    if (arr !== 0)      msg += `  Arrastre: ${arr > 0 ? '+' : ''}${fmt(arr)}\n`;

    if (sal > 0.009) {
      msg += `  🔴 Saldo: *${fmt(sal)}*\n`;
    } else if (sal < -0.009) {
      msg += `  🟢 A favor: *${fmt(Math.abs(sal))}*\n`;
    } else {
      msg += `  ✅ Saldado\n`;
    }
  });

  sendMarkdown(chatId, msg);
}


// ============================================================
//  /historial_mes — Reporte de un mes cerrado
// ============================================================
function mostrarHistorial(chatId, mesIndex, anio) {
  const hoja    = getHoja(HOJA_SALDOS);
  const lastRow = hoja.getLastRow();

  // Buscar si hay saldo guardado de ese mes
  let saldoGuardado = null;
  if (lastRow > 1) {
    const datos = hoja.getRange(2, 1, lastRow - 1, 5).getValues();
    const fila  = datos.find(f =>
      parseInt(f[SCOL_MES], 10) === mesIndex + 1 &&
      parseInt(f[SCOL_ANIO], 10) === anio
    );
    if (fila) {
      saldoGuardado = {
        casa1: parseFloat(fila[SCOL_CASA1]) || 0,
        casa2: parseFloat(fila[SCOL_CASA2]) || 0,
        casa3: parseFloat(fila[SCOL_CASA3]) || 0
      };
    }
  }

  // Buscar gastos de ese mes (activos y pagados)
  const hojaGastos = getHoja(HOJA_GASTOS);
  const lastRowG   = hojaGastos.getLastRow();
  const prefijo    = `${anio}-${String(mesIndex + 1).padStart(2, '0')}`;
  const gastos     = [];

  if (lastRowG > 1) {
    for (let s = 2; s <= lastRowG; s += 1000) {
      const e     = Math.min(s + 999, lastRowG);
      const batch = hojaGastos.getRange(s, 1, e - s + 1, 10).getValues();
      batch.forEach(fila => {
        const fechaRaw = fila[GCOL_FECHA];
        const fecha    = fechaRaw instanceof Date ? fechaRaw : new Date(fechaRaw);
        if (isNaN(fecha.getTime())) return;
        if (Utilities.formatDate(fecha, TIMEZONE, 'yyyy-MM') !== prefijo) return;

        const estado = (fila[GCOL_ESTADO] || '').toString().trim();
        if (estado === ESTADO_PROGRAMADO) return; // no mostrar programados en historial

        gastos.push({
          nombre: (fila[GCOL_NOMBRE] || '').toString().trim(),
          monto:  parseFloat(fila[GCOL_MONTO]) || 0,
          casa1:  parseFloat(fila[GCOL_CASA1]) || 0,
          casa2:  parseFloat(fila[GCOL_CASA2]) || 0,
          casa3:  parseFloat(fila[GCOL_CASA3]) || 0,
        });
      });
    }
  }

  if (gastos.length === 0 && !saldoGuardado) {
    sendMessage(chatId, `📭 No hay datos para ${nombreMes(mesIndex)} ${anio}.`);
    return;
  }

  let msg = `📚 *Historial — ${nombreMes(mesIndex)} ${anio}*\n`;
  msg    += `━━━━━━━━━━━━━━━━━━\n\n`;

  if (gastos.length > 0) {
    msg += `*Gastos del mes:*\n`;
    gastos.forEach(g => {
      msg += `\n*${g.nombre.toUpperCase()}* — ${fmt(g.monto)}\n`;
      if (g.casa1 > 0) msg += `  Casa 1: ${fmt(g.casa1)}\n`;
      if (g.casa2 > 0) msg += `  Casa 2: ${fmt(g.casa2)}\n`;
      if (g.casa3 > 0) msg += `  Casa 3: ${fmt(g.casa3)}\n`;
    });
    msg += `\n━━━━━━━━━━━━━━━━━━\n`;
  }

  if (saldoGuardado) {
    msg += `\n*Saldo final del mes:*\n`;
    ['casa1', 'casa2', 'casa3'].forEach(key => {
      const sal  = saldoGuardado[key];
      const info = CASAS[key];
      if (sal > 0.009) {
        msg += `  🔴 ${info.nombre}: ${fmt(sal)} pendiente\n`;
      } else if (sal < -0.009) {
        msg += `  🟢 ${info.nombre}: ${fmt(Math.abs(sal))} a favor\n`;
      } else {
        msg += `  ✅ ${info.nombre}: saldado\n`;
      }
    });
  } else {
    msg += `\n_ℹ️ Este mes no tiene saldo final guardado (no fue cerrado formalmente)._`;
  }

  sendMarkdown(chatId, msg);
}


// ============================================================
//  /vencimientos — Próximos vencimientos
//  Muestra todos los gastos activos y programados con fecha
//  de vencimiento, ordenados por fecha.
// ============================================================
function mostrarVencimientos(chatId) {
  const hoja    = getHoja(HOJA_GASTOS);
  const lastRow = hoja.getLastRow();

  if (lastRow <= 1) {
    sendMessage(chatId, '📭 No hay gastos cargados.');
    return;
  }

  const ahora = ahoraAR();
  const items = [];

  for (let s = 2; s <= lastRow; s += 1000) {
    const e     = Math.min(s + 999, lastRow);
    const batch = hoja.getRange(s, 1, e - s + 1, 10).getValues();

    batch.forEach(fila => {
      const estado = (fila[GCOL_ESTADO] || '').toString().trim();
      if (estado === ESTADO_PAGADO) return; // ya pagado, no mostrar

      const vencRaw = fila[GCOL_VENCIMIENTO];
      if (!vencRaw) return; // sin fecha de vencimiento, no mostrar en esta lista

      const venc = vencRaw instanceof Date ? vencRaw : new Date(vencRaw);
      if (isNaN(venc.getTime())) return;
      if (venc < ahora) return; // ya venció

      items.push({
        nombre: (fila[GCOL_NOMBRE] || '').toString().trim(),
        monto:  parseFloat(fila[GCOL_MONTO]) || 0,
        venc,
        estado
      });
    });
  }

  if (items.length === 0) {
    sendMessage(chatId, '✅ No hay vencimientos próximos cargados.');
    return;
  }

  // Ordenar por fecha de vencimiento ascendente
  items.sort((a, b) => a.venc - b.venc);

  let msg = `📆 *Próximos vencimientos*\n━━━━━━━━━━━━━━━━━━\n\n`;

  items.forEach(item => {
    const etiqueta = item.estado === ESTADO_PROGRAMADO ? ' _(programado)_' : '';
    msg += `  · *${item.nombre.toUpperCase()}*${etiqueta}\n`;
    msg += `    ${fmt(item.monto)} — vence ${formatearFecha(item.venc)}\n\n`;
  });

  sendMarkdown(chatId, msg);
}


// ============================================================
//  CIERRE AUTOMÁTICO DE FIN DE MES
//  Esta función debe programarse con un Trigger de Apps Script
//  para que se ejecute automáticamente el último día del mes
//  a las 23:55.
//
//  Cómo programarla:
//  En Apps Script → Triggers → + Agregar trigger
//  Función: cerrarMes
//  Tipo de evento: Basado en tiempo → Mensual → último día del mes
// ============================================================
function cerrarMes() {
  const ahora = ahoraAR();
  const mes   = ahora.getMonth();
  const anio  = ahora.getFullYear();

  const datos = calcularSaldos(mes, anio);
  const { saldo } = datos;

  const hoja    = getHoja(HOJA_SALDOS);
  const lastRow = hoja.getLastRow();

  // Verificar que no esté ya cerrado este mes
  if (lastRow > 1) {
    const existentes = hoja.getRange(2, 1, lastRow - 1, 2).getValues();
    const yaCerrado  = existentes.some(f =>
      parseInt(f[0], 10) === mes + 1 && parseInt(f[1], 10) === anio
    );
    if (yaCerrado) {
      Logger.log(`ℹ️ El mes ${mes + 1}/${anio} ya estaba cerrado.`);
      return;
    }
  }

  // Guardar saldo final del mes
  hoja.appendRow([mes + 1, anio, saldo.casa1, saldo.casa2, saldo.casa3]);

  // Marcar todos los gastos activos del mes como 'pagado'
  const hojaGastos = getHoja(HOJA_GASTOS);
  const lastRowG   = hojaGastos.getLastRow();
  const prefijo    = `${anio}-${String(mes + 1).padStart(2, '0')}`;

  if (lastRowG > 1) {
    for (let s = 2; s <= lastRowG; s += 1000) {
      const e     = Math.min(s + 999, lastRowG);
      const batch = hojaGastos.getRange(s, 1, e - s + 1, 10).getValues();

      batch.forEach((fila, idx) => {
        const fechaRaw = fila[GCOL_FECHA];
        const fecha    = fechaRaw instanceof Date ? fechaRaw : new Date(fechaRaw);
        if (isNaN(fecha.getTime())) return;
        if (Utilities.formatDate(fecha, TIMEZONE, 'yyyy-MM') !== prefijo) return;

        const estado = (fila[GCOL_ESTADO] || '').toString().trim();
        if (estado !== ESTADO_ACTIVO) return;

        // Actualizar celda de estado a 'pagado'
        hojaGastos.getRange(s + idx, GCOL_ESTADO + 1).setValue(ESTADO_PAGADO);
      });
    }
  }

  // Activar gastos programados del próximo mes que ya corresponden
  activarGastosProgramados();

  Logger.log(`✅ Mes ${mes + 1}/${anio} cerrado. Saldos: Casa1=${saldo.casa1} Casa2=${saldo.casa2} Casa3=${saldo.casa3}`);
}


// ============================================================
//  ACTIVAR GASTOS PROGRAMADOS
//  Busca gastos con estado 'programado' cuya fecha de vencimiento
//  ya corresponde al mes actual o al siguiente, y los activa.
//  Se llama automáticamente al cerrar el mes.
// ============================================================
function activarGastosProgramados() {
  const hoja    = getHoja(HOJA_GASTOS);
  const lastRow = hoja.getLastRow();
  if (lastRow <= 1) return;

  const ahora        = ahoraAR();
  const mesActual    = ahora.getMonth();
  const anioActual   = ahora.getFullYear();
  // Mes siguiente
  const mesSiguiente = mesActual === 11 ? 0 : mesActual + 1;
  const anioSiguiente = mesActual === 11 ? anioActual + 1 : anioActual;

  for (let s = 2; s <= lastRow; s += 1000) {
    const e     = Math.min(s + 999, lastRow);
    const batch = hoja.getRange(s, 1, e - s + 1, 10).getValues();

    batch.forEach((fila, idx) => {
      const estado = (fila[GCOL_ESTADO] || '').toString().trim();
      if (estado !== ESTADO_PROGRAMADO) return;

      const vencRaw = fila[GCOL_VENCIMIENTO];
      if (!vencRaw) return;
      const venc = vencRaw instanceof Date ? vencRaw : new Date(vencRaw);
      if (isNaN(venc.getTime())) return;

      const vencMes  = venc.getMonth();
      const vencAnio = venc.getFullYear();

      // Activar si el vencimiento es el mes siguiente
      if (vencMes === mesSiguiente && vencAnio === anioSiguiente) {
        hoja.getRange(s + idx, GCOL_ESTADO + 1).setValue(ESTADO_ACTIVO);
        Logger.log(`✅ Activado: ${fila[GCOL_NOMBRE]} para ${mesSiguiente + 1}/${anioSiguiente}`);
      }
    });
  }
}
/**
 * ============================================================
 *  CuentasBot — Bloque 4: Corregir y eliminar gastos
 *
 *  Este bloque contiene:
 *  · /corregir — muestra gastos del mes con botones inline
 *  · /eliminar — muestra gastos del mes con botones inline
 *  · procesarCallbackQuery() — maneja la respuesta a los botones
 *  · Flujo de corrección de monto (conversacional)
 *
 *  REGLA: Solo se pueden editar o eliminar gastos del mes actual.
 *  Los meses cerrados son de solo lectura.
 * ============================================================
 */


// ============================================================
//  INICIAR CORRECCIÓN
//  Muestra la lista de gastos del mes actual con un botón
//  "Corregir" al lado de cada uno.
// ============================================================
function iniciarCorreccion(chatId) {
  const ahora  = ahoraAR();
  const gastos = getGastosDelMes(ahora.getMonth(), ahora.getFullYear());

  if (gastos.length === 0) {
    sendMessage(chatId, '📭 No hay gastos activos en el mes actual para corregir.');
    return;
  }

  let texto  = `✏️ *¿Qué gasto querés corregir?*\n`;
  texto     += `_Solo se puede cambiar el monto y/o la fecha de vencimiento._\n\n`;

  gastos.forEach((g, i) => {
    const venc = g.venc ? ` (vence ${formatearFecha(g.venc)})` : '';
    texto += `${i + 1}. *${g.nombre.toUpperCase()}* — ${fmt(g.monto)}${venc}\n`;
  });

  // Un botón por gasto. El callback_data lleva el número de fila en la hoja.
  const botones = gastos.map(g => ([{
    text: `✏️ ${g.nombre.toUpperCase()} — ${fmt(g.monto)}`,
    callback_data: `corregir_${g.fila}`
  }]));

  // Botón cancelar al final
  botones.push([{ text: '❌ Cancelar', callback_data: 'cancelar' }]);

  sendConBotones(chatId, texto, botones);
}


// ============================================================
//  INICIAR ELIMINACIÓN
//  Muestra la lista de gastos del mes actual con un botón
//  "Eliminar" al lado de cada uno.
// ============================================================
function iniciarEliminacion(chatId) {
  const ahora  = ahoraAR();
  const gastos = getGastosDelMes(ahora.getMonth(), ahora.getFullYear());

  if (gastos.length === 0) {
    sendMessage(chatId, '📭 No hay gastos activos en el mes actual para eliminar.');
    return;
  }

  let texto = `🗑️ *¿Qué gasto querés eliminar?*\n\n`;

  gastos.forEach((g, i) => {
    const venc = g.venc ? ` (vence ${formatearFecha(g.venc)})` : '';
    texto += `${i + 1}. *${g.nombre.toUpperCase()}* — ${fmt(g.monto)}${venc}\n`;
  });

  const botones = gastos.map(g => ([{
    text: `🗑️ ${g.nombre.toUpperCase()} — ${fmt(g.monto)}`,
    callback_data: `eliminar_${g.fila}`
  }]));

  botones.push([{ text: '❌ Cancelar', callback_data: 'cancelar' }]);

  sendConBotones(chatId, texto, botones);
}


// ============================================================
//  PROCESADOR DE CALLBACK QUERIES
//  Llega acá cada vez que Nombre2 presiona un botón inline.
//  Telegram nos manda el callback_data que pusimos al crear
//  el botón.
// ============================================================
function procesarCallbackQuery(callbackQuery) {
  const chatId    = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data      = callbackQuery.data;

  if (!isAuthorized(chatId)) {
    responderCallback(callbackQuery.id, '🚫 Acceso denegado.');
    return;
  }

  // Siempre responder al callback para quitar el "loading" del botón
  responderCallback(callbackQuery.id);

  // ── Cancelar ──────────────────────────────────────────────
  if (data === 'cancelar') {
    limpiarEstadoConversacion(chatId);
    editarMensaje(chatId, messageId, '❌ Operación cancelada.');
    return;
  }

  // ── Confirmar eliminación ─────────────────────────────────
  if (data.startsWith('confirmar_eliminar_')) {
    const filaNum = parseInt(data.replace('confirmar_eliminar_', ''), 10);
    ejecutarEliminacion(chatId, messageId, filaNum);
    return;
  }

  // ── Elegir gasto a corregir ───────────────────────────────
  if (data.startsWith('corregir_')) {
    const filaNum = parseInt(data.replace('corregir_', ''), 10);
    pedirNuevoMonto(chatId, messageId, filaNum);
    return;
  }

  // ── Elegir gasto a eliminar ───────────────────────────────
  if (data.startsWith('eliminar_')) {
    const filaNum = parseInt(data.replace('eliminar_', ''), 10);
    pedirConfirmacionEliminacion(chatId, messageId, filaNum);
    return;
  }
}


// ============================================================
//  CORRECCIÓN — Paso 1: pedir nuevo monto
//  El usuario eligió qué gasto corregir.
//  Ahora guardamos el estado y le pedimos el nuevo monto.
// ============================================================
function pedirNuevoMonto(chatId, messageId, filaNum) {
  // Leer el gasto actual para mostrarlo
  const hoja = getHoja(HOJA_GASTOS);
  const fila = hoja.getRange(filaNum, 1, 1, 10).getValues()[0];

  const nombre       = (fila[GCOL_NOMBRE] || '').toString().trim();
  const montoActual  = parseFloat(fila[GCOL_MONTO]) || 0;
  const vencActual   = fila[GCOL_VENCIMIENTO]
    ? formatearFecha(new Date(fila[GCOL_VENCIMIENTO]))
    : null;

  // Guardar estado: estamos esperando el nuevo monto
  setEstadoConversacion(chatId, {
    accion:     'esperando_nuevo_monto',
    filaNum:    filaNum,
    nombre:     nombre,
    montoViejo: montoActual
  });

  editarMensaje(chatId, messageId,
    `✏️ *Corrigiendo: ${nombre.toUpperCase()}*\n\n` +
    `Monto actual: *${fmt(montoActual)}*\n` +
    (vencActual ? `Vencimiento actual: ${vencActual}\n` : '') +
    `\nEscribí el nuevo monto (y opcionalmente la nueva fecha):\n` +
    `Ejemplos:\n` +
    `\`350000\`\n` +
    `\`350000 28/3\`\n\n` +
    `_Escribí /cancelar para cancelar._`
  );
}


// ============================================================
//  CORRECCIÓN — Paso 2: aplicar la corrección
//  El usuario respondió con el nuevo monto (y opcionalmente fecha).
// ============================================================
function completarCorreccionMonto(chatId, text, estado) {
  // Parsear "350000" o "350000 28/3"
  const match = text.trim().match(/^([\d.,]+)(?:\s+(\d{1,2}\/\d{1,2}))?$/);
  if (!match) {
    sendMessage(chatId,
      '⚠️ Formato incorrecto.\nEjemplos:\n`350000`\n`350000 28/3`\n\nO escribí /cancelar para cancelar.'
    );
    return;
  }

  const nuevoMonto = parsearMonto(match[1]);
  if (nuevoMonto <= 0) {
    sendMessage(chatId, '⚠️ El monto debe ser mayor a cero.');
    return;
  }

  const nuevaFechaStr = match[2] || null;
  let nuevaFecha = null;
  if (nuevaFechaStr) {
    nuevaFecha = parsearFecha(nuevaFechaStr);
    if (!nuevaFecha) {
      sendMessage(chatId, `⚠️ Fecha inválida: "${nuevaFechaStr}". Usá el formato dd/mm.`);
      return;
    }
  }

  const hoja     = getHoja(HOJA_GASTOS);
  const filaNum  = estado.filaNum;
  const filaData = hoja.getRange(filaNum, 1, 1, 10).getValues()[0];

  // Recalcular participación por casa con el nuevo monto
  const participa = [
    filaData[GCOL_CASA1] > 0,
    filaData[GCOL_CASA2] > 0,
    filaData[GCOL_CASA3] > 0
  ];
  const nuevasPartes = dividirMonto(nuevoMonto, participa);

  // Actualizar monto total
  hoja.getRange(filaNum, GCOL_MONTO + 1).setValue(nuevoMonto);
  // Actualizar partes por casa
  hoja.getRange(filaNum, GCOL_CASA1 + 1).setValue(nuevasPartes[0]);
  hoja.getRange(filaNum, GCOL_CASA2 + 1).setValue(nuevasPartes[1]);
  hoja.getRange(filaNum, GCOL_CASA3 + 1).setValue(nuevasPartes[2]);

  // Actualizar fecha de vencimiento si se proporcionó
  if (nuevaFecha) {
    const nuevaFechaStr2 = Utilities.formatDate(nuevaFecha, TIMEZONE, 'yyyy-MM-dd');
    hoja.getRange(filaNum, GCOL_VENCIMIENTO + 1).setValue(nuevaFechaStr2);
    // Actualizar estado según nueva fecha
    const nuevoEstado = determinarEstado(nuevaFecha);
    hoja.getRange(filaNum, GCOL_ESTADO + 1).setValue(nuevoEstado);
  }

  limpiarEstadoConversacion(chatId);

  // Armar respuesta con el detalle actualizado
  const casasParticipantes = [];
  if (participa[0]) casasParticipantes.push(`Casa 1: ${fmt(nuevasPartes[0])}`);
  if (participa[1]) casasParticipantes.push(`Casa 2: ${fmt(nuevasPartes[1])}`);
  if (participa[2]) casasParticipantes.push(`Casa 3: ${fmt(nuevasPartes[2])}`);

  sendMarkdown(chatId,
    `✅ *${estado.nombre.toUpperCase()} corregido*\n\n` +
    `Monto anterior: ${fmt(estado.montoViejo)}\n` +
    `Monto nuevo: *${fmt(nuevoMonto)}*\n` +
    (nuevaFecha ? `📆 Nueva fecha: ${formatearFecha(nuevaFecha)}\n` : '') +
    `\n*Participación actualizada:*\n` +
    casasParticipantes.map(c => `  · ${c}`).join('\n')
  );
}


// ============================================================
//  ELIMINACIÓN — Paso 1: confirmar
//  Antes de borrar, el bot pide confirmación explícita.
// ============================================================
function pedirConfirmacionEliminacion(chatId, messageId, filaNum) {
  const hoja   = getHoja(HOJA_GASTOS);
  const fila   = hoja.getRange(filaNum, 1, 1, 10).getValues()[0];
  const nombre = (fila[GCOL_NOMBRE] || '').toString().trim();
  const monto  = parseFloat(fila[GCOL_MONTO]) || 0;

  const botones = [
    [{ text: `✅ Sí, eliminar ${nombre.toUpperCase()}`, callback_data: `confirmar_eliminar_${filaNum}` }],
    [{ text: '❌ No, cancelar',                          callback_data: 'cancelar'                      }]
  ];

  editarMensaje(chatId, messageId,
    `🗑️ *¿Confirmar eliminación?*\n\n` +
    `*${nombre.toUpperCase()}* — ${fmt(monto)}\n\n` +
    `⚠️ Esta acción no se puede deshacer.`
  );

  // Enviar nuevo mensaje con los botones de confirmación
  sendConBotones(chatId,
    `¿Eliminás *${nombre.toUpperCase()}*?`,
    botones
  );
}


// ============================================================
//  ELIMINACIÓN — Paso 2: ejecutar
// ============================================================
function ejecutarEliminacion(chatId, messageId, filaNum) {
  const hoja   = getHoja(HOJA_GASTOS);
  const fila   = hoja.getRange(filaNum, 1, 1, 10).getValues()[0];
  const nombre = (fila[GCOL_NOMBRE] || '').toString().trim();
  const monto  = parseFloat(fila[GCOL_MONTO]) || 0;

  // Verificar que el gasto siga siendo del mes actual (seguridad)
  const fechaRaw  = fila[GCOL_FECHA];
  const fechaGasto = fechaRaw instanceof Date ? fechaRaw : new Date(fechaRaw);
  const ahora      = ahoraAR();
  const mesFecha   = Utilities.formatDate(fechaGasto, TIMEZONE, 'yyyy-MM');
  const mesActual  = Utilities.formatDate(ahora, TIMEZONE, 'yyyy-MM');

  if (mesFecha !== mesActual) {
    editarMensaje(chatId, messageId,
      '🚫 No se puede eliminar: este gasto pertenece a un mes cerrado.'
    );
    return;
  }

  hoja.deleteRow(filaNum);

  editarMensaje(chatId, messageId,
    `✅ *${nombre.toUpperCase()}* eliminado (${fmt(monto)})`
  );
}

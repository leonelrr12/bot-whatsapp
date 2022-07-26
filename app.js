/**
 * ⚡⚡⚡ DECLARAMOS LAS LIBRERIAS y CONSTANTES A USAR! ⚡⚡⚡
 */
require('dotenv').config()
const fs = require('fs');
const express = require('express');
const cors = require('cors')
const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const mysqlConnection = require('./config/mysql')
const { middlewareClient } = require('./middleware/client')
const { generateImage, cleanNumber, checkEnvFile, createClient, isValidNumber } = require('./controllers/handle')
const { connectionReady, connectionLost } = require('./controllers/connection')
const { saveMedia } = require('./controllers/save')
const { getMessages, responseMessages, bothResponse } = require('./controllers/flows')
const { sendMedia, sendMessage, lastTrigger, sendMessageButton, readChat } = require('./controllers/send')
const app = express();
app.use(cors())
app.use(express.json())
const MULTI_DEVICE = process.env.MULTI_DEVICE || 'true';
const server = require('http').Server(app)

const port = process.env.PORT || 3000
const SESSION_FILE_PATH = './session.json';
var client;
// var sessionData;
var respuesta;
var lastStep;

app.use('/', require('./routes/web'))

/**
 * Escuchamos cuando entre un mensaje
 */
const listenMessage = () => client.on('message', async msg => {
  const { from, body, hasMedia } = msg;

  if (!isValidNumber(from)) {
    return
  }

  // Este bug lo reporto Lucas Aldeco Brescia para evitar que se publiquen estados
  if (from === 'status@broadcast') {
    return
  }
  message = body.toLowerCase();
  respuesta = message;
  console.log('BODY', message)
  const numero = cleanNumber(from)
  await readChat(numero, message)

  /**
   * Guardamos el archivo multimedia que envia
   */
  if (process.env.SAVE_MEDIA && hasMedia) {
    const media = await msg.downloadMedia();
    saveMedia(media);
  }

  /**
   * Si estas usando dialogflow solo manejamos una funcion todo es IA
   */

  if (process.env.DATABASE === 'dialogflow') {
    if (!message.length) return;
    const response = await bothResponse(message);
    await sendMessage(client, from, response.replyMessage);
    if (response.media) {
      sendMedia(client, from, response.media);
    }
    return
  }

  /**
  * Ver si viene de un paso anterior
  * Aqui podemos ir agregando más pasos
  * a tu gusto!
  */

  // No se cual es la aplicacion de este codigo LLRR
  // const lastStep = await lastTrigger(from) || null;
  // if (lastStep) {
  //     const response = await responseMessages(lastStep)
  //     await sendMessage(client, from, response.replyMessage);
  // }

  /**
   * Respondemos al primero paso si encuentra palabras clave
   */

  let step = await getMessages(message);
  console.log('step, respuesta, numero', step, lastStep, respuesta, numero)
  if (lastStep == 'STEP_1') {
    switch (respuesta) {
      case "1":
        step = 'STEP_2';
        break;
      case "2":
        step = 'STEP_2_1';
        break;
      case "3":
        step = 'STEP_5';
        break;
      default:
        step = 'STEP_1';
        break;
    }
  }

  if (lastStep == 'STEP_2' || lastStep == 'STEP_2_1') {
    step = 'STEP_3';
  }

  if (lastStep == 'STEP_3') {
    switch (respuesta) {
      case "2":
        step = 'STEP_4';
        break;
      case "1":
      case "3":
        step = 'STEP_4_1';
        break;
      default:
        step = 'STEP_3';
        break;
    }
  }

  if (lastStep == 'STEP_4') {
    if (isNaN(respuesta)) {
      step = 'STEP_4';
    } else {
      if (parseInt(respuesta) <= 0) step = 'STEP_4';
      else step = 'STEP_5';
      // Aqui se puede agregar mas logica para validadr cantidad de meses
    }
  }

  if (lastStep == 'STEP_5') {
    switch (respuesta) {
      case "1":
        step = 'STEP_6';
        break;
      case "2":
        step = 'STEP_5_1';
        break;
      default:
        step = 'STEP_5';
        break;
    }
  }

  if (lastStep == 'STEP_6') {
    switch (respuesta) {
      case "1":
      case "2":
        step = 'STEP_7';
        break;
      case "3":
      case "4":
      case "5":
        step = 'STEP_6_1';
        break;
      default:
        step = 'STEP_6';
        break;
    }
  }

  if (lastStep == 'STEP_7') {
    switch (respuesta) {
      case "1":
      case "2":
        step = 'STEP_8';
        break;
      case "3":
      case "4":
        step = 'STEP_7_1';
        break;
      default:
        step = 'STEP_7';
        break;
    }
  }

  if (lastStep == 'STEP_7_1') {
    if (isNaN(respuesta)) {
      step = 'STEP_7_1';
    } else {
      if (parseInt(respuesta) <= 0) step = 'STEP_7_1';
      else step = 'STEP_8';
    }
  }

  console.log(lastStep, step)
  if (step) {
    const response = await responseMessages(step);

    await sendMessage(client, from, response.replyMessage, response.trigger);
    if (response.hasOwnProperty('actions')) {
      const { actions } = response;
      await sendMessageButton(client, from, null, actions);
      lastStep = step;
      return
    }

    if (!response.delay && response.media) {
      sendMedia(client, from, response.media);
    }
    if (response.delay && response.media) {
      setTimeout(() => {
        sendMedia(client, from, response.media);
      }, response.delay)
    }
    lastStep = step;
    return
  }
  lastStep = step;

  //Si quieres tener un mensaje por defecto
  if (process.env.DEFAULT_MESSAGE === 'true') {
    const response = await responseMessages('DEFAULT')
    await sendMessage(client, from, response.replyMessage, response.trigger);

    /**
     * Si quieres enviar botones
     */
    if (response.hasOwnProperty('actions')) {
      const { actions } = response;
      await sendMessageButton(client, from, null, actions);
    }
    return
  }
});

/**
 * Revisamos si tenemos credenciales guardadas para inciar sessio
 * este paso evita volver a escanear el QRCODE
 */
// const withSession = () => {
//     console.log(`Validando session con Whatsapp...`)
//     sessionData = require(SESSION_FILE_PATH);
//     client = new Client(createClient(sessionData,true));

//     client.on('ready', () => {
//         connectionReady()
//         listenMessage()
//     });

//     client.on('auth_failure', () => connectionLost())

//     client.initialize();
// }

/**
 * Generamos un QRCODE para iniciar sesion
 */
const withOutSession = () => {
  console.log('No tenemos session guardada');
  console.log([
    '🙌 El core de whatsapp se esta actualizando',
    '🙌 para proximamente dar paso al multi-device',
    '🙌 falta poco si quieres estar al pendiente unete',
    '🙌 http://t.me/leifermendez',
    '🙌 Si estas usando el modo multi-device se generan 2 QR Code escanealos',
    '🙌 Ten paciencia se esta generando el QR CODE',
    '________________________',
  ].join('\n'));

  client = new Client(createClient());

  client.on('qr', qr => generateImage(qr, () => {
    qrcode.generate(qr, { small: true });
    console.log(`Ver QR http://localhost:${port}/qr`)
    socketEvents.sendQR(qr)
  }))

  client.on('ready', (a) => {
    connectionReady()
    listenMessage()
    // socketEvents.sendStatus(client)
  });

  client.on('auth_failure', (e) => {
    // console.log(e)
    // connectionLost()
  });

  client.on('authenticated', (session) => {
    // sessionData = session;
    // if(sessionData){
    //     fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
    //         if (err) {
    //             console.log(`Ocurrio un error con el archivo: `, err);
    //         }
    //     });
    // }
  });

  client.initialize();
}

/**
 * Revisamos si existe archivo con credenciales!
 */
// (fs.existsSync(SESSION_FILE_PATH) && MULTI_DEVICE === 'false') ? withSession() : withOutSession();

withOutSession();


/**
 * Verificamos si tienes un gesto de db
 */

if (process.env.DATABASE === 'mysql') {
  mysqlConnection.connect()
}

server.listen(port, () => {
  console.log(`El server esta listo por el puerto ${port}`);
})
checkEnvFile();


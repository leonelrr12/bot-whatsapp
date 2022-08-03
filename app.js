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
const { generateImage, cleanNumber, checkEnvFile, createClient, isValidNumber } = require('./controllers/handle')
const { connectionReady } = require('./controllers/connection')
const { saveMedia } = require('./controllers/save')
const { getMessages, responseMessages, bothResponse } = require('./controllers/flows')
const { sendMedia, sendMessage, sendMessageButton, readChat } = require('./controllers/send')
const axios = require('axios');
const app = express();
app.use(cors())
app.use(express.json())
app.use('/', require('./routes/web'))

const MULTI_DEVICE = process.env.MULTI_DEVICE || 'true';
const server = require('http').Server(app)

const port = process.env.PORT || 3000
const SESSION_FILE_PATH = './session.json';

var client;
var respuesta;
var lastStep;
var idClientify = '';
var tokenClientify;
var dataClient = {};

const validCedula = /^\d{1,2}(-|\s)\d{1,3}(-|\s)\d{1,4}$/
const validDate = /^\d{1,2}(\/|\s)\d{1,2}(\/|\s)\d{2,4}$/
const validEmail = /^[-\w.%+]{1,64}@(?:[A-Z0-9-]{1,63}\.){1,125}[A-Z]{2,63}$/i;
const validPhone = /^\d{3}(-|\s)\d{4}$/
const validCell = /^\d{4}(-|\s)\d{4}$/


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
  dataClient.phone = numero.split('@')[0] //.slice(3)

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

  let step = await getMessages(message);
  if (lastStep == 'STEP_1') {
    dataClient.Sector = respuesta == '1' ? 'Privada' : (respuesta == '2' ? 'Publico' : 'Jubilado')
    switch (respuesta) {
      case "1":
        step = 'STEP_2_1';
        break;
      case "2":
        step = 'STEP_2';
        break;
      case "3":
        step = 'STEP_5';
        dataClient.profesion = '7';
        break;
      default:
        step = 'STEP_1';
        break;
    }
  }

  if (lastStep == 'STEP_2' || lastStep == 'STEP_2_1') {
    let resp = '0'
    if (respuesta == '1') resp = '2'
    if (respuesta == '2') resp = '3'
    if (respuesta == '3' && lastStep == 'STEP_2') resp = '4'
    if (respuesta == '3' && lastStep == 'STEP_2_1') resp = '1'
    if (respuesta == '4') resp = '5'
    if (respuesta == '5') resp = '6'
    dataClient.profesion = resp
    step = 'STEP_3';
  }

  if (lastStep == 'STEP_3') {
    dataClient.contrato_laboral = respuesta
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
      else {
        step = 'STEP_5';
        dataClient.meses_trabajo_actual = respuesta
      }
      // Aqui se puede agregar mas logica para validar cantidad de meses
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
    dataClient.historialCredito = respuesta
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
    dataClient.tipo_residencia = respuesta
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
      else {
        step = 'STEP_8';
        dataClient.mensualidad_casa = respuesta
      }
    }
  }

  if (lastStep == 'STEP_8') {
    if (validCedula.test(respuesta)) {
      dataClient.Cedula = respuesta
      step = 'STEP_8_0';
    } else {
      step = 'STEP_8';
    }
  }

  if (lastStep == 'STEP_8_0') {
    dataClient.first_name = respuesta
    step = 'STEP_8_1';
  }

  if (lastStep == 'STEP_8_1') {
    dataClient.nombre2 = respuesta
    step = 'STEP_8_2';
  }

  if (lastStep == 'STEP_8_2') {
    dataClient.last_name = respuesta
    step = 'STEP_8_3';
  }

  if (lastStep == 'STEP_8_3') {
    dataClient.apellido2 = respuesta
    step = 'STEP_8_4';
  }

  if (lastStep == 'STEP_8_4') {
    if (validEmail.test(respuesta)) {
      dataClient.email = respuesta
      dataClient.Tracking = 'Datos Cliente'
      trackClientify(dataClient);
      step = 'STEP_8_5';
    } else {
      step = 'STEP_8_4';
    }
  }

  if (lastStep == 'STEP_8_5') {
    if (isNaN(respuesta)) {
      step = 'STEP_8_5';
    } else {
      const resp = parseInt(respuesta)
      if (resp < 1 || resp > 2) step = 'STEP_8_5';
      else {
        dataClient.Genero = respuesta == "1" ? "M" : "H"
        trackClientify(dataClient);
        step = 'STEP_8_6';
      }
    }
  }

  if (lastStep == 'STEP_8_6') {
    if (validDate.test(respuesta)) {
      dataClient.fec_nac = respuesta
      trackClientify(dataClient);
      step = 'STEP_8_7';
    } else {
      step = 'STEP_8_6';
    }
  }

  if (lastStep == 'STEP_8_7') {
    if (isNaN(respuesta)) {
      step = 'STEP_8_7';
    } else {
      const resp = parseInt(respuesta)
      if (resp < 1 || resp > 2) step = 'STEP_8_7';
      else {
        dataClient.nacional = respuesta == "1" ? "Panameño" : "Extranjero"
        trackClientify(dataClient);
        step = 'STEP_8_8';
      }
    }
  }

  if (lastStep == 'STEP_8_8') {
    if (isNaN(respuesta)) {
      step = 'STEP_8_8';
    } else {
      const resp = parseInt(respuesta)
      if (resp < 1) step = 'STEP_8_8';
      else {
        dataClient.peso = respuesta
        step = 'STEP_8_9';
      }
    }
  }

  if (lastStep == 'STEP_8_9') {
    if (isNaN(respuesta)) {
      step = 'STEP_8_9';
    } else {
      const resp = parseInt(respuesta)
      if (resp < 1) step = 'STEP_8_9';
      else {
        dataClient.estatura = respuesta
        step = 'STEP_9';
      }
    }
  }

  if (lastStep == 'STEP_9') {
    if (isNaN(respuesta)) {
      step = 'STEP_9';
    } else {
      const resp = parseInt(respuesta)
      if (resp < 1) step = 'STEP_9';
      else {
        dataClient.Tracking = 'Ingresos'
        dataClient.salario = respuesta
        step = 'STEP_9_1';
      }
    }
  }
  if (lastStep == 'STEP_9_1') {
    if (isNaN(respuesta)) {
      step = 'STEP_9_1';
    } else {
      const resp = parseInt(respuesta)
      if (resp < 0) step = 'STEP_9_1';
      else {
        dataClient.hProfesion = respuesta
        step = 'STEP_9_2';
      }
    }
  }

  if (lastStep == 'STEP_9_2') {
    if (isNaN(respuesta)) {
      step = 'STEP_9_2';
    } else {
      const resp = parseInt(respuesta)
      if (resp < 0) step = 'STEP_9_2';
      else {
        dataClient.viaticos = respuesta
        step = 'STEP_10';
      }
    }
  }

  if (lastStep == 'STEP_10') {
    dataClient.viaticos = respuesta
    step = 'STEP_11';
  }

  if (lastStep == 'STEP_11') {
    step = 'STEP_12';
  }

  if (lastStep == 'STEP_12') {
    if (isNaN(respuesta)) {
      step = 'STEP_12';
    } else {
      const resp = parseInt(respuesta)
      if (resp < 1 || resp > 6) step = 'STEP_12';
      else {
        let resp = '0'
        if (respuesta == '1') resp = '0'
        if (respuesta == '2') resp = '1'
        if (respuesta == '3') resp = '2'
        if (respuesta == '4') resp = '3'
        if (respuesta == '5') resp = '4'
        if (respuesta == '6') resp = '5'
        dataClient.proposito = respuesta
        step = 'STEP_13';
      }
    }
  }

  if (lastStep == 'STEP_13') {
    if (isNaN(respuesta)) {
      step = 'STEP_13';
    } else {
      const resp = parseInt(respuesta)
      if (resp < 1 || resp > 5) step = 'STEP_13';
      else {
        dataClient.estadoCivil = respuesta
        step = 'STEP_14';
      }
    }
  }

  if (lastStep == 'STEP_14') {
    step = 'STEP_14_1';
  }
  if (lastStep == 'STEP_14_1') {
    step = 'STEP_14_2';
  }
  if (lastStep == 'STEP_14_2') {
    step = 'STEP_14_3';
  }
  if (lastStep == 'STEP_14_3') {
    step = 'STEP_14_4';
  }
  if (lastStep == 'STEP_14_4') {
    step = 'STEP_15';
  }

  if (lastStep == 'STEP_15') {
    if (respuesta.length > 2 && respuesta.length < 100) {
      dataClient.calle = respuesta
      step = 'STEP_15_1';
    } else {
      step = 'STEP_15';
    }
  }
  if (lastStep == 'STEP_15_1') {
    if (respuesta.length > 2 && respuesta.length < 60) {
      dataClient.barriada = respuesta
      step = 'STEP_15_2';
    } else {
      step = 'STEP_15_1';
    }
  }
  if (lastStep == 'STEP_15_2') {
    if (respuesta.length > 2 && respuesta.length < 20) {
      dataClient.casaApto = respuesta
      step = 'STEP_15_3';
    } else {
      step = 'STEP_15_2';
    }
  }
  if (lastStep == 'STEP_15_3') {
    if (validPhone.test(respuesta)) {
      dataClient.telefonoCasa = respuesta
      step = 'STEP_16';
    } else {
      step = 'STEP_15_3';
    }
  }

  if (lastStep == 'STEP_16') {
    if (respuesta.length > 2 && respuesta.length < 100) {
      dataClient.lugarTrabajo = respuesta
      step = 'STEP_16_1';
    } else {
      step = 'STEP_16';
    }
  }
  if (lastStep == 'STEP_16_1') {
    if (respuesta.length > 2 && respuesta.length < 60) {
      dataClient.wrkCargo = respuesta
      step = 'STEP_16_2';
    } else {
      step = 'STEP_16_1';
    }
  }
  if (lastStep == 'STEP_16_2') {
    if (respuesta.length > 2 && respuesta.length < 60) {
      dataClient.wrkDireccion = respuesta
      step = 'STEP_16_3';
    } else {
      step = 'STEP_16_2';
    }
  }
  if (lastStep == 'STEP_16_3') {
    if (validPhone.test(respuesta)) {
      dataClient.wrkTelefono = respuesta
      step = 'STEP_16_4';
    } else {
      step = 'STEP_16_3';
    }
  }
  if (lastStep == 'STEP_16_4') {
    dataClient.wrkTelefonoExt = respuesta
    step = 'STEP_16_5';
  }
  if (lastStep == 'STEP_16_5') {
    if (respuesta.length > 2 && respuesta.length < 60) {
      dataClient.wrkEmpleoAnterior = respuesta
      step = 'STEP_16_6';
    } else {
      step = 'STEP_16_5';
    }
  }
  if (lastStep == 'STEP_16_6') {
    if (isNaN(respuesta)) {
      step = 'STEP_16_6';
    } else {
      const resp = parseInt(respuesta)
      if (resp < 1 || resp > 5) step = 'STEP_16_6';
      else {
        dataClient.wrkSalarioEA = respuesta
        step = 'STEP_17';
      }
    }
  }

  if (lastStep == 'STEP_17') {
    if (respuesta.length > 2 && respuesta.length < 61) {
      dataClient.refPerFNombres = respuesta
      step = 'STEP_17_1';
    } else {
      step = 'STEP_17';
    }
  }
  if (lastStep == 'STEP_17_1') {
    if (respuesta.length > 2 && respuesta.length < 61) {
      dataClient.refPerFApellidos = respuesta
      step = 'STEP_17_2';
    } else {
      step = 'STEP_17_1';
    }
  }
  if (lastStep == 'STEP_17_2') {
    if (respuesta.length > 2 && respuesta.length < 11) {
      dataClient.refPerFParentesco = respuesta
      step = 'STEP_17_3';
    } else {
      step = 'STEP_17_3';
    }
    step = 'STEP_17_2';
  }
  if (lastStep == 'STEP_17_3') {
    if (validCell.test(respuesta)) {
      dataClient.refPerFCell = respuesta
      step = 'STEP_17_4';
    } else {
      step = 'STEP_17_3';
    }
  }
  if (lastStep == 'STEP_17_4') {
    if (respuesta.length > 2 && respuesta.length < 101) {
      dataClient.refPerFTrabajo = respuesta
      step = 'STEP_18';
    } else {
      step = 'STEP_17_4';
    }
  }

  if (lastStep == 'STEP_18') {
    if (respuesta.length > 2 && respuesta.length < 61) {
      dataClient.refPerNFNombres = respuesta
      step = 'STEP_18_1';
    } else {
      step = 'STEP_18';
    }
  }
  if (lastStep == 'STEP_18_1') {
    if (respuesta.length > 2 && respuesta.length < 61) {
      dataClient.refPerNFApellidos = respuesta
      step = 'STEP_18_2';
    } else {
      step = 'STEP_18_1';
    }
  }
  if (lastStep == 'STEP_18_2') {
    if (validCell.test(respuesta)) {
      dataClient.refPerNFCell = respuesta
      step = 'STEP_18_3';
    } else {
      step = 'STEP_18_2';
    }
  }
  if (lastStep == 'STEP_18_3') {
    if (respuesta.length > 2 && respuesta.length < 101) {
      dataClient.refPerNFTrabajo = respuesta
      step = 'STEP_19';
    } else {
      step = 'STEP_18_3';
    }
  }

  if (lastStep == 'STEP_19') {
    step = 'STEP_20';
  }

  if (lastStep == 'STEP_20') {
    step = 'STEP_21';
  }

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
 * Generamos un QRCODE para iniciar sesion
 */
const withOutSession = () => {
  console.log([
    '🙌 Ten paciencia se esta generando el QR CODE',
    '________________________',
  ].join('\n'));

  client = new Client(createClient());

  client.on('qr', qr => generateImage(qr, () => {
    qrcode.generate(qr, { small: true });
    console.log(`Ver QR http://localhost:${port}/qr`)
    socketEvents.sendQR(qr)
  }))

  client.on('ready', async () => {
    connectionReady()
    listenMessage()
    // socketEvents.sendStatus(client)
  });

  client.initialize();
}

withOutSession();


/**
 * Verificamos si tienes un gesto de db
 */

if (process.env.DATABASE === 'mysql') {
  mysqlConnection.connect()
}

const token = async () => {
  try {
    await axios.get(`http://localhost:3000/clientify-token`)
      .then(res => {
        tokenClientify = res.data
        console.log('tokenClientify', tokenClientify)
        dataClient.token = tokenClientify
      }).catch((err) => {
        tokenClientify = 'N/A'
        console.log('tokenClientify', err)
      })
    if (tokenClientify === undefined) tokenClientify = 'N/A'
  } catch (error) {
    console.log(error)
  }
}
token();

const trackClientify = (data) => {
  data.ID = idClientify
  const URL = "http://localhost:3000/clientify"

  axios.post(URL, data)
    .then(async (res) => {
      const result = res.data
      console.log('Hola estoy por aqui-AAAAA', result.id)
      idClientify = result.id
    }).catch(error => {
      console.log('Hola estoy por aqui-BBBB', error)
    });
}

server.listen(port, () => {
  console.log(`El server esta listo por el puerto ${port}`);
})
checkEnvFile();
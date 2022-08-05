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
const appRoutes = require('./routes/appRoutes');
const fileRoutes = require('./routes/uploadFile');
const Opciones = require('./helpers/Opciones');

const app = express();
app.use(cors())
app.use(express.json())
app.use('/', require('./routes/web'))
app.use('/api', appRoutes)
app.use('/upload', fileRoutes)

const server = require('http').Server(app)
const port = process.env.PORT || 3000

const API_HOST = `http://localhost:${port}`

var client;
var respuesta;
var lastStep;
var idClientify = '';
var tokenClientify;
var dataClient = {};
var refpf = {}
var refpnf = {}
var opciones = {}

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
    dataClient.sector = respuesta
    switch (respuesta) {
      case "1":
        dataClient.sectorAb = 'P'
        console.log(respuesta)
        step = 'STEP_2_1';
        break;
      case "2":
        dataClient.sectorAb = 'Pb'
        step = 'STEP_2';
        break;
      case "3":
        dataClient.sectorAb = 'J'
        dataClient.profesion = '7';
        step = 'STEP_5';
        break;
      default:
        step = 'STEP_1';
        break;
    }
  }

  if (lastStep == 'STEP_2' || lastStep == 'STEP_2_1') {
    let resp = '0'
    let resp1 = ''
    if (respuesta == '1') { resp = '2'; resp1 = 'Médicos Enfermeras' }
    if (respuesta == '2') { resp = '3'; resp1 = 'Educador' }
    if (respuesta == '3' && lastStep == 'STEP_2') { resp = '4'; resp1 = 'Administrativo' }
    if (respuesta == '3' && lastStep == 'STEP_2_1') { resp = '1'; resp1 = 'EMpresa Privada' }
    if (respuesta == '4') { resp = '5'; resp1 = 'ACP' }
    if (respuesta == '5') { resp = '6'; resp1 = 'Seguridad Pública' }
    dataClient.profesion = resp;
    dataClient.nameProfesion = resp1;
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
    dataClient.historialCredito = respuesta == "1" ? true : false
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
    dataClient.frecuenciaPago = respuesta
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
        dataClient.Genero = respuesta == "1" ? "Mujer" : "Hombre"
        dataClient.genero = respuesta == "1" ? "female" : "male"
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
        dataClient.nationality = respuesta
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
        dataClient.hProfesional = respuesta
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
        const { sectorAb, genero, fec_nac, profesion, salario, historialCredito, frecuenciaPago, meses_trabajo_actual } = dataClient
        console.log(sectorAb, genero, fec_nac, profesion, salario, historialCredito, frecuenciaPago, meses_trabajo_actual)

        opciones = await Opciones({
          jobSector: sectorAb,
          gender: genero,
          birthDate: fec_nac,
          profession: profesion,
          wage: parseFloat(salario),
          creditHistory: historialCredito, 
          paymentFrecuency: parseInt(frecuenciaPago),
          currentJobMonths: parseInt(meses_trabajo_actual)
        })
        console.log(opciones)
    
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
    console.log(respuesta)
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
      dataClient.work_name = respuesta
      step = 'STEP_16_1';
    } else {
      step = 'STEP_16';
    }
  }
  if (lastStep == 'STEP_16_1') {
    if (respuesta.length > 2 && respuesta.length < 60) {
      dataClient.work_cargo = respuesta
      step = 'STEP_16_2';
    } else {
      step = 'STEP_16_1';
    }
  }
  if (lastStep == 'STEP_16_2') {
    if (respuesta.length > 2 && respuesta.length < 60) {
      dataClient.work_address = respuesta
      step = 'STEP_16_3';
    } else {
      step = 'STEP_16_2';
    }
  }
  if (lastStep == 'STEP_16_3') {
    if (validPhone.test(respuesta)) {
      dataClient.work_phone = respuesta
      step = 'STEP_16_4';
    } else {
      step = 'STEP_16_3';
    }
  }
  if (lastStep == 'STEP_16_4') {
    dataClient.work_phone_ext = respuesta
    step = 'STEP_16_5';
  }
  if (lastStep == 'STEP_16_5') {
    if (respuesta.length > 0 && respuesta.length < 60) {
      dataClient.work_prev_name = respuesta
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
      if (resp < 0) step = 'STEP_16_6';
      else {
        dataClient.work_prev_salary = respuesta
        step = 'STEP_17';
      }
    }
  }

  if (lastStep == 'STEP_17') {
    if (respuesta.length > 2 && respuesta.length < 61) {
      refpf.name = respuesta
      step = 'STEP_17_1';
    } else {
      step = 'STEP_17';
    }
  }
  if (lastStep == 'STEP_17_1') {
    if (respuesta.length > 2 && respuesta.length < 61) {
      refpf.apellido = respuesta
      step = 'STEP_17_2';
    } else {
      step = 'STEP_17_1';
    }
  }
  if (lastStep == 'STEP_17_2') {
    if (respuesta.length > 2 && respuesta.length < 11) {
      refpf.parentesco = respuesta
      step = 'STEP_17_3';
    } else {
      step = 'STEP_17_2';
    }
  }
  if (lastStep == 'STEP_17_3') {
    if (validCell.test(respuesta)) {
      refpf.cellphone = respuesta
      step = 'STEP_17_4';
    } else {
      step = 'STEP_17_3';
    }
  }
  if (lastStep == 'STEP_17_4') {
    if (respuesta.length > 2 && respuesta.length < 101) {
      refpf.work_name = respuesta
      step = 'STEP_18';
    } else {
      step = 'STEP_17_4';
    }
  }

  if (lastStep == 'STEP_18') {
    if (respuesta.length > 2 && respuesta.length < 61) {
      refpnf.name = respuesta
      step = 'STEP_18_1';
    } else {
      step = 'STEP_18';
    }
  }
  if (lastStep == 'STEP_18_1') {
    if (respuesta.length > 2 && respuesta.length < 61) {
      refpnf.apellido = respuesta
      step = 'STEP_18_2';
    } else {
      step = 'STEP_18_1';
    }
  }
  if (lastStep == 'STEP_18_2') {
    if (validCell.test(respuesta)) {
      refpnf.cellphone = respuesta
      step = 'STEP_18_3';
    } else {
      step = 'STEP_18_2';
    }
  }
  if (lastStep == 'STEP_18_3') {
    if (respuesta.length > 2 && respuesta.length < 101) {
      refpnf.work_name = respuesta
      step = 'STEP_19';
    } else {
      step = 'STEP_18_3';
    }
  }
  dataClient.refpf = refpf;
  dataClient.refpnf = refpnf;
  console.log(dataClient)

  if (lastStep == 'STEP_19') {
    step = 'STEP_20';
  }

  if (lastStep == 'STEP_20') {
    saveProspect(dataClient)
    step = 'STEP_21';
  }

  if (step) {
    let response = ''
    if (step == 'STEP_10' || step == 'STEP_11')
      response = await responseMessages(step, opciones);
    else response = await responseMessages(step);

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
    await axios.get(`${API_HOST}/api/clientify-token`)
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
  const URL = `${API_HOST}/api/clientify`

  axios.post(URL, data)
    .then(async (res) => {
      const result = res.data
      console.log('Hola estoy por aqui-AAAAA', result.id)
      idClientify = result.id
    }).catch(error => {
      console.log('Hola estoy por aqui-BBBB', error)
    });
}

//***************************************//
//***************************************//
//** Guarda Informacion del Prospecto  **//
//***************************************//
//***************************************//
const saveProspect = async (data) => {

  const { estadoCivil: maritalStatus, telefonoCasa: residentialNumber, province = 0, district = 0, prestAuto = 0, prestHip = 0, prestTC = 0 } = data
  const { Cedula: id, county = 0, calle: street, accept: aceptaAPC = true } = data
  const { barriada: barriada_edificio, casaApto: no_casa_piso_apto } = data
  const { work_name, work_cargo, work_address, meses_trabajo_actual, entity_f, work_phone, work_phone_ext = '' } = data
  const { work_prev_name, work_prev_salary = 0 } = data
  const { idUrl, socialSecurityProofUrl, publicGoodProofUrl, workLetterUrl, payStubUrl, apcReferencesUrl = 'N/A', apcLetterUrl = '' } = data

  body = {
    id_personal: id,
    phoneNumber: residentialNumber,
    civil_status: maritalStatus,
    idUrl, socialSecurityProofUrl, publicGoodProofUrl, workLetterUrl, payStubUrl, apcReferencesUrl, apcLetterUrl,
    province,
    district,
    county,
    street,
    barriada_edificio,
    no_casa_piso_apto,

    sign: '',
    loanAuto: prestAuto,
    loanTC: prestTC,
    loanHip: prestHip,

    work_name,
    work_cargo,
    work_address,
    work_phone,
    work_phone_ext,

    work_prev_name,
    work_prev_salary,

    aceptaAPC
  }

  let email2 = '', telefono = '', monto = '', name = '', banco = ''

  const { fec_nac: birthDate, contractType = 0, Genero, Sector, sector, occupation = 0, profession = 0, institution = 0, retirement = 0 } = data
  const { previousJobMonths: work_prev_month = 0, meses_trabajo_actual: work_month } = data
  const { salario: wage, hProfesional: alloance = 0, viaticos: perDiem = 0 } = data
  const { tipo_residencia: residenceType, mensualidad_casa: residenceMonthly = 0, frecuenciaPago: paymentFrecuency } = data
  const { weight = 0, weightUnit = 'Libra', height = 0, heightUnit = 'Metro' } = data
  const { bank, amount = 0, term = 0, reason = 0, cashOnHand = 0 } = data
  const { email, first_name: fname, nombre2: fname_2 = '', last_name: lname, apellido2: lname_2 = '', origin = '', idUser = '', cellphone = '' } = data
  const { terms_cond, nacional, nationality, refpf, refpnf } = data

  monto = amount
  telefono = cellphone
  email2 = email
  banco = bank

  name = fname + ' '
  if (fname_2) name += fname_2 + ' '
  name += lname + ' ' + lname_2
  let sponsor = "0"

  body = {
    ...body, estado: 1, email, name, lname, lname_2, fname, fname_2, origin_idUser: origin, entity_f,
    gender: Genero, birthDate, contractType,
    jobSector: sector,
    occupation, paymentFrecuency, profession, institution, retirement,
    residenceType, residenceMonthly, idUser, cellphone,
    loanPP: amount, cashOnHand, plazo: term, termConds: terms_cond ? 1 : 0, nationality,
    salary: wage, honorarios: alloance, viaticos: perDiem,
    weight, weightUnit, height, heightUnit,
    work_prev_month, work_month, agente: '0', reason, sponsor
  }

  axios.post(`${API_HOST}/api/prospects`, body)
    .then(async (res) => {
      const result = res.data
      console.log('Hola estoy por aqui-AAAAA', result.newId)
      newId = result.newId

      if (Object.keys(refpf).length) {

        // Info de Referencias personales Familiares
        body = {
          tipo: 1,
          id_prospect: newId,
          name: refpf.name || "",
          apellido: refpf.lastName || "",
          parentesco: refpf.relationship || "",
          cellphone: refpf.phoneNumber || "",
          phonenumber: refpf.residenceNumber || "",
          work_name: refpf.company || "",
          work_phonenumber: refpf.companyPhoneNumber || "",
          work_phone_ext: refpf.companyPhoneExtension || ""
        }

        axios.post(`${API_HOST}/api/ref_personales`, body)
      }

      if (Object.keys(refpnf).length) {

        // Info de Referencias personales NO Familiares
        body = {
          tipo: 0,
          id_prospect: newId,
          name: refpnf.name || "",
          apellido: refpnf.lastName || "",
          parentesco: refpf.relationship || "",
          cellphone: refpnf.phoneNumber || "",
          phonenumber: refpnf.residenceNumber || "",
          work_name: refpnf.company || "",
          work_phonenumber: refpnf.companyPhoneNumber || "",
          work_phone_ext: refpnf.companyPhoneExtension || ""
        }

        axios.post(`${API_HOST}/api/ref_personales`, body)
      }

      // Informacion para enviar correo electrónico
      body = {
        cedula: id,
        email: email2,
        asunto: "Solicitud de Préstamo de: >> " + name,
        mensaje: "Solicitud de Préstamo desde www.Finanservs.com",
        telefono: telefono,
        monto: monto,
        nombre: name,
        banco: banco,
      }

      axios.post(`${API_HOST}/api/email`, body)

      // saveTracking("Finanlizado!")
    })
    .catch(error => {
      console.log('Hola estoy por aqui-BBBB', error)
    });
}

// saveProspect(
//   {
//     token: '0cfbe97a236f2c62a97db9fe50b2367c63c33d08',
//     phone: '14132304211',
//     refpf: { 'name': 'Leonel', 'apellido': 'Rodriguez' },
//     refpnf: { 'name': 'nLeonel', 'apellido': 'nRodriguez' },
//     Sector: 'Privada',
//     sector: '1',
//     Profesion: '3',
//     nameProfesion: 'Educador',
//     contrato_laboral: '2',
//     meses_trabajo_actual: '165',
//     frecuenciaPago: '2',
//     tipo_residencia: '3',
//     mensualidad_casa: '320',
//     Cedula: '7-94-485',
//     first_name: 'leonel',
//     nombre2: 'l',
//     last_name: 'rodríguez',
//     apellido2: 'r',
//     email: 'dddd12@gmail.com',
//     Tracking: 'Ingresos',
//     ID: 30375696,
//     Genero: 'Hombre',
//     fec_nac: '12/04/1965',
//     nacional: 'Panameño',
//     peso: '160',
//     estatura: '1.78',
//     salario: '1550',
//     hProfesional: '0',
//     viaticos: '0',
//     proposito: '5',
//     estadoCivil: '1',
//     calle: 'aquilino tejeira',
//     barriada: 'ciudad radial',
//     casaApto: 'casa 17-1',
//     telefonoCasa: '234-5756',
//     work_name: 'mi casa',
//     work_cargo: 'own',
//     work_address: 'la gloria',
//     work_phone: '345-1234',
//     work_phone_ext: '.',
//     work_prev_name: 'no tengo',
//     work_prev_salary: '0',
//     entity_f: '700',
//     idUrl: 'N/A',
//     socialSecurityProofUrl: 'N/A',
//     publicGoodProofUrl: 'N/A',
//     workLetterUrl: 'N/A',
//     payStubUrl: 'N/A',
//     bank: '700'
//   }
// )


const enviarDatatoPdf = async (filename, id, ruta) => {

  let ext = 'jpeg'
  const extSplit = filename.split('.')
  if (extSplit.length) ext = extSplit.pop()

  const raw = {
    "fileName": filename,
    "entity_f": ruta,
    "prospect": id + "." + ext,
    "nameImage": "REFERENCIA-APC"
  }

  axios.post(`${API_HOST}/upload/file2a`, raw)
    .then(async (res) => {
      const result = res.data
      console.log(result.Location)
    })
    .catch((e) => {
      console.error(e);
    })
}

// const fileNamePath = `${__dirname}/media/1659133629434.jpeg`
// enviarDatatoPdf(fileNamePath, '7-94-485', '700')

// async function xxx(data) {
//   const opciones = await Opciones(data)
//   console.log(opciones)
// }
// xxx({
//   jobSector: 'Pb',
//   gender: 'male',
//   birthDate: '12/04/1965',
//   profession: 3,
//   wage: 1250,
//   creditHistory: true, paymentFrecuency: 2,
//   Edad: 56,
//   currentJobMonths: 120
// })

server.listen(port, () => {
  console.log(`El server esta listo por el puerto ${port}`);
})
checkEnvFile();
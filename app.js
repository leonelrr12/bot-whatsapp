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
const isValidFile = require('./helpers/isValidFile');


const app = express();
app.use(cors())
app.use(express.json())
app.use('/', require('./routes/web'))
app.use('/api', appRoutes)
app.use('/upload', fileRoutes)

const server = require('http').Server(app)
const port = process.env.PORT || 3000

const API_HOST = `http://localhost:${port}`

var message;
var respuesta;
var client;
var respuesta;
var lastStep = [];
var idClientify = '';
var tokenClientify;
var dataClient = {};
var refpf = {}
var refpnf = {}
var opciones = {}
var dirImageLocal = ''
var dirImageAWS = ''
var usuarioApc = process.env.APC_USER
var claveApc = process.env.APC_PASS
var IDPhone;

const validCedula = /^\d{1,2}(-|\s)\d{1,3}(-|\s)\d{1,4}$/
const validDate = /^\d{1,2}(\/|\s)\d{1,2}(\/|\s)\d{2,4}$/
const validEmail = /^[-\w.%+]{1,64}@(?:[A-Z0-9-]{1,63}\.){1,125}[A-Z]{2,63}$/i;
// const validPhone = /^\d{3}(-|\s)\d{4}$/
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

  message = body.toLowerCase()
  respuesta = message
  console.log('BODY', message)
  const numero = cleanNumber(from)
  await readChat(numero, message)
  IDPhone = numero.split('@')[0] //.slice(3)
  dataClient.phone = IDPhone

  const { LSTEP = "", LMSG = "", OUT = false } = lastStep[IDPhone] || ""
  if (OUT) {
    return // Corta comunicacion con el Bot
  }
  console.log(`Cell => ${IDPhone} | Lst.Step => ${LSTEP} | Lst.Msg => ${LMSG} | End ? => ${OUT}`)


  // VALORES POR DEFECTO QUE NO SERAN CAPTURADOS
  dataClient.tipo_residencia = '0'
  dataClient.mensualidad_casa = '0'
  dataClient.nacional = 'N/A'
  dataClient.peso = '0'
  dataClient.estatura = '0'
  dataClient.hProfesional = '0'
  dataClient.viaticos = '0'
  dataClient.calle = 'N/A'
  dataClient.barriada = 'N/A'
  dataClient.casaApto = 'N/A'
  dataClient.telefonoCasa = 'N/A'
  dataClient.work_name = 'N/A'
  dataClient.work_cargo = 'N/A'
  dataClient.work_address = 'N/A'
  dataClient.work_phone = 'N/A'
  dataClient.work_phone_ext = 'N/A'
  dataClient.work_prev_name = 'N/A'
  dataClient.work_prev_salary = '0'
  dataClient.entity_f = '125'
  dataClient.proposito = '0'
  dataClient.Profesion = 'N/A'
  dataClient.prestamo_opciones = {}
  dataClient.nameProfesion = 'N/A'
  dataClient.meses_trabajo_actual = 60

  /**
   * Guardamos el archivo multimedia que nos envia El Usuario
   */
  if (process.env.SAVE_MEDIA && hasMedia) {
    const media = await msg.downloadMedia();
    dirImageLocal = saveMedia(media);
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

  const pedirAsesor = () => {
    return "Rolando=Sanchez"
  }
  const verifyResponse = (Step, msg) => {
    return msg
  }

  if (LSTEP == 'STEP_1') {
    if (respuesta.toLowerCase() == 'x') {
      message = pedirAsesor()
    } else {
      dataClient.Sector = respuesta == '1' ? 'Privada' : (respuesta == '2' ? 'Publico' : 'Jubilado')
      dataClient.sector = respuesta
      switch (respuesta) {
        case "1":
          dataClient.sectorAb = 'P'
          message = "Privado"
          break;
        case "2":
          dataClient.sectorAb = 'Pb'
          message = "Público"
          break;
        case "3":
          dataClient.sectorAb = 'J'
          dataClient.profesion = '7'
          dataClient.nameProfesion = 'Jubilado'
          dataClient.historialCredito = true
          dataClient.frecuenciaPago = "2"
          dataClient.contrato_laboral = '2'
          dataClient.meses_trabajo_actual = 60
          message = "Jubilado"
          break;
        case "4":
          dataClient.sectorAb = 'Pb'
          message = "xIndependiente"
          break;
        default:
          message = verifyResponse(LSTEP, "Hola")
          break;
      }
    }
  }

  if (LSTEP == 'STEP_2' || LSTEP == 'STEP_2_1') {
    if (respuesta.toLowerCase() == 'x') {
      message = pedirAsesor()
    } else {
      if (isNaN(respuesta)) {
        message = verifyResponse(LSTEP, LMSG)
      } else {
        const resp = parseInt(respuesta)
        if (resp < 1 || resp > 5) message = verifyResponse(LSTEP, LMSG)
        else {
          let resp = '0'
          let resp1 = ''
          if (respuesta == '1') { resp = '2'; resp1 = 'Médicos Enfermeras' }
          if (respuesta == '2') { resp = '3'; resp1 = 'Educador' }
          if (respuesta == '3' && LSTEP == 'STEP_2') { resp = '4'; resp1 = 'Administrativo' }
          if (respuesta == '3' && LSTEP == 'STEP_2_1') { resp = '1'; resp1 = 'Empresa Privada' }
          if (respuesta == '4') { resp = '5'; resp1 = 'ACP' }
          if (respuesta == '5') { resp = '6'; resp1 = 'Seguridad Pública' }
          dataClient.profesion = resp;
          dataClient.nameProfesion = resp1;

          dataClient.historialCredito = true;
          dataClient.frecuenciaPago = "2";

          if (LSTEP == 'STEP_2') {
            if (respuesta == 1) message = "GMedico/Enfermera"
            if (respuesta == 2) message = "GEducador"
            if (respuesta == 3) message = "GAdministrativo"
            if (respuesta == 4) message = "GACP"
            if (respuesta == 5) message = "GSeguridad Publica"
          }
          if (LSTEP == 'STEP_2_1') {
            if (respuesta == 1) message = "Medico/Enfermera"
            if (respuesta == 2) message = "Educador"
            if (respuesta == 3) message = "Empresa Privada"
          }
        }
      }
    }
  }

  if (LSTEP == 'STEP_3') {
    switch (respuesta) {
      case "1":
      case "3":
        message = verifyResponse(LSTEP, LMSG)
        break;
      default:
        break;
    }
    dataClient.contrato_laboral = respuesta

    if (respuesta == 1) message = "Temporal"
    if (respuesta == 2) message = "Permanente"
    if (respuesta == 3) message = "Servicio Profesional"
  }

  if (LSTEP == 'STEP_4') {
    if (isNaN(respuesta)) {
      message = verifyResponse(LSTEP, LMSG)
    } else {
      if (parseInt(respuesta) <= 0) message = verifyResponse(LSTEP, LMSG)
      else {
        // Aqui se puede agregar mas logica para validar cantidad de meses
        dataClient.meses_trabajo_actual = respuesta
        message = "Meses Laborando"
      }
    }
  }

  if (LSTEP == 'STEP_8a') {
    if (isNaN(respuesta)) {
      message = verifyResponse(LSTEP, LMSG)
    } else {
      const resp = parseInt(respuesta)
      if (resp < 1 || resp > 2) message = verifyResponse(LSTEP, LMSG)
      else {
        dataClient.termConds = respuesta == "1" ? "Si" : "No"
        if (respuesta == "1") {
          dataClient.prestamo_opciones = {}
          dataClient.Tracking = "BOT-Terminos y Condiciones"
          trackClientify(dataClient);
          message = "Acepta TyC"
        } else {
          message = "No Acepta TyC"
        }
      }
    }
  }
  if (LSTEP == 'STEP_8b') {
    // Reinicia dialogo
    message = "Hola"
    lastStep[IDPhone] = {}
  }
  if (LSTEP == 'STEP_8') {
    if (validCedula.test(respuesta)) {
      dataClient.Cedula = respuesta
      message = "Cedula"
    } else {
      message = verifyResponse(LSTEP, LMSG)
    }
  }
  if (LSTEP == 'STEP_8_0') {
    dataClient.first_name = respuesta.toUpperCase()
    message = "Nombre"
  }
  if (LSTEP == 'STEP_8_2') {
    dataClient.last_name = respuesta.toUpperCase()
    message = "Apellido"
  }
  if (LSTEP == 'STEP_8_4') {
    if (validEmail.test(respuesta)) {
      dataClient.email = respuesta
      dataClient.Tracking = 'BOT-Datos Cliente'
      trackClientify(dataClient);
      message = "Email"
    } else {
      message = verifyResponse(LSTEP, LMSG)
    }
  }
  if (LSTEP == 'STEP_8_5') {
    if (isNaN(respuesta)) {
      message = verifyResponse(LSTEP, LMSG)
    } else {
      const resp = parseInt(respuesta)
      if (resp < 1 || resp > 2) message = verifyResponse(LSTEP, LMSG)
      else {
        dataClient.Genero = respuesta == "1" ? "Mujer" : "Hombre"
        dataClient.genero = respuesta == "1" ? "female" : "male"
        dataClient.Tracking = 'BOT-Datos Genero'
        trackClientify(dataClient);
        message = "Genero"
      }
    }
  }
  if (LSTEP == 'STEP_8_6') {
    if (validDate.test(respuesta)) {
      dataClient.fec_nac = respuesta
      trackClientify(dataClient);
      message = "FecNac"
    } else {
      message = verifyResponse(LSTEP, LMSG)
    }
  }

  if (LSTEP == 'STEP_9') {
    if (isNaN(respuesta)) {
      message = verifyResponse(LSTEP, LMSG)
    } else {
      const resp = parseInt(respuesta)
      if (resp < 1) message = verifyResponse(LSTEP, LMSG)
      else {
        dataClient.salario = respuesta

        console.log(dataClient)
        const { sector, sectorAb, genero, fec_nac, profesion, salario, historialCredito = 1, frecuenciaPago = 1, meses_trabajo_actual = 60 } = dataClient
        // console.log(sector, sectorAb, genero, fec_nac, profesion, salario, historialCredito, frecuenciaPago, meses_trabajo_actual)

        opciones = await Opciones({
          jobSector: sectorAb,
          sector: sector,
          gender: genero,
          birthDate: fec_nac,
          profession: profesion,
          wage: parseFloat(salario),
          creditHistory: historialCredito,
          paymentFrecuency: parseInt(frecuenciaPago),
          currentJobMonths: parseInt(meses_trabajo_actual)
        })
        //console.log(opciones)

        dataClient.prestamo_opciones = opciones
        dataClient.Tracking = 'BOT-Opciones Disponibles'
        trackClientify(dataClient);
        message = "Salario"
      }
    }
  }

  if (LSTEP == 'STEP_10') {
    const { Loans } = opciones
    if (Loans.length) {
      message = "OpcionesLoan"
    } else {
      lastStep[IDPhone] = {}
      message = "Hola"
    }
  }

  if (LSTEP == 'STEP_11') {
    if (isNaN(respuesta)) {
      message = verifyResponse(LSTEP, LMSG)
    } else {
      const { Loans } = opciones
      console.log(Loans)
      const resp = parseInt(respuesta)
      if (resp < 1 || resp > Loans.length) message = verifyResponse(LSTEP, LMSG)
      else {
        const Loan = Loans[resp - 1]
        dataClient.entity_f = Loan.bank
        dataClient.loanPP = Loan.loan
        dataClient.monthlyPay = Loan.monthlyFee
        dataClient.cashOnHand = Loan.cashOnHand
        dataClient.plazo = Loan.term

        dataClient.Tracking = 'BOT-Datos Seleccion'
        trackClientify(dataClient);
        message = "Propósito"
      }
    }
  }

  if (LSTEP == 'STEP_12') {
    if (respuesta == 1) message = "Compra de Auto"
    if (respuesta == 2) message = "Boda"
    if (respuesta == 3) message = "Remodelación"
    if (respuesta == 4) message = "Colegio"
    if (respuesta == 5) message = "Viaje"
    if (respuesta == 6) message = "Quince Año"
  }

  if (LSTEP == 'STEP_13') {
    if (isNaN(respuesta)) {
      message = verifyResponse(LSTEP, LMSG)
    } else {
      const resp = parseInt(respuesta)
      if (resp < 1 || resp > 5) message = verifyResponse(LSTEP, LMSG)
      else {
        dataClient.estadoCivil = respuesta
        message = "EstadoCivil"
        if (respuesta == 1) message = "Casado"
        if (respuesta == 2) message = "Soltero"
        if (respuesta == 3) message = "Unido"
        if (respuesta == 4) message = "Divorciado"
        if (respuesta == 5) message = "Viudo"
      }
    }
  }

  if (LSTEP == 'STEP_14') {
    dataClient.Tracking = 'BOT-Subir Documentos'

    if (isValidFile(dirImageLocal)) {
      trackClientify(dataClient);
      dirImageAWS = await enviarDatatoPdf(dirImageLocal, dataClient.Cedula, dataClient.entity_f, 'CEDULA') || 'N/A'
      dataClient.idUrl = dirImageAWS
      message = "imgCedula"
      dirImageLocal = ''
    } else message = verifyResponse(LSTEP, LMSG)
  }
  if (LSTEP == 'STEP_14_1') {
    if (isValidFile(dirImageLocal)) {
      dirImageAWS = await enviarDatatoPdf(dirImageLocal, dataClient.Cedula, dataClient.entity_f, 'COMP-PAGO') || 'N/A'
      dataClient.payStubUrl = dirImageAWS
      message = "imgComp-pago"
      dirImageLocal = ''
    } else message = verifyResponse(LSTEP, LMSG)
  }
  if (LSTEP == 'STEP_14_2') {
    if (isValidFile(dirImageLocal)) {
      dirImageAWS = await enviarDatatoPdf(dirImageLocal, dataClient.Cedula, dataClient.entity_f, 'FICHA-SS') || 'N/A'
      dataClient.socialSecurityProofUrl = dirImageAWS
      message = "imgFicha-css"
      dirImageLocal = ''
    } else message = verifyResponse(LSTEP, LMSG)
  }
  if (LSTEP == 'STEP_14_3') {
    if (respuesta.toLowerCase() == 'x') {
      message = "imgServ-publico"
      dirImageLocal = ''
    } else {
      if (isValidFile(dirImageLocal)) {
        dirImageAWS = await enviarDatatoPdf(dirImageLocal, dataClient.Cedula, dataClient.entity_f, 'SERV-PUBLICO') || 'N/A'
        dataClient.publicGoodProofUrl = dirImageAWS
        message = "imgServ-publico"
        dirImageLocal = ''
      } else message = verifyResponse(LSTEP, LMSG)
    }
  }
  if (LSTEP == 'STEP_14_4') {
    if (respuesta.toLowerCase() == 'x') {
      message = "imgCarta-trabajo"
      dirImageLocal = ''
    } else {
      if (isValidFile(dirImageLocal)) {
        dirImageAWS = await enviarDatatoPdf(dirImageLocal, dataClient.Cedula, dataClient.entity_f, 'CARTA-TRABAJO') || 'N/A'
        dataClient.workLetterUrl = dirImageAWS
        message = "imgCarta-trabajo"
        dirImageLocal = ''
      } else message = verifyResponse(LSTEP, LMSG)
    }
  }

  if (LSTEP == 'STEP_17') {
    if (respuesta.length > 2 && respuesta.length < 61) {
      refpf.name = respuesta.toUpperCase()
      dataClient.Tracking = 'BOT-Referencias Personales'
      trackClientify(dataClient);
      message = "RefPFNombre"
    } else {
      message = verifyResponse(LSTEP, LMSG)
    }
  }
  if (LSTEP == 'STEP_17_1') {
    if (respuesta.length > 2 && respuesta.length < 61) {
      refpf.apellido = respuesta.toUpperCase()
      message = "RefPFApellido"
    } else {
      message = verifyResponse(LSTEP, LMSG)
    }
  }
  if (LSTEP == 'STEP_17_2') {
    if (respuesta.length > 2 && respuesta.length < 11) {
      refpf.parentesco = respuesta.toUpperCase()
      message = "RefPFParentesco"
    } else {
      message = verifyResponse(LSTEP, LMSG)
    }
  }
  if (LSTEP == 'STEP_17_3') {
    if (validCell.test(respuesta)) {
      refpf.cellphone = respuesta
      message = "RefPFCellphone"
    } else {
      message = verifyResponse(LSTEP, LMSG)
    }
  }

  if (LSTEP == 'STEP_18') {
    if (respuesta.length > 2 && respuesta.length < 61) {
      refpnf.name = respuesta.toUpperCase()
      message = "RefPNFNombre"
    } else {
      message = verifyResponse(LSTEP, LMSG)
    }
  }
  if (LSTEP == 'STEP_18_1') {
    if (respuesta.length > 2 && respuesta.length < 61) {
      refpnf.apellido = respuesta.toUpperCase()
      message = "RefPNFApellido"
    } else {
      message = verifyResponse(LSTEP, LMSG)
    }
  }
  if (LSTEP == 'STEP_18_2') {
    if (validCell.test(respuesta)) {
      refpnf.cellphone = respuesta
      message = "RefPNFCellphone"
    } else {
      message = verifyResponse(LSTEP, LMSG)
    }
  }

  dataClient.refpf = refpf;
  dataClient.refpnf = refpnf;

  if (LSTEP == 'STEP_19') {
    if (isValidFile(dirImageLocal)) {
      console.log('dirImageLocal', dirImageLocal)
      message = "AuthRefAPC"
    } else message = verifyResponse(LSTEP, LMSG)
  }

  if (LSTEP == 'STEP_20') {
    dataClient.Cedula = process.env.APC_Cedula || dataClient.Cedula
    await refAPC(dataClient.Cedula)
    const dirImageRF = await createPDFRefApc(dataClient.Cedula)
    console.log('dirImageRF', dirImageRF)
    dataClient.apcReferenceUrl = await enviarDatatoPdf(dirImageRF, dataClient.Cedula, dataClient.entity_f, 'REFERENCIA-APC') || 'N/A'

    const dirImageCA = await authApcPDF({ "nombre": dataClient.first_name + " " + dataClient.last_name, "cedula": dataClient.Cedula, "dirFile": dirImageLocal })
    console.log('dirImageCA', dirImageCA)
    dataClient.apcLetterUrl = await enviarDatatoPdf(dirImageCA, dataClient.Cedula, dataClient.entity_f, 'CARTA-APC') || 'N/A'

    saveProspect(dataClient)
    dataClient.Tracking = 'BOT-Proceso Terminado'
    trackClientify(dataClient);

    message = "RefAPC"
    lastStep[IDPhone] = { "OUT": true }
  }

  if (LSTEP == 'STEP_1_1') {
    lastStep[IDPhone] = { "OUT": true }
    return
  }

  let step = await getMessages(message)

  if (step) {
    console.log('Resp: ', respuesta, step, message)

    // SOLO PARA PRUEBAS RAPIDAS 
    // if(step == 'STEP_3') {
    //   console.log(dataClient)
    //   opciones = await Opciones({
    //     jobSector: dataClient.sectorAb,
    //     sector: dataClient.sector,
    //     gender: 'male',
    //     birthDate: '1994-01-19',
    //     profession: dataClient.profesion,
    //     wage: 1250,
    //     creditHistory: dataClient.historialCredito,
    //     paymentFrecuency: parseInt(dataClient.frecuenciaPago),
    //     currentJobMonths: parseInt(dataClient.meses_trabajo_actual)
    //   })
    //   lastStep[IDPhone] = { "OUT": true }
    //   message='Hola'
    // }

    let response = ''
    if (step == 'STEP_10' || step == 'STEP_11')
      response = await responseMessages(step, opciones)
    else response = await responseMessages(step)

    await sendMessage(client, from, response.replyMessage, response.trigger)
    if (response.hasOwnProperty('actions')) {
      const { actions } = response
      await sendMessageButton(client, from, null, actions)
      lastStep[IDPhone] = { "LSTEP": step, "LMSG": message }
      return
    }

    if (!response.delay && response.media) {
      sendMedia(client, from, response.media)
    }
    if (response.delay && response.media) {
      setTimeout(() => {
        sendMedia(client, from, response.media)
      }, response.delay)
    }
    lastStep[IDPhone] = { "LSTEP": step, "LMSG": message }
    return
  }

  lastStep[IDPhone] = { "LSTEP": step, "LMSG": message }
  if (respuesta.toLowerCase() == 'x' || LSTEP == 'STEP_1_1') {
    lastStep[IDPhone] = { "OUT": true }
  }
  const { OUT: outBot } = lastStep[IDPhone]

  //Si quieres tener un mensaje por defecto
  if (process.env.DEFAULT_MESSAGE === 'true' && !outBot) {
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

  console.log('DATA', data)

  const { estadoCivil: maritalStatus, telefonoCasa: residentialNumber, province = 0, district = 0, prestAuto = 0, prestHip = 0, prestTC = 0 } = data
  const { Cedula: id, county = 0, calle: street, accept: aceptaAPC = true } = data
  const { barriada: barriada_edificio, casaApto: no_casa_piso_apto } = data
  const { work_name, work_cargo, work_address, work_phone, work_phone_ext = '' } = data
  const { work_prev_name, work_prev_salary = 0 } = data
  const { idUrl, socialSecurityProofUrl, publicGoodProofUrl, workLetterUrl, payStubUrl, apcReferenceUrl = 'N/A', apcLetterUrl = 'N/A' } = data
  const { fec_nac: birthDate, contractType = 0, genero, sector, occupation = 0, profesion: profession = 0, institution = 0, retirement = 0 } = data
  const { previousJobMonths: work_prev_month = 0, meses_trabajo_actual: work_month } = data
  const { salario: wage, hProfesional: alloance = 0, viaticos: perDiem = 0 } = data
  const { tipo_residencia: residenceType, mensualidad_casa: residenceMonthly = 0, frecuenciaPago: paymentFrecuency } = data
  const { weight = 0, weightUnit = 'lb', height = 0, heightUnit = 'mts' } = data
  const { entity_f, proposito: reason = 0 } = data
  const { email, first_name: fname, nombre2: fname_2 = '', last_name: lname, apellido2: lname_2 = '', origin = 'bot', idUser = '', phone: cellphone = '' } = data
  const { termConds, nationality, refpf, refpnf, prestamo_opciones } = data

  body = {
    id_personal: id,
    phoneNumber: residentialNumber,
    civil_status: maritalStatus,
    idUrl, socialSecurityProofUrl, publicGoodProofUrl, workLetterUrl, payStubUrl, apcReferenceUrl, apcLetterUrl,
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

  let email2 = '', telefono = '', name = '', banco = ''
  let { monto_max: monto = 0, term_max2: term = 0, cashOnHand_max2: cashOnHand = 0, monthlyFee_max: monthlyPay = 0, Loans = [] } = prestamo_opciones
  let amount = monto
  monto = 0

  telefono = cellphone
  email2 = email
  banco = entity_f

  name = fname + ' '
  if (fname_2) name += fname_2 + ' '
  name += lname + ' ' + lname_2
  let sponsor = "0"

  body = {
    ...body, estado: 1, email, name, lname, lname_2, fname, fname_2, origin_idUser: origin, entity_f,
    gender: genero, birthDate, contractType,
    jobSector: sector,
    occupation, paymentFrecuency, profession, institution, retirement,
    residenceType, residenceMonthly, idUser, cellphone, termConds: termConds ? 1 : 0, nationality,
    loanPP: monto, cashOnHand, plazo: term, monthlyPay,
    salary: wage, honorarios: alloance, viaticos: perDiem,
    weight, weightUnit, height, heightUnit,
    work_prev_month, work_month, agente: '0', reason, sponsor, Loans
  }

  axios.post(`${API_HOST}/api/prospects`, body)
    .then(async (res) => {
      const result = res.data
      console.log('Hola estoy por aqui-AAAAA', result.newId)
      newId = result.newId

      if (Object.keys(refpf).length) {

        // Info de Referencias personales Familiares
        let body = {
          tipo: 1,
          id_prospect: newId,
          name: refpf.name || "",
          apellido: refpf.apellido || "",
          parentesco: refpf.parentesco || "",
          cellphone: refpf.cellphone || ""
        }

        axios.post(`${API_HOST}/api/ref_personales`, body)
      }

      if (Object.keys(refpnf).length) {

        // Info de Referencias personales NO Familiares
        let body = {
          tipo: 0,
          id_prospect: newId,
          name: refpnf.name || "",
          apellido: refpnf.apellido || "",
          cellphone: refpnf.cellphone || "",
        }

        axios.post(`${API_HOST}/api/ref_personales`, body)
      }

      // Informacion para enviar correo electrónico
      body = {
        cedula: id,
        email: email2,
        asunto: "Solicitud de Préstamo de: >> " + name,
        mensaje: "Solicitud de Préstamo desde www.Finanservs.com\n\n\t***NOTA:*** Estos son MONTOS aproximados.",
        telefono,
        monto: amount,
        nombre: name,
        banco,
      }

      axios.post(`${API_HOST}/api/email`, body)
    })
    .catch(error => {
      console.log('Hola estoy por aqui-BBBB', error)
    });
}


const enviarDatatoPdf = async (filename, id, ruta = '100', nameImage) => {

  return new Promise((resolve, reject) => {
    let ext = 'jpeg'
    const extSplit = filename.split('.')
    if (extSplit.length) ext = extSplit.pop()

    const raw = {
      "fileName": filename,
      "entity_f": ruta,
      "prospect": id + "." + ext,
      "nameImage": nameImage
    }

    axios.post(`${API_HOST}/upload/file2a`, raw)
      .then(async (res) => {
        const result = res.data
        resolve(result.Location)
      })
      .catch((e) => {
        console.error(e);
      })
  })
}


const refAPC = (cedula) => {

  return new Promise((resolve, reject) => {
    const raw = {
      "usuarioApc": usuarioApc,
      "claveApc": claveApc,
      "id": cedula,
      "tipoCliente": "1",
      "productoApc": "1",
      "idMongo": ""
    }

    axios.post(`${API_HOST}/api/APC`, raw)
      .then(async (res) => {
        const result = res.data
        console.log(result)
        resolve(result)
      })
      .catch((e) => {
        console.error(e);
      })
  })
}


const createPDFRefApc = (cedula) => {

  return new Promise((resolve, reject) => {
    axios.post(`${API_HOST}/upload/createPDF`, { "cedula": cedula })
      .then(async (res) => {
        const result = await res.data
        resolve(result.fileName)
      })
      .catch((e) => {
        console.error(e);
      })
  })
}


const authApcPDF = ({ nombre, cedula, dirFile }) => {

  return new Promise((resolve, reject) => {
    axios.post(`${API_HOST}/upload/authApcPDF`, { "nombre": nombre, "cedula": cedula, "sign": dirFile })
      .then(async (res) => {
        const result = res.data
        resolve(result.fileName)
      })
      .catch((e) => {
        console.error(e);
      })
  })
}

server.listen(port, () => {
  console.log(`El server esta listo por el puerto ${port}`);
})
checkEnvFile();

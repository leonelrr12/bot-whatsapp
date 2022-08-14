require('dotenv').config()
const express = require('express');
const appRoutes = require('express').Router()
const mongoose = require('mongoose')
const Prospect = require('../models/Prospect')
const { google } = require('googleapis')
const OAuth2 = google.auth.OAuth2
const axios = require('axios');
const { connection } = require('../config/mysql')
const config = require('../utils/config')

// const { sendEmail: key } = config
const OAuth2Client = new OAuth2(
  process.env.clientId,
  process.env.clientSecret,
  process.env.redirectUri
)
OAuth2Client.setCredentials({
  refresh_token: process.env.refreshToken
})

appRoutes.get('/clientify-token', async (req, res) => {
  try {
    const result = await axios({
      method: "post",
      url: "https://api.clientify.net/v1/api-auth/obtain_token/",
      data: {
        "username": process.env.CF_USERNAME,
        "password": process.env.CF_PASSWORD
      },
      headers: {
        "Content-Type": "application/json"
      }
    })
    res.send(result.data.token);
    return result
  } catch (error) {
    console.log('error', error)
  }
})

appRoutes.post('/clientify', async (req, res) => {
  const { body } = req

  let { token, ID, Tracking, prestamo_opciones, termConds,
    first_name, last_name, email, phone, fecha_nacimiento='1900-01-01', contrato_laboral,
    meses_trabajo_actual=0, meses_trabajo_anterior=0, Salario=0, Sector,
    nameProfesion, Genero='x', tipo_residencia='1', mensualidad_casa=0,
    donde_trabaja='N/A', Puesto='N/A', Cedula='N/A',
    provincia='N/A', distrito='N/A', street='N/A',
    idUrl='N/A',socialSecurityProofUrl='N/A',publicGoodProofUrl='N/A',workLetterUrl='N/A',payStubUrl='N/A',apcReferenceUrl='N/A',apcLetterUrl='N/A'
  } = body

  let { monto_max = 0, term_max = 0, monthlyFee_max = 0 } = prestamo_opciones

  const wDate = date => (date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate())

  raw = JSON.stringify({
    first_name,
    last_name,
    email,
    phone,
    "title": Puesto,
    "company": donde_trabaja,
    "birthday": wDate(new Date(fecha_nacimiento)),
    "google_id": "N/A",
    "facebook_id": "N/A",
    "addresses": [
      {
        "street": street,
        "city": distrito,
        "state": provincia,
        "country": "Panamá",
        "type": 5
      }
    ],
    "custom_fields": [
      { "field": "Tracking", "value": Tracking },
      { "field": "donde_trabaja", "value": donde_trabaja },
      { "field": "Puesto", "value": Puesto },
      {
        "field": "tipo_residencia", "value": tipo_residencia === '1' ? "Casa Propia" :
          tipo_residencia === '2' ? "Padres o Familiares" :
          tipo_residencia === '3' ? "Casa Hipotecada" : 
          tipo_residencia === '4' ? "Casa Alquilada" : "N/A"
      },
      { "field": "mensualidad_casa", "value": Number(mensualidad_casa) },
      { "field": "Cedula", "value": Cedula },

      { "field": "contrato_laboral", "value": contrato_laboral },
      { "field": "meses_trabajo_actual", "value": Number(meses_trabajo_actual) },
      { "field": "meses_trabajo_anterior", "value": Number(meses_trabajo_anterior) },
      { "field": "Salario", "value": Number(Salario) },
      { "field": "Sector", "value": Sector },
      { "field": "Profesion", "value": nameProfesion },
      { "field": "Genero", "value": Genero },

      { "field": "img_cedula", "value": idUrl },
      { "field": "img_servicio_publico", "value": publicGoodProofUrl },
      { "field": "img_ficha_css", "value": socialSecurityProofUrl },
      { "field": "img_carta_trabajo", "value": workLetterUrl },
      { "field": "img_comprobante_pago", "value": payStubUrl },
      { "field": "img_autoriza_apc", "value": apcLetterUrl },
      { "field": "img_referencias_apc2", "value": apcReferenceUrl },

      { "field": "acepta_terminos_condiciones", "value": termConds },
      { "field": "entidad_seleccionada", "value": "125" },
      { "field": "Monto", "value": monto_max },
      { "field": "Letra", "value": monthlyFee_max },
      { "field": "Plazo", "value": term_max },
      { "field": "Agente", "value": "0" }
    ]
  })

  const headers = {
    "Authorization": `Token ${token}`,
    "Content-Type": "application/json"
  }

  let post = "POST"
  if (ID) post = "PUT"

  const url = `https://api.clientify.net/v1/contacts/${ID}`
  axios({
    method: post,
    url,
    data: raw,
    headers: headers,
    redirect: 'follow'
  })
    .then(result => res.json(result.data))
    .catch(error => console.log('error', error))
})

appRoutes.post('/prospects', (req, res) => {
  const { body } = req;

  let sql = "INSERT INTO prospects ("
  sql += " id_personal,id_referido,idUser,name,fname,fname_2,lname,lname_2,"
  sql += " entity_f,estado,email,cellphone,phoneNumber,idUrl,socialSecurityProofUrl,"
  sql += " publicGoodProofUrl,workLetterUrl,payStubUrl,origin_idUser,gender,birthDate,"
  sql += " contractType,jobSector,occupation,profession,"
  sql += " paymentFrecuency,civil_status,province,district,county,sign,"
  sql += " loanPP,loanAuto,loanTC,loanHip,cashOnHand,plazo,monthlyPay,apcReferenceUrl,apcLetterUrl,"
  sql += " residenceType,residenceMonthly,work_name,work_cargo,work_address,work_phone,work_phone_ext,work_month,"
  sql += " work_prev_name,work_prev_month,work_prev_salary,"
  sql += " salary,honorarios,viaticos,termConds,"
  sql += " weight, weightUnit, height, heightUnit, aceptaApc, nationality,"
  sql += " calle, barriada_edificio,no_casa_piso_apto,id_agente,reason,quotation"

  sql += ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,"
  sql += "?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"

  let { id_personal, idUser, apcReferenceUrl, apcLetterUrl, sponsor, name, fname, fname_2, lname, lname_2 } = body
  let { entity_f, email, cellphone, phoneNumber, idUrl, socialSecurityProofUrl, publicGoodProofUrl } = body
  let { workLetterUrl, payStubUrl, origin_idUser, gender, birthDate: BDH, contractType, jobSector, occupation, profession } = body
  let { paymentFrecuency, civil_status, province, district, county, sign } = body
  let { street: calle, barriada_edificio, no_casa_piso_apto } = body
  let { loanPP, loanAuto, loanTC, loanHip, cashOnHand, plazo, monthlyPay, reason } = body
  let { residenceType, residenceMonthly, work_name, work_cargo, work_address = '', work_phone = '', work_phone_ext = '', work_month = 0 } = body
  let { work_prev_name = 'N/A', work_prev_month = 0, work_prev_salary = 0 } = body
  let { salary, honorarios = 0, viaticos = 0, termConds, nationality = 0 } = body
  let { weight, weightUnit, height, heightUnit, aceptaAPC: aceptaApc, agente, Loans } = body


  estado = 7 // Nuevo registro desde BOT

  const birthDate = BDH.split('/')[2] + '-' + BDH.split('/')[1] + '-' + BDH.split('/')[0]
  let quotation = JSON.stringify(Loans)

  const params = [
    id_personal, sponsor, idUser, name, fname, fname_2, lname, lname_2, entity_f, estado, email, cellphone,
    phoneNumber, idUrl, socialSecurityProofUrl, publicGoodProofUrl, workLetterUrl, payStubUrl, origin_idUser, gender,
    birthDate, contractType, jobSector, occupation, paymentFrecuency, profession, civil_status, province,
    district, county, sign, loanPP, loanAuto, loanTC, loanHip, cashOnHand, plazo, monthlyPay, apcReferenceUrl, apcLetterUrl,
    residenceType, residenceMonthly, work_name, work_cargo, work_address, work_phone, work_phone_ext, work_month,
    work_prev_name, work_prev_month, work_prev_salary,
    salary, honorarios, viaticos, termConds,
    weight, weightUnit, height, heightUnit, aceptaApc, nationality,
    calle, barriada_edificio, no_casa_piso_apto, agente, reason, quotation
  ]

  connection.query(sql, params, (error, results, next) => {
    if (error) {
      console.log('Error SQL:', error.sqlMessage)
      res.status(500)
    }
    console.log('results', results, results.insertId)
    // console.log({ newId: results.insertId })
    res.json({ newId: results.insertId })
  })
})

appRoutes.post('/ref_personales', (req, res) => {
  const { body } = req;

  let { tipo, name, id_prospect, apellido, parentesco='', cellphone, phonenumber='', work_name='', work_phonenumber='', work_phone_ext='' } = body

  let sql = "INSERT INTO ref_person_family ("
  if (tipo == "0") {
    sql = "INSERT INTO ref_person_no_family ("
  }
  sql += " name,id_prospect,apellido,parentesco,cellphone,phonenumber,work_name,work_phonenumber,work_phone_ext"
  sql += ") VALUES (?,?,?,?,?,?,?,?,?)"

  const params = [
    name, id_prospect, apellido, parentesco, cellphone, phonenumber, work_name, work_phonenumber, work_phone_ext
  ]

  // console.log(sql, params)

  connection.query(sql, params, (error, results, next) => {
    if (error) {
      console.log('Error SQL:', error.sqlMessage)
      res.status(500)
    }
    console.log('results',results)
    res.send('Ok!')
  })
})

appRoutes.post('/email', async (req, res) => {
  const { body } = req;

  console.log('mail', body);
  const { email: euser, asunto, mensaje, telefono, monto, nombre, banco, cedula } = body

  // let emails = null
  // await axios.get(`https://finanservs.com/api/entities_f/${banco}`)
  //   .then(res => {
  //     const result = res.data
  //     emails = result[0].emails
  //   }).catch(() => {
  //     emails = null
  //   })

  // if (emails === undefined) emails = null
  // if (!emails) {
  //   console.log("Debe configurar lista de Emails en la Entidad Financiera.")
  //   return
  // }
  // emails += ", rsanchez2565@gmail.com, guasimo01@gmail.com"

  let emails = ", rsanchez2565@gmail.com, guasimo01@gmail.com"
  let fileAtach = ""
  try {
    if (banco === '800')   // Banisi
      fileAtach = await solicPrestBanisi(cedula)

    const htmlEmail = `
        <h3>Nuevo Prospecto desde **** BOT Whatsapp ****</h3>
        <ul>
          <li>Email: ${euser}</li>
          <li>Nombre: ${nombre}</li>
          <li>Teléfono: ${telefono}</li>
          <li>Monto Solicitado: ${monto}</li>
        </ul>
        <h3>Mensaje</h3>
        <h3>${banco === '800' && fileAtach != "" ? 'Adjuntamos solicitud de préstamos para ser completada y firmada.' : ''}</h3>
        <p>${mensaje}</p>
      `

    const send_mail = async () => {
      const accessToken = await OAuth2Client.getAccessToken()
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: process.env.EMAIL_USER,
            clientId: process.env.clientId,
            clientSecret: process.env.clientSecret,
            refreshToken: process.env.refreshToken,
            accessToken: accessToken
          },
          tls: {
            rejectUnauthorized: false
          }
        })

        const mailOptions = {
          from: process.env.EMAIL_FROM,
          to: emails,
          subject: asunto,
          text: mensaje,
          html: htmlEmail,
        }
        if (banco === '800' && fileAtach != "") { // Banisi
          mailOptions.attachments = [
            {   // utf-8 string as an attachment
              filename: 'Solicitud.pdf',
              path: fileAtach,
              content: 'Solicitud de Préstamo'
            },
          ]
        }

        const result = await transporter.sendMail(mailOptions)
        transporter.close()
        return result
      } catch (err) {
        console.log('Estamos aqui: ', err)
      }
    }
    send_mail()
      .then(r => {
        res.status(200).send('Enviado!')
        try {
          fs.unlinkSync(fileAtach)
        } catch (err) {
          console.error('Something wrong happened removing the file', err)
        }
      })
      .catch(e => console.log(e.message))
  } catch (err) {
    console.log('Estamos aqui 2: ', err)
  }
})


appRoutes.post('/APC', async (request, response) => {
  const {id: cedula } = request.body

  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true, 
    useUnifiedTopology: true
  })
  .then(() => console.log('MongoDB Connected...1-a'))
  .catch((err) => console.log(err))

  let datos = {}
  let antigRef = 0

  try {
    const data = await Prospect.find({ "Cedula": cedula }, {})
    console.log('data MDB', cedula)
    if (data.length) {
      console.log('Hola por aqui-2222')
      const created = data[0].Created
      const today = new Date()
      antigRef = Math.round((today.getTime() - created.getTime())/(24*60*60*1000))

      if(antigRef < 91) {
        datos = data[0].APC
      }
    }
    if(!Object.keys(datos).length) {
      console.log('Hola por aqui-1111')
      await leerRefAPC(request, response)
    } else {
      formatData(datos, response)
      console.log('Hola por aqui-3333')
    }
  } catch(err)  {
    formatData(datos, response)
    console.log('Hola por aqui-4444')
  }
})

const leerRefAPC = async (request, response) => {
  const { id, tipoCliente, productoApc } = request.body
  const URL = "https://apirestapc20210918231653.azurewebsites.net/api/APCScore"

  const { username: usuarioApc, password: claveApc } = config.APC

  console.log(usuarioApc, claveApc, id, tipoCliente, productoApc)
  let idMongo = ""
  axios.post(URL, {
    "usuarioconsulta": usuarioApc, "claveConsulta": claveApc, 
    "IdentCliente": id, "TipoCliente": tipoCliente, "Producto": productoApc})
  .then(async (res) => {
    const result = res.data
    console.log('Hola estoy por aqui-AAAAA', {result})
    if(result.mensaje === 'Ok') {
      idMongo = await guardarRef(result, id)
      datos = await leerRefMongo(idMongo)
      formatData(datos, response)
    } else {
      formatData([], response)
    }
  }).catch((error) => {
    console.log('Hola estoy por aqui-BBBB')
    formatData([], response)
  });
  return idMongo
}

const guardarRef = async (refApc, id) => {

  console.log('refApc', refApc)
  const { nombre, apellido, idenT_CLIE, noM_ASOC, } = refApc.gen

  const Generales = {
    "Nombre": nombre,
    "Apellido": apellido,
    "Id": idenT_CLIE,
    "Usuario": usuarioApc,
    "Asociado": noM_ASOC
  }

  const Resumen = []
  Object.entries(refApc["res"]).forEach(([key, value]) => {
    if(value !== null) {
      const dato = {}
      for (var i in value) {
        switch(i) {
          case "relacion":
            dato.Relacion = value[i]
            break
          case "cantidad":
            dato.Cantidad = value[i]
            break
          case "monto":
            dato.Monto = value[i]
            break
          case "saldO_ACTUAL":
            dato.Saldo_Actual = value[i]
            break
          default:
            // code block
        }
      }
      Resumen.push(dato)
    }
  })

  const Referencias = []
  Object.entries(refApc["det"]).forEach(([key, value]) => {
    if(value !== null) {
      const dato = {}
      for (var i in value) {
        switch(i) {
          case "noM_ASOC":
            dato.Agente_Economico = value[i]
            break
          case "descR_CORTA_RELA":
            dato.Relacion = value[i]
            break
          case "montO_ORIGINAL":
            dato.Monto_Original = value[i]
            break
          case "saldO_ACTUAL":
            dato.Saldo_Actual = value[i]
            break
          case "nuM_REFER":
            dato.Referencia = value[i]
            break
          case "nuM_PAGOS":
            dato.Num_Pagos = value[i]
            break
          case "descR_FORMA_PAGO":
            dato.Forma_Pago = value[i]
            break
          case "importE_PAGO":
            dato.Letra = value[i]
            break
          case "montO_ULTIMO_PAGO":
            dato.Monto_Utimo_Pago = value[i]
            break
          case "feC_ULTIMO_PAGO":
            dato.Fec_Ultimo_pago = value[i]
            break
          case "descR_OBS_CORTA":
            dato.Observacion = value[i]
            break
          case "nuM_DIAS_ATRASO":
            dato.Dias_Atraso = value[i]
            break
          case "historia":
            dato.Historial = value[i]
            break
          case "feC_INICIO_REL":
            dato.Fec_Ini_Relacion = value[i]
            break
          case "feC_FIN_REL":
            dato.Fec_Vencimiento = value[i]
            break
          case "feC_ACTUALIZACION":
            dato.Fec_Actualiazacion = value[i]
            break
          default:
            // code block
        }
      }
      dato.Estado = "ACTULIZADA"
      dato.Fec_Prescripcion = ""
      Referencias.push(dato)
    }
  })

  const Ref_Canceladas = []
  Object.entries(refApc["ref"]).forEach(([key, value]) => {
    if(value !== null) {
      const dato = {}
      for (var i in value) {
        switch(i) {
          case "noM_ASOC":
            dato.Agente_Economico = value[i]
            break
          case "descR_CORTA_RELA":
            dato.Relacion = value[i]
            break
          case "montO_ORIGINAL":
            dato.Monto_Original = value[i]
            break
          case "nuM_REFER":
            dato.Referencia = value[i]
            break

          case "feC_INICIO_REL":
            dato.Fec_Ini_Relacion = value[i]
            break
          case "feC_FIN_REL":
            dato.Fec_Vencimiento = value[i]
            break
          case "feC_LIQUIDACION":
            dato.Fec_Cancelacion = value[i]
            break

          case "feC_ULTIMO_PAGO":
            dato.Fec_Ultimo_pago = value[i]
            break
          case "descR_OBS_CORTA":
            dato.Observacion = value[i]
            break
          case "historia":
            dato.Historial = value[i]
            break

          default:
            // code block
        }
      }
      dato.Fec_Prescripcion = ""
      Ref_Canceladas.push(dato)
    }
  })

  const Score = {
    Score: 0,
    PI: 0,
    Exclusion: ""
  }

  if(refApc["sc"] !== null) {
    Score.Score = refApc["sc"]["score"]
    Score.PI = refApc["sc"]["pi"]
    Score.Exclusion = refApc["sc"]["exclusion"]
  }

  const udtDatos = {
    Cedula: id,
    APC: {
      Generales,
      Resumen,
      Referencias,
      Ref_Canceladas,
      Score
    }
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true, 
    useUnifiedTopology: true
  })
  .then(() => console.log('MongoDB Connected...2'))
  .catch((err) => console.log(err))

  let idMongo = ""
  try {
    const xxx = await Prospect.updateOne(
      {Cedula: id},
      udtDatos, 
      {upsert: true}
    )
    idMongo = JSON.stringify(xxx.upsertedId).replace('"','').replace('"','')
    console.log('idMongo',idMongo)
  } catch(err)  {
    console.log(err)
  }
  return idMongo
}

const leerRefMongo = async (id) => {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true, 
    useUnifiedTopology: true
  })
  .then(() => console.log('MongoDB Connected...1-b'))
  .catch((err) => console.log(err))

  try {
    const data = await Prospect.findById( { "_id": id }, {})
    if (Object.keys(data).length) {
      return data.APC
    }
  } catch (err) {
    console.log (err)
    return {}
  }
}

const formatData = (result, response) => {
  let datos = []
  if (Object.keys(result).length) {
    let SCORE = "0"
    let PI = "0"
    let EXCLUSION = "0"
    if(result["Score"] !== null) {
      SCORE = result["Score"]["Score"]
      PI = result["Score"]["PI"]
      EXCLUSION = result["Score"]["Exclusion"]
    }

    Object.entries(result["Referencias"]).forEach(([key, value]) => {
      if(value !== null) {
        value.status = true
        value.message = "Ok"
        value.score = SCORE
        value.pi = PI
        value.exclusion = EXCLUSION
        datos.push(value)
      }
    });
  } else {
    datos.push({ "status": false, "message": "WS-APC No disponible." })
  }  
  response.json(datos)
}


appRoutes.get('/leerAPC', (request, response) => {
  // const { id: cedula } = request.body
  const cedula = '7-94-485'

  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true, 
    useUnifiedTopology: true
  })
  .then(() => console.log('MongoDB Connected...3'))
  .catch((err) => console.log(err))

  Prospect.find({ "Cedula": cedula }, {}, function (err, data) {
    if(err) {
      console.log(err)
      return
    }
    let result = {}
    if(data.length) {
      result = data[0].APC
    }
    formatData(result, response)
  })
})


module.exports = appRoutes
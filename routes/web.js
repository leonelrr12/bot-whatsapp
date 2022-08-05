require('dotenv').config()
const express = require('express');
const router = express.Router()
const { google } = require('googleapis')
const OAuth2 = google.auth.OAuth2
const axios = require('axios');

const { getQr } = require('../controllers/web')
const { connection } = require('../config/mysql')

router.use('/qr', getQr)
router.get('/', getQr)

// const { sendEmail: key } = config
const OAuth2Client = new OAuth2(
  process.env.clientId,
  process.env.clientSecret,
  process.env.redirectUri
)
OAuth2Client.setCredentials({ 
  refresh_token: process.env.refreshToken 
})

// const { usuarioApc, claveApc } = config.APC
const usuarioApc = process.env.APC_USER
const claveApc = process.env.APC_PASS


router.get('/clientify-token', async (req, res) => {
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

router.post('/clientify', async (req, res) => {
  const { body } = req

  let { token, ID, Tracking, entidad_seleccionada = '700', prestamo_opciones, acepta_terminos_condiciones,
    first_name, last_name, email, phone, fecha_nacimiento = '1900-01-01', contrato_laboral,
    meses_trabajo_actual = 0, meses_trabajo_anterior = 0, Salario = 0, Sector,
    nameProfesion, Genero = 'x', tipo_residencia = '1', mensualidad_casa = 0,

    donde_trabaja = 'N/A', Puesto = 'N/A', Cedula = 'N/A',
    img_cedula = 'N/A', img_ficha_css = 'N/A', img_servicio_publico = 'N/A', img_carta_trabajo = 'N/A',
    img_comprobante_pago = 'N/A', img_autoriza_apc = 'N/A', img_referencias_apc = 'N/A',
    provincia = 'N/A', distrito = 'N/A', street = 'N/A'
  } = body

  const wDate = date => (date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate())
  const wCapit = text => (text.toLowerCase().split(' ').map(w => w[0].toUpperCase() + w.substr(1)).join(' '))

  let Monto = 0, Letra = 0, Plazo = 0, Efectivo = 0

  const opciones = [];
  // const opciones = JSON.parse(prestamo_opciones)
  // if(opciones.length) {
  //   const opcion = opciones.filter((item) => item.bank === entidad_seleccionada)
  //   if(opcion.length) {
  //     Monto = opcion[0].loan
  //     Letra = opcion[0].monthlyFee
  //     Plazo = opcion[0].term
  //     Efectivo = opcion[0].cashOnHand
  //   }
  // }

  let wbanco = 'N/A'
  // await axios.get(`https://finanservs.com/api/entities_f/${entidad_seleccionada}`)
  // .then(res => {
  //   const result = res.data
  //   wbanco = result[0].name
  // }).catch(() => {
  //   wbanco = 'N/A'
  // })
  // if(wbanco === undefined) wbanco = 'N/A'

  if (!img_autoriza_apc) img_autoriza_apc = "N/A"
  if (!img_referencias_apc) img_referencias_apc = "N/A"
  if (!img_cedula) img_cedula = "N/A"
  if (!img_ficha_css) img_ficha_css = "N/A"
  if (!img_servicio_publico) img_servicio_publico = "N/A"
  if (!img_carta_trabajo) img_carta_trabajo = "N/A"
  if (!img_comprobante_pago) img_comprobante_pago = "N/A"

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
            tipo_residencia === '3' ? "Casa Hipotecada" : "Casa Alquilada"
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

      { "field": "img_cedula", "value": img_cedula },
      { "field": "img_servicio_publico", "value": img_servicio_publico },
      { "field": "img_ficha_css", "value": img_ficha_css },
      { "field": "img_carta_trabajo", "value": img_carta_trabajo },
      { "field": "img_comprobante_pago", "value": img_comprobante_pago },
      { "field": "img_autoriza_apc", "value": img_autoriza_apc },
      { "field": "img_referencias_apc2", "value": img_referencias_apc },
    ]

    //   {"field": "entidad_seleccionada", "value": wbanco},
    //   {"field": "Monto", "value": Monto},
    //   {"field": "Letra", "value": Letra},
    //   {"field": "Plazo", "value": Plazo},



    //   {"field": "acepta_terminos_condiciones", "value": acepta_terminos_condiciones},
    //   {"field": "Agente", "value": "0"}
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

router.post('/prospects', (req, res) => {
  const { body } = req;

  let sql = "INSERT INTO prospects ("
  sql += " id_personal,id_referido,idUser,name,fname,fname_2,lname,lname_2,"
  sql += " entity_f,estado,email,cellphone,phoneNumber,idUrl,socialSecurityProofUrl,"
  sql += " publicGoodProofUrl,workLetterUrl,payStubUrl,origin_idUser,gender,birthDate,"
  sql += " contractType,jobSector,occupation,paymentFrecuency,profession,"
  sql += " civil_status,province,district,county,sign,"
  sql += " loanPP,loanAuto,loanTC,loanHip,cashOnHand,plazo,apcReferenceUrl,apcLetterUrl,"

  sql += " residenceType,residenceMonthly,work_name,work_cargo,work_address,work_phone,work_phone_ext,work_month,"
  sql += " work_prev_name,work_prev_month,work_prev_salary,"
  sql += " salary,honorarios,viaticos,termConds,"
  sql += " weight, weightUnit, height, heightUnit, aceptaApc, nationality,"
  sql += " calle, barriada_edificio,no_casa_piso_apto,id_agente,reason"

  sql += ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,"
  sql += "?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"

  let { id_personal, idUser, apcReferencesUrl, apcLetterUrl, sponsor, name, fname, fname_2, lname, lname_2 } = body
  let { entity_f, email, cellphone, phoneNumber, idUrl, socialSecurityProofUrl, publicGoodProofUrl } = body
  let { workLetterUrl, payStubUrl, origin_idUser, gender, birthDate: BDH, contractType, jobSector, occupation, paymentFrecuency } = body
  let { profession, civil_status, province, district, county, sign } = body
  let { street: calle, barriada_edificio, no_casa_piso_apto } = body
  let { loanPP, loanAuto, loanTC, loanHip, cashOnHand, plazo, reason } = body

  let { residenceType, residenceMonthly, work_name, work_cargo, work_address = '', work_phone = '', work_phone_ext = '', work_month = 0 } = body
  let { work_prev_name = 'N/A', work_prev_month = 0, work_prev_salary = 0 } = body
  let { salary, honorarios = 0, viaticos = 0, termConds, nationality = 0 } = body
  let { weight, weightUnit, height, heightUnit, aceptaAPC: aceptaApc, agente } = body

  estado = 1 // Nuevo registro queda con estatus de nuevo

  const birthDate = BDH.split('/')[2] + '-' + BDH.split('/')[1] + '-' + BDH.split('/')[0]
  const params = [
    id_personal, sponsor, idUser, name, fname, fname_2, lname, lname_2, entity_f, estado, email, cellphone,
    phoneNumber, idUrl, socialSecurityProofUrl, publicGoodProofUrl, workLetterUrl, payStubUrl, origin_idUser, gender,
    birthDate, contractType, jobSector, occupation, paymentFrecuency, profession, civil_status, province,
    district, county, sign, loanPP, loanAuto, loanTC, loanHip, cashOnHand, plazo, apcReferencesUrl, apcLetterUrl,
    residenceType, residenceMonthly, work_name, work_cargo, work_address, work_phone, work_phone_ext, work_month,
    work_prev_name, work_prev_month, work_prev_salary,
    salary, honorarios, viaticos, termConds,
    weight, weightUnit, height, heightUnit, aceptaApc, nationality,
    calle, barriada_edificio, no_casa_piso_apto, agente, reason
  ]

  connection.query(sql, params, (error, results, next) => {
    if (error) {
      console.log('Error SQL:', error.sqlMessage)
      res.status(500)
    }
    // console.log('results', results, results.insertId)
    // console.log({ newId: results.insertId })
    res.json({ newId: results.insertId })
  })
})

router.post('/ref_personales', (req, res) => {
  const { body } = req;

  let { tipo, name, id_prospect, apellido, parentesco, cellphone, phonenumber, work_name, work_phonenumber, work_phone_ext } = body

  let sql = "INSERT INTO ref_person_family ("
  if (tipo == "0") {
    sql = "INSERT INTO ref_person_no_family ("
  }
  sql += " name,id_prospect,apellido,parentesco,cellphone,phonenumber,work_name,work_phonenumber,work_phone_ext"
  sql += ") VALUES (?,?,?,?,?,?,?,?,?)"

  const params = [
    name, id_prospect, apellido, parentesco, cellphone,
    phonenumber, work_name, work_phonenumber, work_phone_ext
  ]

  connection.query(sql, params, (error, results, next) => {
    if (error) {
      console.log('Error SQL:', error.sqlMessage)
      res.status(500)
    }
    // console.log('results',results)
    res.send('Ok!')
  })
})

router.post('/email', async (req, res) => {
  const { body } = req;

  console.log('mail', body);
  const { email: euser, asunto, mensaje, telefono, monto, nombre, banco, cedula } = body

  let emails = null
  await axios.get(`https://finanservs.com/api/entities_f/${banco}`)
    .then(res => {
      const result = res.data
      emails = result[0].emails
    }).catch(() => {
      emails = null
    })

  if (emails === undefined) emails = null
  if (!emails) {
    console.log("Debe configurar lista de Emails en la Entidad Financiera.")
    return
  }
  emails += ", rsanchez2565@gmail.com, guasimo01@gmail.com"

  let fileAtach = ""
  try {
    if (banco === '800')   // Banisi
      fileAtach = await solicPrestBanisi(cedula)

    const htmlEmail = `
      <h3>Nuevo Prospecto desde Finanservs.com</h3>
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


module.exports = router
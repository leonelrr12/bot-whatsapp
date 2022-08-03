const express = require('express');
const router = express.Router()
const axios = require('axios');
const { getQr } = require('../controllers/web')

router.use('/qr', getQr)
router.get('/', getQr)

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

  console.log(body)

  let { token, ID, Tracking, entidad_seleccionada = '700', prestamo_opciones,
    first_name, last_name, email, phone, fecha_nacimiento = '1900-01-01', contrato_laboral,
    meses_trabajo_actual = 0, meses_trabajo_anterior = 0, Salario = 0, Sector, acepta_terminos_condiciones,
    Institucion, Ocupacion, Profesion, Planilla, Genero = 'M', tipo_residencia = '1', mensualidad_casa = 0,

    donde_trabaja = 'N/A', Puesto = 'N/A', Cedula = 'N/A',
    img_cedula = 'N/A', img_ficha_css = 'N/A', img_servicio_publico = 'N/A', img_carta_trabajo = 'N/A',
    img_comprobante_pago = 'N/A', img_autoriza_apc = 'N/A', img_referencias_apc = 'N/A',
    province, district, county, street = 'N/A'
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

  let wprof = 'N/A'
  // await axios.get(`https://finanservs.com/api/profesions/${Profesion}`)
  // .then(res => {
  //   const result = res.data
  //   wprof = result[0].profesion
  // }).catch(() => {
  //   wprof = 'N/A'
  // })
  // if(wprof == undefined) wprof = 'N/A'

  let wocup = 'N/A'
  let wprov = 'N/A'
  let wdist = 'N/A'
  if (!img_autoriza_apc) img_autoriza_apc = "N/A"
  if (!img_referencias_apc) img_referencias_apc = "N/A"

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
        "city": (wdist || '').length > 3 ? wCapit(wdist) : "N/A",
        "state": (wprov || '').length > 3 ? wCapit(wprov) : "N/A",
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
      { "field": "Profesion", "value": wprof },
      { "field": "Ocupacion", "value": wocup },
      { "field": "Genero", "value": Genero },
    ]
    //   {"field": "img_cedula", "value": img_cedula},
    //   {"field": "img_servicio_publico", "value": img_servicio_publico},
    //   {"field": "img_ficha_css", "value": img_ficha_css},
    //   {"field": "img_carta_trabajo", "value": img_carta_trabajo},
    //   {"field": "img_comprobante_pago", "value": img_comprobante_pago},
    //   {"field": "img_autoriza_apc", "value": img_autoriza_apc},
    //   {"field": "img_referencias_apc2", "value": img_referencias_apc},


    //   {"field": "acepta_terminos_condiciones", "value": acepta_terminos_condiciones},

    //   {"field": "entidad_seleccionada", "value": wbanco},
    //   {"field": "Monto", "value": Monto},
    //   {"field": "Letra", "value": Letra},
    //   {"field": "Plazo", "value": Plazo},
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

module.exports = router
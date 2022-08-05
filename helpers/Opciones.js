const axios = require('axios');

const API_HOST = "https://finanservs.com"

let Loans = []
let tmpParams = []
let loan = 0.00
let deudaTotal = 0.00
let letraTotal = 0.00
let monto_max = 0.00
let term_max = 0
let cashOnHand_max = 0.00


async function Opciones(data) {

  let { monthlyResidenceFee = 0.00, wage = 0.00, alloance = 0.00, perDiem = 0.00, previousJobMonths = 0,
    jobSector, profession = 0, occupation = 0, institution = 0, currentJobMonths = 0, contractType = "",
    creditHistory, paymentFrecuency = 0, Edad
  } = data

  const sectorsRes = await axios.get(`${API_HOST}/api/laboral_sector`)
  const sectors = await sectorsRes.data
  // console.log(sectors)

  const leRes = await axios.get(`${API_HOST}/api/laboral_sector_entity_f`)
  const laboralEntitys = await leRes.data
  // console.log(laboralEntities)

  const idSectors = sectors.filter(st => st.sector == jobSector)
  const idSector = idSectors[0].id_sector

 
  let { gender, birthDate } = data;
  let salario = wage + alloance + perDiem

  const today = new Date(); //  Ver como traerla del servidor
  let birth = new Date();
  if (birthDate !== undefined) {
    birth = new Date(birthDate)
  }

  const mmToday = today.getMonth() + 1
  const yyyy = today.getFullYear()

  const dd = birth.getDate()
  const mm = birth.getMonth() + 1

  const edadHoy = (today.getFullYear() - birth.getFullYear())

  const d1 = dd < 10 ? '0' + dd.toString() : dd.toString()
  const m1 = mm < 10 ? '0' + mm.toString() : mm.toString()

  let y1 = Number(yyyy.toString().slice(0, 3) + "4")
  let y2 = Number(yyyy.toString().slice(0, 3) + "9")

  if (yyyy < y1 && yyyy < y2) {
    y1 -= 5
    y2 -= 5
  } else if (yyyy === y1) {
    if (mm < 7) {
      y1 -= 5
      y2 -= 5
    }
  } else if (yyyy === y2) {
    if (mm > 6) {
      y1 += 5
      y2 += 5
    }
  }

  const fGovIni = new Date(y1.toString() + '-07-01')
  const fGovFin = new Date(y2.toString() + '-07-01')

  // LLRR cambiado para los calculos por cada entidad
  // Falta incluir filtro para la antiguedad minima en el empleo (meses) 22-nov-2021
  const wrkLaboralEntities = laboralEntitys.filter(
    le => le.id_sector == idSector &&
      le.id_profesion == Number(profession) &&
      le.ruta != "100" && le.ruta != "810" &&
      le.salario_min <= salario &&
      le.min_antiguedad <= currentJobMonths
  )
  let laboralEntities = wrkLaboralEntities


  function handleCapacity(entity, deudaTotal, letraTotal) {
    let {
      ruta: bank = '',
      debt_capacity = 0,
      debt_capacity_mortgage = 0,
      discount_capacity = 0,
      discount_capacity_mortgage = 0,
      mount_max = 0,
      mount_min = 0,
      plazo_max = 0,
      tasa = 0,
      comision = 0,
      seg_vida: segVida = 0,
      factor_SV = 0,
      feci = 0,
      itbms = 0,
      notaria: Notaria = 0,
      factor: Factor = 0,
      letraRetenida = false,
      gastoLegal = 0,
      timbres = 0,
      servicioDescto = 0,
    } = entity

    comision = comision / 100
    tasa = tasa / 100
    feci = feci / 100
    segVida = segVida / 100
    itbms = itbms / 100
    timbres = timbres / 100
    servicioDescto = servicioDescto / 100

    const anioJub = birth.getFullYear() + (gender === 'male' ? 62 : 57)
    let salary = wage + alloance + perDiem

    // Fecha de Jubilacion
    let fj = new Date(anioJub.toString() + '-' + m1.toString() + '-' + d1.toString())

    if (!creditHistory || paymentFrecuency > 2) {
      // TODO: aqui se debe colocar condiciones para entidades que menejen diferentes formas de Pago y si tienen o no historial.
      // CausasRechazo.push({ description: `Bank: ${bank} - No tiene historial de crédito o no cumple con el plan de pago.` })
      console.log({ description: `Bank: ${bank} - No tiene historial de crédito o no cumple con el plan de pago.` })
      return
    }

    if (contractType == '0' && bank != '600') {
      // TOTO: Solo se permite temporales para Financomer y en especial para empleados de ACP
      // CausasRechazo.push({ description: `Bank: ${bank} - Solo se adminten contratos de trabajo permanente.` })
      console.log({ description: `Bank: ${bank} - Solo se adminten contratos de trabajo permanente.` })
      return
    }

    if (bank === '600') {  // Financomer
      if (contractType === '0' && profession !== '5') {
        // CausasRechazo.push({ description: `Bank: ${bank} - Solo se adminten contratos de trabajo permanente.` })
        console.log({ description: `Bank: ${bank} - Solo se adminten contratos de trabajo permanente.` })
        return
      }
    }

    if (bank == '700') {  // Panacredit
      if (jobSector === 'P') {  // Sector Privado
        if (currentJobMonths < 24 && previousJobMonths < 12) {
          // TOTO: No puede seguir. Continuidad laboral exige 12 meses en trabajo actual y anterior
          // CausasRechazo.push({ description: `Bank: ${bank} - Continuidad laboral exige 12 meses en trabajo actual y anterior.` })
          console.log({ description: `Bank: ${bank} - Continuidad laboral exige 12 meses en trabajo actual y anterior.` })
          return
        }
      }
      console.log('plazo_max 1',plazo_max)

      if (jobSector === 'Pb') { // Sector Público
        if (profession === '5') { // Condiciones especiales APC
          // Por parametros viene el Monto maximo a prestar y el Numero minimo de plazo en Meses
          if (currentJobMonths >= 60) {
            plazo_max = 180
          } else if (currentJobMonths >= 24) {
            mount_max = 20000
          }
        }
        if (profession === '6') {  // Seguridad publica
          if (currentJobMonths <= 12) mount_max = 10000
          else if (currentJobMonths <= 24) mount_max = 25000
          else mount_max = 100000 //salary * discount_capacity / 100.00
        }
      }
    }
    console.log('plazo_max 2',plazo_max)

    if (bank === '800') {  // Banisi
      const yyxx = anioJub + 1
      fj = new Date(yyxx.toString() + '-' + m1.toString() + '-' + d1.toString())
    }

    // Fecha tope para jubilados
    if (jobSector === 'J') {
      let w_plazo_anio = 0;
      if (bank === '600' || bank === '800') {
        w_plazo_anio = plazo_max
        plazo_max = (w_plazo_anio - edadHoy) * 12
      }
    } else {
      const periodo = (anioJub - yyyy) * 12 + (mmToday - mm)
      if (periodo < plazo_max) plazo_max = periodo
    }
    console.log('plazo_max 3',plazo_max, jobSector, anioJub, mmToday )

    let mortage = monthlyResidenceFee

    let pje_dscto = discount_capacity
    if (mortage > 0) pje_dscto = discount_capacity_mortgage
    let pje_debt = debt_capacity
    if (mortage > 0) pje_debt = debt_capacity_mortgage

    const cap_discto = salary * pje_dscto / 100.00
    const cap_debt = salary * pje_debt / 100.00

    const cap_debt_available = cap_debt - mortage
    let cap_discto_available = cap_debt_available < cap_discto ? cap_debt_available : cap_discto

    // Condicion en donde letraTotal >= cap_discto_available
    // Condicion en donde deudaTotal >= loan

    //***************************************************************/
    //***************************************************************/
    //** CALCULO STANDAR  **/
    //***************************************************************/
    //***************************************************************/

    let wPlazo = 0
    let plazoCalc = 0
    let term = 0

    let wrkV = calc_fvcto(plazo_max, pje_dscto, fj)
 
    if (jobSector === 'J') {
      wPlazo = wrkV.wpp
      plazoCalc = wPlazo + wrkV.wDic
      term = wPlazo
    } else {
      wPlazo = plazo_max //wrkV.wpp 
      plazoCalc = wPlazo + wrkV.wDic
      term = wPlazo
    }

    let daysLoan = Math.round((wrkV.fvencto.getTime() - wrkV.fcot.getTime()) / (24 * 60 * 60 * 1000))

    //** FORMULA ESPECIAL BANISI **/
    if (bank === '800' && jobSector !== 'J') {
      // daysLoan -= 1 
      wPlazo = wrkV.wpp
      plazoCalc = wPlazo + wrkV.wDic
      term = wPlazo
    }

    const avgDaysLoan = (daysLoan / wPlazo)   //(daysLoan/plazoCalc)  nov-21
    const paysYear = (360 / avgDaysLoan)
    let tasaMes = tasa / (paysYear ? paysYear : 1)

    let factor = (1.00 - (1 + tasaMes) ** (-wPlazo)) / tasaMes
    // const reFactor = tasaMes/(1-(1+tasaMes)**(-wPlazo))

    let nota = ''
    loan = (factor * cap_discto_available) / (1.00 + (factor * segVida * factor_SV))
    console.log('loan 1', loan, bank)

    if (bank != '600' && bank != '700') {
      const data = {
        entidad: '100',
        cap_discto: cap_discto,
        wPlazo: wPlazo,
        comision: comision,
        plazoCalc: 0,
        tasa: 0,
        feci: 0,
        factor: factor,
        Notaria: 0,
        segVida: segVida,
        factor_SV: factor_SV,
        itbms: itbms,
        servicioDescto: servicioDescto,
        timbres: timbres,
        gastoLegal: gastoLegal,
        letraRetenida: letraRetenida
      }
      tmpParams.push(data)
    }

    if (loan > 5000) {
      tasaMes = (tasa + feci) / (paysYear ? paysYear : 1)
      factor = (1 - (1 + tasaMes) ** (-wPlazo)) / tasaMes
      loan = (factor * cap_discto_available) / (1.00 + (factor * segVida * factor_SV))
    }
    console.log('loan 2', loan)

    //** FORMULA ESPECIAL PANACREDIT **/
    if (bank == '700') {
      loan = ((cap_discto_available * wPlazo) - 587.8) / (1.04815 + comision + (0.083333 * plazoCalc) * (tasa + feci) + Factor * plazoCalc * 0.00105)

      const data = {
        entidad: '700',
        wPlazo: wPlazo,
        comision: comision,
        plazoCalc: plazoCalc,
        tasa: tasa,
        feci: feci,
        factor: Factor,
        Notaria: 0,
        segVida: 0,
        factor_SV: 0,
        itbms: itbms,
        servicioDescto: servicioDescto,
        timbres: timbres,
        gastoLegal: gastoLegal,
        letraRetenida: letraRetenida
      }
      tmpParams.push(data)
    }
    console.log('loan 3', loan)

    //** FORMULA ESPECIAL FINANCOMER **/
    if (bank == '600') {

      if (jobSector != 'J') {
        wrkV = calc_fvcto(plazo_max, pje_dscto, fj)
        wPlazo = plazo_max //wrkV.wpp 
        plazoCalc = wPlazo + wrkV.wDic
        term = wPlazo
      }

      tasaMes = tasaMes / 100
      loan = ((wPlazo * cap_discto_available) - Notaria) / (1 + (plazoCalc * feci) + (0.00168 * plazoCalc) + (tasaMes * plazoCalc) + 0.2675)
      console.log('loan 4', loan)

      const data = {
        entidad: '600',
        wPlazo: wPlazo,
        comision: comision,
        plazoCalc: plazoCalc,
        tasa: tasaMes,
        feci: feci,
        factor: 0,
        Notaria: Notaria,
        segVida: 0,
        factor_SV: 0,
        itbms: itbms,
        servicioDescto: servicioDescto,
        timbres: timbres,
        gastoLegal: gastoLegal,
        letraRetenida: letraRetenida
      }
      tmpParams.push(data)
    }

    loan = Math.round(loan * 100) / 100

    if (loan > mount_max && (mount_max > 0)) {
      nota = `*** Monto del préstamo por encima del Máximo. Monto calculado: ${loan} ***`
      loan = mount_max
    }
    if (loan < mount_min) nota = '*** Monto del préstamo por debajo del mínimo. ***'
    console.log('loan 5', loan)


    loan = Number(loan.toFixed(2))
    const monthlyFee = cap_discto_available //Math.round(reFactor*loan*100)/100
    const comisClose = Math.round(comision * loan * 100) / 100
    const comisItbm = Math.round(comisClose * itbms * 100) / 100
    const servDescto = Math.round(cap_discto_available * wPlazo * servicioDescto * 100) / 100
    const comisTimbres = Math.round(loan * timbres * 10) / 10
    const comisGastoLegal = gastoLegal + cap_discto_available
    const montoLetRet = letraRetenida ? monthlyFee : 0

    // let cashOnHand = Number((loan - (comisClose+comisItbm+gastoLegal+timbres+servicioDescto+montoLetRet)).toFixed(2))
    let cashOnHand = loan - (comisClose + comisItbm + comisGastoLegal + servDescto + montoLetRet + comisTimbres)
    if (bank === '600' || bank === '700') {
      cashOnHand = loan
    }

    let xx = {
      bank,
      loan,
      term,
      paysYear,
      monthlyFee,
      cashOnHand,
      opciones: [],
      nota
    }

    Loans.push(xx)
    if (loan > monto_max) monto_max = loan
    if (term > term_max) term_max = term
    if (cashOnHand > cashOnHand_max) cashOnHand_max = cashOnHand
  }

  const calc_fvcto = (plazoCalc, pje_dscto, fj) => {
    const fcot = new Date()
    let yyyy = fcot.getFullYear()
    let mm = fcot.getMonth() + 1
    let dd = fcot.getDate()

    if (mm === 11) {
      mm = 1
      yyyy += 1
    }
    else {
      mm += 1
      if (mm > 12) {
        mm = 1
        yyyy += 1
      }
    }

    let dd2 = dd
    if (dd2 > 30 && (mm === 4 || mm === 6 || mm === 9 || mm === 11)) dd = 30
    else if (dd2 > 27 && mm === 2) { dd = 28 }
    else { dd = dd2 }

    // let ffpay = new Date(fcot.getTime() + (mm === 11 ? (60*24*60*60*1000) : (30*24*60*60*1000)))
    dd += 1
    let ftemp = yyyy.toString() + '-' + ((mm < 10) ? '0' + mm.toString() : mm.toString()) + '-' + ((dd < 10) ? '0' + dd.toString() : dd.toString())
    let ffpay = new Date(ftemp)

    let fvencto = ffpay
    let ff = ffpay

    yyyy = ffpay.getFullYear()
    mm = ffpay.getMonth() + 1
    dd = ffpay.getDate()

    let logg = []
    dd2 = dd
    ftemp = ''
    let wDic = 0
    let wPlazo = plazoCalc
    let mesOut = 0

    let i = 0
    while (i < wPlazo) {
      if (mm === 12) {
        mm = 1
        yyyy += 1
        wDic = wDic + 1
      }

      if (dd2 > 30 && (mm === 4 || mm === 6 || mm === 9 || mm === 11)) dd = 30
      else if (dd2 > 27 && mm === 2) { dd = 28 }
      else { dd = dd2 }

      ftemp = yyyy.toString() + '-' + ((mm < 10) ? '0' + mm.toString() : mm.toString()) + '-' + ((dd < 10) ? '0' + dd.toString() : dd.toString())

      const f = new Date(ftemp)
      ff = new Date(f.getTime()) // + 24*60*60*1000)

      if (ff > fj && jobSector !== 'J') {
        console.log('Break ....')
        mesOut += 1
        break
      }

      fvencto = ff

      // console.log(i+1, yyyy,mm,dd, fvencto, ff <= fj);
      logg.push((i + 1).toString() + " - " + fvencto)

      mm += 1
      i += 1
    }

    // wpp += 1
    return { wpp: i, wDic, fcot, fvencto, wPlazo, ffpay, mesOut, logg }
  }

  laboralEntities.forEach((entity) => {
    handleCapacity(entity, deudaTotal, letraTotal)
  })
  console.log(Loans)

};


module.exports = Opciones
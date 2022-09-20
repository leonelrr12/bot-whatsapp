const { getData, getReply, saveMessageMysql } = require('./mysql')
const { saveMessageJson } = require('./jsonDb')
const { getDataIa } = require('./diaglogflow')
const stepsInitial = require('../flow/initial.json')
const stepsReponse = require('../flow/response.json')
const separator = require('../helpers/separator')

const get = (message) => new Promise((resolve, reject) => {
  /**
   * Si no estas usando un gesto de base de datos
   */

  if (process.env.DATABASE === 'none') {
    const { key } = stepsInitial.find(k => k.keywords.includes(message)) || { key: null }
    const response = key || null
    resolve(response)
  }
  /**
   * Si usas MYSQL
   */
  if (process.env.DATABASE === 'mysql') {
    getData(message, (dt) => {
      resolve(dt)
    });
  }

})

const reply = (step, data = '') => new Promise((resolve, reject) => {
  /**
  * Si no estas usando un gestor de base de datos
  */
  if (process.env.DATABASE === 'none') {
    let resData = { replyMessage: '', media: null, trigger: null }
    const responseFind = stepsReponse[step] || {};
    if (step == 'STEP_10') {
      // Buscar calculos en el Backend
      const { monto_max, term_max, cashOnHand_max } = data
      responseFind.replyMessage = [
        `Felicidades!!! ⭐⭐⭐\n
        Puede calificar para un
        préstamo personal por un
        Monto máximo: ${separator(monto_max)}
        Plazo en meses: ${term_max}
        Monto a recibir: ${separator(cashOnHand_max)}
        \n🆗 para continuar
        `
      ]
    }
    if (step == 'STEP_11') {
      arrNum = ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"]
      // Buscar opciones de Entidades disponibles
      const { Loans } = data
      let idx = 0
      let text = 'Opciones: \n\n'
      text += 'Entidad | Monto | Letra\n'
      Loans.forEach(p => {
        idx++
        text += arrNum[idx] + ' ' + p.bank + ' | ' + separator(p.loan) + ' | ' + separator(p.monthlyFee) + '\n'
      })
      text += '\n*Escriba un Número*:'
      responseFind.replyMessage = [text]
    }

    resData = {
      ...resData,
      ...responseFind,
      replyMessage: responseFind.replyMessage.join('')
    }
    resolve(resData);
    return
  }
  /**
   * Si usas MYSQL
   */
  if (process.env.DATABASE === 'mysql') {
    let resData = { replyMessage: '', media: null, trigger: null }
    getReply(step, (dt) => {
      resData = { ...resData, ...dt }
      resolve(resData)
    });
  }
})

const getIA = (message) => new Promise((resolve, reject) => {
  /**
   * Si usas dialogflow
   */
  if (process.env.DATABASE === 'dialogflow') {
    let resData = { replyMessage: '', media: null, trigger: null }
    getDataIa(message, (dt) => {
      resData = { ...resData, ...dt }
      resolve(resData)
    })
  }
})

/**
 * 
 * @param {*} message 
 * @param {*} date 
 * @param {*} trigger 
 * @param {*} number 
 * @returns 
 */
const saveMessage = (message, trigger, number) => new Promise(async (resolve, reject) => {
  switch (process.env.DATABASE) {
    case 'mysql':
      resolve(await saveMessageMysql(message, trigger, number))
      break;
    case 'none':
      resolve(await saveMessageJson(message, trigger, number))
      break;
    default:
      resolve(true)
      break;
  }
})

module.exports = { get, reply, getIA, saveMessage }
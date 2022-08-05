const { getData, getReply, saveMessageMysql } = require('./mysql')
const { saveMessageJson } = require('./jsonDb')
const { getDataIa } = require('./diaglogflow')
const stepsInitial = require('../flow/initial.json')
const stepsReponse = require('../flow/response.json')

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

const reply = (step, data='') => new Promise((resolve, reject) => {
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
                `Felicidades!!! \n
                Puede calificar para un
                préstamo personal por un
                Monto máximo de: ${monto_max}
                Plazo en meses: ${term_max}
                Monto a recibir: ${cashOnHand_max}`
            ]
        }
        if (step == 'STEP_11') {
            // Buscar opciones de Entidades disponibles

            responseFind.replyMessage = [
                "Opciones: \n\n",
                "1. Financomer \n",
                "2. Panacredit \n",
                "3. Banisi \n\n",
                "Escribe una opcion: "
            ]
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
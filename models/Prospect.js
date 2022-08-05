const mongoose = require('mongoose')
const Schema = mongoose.Schema

const prospectSchema = new Schema({
  Cedula: {type: String},
  Created: {type: Date, default: new Date()},

  APC: {
    Generales: {
      Nombre: {type: String},
      Apellido: {type: String},
      Id: {type: String},
      Usuario: {type: String},
      Asociado: {type: String},
    },
    Resumen: [
      {
        Relacion: {type: String},
        Cantidad: {type: Number},
        Monto: {type: Number},
        Saldo_Actual: {type: Number},
      }
    ],
    Referencias: [
      {
        Agente_Economico: {type: String},
        Relacion: {type: String},
        Monto_Original: {type: Number},
        Saldo_Actual: {type: Number},
        Referencia: {type: String},
        Num_Pagos: {type: Number},
        Forma_Pago: {type: String},
        Letra: {type: Number},
        Monto_Utimo_Pago: {type: Number},
        Fec_Ultimo_pago: {type: String},
        Observacion: {type: String},
        Dias_Atraso: {type: Number},
        Historial: {type: String},

        Fec_Ini_Relacion: {type: String},
        Fec_Vencimiento: {type: String},
        Fec_Actualiazacion: {type: String},
        Fec_Prescripcion: {type: String},
        Estado: {type: String},
      }
    ],
    Ref_Canceladas: [
      {
        Agente_Economico: {type: String},
        Relacion: {type: String},
        Monto_Original: {type: Number},
        Referencia: {type: String},
        
        Fec_Inicio: {type: String},
        Fec_Vencimiento: {type: String},
        Fec_Ultimo_Pago: {type: String},
        Fec_Cancelacion: {type: String},
        Fec_Prescription: {type: String},
        Observacion: {type: String},
        Historial: {type: String},
      }
    ],
    Score: {
      Score: {type: Number},
      PI: {type: Number},
      Exclusion: {type: String},
    }
  }
})

const Prospect = mongoose.model('Prospect', prospectSchema)

module.exports = Prospect

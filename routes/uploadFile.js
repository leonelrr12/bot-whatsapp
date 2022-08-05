const fileRoutes = require('express').Router()
const mongoose = require('mongoose')
const Prospect = require('../models/Prospect')

const multer = require('multer')
const config = require('../utils/config')
const { uploadFile, uploadFile2a } = require("../utils/multer")

const pdfMake = require('pdfmake/build/pdfmake');
const pdfPrinter = require('pdfmake/src/printer');
const pdfFonts = require('pdfmake/build/vfs_fonts');

const fs = require('fs')
const path = require('path');

const AWS = require('aws-sdk')
const separator = require('../helpers/separator')

fileRoutes.get('/prueba', async (req, res) => {
  res.sendFile(path.join(__dirname+'/upload.html'))
})

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: function(req, file, cb) {
    cb(null, file.originalname)
  }
})
const storage2 = multer.diskStorage({
  destination: 'pdfs/',
  filename: function(req, file, cb) {
    cb(null, file.originalname)
  }
})

const upload = multer({ storage: storage })
const upload2 = multer({ storage2: storage })

fileRoutes.post('/file', upload.single('idUrl'), async (req, res) => {
  const { entity_f, nameImage, prospect } = req.body
  console.log(entity_f, nameImage)
  const file = req.file
  const result = await uploadFile(file, entity_f, nameImage, prospect)
  try {
    fs.unlinkSync(file.path)
  } catch(err) {
    console.error('Something wrong happened removing the file', err)
  }
  res.send(result)
})

fileRoutes.post('/file2', upload2.single('idUrl'), async (req, res) => {
  const { fileName, entity_f, nameImage, prospect } = req.body
  console.log(fileName, entity_f, nameImage)
  const result = await uploadFile2a(fileName, entity_f, nameImage, prospect)
  console.log('uploadFile2a', result)
  try {
    fs.unlinkSync(fileName)
  } catch(err) {
    console.error('Something wrong happened removing the file', err)
  }
  res.send(result)
})

fileRoutes.post('/file2a', upload2.single('idUrl'), async (req, res) => {
  const { fileName, entity_f, nameImage, prospect } = req.body
  console.log(fileName, entity_f, nameImage)
  const result = await uploadFile2a(fileName, entity_f, nameImage, prospect)
  console.log('uploadFile2a', result)
  res.send(result)
})


// const separator = (numb) => {
//   var str = numb.toString().split(".");
//   if(str.length > 1) {
//     str[1] = str[1].padEnd(2, '0')
//   } else {
//     str[1]='00'
//   }
//   str[0] = str[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
//   return str.join(".");
// }

fileRoutes.post('/createPDF', async (req, res) => {

  const { cedula } = req.body

  await mongoose.connect(config.MONGODB_URI, {
    useNewUrlParser: true, 
    useUnifiedTopology: true
  })
  .then(() => console.log('MongoDB Connected...PDF'))
  .catch((err) => console.log(err))

  try {
    result = await Prospect.find({ "Cedula": cedula }, {})

    console.log(result)
    if(!result.length) {
      return
    }
    const APC = await result[0].APC
    const hoyes = new Date().toLocaleString()
    const gen = APC.Generales
    const ref = APC.Referencias
    const refC = APC.Ref_Canceladas

    // Como crear una linea
    // {canvas: [{type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1}]},

    const datosRef = [
      [{ style: 'blueWhite', colSpan: 2, text: 'Agente Económico' }, {}, { style: 'blueWhite', text: 'Monto Original' }, { style: 'blueWhite', text: 'Fec. Inicio Relación' }, { style: 'blueWhite', text: 'Importe' }, { style: 'blueWhite', text: 'Num. Pagos'}, { style: 'blueWhite', text: 'Forma Pago' }],
      [{ style: 'blueWhite', text: 'Relación' }, { style: 'blueWhite', text: 'No. Referencia' }, { style: 'blueWhite', text: 'Saldo Actual' }, { style: 'blueWhite', text: 'Fecha Actualización' }, { style: 'blueWhite', text: 'Monto Último Pago' }, { style: 'blueWhite', text: 'Días Atraso'}, { style: 'blueWhite', text: 'Historial' }],
    ]
    
    ref.forEach(r => {
      datosRef.push([{ border: [true, false, false, false], style: 'small0', colSpan: 2, text: r.Agente_Economico }, {}, { border: [true, false, false, false], style: ['small0', 'right'], text: separator(r.Monto_Original) }, { border: [true, false, false, false], style: ['small0', 'center'], text: r.Fec_Ini_Relacion }, { border: [true, false, false, false], style: ['small0', 'right'], text: separator(r.Letra) }, { border: [true, false, false, false], style: ['small0', 'center'], text: r.Num_Pagos }, { border: [true, false, true, false], style: 'small0', text: r.Forma_Pago }])
      datosRef.push([{ border: [true, false, false, false], style: 'small', text: r.Relacion }, { border: [true, false, false, false], style: 'small', text: r.Referencia }, { border: [true, false, false, false], style: ['small', 'right'], text: separator(r.Saldo_Actual) }, { border: [true, false, false, false], style: ['small', 'center'], text: r.Fec_Actualizacion }, { border: [true, false, false, false], style: ['small', 'right'], text: separator(r.Monto_Utimo_Pago) }, { border: [true, false, false, false], style: ['small', 'center'], text: r.Dias_Atraso }, { border: [true, false, true, false], style: 'small', text: r.Historial }])
    })
    datosRef.push([{ colSpan: 7, border: [false, true, false, false], text: '' }])

    const datosRefC = [
      [{ style: 'blueWhite', text: 'Relación' }, { style: 'blueWhite', text: 'No. Referencia' }, { style: ['blueWhite', 'center'], text: 'Fec. Último Pago' }, { style: ['blueWhite', 'right'], text: 'Monto Original' }, { style: ['blueWhite', 'center'], text: 'Fec. Cancelación' }, { style: 'blueWhite', text: 'Historial' }],
    ]

    refC.forEach(r => {
      datosRefC.push([{ border: [true, false, false, false], style: ['small', { bold: true }], text: 'Agente Económico:' }, { colSpan: 5, border: [true, false, true, false], style: 'small', text: r.Agente_Economico }])
      datosRefC.push([{ border: [true, false, false, false], style: 'small0', text: r.Relacion }, { border: [true, false, false, false], style: ['small0'], text: r.Referencia }, { border: [true, false, false, false], style: ['small0', 'center'], text: '' }, { border: [true, false, false, false], style: ['small0', 'right'], text: separator(0) }, { border: [true, false, false, false], style: ['small0', 'center'], text: r.Fec_Cancelacion }, { border: [true, false, true, false], style: 'small0', text: r.Historial }])
      datosRefC.push([{ border: [true, false, false, false], style: ['small', { bold: true }], text: 'Observación:' }, { colSpan: 5, border: [true, false, true, false], style: 'small', text: r.Observacion }])
    })
    datosRefC.push([{ colSpan: 6, border: [false, true, false, false], text: '' }])

    // pageOrientation: 'landscape',
    // footer: function(currentPage, pageCount) { return currentPage.toString() + ' of ' + pageCount; },
    // header: function(currentPage, pageCount, pageSize) {
    //   // you can apply any logic and return any valid pdfmake element

    //   return [
    //     { text: 'simple text', alignment: (currentPage % 2) ? 'left' : 'right' },
    //     { canvas: [ { type: 'rect', x: 170, y: 32, w: pageSize.width - 170, h: 40 } ] }
    //   ]
    // },

    const dd = {
      pageSize: 'LETTER',
      pageMargins: 20,

      content: [
        {
          text: 'REPORTE DE CRÉDITO',
          style: 'header'
        },
        { text: 'www.fiinanservs.com', link: 'https:www//finanservs.com', style: { fontSize: 8, alignment: 'center', color: 'blue' } },
        '\n\n',
        {
          style: 'tableExample',
          table: {
            widths: [100, 150, 90, 70, 110],
            body: [  
              [{ style: 'blueWhite', text: 'Nombre:' }, { text: gen.Nombre + ' ' + gen.Apellido, style: 'small1' }, { border: [false, false, false, false], text: '' }, { style: ['blueWhite', 'right'], text: 'Fecha: ' }, { style: 'small1', text: hoyes }],
              [{ style: 'blueWhite', text: 'Identificación:' }, { text: gen.Id, style: 'small1' }, { border: [false, false, false, false], text: '' }, { border: [false, false, false, false], text: '' }, { border: [false, false, false, false], text: '' }],
              [{ style: 'blueWhite', text: 'Usuario Consulta:' }, { text: gen.Usuario, style: 'small1' }, { border: [false, false, false, false], text: '' }, { border: [false, false, false, false], text: '' }, { border: [false, false, false, false], text: '' }],
              [{ style: 'blueWhite', text: 'Asociado:' }, { text: gen.Asociado, style: 'small1' }, { border: [false, false, false, false], text: '' }, { border: [false, false, false, false], text: '' }, { border: [false, false, false, false], text: '' }],
            ]
          }
        },
        '\n',
        {
          table: {
            // headers are automatically repeated if the table spans over multiple pages
            // you can declare how many rows should be treated as headers
            widths: [150],
            body: [
              [{ text: 'Referencias Activas', style: 'blueWhite', border: [true, true, true, false] }],
            ]
          }
        },
        {
          layout: 'lightVerticalLines', // optional
          // style: 'blueWhite',
          table: {
            // headers are automatically repeated if the table spans over multiple pages
            // you can declare how many rows should be treated as headers
            // headerRows: 2,
            // widths: [ '*', 'auto', 100, '*' ],
            widths: [ 100, 70, 50, 50, 50, 50, '*' ],
            body: datosRef
          }
        },
        '\n',
        {
          table: {
            // headers are automatically repeated if the table spans over multiple pages
            // you can declare how many rows should be treated as headers
            widths: [150],
            body: [
              [{ text: 'Referencias Canceladas', style: 'blueWhite', border: [true, true, true, false] }],
            ]
          }
        },
        {
          // layout: 'lightVerticalLines', // optional
          // style: 'blueWhite',
          table: {
            // headers are automatically repeated if the table spans over multiple pages
            // you can declare how many rows should be treated as headers
            // headerRows: 2,
            // widths: [ '*', 'auto', 100, '*' ],
            widths: [ 120, 50, 50, 50, 50, '*' ],
            body: datosRefC
          }
        },
        '\n\n',
        {
          // under NodeJS (or in case you use virtual file system provided by pdfmake)
          // you can also pass file names here
          image: './public/images/leer-historial-apc.png',
          width: 300,
          height: 200,
          alignment: 'center'
        }
      ],
      styles: {
        header: {
          fontSize: 12,
          bold: true,
          alignment: 'center'
        },
        subheader: {
          fontSize: 10,
          bold: true
        },
        quote: {
          italics: true
        },
        small0: {
          fontSize: 7,
          fillColor: '#dddddd',
        },
        small1: {
          fontSize: 7,
        },
        small: {
          fontSize: 7,
          fillColor: '#eeeeee',
        },
        blueWhite: {
          fillColor: '#00007b',
          color: 'white',
          fontSize: 8,
          bold: true
        },
        center: {
          alignment: 'center'
        },
        right: {
          alignment: 'right'
        }
      }
    }

    var fonts = {
      Roboto: {
          normal: './public/fonts/Roboto-Regular.ttf',
          bold: './public/fonts/Roboto-Medium.ttf',
          italics: './public/fonts/Roboto-Italic.ttf',
          bolditalics: './public/fonts/Roboto-MediumItalic.ttf'
      }
    };

    let fileName = path.join(`./pdfs/tmp-pdf-${Date.now()}.pdf`)

    const printer = new pdfPrinter(fonts)
    var pdfDoc = printer.createPdfKitDocument(dd);
    pdfDoc.pipe(fs.createWriteStream(fileName)).on('finish',function(){
        //success
    });
    pdfDoc.end();

    res.json({'fileName': fileName})
  } catch(err)  {
    console.log(err)
  }
})

fileRoutes.post('/authApcPDF', async (req, res) => {

  const { body } = req
  const { nombre, cedula, sign }  = body
  const fecha = 'Panamá, ' + new Date().toLocaleDateString()

    const dd = {
      pageSize: 'LETTER',
      pageMargins: [40,40,40,40],

      content: [
        { text: 'AUTORIZACIÓN DE LA APC\n\n', style: 'header' },

        { text: fecha }, '\n\n',
        'Señores\n',
        'ACsoraT, S. A.\n',
        'Panamá\n\n',

        {
          layout: 'noBorders',
          table: {
            // headers are automatically repeated if the table spans over multiple pages
            // you can declare how many rows should be treated as headers
            widths: ['auto','*'],
            body: [
              ['Estimado señor: ', { text: nombre, bold: true }],
            ]
          }
        },
        { text: 'Por este medio autorizo(amos) expresamente a ACsoraT, S. A., sus subsidiarias y/o afiliadas, cesionarios o sucesoras, así como cualquier compañía que por operación de cesión, administración o compra de cartera adquiera los derechos de mi crédito, a que de conformidad con lo expresado en el artículo 24 y demás disposiciones aplicables de la Ley 24 de 22 de mayo de 2002, solicite, consulte, recopile, intercambie y transmita a cualquier agencia de información de datos, bancos o agentes económicos informaciones relacionadas con obligaciones o transacciones crediticias que mantengo o pudiera mantener con dichos agentes económicos de la localidad, sobre mi(nuestros) historial de crédito y relaciones con acreedores. También queda facultado el ACsoraT, S. A., sus subsidiarias y/o afiliadas, cesionarios o sucesoras, así como cualquier compañía que por una operación de cesión, administración o compra de cartera adquiera los derechos de mi crédito, a que solicite y obtenga información de instituciones gubernamentales relacionadas con las obligaciones o transacciones crediticias arriba referidas. Así mismo, exonero(amos) de cualquier consecuencia o responsabilidad resultante del ejercicio de solicitar o suministrar información, o por razón de cualesquiera autorizaciones contenidas en la presente carta, al ACsoraT, S. A, a sus compañías afiliadas, subsidiarias, cesionarios y/o sucesoras, a sus empleados, ejecutivos, directores dignatarios o apoderados, así como cualquier compañía que por una operación de cesión, administración o compra de cartera adquiera los derechos de mi crédito.\n\n\n', style: 'detail' },
        'Atentamente\n',

        {
          layout: 'noBorders',
          table: {
            // headers are automatically repeated if the table spans over multiple pages
            // you can declare how many rows should be treated as headers
            widths: ['auto','*'],
            body: [
              ['Nombre: ', { text: nombre, decoration: 'underline' }],
            ]
          }
        },
        {
          layout: 'noBorders',
          table: {
            // headers are automatically repeated if the table spans over multiple pages
            // you can declare how many rows should be treated as headers
            widths: ['auto','*'],
            body: [
              ['Cédula: ', { text: cedula, decoration: 'underline' }],
            ]
          }
        },
        '\n\n',
        'Fundamento legal: Ley 24 de 22 de mayo de 2002.',
        '\n',
        {
          // under NodeJS (or in case you use virtual file system provided by pdfmake)
          // you can also pass file names here
          image: sign,
          width: 150,
          height: 75,
          alignment: 'center'
        }
      ],
      styles: {
        header: {
          fontSize: 14,
          bold: true,
          alignment: 'center'
        },
        detail: {
          fontSize: 12,
          bold: false,
          alignment: 'justify'
        },
      }
    }

    var fonts = {
      Roboto: {
          normal: './public/fonts/Roboto-Regular.ttf',
          bold: './public/fonts/Roboto-Medium.ttf',
          italics: './public/fonts/Roboto-Italic.ttf',
          bolditalics: './public/fonts/Roboto-MediumItalic.ttf'
      }
    };

    let fileName = path.join(`./pdfs/tmp-pdf2-${Date.now()}.pdf`)

    const printer = new pdfPrinter(fonts)
    var pdfDoc = printer.createPdfKitDocument(dd);
    pdfDoc.pipe(fs.createWriteStream(fileName)).on('finish',function(){
        //success
    });
    pdfDoc.end();

    res.json({'fileName': fileName})
})

module.exports = fileRoutes
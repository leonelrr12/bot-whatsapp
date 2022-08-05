const mimeDb = require('mime-db')
const fs = require('fs')

/**
 * Guardamos archivos multimedia que nuestro cliente nos envie!
 * @param {*} media 
 */


const saveMedia = (media) => {
    const extensionProcess = mimeDb[media.mimetype]
    let fileNamePath = ''
    if(extensionProcess) {
        const ext = extensionProcess.extensions[0]
        fileNamePath = `./media/${Date.now()}.${ext}`
        fs.writeFile(fileNamePath, media.data, { encoding: 'base64' }, function (err) {
            if(err) return ''
            console.log('** Archivo Media Guardado **');
        });
    }
    return fileNamePath
}

module.exports = {saveMedia}
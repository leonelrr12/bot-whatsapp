const isValidFile = (nameFile) => {

    if (!nameFile) return false
    const resp = nameFile.split('.')
    if (resp.length < 2) return false

    const ext = 'pdf png jpg jpeg'
    if (ext.includes(resp.pop())) return true

    return false
}

module.exports = isValidFile
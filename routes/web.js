const express = require('express');
const router = express.Router()
const { getQr } = require('../controllers/web')

router.use('/qr', getQr)
router.get('/', getQr)

module.exports = router
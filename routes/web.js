const express = require('express');
const router = express.Router()
const axios = require('axios');
const { getQr } = require('../controllers/web')

router.use('/qr', getQr)

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

module.exports = router
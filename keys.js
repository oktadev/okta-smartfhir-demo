'use strict';
const serverless = require('serverless-http')
const express = require('express')
const app = express()
const pem2jwk = require('pem-jwk').pem2jwk
const fs = require('fs');

//This is just a helper function to get the JWKS public key that will need to be specified on all public (not trusted) apps.
//Keys Endpoint - This is the public keys endpoint that will publish our public signing key.
app.get('/keys', function (req, res) {
  var signingKeyPublic = fs.readFileSync('public_key.pem')
  var jwkPublic = pem2jwk(signingKeyPublic)
  res.send({ keys: [jwkPublic] })
})

module.exports.keysEndpoint = serverless(app)
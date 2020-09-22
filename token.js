'use strict';
const serverless = require('serverless-http')
const express = require('express')
const app = express()
const axios = require('axios');
const bodyParser = require('body-parser')

app.use(bodyParser.urlencoded({ extended: false }))

//Step 6- Token Proxy will take out the patient_id value in the token, and return it alongside the token instead.
app.post("/token", (request,response) => {
  const tokenEndpoint = process.env.AUTHZ_ISSUER + '/v1/token';

  console.log('Token proxy called.')
  console.log('Calling real /token endpoint at Okta.')
  
  //TODO: We shouldn't know the app's client secret- use private key auth instead.
  var formData = 'client_id=' +
                 request.body.client_id +
                 '&client_secret=' +
                 process.env.APP_CLIENT_SECRET + //Since client secret is evidently optional in SMART, let's pass in the client secret here.
                 '&grant_type=authorization_code&redirect_uri=' +
                 request.body.redirect_uri +
                 '&code=' +
                 request.body.code;
  
  console.log("Body to send to Okta:")
  console.log(formData)
  
  axios.request({
		'url': tokenEndpoint,
		'method': 'post',
		'headers': {'Content-Type': 'application/x-www-form-urlencoded'},
		'data': formData
	})
  .then((oktaResponse) => {
    console.log('Response from Okta:')
    console.log(oktaResponse.data)

    get_return_claims(get_access_token_payload(oktaResponse.data.access_token), oktaResponse.data)
    console.log('Final /token response:')
    console.log(oktaResponse.data)
    response.set('Cache-Control','no-store')
    response.set('Pragma','no-cache')
    response.send(oktaResponse.data)

  })
  .catch((error) => {
    console.log(error);
    response.status(400).send(error)
  });
  
})

//Helper functions for the token proxy
function get_access_token_payload(jwt) {
	var base64Payload = jwt.split('.')[1];
	var buff = new Buffer(base64Payload, 'base64');
	var payloadText = buff.toString('utf-8');
	var payloadObj = JSON.parse(payloadText)
	console.log("Parsed Access Token:")
	console.log(payloadObj)
	return payloadObj
}

function get_return_claims(jwt_payload, response_body) {
	for (var claim in jwt_payload) {
		if (jwt_payload.hasOwnProperty(claim)) {
			console.log(claim + " -> " + jwt_payload[claim]);
			if(claim.startsWith('launch_response')) {
				//We need to include this in our body.
				response_body[claim.replace('launch_response_','')] = jwt_payload[claim];
			}
		}
	}
}

module.exports.smartTokenProxy = serverless(app)
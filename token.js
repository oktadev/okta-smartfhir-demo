'use strict';
const serverless = require('serverless-http')
const express = require('express')
const app = express()
const axios = require('axios');
const bodyParser = require('body-parser')
const njwt = require('njwt')
const fs = require('fs');

app.use(bodyParser.urlencoded({ extended: false }))

//Step 6- Token Proxy will take out the patient_id value in the token, and return it alongside the token instead.
//This is also where we handle public applications that need tokens.
app.post("/token", (request,response) => {
  const tokenEndpoint = process.env.AUTHZ_ISSUER + '/v1/token';

  console.log('Token proxy called.')
  console.log('Calling real /token endpoint at Okta.')
  
  //3 valid scenarios I need to implement:
  //1- Public client, access code request
  //2- Confidential client, access code request
  //3- Confidential client, refresh token request
  //4- **FUTURE** public client w/ PKCE refresh token request
  
  //TODO - this formData assumes a public client, so we're building a JWT for client authentication.
  //Need to implement the other 2 scenarios.
  var formData = 'client_assertion=' +
                 get_private_key_jwt(request.body.client_id,tokenEndpoint) +
                 '&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer' +
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

//Read any claims that begin with "launch_response", and return them alongside the access token.
//Note that we're not modifying the token- the requested claim is still in the token.
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

//In the case of a "public" app, the SMART spec designates that client secret is optional when calling the token endpoint.
//Since that's not ideal, and Okta doesn't support it, we're instead going to use private_key_jwt validation between this proxy and Okta, 
//using a shared public/private key pair for all public apps.
function get_private_key_jwt(client_id, token_endpoint) {
	const clientId = client_id;
	const now = Math.floor( new Date().getTime() / 1000 );
	const plus5Minutes = new Date( ( now + (5*60) ) * 1000);
	var signingKeyPrivate = fs.readFileSync('private_key.pem')
  
	const claims = {
		aud: token_endpoint, // audience, which is the authz server.
	};

	const jwt = njwt.create(claims, signingKeyPrivate, "RS256")
		.setIssuedAt(now)
		.setExpiration(plus5Minutes)
		.setIssuer(clientId)
		.setSubject(clientId)
		.compact();

	console.log ('Generated JWT used for client authentication for a public app:')
	console.log(jwt)
	return jwt
}

module.exports.smartTokenProxy = serverless(app)
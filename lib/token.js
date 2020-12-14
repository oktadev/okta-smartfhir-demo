'use strict';
const axios = require('axios');
const njwt = require('njwt');
const fs = require('fs');
const querystring = require('querystring');
const cors = require('cors');

//Step 6- Token Proxy will take out the patient_id value in the token, and return it alongside the token instead.
//This is also where we handle public applications that need tokens.
module.exports.tokenHandler = async (tokenRequestBody, tokenRequestHeaders) => {
	const tokenEndpoint = process.env.AUTHZ_ISSUER + '/v1/token';

	console.log('Token proxy called.')
	console.log('Calling real /token endpoint at Okta.')

	//Get the proper Okta /token request based upon the situation.
	var formData = get_okta_token_request(querystring.parse(tokenRequestBody), tokenRequestHeaders, tokenEndpoint)

	console.log("Body to send to Okta:")
	console.log(formData)
	if(formData) {
		try {
			const oktaResponse = await axios.request({
				'url': tokenEndpoint,
				'method': 'post',
				'headers': {'Content-Type': 'application/x-www-form-urlencoded'},
				'data': formData
			})
			console.log('Response from Okta:')
			console.log(oktaResponse.data)

			get_return_claims(get_access_token_payload(oktaResponse.data.access_token), oktaResponse.data)
			console.log('Final /token response:')
			console.log(oktaResponse.data)

			return {
				statusCode: 200,
				body: oktaResponse.data
			}
		}
		catch(error) {
			console.log("Error while calling Okta:")
			console.log(error)
			if(error.isAxiosError) { //Error from Okta, or while calling Okta.
				return {
					statusCode: error.response.status,
					body: error.response.data
				}
			}
			else {
				throw error
			}

		}
	}
	else {
		return{
			statusCode: 400,
			body: 'An invalid token request was made. This authorization server does not support public client refresh tokens without PKCE.'
		}
	}
}

//Helper functions for the token proxy
function get_access_token_payload(jwt) {
	var base64Payload = jwt.split('.')[1];
	var buff = Buffer.from(base64Payload, 'base64');
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

function get_okta_token_request(requestBody, requestHeaders, tokenEndpoint) {
  //3 valid scenarios:
  //1- Public client, access code request
  //2- Confidential client, access code request
  //3- Confidential client, refresh token request
  //4- **FUTURE** public client w/ PKCE refresh token request
	var clientId = ''
	var clientSecret = ''
	var confidentialClient = false
	
	//Handle the multiple ways the client id/secret can come in.
	if(requestHeaders['Authorization']){
		var regex = /\s*basic\s*(.+)/i;
		var credentials = requestHeaders.Authorization.match(regex)[1];
		var buff = Buffer.from(credentials, 'base64')
		var authString = buff.toString('utf-8')
		clientId = authString.split(':')[0]
		clientSecret = authString.split(':')[1]
		confidentialClient = true
	}
	if(requestBody.client_secret) {
		clientSecret = requestBody.client_secret
		confidentialClient = true
	}
	if(requestBody.client_id) {
		clientId = requestBody.client_id
	}
	
	//Scenario 1 - public client, initial authz.
	if(requestBody.grant_type == 'authorization_code' && !confidentialClient) {
		return 'client_assertion=' +
			get_private_key_jwt(clientId, tokenEndpoint) +
			'&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer' +
			'&grant_type=authorization_code&redirect_uri=' +
			process.env.GATEWAY_URL + '/smart_proxy_callback' +
			'&code=' +
			requestBody.code;
	}
	//Scenario 2 - confidential client, initial authz.
	else if(requestBody.grant_type == 'authorization_code' && confidentialClient) {
		return 'client_id=' +
			clientId +
			'&client_secret=' +
			clientSecret +
			'&grant_type=authorization_code&redirect_uri=' +
			process.env.GATEWAY_URL + '/smart_proxy_callback' +
			'&code=' +
			requestBody.code;
	}
	//Scenario 3 - confidential client, refresh token.
	else if(requestBody.grant_type == 'refresh_token' && confidentialClient) {
		var formData = 'client_id=' +
			clientId +
			'&client_secret=' +
			clientSecret +
			'&grant_type=refresh_token&refresh_token=' +
			requestBody.refresh_token
		if(requestBody.scope) {
			formData += '&scope=' + requestBody.scope
		}
		return formData
	}
	else {
		return false
	}  
}
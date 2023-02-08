'use strict';
const axios = require('axios');
const njwt = require('njwt');
const fs = require('fs');
const querystring = require('querystring');
const okta = require('@okta/okta-sdk-nodejs');

//Introspect handler.  We really only need this because the SMART framework requires the launch response stuff to be in the introspect response.
module.exports.introspectHandler = async (requestHeaders, requestBody) => {
	var clientId = ''
	var clientSecret = ''
	var clientAssertion = ''
	var clientAssertionType = ''

	var authorizationHeader = requestHeaders[Object.keys(requestHeaders).find(key => key.toLowerCase() === 'authorization')];
	var requestBodyObj = querystring.parse(requestBody)

	console.log('Introspect proxy called.')
	console.log('Calling real /introspect endpoint at Okta.')

	//Handle the multiple ways the client id/secret can come in.
	//TODO: Both the introspect proxy, as well as the token proxy- both have to normalize client_id/client_secret.
	//This logic could be refactored into a shared function for normalizing client authentication.
	if(authorizationHeader){
		var regex = /\s*basic\s*(.+)/i;
		var credentials = authorizationHeader.match(regex)[1];
		var buff = Buffer.from(credentials, 'base64')
		var authString = buff.toString('utf-8')
		clientId = authString.split(':')[0]
		clientSecret = authString.split(':')[1]
	}
	if(requestBodyObj.client_secret) {
		clientSecret = requestBodyObj.client_secret
	}
	if(requestBodyObj.client_id) {
		clientId = requestBodyObj.client_id
	}

	//At this point we've found any combination of client_id/client_secret either in the body, or authorization header.
	//We're going to stuff them both in the request body for consistency's sake.
	if(clientId && clientSecret) {
		console.log('Found shared secret authentication. Using with Okta...')
		requestBodyObj.client_id = clientId
		requestBodyObj.client_secret = clientSecret
	}
	else if(requestBodyObj.client_assertion && requestBodyObj.client_assertion_type) {
		console.log('Found private_key_jwt authentication. Using with Okta...')
	}
	else {
		//They haven't passed in client id/secret, nor did they pass in private_key_jwt authentication.
		//Let's add our own private_key_jwt authentication.
		//This is due to Okta requiring client authentication for /introspect, and in SMART launch client authentication is optional.
		console.log('No client authentication found.  Adding client authentication...')
		const jwks =JSON.parse(fs.readFileSync(process.env.OKTA_API_PRIVATEKEYFILE, 'utf-8')); 
		const client = new okta.Client({
			orgUrl: `https://${process.env.BASE_DOMAIN}`,
			authorizationMode: 'PrivateKey',
			clientId: process.env.OKTA_API_CLIENTID,
			scopes: ['okta.apps.read'],
			privateKey: jwks
		});
	
		console.log('Okta introspect JWT:')
		const jwt = await client.oauth.getJwt(process.env.INTERNAL_INTROSPECT_RELATIVE_ENDPOINT)
		console.log(jwt)

		requestBodyObj.client_assertion_type = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
		requestBodyObj.client_assertion = jwt
	}

	var requestOptions = {
		'url': process.env.INTERNAL_INTROSPECT_URL,
		'method': 'post',
		'headers': {'Content-Type': 'application/x-www-form-urlencoded', 'Host': process.env.BASE_DOMAIN},
		'data': querystring.stringify(requestBodyObj)
	}

	console.log("Request to send to Okta:")
	console.log(requestOptions)

	try {
		const oktaResponse = await axios.request(requestOptions)
		console.log('Response from Okta:')
		console.log(oktaResponse.data)
		var accessTokenPayload = get_access_token_payload(querystring.parse(requestBody).token)
		update_return_claims(accessTokenPayload, oktaResponse.data)

		console.log('Final /introspect response:')
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

//Helper functions for the token proxy
//Decode the access token so we can read out any of the launch_response parameters provided in the token.
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
function update_return_claims(jwt_payload, response_body) {
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

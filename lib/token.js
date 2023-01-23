'use strict';
const axios = require('axios');
const njwt = require('njwt');
const fs = require('fs');
const querystring = require('querystring');

//Step 6- Token Proxy will take out the patient_id value in the token, and return it alongside the token instead.
//This is also where we handle public applications that need tokens.
module.exports.tokenHandler = async (tokenRequestBody, tokenRequestHeaders) => {
	const tokenEndpoint = process.env.INTERNAL_TOKEN_URL;

	console.log('Token proxy called.')
	console.log('Calling real /token endpoint at Okta.')

	//Get the proper Okta /token request based upon the situation.
	var formData = get_okta_token_request(querystring.parse(tokenRequestBody), tokenRequestHeaders, tokenEndpoint)

	console.log("Body to send to Okta:")
	console.log(formData)
	if(formData) {
		try {
			//We're invoking the /token endpoint on Okta- but we're calling the "internal" custom domain URL, behaving as a proxy.
			const oktaResponse = await axios.request({
				'url': tokenEndpoint,
				'method': 'post',
				'headers': {'Content-Type': 'application/x-www-form-urlencoded', 'Host': process.env.BASE_DOMAIN},
				'data': formData
			})
			console.log('Response from Okta:')
			console.log(oktaResponse.data)
			var accessTokenPayload = get_access_token_payload(oktaResponse.data.access_token)
			if(accessTokenPayload.hasOwnProperty('valid_consent')) {
				update_return_claims(accessTokenPayload, oktaResponse.data)

				var refreshCacheObject = get_refresh_token_cache_data(accessTokenPayload)
				console.log('Final /token response:')
				console.log(oktaResponse.data)

				return {
					statusCode: 200,
					body: oktaResponse.data,
					refreshCacheObject: refreshCacheObject
				}
			}
			else { //The token is missing the "validated_consent" claim.  If this claim is missing, we cannot trust that the user consented to the access.
				return {
					statusCode: 400,
					body: 'Unable to validate user consent.'
				}
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

//If a refresh token is granted, we need to cache the selected patient id so we can get it again later when
//the token is refreshed.
function get_refresh_token_cache_data(accessTokenPayload) {
	console.log('Determining if refresh token cache is needed.')
	if(accessTokenPayload.scp.includes('offline_access') && accessTokenPayload.launch_response_patient) {
		console.log('Request contains refresh token and patient selection - updating cache...')
		var refreshTokenJTI = accessTokenPayload.jti.split('.')[2]
		console.log('Refresh token JTI:' + refreshTokenJTI)
		console.log('Patent ID to cache:' + accessTokenPayload.launch_response_patient)

		return {
			token_id: refreshTokenJTI,
			patient_id: accessTokenPayload.launch_response_patient
		}
	}
	else {
		console.log('No refresh token found.. no cache necessary.')
		return null
	}
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

function get_okta_token_request(requestBody, requestHeaders, tokenEndpoint) {
	//Pass the proper data to Okta that has been sent to the token proxy.

	//These two variables can come either from the authorization header, or also from the request body.
	var clientId = ''
	var clientSecret = ''

	var authorizationHeader = requestHeaders[Object.keys(requestHeaders).find(key => key.toLowerCase() === 'authorization')];

	var formBody = ''

	//Handle the multiple ways the client id/secret can come in.
	if(authorizationHeader){
		var regex = /\s*basic\s*(.+)/i;
		var credentials = authorizationHeader.match(regex)[1];
		var buff = Buffer.from(credentials, 'base64')
		var authString = buff.toString('utf-8')
		clientId = authString.split(':')[0]
		clientSecret = authString.split(':')[1]
	}
	if(requestBody.client_secret) {
		clientSecret = requestBody.client_secret
	}
	if(requestBody.client_id) {
		clientId = requestBody.client_id
	}

	//Start off by putting in our grant_type, common to all requests.
	formBody = 'grant_type=' + requestBody.grant_type

	//Add client authentication
	//Client Secret authentication
	if(clientSecret) {
		formBody += '&client_id=' +
			clientId +
			'&client_secret=' +
			clientSecret
	}
	//Private Key JWT Authentication
	else if(requestBody.client_assertion) {
		formBody += '&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer&client_assertion=' + requestBody.client_assertion
	}
	//No Authentication
	else {
		formBody += '&client_id=' + clientId
	}

	//If PKCE was used, pass that through.
	if(requestBody.code_verifier) {
		formBody += '&code_verifier=' + requestBody.code_verifier
	}

	//Add in the authz code and redirect_uri if that's the situation we're in.
	if(requestBody.code) {
		formBody += '&code=' + requestBody.code +
			'&redirect_uri=' + process.env.SMART_PROXY_CALLBACK_URL
	}

	if(requestBody.scope) {
		formBody += '&scope=' + requestBody.scope
	}

	if(requestBody.refresh_token) {
		formBody += '&refresh_token=' + requestBody.refresh_token
	}

	return formBody
}

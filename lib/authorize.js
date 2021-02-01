'use strict';
const cookieSignature = require('cookie-signature')
const cookie = require('cookie')
const { v4: uuidv4 } = require('uuid')
const axios = require('axios');

// Step 1 - Authorize request, store the original request in a signed cookie, and login to the person/consent picker page instead.
// For the consent/patient picker, we'll just use the openid,email,profile scopes.
// We also need to validate the redirect_uri here because we're not sending it to Okta- we're sending Okta a proxy instead.
module.exports.authorizeHandler = async (requestQuerystring) => {

	//Cache Client_id, state, scopes, redirect_uri into a signed cookie
	var inboundRequest = {
		client_id: requestQuerystring.client_id,
		state: requestQuerystring.state,
		scope: requestQuerystring.scope.split(' '),
		redirect_uri: requestQuerystring.redirect_uri
	};
	
	//Validate the "aud" parameter as part of the SMART launch framework requirements. If it's not included, or it's not matching the our audience value, reject the request.
	var audParam = requestQuerystring.aud;
	if(!audParam || audParam !== process.env.EXPECTED_AUD_VALUE) {
		console.log('An invalid audience was specified on the authorize request.');
		console.log('Required aud:' + process.env.EXPECTED_AUD_VALUE)
		console.log('Actual Aud:' + audParam)
		return {
			statusCode: 400,
			body: 'An invalid audience was specified on the authorize request.',
			location: null,
			origRequestCookie: null,
			pickerAuthzCookie: null
		}
	}
	
	try {
		var validationResponse = await validateRedirectURL(requestQuerystring.client_id, requestQuerystring.redirect_uri)
	}
	catch(validationError) {
		console.log(validationError)
		return {
			statusCode: 400,
			body: 'Unable to validate the redirect_uri passed in.',
			location: null,
			origRequestCookie: null,
			pickerAuthzCookie: null
		}		
	}
	console.log('Inbound data to be cached off for later:');
	console.log(inboundRequest);

	var origRequestCookieSigned = cookieSignature.sign(JSON.stringify(inboundRequest), process.env.STATE_COOKIE_SIGNATURE_KEY)

	var pickerAuthzState = uuidv4();

	//For the picker app to properly validate the OAuth2 state we need to cache that off in a signed cookie as well.
	var pickerAuthzStateCookieSigned = cookieSignature.sign(pickerAuthzState, process.env.STATE_COOKIE_SIGNATURE_KEY)

	//Build person picker authz request
	var picker_auth_url = process.env.AUTHZ_ISSUER + '/v1/authorize' + 
		'?client_id=' +
		process.env.PICKER_CLIENT_ID +
		'&response_type=code&scope=openid%20profile%20email&redirect_uri=' +
		process.env.GATEWAY_URL + '/picker_oidc_callback' +
		'&state=' +
		pickerAuthzState;

	console.log('Redirecting the user to: ' + picker_auth_url);
	return {
		statusCode: 302,
		location: picker_auth_url,
		body: null,
		origRequestCookie: origRequestCookieSigned,
		pickerAuthzCookie: pickerAuthzStateCookieSigned
	}
}

//Step 2- Log the user into Okta and the patient picker, and send their access token down. 
//With it they can post back here with their consent decisions.
module.exports.pickerCallbackHandler = async (requestQuerystring, cookieString) => {
	var authCode = requestQuerystring.code;
	var cookies = cookie.parse(cookieString)
	var formData = 'client_id=' +
		process.env.PICKER_CLIENT_ID +
		'&client_secret=' +
		process.env.PICKER_CLIENT_SECRET +
		'&grant_type=authorization_code&redirect_uri=' +
		process.env.GATEWAY_URL + '/picker_oidc_callback' +
		'&code=' +
		authCode;

	//Validate state passed to Okta in step 1.
	var origState = cookieSignature.unsign(cookies.pickerAuthzState, process.env.STATE_COOKIE_SIGNATURE_KEY)
	var finalState = requestQuerystring.state;
	console.log('Original State: ' + origState + ' Final State: ' + finalState)

	if(!origState || !finalState || origState != finalState) {
		return {
			statusCode: 400,
			body: 'Invalid OAuth2 state detected!',
			location: null,
			apiAccessTokenCookie: null
		}
	}

	console.log('Patient picker OIDC endpoint called with code: ' + authCode);
	
	try {
		//Call the Okta /token endpoint to get the access token for the consent/patient picker app.
		var oktaResponse = await axios.request({
			url: process.env.AUTHZ_ISSUER + '/v1/token',
			method: 'post',
			headers: {'Content-Type': 'application/x-www-form-urlencoded'},
			data: formData
		});
		
		console.log('Token endpoint call successful. Access token: ' + oktaResponse.data.access_token);
		console.log('Sending the user to the patient/consent picker.')
		var apiAccessTokenCookieSigned = cookieSignature.sign(oktaResponse.data.access_token, process.env.STATE_COOKIE_SIGNATURE_KEY)
		return {
			statusCode: 302,
			body: null,
			location: process.env.GATEWAY_URL + '/patient_authorization',
			apiAccessTokenCookie: apiAccessTokenCookieSigned
		}
	}
	catch(error) {
		console.log(error)
		if(error.isAxiosError) { //Error from Okta- pass it through- otherwise log and throw.
			return {
				statusCode: error.response.status,
				body: error.response.data,
				location: null,
				apiAccessTokenCookie: null
			}
		}
		else {
			throw error
		}
	}
}

//Step 6- Final OAuth2 callback proxy.
//When Okta validates the inbound authz request and mints the final OAuth2 authorization code, it will first be posted here.
//This method will return the code back to the original app.
module.exports.authorizeCallbackHandler = async (requestQuerystring, cookieString) => {
	var cookies = cookie.parse(cookieString)
	var origRequest = JSON.parse(cookieSignature.unsign(cookies.origRequest, process.env.STATE_COOKIE_SIGNATURE_KEY))
	var appProxyAuthzState = cookieSignature.unsign(cookies.appProxyAuthzState, process.env.STATE_COOKIE_SIGNATURE_KEY)
	
	console.log("State sent to Okta:")
	console.log(appProxyAuthzState)
	
	console.log("State received from Okta:")
	console.log(requestQuerystring.state)
	
	//Validate the signed JWT state from the picker app.
	//Don't need to actually introspect it or anything, 
	//but we need to make sure it exists and matches what the patient picker sent.
	if(appProxyAuthzState && requestQuerystring.state && appProxyAuthzState == requestQuerystring.state) {
		//Redirect the user to the original redirect_uri with the original state.
		var final_redirect_url = origRequest.redirect_uri + 
			'?code=' +
			requestQuerystring.code +
			'&state=' +
			origRequest.state //We need to pass back their original state, and not the JWT we generated.

		//Redirecting the user back to the app.
		return {
			statusCode: 302,
			location: final_redirect_url,
			body: null
		}
	}
	else {
		return {
			statusCode: 400,
			body: 'Invalid OAuth2 state detected!',
			location: null
		}
	}
}


//This is used to validate to ensure that the redirect_uri sent in by the user is actually valid for the app.
//The DISABLE_REDIRECT_URI_VALIDATION can be specified in serverless.yml and set to "true" to disable this check- FOR DEMO PURPOSES ONLY!  
//This check is a key defense against vulnerabilities.
function validateRedirectURL(client_id, redirect_uri) {
	const clientEndpoint = 'https://' + process.env.OKTA_ORG + '/oauth2/v1/clients/' + client_id
	console.log('Retrieving client information from Okta.')

	let promise = new Promise(function(resolve, reject) {
		if(process.env.DISABLE_REDIRECT_URI_VALIDATION) {
			resolve(true)
		}
		axios.request({
			'url': clientEndpoint,
			'method': 'get',
			'headers': {'Authorization': 'SSWS ' + process.env.API_KEY},
		  })
		.then((oktaResponse) => {
			console.log('Response from Okta:')
			console.log(oktaResponse.data)
			if(oktaResponse.data.redirect_uris && oktaResponse.data.redirect_uris.includes(redirect_uri)) {
				resolve(true)
			}
			else {
				reject('Unable to validate the redirect_uri')
			}
		})
		.catch((error) => {
			console.log(error);
			reject(error)
		})
	})
	return promise
}
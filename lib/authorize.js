'use strict';
const cookieSignature = require('cookie-signature')
const cookie = require('cookie')
const { v4: uuidv4 } = require('uuid')
const okta = require('@okta/okta-sdk-nodejs');
const fs = require('fs');

// Authorize request, store the original request in a signed cookie, and login to the person/consent picker page instead.
// For the consent/patient picker, we'll just use the openid,email,profile scopes.
// We also need to validate the redirect_uri here because we're not sending it to Okta- we're sending Okta a proxy instead.
module.exports.authorizeHandler = async (requestQuerystring) => {

	//Cache Client_id, state, scopes, redirect_uri into a signed cookie
	var inboundRequest = {
		client_id: requestQuerystring.client_id,
		state: requestQuerystring.state,
		scope: requestQuerystring.scope.split(' '),
		redirect_uri: requestQuerystring.redirect_uri,
		code_challenge: requestQuerystring.code_challenge,
		code_challenge_method: requestQuerystring.code_challenge_method
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
	var picker_auth_url = `${process.env.OIDC_AUTHORIZE_URL}?client_id=${process.env.PICKER_CLIENT_ID}&response_type=code&scope=openid%20profile%20email&redirect_uri=${process.env.PICKER_CALLBACK_URL}&state=${pickerAuthzState}`;

	console.log('Redirecting the user to: ' + picker_auth_url);
	return {
		statusCode: 302,
		location: picker_auth_url,
		body: null,
		origRequestCookie: origRequestCookieSigned,
		pickerAuthzCookie: pickerAuthzStateCookieSigned
	}
}

//Final OAuth2 callback proxy.
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
		//We need to pass back their original state, and not the JWT we generated.
		var final_redirect_url = `${origRequest.redirect_uri}?code=${requestQuerystring.code}&state=${origRequest.state}` 

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
async function validateRedirectURL(client_id, redirect_uri) {
	console.log('Validating redirect uri...')
	console.log(`Redirect uri: ${redirect_uri}`)
	if(process.env.DISABLE_REDIRECT_URI_VALIDATION && process.env.DISABLE_REDIRECT_URI_VALIDATION == true) {
		console.log('Validation skipped due to configuration.')
		return true
	}
	else {
		const jwks =JSON.parse(fs.readFileSync(process.env.OKTA_API_PRIVATEKEYFILE, 'utf-8')); 
		const client = new okta.Client({
			orgUrl: `${process.env.OKTA_ORG}`,
			authorizationMode: 'PrivateKey',
			clientId: process.env.OKTA_API_CLIENTID,
			scopes: ['okta.apps.read'],
			privateKey: jwks
		});
	
		console.log(`Retrieving client information from Okta for client_id: ${client_id}`)
		const oktaResponse = await client.getApplication(client_id)
	
		console.log('Redirect URIs from Okta:')
		console.log(oktaResponse.settings.oauthClient.redirect_uris)
		if(oktaResponse.settings.oauthClient.redirect_uris && oktaResponse.settings.oauthClient.redirect_uris.includes(redirect_uri)) {
			return true
		}
		else {
			throw new Error('The redirect uri passed in is not present on the app within Okta.')
		}
	}
}
'use strict';

const serverless = require('serverless-http')
const express = require('express')
const cookieParser = require('cookie-parser')
const app = express()
const { v4: uuidv4 } = require('uuid')
const axios = require('axios');

app.use(cookieParser(process.env.STATE_COOKIE_SIGNATURE_KEY));

// Step 1 - Authorize request, store the original request in a signed cookie, and login to the person/consent picker page instead.
// For the consent/patient picker, we'll just use the openid,email,profile scopes.
// We also need to validate the redirect_uri here because we're not sending it to Okta- we're sending Okta a proxy instead.
app.get('/authorize', (request, response) => {

	//Cache Client_id, state, scopes, redirect_uri into a signed cookie
	var inboundRequest = {
		client_id: request.query.client_id,
		state: request.query.state,
		scope: request.query.scope.split(' '),
		redirect_uri: request.query.redirect_uri
	};

	validateRedirectURL(request.query.client_id, request.query.redirect_uri)
	.then((validationResponse) => {
		console.log('Inbound data to be cached off for later:');
		console.log(inboundRequest);

		response.cookie('origRequest', inboundRequest, {httpOnly: true, signed: true});

		var pickerAuthzState = uuidv4();

		//For the picker app to properly validate the OAuth2 state we need to cache that off in a signed cookie as well.
		response.cookie('pickerAuthzState', pickerAuthzState, {httpOnly: true, signed: true})

		//Build person picker authz request
		var picker_auth_url = process.env.AUTHZ_ISSUER + '/v1/authorize' + 
			'?client_id=' +
			process.env.PICKER_CLIENT_ID +
			'&response_type=code&scope=openid%20profile%20email&redirect_uri=' +
			process.env.GATEWAY_URL + '/picker_oidc_callback' +
			'&state=' +
			pickerAuthzState;

		console.log('Redirecting the user to: ' + picker_auth_url);
		response.redirect(picker_auth_url)			
	})
	.catch((error) => {
		console.log(error);
		response.status(400).send('Unable to validate the redirect_uri passed in.')
	})
});

//Step 2- Log the user into Okta and the patient picker, and send their access token down. 
//With it they can post back here with their consent decisions.
app.get('/picker_oidc_callback', (request, response) => {
	var authCode = request.query.code;
	var formData = 'client_id=' +
		process.env.PICKER_CLIENT_ID +
		'&client_secret=' +
		process.env.PICKER_CLIENT_SECRET +
		'&grant_type=authorization_code&redirect_uri=' +
		process.env.GATEWAY_URL + '/picker_oidc_callback' +
		'&code=' +
		authCode;

	//Validate state passed to Okta in step 1.
	var origState = request.signedCookies.pickerAuthzState;
	var finalState = request.query.state;
	console.log('Original State: ' + origState + ' Final State: ' + finalState)

	if(!origState || !finalState || origState != finalState) {
		response.status(400).send('Invalid OAuth2 state detected!')
	}

	console.log('Patient picker OIDC endpoint called with code: ' + authCode);
	
	//Call the Okta /token endpoint to get the access token for the consent/patient picker app.
	axios.request({
		url: process.env.AUTHZ_ISSUER + '/v1/token',
		method: 'post',
		headers: {'Content-Type': 'application/x-www-form-urlencoded'},
		data: formData
	})
	.then((oktaResponse) => {
		console.log('Token endpoint call successful. Access token: ' + oktaResponse.data.access_token);
		response.cookie('apiAccessToken', oktaResponse.data.access_token, {httpOnly: true, signed: true});

		console.log('Sending the user to the patient/consent picker.')
		response.redirect(process.env.GATEWAY_URL + '/patient_authorization')
	}, (error) => {
		console.log(error);
		response.status(500).send('Unable to properly log the user in.')
	});
})

//Step 6- Final OAuth2 callback proxy.
//When Okta validates the inbound authz request and mints the final OAuth2 authorization code, it will first be posted here.
//This method will return the code back to the original app.
app.get('/smart_proxy_callback', (request, response) => {
	var origRequest = request.signedCookies.origRequest;
	var appProxyAuthzState = request.signedCookies.appProxyAuthzState
	
	console.log("State sent to Okta:")
	console.log(appProxyAuthzState)
	
	console.log("State received from Okta:")
	console.log(request.query.state)
	
	//Validate the signed JWT state from the picker app.
	//Don't need to actually introspect it or anything, 
	//but we need to make sure it exists and matches what the patient picker sent.
	if(appProxyAuthzState && request.query.state && appProxyAuthzState == request.query.state) {
		//Redirect the user to the original redirect_uri with the original state.
		var final_redirect_url = origRequest.redirect_uri + 
			'?code=' +
			request.query.code +
			'&state=' +
			origRequest.state //We need to pass back their original state, and not the JWT we generated.

		//Redirecting the user back to the app.  
		response.cookie('origRequest', '', {maxAge: 0});
		response.cookie('appProxyAuthzState', '', {maxAge: 0});
		response.redirect(final_redirect_url)
	}
	else {
		response.status(400).send('Invalid OAuth2 state detected!')
	}
});


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

module.exports.smartAuthorizeProxy = serverless(app)
'use strict';
//This is an example of a custom scope consent and patient picker to be used as part of an Okta authentication
//and authorization flow.

const cookieSignature = require('cookie-signature')
const cookie = require('cookie')
const axios = require('axios');
const nunjucks = require('nunjucks');
const njwt = require('njwt');
const querystring = require('querystring');

nunjucks.configure('views', {
    autoescape: true
});

//Step 3 - Display the patient/scope picker application, and solicit a response.
module.exports.getHandler = async (cookieString) => {
	var cookies = cookie.parse(cookieString)
	var accessToken = cookieSignature.unsign(cookies.apiAccessToken, process.env.STATE_COOKIE_SIGNATURE_KEY)
	var origRequest = JSON.parse(cookieSignature.unsign(cookies.origRequest, process.env.STATE_COOKIE_SIGNATURE_KEY))
	var introspectResult, appInfo, scopeDefinitions, mockPatientResponse;

	console.log('User reached patient/consent picker app- calling patient access service with access token: ' + accessToken);
  
	//First validate our Okta login before we even show the consent screen.
	//Could move this to a JWT validator on the APIGW too.
	try {
		introspectResult = await introspect_token(accessToken)
		if(!introspectResult) {
			console.log('Introspection complete- token is not valid.')
			throw 'Token not valid'
		}
	}
	catch(error) {
		console.log(error)
	  	return {
			statusCode: 403,
			body: 'A valid access token was not provided.'
		}		
	}
	
	//Get our consent data from Okta.
	try {
		appInfo = await get_application_data(origRequest.client_id)
		scopeDefinitions = await get_scope_data(origRequest.scope)
	}
	catch(error) {
		console.log(error)
		return {
			statusCode: 500,
			body: 'Unable to retrieve requested scope definitions and client info from the authorization server.'
		}
	}
	
	if(origRequest.scope.includes('launch/patient') && !origRequest.scope.includes('skip_patient_selection')) {
		try {
			mockPatientResponse = await get_mock_patients()
			return {
				statusCode: 200,
				body: nunjucks.render('patient_authorization.html', { 
					patients: mockPatientResponse, 
					scopes: scopeDefinitions, 
					show_patient_picker: true,
					app_name: appInfo.applicationName,
					app_icon: appInfo.applicationLogo,
					gateway_url: process.env.GATEWAY_URL 
				})
			}
		}
		catch(error) {
			console.log(error);
			return {
				statusCode: 500,
				body: 'Unable to retrieve the patient list from the patient access service.'
			}
		}
	}
	else {
		return {
			statusCode: 200,
			body: nunjucks.render('patient_authorization.html', { 
				patients: null, 
				scopes: scopeDefinitions, 
				show_patient_picker: false,
				app_name: appInfo.applicationName,
				app_icon: appInfo.applicationLogo,
				gateway_url: process.env.GATEWAY_URL 
			})
		}
	}
}

//Step 4 - A patient and scope(s) have been selected by the user.
//We need to take the scope(s) requested, plus the patient_id selected, and we need to build a new authz request with it.
//In order to provide some trust in the process, we'll use a signed JWT as part of the authorize request back to Okta for the real app.
//The signed JWT will be validated in the token hook.  That will prevent someone from circumventing the picker by doing an 
//authorize directly against Okta.
module.exports.postHandler = async (requestBodyString, cookieString) => {
	var cookies = cookie.parse(cookieString)
	var accessToken = cookieSignature.unsign(cookies.apiAccessToken, process.env.STATE_COOKIE_SIGNATURE_KEY)
	var origRequest = JSON.parse(cookieSignature.unsign(cookies.origRequest, process.env.STATE_COOKIE_SIGNATURE_KEY))
	var consentBody = querystring.parse(requestBodyString)
	var introspectResult;
	
	//We also won't proceed unless they prove that they're actually logged into the patient picker app.
	//Again, could cut this out and do this at the API gw layer.
	try {
		introspectResult = await introspect_token(accessToken)
		if(!introspectResult) {
			console.log('Introspection complete- token is not valid.')
			throw 'Token not valid'
		}
	}
	catch(error) {
		console.log(error)
	  	return {
			statusCode: 403,
			body: 'A valid access token was not provided.'
		}		
	}
	
	console.log('Compiling a new authz request to Okta.')
	console.log('Original request data:')
	console.log(origRequest)

	console.log('User selections from the patient/scope picker: ')
	console.log(consentBody)

	const pickerClientId = process.env.PICKER_CLIENT_ID
	const pickerSecret = process.env.PICKER_CLIENT_SECRET

	const now = Math.floor( new Date().getTime() / 1000 );
	const plus5Minutes = new Date( ( now + (5*60) ) * 1000);
	var scopes = ''

	if(consentBody.scopes instanceof Array) {
		scopes = consentBody.scopes.join('%20') //join with a url encoded space.
	}
	else {
		scopes = consentBody.scopes
	};

	//Build the picker context- this is going to be used to provide the consent information in a secure way to Okta.
	//Note that request.body.patient may be null if the user isn't using the patient picker.
	const claims = {
		client_id: origRequest.client_id,
		patient: consentBody.patient,
		scopes: scopes
	}

	const jwt = njwt.create(claims, pickerSecret)
		.setIssuedAt(now)
		.setExpiration(plus5Minutes)
		.setIssuer(pickerClientId)
		.setSubject(pickerClientId)
		.compact();

	console.log('JWT claims to be used to specify picker context state:')
	console.log(claims)

	console.log('JWT to be used to specify picker context state:')
	console.log(jwt)
	
	var appProxyAuthzStateCookieSigned = cookieSignature.sign(jwt, process.env.STATE_COOKIE_SIGNATURE_KEY)
	console.log('Redirecting user to final app authz endpoint.')
	
	//The OAuth2 state parameter is used to pass our signed JWT that will be validated by Okta's token hook.
	//If the user tries to bypass this process, they won't have a valid JWT, and thus will not pass Okta Authz.
	var newAuthUrl = process.env.AUTHZ_ISSUER + '/v1/authorize?' +
		'client_id=' + origRequest.client_id +
		'&redirect_uri=' + process.env.GATEWAY_URL + '/smart_proxy_callback' +
		'&state=' + jwt +
		'&response_type=code' +
		'&scope=' + scopes
		
	return {
		statusCode: 302,
		location: newAuthUrl,
		body: null,
		appProxyAuthzStateCookie: appProxyAuthzStateCookieSigned
	}
}

//This is used by the patient picker to pull application information.
function get_application_data(client_id) {
	const appEndpoint = 'https://' + process.env.OKTA_ORG + '/api/v1/apps/' + client_id
	console.log('Retrieving Application data from Okta.')

	let promise = new Promise(function(resolve, reject) {
		axios.request({
			'url': appEndpoint,
			'method': 'get',
			'headers': {'Authorization': 'SSWS ' + process.env.API_KEY},
		  })
		.then((oktaResponse) => {
			console.log('Response from Okta:')
			console.log(oktaResponse.data)
			var appName = oktaResponse.data.label
			var appIcon = null
			if (oktaResponse.data._links.logo) {
				appIcon = oktaResponse.data._links.logo[0].href
			}
			var returnValue = {
				applicationName: appName,
				applicationLogo: appIcon
			}
			
			console.log('Application information for the consent screen:')
			console.log(returnValue)
			resolve(returnValue)
		})
		.catch((error) => {
			console.log(error);
			reject(error)
		})
	})
	return promise
}

//This is used by the patient picker to pull a list of SMART/FHIR scope definitions from Okta.
function get_scope_data(clientRequestedScopes) {
	const scopeEndpoint = 'https://' + process.env.OKTA_ORG + '/api/v1/authorizationServers/' + process.env.AUTHZ_SERVER + '/scopes'
	console.log('Retrieving Scope data from Okta.')

	let promise = new Promise(function(resolve, reject) {
		axios.request({
			'url': scopeEndpoint,
			'method': 'get',
			'headers': {'Authorization': 'SSWS ' + process.env.API_KEY},
		  })
		.then((oktaResponse) => {
			console.log('Response from Okta:')
			console.log(oktaResponse.data)

			var returnScopes = []

			oktaResponse.data.forEach(function(scope) {
				if(clientRequestedScopes.includes(scope.name)) {
				  returnScopes.push(scope)
				}
			});
			console.log('Scopes to send back to the client for approval:')
			console.log(returnScopes)
			resolve(returnScopes)
		})
		.catch((error) => {
			console.log(error);
			reject(error)
		})
	})
	return promise
}

//This method is used to ensure that the user did indeed login with Okta prior to making a patient/scope selection.
function introspect_token(token) {
	const introspectEndpoint = process.env.AUTHZ_ISSUER + '/v1/introspect';
	console.log('Introspecting the patient picker access token.')
	
	var formData = 'client_id=' +
                 process.env.PICKER_CLIENT_ID +
                 '&client_secret=' +
                 process.env.PICKER_CLIENT_SECRET +
                 '&token_type_hint=access_token&token=' +
                 token;
				 
	let promise = new Promise(function(resolve, reject) {
		axios.request({
			url: process.env.AUTHZ_ISSUER + '/v1/introspect',
			method: 'post',
			headers: {'Content-Type': 'application/x-www-form-urlencoded'},
			data: formData
		})
		.then((oktaResponse) => {
			console.log('Introspect call successful. Result:')
			console.log(oktaResponse.data)
			resolve(oktaResponse.data.active)
		})
		.catch((error) => {
			console.log(error);
			reject(error)
		});
	})
	return promise
}

function get_mock_patients() {
	console.log('Retrieving a list of demo patients.')
	let promise = new Promise(function(resolve, reject) {
		axios.request({
			url: process.env.GATEWAY_URL + '/patientMockService',
			method: "get"    
		})
		.then((mockResponse) => {
				console.log('Mock patient call successful. Result:')
				console.log(mockResponse.data)
				resolve(mockResponse.data)
		})
		.catch((error) => {
			console.log(error);
			reject(error)
		});											 
	})
	return promise
}
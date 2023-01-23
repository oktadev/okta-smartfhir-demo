'use strict';
//This is an example of a custom scope consent and patient picker to be used as part of an Okta authentication
//and authorization flow.

const cookieSignature = require('cookie-signature')
const cookie = require('cookie')
const axios = require('axios');
const nunjucks = require('nunjucks');
const njwt = require('njwt');
const querystring = require('querystring');
const oktaTokenLib = require('./okta_token');

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
					picker_url: process.env.PICKER_URL
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
				picker_url: process.env.PICKER_URL
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
	var newAuthUrl = `${process.env.OIDC_AUTHORIZE_URL}?client_id=${origRequest.client_id}&redirect_uri=${process.env.SMART_PROXY_CALLBACK_URL}&state=${jwt}&response_type=code&scope=${scopes}`
    
  	//If the original request used PKCE, we need to add in those parameters here too.
	if(origRequest.code_challenge && origRequest.code_challenge_method) {
		newAuthUrl += '&code_challenge=' + origRequest.code_challenge +
					'&code_challenge_method=' + origRequest.code_challenge_method
	}

	return {
		statusCode: 302,
		location: newAuthUrl,
		body: null,
		appProxyAuthzStateCookie: appProxyAuthzStateCookieSigned
	}
}

//Step 2- Log the user into Okta and the patient picker, and send their access token down.
//With it they can post back here with their consent decisions.
module.exports.pickerCallbackHandler = async (requestQuerystring, cookieString) => {
	var authCode = requestQuerystring.code;
	var cookies = cookie.parse(cookieString)
	var formData = `client_id=${process.env.PICKER_CLIENT_ID}&client_secret=${process.env.PICKER_CLIENT_SECRET}&grant_type=authorization_code&redirect_uri=${process.env.PICKER_CALLBACK_URL}&code=${authCode}`;

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
			url: process.env.INTERNAL_TOKEN_URL,
			method: 'post',
			headers: {'Content-Type': 'application/x-www-form-urlencoded', 'Host': process.env.BASE_DOMAIN},
			data: formData
		});

		console.log('Token endpoint call successful. Access token: ' + oktaResponse.data.access_token);
		console.log('Sending the user to the patient/consent picker.')
		var apiAccessTokenCookieSigned = cookieSignature.sign(oktaResponse.data.access_token, process.env.STATE_COOKIE_SIGNATURE_KEY)
		return {
			statusCode: 302,
			body: null,
			location: process.env.PICKER_URL,
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

//This is used by the patient picker to pull application information.
async function get_application_data(client_id) {
	const appEndpoint = 'https://' + process.env.OKTA_ORG + '/api/v1/apps/' + client_id
	const apiToken = await oktaTokenLib.getOktaAPIToken(process.env.OKTA_CLIENT_TOKEN_ENDPOINT, process.env.OKTA_API_CLIENTID, process.env.OKTA_API_PRIVATEKEYFILE)
	console.log('Retrieving Application data from Okta.')

	const oktaResponse = await axios.request({
		'url': appEndpoint,
		'method': 'get',
		'headers': {'Authorization': 'Bearer ' + apiToken},
		})

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
	return returnValue
}

//This is used by the patient picker to pull a list of SMART/FHIR scope definitions from Okta.
async function get_scope_data(clientRequestedScopes) {
	const scopeEndpoint = 'https://' + process.env.OKTA_ORG + '/api/v1/authorizationServers/' + process.env.AUTHZ_SERVER + '/scopes'
	const apiToken = await oktaTokenLib.getOktaAPIToken(process.env.OKTA_CLIENT_TOKEN_ENDPOINT, process.env.OKTA_API_CLIENTID, process.env.OKTA_API_PRIVATEKEYFILE)
	console.log('Retrieving Scope data from Okta.')

	const oktaResponse = await axios.request({
		'url': scopeEndpoint,
		'method': 'get',
		'headers': {'Authorization': 'Bearer ' + apiToken},
		})
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
	return returnScopes
}

//This method is used to ensure that the user did indeed login with Okta prior to making a patient/scope selection.
async function introspect_token(token) {
	const introspectEndpoint = process.env.OIDC_INTROSPECT_URL;
	console.log('Introspecting the patient picker access token.')

	var formData = `client_id=${process.env.PICKER_CLIENT_ID}&client_secret=${process.env.PICKER_CLIENT_SECRET}&token_type_hint=access_token&token=${token}`;

	const oktaResponse = await axios.request({
		url: introspectEndpoint,
		method: 'post',
		headers: {'Content-Type': 'application/x-www-form-urlencoded'},
		data: formData
	})
		
	console.log('Introspect call successful. Result:')
	console.log(oktaResponse.data)
	return oktaResponse.data.active
}

async function get_mock_patients() {
	console.log('Retrieving a list of demo patients.')
	
	const mockResponse = await axios.request({
		url: process.env.PATIENT_MOCK_SERVICE_URL,
		method: "get"
	})
	
	console.log('Mock patient call successful. Result:')
	console.log(mockResponse.data)
	return mockResponse.data
}

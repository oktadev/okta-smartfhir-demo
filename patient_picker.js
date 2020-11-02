'use strict';
//This is an example of a custom scope consent and patient picker to be used as part of an Okta authentication
//and authorization flow.

const serverless = require('serverless-http')
const express = require('express')
const app = express()
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const axios = require('axios');
const nunjucks = require('nunjucks');
const njwt = require('njwt');

app.use(cookieParser(process.env.STATE_COOKIE_SIGNATURE_KEY));
app.use(bodyParser.urlencoded({ extended: false }))
app.use('/static', express.static('public'));
nunjucks.configure('views', {
    autoescape: true,
    express: app
});

//Step 3 - Display the patient/scope picker application, and solicit a response.
app.get('/patient_authorization', (request, response) => {
	var accessToken = request.signedCookies.apiAccessToken;
	var origRequest = request.signedCookies.origRequest;
  
	console.log('User reached patient/consent picker app- calling patient access service with access token: ' + accessToken);
  
	//First validate our Okta login before we even show the consent screen.
	introspect_token(accessToken)
	.then((introspectResult) => {
		if(introspectResult) {
			//Get the application data (icon, app_name) for the client_id passesd in.
			get_application_data(origRequest.client_id)
			.then((appInfo) => {
				//Get scope definition data from Okta.
				get_scope_data(origRequest.scope) 
				.then((scopeDefinitions) => {
					//If launch/patient+patient_selection is included, we also need to grab patient records.
					if(origRequest.scope.includes('launch/patient') && origRequest.scope.includes('patient_selection')) {
						axios.request({
							url: process.env.GATEWAY_URL + '/patientMockService',
							method: "get",
							headers: {Authorization: 'Bearer ' + accessToken},    
						})
						.then((mockResponse) => {
							console.log('Data from the Mock Patient access API Response')
							console.log(mockResponse.data);
			   
							response.render('patient_authorization.html', { 
								patients: mockResponse.data, 
								scopes: scopeDefinitions, 
								show_patient_picker: true,
								app_name: appInfo.applicationName,
								app_icon: appInfo.applicationLogo,
								gateway_url: process.env.GATEWAY_URL 
							})
						})
						.catch((error) => {
							console.log(error);
							response.status(500).send('Unable to retrieve the patient list from the patient access service.')
						})
					}
					else { //No patient requested - just render the page.
						response.render('patient_authorization.html', { 
							patients: undefined, 
							scopes: scopeDefinitions, 
							show_patient_picker: false,
							app_name: appInfo.applicationName,
							app_icon: appInfo.applicationLogo,
							gateway_url: process.env.GATEWAY_URL 
						})
					}
				})
				.catch((err) => {
				  response.status(500).send('Unable to retrieve requested scope definitions from the authorization server.')
				})
			})
			.catch((error) => {
				response.status(500).send('Unable to retrieve application information from the authorization server.')
			})

		}
		else {
			//Introspect ran successfully, but Okta said the token is invalid.
			response.status(403).send('A valid access token was not provided.')  
		}
	})
	.catch((error) => {
	  //Introspect didn't even run successfully.
	  response.status(403).send('A valid access token was not provided.')
	})
})

//Step 4 - A patient and scope(s) have been selected by the user.
//We need to take the scope(s) requested, plus the patient_id selected, and we need to build a new authz request with it.
//In order to provide some trust in the process, we'll use a signed JWT as part of the authorize request back to Okta for the real app.
//The signed JWT will be validated in the token hook.  That will prevent someone from circumventing the picker by doing an 
//authorize directly against Okta.
app.post('/patient_authorization', (request, response) => {
	var accessToken = request.signedCookies.apiAccessToken;
	var origRequest = request.signedCookies.origRequest;
	
	//We also won't proceed unless they prove that they're actually logged into the patient picker app.
	introspect_token(accessToken)
	.then((result) => {
		if(result) {
			console.log('Compiling a new authz request to Okta.')

			console.log('Original request data:')
			console.log(origRequest)

			console.log('User selections from the patient/scope picker: ')
			console.log(request.body)

			const pickerClientId = process.env.PICKER_CLIENT_ID
			const pickerSecret = process.env.PICKER_CLIENT_SECRET

			const now = Math.floor( new Date().getTime() / 1000 );
			const plus5Minutes = new Date( ( now + (5*60) ) * 1000);
			var scopes = ''

			if(request.body.scopes instanceof Array) {
				scopes = request.body.scopes.join('%20') //join with a url encoded space.
			}
			else {
				scopes = request.body.scopes
			};

			//Build the picker context- this is going to be used to provide the consent information in a secure way to Okta.
			//Note that request.body.patient may be null if the user isn't using the patient picker.
			const claims = {
				client_id: origRequest.client_id,
				patient: request.body.patient,
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

			response.cookie('appProxyAuthzState', jwt, {httpOnly: true, signed: true})

			console.log('Done with patient picker- clearing cookies...')
			response.cookie('apiAccessToken', '', {maxAge: 0});
			response.cookie('pickerAuthzState', '', {maxAge: 0});

			console.log('Redirecting user to final app authz endpoint.')
	
			//The OAuth2 state parameter is used to pass our signed JWT that will be validated by Okta's token hook.
			//If the user tries to bypass this process, they won't have a valid JWT, and thus will not pass Okta Authz.
			var newAuthUrl = process.env.AUTHZ_ISSUER + '/v1/authorize?' +
				'client_id=' + origRequest.client_id +
				'&redirect_uri=' + process.env.GATEWAY_URL + '/smart_proxy_callback' +
				'&state=' + jwt +
				'&response_type=code' +
				'&scope=' + scopes

			response.redirect(newAuthUrl);  
		}
		else {
			response.status(403).send('A valid access token is required.')  
		}
	})
	.catch((error) => {
		response.status(403).send('A valid access token is required.')
	})
})

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

module.exports.patientPickerApp = serverless(app)
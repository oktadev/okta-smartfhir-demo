'use strict';

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


//Step 2- Log the user into Okta and the patient picker, and send their access token down. With it they can call an API to get the patients they have access to.
app.get('/oidc_callback', (request, response) => {
  var authCode = request.query.code;
  var formData = 'client_id=' +
                 process.env.PICKER_CLIENT_ID +
                 '&client_secret=' +
                 process.env.PICKER_CLIENT_SECRET +
                 '&grant_type=authorization_code&redirect_uri=' +
                 process.env.GATEWAY_URL + '/oidc_callback' +
                 '&code=' +
                 authCode;
  
  //Validate state passed to Okta in step 1 (authorize.js).
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
    data: formData,
    
  })
  .then((oktaResponse) => {
    console.log('Token endpoint call successful. Access token: ' + oktaResponse.data.access_token);
    response.cookie('apiAccessToken', oktaResponse.data.access_token, {httpOnly: true, signed: true});
    
    console.log('Sending the user to the patient/consent picker.')
	//TODO- fix this so I don't need to hardcode the /dev piece!
    response.redirect(process.env.GATEWAY_URL + '/patient_authorization')
  }, (error) => {
    console.log(error);
	response.status(500).send('Unable to properly log the user in.')
  });
})


//Step 3 - Display the patient/scope picker application, and solicit a response.
app.get('/patient_authorization', (request, response) => {
  var accessToken = request.signedCookies.apiAccessToken;
  var origRequest = request.signedCookies.origRequest;
  
  console.log('User reached patient/consent picker app- calling patient access service with access token: ' + accessToken);
  
  //TODO - we can skip this if the launch/patient scope is missing.
  axios.request({
    url: process.env.GATEWAY_URL + '/patientMockService',
    method: "get",
    headers: {Authorization: 'Bearer ' + accessToken},    
  })
  .then((mockResponse) => {
    console.log('Data from the Mock Patient access API Response')
    console.log(mockResponse.data);
    
    console.log('Original scopes requested by the app: ' + origRequest.scope)
    
    get_scope_data(origRequest.scope)
    .then((scopeDefinitions) => {
		//Now that we have our scopes let's render the page.
		response.render('patient_authorization.html', { 
			patients: mockResponse.data, 
			scopes: scopeDefinitions, 
			show_patient_picker: (origRequest.scope.includes('launch/patient')),
			app_name: process.env.PICKER_DISPLAY_NAME,
			gateway_url: process.env.GATEWAY_URL 
		})
    })
    .catch((err) => {
      response.status(500).send('Unable to retrieve requested scope definitions from the authorization server.')
    })

  }, (error) => {
    console.log(error);
	response.status(500).send('Unable to retrieve the patient list from the patient access service.')
  });
})

//Step 4 - A patient and scope(s) have been selected by the user.
//We need to take the scope(s) requested, plus the patient_id selected, and we need to build a new authz request with it.
//In order to provide some trust in the process, we'll use a signed JWT for the authorize request back to Okta for the real app.
app.post('/patient_authorization', (request, response) => {
  var accessToken = request.signedCookies.apiAccessToken;
  var origRequest = request.signedCookies.origRequest;
  console.log('Compiling a new authz request to Okta.')
  
  console.log('Original request data:')
  console.log(origRequest)
  
  console.log('User selections from the patient/scope picker: ')
  console.log(request.body)
  
  //TODO: check the access token passed in from the user along with all of this. (accessToken variable)
  //TODO: Don't use the app client secret here- instead lets use a private key.
  //build new authz request from original request, token, and user selection
  const clientSecret = process.env.APP_CLIENT_SECRET;
  const clientId = process.env.APP_CLIENT_ID;
  const now = Math.floor( new Date().getTime() / 1000 );
  const plus5Minutes = new Date( ( now + (5*60) ) * 1000);
  var scopes = ''
  
  if(request.body.scopes instanceof Array) {
    scopes = request.body.scopes.join(' ')
  }
  else {
    scopes = request.body.scopes
  };
  
  const claims = {
    aud: process.env.AUTHZ_ISSUER, // audience, which is the authz server.
    scope: scopes,
    state: origRequest.state,
    response_type: 'code',
    redirect_uri: origRequest.redirect_uri,
    client_id: origRequest.client_id,
    patient: request.body.patient
  };

  const jwt = njwt.create(claims, clientSecret)
    .setIssuedAt(now)
    .setExpiration(plus5Minutes)
    .setIssuer(clientId)
    .setSubject(clientId)
    .compact();
  
  console.log('JWT claims to be used to request final authorization:')
  console.log(claims)
  
  console.log('JWT to be used to request final authorization:')
  console.log(jwt)

  console.log('Done with custom authz- clearing cookies...')
  response.cookie('origRequest', '', {maxAge: 0});
  response.cookie('apiAccessToken', '', {maxAge: 0});
  
  console.log('Redirecting user to authz endpoint.')
  //redirect the user there.
  response.redirect(process.env.AUTHZ_ISSUER + '/v1/authorize?request=' + jwt);
})

//TODO- use OAuth2 token from the user instead of using an API key here.
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
    });
  })
  return promise
}


module.exports.patientPickerApp = serverless(app)
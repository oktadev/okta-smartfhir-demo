'use strict';

const serverless = require('serverless-http')
const express = require('express')
const cookieParser = require('cookie-parser')
const app = express()
const { v4: uuidv4 } = require('uuid')

app.use(cookieParser(process.env.STATE_COOKIE_SIGNATURE_KEY));

// Step 1 - Authorize request, store the original request in a signed cookie, and login to the person/consent picker page instead.

// For the consent/patient picker, we'll just use the openid,email,profile scopes.
app.get('/authorize', (request, response) => {
  
  //Cache:
  //Client_id, state, scopes, redirect_uri
  var inboundRequest = {
    client_id: request.query.client_id,
    state: request.query.state,
    scope: request.query.scope.split(' '),
    redirect_uri: request.query.redirect_uri
  };
  
  console.log('Inbound data to be cached off for later:');
  console.log(inboundRequest);
  
  response.cookie('origRequest', inboundRequest, {httpOnly: true, signed: true});
  
  var pickerAuthzState = uuidv4();
  
  //For the picker app to properly validate state we need to share the requested state with it.
  response.cookie('pickerAuthzState', pickerAuthzState, {httpOnly: true, signed: true})
  
  //Build person picker authz request
  var picker_auth_url = process.env.AUTHZ_ISSUER + '/v1/authorize' + 
                         '?client_id=' +
                         process.env.PICKER_CLIENT_ID +
                         '&response_type=code&scope=openid%20profile%20email&redirect_uri=' +
                         process.env.GATEWAY_URL + '/oidc_callback' +
                         '&state=' +
						 pickerAuthzState;
  
  console.log('Redirecting the user to: ' + picker_auth_url);
  response.redirect(picker_auth_url)
});


module.exports.smartAuthorizeProxy = serverless(app)
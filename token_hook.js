'use strict';

const serverless = require('serverless-http')
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const njwt = require('njwt');

app.use(bodyParser.json())

//TODO: See if there's a way to eliminate this whole thing.

//Step 5- the token hook will be called by Okta, and used to take the patient sent in, and put it within the access_token.
//The token proxy will then come along and pull it out and put it alongside the token too.
app.post("/tokenhook", (request, response) => {
  var authorizeUrl = request.body.data.context.request.url.value;
  console.log('Token hook invoked with url: ' + authorizeUrl)
  
  var regex = /request=([^&]+)/i;
  var requestJWT = authorizeUrl.match(regex)[1];
  
  //TODO: Use a private key instead of client secret.
  var verifiedJWT = njwt.verify(requestJWT, process.env.APP_CLIENT_SECRET);
  
  console.log('Verified JWT detail:')
  console.log(verifiedJWT)
  
  console.log('Patient id: ' + verifiedJWT.body.patient)
  
  var tokenUpdate = {
   "commands": [ 
        { 
            "type": "com.okta.access.patch",
            "value": [ 
                 { 
                     "op": "add",
                     "path": "/claims/launch_response_patient",
                     "value": verifiedJWT.body.patient
                  }
             ] 
         }    
      ]
  };
  response.send(tokenUpdate);
})


module.exports.tokenHook = serverless(app)
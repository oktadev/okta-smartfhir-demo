'use strict';

const serverless = require('serverless-http')
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const njwt = require('njwt');

app.use(bodyParser.json())

//Step 5- the token hook will be called by Okta, and used to take the patient sent in, and put it within the access_token.
//Additionally, this hook will be used to validate that the original authorization request did indeed use our picker.
//The token proxy will then come along and pull it out and put it alongside the token too.
app.post("/tokenhook", (request, response) => {
	var authorizeUrl = request.body.data.context.request.url.value;
	console.log('Token hook invoked with url: ' + authorizeUrl)

	var regex = /state=([^&]+)/i;
	var pickerContextJWT = authorizeUrl.match(regex)[1];
	var verifiedPickerContextJWT = '';

	try {
		verifiedPickerContextJWT = njwt.verify(pickerContextJWT, process.env.PICKER_CLIENT_SECRET);
	}
	catch(e) {
		var tokenError = {
			"error": {
				errorSummary: "Invalid authorize request- the request is missing a valid picker context."
			}
		}
		response.send(tokenError);
	}
	console.log('Verified JWT detail:')
	console.log(verifiedPickerContextJWT)

	console.log('Patient id: ' + verifiedPickerContextJWT.body.patient)

	var tokenUpdate = {
		"commands": [{ 
			"type": "com.okta.access.patch",
			"value": [{ 
				"op": "add",
				"path": "/claims/launch_response_patient",
				"value": verifiedPickerContextJWT.body.patient
			}] 
		}]
	};
	response.send(tokenUpdate);
})

module.exports.tokenHook = serverless(app)
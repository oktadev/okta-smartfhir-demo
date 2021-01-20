'use strict';
const njwt = require('njwt');

//Step 5- the token hook will be called by Okta, and used to take the patient sent in, and put it within the access_token.
//Additionally, this hook will be used to validate that the original authorization request did indeed use our picker.
//The token proxy will then come along and pull it out and put it alongside the token too.

module.exports.tokenHookHandler = async (hookRequestBody) => {
	var body = JSON.parse(hookRequestBody)
	var authorizeUrl = body.data.context.request.url.value;
	console.log('Token hook invoked with url: ' + authorizeUrl)

	var verifiedPickerContextJWT = '';
	var pickerContextJWT = body.data.context.protocol.request.state;
	var scope = body.data.context.protocol.request.scope;
	var client_id = body.data.context.protocol.request.client_id;

	try {
		verifiedPickerContextJWT = njwt.verify(pickerContextJWT, process.env.PICKER_CLIENT_SECRET);
	}
	catch(e) {
		console.log(e)
		var tokenError = {
			"error": {
				errorSummary: "Invalid authorize request- the request is missing a valid picker context."
			}
		}
		return {
			statusCode: 200, //Even though we have an error, we need to give Okta a 200 response with the error.
			body: tokenError
		}
	}
	
	var consentedScopes = decodeURI(verifiedPickerContextJWT.body.scopes);
	var consentedClient = verifiedPickerContextJWT.body.client_id
	
	console.log("Consented Scopes:" + consentedScopes)
	console.log("Scopes sent to authz:" + scope)
	
	console.log("Consented App:" + consentedClient)
	console.log("App sent to authz:" + client_id)
	
	//Validate to ensure that the scopes and client requested from the authz server do indeed match those selected during the consent process.
	if(consentedScopes != scope || consentedClient != client_id) {
		console.log("Request validation failed. Improper scope or client id.")
		var tokenError = {
			"error": {
				errorSummary: "Invalid authorize request- the application and/or scopes sent to the authorization server do not match those the user consented to."
			}
		}
		return {
			statusCode: 200,
			body: tokenError
		}
	}
	
	//If the patient_selection scope is included, it means that the patient_id was selected by the user at runtime
	//Instead of being pulled from the user's profile.
	if(scope.includes('patient_selection')) {
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
				},
				{
					"op": "add",
					"path": "/claims/valid_consent",
					"value": "true"
				}] 
			}]
		};
		return {
			statusCode: 200,
			body: tokenUpdate
		}
	}
	else {  //No patient selection was requested, we don't need to put the patient in the token. Okta will do it via UD.
		return {
			statusCode: 204,
			body: null
		}
	}
}
'use strict';
const njwt = require('njwt');

//Step 5- the token hook will be called by Okta, and used to take the patient sent in, and put it within the access_token.
//Additionally, this hook will be used to validate that the original authorization request did indeed use our picker.
//The token proxy will then come along and pull it out and put it alongside the token too.

module.exports.tokenHookHandler = async (hookRequestBody, refreshedPatientId) => {
	var body = JSON.parse(hookRequestBody)
	var hookUrl = body.data.context.request.url.value;
	console.log('Token hook invoked with url: ' + hookUrl)
	
	if(body.source.endsWith('/token')) { //Refresh Request
		console.log('Refresh request received- handling refresh')
		console.log('Cached patient:' + refreshedPatientId)
		return handle_refresh_hook(body, refreshedPatientId)
	}
	else { //Auth Code request
		console.log('Authorize request received- evaluating consent JWT')
		return handle_authorize_hook(body)
	}
}

function handle_authorize_hook(requestBodyObject) {
	var verifiedPickerContextJWT = '';
	var pickerContextJWT = requestBodyObject.data.context.protocol.request.state;
	var scope = requestBodyObject.data.context.protocol.request.scope;
	var client_id = requestBodyObject.data.context.protocol.request.client_id;
	
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
	

	console.log('Verified JWT detail:')
	console.log(verifiedPickerContextJWT)

	console.log('Patient id: ' + verifiedPickerContextJWT.body.patient)

	var tokenUpdate = {
		"commands": [{ 
			"type": "com.okta.access.patch",
			"value": [
				{
					"op": "add",
					"path": "/claims/valid_consent",
					"value": "true"
				}
			]
		}]
	};
	
	//If a patient id is provided by the patient picker, we'll overwrite the value that Okta may provide from the directory.
	if(verifiedPickerContextJWT.body.patient) {
		tokenUpdate.commands[0].value.push(
			{ 
				"op": "add",
				"path": "/claims/launch_response_patient",
				"value": verifiedPickerContextJWT.body.patient
			}
		)
	}
	
	return {
		statusCode: 200,
		body: tokenUpdate
	}
}

function handle_refresh_hook(requestBodyObject, refreshedPatientId) {
	var tokenUpdate = {
		"commands": [{ 
			"type": "com.okta.access.patch",
			"value": [
				{
					"op": "add",
					"path": "/claims/valid_consent",
					"value": "true"
				}
			]
		}]
	};
	
	//If a patient id was cached in the original authorize request, and we found it, let's put it back in.
	if(refreshedPatientId) {
		console.log("Patient " + refreshedPatientId + " was found in the refresh cache- adding back into the token.")
		tokenUpdate.commands[0].value.push(
			{ 
				"op": "add",
				"path": "/claims/launch_response_patient",
				"value": refreshedPatientId
			}
		)
	}
	return {
		statusCode: 200,
		body: tokenUpdate
	}
}
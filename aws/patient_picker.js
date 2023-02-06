'use strict';
const patientPickerLib = require('../lib/patient_picker')

module.exports.patientPickerGetHandler = async (event, context) => {
	var getResult = await patientPickerLib.getHandler(event.headers[Object.keys(event.headers).find(key => key.toLowerCase() === 'cookie')])
	return {
		statusCode: getResult.statusCode,
		body: getResult.body,
		headers: {
			'content-type': 'text/html'
		}
	}
}

module.exports.patientPickerPostHandler = async (event, context) => {
	var postResult = await patientPickerLib.postHandler(event.body, event.headers[Object.keys(event.headers).find(key => key.toLowerCase() === 'cookie')])
	return {
		statusCode: postResult.statusCode,
		body: JSON.stringify(postResult.body),
		headers: {
			Location: postResult.location
		},
		multiValueHeaders: {
			'Set-Cookie': [
				`appProxyAuthzState=${postResult.appProxyAuthzStateCookie}; Secure; HttpOnly; Path=/;`,
				'apiAccessToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT',
				'pickerAuthzState=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
			]
		}
	}
}

//Patient picker/custom consent screen OIDC callback endpoint - AWS implementation.
//See the authorize library for full details.
//This endpoint should be moved over to the patient picker module.
module.exports.pickerCallbackHandler = async (event, context) => {
	var pickerCallbackResult = await patientPickerLib.pickerCallbackHandler(event.queryStringParameters, event.headers[Object.keys(event.headers).find(key => key.toLowerCase() === 'cookie')])
	return {
		statusCode: pickerCallbackResult.statusCode,
		body: JSON.stringify(pickerCallbackResult.body),
		headers: {
			Location: pickerCallbackResult.location
		},
		multiValueHeaders: {
			'Set-Cookie': [
				`apiAccessToken=${pickerCallbackResult.apiAccessTokenCookie}; Secure; HttpOnly; Path=/;`,
			]
		}
	}
}

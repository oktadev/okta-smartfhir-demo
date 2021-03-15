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
	var postResult = await patientPickerLib.postHandler(event.body, 
														event.headers[Object.keys(event.headers).find(key => key.toLowerCase() === 'cookie')])
	return {
		statusCode: postResult.statusCode,
		body: JSON.stringify(postResult.body),
		headers: {
			Location: postResult.location
		},
		multiValueHeaders: {
			'Set-Cookie': [
				'appProxyAuthzState=' + postResult.appProxyAuthzStateCookie + '; Secure; HttpOnly',
				'apiAccessToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT',
				'pickerAuthzState=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
			]
		}
	}
}



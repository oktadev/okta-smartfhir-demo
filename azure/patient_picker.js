'use strict';

//Patient Picker/Custom Authz endpoints - Azure function Implementation.
//See keys library for documentation.

const patientPickerLib = require('../lib/patient_picker')
const logIntercept = require('azure-function-log-intercept');

module.exports.patientPickerGetHandler = async (context, req) => {
	logIntercept(context)
	var getResult = await patientPickerLib.getHandler(req.headers.cookie)
	context.res = {
		status: getResult.statusCode,
		body: getResult.body,
		headers: {
			'content-type': 'text/html'
		}
	}
}

module.exports.patientPickerPostHandler = async (context, req) => {
	logIntercept(context)
	var postResult = await patientPickerLib.postHandler(req.body, req.headers.cookie)
	context.res = {
		status: postResult.statusCode,
		body: JSON.stringify(postResult.body),
		headers: {
			Location: postResult.location
		},
		cookies: [
			{
				name: 'appProxyAuthzState',
				value: postResult.appProxyAuthzStateCookie,
				secure: true,
				httpOnly: true
			},
			{
				name: 'apiAccessToken',
				value: null,
				maxAge: 0,
				secure: true,
				httpOnly: true
			},
			{
				name: 'pickerAuthzState',
				value: null,
				maxAge: 0,
				secure: true,
				httpOnly: true
			}
		]
	}
}



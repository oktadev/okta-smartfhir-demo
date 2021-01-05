'use strict';
const authorizeLib = require('../lib/authorize')
const logIntercept = require('azure-function-log-intercept');

//Authorize endpoint - Azure Function implementation.
//See the authorize library for full details.
module.exports.authorizeHandler = async (context, req) => {
	logIntercept(context)
	var authorizeResult = await authorizeLib.authorizeHandler(req.query)
	context.res = {
		status: authorizeResult.statusCode,
		body: JSON.stringify(authorizeResult.body),
		headers: {
			Location: authorizeResult.location
		},
		cookies: [
			{
				name: 'pickerAuthzState',
				value: authorizeResult.pickerAuthzCookie,
				secure: true,
				httpOnly: true
			},
			{
				name: 'origRequest',
				value: authorizeResult.origRequestCookie,
				secure: true,
				httpOnly: true
			}
		]
	}
}

//Patient picker/custom consent screen OIDC callback endpoint - Azure Function implementation.
//See the authorize library for full details.
//This endpoint should be moved over to the patient picker module.
module.exports.pickerCallbackHandler = async (context, req) => {
	logIntercept(context)
	var pickerCallbackResult = await authorizeLib.pickerCallbackHandler(req.query, req.headers.cookie)
	context.res = {
		status: pickerCallbackResult.statusCode,
		body: JSON.stringify(pickerCallbackResult.body),
		headers: {
			Location: pickerCallbackResult.location
		},
		cookies: [
			{
				name: 'apiAccessToken',
				value: pickerCallbackResult.apiAccessTokenCookie,
				secure: true,
				httpOnly: true
			}
		]
	}
}

//Authorize OAuth2 callback proxy endpoint - Azure Function implementation.
//See the authorize library for full details.
module.exports.authorizeCallbackHandler = async (context, req) => {
	logIntercept(context)
	var authorizeCallbackResult = await authorizeLib.authorizeCallbackHandler(req.query, req.headers.cookie)
	context.res = {
		status: authorizeCallbackResult.statusCode,
		body: JSON.stringify(authorizeCallbackResult.body),
		headers: {
			Location: authorizeCallbackResult.location
		},
		cookies: [
			{
				name: 'origRequest',
				value: null,
				maxAge: 0,
				secure: true,
				httpOnly: true
			},
			{
				name: 'appProxyAuthzState',
				value: null,
				maxAge: 0,
				secure: true,
				httpOnly: true
			}
		]
	}
}
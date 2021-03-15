'use strict';
const authorizeLib = require('../lib/authorize')

//Authorize endpoint - AWS implementation.
//See the authorize library for full details.
module.exports.authorizeHandler = async (event, context) => {
	var authorizeResult = await authorizeLib.authorizeHandler(event.queryStringParameters)
	return {
		statusCode: authorizeResult.statusCode,
		body: JSON.stringify(authorizeResult.body),
		headers: {
			Location: authorizeResult.location
		},
		multiValueHeaders: {
			'Set-Cookie': [
				'pickerAuthzState=' + authorizeResult.pickerAuthzCookie + '; Secure; HttpOnly',
				'origRequest=' + authorizeResult.origRequestCookie + '; Secure; HttpOnly'
			]
		}
	}
}

//Patient picker/custom consent screen OIDC callback endpoint - AWS implementation.
//See the authorize library for full details.
//This endpoint should be moved over to the patient picker module.
module.exports.pickerCallbackHandler = async (event, context) => {
	var pickerCallbackResult = await authorizeLib.pickerCallbackHandler(event.queryStringParameters, event.headers[Object.keys(event.headers).find(key => key.toLowerCase() === 'cookie')])
	return {
		statusCode: pickerCallbackResult.statusCode,
		body: JSON.stringify(pickerCallbackResult.body),
		headers: {
			Location: pickerCallbackResult.location
		},
		multiValueHeaders: {
			'Set-Cookie': [
				'apiAccessToken=' + pickerCallbackResult.apiAccessTokenCookie + '; Secure; HttpOnly',
			]
		}
	}
}

//Authorize OAuth2 callback proxy endpoint - AWS implementation.
//See the authorize library for full details.
module.exports.authorizeCallbackHandler = async (event, context) => {
	var authorizeCallbackResult = await authorizeLib.authorizeCallbackHandler(event.queryStringParameters, event.headers[Object.keys(event.headers).find(key => key.toLowerCase() === 'cookie')])
	return {
		statusCode: authorizeCallbackResult.statusCode,
		body: JSON.stringify(authorizeCallbackResult.body),
		headers: {
			Location: authorizeCallbackResult.location
		},
		multiValueHeaders: {
			'Set-Cookie': [
				'origRequest=; expires=Thu, 01 Jan 1970 00:00:00 GMT',
				'appProxyAuthzState=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
			]
		}
	}
}
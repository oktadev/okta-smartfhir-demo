'use strict';
const introspectLib = require('../lib/introspect')

//Token proxy - AWS implementation.
//See the token library for full documentation.
module.exports.introspectHandler = async (event, context) => {
	var handlerResponse = await introspectLib.introspectHandler(event.headers, event.body)

	return {
		statusCode: handlerResponse.statusCode,
		body: JSON.stringify(handlerResponse.body),
		headers: {
			"Cache-Control": "no-store",
			"Pragma": "no-cache",
			'Access-Control-Allow-Origin': '*', // CORS
			'Access-Control-Allow-Credentials': true // Required for cookies, authorization headers with HTTPS
		}
	}
}

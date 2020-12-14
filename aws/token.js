'use strict';
const tokenLib = require('../lib/token')

//Token proxy - AWS implementation.
//See the token library for full documentation.
module.exports.tokenHandler = async (event, context) => {
	var handlerResponse = await tokenLib.tokenHandler(event.body, event.headers)
	return {
		statusCode: handlerResponse.statusCode,
		body: JSON.stringify(handlerResponse.body),
		headers: {"Cache-Control": "no-store", "Pragma": "no-cache"}
	}
}
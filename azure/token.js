'use strict';
const tokenLib = require('../lib/token')
const logIntercept = require('azure-function-log-intercept');

//Token proxy - AWS implementation.
//See the token library for full documentation.
module.exports.tokenHandler = async (context, req) => {
	logIntercept(context)
	console.log("inbound request")
	console.log(JSON.stringify(req))
	var handlerResponse = await tokenLib.tokenHandler(req.body, req.headers)
	context.res = {
		status: handlerResponse.statusCode,
		body: JSON.stringify(handlerResponse.body),
		headers: {"Cache-Control": "no-store", "Pragma": "no-cache"}
	}
}
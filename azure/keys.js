'use strict';
const keysLib = require('../lib/keys')
const logIntercept = require('azure-function-log-intercept');

//Keys endpoint - Azure Lambda Implementation.
//See keys library for documentation.
module.exports.keysHandler = async (context, req) => {
	logIntercept(context)
	var keysResult = await keysLib.keysHandler()
	context.res = {
		status: 200,
		body: JSON.stringify(keysResult)
	}
}
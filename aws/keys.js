'use strict';
const keysLib = require('../lib/keys')

//Keys endpoint - AWS Lambda Implementation.
//See keys library for documentation.
module.exports.keysHandler = async (event, context) => {
	var keysResult = await keysLib.keysHandler()
	return {
		statusCode: 200,
		body: JSON.stringify(keysResult)
	}
}
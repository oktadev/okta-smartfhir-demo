'use strict';
const keysLib = require('../lib/keys')

//Keys endpoint - AWS Lambda Implementation.
//See keys library for documentation.
module.exports.keysHandler = async (event, context) => {
	var keysResult = await keysLib.keysHandler()
	return {
		statusCode: 200,
		body: JSON.stringify(keysResult),
		headers: {
			'Access-Control-Allow-Origin': '*', // CORS
      'Access-Control-Allow-Credentials': false // Required for cookies, authorization headers with HTTPS
		}
	}
}

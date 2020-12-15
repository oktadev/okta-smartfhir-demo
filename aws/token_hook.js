'use strict';
const tokenHookLib = require('../lib/token_hook')

//Token hook - AWS interface.
//See the token hook library for full documentation.
module.exports.tokenHookHandler = async (event, context) => {
	try {
		var tokenHookResult = await tokenHookLib.tokenHookHandler(event.body)
		return {
			statusCode: tokenHookResult.statusCode,
			body: JSON.stringify(tokenHookResult.body)
		}
	}
	catch(error) {
		//When a token hook fails, we still want to return a 200 to Okta, with an error message.
		//In this way, Okta will reject all tokens in the event that our token hook fails.
		//Most errors are caught at the expected source, but this is a catch-all.
		console.log(error)
		return {
			statusCode: 200,
			body: JSON.stringify({"error": {
				errorSummary: "An unexpected error has occurred in the token hook. See the cloud logs for more detail."
			}})
		}
	}
}
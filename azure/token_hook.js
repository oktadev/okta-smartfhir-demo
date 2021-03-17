'use strict';
const tokenHookLib = require('../lib/token_hook')
const logIntercept = require('azure-function-log-intercept');

//Token hook - Azure Function interface.
//See the token hook library for full documentation.
module.exports.tokenHookHandler = async (context, req) => {
	logIntercept(context)
	try {
		var tokenHookResult = await tokenHookLib.tokenHookHandler(req.body)
		context.res = {
			status: tokenHookResult.statusCode,
			body: JSON.stringify(tokenHookResult.body)
		}
	}
	catch(error) {
		//When a token hook fails, we still want to return a 200 to Okta, with an error message.
		//In this way, Okta will reject all tokens in the event that our token hook fails.
		//Most errors are caught at the expected source, but this is a catch-all.
		context.log(error)
		context.res = {
			status: 200,
			body: JSON.stringify({"error": {
				errorSummary: "An unexpected error has occurred in the token hook. See the cloud logs for more detail."
			}})
		}
	}
}
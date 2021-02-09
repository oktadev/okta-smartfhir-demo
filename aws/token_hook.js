'use strict';
const tokenHookLib = require('../lib/token_hook')
const AWS = require('aws-sdk');
AWS.config.update({
	region: process.env.AWS_REGION
})
const dynamoDB = new AWS.DynamoDB.DocumentClient()

//Token hook - AWS interface.
//See the token hook library for full documentation.
module.exports.tokenHookHandler = async (event, context) => {
	try {
		var cachedPatientId = await get_refresh_cached_patient_id(JSON.parse(event.body))
		var tokenHookResult = await tokenHookLib.tokenHookHandler(event.body, cachedPatientId)
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

//This method, if we're in the middle of an access token refresh, will get the cached patient_id, if applicable.
async function get_refresh_cached_patient_id(requestBodyObject) {
	if(requestBodyObject.source.endsWith('/token')) {
		var refreshTokenId = requestBodyObject.data.context.protocol.originalGrant.refresh_token.jti;
		console.log('Getting refresh object from database...')
		console.log('Refresh token id:' + refreshTokenId)
		var params = {
			TableName: process.env.CACHE_TABLE_NAME,
			Key: {
				token_id: refreshTokenId
			}
		};

		var result = await dynamoDB.get(params).promise()
		console.log(result)
		if(result.Item) {
			return result.Item.patient_id
		}
		else {
			return null
		}
	}
	else {
		return null
	}
	
}
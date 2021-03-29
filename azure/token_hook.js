'use strict';
const tokenHookLib = require('../lib/token_hook')
const logIntercept = require('azure-function-log-intercept')
const CosmosClient = require('@azure/cosmos').CosmosClient


//Token hook - Azure Function interface.
//See the token hook library for full documentation.
module.exports.tokenHookHandler = async (context, req) => {
	logIntercept(context)
	try {
		context.log('Token hook invoked with body:')
		context.log(req.body)
		var cachedPatientId = await get_refresh_cached_patient_id(req.body)
		var tokenHookResult = await tokenHookLib.tokenHookHandler(JSON.stringify(req.body), cachedPatientId)
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

//This method, if we're in the middle of an access token refresh, will get the cached patient_id, if applicable.
async function get_refresh_cached_patient_id(requestBodyObject) {
	if(requestBodyObject.source.endsWith('/token')) {
		var refreshTokenId = requestBodyObject.data.context.protocol.originalGrant.refresh_token.jti;
		console.log('Getting refresh object from database...')
		console.log('Refresh token id:' + refreshTokenId)
		
		//Database Connectivity Details
		const key = process.env.CACHE_KEY
		const endpoint = process.env.CACHE_ENDPOINT
		const dbName = process.env.CACHE_TABLE_NAME
	
		const client = new CosmosClient({ endpoint, key })
		const database = client.database(dbName)
		const container = database.container(dbName)
		
		console.log('Querying cache for previous refresh data')
		
		var result = await container.item(refreshTokenId, refreshTokenId).read();
		console.log(result)
		if(result) {
			return result.resource.patient_id
		}
		else {
			return null
		}
	}
	else {
		return null
	}
	
}
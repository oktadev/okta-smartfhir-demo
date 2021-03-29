'use strict';
const tokenLib = require('../lib/token')
const logIntercept = require('azure-function-log-intercept');
const CosmosClient = require('@azure/cosmos').CosmosClient

//Token proxy - Azure implementation.
//See the token library for full documentation.
module.exports.tokenHandler = async (context, req) => {
	logIntercept(context)
	context.log("inbound request")
	context.log(JSON.stringify(req))
	var handlerResponse = await tokenLib.tokenHandler(req.body, req.headers)
	if(handlerResponse.refreshCacheObject) {
		await writeRefreshCache(handlerResponse.refreshCacheObject, req.body.includes('refresh_token'))
	}
	context.res = {
		status: handlerResponse.statusCode,
		body: JSON.stringify(handlerResponse.body),
		headers: {"Cache-Control": "no-store", "Pragma": "no-cache"}
	}
}

async function writeRefreshCache(refreshObject, isRefreshRequest) {
	console.log('Writing refresh object to database...')
	//Database Connectivity Details

	const key = process.env.CACHE_KEY
	const endpoint = process.env.CACHE_ENDPOINT
	const dbName = process.env.CACHE_TABLE_NAME
	
	const client = new CosmosClient({ endpoint, key })
	
	const database = client.database(dbName)
	const container = database.container(dbName)
	
	const item = {
		id: refreshObject.token_id,
		token_id: refreshObject.token_id,
		patient_id: refreshObject.patient_id,
		ttl: (Math.floor(Date.now() / 1000) + (process.env.CACHE_TTL_MINS * 60))
	}
	
	var result = null
	if (isRefreshRequest) { //If it's a refresh, we need to update, not create.
		result = await container.item(refreshObject.token_id, refreshObject.token_id).replace(item)
	}
	else {
		result = await container.items.create(item)
	}
	
	console.log(result)
	return result
}
'use strict';
const tokenLib = require('../lib/token')
const AWS = require('aws-sdk');
AWS.config.update({
	region: process.env.AWS_REGION
})
const dynamoDB = new AWS.DynamoDB.DocumentClient()

//Token proxy - AWS implementation.
//See the token library for full documentation.
module.exports.tokenHandler = async (event, context) => {
	var handlerResponse = await tokenLib.tokenHandler(event.body, event.headers)
	if(handlerResponse.refreshCacheObject) {
		await writeRefreshCache(handlerResponse.refreshCacheObject)
	}
	return {
		statusCode: handlerResponse.statusCode,
		body: JSON.stringify(handlerResponse.body),
		headers: {"Cache-Control": "no-store", "Pragma": "no-cache"}
	}
}

async function writeRefreshCache(refreshObject) {
	console.log('Writing refresh object to database...')
	var result = await dynamoDB.put({
		TableName: process.env.CACHE_TABLE_NAME,
		Item: {
			token_id: refreshObject.token_id,
			patient_id: refreshObject.patient_id,
			expires: (Math.floor(Date.now() / 1000) + (process.env.CACHE_TTL_MINS * 60))
		}
	}).promise()
	console.log(result)
	return result
}
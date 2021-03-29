'use strict';
const metadataLib = require('../lib/metadata_endpoints')
const logIntercept = require('azure-function-log-intercept');

//Metadata endpoints - Azure Function Interface
//See the metadata library for more detail.
module.exports.smartConfigHandler = async (context, req) => {
	logIntercept(context)
	var smartConfigResult = await metadataLib.smartConfigHandler()
	context.res = {
		status: 200,
		body: JSON.stringify(smartConfigResult),
		headers: {
			'content-type': 'application/json'
		}
	}
}

module.exports.metadataHandler = async (context, req) => {
	logIntercept(context)
	var metadataResult = await metadataLib.metadataHandler()
	context.res = {
		status: 200,
		body: JSON.stringify(metadataResult),
		headers: {
			'content-type': 'application/json'
		}
	}
}
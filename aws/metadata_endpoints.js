'use strict';
const metadataLib = require('../lib/metadata_endpoints')

//Metadata endpoints - AWS Lambda Interface
//See the metadata library for more detail.
module.exports.smartConfigHandler = async (event, context) => {
	var smartConfigResult = await metadataLib.smartConfigHandler()
	return {
		statusCode: 200,
		body: JSON.stringify(smartConfigResult)
	}
}

module.exports.metadataHandler = async (event, context) => {
	var metadataResult = await metadataLib.metadataHandler()
	return {
		statusCode: 200,
		body: JSON.stringify(metadataResult)
	}
}
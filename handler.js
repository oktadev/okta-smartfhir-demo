'use strict';

function get_access_token_payload(jwt) {
	var base64Payload = jwt.split('.')[1];
	var buff = new Buffer(base64Payload, 'base64');
	var payloadText = buff.toString('utf-8');
	var payloadObj = JSON.parse(payloadText)
	console.log("Parsed Access Token:")
	console.log(payloadObj)
	return payloadObj
}

function get_return_claims(jwt_payload, response_body) {
	for (var claim in jwt_payload) {
		if (jwt_payload.hasOwnProperty(claim)) {
			console.log(claim + " -> " + jwt_payload[claim]);
			if(claim.startsWith('launch_response')) {
				//We need to include this in our body.
				response_body[claim.replace('launch_response_','')] = jwt_payload[claim];
			}
		}
	}
}

module.exports.smartTokenProxy = async event => {
  	const axios = require('axios')
	const tokenEndpoint = process.env.TOKEN_ENDPOINT
	const oktaOrg = process.env.OKTA_ORG
	
	const promise = new Promise(function(resolve, reject) {
		const res = {
			'statusCode': 200,
			'headers': {
				'Content-Type': 'application/json'
			},
			'body': ''
		};
		var newHeaders = event.headers;
		newHeaders.Host = oktaOrg
		
		axios.request({
			'url': tokenEndpoint,
			'method': 'post',
			'headers': newHeaders,
			'data': event.body
		})
		.then((response) => {
			console.log("Response from Okta:")
			console.log(JSON.stringify(response.data))

			get_return_claims(get_access_token_payload(response.data.access_token), response.data)
			res.body = JSON.stringify(response.data)
			resolve(res)
		})
		.catch((error) => {
			console.log(error);
			reject(error)
		});
	})
	return promise
};

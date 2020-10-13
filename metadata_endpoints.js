'use strict';
const serverless = require('serverless-http')
const express = require('express')
const app = express()

app.get("/.well-known/smart-configuration", (request,response) => {
	response.send(getSMARTMetadata())
})

app.get("/smart-configuration", (request,response) => {
	response.send(getSMARTMetadata())
})

app.get("/metadata", (request,response) => {
	response.send(getLegacyMetadata())
})
	
function getSMARTMetadata() {
	return {
		"authorization_endpoint": process.env.GATEWAY_URL + '/authorize',
		"token_endpoint": process.env.GATEWAY_URL + '/token',
		"token_endpoint_auth_methods_supported": ["client_secret_basic"],
		"registration_endpoint": process.env.OKTA_ORG + '/oauth2/v1/clients',
		"scopes_supported": ["openid", "profile", "launch", "launch/patient", "patient/*.*", "user/*.*", "offline_access"],
		"response_types_supported": ["code", "code id_token", "id_token", "refresh_token"],
		"introspection_endpoint": process.env.AUTHZ_ISSUER + '/v1/introspect',
		"revocation_endpoint": process.env.AUTHZ_ISSUER + '/v1/revoke',
		"capabilities": ["launch-ehr", "client-public", "client-confidential-symmetric", "context-ehr-patient", "sso-openid-connect"]
	}
}

function getLegacyMetadata() {
	var d = new Date();
	return {
		"resourceType" : "CapabilityStatement",
		"id" : "smart-app-launch-example",
		"text" : {
			"status" : "generated",
			"div" : ""
		},
		"url" : "http://fhir-registry.smarthealthit.org/CapabilityStatement/smart-app-launch-example",
		"version" : "1.0.0",
		"name" : "SMART App Launch Capability Statement Example w/Okta as OAuth2 AS",
		"status" : "draft",
		"experimental" : true,
		"date" : d.toISOString(),
		"publisher" : "Okta",
		"contact" : [
		{
		  "telecom" : [
			{
			  "system" : "url",
			  "value" : "http://hl7.org/fhir"
			}
		  ]
		}
		],
		"description" : "",
		"kind" : "capability",
		"software" : {
		"name" : "Okta SMART FHIR Demo"
		},
		"fhirVersion" : "3.0.1",
		"acceptUnknown" : "no",
		"format" : [
			"xml",
			"json"
		],
		"rest" : [
		{
		  "mode" : "server",
		  "documentation" : "An empty Capability Statement",
		  "security" : {
			"extension" : [
			  {
				"extension" : [
				  {
					"url" : "token",
					"valueUri" : process.env.GATEWAY_URL + '/token'
				  },
				  {
					"url" : "authorize",
					"valueUri" : process.env.GATEWAY_URL + '/authorize'
				  },
				 
				  {
					"url" : "introspect",
					"valueUri" : process.env.AUTHZ_ISSUER + '/v1/introspect'
				  },
				  {
					"url" : "revoke",
					"valueUri" : process.env.AUTHZ_ISSUER + '/v1/revoke'
				  },
				  {
					"url" : "register",
					"valueUri" : process.env.OKTA_ORG + '/oauth2/v1/clients'
				  }
				],
				"url" : "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris"
			  }
			],
			"service" : [
			  {
				"coding" : [
				  {
					"system" : "http://hl7.org/fhir/restful-security-service",
					"code" : "SMART-on-FHIR"
				  }
				],
				"text" : "OAuth2 using SMART-on-FHIR profile (see http://docs.smarthealthit.org)"
			  }
			]
		  }
		}
		]
	}
}

module.exports.metadataEndpoints = serverless(app)
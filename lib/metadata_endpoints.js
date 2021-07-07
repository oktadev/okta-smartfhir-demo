'use strict';

//These endpoints are essentially static endpoints that advertise key information about the SMART authorization server.
//They are dyanamic endpoints in this reference implementation purely for ease of deployment.
module.exports.smartConfigHandler = async () => {
	return {
		"authorization_endpoint": process.env.GATEWAY_URL + '/authorize',
		"token_endpoint": process.env.GATEWAY_URL + '/token',
		"token_endpoint_auth_methods_supported": ["client_secret_basic"],
		"registration_endpoint": 'https://' + process.env.OKTA_ORG + '/oauth2/v1/clients',
		"scopes_supported": ["openid", "profile", "launch", "launch/patient", "patient/*.*", "user/*.*", "offline_access"],
		"response_types_supported": ["code", "code id_token", "id_token", "refresh_token"],
		"introspection_endpoint": process.env.AUTHZ_ISSUER + '/v1/introspect',
		"revocation_endpoint": process.env.AUTHZ_ISSUER + '/v1/revoke',
		"capabilities": ["launch-ehr", "client-public", "client-confidential-symmetric", "context-ehr-patient", "sso-openid-connect"],
		"code_challenge_methods_supported": ["S256"]
	}
}

module.exports.metadataHandler = async () => {
	var d = new Date();
	return {
		"resourceType" : "CapabilityStatement",
		"id" : "okta_smart-app-launch-example",
		"name" : "SMART App Launch Capability Statement Example w/Okta as OAuth2 AS",
		"status" : "active",
		"experimental" : true,
		"date" : d.toISOString(),
		"publisher" : "Okta",
		"contact" : [
		{
		  "telecom" : [
			{
			  "system" : "url",
			  "value" : "https://okta.com"
			}
		  ]
		}
		],
		"description" : "This is an example implementation of the SMART launch framework using Okta as the identity and authorization platform.",
		"kind" : "capability",
		"software" : {
			"name" : "Okta SMART FHIR Demo"
		},
		"fhirVersion" : "4.0.1",
		"format" : [
			"xml",
			"json"
		],
		"rest" : [
		{
		  "mode" : "server",
		  "documentation" : "This is an example implementation of the SMART launch framework using Okta as the identity and authorization platform.",
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
					"valueUri" : 'https://' + process.env.OKTA_ORG + '/oauth2/v1/clients'
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

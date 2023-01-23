module.exports.smartTokenHook = {
    "status": "ACTIVE",
    "name" : "SMART Token Hook",
    "type" : "com.okta.oauth2.tokens.transform",
    "version" : "1.0.0",
    "channel" : {
        "type" : "HTTP",
        "version" : "1.0.0",
        "config" : {
            "uri" : null,
            "method" : "POST",
            "headers" : []
        }
    }
}

module.exports.oktaAPIM2MClientScopes = ["okta.apps.read", "okta.authorizationServers.read"]

module.exports.oktaAPIM2MClient = {
    "name": "oidc_client",
    "label": "Okta API M2M Client",
    "features": [],
    "signOnMode": "OPENID_CONNECT",
    "credentials": {
        "oauthClient": {
            "autoKeyRotation": true,
            "token_endpoint_auth_method": "private_key_jwt",
            "pkce_required": false
        }
    },
    "settings": {
        "app": {},
        "oauthClient": {
            "response_types": [
                "token"
            ],
            "grant_types": [
                "client_credentials"
            ],
            "jwks": {
                "keys": []
            },
            "application_type": "service",
            "consent_method": "REQUIRED",
            "issuer_mode": "DYNAMIC",
            "idp_initiated_login": {
                "mode": "DISABLED",
                "default_scope": []
            },
            "wildcard_redirect": "DISABLED"
        }
    }
}

module.exports.patientPickerApp = {
    "name": "oidc_client",
    "label": "Patient Picker",
    "signOnMode": "OPENID_CONNECT",
    "credentials": {
        "userNameTemplate": {
            "template": "${source.login}",
            "type": "BUILT_IN"
        },
        "oauthClient": {
            "autoKeyRotation": true,
            "token_endpoint_auth_method": "client_secret_basic",
            "pkce_required": false
        }
    },
    "settings": {
        "app": {},
        "implicitAssignment": true,
        "oauthClient": {
            "client_uri": null,
            "logo_uri": null,
            "redirect_uris": [],
            "response_types": [
                "code"
            ],
            "grant_types": [
                "authorization_code"
            ],
            "initiate_login_uri": "",
            "application_type": "web",
            "consent_method": "TRUSTED",
            "issuer_mode": "DYNAMIC",
            "idp_initiated_login": {
                "mode": "DISABLED",
                "default_scope": []
            },
            "wildcard_redirect": "DISABLED"
        }
    },
    "profile": {
        "implicitAssignment": true
    }
}

module.exports.sampleConfidentialApp = {
    "name": "oidc_client",
    "label": "Sample Confidential Client - Inferno Test Suite",
    "signOnMode": "OPENID_CONNECT",
    "credentials": {
        "userNameTemplate": {
            "template": "${source.login}",
            "type": "BUILT_IN"
        },
        "oauthClient": {
            "autoKeyRotation": true,
            "token_endpoint_auth_method": "client_secret_basic",
            "pkce_required": false
        }
    },
    "settings": {
        "app": {},
        "implicitAssignment": true,
        "oauthClient": {
            "client_uri": null,
            "logo_uri": null,
            "redirect_uris": [],
            "response_types": [
                "code"
            ],
            "grant_types": [
                "authorization_code",
                "refresh_token"
            ],
            "initiate_login_uri": "",
            "application_type": "web",
            "consent_method": "TRUSTED",
            "issuer_mode": "DYNAMIC",
            "idp_initiated_login": {
                "mode": "DISABLED",
                "default_scope": []
            },
            "wildcard_redirect": "DISABLED"
        }
    },
    "profile": {
        "implicitAssignment": true
    }
}

module.exports.fhirUserAttribute = {
    "definitions": {
        "custom": {
            "id": "#custom",
            "type": "object",
            "properties": {
                "fhirUser": {
                    "title": "FHIR User ID",
                    "description": "The user's ID within the FHIR server",
                    "type": "string",
                    "required": false,
                    "permissions": [
                        {
                            "principal": "SELF",
                            "action": "READ_ONLY"
                        }
                    ]
                }
            },
            "required": []
        }
    }
}


module.exports.authzServer = {
    "name": "SMART Authorization Server",
    "description": "Demo authorization server to show SMART/FHIR support",
    "audiences": [],
    "issuerMode": "DYNAMIC"
}

module.exports.authzScopes = [
    {
        "name": "fhirUser",
        "description": "fhirUser",
        "system": false,
        "default": false,
        "displayName": "fhirUser",
        "consent": "IMPLICIT",
        "metadataPublish": "NO_CLIENTS"
    },
    {
        "name": "launch",
        "description": "launch",
        "system": false,
        "default": false,
        "displayName": "launch",
        "consent": "IMPLICIT",
        "metadataPublish": "NO_CLIENTS"
    },
    {
        "name": "launch/patient",
        "description": "launch/patient",
        "system": false,
        "default": false,
        "displayName": "launch/patient",
        "consent": "IMPLICIT",
        "metadataPublish": "NO_CLIENTS"
    },
    {
        "name": "patient/Patient.read",
        "description": "Ability to read the selected patient's record",
        "system": false,
        "default": false,
        "displayName": "Ability to read the selected patient's record",
        "consent": "REQUIRED",
        "metadataPublish": "NO_CLIENTS"
    },
    {
        "name": "patient/Observation.read",
        "description": "Ability to read the selected patient's vital signs",
        "system": false,
        "default": false,
        "displayName": "Ability to read the selected patient's vital signs",
        "consent": "REQUIRED",
        "metadataPublish": "NO_CLIENTS"
    }
]

module.exports.authzClaims = [
    {
        "name": "fhirUser",
        "claimType": "IDENTITY",
        "valueType": "EXPRESSION",
        "status": "ACTIVE",
        "value": "user.fhirUser",
        "alwaysIncludeInToken": "TRUE",
        "conditions": {
            "scopes": ["fhirUser"]
        },
        "system": false
    },
    {
        "name": "fhirUser",
        "claimType": "RESOURCE",
        "valueType": "EXPRESSION",
        "status": "ACTIVE",
        "value": "user.fhirUser",
        "alwaysIncludeInToken": "TRUE",
        "conditions": {
            "scopes": ["fhirUser"]
        },
        "system": false
    }
]

module.exports.patientPickerAuthzPolicy = {
    "name": "Patient Picker Authorization Policy",
    "description": "Policy for the patient picker app",
    "priority": 1,
    "system": false,
    "conditions": {
        "clients": {
            "include": []
        }
    },
    "type": "OAUTH_AUTHORIZATION_POLICY"
}

module.exports.patientPickerAuthzPolicyRule =  {
    "name": "Allow basic OIDC Only",
    "priority": 1,
    "system": false,
    "conditions": {
        "people": {
            "users": {
                "include": [],
                "exclude": []
            },
            "groups": {
                "include": [
                    "EVERYONE"
                ],
                "exclude": []
            }
        },
        "grantTypes": {
            "include": [
                "authorization_code"
            ]
        },
        "scopes": {
            "include": [
                "openid",
                "profile",
                "email"
            ]
        }
    },
    "actions": {
        "token": {
            "accessTokenLifetimeMinutes": 10,
            "refreshTokenLifetimeMinutes": 0,
            "refreshTokenWindowMinutes": 10080
        }
    },
    "type": "RESOURCE_ACCESS"
}

module.exports.smartAppAuthzPolicy = {
    "name": "SMART Application Authorization Policy",
    "description": "Allows the inferno smart fhir test app",
    "priority": 2,
    "system": false,
    "conditions": {
        "clients": {
            "include": [
                "ALL_CLIENTS"
            ]
        }
    },
    "type": "OAUTH_AUTHORIZATION_POLICY"
}

module.exports.smartAppAuthzPolicyRule = {
    "name": "Allow all",
    "priority": 1,
    "system": false,
    "conditions": {
        "people": {
            "users": {
                "include": [],
                "exclude": []
            },
            "groups": {
                "include": [
                    "EVERYONE"
                ],
                "exclude": []
            }
        },
        "grantTypes": {
            "include": [
                "authorization_code"
            ]
        },
        "scopes": {
            "include": [
                "*"
            ]
        }
    },
    "actions": {
        "token": {
            "accessTokenLifetimeMinutes": 60,
            "refreshTokenLifetimeMinutes": 0,
            "refreshTokenWindowMinutes": 10080,
            "inlineHook": {
                "id": null
            }
        }
    },
    "type": "RESOURCE_ACCESS"
}
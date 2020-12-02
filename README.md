# okta-smartfhir-demo
This repository contains all of the components necessary to provide a SMART-launch compatible authorization platform leveraging Okta as the core identity authentication and authorization service.

For full documentation on this reference Okta-SMART implementation, please refer to the dedicated repository here:
https://github.com/dancinnamon-okta/okta-smartfhir-docs

# Features
The following features of the [SMART launch framework](http://hl7.org/fhir/smart-app-launch/index.html) are supported:
- Standalone launch sequence
- Launch parameters- including a patient picker for selecting the in-scope patient
- Public and Confidential client applications
- Support for partial consent (OAuth2 downscoping)

# Components
This entire project is managed by the [serverless framework](https://www.serverless.com/) - which is an easy way to manage numerous cloud resources as a single unit. The codebase was developed for, and has been tested with AWS technologies.
This repository includes the following high level endpoints:
- **Authorize endpoint:** This endpoint is intended to be a lightweight proxy in front of Okta's /authorize endpoint, and handles the user flow to the patient picker and custom consent screen.
- **Patient Picker:** The patient picker is a small application that enables the end user to select which patient they wish to consent and authorize for. Ultimately the patient picker will be updating the original application's /authorize request to remove the unapproved scopes, and to include the patient id.
- **Okta Token Hook:** The token hook endpoint serves the purpose of validating the the authorize request actually went through the Patient Picker, and it also is responsible for processing the patient id selected by the user if any.
- **Token endpoint:** The token endpoint is a lightweight proxy in front of Okta's  /token endpoint, and handles public client authentication.
- **FHIR API Demo:** To show how the process works with sample data, this project also has a number of proxies that forward FHIR requests to http://hapi.fhir.org for sample data.
- **Keys Endpoint:** When a public SMART app requests a token from the Token Proxy, no client authentication is required- however Okta requires client authentication for authorization code token requests, per the OAuth2 specification. To accommodate for this, the Token endpoint uses a single private key, and performs [private_key_jwt](https://developer.okta.com/docs/reference/api/oidc/#jwt-with-private-key) authentication against Okta.  This endpoint exposes the **public** side of the key, and is to be configured as a valid JWK for the client application in Okta. See [Creating an app with JWKS](https://developer.okta.com/docs/reference/api/oauth-clients/#request-example-create-a-service-app-with-a-jwks) for a similar example.

# High Level Architecture
![Simplified Architecture](https://github.com/dancinnamon-okta/okta-smartfhir-demo/blob/master/doc/simple_architecture.png)

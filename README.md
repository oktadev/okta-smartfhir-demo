# okta-smartfhir-demo
This repository contains all of the components necessary to provide a SMART-launch compatible authorization platform leveraging Okta as the core identity authentication and authorization service.

# Features
The following features of the [SMART launch framework](http://hl7.org/fhir/smart-app-launch/index.html) are supported:
- Standalone launch sequence
- Launch parameters- including a patient picker for selecting the in-scope patient
- Public and Confidential client applications- support for public clients w/o authentication until PKCE support is introduced into the specification
- Support for partial consent (OAuth2 downscoping)

# Components
This entire project is managed by the [serverless framework](https://www.serverless.com/) - which is an easy way to manage numerous cloud resources as a single unit. The codebase was developed for, and has been tested with AWS technologies.
This repository includes the following endpoints:
- **Authorize endpoint:** This endpoint is intended to be a lightweight proxy in front of Okta's /authorize endpoint, and handles the user flow to the patient picker and custom consent screen.
- **Patient Picker:** The patient picker is a small application that enables the end user to select which patient they wish to consent and authorize for. Ultimately the patient picker will be updating the original application's /authorize request to remove the unapproved scopes, and to include the patient id.
- **Okta Token Hook:** The token hook endpoint serves the purpose of validating the the authorize request actually went through the Patient Picker, and it also is responsible for processing the patient id selected by the user if any.
- **Token endpoint:** The token endpoint is a lightweight proxy in front of Okta's  /token endpoint, and handles public client authentication.
- **FHIR API Demo:** To show how the process works with sample data, this project also has a number of proxies that forward FHIR requests to http://hapi.fhir.org for sample data.
- **Keys Endpoint:** When a public SMART app requests a token from the Token Proxy, no client authentication is required- however Okta requires client authentication for authorization code token requests, per the OAuth2 specification. To accommodate for this, the Token endpoint uses a single private key, and performs [private_key_jwt](https://developer.okta.com/docs/reference/api/oidc/#jwt-with-private-key) authentication against Okta.  This endpoint exposes the **public** side of the key, and is to be configured as a valid JWK for the client application in Okta. See [Creating an app with JWKS](https://developer.okta.com/docs/reference/api/oauth-clients/#request-example-create-a-service-app-with-a-jwks) for a similar example.

# How to use
Follow these steps to set this up in your own environment!
## Prerequisites
This example was designed and built for the AWS cloud- so you'll need an AWS account to run this example. The serverless framework used in this example supports other clouds as well, so updating for Azure or GCP should be relatively straightforward.

Additionally, you'll need the following software installed on your development machine to build and deploy this example:
- Node.js 12+
- Serverless framework ([Get started here](https://www.serverless.com/framework/docs/getting-started/#via-npm))
- OpenSSL libraries (included on any *nix distribution)

## Setup Steps
### Step 1- Clone this repository into your development machine filesystem.
```
git clone https://github.com/dancinnamon-okta/okta-smartfhir-demo.git
cd okta-smartfhir-demo
```

### Step 2- Generate an SSL public/private key that will be used by the token endpoint to authenticate with Okta.
``` 
openssl genrsa -out private_key.pem 2048
openssl rsa -in private_key.pem -out public_key.pem -pubout -outform PEM
```
***Note - at this time the file names are hard-coded, so please name them exactly as-is (or submit a PR to make this configurable)***

### Step 3- Install all of the libraries, and prepare for configuration
```
mv serverless.yml.example serverless.yml
npm install
```
### Step 4- Create the authorization server in Okta
In Okta, create a custom authorization server that you'll be using to authorize users in the demo.
Update the serverless.yml with the proper details:
```
AUTHZ_ISSUER: https://_YOUR_ORG_.oktapreview.com/oauth2/_YOUR_AUTHZ_SERVER_
AUTHZ_SERVER: _YOUR_AUTHZ_SERVER_
OKTA_ORG: _YOUR_ORG_.oktapreview.com
```

### Step 5- Create the Patient Picker application in Okta
In Okta, create a new OIDC web application, using the authorization code flow only.  Remember to assign your users to this app. 
Update the serverless.yml file with the proper details:
```
PICKER_DISPLAY_NAME: Patient Picker
PICKER_CLIENT_ID: _CLIENT_ID_FOR_PATIENT_PICKER_
PICKER_CLIENT_SECRET: _CLIENT_SECRET_FOR_PATIENT_PICKER_
```

### Step 6- Create an API key for the Patient Picker
At this time, the Patient Picker application uses an API key to read authorization server details, so we need an API key minted. PR's are welcome to update to use OAuth2 instead of an API key.
Update the serverless.yml file with the proper details:
```
API_KEY: _AN_API_KEY_
```

### Step 7- Deploy!
To deploy this example, run the following command:
```
serverless deploy -v
```
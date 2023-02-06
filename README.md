# okta-smartfhir-demo
This repository contains all of the components necessary to provide a SMART-launch compatible authorization platform leveraging Okta as the core identity authentication and authorization service.

Experimental support for SMART-launch v2 is available at https://github.com/dancinnamon-okta/okta-smartfhirv2-demo which will shortly merge into this repository.

For full documentation on this reference Okta-SMART implementation, please refer to the dedicated repository here:
https://github.com/oktadev/okta-smartfhir-docs

*Note - a new automated deploy process and instructions have been rolled out! If you were thrown off by this change, the original instructions are available [here](https://github.com/oktadev/okta-smartfhir-demo/tree/original-v1)*

# Features
The following features of the [SMART launch framework v1](http://hl7.org/fhir/smart-app-launch/1.0.0/) are supported:
- Standalone launch sequence
- Launch parameters- including a patient picker for selecting the in-scope patient
- Public and Confidential client applications
- Support for partial consent (OAuth2 downscoping)

# Components
This entire project is managed by the [serverless framework](https://www.serverless.com/) - which is an easy way to manage numerous cloud resources as a single unit. The codebase was developed for, and has been primarily tested with AWS technologies.
This repository includes the following high level endpoints:
- **SMART Authorize endpoint:** This endpoint is a secondary, SMART specific /authorize endpoint that handles the user flow to the patient picker and custom consent screen.

- **Patient Selection Screen + Consent:** The patient picker is a small application that enables the end user to select which patient they wish to consent and authorize for. Ultimately the patient picker will be updating the original application's /authorize request to remove the unapproved scopes, and to include the patient id.

- **Okta Token Hook:** The token hook endpoint serves the purpose of validating the the authorize request actually went through the Patient Picker, and it also is responsible for processing the patient id selected by the user if any.

- **Token endpoint:** The token endpoint is a lightweight proxy in front of Okta's  /token endpoint, and handles launch responses like launch/patient.

# Pre-requisities
In order to deploy this solution, you must have the following pre-requisities ready to go:

- An Okta tenant (a free tenant available at [Okta's Developer Site](https://developer.okta.com/signup) will suffice).
- Node.js
- [serverless framework](https://www.serverless.com/) installed on the machine you're deploying from
- The base URL of the FHIR service that you wish to secure
- A domain name that you wish to use as the base URL for the authorization service (for example: smartauth.your.tld)

# Installation instructions
The installation instructions for this repository are available on a dedicated documentation repository found here: https://github.com/oktadev/okta-smartfhir-docs

# FHIR Service
As of December, 2022- the example FHIR service has been removed from this repository. Many implementers came to the table with their own FHIR services, and including one here became confusing.  To replace the example FHIR service, a new repository has been created at https://github.com/dancinnamon-okta/secured-fhir-proxy

# High Level Architecture
![Simplified Architecture](./doc/SimplifiedArchitecture.png)

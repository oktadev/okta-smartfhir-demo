'use strict';
const models = require('./okta_object_models');
const fs = require('fs');
const okta = require('@okta/okta-sdk-nodejs');
const jose = require('node-jose');
const config = JSON.parse(fs.readFileSync('./okta_org_config.json', 'utf-8'));
const client = getClient(config)

console.log(`Setting up Okta org: ${config.OKTA_ORG}`)
console.log(`With Suffix: ${config.SUFFIX}`)
main()

async function main() {
    const hookId = await createHooks(config, client)
    const appDetails = await createApps(config, client)
    await updateUserSchema(config, client)
    const authzServerId = await createAuthzServer(config, client, hookId, appDetails.pickerClientId)

    console.log('Okta objects created!')
    console.log('Please configure the following in your serverless.yml:')
    console.log('--------------------------------------------------------------------------')
    console.log(`Authorization Server ID (FHIR_AUTHZ_SERVER_ID): ${authzServerId}`)
    console.log('--------------------------------------------------------------------------')
    console.log('Patient Picker App Details:')
    console.log(`Patient Picker App Client ID (PICKER_CLIENT_ID): ${appDetails.pickerClientId}`)
    console.log(`Patient Picker App Client Secret (PICKER_CLIENT_SECRET): ${appDetails.pickerClientSecret}`)
    console.log('--------------------------------------------------------------------------')
    console.log('Okta management API client Details:')
    console.log('--------------------------------------------------------------------------')
    console.log(`Okta management API Client ID (OKTA_API_CLIENTID): ${appDetails.apiM2MClientId}`)
    console.log('Okta management API Private Key (OKTA_API_PRIVATEKEYFILE):')
    console.log('Copy/Paste the object shown below into a file within your "keys" folder, and put the file name in OKTA_API_PRIVATEKEYFILE')
    console.log('--------------------------------------------------------------------------')
    console.log(appDetails.apiM2MClientPrivateKey)
    console.log('--------------------------------------------------------------------------')
    console.log('A sample confidential client application has been created for your convenience.  You may use this with the ONC Inferno test suite:')
    console.log(`Client ID: ${appDetails.sampleAppId}`)
    console.log(`Client Secret: ${appDetails.sampleAppSecret}`)
    console.log('--------------------------------------------------------------------------')
}

//Create Token Hook
async function createHooks(config, client) {
    
    var hookModel = models.smartTokenHook
    if(config.SUFFIX) {
        hookModel.name += '-' + config.SUFFIX
    }
    //Put in the URL of the hook! Probably from config?
    hookModel.channel.config.uri = `https://${config.AUTHZ_BASE_DOMAIN}/tokenhook`

    console.log(`Creating hook: ${hookModel.name}`)

    var foundHook = null
    //See if we have this object already.  If we do, let's skip.
    //const existingHooks = await client.listInlineHooks(query)
    await client.listInlineHooks().each(hook => {
        if(hook.name == hookModel.name) {
            foundHook = hook
            return
        }
    })

    console.debug("Existing hooks found:")
    console.debug(foundHook)

    if(!foundHook) {
        console.log('Creating hook: ' + hookModel.name)
        console.debug('Hook object:')
        console.debug(hookModel)
    
        const createdHook = await client.createInlineHook(hookModel)
    
        console.log('Hook Created.')
        return createdHook.id
    }
    else {
        console.log(`The inline hook: ${hookModel.name} already exists. Skipping create. Please manually delete it first and try again.`)
        return foundHook.id
    }
}

//Create Necessary Applications
async function createApps(config, client) {
    //First, create the patient picker app.
    var patientPickerModel = models.patientPickerApp
    var apiM2MClientModel = models.oktaAPIM2MClient
    var apiScopes = models.oktaAPIM2MClientScopes
    var sampleConfidentialModel = models.sampleConfidentialApp

    if(config.SUFFIX) {
        patientPickerModel.label += '-' + config.SUFFIX
        sampleConfidentialModel.label += '-' + config.SUFFIX
        apiM2MClientModel.label += '-' + config.SUFFIX
    }

    //Fill in what we need to for our patient picker deployment.
    patientPickerModel.settings.oauthClient.redirect_uris.push(`https://${config.AUTHZ_BASE_DOMAIN}/picker_oidc_callback`)
    const pickerDetails = await createApp(config, client, patientPickerModel)

    const jwk = await getPublicPrivateJwks()
    apiM2MClientModel.settings.oauthClient.jwks.keys.push(jwk.publicKey)
    const apiM2MDetails = await createApp(config, client, apiM2MClientModel)

    if(apiM2MDetails.created) {
        console.log('API Access Client Created. Granting Okta management API scopes.')
        for(const scope of apiScopes) {
            console.log(`Adding scope: ${scope} to Okta Org: ${config.OKTA_ORG}`)
            console.log(client.http)
            await client.grantConsentToScope(apiM2MDetails.id, {"issuer": config.OKTA_ORG, "scopeId": scope})
        }
    }

    //Fill in what we need for our confidential client example deployment.
    sampleConfidentialModel.settings.oauthClient.redirect_uris.push(`https://${config.AUTHZ_BASE_DOMAIN}/smart_proxy_callback`)
    sampleConfidentialModel.settings.oauthClient.redirect_uris.push(`https://${config.AUTHZ_BASE_DOMAIN}/https://inferno.healthit.gov/suites/custom/smart/redirect`)
    const sampleAppDetails = await createApp(config, client, sampleConfidentialModel)
    return {
        "pickerClientId": pickerDetails.id,
        "pickerClientSecret": pickerDetails.created ? pickerDetails.secret : 'Cannot display generated client secret for an existing app.  Please delete/recreate the app if you did not save the client secret already.',
        "apiM2MClientId": apiM2MDetails.id,
        "apiM2MClientPrivateKey": apiM2MDetails.created ? jwk.privateKey : 'Cannot display generated private key for an existing app.  Please delete/recreate the app if you did not save the private key already.',
        "sampleAppId": sampleAppDetails.id,
        "sampleAppSecret": sampleAppDetails.created ? sampleAppDetails.secret : 'Cannot display generated client secret for an existing app.  Please delete/recreate the app if you did not save the client secret already.'
    }
}

//Creates a single application, given the application JSON model.
async function createApp(config, client, appModel) {
    console.log(`Creating app: ${appModel.label}`)

    var foundApp = null
    const query = {'filter': 'name eq "oidc_client"'}
    //See if we have this object already.  If we do, let's skip.
    await client.listApplications(query).each(app => {
        if(app.label == appModel.label) {
            foundApp = app
            return
        }
    })

    console.debug('Existing apps found:')
    console.debug(foundApp)

    if(!foundApp) {
        console.log('Creating app: ' + appModel.label)
        console.debug('App object:')
        console.debug(appModel)
    
       const createdApp = await client.createApplication(appModel)
    
        console.log('App Created.')
        console.debug(createdApp)
        return {
            created: true,
            id: createdApp.id,
            secret: createdApp.credentials.oauthClient.client_secret
        }
    }
    else {
        console.log(`The app: ${appModel.label} already exists. Skipping create. Please manually delete it first and try again.`)
        return {
            created: false,
            id: foundApp.id,
            secret: null
        }
    }
}

//Create Necessary Authz Server
async function createAuthzServer(config, client, inlineHookId, patientPickerAppId) {
    var authzServerModel = models.authzServer
    if(config.SUFFIX) {
        authzServerModel.name += '-' + config.SUFFIX
    }
    authzServerModel.audiences.push(config.FHIR_BASE_URL)

    console.log(`Creating authorization server: ${authzServerModel.name}`)
    console.log(`Inline Hook Id: ${inlineHookId}`)
    console.log(`Patient Picker App Id: ${patientPickerAppId}`)

    var foundAuthzServer = null
    //See if we have this object already.  If we do, let's skip.
    //const existingHooks = await client.listInlineHooks(query)
    await client.listAuthorizationServers({'q': authzServerModel.name}).each(server => {
        if(server.name == authzServerModel.name) {
            foundAuthzServer = server
            return
        }
    })

    console.debug("Existing authorization server found:")
    console.debug(foundAuthzServer)

    if(!foundAuthzServer) {
        console.log('Creating authorization server: ' + authzServerModel.name)
        console.debug('Server object:')
        console.debug(authzServerModel)
    
        const createdAuthzServer = await client.createAuthorizationServer(authzServerModel)
    
        console.log('Authorization Server Created.')
        await addAuthzScopes(config, client, createdAuthzServer.id)
        await addAuthzClaims(config, client, createdAuthzServer.id)
        await addAuthzPolicies(config, client, createdAuthzServer.id, inlineHookId, patientPickerAppId)
        console.log('Finished configuration of the authorization server.')
        return createdAuthzServer.id
    }
    else {
        console.log(`The authorization server: ${authzServerModel.name} already exists. Skipping create. Please manually delete it first and try again.`)
        return foundAuthzServer.id
    }
}

async function addAuthzScopes(config, client, authzServerId) {
    //We're not dealing with "existing" items here.  That's handled at the authz server level.  If we're here, it means we definitely need to add scopes.
    console.log('Adding SMART scopes to the authorization server...')
    const scopes = models.authzScopes
    for(const scope of scopes) {
        console.log('Adding scope: ' + scope.name)
        console.log(scope)
        await client.createOAuth2Scope(authzServerId, scope)
    }
    console.log('Finished adding scopes.')
}

async function addAuthzClaims(config, client, authzServerId) {
    //We're not dealing with "existing" items here.  That's handled at the authz server level.  If we're here, it means we definitely need to add scopes.
    console.log('Adding SMART claims to the authorization server...')
    const claims = models.authzClaims
    for(const claim of claims) {
        console.log('Adding claim: ' + claim.name)
        await client.createOAuth2Claim(authzServerId, claim)
    }
    console.log('Finished adding claims.')
}

async function addAuthzPolicies(config, client, authzServerId, inlineHookId, patientPickerAppId) {
    //We're not dealing with "existing" items here.  That's handled at the authz server level.  If we're here, it means we definitely need to add scopes.
    console.log('Adding authorization policies to the authorization server...')
    const patientPickerAuthzPolicy = models.patientPickerAuthzPolicy
    const smartAppAuthzPolicy = models.smartAppAuthzPolicy
    const patientPickerAuthzPolicyRule = models.patientPickerAuthzPolicyRule
    const smartAppAuthzPolicyRule = models.smartAppAuthzPolicyRule

    console.log('Adding authorization policy: ' + patientPickerAuthzPolicy.name)
    const createdPickerAuthzPolicy = await client.createAuthorizationServerPolicy(authzServerId, patientPickerAuthzPolicy)
    console.log('Adding authorization policy rule : ' + patientPickerAuthzPolicyRule.name)
    await client.createAuthorizationServerPolicyRule(createdPickerAuthzPolicy.id, authzServerId, patientPickerAuthzPolicyRule)

    console.log('Adding authorization policy: ' + smartAppAuthzPolicy.name)
    const createdSmartAppAuthzPolicy = await client.createAuthorizationServerPolicy(authzServerId, smartAppAuthzPolicy)
    console.log('Adding authorization policy rule : ' + smartAppAuthzPolicyRule.name)
    smartAppAuthzPolicyRule.actions.token.inlineHook.id = inlineHookId
    await client.createAuthorizationServerPolicyRule(createdSmartAppAuthzPolicy.id, authzServerId, smartAppAuthzPolicyRule)
    
    console.log('Finished configuring authorization policies.')
}

//Create fhirUser user attribute
async function updateUserSchema(config, client) {
    var attributeModel = models.fhirUserAttribute
    if(config.SUFFIX) {
        attributeModel.definitions.custom.properties.fhirUser.title += '-' + config.SUFFIX
    }

    console.log('Creating user schema attribute: fhirUser')

    //See if we have this object already.  If we do, let's skip.
    const existingSchema = await client.getUserSchema('default')

    console.debug("Existing custom schema attributes found:")
    console.debug(existingSchema.definitions.custom)

    if(!existingSchema.definitions.custom.properties.fhirUser) {
        console.log('Adding the fhirUser attribute: ' + attributeModel.definitions.custom.properties.fhirUser.title)
        console.debug('Schema object:')
        console.debug(attributeModel)
    
        await client.updateUserProfile('default', attributeModel)
    
        console.log('fhirUser attribute added.')
    }
    else {
        console.log(`The fhirUser user attribute already exists. Skipping create. Please manually delete it first and try again.`)
    }
}

async function getPublicPrivateJwks() {
    console.log('Generating a new private key for the patient picker to use for Okta API management calls')
    const keyStore = jose.JWK.createKeyStore()
    const newKeyStore = await keyStore.generate('RSA', 4096, {alg: 'RS256', use: 'sig' })
    const newKey = newKeyStore.toJSON(true)

    return {
        publicKey: {
            kty: newKey.kty,
            e: newKey.e,
            kid: newKey.kid,
            n: newKey.n
        },
        privateKey: {
            d: newKey.d,
            p: newKey.p,
            q: newKey.q,
            dp: newKey.dp,
            qi: newKey.qi,
            kty: newKey.kty,
            e: newKey.e,
            kid: newKey.kid,
            n: newKey.n
        }
    }
}

//Custom domain later! Different script??

function getClient(config) {
    return new okta.Client({
        orgUrl: config.OKTA_ORG,
        token: config.OKTA_API_KEY
    });
    
}
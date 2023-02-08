//This script is intended to be a guided process for deploying all of the required configurations and infrastructue for supporting SMART/FHIR with Okta.
const readline = require('readline');
const fs = require('fs');
const handlers = require('./deploy_aws_handlers').handlers
const utils = require('./deploy_aws_utils')
const STATE_FILE = './work/state'
var state = {}

const STATE_QUESTIONNAIRE = 'deploy_questionnaire'
const STATE_GENERATE_OKTA_CONFIG_FILE = 'generate_okta_config'
const STATE_OKTA_INITIAL = 'deploy_initial_okta'
const STATE_OKTA_CREATE_CUSTOM_DOMAIN = 'okta_create_custom_domain'
const STATE_OKTA_VERIFY_CUSTOM_DOMAIN = 'okta_verify_custom_domain'
const STATE_GENERATE_SERVERLESS_CONFIG_FILE = 'generate_serverless_config'
const STATE_AWS_CERTS = 'aws_certs'
const STATE_AWS_CUSTOM_DOMAIN = 'aws_custom_domain'
const STATE_COLLECT_AWS_API_GATEWAY_DOMAIN = 'collect_aws_api_gateway_domain'
const STATE_AWS_DEPLOY = 'aws_deploy'
const STATE_UPDATE_DOMAIN_CNAME = 'update_domain_cname'
const STATE_OKTA_FINAL = 'deploy_final_okta'
const STATE_FINISHED = 'finished'

const states = [
    STATE_QUESTIONNAIRE,
    STATE_GENERATE_OKTA_CONFIG_FILE,
    STATE_OKTA_INITIAL,
    STATE_OKTA_CREATE_CUSTOM_DOMAIN,
    STATE_OKTA_VERIFY_CUSTOM_DOMAIN,
    STATE_AWS_CERTS,
    STATE_AWS_CUSTOM_DOMAIN,
    STATE_COLLECT_AWS_API_GATEWAY_DOMAIN,
    STATE_GENERATE_SERVERLESS_CONFIG_FILE,
    STATE_AWS_DEPLOY,
    STATE_UPDATE_DOMAIN_CNAME,
    STATE_OKTA_FINAL,
    STATE_FINISHED
]

main()

async function main() {
    const rl = readline.createInterface(process.stdin, process.stdout);
    try {
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        if(state.currentStep == STATE_FINISHED) {
            const newDeploy = await utils.askSpecific(rl, 'An existing finished deployment was found. Start a new deployment?', ['y','n'])
            if(newDeploy == 'n') {
                await handlers['handle_finished'](rl, state)
            }
            else {
                console.log('Starting new deployment.')
                state = initState()
            }
        }
        else {
            const continueDeploy = await utils.askSpecific(rl, `An existing in-process deployment was found. Continue that deployment (Next step is ${state.currentStep})?`, ['y','n'])
            if(continueDeploy == 'n') {
                state = initState()
            }
        }
    }
    catch(err) {
        console.log('No in-process deployment found. Starting with a new deployment!')
        state = initState()
    }

    console.log('Starting deployment tasks...')
    console.log('Current task: ' + state.currentStep)
    while(state.currentStep != STATE_FINISHED) {
        console.log('Processing deployment task: ' + state.currentStep)
        await handlers[`handle_${state.currentStep}`](rl, state)

        console.log('Deployment task complete. Saving state...')
        state.currentStep = states[states.indexOf(state.currentStep) + 1]
        saveState(state)

        const continueNext = await utils.askSpecific(rl, `Would you like to continue on to the next step (${state.currentStep})?`, ['y','n'])
        if(continueNext == 'n') {
            break
        }
    }
    if(state.currentStep == STATE_FINISHED) {
        await handlers['handle_finished'](rl, state)
    }
    rl.close()
    return
}

function initState() {
    return {
        currentStep: STATE_QUESTIONNAIRE,
        deploymentName: '',
        smartVersions: '',
        awsRegion: '',
        baseDomain: '',
        fhirBaseUrl: '',
        oktaOrg: '',
        oktaApiKey: '',
        oktaDomainId: '',
        apiGatewayBackendDomain: '',
        sampleUserName: '',
        sampleUserPassword: '',
        sampleUserType: '',
        sampleUserFhirId: '',
        oktaApiClientId: '',
        oktaApiPrivateKey: '',
        oktaApiPrivateKeyFile: '',
        pickerClientId: '',
        pickerClientSecret: '',
        authorizationServerId: ''
    }
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8');
}
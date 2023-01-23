const okta = require('@okta/okta-sdk-nodejs');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./okta_org_config.json', 'utf-8'));

console.log(`Setting up custom domain on Okta org: ${config.OKTA_ORG}`)
console.log(`Custom domain: ${config.AUTHZ_BASE_DOMAIN}`)
main()

async function main() {
    const client = getClient(config)
    const domainConfig = {
        "certificateSourceType": "OKTA_MANAGED",
        "domain": config.AUTHZ_BASE_DOMAIN
    }
    const domain = await client.createDomain(domainConfig)
    if(domain.id) {
        console.log('Initial domain creation successful. To finish this operation, set up the following DNS records in your DNS provider:')
        console.log('----------------------------------------------------')
        for(const record of domain.dnsRecords) {
            console.log(`RecordType: ${record.recordType} | Fully Qualified Name: ${record.fqdn} | Value: ${record.values[0]}`)
        }
        console.log('----------------------------------------------------')
        console.log('Once complete, run: node verify_custom_domain.js ' + domain.id)
    }
    else {
        console.log('Domain setup failed.  Ensure that both your OKTA_ORG and your AUTHZ_BASE_DOMAIN attributes are set in your okta_org_config.json file.')
    }
}
function getClient(config) {
    return new okta.Client({
        orgUrl: config.OKTA_ORG,
        token: config.OKTA_API_KEY
    });
}
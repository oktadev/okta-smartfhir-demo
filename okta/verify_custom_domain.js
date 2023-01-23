const okta = require('@okta/okta-sdk-nodejs');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./okta_org_config.json', 'utf-8'));

console.log(`Verifying custom domain on Okta org: ${config.OKTA_ORG}`)
console.log(`Custom domain: ${config.AUTHZ_BASE_DOMAIN}`)
console.log('Domain ID: ' + process.argv[process.argv.length -1])
main(process.argv[process.argv.length -1])

async function main(domainId) {
    const client = getClient(config)

    const domain = await client.verifyDomain(domainId)
    if(domain.validationStatus == 'COMPLETED' || domain.validationStatus == 'VERIFIED') {
        console.log('Domain setup complete! Your Okta org should now be available at: https://' + config.AUTHZ_BASE_DOMAIN)
    }
    else {
        console.log('Domain setup not yet complete.  Awaiting DNS record verification.')
        console.log('----------------------------------------------------')
        for(const record of domain.dnsRecords) {
            console.log(`RecordType: ${record.recordType} | Fully Qualified Name: ${record.fqdn} | Value: ${record.values[0]}`)
        }
        console.log('----------------------------------------------------')
        console.log('Once complete, re-run this command: node verify_custom_domain.js ' + domain.id)
    }
}
function getClient(config) {
    return new okta.Client({
        orgUrl: config.OKTA_ORG,
        token: config.OKTA_API_KEY
    });
}
'use strict';
const serverless = require('serverless-http')
const express = require('express')
const app = express()

// Mock patient access service.
app.get('/patientMockService', (request, response) => {
  //TODO: Actually check the access token passed in.
  response.send([
    {patient_id: '642726', patient_name: 'Peter Chalmers (45)'},
    {patient_id: '1315163', patient_name: 'Jane Doe (25)'},
    {patient_id: '1440422', patient_name: 'Samuel331 Ortiz186 (31)'}
  ])
})


module.exports.mockPatientService = serverless(app)
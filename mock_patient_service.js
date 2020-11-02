'use strict';
const serverless = require('serverless-http')
const express = require('express')
const app = express()

// Mock patient access service.
app.get('/patientMockService', (request, response) => {
  //TODO: Actually check the access token passed in.
  response.send([
    {patient_id: '1440422', patient_name: 'Samuel Ortiz (31)'},
	{patient_id: '92e12467-e074-4349-a6d4-e88be191b39b', patient_name: 'Amberly Bahringer (65)'},
	{patient_id: 'c769110f-4d4e-4375-a706-c5d78f729544', patient_name: 'Jann Ferry (63)'}
  ])
})


module.exports.mockPatientService = serverless(app)
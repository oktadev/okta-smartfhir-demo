'use strict';
const mockPatientLib = require('../lib/mock_patient_service')

// Mock patient access service. AWS Lambda implementation.
// For more detail see the mock patient library.
module.exports.mockPatientServiceHandler = async (event, context) => {
	var mockPatientResult = await mockPatientLib.mockPatientServiceHandler()
	return {
		statusCode: 200,
		body: JSON.stringify(mockPatientResult)
	}
}
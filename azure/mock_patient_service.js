'use strict';
const mockPatientLib = require('../lib/mock_patient_service')
const logIntercept = require('azure-function-log-intercept');

// Mock patient access service. Azure Function implementation.
// For more detail see the mock patient library.
module.exports.mockPatientServiceHandler = async (context, req) => {
	logIntercept(context)
	var mockPatientResult = await mockPatientLib.mockPatientServiceHandler()
	context.res = {
		status: 200,
		body: JSON.stringify(mockPatientResult)
	}
}
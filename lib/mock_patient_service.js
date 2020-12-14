'use strict';

// Mock patient access service.
// Just returns a list of sample patients for display in the custom consent patient picker.
// In a real implementation, this service would make an API call to an internal fine grained authorization service.
module.exports.mockPatientServiceHandler = async () => {
	return [
		{patient_id: '1440422', patient_name: 'Samuel Ortiz (31)'},
		{patient_id: '92e12467-e074-4349-a6d4-e88be191b39b', patient_name: 'Amberly Bahringer (65)'},
		{patient_id: 'c769110f-4d4e-4375-a706-c5d78f729544', patient_name: 'Jann Ferry (63)'}
	]
}
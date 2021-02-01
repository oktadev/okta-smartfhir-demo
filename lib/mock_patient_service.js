'use strict';

// Mock patient access service.
// Just returns a list of sample patients for display in the custom consent patient picker.
// In a real implementation, this service would make an API call to an internal fine grained authorization service.
module.exports.mockPatientServiceHandler = async () => {
	return [
		{patient_id: 'Patient/57ca5687-e198-4b36-9a44-e9460debc611', patient_name: 'Sherlock Holmes (31) (reference)'},
		{patient_id: 'https://my.ehr.com/Patient/81f65d61-8f91-4472-b668-0efc0aceb0f2', patient_name: 'Mycroft Holmes (38) (full url)'},
		{patient_id: 'Patient/7f344d58-113d-45aa-88cf-c74d8e925d1d', patient_name: 'John Watson (34) (reference)'},
		{patient_id: 'https://fake.ehr.com/Patient/external', patient_name: '	Sir Arthur Conan Doyle (68) (external patient)'},
	]
}
'use strict';

// Mock patient access service.
// Just returns a list of sample patients for display in the custom consent patient picker.
// In a real implementation, this service would make an API call to an internal fine grained authorization service.
module.exports.mockPatientServiceHandler = async () => {
	return [
		//From Okta test set
		{patient_id: '3758', patient_name: 'Abraham Murphy (32)'},
		{patient_id: '35128', patient_name: 'Carlos Stehr (54)'},
		{patient_id: '5050', patient_name: 'Albert Walter (Deceased)'}

		//From hapi.fhir.org test set
		//{patient_id: '1440422', patient_name: 'Samuel Ortiz (31)'},
		//{patient_id: '92e12467-e074-4349-a6d4-e88be191b39b', patient_name: 'Amberly Bahringer (65)'},
		//{patient_id: 'c769110f-4d4e-4375-a706-c5d78f729544', patient_name: 'Jann Ferry (63)'}

		//From aws test set
		//{patient_id: 'Patient/57ca5687-e198-4b36-9a44-e9460debc611', patient_name: 'Sherlock Holmes (31) (reference)'},
		//{patient_id: 'https://yourFHIRserver.com/Patient/81f65d61-8f91-4472-b668-0efc0aceb0f2', patient_name: 'Mycroft Holmes (38) (full url)'},
		//{patient_id: 'Patient/7f344d58-113d-45aa-88cf-c74d8e925d1d', patient_name: 'John Watson (34) (reference)'},
		//{patient_id: 'https://fake.ehr.com/Patient/external', patient_name: '	Sir Arthur Conan Doyle (68) (external patient)'},
	]
}

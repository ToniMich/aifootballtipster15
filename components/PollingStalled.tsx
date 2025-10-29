import React from 'react';

// This component is no longer used. The main App component now handles
// stalled/timed-out states by setting an error and exiting the loading state,
// which is then displayed by the PredictionResult component. This simplifies
// the overall state management.
const PollingStalled: React.FC = () => null;

export default PollingStalled;

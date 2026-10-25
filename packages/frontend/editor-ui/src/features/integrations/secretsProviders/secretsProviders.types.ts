/** Result of testing a stored connection, as shown in the connection modal. */
export type ConnectionTestResult =
	| { state: 'idle' }
	| { state: 'success' }
	| { state: 'error'; message?: string };

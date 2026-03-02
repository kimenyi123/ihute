// Seller application rejection reasons
export const REJECTION_REASONS = [
    { value: 'incomplete_info', label: 'Incomplete business information' },
    { value: 'invalid_gps', label: 'Invalid or inaccurate GPS location' },
    { value: 'duplicate_account', label: 'Duplicate account detected' },
    { value: 'unsupported_category', label: 'Business category not supported' },
    { value: 'failed_verification', label: 'Failed business verification' },
    { value: 'suspicious_activity', label: 'Suspicious activity detected' },
    { value: 'missing_documents', label: 'Required documents not provided' },
    { value: 'outside_service_area', label: 'Business location outside service area' },
    { value: 'other', label: 'Other (specify below)' },
] as const

export type RejectionReasonValue = typeof REJECTION_REASONS[number]['value']

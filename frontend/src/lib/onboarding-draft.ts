// In-memory only — never persisted to localStorage/sessionStorage.
// Holds PII collected mid-onboarding that doesn't need to survive a refresh.
export const onboardingDraft: {
	facilityPhoneNumber?: string;
	doctorPhoneNumber?: string;
	doctorGender?: string;
} = {};

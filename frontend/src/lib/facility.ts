export const PHARMACY_FACILITY_TYPE = "pharmacy";

export function isPharmacyAccount(
	role: string | undefined,
	facilityType: string | undefined,
): boolean {
	return (
		role === "pharmacy_admin" ||
		(role === "clinic_admin" && facilityType === PHARMACY_FACILITY_TYPE)
	);
}

export function isFacilityAdmin(role: string | undefined): boolean {
	return role === "clinic_admin" || role === "pharmacy_admin";
}

export function isNonPharmacyFacilityAdmin(
	role: string | undefined,
	facilityType: string | undefined,
): boolean {
	return isFacilityAdmin(role) && !isPharmacyAccount(role, facilityType);
}

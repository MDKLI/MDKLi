import { createFileRoute, redirect } from "@tanstack/react-router";
import { FacilityAvailability } from "@/features/facility-availability";
import { useAuthStore } from "@/stores/auth-store";
import { isPharmacyAccount } from "@/lib/facility";

export const Route = createFileRoute("/_authenticated/facility-availability")({
	beforeLoad: () => {
		const { user } = useAuthStore.getState().auth;
		if (isPharmacyAccount(user?.role, user?.facilityType)) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: FacilityAvailability,
});

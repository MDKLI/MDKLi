import { createFileRoute, redirect } from "@tanstack/react-router";
import { FacilityInvitationsPage } from "@/features/settings/facility-invitations";
import { useAuthStore } from "@/stores/auth-store";
import { isPharmacyAccount } from "@/lib/facility";

export const Route = createFileRoute("/_authenticated/facility-invitations")({
	beforeLoad: () => {
		const { user } = useAuthStore.getState().auth;
		if (isPharmacyAccount(user?.role, user?.facilityType)) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: FacilityInvitationsPage,
});

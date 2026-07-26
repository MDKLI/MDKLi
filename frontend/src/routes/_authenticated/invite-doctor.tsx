import { createFileRoute, redirect } from "@tanstack/react-router";
import { InviteDoctorPage } from "@/features/settings/invite-doctor";
import { useAuthStore } from "@/stores/auth-store";
import { isPharmacyAccount } from "@/lib/facility";

export const Route = createFileRoute("/_authenticated/invite-doctor")({
	beforeLoad: () => {
		const { user } = useAuthStore.getState().auth;
		if (isPharmacyAccount(user?.role, user?.facilityType)) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: InviteDoctorPage,
});

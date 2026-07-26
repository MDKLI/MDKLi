import { createFileRoute, redirect } from "@tanstack/react-router";
import { BranchDoctorsPage } from "@/features/settings/branch-doctors";
import { useAuthStore } from "@/stores/auth-store";
import { isPharmacyAccount } from "@/lib/facility";

export const Route = createFileRoute("/_authenticated/branch-doctors")({
	beforeLoad: () => {
		const { user } = useAuthStore.getState().auth;
		if (isPharmacyAccount(user?.role, user?.facilityType)) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: BranchDoctorsPage,
});

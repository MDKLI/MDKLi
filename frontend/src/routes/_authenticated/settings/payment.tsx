import { createFileRoute, redirect } from "@tanstack/react-router";
import PaymentSettings from "@/features/settings/payment";
import { useAuthStore } from "@/stores/auth-store";
import { isPharmacyAccount } from "@/lib/facility";

export const Route = createFileRoute("/_authenticated/settings/payment")({
	beforeLoad: () => {
		const { user } = useAuthStore.getState().auth;
		if (isPharmacyAccount(user?.role, user?.facilityType)) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: PaymentSettings,
});

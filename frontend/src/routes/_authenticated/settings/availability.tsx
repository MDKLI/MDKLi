import { createFileRoute } from "@tanstack/react-router";
import { AvailabilitySettings } from "@/features/settings/availability";

export const Route = createFileRoute("/_authenticated/settings/availability")({
	component: AvailabilitySettings,
});

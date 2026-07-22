import { createFileRoute } from "@tanstack/react-router";
import { FacilityAvailability } from "@/features/facility-availability";

export const Route = createFileRoute("/_authenticated/facility-availability")({
	component: FacilityAvailability,
});

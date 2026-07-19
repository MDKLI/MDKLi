import { createFileRoute } from "@tanstack/react-router";
import { Tasks } from "@/features/booking";

export const Route = createFileRoute("/_authenticated/booking/")({
	component: Tasks,
});

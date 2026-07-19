import { createFileRoute } from "@tanstack/react-router";
import { SettingsBranches } from "@/features/settings/branches";

export const Route = createFileRoute("/_authenticated/settings/branches")({
	component: SettingsBranches,
});

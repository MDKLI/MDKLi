import { createFileRoute } from "@tanstack/react-router";
import { Main } from "@/components/layout/main";
import { Dashboard } from "@/features/admin/dashboard/dashboard";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
	component: AdminDashboard,
});

function AdminDashboard() {
	return (
		<Main className="flex flex-1 flex-col gap-4 sm:gap-6">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">Admin Dashboard</h2>
					<p className="text-muted-foreground">
						Overview of platform metrics and activities
					</p>
				</div>
			</div>
			<Dashboard />
		</Main>
	);
}

import { Main } from "@/components/layout/main";

export function AdminAppointments() {
	return (
		<Main className="flex flex-1 flex-col gap-4 sm:gap-6">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">
						Appointment Management
					</h2>
					<p className="text-muted-foreground">
						View and manage all appointments on the platform
					</p>
				</div>
			</div>
			<div className="rounded-lg border bg-card text-card-foreground shadow-sm">
				<div className="p-6">
					<p className="text-muted-foreground">
						Appointment management coming soon...
					</p>
				</div>
			</div>
		</Main>
	);
}

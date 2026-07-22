import { Main } from "@/components/layout/main";

export function AdminAnalytics() {
	return (
		<Main className="flex flex-1 flex-col gap-4 sm:gap-6">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
					<p className="text-muted-foreground">
						Business KPIs, user analytics, and performance metrics
					</p>
				</div>
			</div>
			<div className="rounded-lg border bg-card text-card-foreground shadow-sm">
				<div className="p-6">
					<p className="text-muted-foreground">
						Analytics dashboard coming soon...
					</p>
				</div>
			</div>
		</Main>
	);
}

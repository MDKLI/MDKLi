import { createFileRoute } from "@tanstack/react-router";
import { Main } from "@/components/layout/main";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
	component: AdminAnalytics,
});

function AdminAnalytics() {
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
			<Card>
				<CardHeader>
					<CardTitle>Analytics Dashboard</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground">Coming soon...</p>
				</CardContent>
			</Card>
		</Main>
	);
}

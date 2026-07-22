import { useEffect, useState } from "react";
import { Main } from "@/components/layout/main";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bookingApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

type Appointment = {
	id: string;
	status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "REJECTED";
	date: string;
	startTime: string;
	endTime: string;
	createdAt: string;
	doctor?: { name?: string };
	branch?: { name?: string; address?: string };
};

function daysRemaining(createdAt: string) {
	const created = new Date(createdAt).getTime();
	const now = Date.now();
	const elapsedDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
	const remaining = 3 - elapsedDays;
	return remaining < 0 ? 0 : remaining;
}

function formatDate(date: string) {
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

const statusConfig: Record<string, { label: string; className: string }> = {
	CONFIRMED: {
		label: "Confirmed",
		className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
	},
	CANCELLED: {
		label: "Cancelled",
		className: "bg-red-500/15 text-red-400 border-red-500/30",
	},
	REJECTED: {
		label: "Rejected",
		className: "bg-red-500/15 text-red-400 border-red-500/30",
	},
	COMPLETED: {
		label: "Completed",
		className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
	},
};

function StatusBadge({ status }: { status: Appointment["status"] }) {
	const config = statusConfig[status] ?? { label: status, className: "" };
	return (
		<Badge variant="outline" className={config.className}>
			{config.label}
		</Badge>
	);
}

function AppointmentCard({
	appt,
	showCountdown,
}: {
	appt: Appointment;
	showCountdown?: boolean;
}) {
	return (
		<Card className="flex flex-col gap-2 p-4">
			<div className="flex items-center justify-between">
				<div className="font-semibold">{appt.doctor?.name || "Doctor"}</div>
				{showCountdown && (
					<Badge variant="outline">
						{daysRemaining(appt.createdAt)} day
						{daysRemaining(appt.createdAt) === 1 ? "" : "s"} left
					</Badge>
				)}
			</div>
			<div className="text-muted-foreground text-sm">
				{appt.branch?.name}{" "}
				{appt.branch?.address ? `· ${appt.branch.address}` : ""}
			</div>
			<div className="text-sm">
				{formatDate(appt.date)} · {appt.startTime} - {appt.endTime}
			</div>
		</Card>
	);
}

function HistoryCard({ appt }: { appt: Appointment }) {
	return (
		<Card className="flex flex-col gap-2 p-4">
			<div className="flex items-center justify-between">
				<div className="font-semibold">{appt.doctor?.name || "Doctor"}</div>
				<StatusBadge status={appt.status} />
			</div>
			<div className="text-muted-foreground text-sm">
				{appt.branch?.name}{" "}
				{appt.branch?.address ? `· ${appt.branch.address}` : ""}
			</div>
			<div className="text-sm">
				{formatDate(appt.date)} · {appt.startTime}
			</div>
		</Card>
	);
}

export function Tasks() {
	const user = useAuthStore((state) => state.auth.user);
	const [appointments, setAppointments] = useState<Appointment[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user?.id) {
			setLoading(false);
			return;
		}
		bookingApi.getMyAppointments(user.id).then((res) => {
			if (res.data?.data) setAppointments(res.data.data as Appointment[]);
			setLoading(false);
		});
	}, [user?.id]);

	const upcoming = appointments.filter((a) => a.status === "CONFIRMED");
	const pending = appointments.filter((a) => a.status === "PENDING");
	const history = appointments.filter((a) =>
		["CANCELLED", "COMPLETED", "REJECTED"].includes(a.status),
	);

	return (
		<Main className="flex flex-1 flex-col gap-4 sm:gap-6">
			<div>
				<h2 className="text-2xl font-bold tracking-tight">Bookings</h2>
				<p className="text-muted-foreground">
					Manage your upcoming, pending, and past appointments.
				</p>
			</div>

			<Tabs defaultValue="upcoming" className="w-full">
				<TabsList>
					<TabsTrigger value="upcoming">
						Upcoming ({upcoming.length})
					</TabsTrigger>
					<TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
					<TabsTrigger value="history">History ({history.length})</TabsTrigger>
				</TabsList>

				<TabsContent value="upcoming" className="flex flex-col gap-3 pt-4">
					{loading && (
						<p className="text-muted-foreground text-sm">Loading...</p>
					)}
					{!loading && upcoming.length === 0 && (
						<p className="text-muted-foreground text-sm">
							No upcoming sessions.
						</p>
					)}
					{upcoming.map((a) => (
						<AppointmentCard key={a.id} appt={a} />
					))}
				</TabsContent>

				<TabsContent value="pending" className="flex flex-col gap-3 pt-4">
					{loading && (
						<p className="text-muted-foreground text-sm">Loading...</p>
					)}
					{!loading && pending.length === 0 && (
						<p className="text-muted-foreground text-sm">
							No pending sessions.
						</p>
					)}
					{pending.map((a) => (
						<AppointmentCard key={a.id} appt={a} showCountdown />
					))}
				</TabsContent>

				<TabsContent value="history" className="flex flex-col gap-3 pt-4">
					{loading && (
						<p className="text-muted-foreground text-sm">Loading...</p>
					)}
					{!loading && history.length === 0 && (
						<p className="text-muted-foreground text-sm">No history yet.</p>
					)}
					{history.map((a) => (
						<HistoryCard key={a.id} appt={a} />
					))}
				</TabsContent>
			</Tabs>
		</Main>
	);
}

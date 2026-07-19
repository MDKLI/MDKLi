import {
	ChevronLeft,
	ChevronRight,
	Loader2,
	MapPin,
	Plus,
	Users,
	X,
} from "lucide-react";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { bookingApi, invitationApi, profileApi } from "@/lib/api";

interface Branch {
	id: string;
	name: string;
	city: string;
	area: string;
}

interface BranchDoctor {
	id: string;
	fullName: string;
	specialty?: string;
}

interface TimeSlot {
	id: string;
	startTime: string;
	endTime: string;
}

interface DaySchedule {
	enabled: boolean;
	slots: TimeSlot[];
}

interface WeeklySchedule {
	[key: number]: DaySchedule;
}

interface BlockOutDate {
	id: string;
	date: string;
	reason?: string;
}

interface RawOverride {
	id: string;
	type: string;
	date: string;
	reason?: string;
}

const DAYS_OF_WEEK = [
	{ value: 0, label: "Sunday", short: "SUN" },
	{ value: 1, label: "Monday", short: "MON" },
	{ value: 2, label: "Tuesday", short: "TUE" },
	{ value: 3, label: "Wednesday", short: "WED" },
	{ value: 4, label: "Thursday", short: "THU" },
	{ value: 5, label: "Friday", short: "FRI" },
	{ value: 6, label: "Saturday", short: "SAT" },
];

const generateTimeOptions = () => {
	const times = [];
	for (let hour = 0; hour < 24; hour++) {
		for (let minute = 0; minute < 60; minute += 30) {
			const hourStr = hour.toString().padStart(2, "0");
			const minStr = minute.toString().padStart(2, "0");
			const timeValue = `${hourStr}:${minStr}`;
			const ampm = hour < 12 ? "AM" : "PM";
			const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
			times.push({
				value: timeValue,
				label: `${displayHour}:${minStr} ${ampm}`,
			});
		}
	}
	return times;
};
const TIME_OPTIONS = generateTimeOptions();

const createDefaultWeeklySchedule = (): WeeklySchedule => {
	const schedule: WeeklySchedule = {};
	DAYS_OF_WEEK.forEach((day) => {
		schedule[day.value] = { enabled: false, slots: [] };
	});
	return schedule;
};

export function FacilityAvailability() {
	const [branches, setBranches] = useState<Branch[]>([]);
	const [selectedBranch, setSelectedBranch] = useState<string>("");

	const [doctors, setDoctors] = useState<BranchDoctor[]>([]);
	const [selectedDoctor, setSelectedDoctor] = useState<string>("");
	const [doctorsLoading, setDoctorsLoading] = useState(false);

	const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(
		createDefaultWeeklySchedule,
	);
	const [blockOutDates, setBlockOutDates] = useState<BlockOutDate[]>([]);
	const [selectedBlockOutDates, setSelectedBlockOutDates] = useState<Date[]>(
		[],
	);
	const [blockOutCalendarMonth, setBlockOutCalendarMonth] = useState(moment());
	const [isBlockOutDialogOpen, setIsBlockOutDialogOpen] = useState(false);
	const [loading, setLoading] = useState(false);

	const loadFacilityBranches = useCallback(async () => {
		try {
			const profileResult: { data?: { id?: string } } =
				await profileApi.getProfile();
			const facilityId = profileResult?.data?.id;
			if (!facilityId) {
				setBranches([]);
				return;
			}

			const result: { data?: { data?: Branch[] } } =
				await invitationApi.getFacilityBranches(facilityId);
			const list = result?.data?.data || [];
			setBranches(
				list.map((b) => ({
					id: b.id,
					name: b.name,
					city: b.city,
					area: b.area,
				})),
			);
		} catch {
			toast.error("Failed to load branches");
			setBranches([]);
		}
	}, []);

	const loadBranchDoctors = useCallback(async (branchId: string) => {
		setDoctorsLoading(true);
		try {
			const result: { data?: { data?: BranchDoctor[] } } =
				await invitationApi.getBranchDoctors(branchId);
			const list = result?.data?.data || [];
			setDoctors(
				list.map((d) => ({
					id: d.id,
					fullName: d.fullName,
					specialty: d.specialty,
				})),
			);
		} catch {
			toast.error("Failed to load doctors for this branch");
			setDoctors([]);
		} finally {
			setDoctorsLoading(false);
		}
	}, []);

	const loadSchedule = useCallback(
		async (branchId: string, doctorId: string) => {
			try {
				const result = await bookingApi.getDoctorBranchAvailability(
					branchId,
					doctorId,
				);
				if (result.error || !result.data?.success) {
					setWeeklySchedule(createDefaultWeeklySchedule());
					return;
				}

				const schedule: WeeklySchedule = {};
				DAYS_OF_WEEK.forEach((day) => {
					schedule[day.value] = { enabled: false, slots: [] };
				});

				for (const rule of result.data.data) {
					const day = Number(rule.dayOfWeek);
					if (Number.isNaN(day) || !schedule[day]) continue;
					schedule[day].enabled = true;
					schedule[day].slots.push({
						id: rule.id || `${day}-${rule.startTime}-${rule.endTime}`,
						startTime: rule.startTime,
						endTime: rule.endTime,
					});
				}
				setWeeklySchedule(schedule);
			} catch {
				setWeeklySchedule(createDefaultWeeklySchedule());
			}
		},
		[],
	);

	const loadBlockOutDates = useCallback(
		async (branchId: string, doctorId: string) => {
			try {
				const result = await bookingApi.getDoctorBranchOverrides(
					branchId,
					doctorId,
				);
				if (result.error || !result.data?.success) {
					setBlockOutDates([]);
					return;
				}

				const mapped = (result.data.data || [])
					.filter((o: RawOverride) => o.type === "BLOCK")
					.map((o: RawOverride) => ({
						id: o.id,
						date: moment(o.date).format("YYYY-MM-DD"),
						reason: o.reason || undefined,
					}));
				setBlockOutDates(mapped);
			} catch {
				setBlockOutDates([]);
			}
		},
		[],
	);

	useEffect(() => {
		loadFacilityBranches();
	}, [loadFacilityBranches]);

	useEffect(() => {
		setSelectedDoctor("");
		setDoctors([]);
		if (!selectedBranch) return;
		loadBranchDoctors(selectedBranch);
	}, [selectedBranch, loadBranchDoctors]);

	useEffect(() => {
		if (!selectedBranch || !selectedDoctor) {
			setWeeklySchedule(createDefaultWeeklySchedule());
			setBlockOutDates([]);
			return;
		}
		void loadSchedule(selectedBranch, selectedDoctor);
		void loadBlockOutDates(selectedBranch, selectedDoctor);
	}, [selectedBranch, selectedDoctor, loadSchedule, loadBlockOutDates]);
	const toggleDay = (dayValue: number) => {
		setWeeklySchedule((prev) => ({
			...prev,
			[dayValue]: { ...prev[dayValue], enabled: !prev[dayValue].enabled },
		}));
	};

	const addTimeSlot = (dayValue: number) => {
		setWeeklySchedule((prev) => ({
			...prev,
			[dayValue]: {
				...prev[dayValue],
				slots: [
					...prev[dayValue].slots,
					{
						id: `${dayValue}-${Date.now()}`,
						startTime: "09:00",
						endTime: "17:00",
					},
				],
			},
		}));
	};

	const removeTimeSlot = (dayValue: number, slotId: string) => {
		setWeeklySchedule((prev) => ({
			...prev,
			[dayValue]: {
				...prev[dayValue],
				slots: prev[dayValue].slots.filter((s) => s.id !== slotId),
			},
		}));
	};

	const updateTimeSlot = (
		dayValue: number,
		slotId: string,
		field: "startTime" | "endTime",
		value: string,
	) => {
		setWeeklySchedule((prev) => ({
			...prev,
			[dayValue]: {
				...prev[dayValue],
				slots: prev[dayValue].slots.map((s) =>
					s.id === slotId ? { ...s, [field]: value } : s,
				),
			},
		}));
	};

	const saveSchedule = async () => {
		if (!selectedBranch || !selectedDoctor) {
			toast.error("Please select a branch and a doctor first");
			return;
		}

		try {
			setLoading(true);
			const rules: Array<{
				dayOfWeek: number;
				startTime: string;
				endTime: string;
				slotDurationMinutes: number;
			}> = [];
			for (const day of DAYS_OF_WEEK) {
				const daySchedule = weeklySchedule[day.value];
				if (!daySchedule.enabled || daySchedule.slots.length === 0) continue;
				for (const slot of daySchedule.slots) {
					if (slot.startTime >= slot.endTime) {
						toast.error(`Invalid time range on ${day.label}`);
						return;
					}
					rules.push({
						dayOfWeek: day.value,
						startTime: slot.startTime,
						endTime: slot.endTime,
						slotDurationMinutes: 30,
					});
				}
			}

			const result = await bookingApi.replaceDoctorBranchAvailability(
				selectedBranch,
				{ doctorId: selectedDoctor, rules },
			);
			if (result.error || !result.data?.success) {
				toast.error(result.error || "Failed to save schedule");
				return;
			}
			toast.success("Schedule saved successfully");
		} catch {
			toast.error("Failed to save schedule");
		} finally {
			setLoading(false);
		}
	};

	const toggleBlockOutDate = (date: Date) => {
		const dateStr = moment(date).format("YYYY-MM-DD");
		const isSelected = selectedBlockOutDates.some(
			(d) => moment(d).format("YYYY-MM-DD") === dateStr,
		);
		if (isSelected) {
			setSelectedBlockOutDates((prev) =>
				prev.filter((d) => moment(d).format("YYYY-MM-DD") !== dateStr),
			);
		} else {
			setSelectedBlockOutDates((prev) => [...prev, date]);
		}
	};

	const addBlockOutDates = async () => {
		if (
			!selectedBranch ||
			!selectedDoctor ||
			selectedBlockOutDates.length === 0
		)
			return;
		try {
			const existingDates = new Set(blockOutDates.map((d) => d.date));
			const uniqueDates = selectedBlockOutDates
				.map((date) => moment(date).format("YYYY-MM-DD"))
				.filter((date) => !existingDates.has(date));

			for (const date of uniqueDates) {
				await bookingApi.createDoctorBranchOverride(selectedBranch, {
					date,
					type: "BLOCK",
					doctorId: selectedDoctor,
				});
			}

			await loadBlockOutDates(selectedBranch, selectedDoctor);
			setSelectedBlockOutDates([]);
			setIsBlockOutDialogOpen(false);
			toast.success("Block out dates added");
		} catch {
			toast.error("Failed to add block out dates");
		}
	};

	const removeBlockOutDate = async (overrideId: string) => {
		if (!selectedBranch) return;
		try {
			const result = await bookingApi.deleteDoctorBranchOverride(
				selectedBranch,
				overrideId,
			);
			if (result.error) {
				toast.error(result.error);
				return;
			}
			setBlockOutDates((prev) => prev.filter((d) => d.id !== overrideId));
			toast.success("Block out date removed");
		} catch {
			toast.error("Failed to remove block out date");
		}
	};

	const generateCalendarDays = () => {
		const startOfMonth = blockOutCalendarMonth.clone().startOf("month");
		const endOfMonth = blockOutCalendarMonth.clone().endOf("month");
		const startOfCalendar = startOfMonth.clone().startOf("week");
		const endOfCalendar = endOfMonth.clone().endOf("week");
		const days = [];
		const day = startOfCalendar.clone();
		while (day.isSameOrBefore(endOfCalendar)) {
			days.push(day.clone());
			day.add(1, "day");
		}
		return days;
	};
	const calendarDays = generateCalendarDays();
	const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-bold tracking-tight">
					Facility Availability
				</h2>
				<p className="text-muted-foreground">
					Set appointment availability for each doctor at each of your branches.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MapPin className="h-5 w-5" />
						Select Branch
					</CardTitle>
				</CardHeader>
				<CardContent>
					{branches.length === 0 ? (
						<p className="text-muted-foreground text-center py-6">
							No branches found.
						</p>
					) : (
						<Select value={selectedBranch} onValueChange={setSelectedBranch}>
							<SelectTrigger className="w-full md:w-[400px]">
								<SelectValue placeholder="Select a branch" />
							</SelectTrigger>
							<SelectContent>
								{branches.map((branch) => (
									<SelectItem key={branch.id} value={branch.id}>
										<div className="flex flex-col">
											<span>{branch.name}</span>
											<span className="text-xs text-muted-foreground">
												{branch.city}, {branch.area}
											</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</CardContent>
			</Card>

			{selectedBranch && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Select Doctor
						</CardTitle>
					</CardHeader>
					<CardContent>
						{doctorsLoading ? (
							<div className="flex items-center gap-2 text-muted-foreground py-4">
								<Loader2 className="h-4 w-4 animate-spin" /> Loading doctors...
							</div>
						) : doctors.length === 0 ? (
							<p className="text-muted-foreground text-center py-6">
								No doctors assigned to this branch yet. Invite doctors from the
								Invitations page.
							</p>
						) : (
							<Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
								<SelectTrigger className="w-full md:w-[400px]">
									<SelectValue placeholder="Select a doctor" />
								</SelectTrigger>
								<SelectContent>
									{doctors.map((doctor) => (
										<SelectItem key={doctor.id} value={doctor.id}>
											<div className="flex flex-col">
												<span>Dr. {doctor.fullName}</span>
												{doctor.specialty && (
													<span className="text-xs text-muted-foreground">
														{doctor.specialty}
													</span>
												)}
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</CardContent>
				</Card>
			)}

			{selectedBranch && selectedDoctor && (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="space-y-4">
						<div>
							<h3 className="text-lg font-semibold">Availability hours</h3>
							<p className="text-sm text-muted-foreground mt-1">
								Set this doctor's schedule at this branch.
							</p>
						</div>

						<Card>
							<CardContent className="p-6 space-y-0">
								{DAYS_OF_WEEK.map((day) => {
									const daySchedule = weeklySchedule[day.value];
									return (
										<div
											key={day.value}
											className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0"
										>
											<div className="flex items-center gap-3 w-28 pt-1">
												<Switch
													checked={daySchedule.enabled}
													onCheckedChange={() => toggleDay(day.value)}
												/>
												<span className="text-sm font-semibold whitespace-nowrap">
													{day.short}DAYS
												</span>
											</div>

											<div className="flex-1 space-y-2">
												{daySchedule.enabled &&
													daySchedule.slots.map((slot, slotIndex) => (
														<div
															key={slot.id}
															className="flex items-center gap-2"
														>
															<Select
																value={slot.startTime}
																onValueChange={(v) =>
																	updateTimeSlot(
																		day.value,
																		slot.id,
																		"startTime",
																		v,
																	)
																}
															>
																<SelectTrigger className="w-[100px] h-8 text-xs">
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	{TIME_OPTIONS.map((time) => (
																		<SelectItem
																			key={time.value}
																			value={time.value}
																		>
																			{time.label}
																		</SelectItem>
																	))}
																</SelectContent>
															</Select>
															<span className="text-sm text-muted-foreground">
																to
															</span>
															<Select
																value={slot.endTime}
																onValueChange={(v) =>
																	updateTimeSlot(
																		day.value,
																		slot.id,
																		"endTime",
																		v,
																	)
																}
															>
																<SelectTrigger className="w-[100px] h-8 text-xs">
																	<SelectValue />
																</SelectTrigger>
																<SelectContent>
																	{TIME_OPTIONS.map((time) => (
																		<SelectItem
																			key={time.value}
																			value={time.value}
																		>
																			{time.label}
																		</SelectItem>
																	))}
																</SelectContent>
															</Select>
															{(daySchedule.slots.length > 1 ||
																slotIndex > 0) && (
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-7 w-7 text-muted-foreground hover:text-destructive"
																	onClick={() =>
																		removeTimeSlot(day.value, slot.id)
																	}
																>
																	<X className="h-3 w-3" />
																</Button>
															)}
															{daySchedule.slots.length === 1 &&
																slotIndex === 0 && <div className="h-7 w-7" />}
														</div>
													))}
											</div>

											<div className="w-10 flex justify-end pt-1">
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7"
													disabled={!daySchedule.enabled}
													onClick={() => addTimeSlot(day.value)}
												>
													<Plus className="h-4 w-4" />
												</Button>
											</div>
										</div>
									);
								})}
							</CardContent>
						</Card>
					</div>

					<div className="space-y-4">
						<div>
							<h3 className="text-lg font-semibold">Block out dates</h3>
							<p className="text-sm text-muted-foreground mt-1">
								Days this doctor is unavailable at this branch.
							</p>
						</div>

						<Card>
							<CardContent className="p-6 space-y-4">
								<Dialog
									open={isBlockOutDialogOpen}
									onOpenChange={setIsBlockOutDialogOpen}
								>
									<DialogTrigger asChild>
										<Button
											variant="outline"
											className="w-full justify-start gap-2"
										>
											<span>Add blockout dates</span>
											<Plus className="h-4 w-4" />
										</Button>
									</DialogTrigger>
									<DialogContent className="sm:max-w-[400px]">
										<DialogHeader>
											<DialogTitle>Select blockout date(s)</DialogTitle>
										</DialogHeader>
										<div className="space-y-4">
											<div className="flex items-center justify-between">
												<span className="font-medium">
													{blockOutCalendarMonth.format("MMMM YYYY")}
												</span>
												<div className="flex gap-1">
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={() =>
															setBlockOutCalendarMonth((prev) =>
																prev.clone().subtract(1, "month"),
															)
														}
													>
														<ChevronLeft className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={() =>
															setBlockOutCalendarMonth((prev) =>
																prev.clone().add(1, "month"),
															)
														}
													>
														<ChevronRight className="h-4 w-4" />
													</Button>
												</div>
											</div>

											<div className="grid grid-cols-7 gap-1 text-center">
												{weekDays.map((day) => (
													<div
														key={day}
														className="text-xs text-muted-foreground py-1"
													>
														{day}
													</div>
												))}
											</div>

											<div className="grid grid-cols-7 gap-1">
												{calendarDays.map((day, _idx) => {
													const dateStr = day.format("YYYY-MM-DD");
													const isSelected = selectedBlockOutDates.some(
														(d) => moment(d).format("YYYY-MM-DD") === dateStr,
													);
													const isCurrentMonth =
														day.month() === blockOutCalendarMonth.month();
													const isToday = day.isSame(moment(), "day");
													const isPast = day.isBefore(moment().startOf("day"));
													return (
														<button
															key={dateStr}
															type="button"
															disabled={isPast}
															className={`h-9 w-9 rounded-full text-sm flex items-center justify-center transition-colors
                                ${!isCurrentMonth ? "text-muted-foreground/50" : ""}
                                ${isSelected ? "bg-primary text-primary-foreground" : ""}
                                ${isToday && !isSelected ? "bg-muted font-semibold" : ""}
                                ${isPast ? "opacity-40 cursor-not-allowed" : ""}
                                ${!isSelected && isCurrentMonth && !isPast ? "hover:bg-muted" : ""}`}
															onClick={() => toggleBlockOutDate(day.toDate())}
														>
															{day.date()}
														</button>
													);
												})}
											</div>

											<Button
												className="w-full"
												onClick={addBlockOutDates}
												disabled={selectedBlockOutDates.length === 0}
											>
												Add date(s)
											</Button>
										</div>
									</DialogContent>
								</Dialog>

								{blockOutDates.length > 0 && (
									<div className="space-y-2">
										{blockOutDates
											.sort((a, b) => moment(a.date).diff(moment(b.date)))
											.map((blockOut) => (
												<div
													key={blockOut.id}
													className="flex items-center justify-between py-2 px-3 bg-muted rounded-md"
												>
													<span className="text-sm">
														{moment(blockOut.date).format("ddd, MMM D, YYYY")}
													</span>
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground hover:text-destructive"
														onClick={() => removeBlockOutDate(blockOut.id)}
													>
														<X className="h-3 w-3" />
													</Button>
												</div>
											))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			)}

			{selectedBranch && selectedDoctor && (
				<div className="flex justify-end">
					<Button onClick={saveSchedule} disabled={loading}>
						{loading ? "Saving..." : "Save Schedule"}
					</Button>
				</div>
			)}
		</div>
	);
}

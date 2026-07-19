import { useNavigate } from "@tanstack/react-router";
import { Calendar, FileText, Mail, MapPin, User } from "lucide-react";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bookingApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

interface Branch {
	id: string;
	name: string;
	address?: string;
	city?: string;
	area?: string;
	branch_type?: string;
	facility_photo_url?: string;
	facility_name?: string;
	phone_numbers?: string[];
	phoneNumbers?: string[];
	consultation_fee?: number;
	consultationFee?: number;
	media_urls?: string[];
	mediaUrls?: string[];
}

interface TimeSlot {
	start_time: string;
	end_time: string;
	is_available: boolean;
}

interface DayAvailability {
	date: string;
	dayName: string;
	dayNumber: number;
	month: string;
	slots: TimeSlot[];
}

interface DoctorBookingProps {
	doctorId: string;
	branches: Branch[];
}

const formatTime12Hour = (time: string) => {
	if (!time) return "";
	return moment(time, "HH:mm").format("hh:mm A");
};

export function DoctorBooking({ doctorId, branches }: DoctorBookingProps) {
	const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
	const [availability, setAvailability] = useState<DayAvailability[]>([]);
	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
	const [loading, setLoading] = useState(false);
	const [bookingLoading, setBookingLoading] = useState(false);
	const [showBookingDialog, setShowBookingDialog] = useState(false);

	// Booking form state
	const [patientName, setPatientName] = useState("");
	const [patientPhone, setPatientPhone] = useState("");
	const [patientEmail, setPatientEmail] = useState("");
	const [reason, setReason] = useState("");
	const [notes, setNotes] = useState("");

	const navigate = useNavigate();
	const user = useAuthStore((state) => state.auth.user);
	const isAdmin = user?.role === "admin" || user?.role === "superadmin";

	// Auto-fill patient info from logged in user
	useEffect(() => {
		if (user) {
			setPatientName(user.fullName || user.username || "");
			setPatientEmail(user.email || "");
		}
	}, [user]);

	const fetchAvailability = useCallback(async () => {
		if (!selectedBranch || !doctorId) return;
		setLoading(true);
		try {
			const response = await bookingApi.getDoctorAvailabilityForBooking(
				doctorId,
				selectedBranch.id,
			);
			if (response.data?.success) {
				setAvailability(response.data.data as DayAvailability[]);
			} else {
				setAvailability([]);
			}
		} catch (error) {
			console.error("Failed to fetch availability:", error);
			toast.error("Failed to load availability");
		} finally {
			setLoading(false);
		}
	}, [selectedBranch, doctorId]);

	// Fetch availability when branch is selected
	useEffect(() => {
		if (selectedBranch) {
			fetchAvailability();
		}
	}, [selectedBranch, fetchAvailability]);

	const selectedDayAvailability = availability.find(
		(day) => day.date === selectedDate,
	);

	const handleSlotSelect = (slot: TimeSlot) => {
		if (!slot.is_available) {
			toast.error("This slot is not available");
			return;
		}
		setSelectedSlot(slot);
		setShowBookingDialog(true);
	};

	const handleBookSession = async () => {
		if (isAdmin) {
			toast.error("Admin accounts cannot book appointments");
			return;
		}

		if (!selectedBranch || !selectedDate || !selectedSlot) return;

		if (!patientName.trim()) {
			toast.error("Please enter your name");
			return;
		}

		setBookingLoading(true);
		try {
			const result = await bookingApi.createBooking({
				doctor_id: doctorId,
				branch_id: selectedBranch.id,
				patient_id: user?.id || "",
				patient_email: patientEmail || user?.email,
				patient_name: patientName,
				patient_phone: patientPhone || undefined,
				booking_date: selectedDate,
				start_time: selectedSlot.start_time,
				end_time: selectedSlot.end_time,
				reason: reason || undefined,
				notes:
					[
						reason ? `Reason: ${reason}` : "",
						notes ? `Notes: ${notes}` : "",
						patientPhone ? `Phone: ${patientPhone}` : "",
						patientEmail ? `Email: ${patientEmail}` : "",
					]
						.filter(Boolean)
						.join(" | ") || undefined,
			});

			if (result.error || !result.data?.success) {
				toast.error(result.error || "Failed to book session");
				return;
			}

			const appointmentId = result.data.data?.appointmentId;
			if (!appointmentId) {
				toast.error("Something went wrong. Please try again.");
				return;
			}

			const fee =
				selectedBranch.consultation_fee || selectedBranch.consultationFee || 0;

			navigate({
				to: "/booking/pay",
				search: {
					appointmentId,
					amount: fee,
					branchName: selectedBranch.name,
					date: selectedDate || "",
					startTime: selectedSlot?.start_time || "",
					endTime: selectedSlot?.end_time || "",
				},
			});
		} catch (error) {
			console.error("Failed to book session:", error);
			toast.error("Failed to book session");
		} finally {
			setBookingLoading(false);
		}
	};

	if (isAdmin) {
		return (
			<Card className="mt-6">
				<CardContent className="p-6 text-center">
					<p className="text-muted-foreground">
						Admin accounts cannot book appointments
					</p>
				</CardContent>
			</Card>
		);
	}

	if (branches.length === 0) {
		return (
			<Card>
				<CardContent className="p-6 text-center">
					<p className="text-muted-foreground">
						No branches available for booking
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<>
			<Card className="mt-6">
				<CardHeader>
					<CardTitle>Book Appointment</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Branch Selection */}
					{!selectedBranch ? (
						<div className="space-y-4">
							<h3 className="font-semibold">Select a Branch</h3>
							{branches.length === 0 ? (
								<div className="text-center py-6 text-muted-foreground bg-muted rounded-lg">
									<MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
									<p>No branches available</p>
								</div>
							) : (
								<div className="grid gap-3">
									{branches.map((branch) => (
										<Button
											key={branch.id}
											variant="outline"
											className="justify-start h-auto py-4 px-4"
											onClick={() => {
												console.log("Branch selected:", branch);
												setSelectedBranch(branch);
											}}
										>
											<div className="flex items-start gap-3 text-left">
												{/* Branch Photo */}
												{(() => {
													const media = branch.mediaUrls || branch.media_urls;
													if (media && media.length > 0) {
														return (
															<div className="h-10 w-10 rounded-lg flex-shrink-0 overflow-hidden bg-muted">
																<img
																	src={media[0]}
																	alt={branch.name}
																	className="h-full w-full object-cover"
																	onError={(e) => {
																		console.log(
																			"Image failed to load:",
																			media[0],
																		);
																		e.currentTarget.style.display = "none";
																	}}
																/>
															</div>
														);
													}
													return (
														<div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
															<MapPin className="h-5 w-5 text-muted-foreground" />
														</div>
													);
												})()}
												<div className="flex-1">
													<p className="font-medium">{branch.name}</p>
													<p className="text-sm text-muted-foreground">
														{[branch.area, branch.city]
															.filter(Boolean)
															.join(", ") || "No location info"}
													</p>
													{branch.address && (
														<p className="text-xs text-muted-foreground mt-1">
															{branch.address}
														</p>
													)}
													{/* Phone */}
													{(() => {
														const phones =
															branch.phone_numbers || branch.phoneNumbers;
														if (phones && phones.length > 0) {
															return (
																<p className="text-xs text-muted-foreground mt-1">
																	{phones.join(", ")}
																</p>
															);
														}
														return null;
													})()}
													{/* Fee */}
													{(() => {
														const fee =
															branch.consultation_fee || branch.consultationFee;
														if (fee) {
															return (
																<p className="text-xs text-muted-foreground mt-1">
																	Fee: {fee} EGP
																</p>
															);
														}
														return null;
													})()}
												</div>
											</div>
										</Button>
									))}
								</div>
							)}
						</div>
					) : (
						<div className="space-y-6">
							{/* Selected Branch Header */}
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
										<MapPin className="h-5 w-5 text-muted-foreground" />
									</div>
									<div>
										<p className="font-semibold">{selectedBranch.name}</p>
										<p className="text-sm text-muted-foreground">
											{[selectedBranch.area, selectedBranch.city]
												.filter(Boolean)
												.join(", ")}
										</p>
									</div>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										console.log("Changing branch...");
										setSelectedBranch(null);
										setSelectedDate(null);
										setAvailability([]);
									}}
								>
									Change Branch
								</Button>
							</div>

							{/* Available Sessions Header */}
							<div>
								<h3 className="text-lg font-semibold mb-1">
									Available sessions
								</h3>
								<p className="text-sm text-muted-foreground">
									Book 1:1 sessions from the options based on your needs
								</p>
							</div>

							{/* Loading State */}
							{loading ? (
								<div className="text-center py-8">
									<div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
									<p className="text-muted-foreground">
										Loading availability...
									</p>
								</div>
							) : (
								<>
									{/* Days of Week */}
									<div className="flex gap-2 overflow-x-auto pb-2">
										{availability.map((day) => {
											const availableSlots = day.slots.filter(
												(s) => s.is_available,
											).length;
											const isSelected = selectedDate === day.date;
											const isToday =
												moment().format("YYYY-MM-DD") === day.date;

											return (
												<Button
													key={day.date}
													variant={isSelected ? "default" : "outline"}
													disabled={availableSlots === 0}
													className={`flex-col h-auto py-3 px-4 min-w-[80px] cursor-pointer ${isSelected ? "ring-2 ring-primary" : ""} ${isToday ? "border-primary" : ""}`}
													onClick={() => {
														console.log("Day selected:", day.date);
														setSelectedDate(day.date);
													}}
												>
													<span className="text-xs uppercase">
														{day.dayName}
													</span>
													<span className="text-lg font-semibold">
														{day.dayNumber} {day.month}
													</span>
													{availableSlots > 0 ? (
														<Badge variant="secondary" className="mt-1 text-xs">
															{availableSlots} slots
														</Badge>
													) : (
														<Badge variant="outline" className="mt-1 text-xs">
															Full
														</Badge>
													)}
												</Button>
											);
										})}
									</div>

									{/* Time Slots */}
									{selectedDate && selectedDayAvailability ? (
										<div className="space-y-4">
											<div className="flex items-center justify-between">
												<h4 className="font-medium">
													Available time slots for{" "}
													{moment(selectedDate).format("D MMM YYYY")}
												</h4>
											</div>

											{selectedDayAvailability.slots.filter(
												(s) => s.is_available,
											).length === 0 ? (
												<div className="text-center py-6 text-muted-foreground bg-muted rounded-lg">
													<Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
													<p>No available slots for this date</p>
												</div>
											) : (
												<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
													{selectedDayAvailability.slots
														.filter((s) => s.is_available)
														.map((slot) => (
															<Button
																key={slot.start_time}
																variant="outline"
																className="h-12 text-sm font-medium"
																onClick={() => handleSlotSelect(slot)}
															>
																{formatTime12Hour(slot.start_time)}
															</Button>
														))}
												</div>
											)}
										</div>
									) : (
										<div className="text-center py-8 text-muted-foreground">
											<Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
											<p>Select a date to see available time slots</p>
										</div>
									)}
								</>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Booking Dialog */}
			<Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Book Session</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 py-4">
						{/* Session Details */}
						<div className="bg-muted p-4 rounded-lg space-y-2">
							<p className="font-medium">{selectedBranch?.name}</p>
							<p className="text-sm text-muted-foreground">
								{moment(selectedDate).format("dddd, D MMMM YYYY")}
							</p>
							<p className="text-sm font-medium">
								Time: {formatTime12Hour(selectedSlot?.start_time || "")} -{" "}
								{formatTime12Hour(selectedSlot?.end_time || "")}
							</p>
						</div>

						{/* Patient Info Form */}
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="patientName">
									<User className="h-4 w-4 inline mr-2" />
									Full Name *
								</Label>
								<Input
									id="patientName"
									value={patientName}
									onChange={(e) => setPatientName(e.target.value)}
									placeholder="Enter your full name"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="patientEmail">
									<Mail className="h-4 w-4 inline mr-2" />
									Email
								</Label>
								<Input
									id="patientEmail"
									type="email"
									value={patientEmail}
									onChange={(e) => setPatientEmail(e.target.value)}
									placeholder="Enter your email"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="patientPhone">Phone Number</Label>
								<Input
									id="patientPhone"
									value={patientPhone}
									onChange={(e) => setPatientPhone(e.target.value)}
									placeholder="Enter your phone number"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="reason">
									<FileText className="h-4 w-4 inline mr-2" />
									Reason for Visit
								</Label>
								<Input
									id="reason"
									value={reason}
									onChange={(e) => setReason(e.target.value)}
									placeholder="Briefly describe your reason for visit"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="notes">Additional Notes</Label>
								<Textarea
									id="notes"
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									placeholder="Any additional information you'd like to share"
									rows={3}
								/>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowBookingDialog(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleBookSession}
							disabled={bookingLoading || !patientName.trim()}
						>
							{bookingLoading ? "Processing..." : "Confirm & Pay"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

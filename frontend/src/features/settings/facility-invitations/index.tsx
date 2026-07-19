import { useNavigate } from "@tanstack/react-router";
import {
	Ban,
	Clock,
	DollarSign,
	Loader2,
	MapPin,
	MessageCircle,
	UserPlus,
	UserX,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invitationApi, profileApi } from "@/lib/api";
import { chatApi } from "@/lib/chat-api";

interface Invitation {
	id: string;
	doctor: {
		id: string;
		userId?: string;
		fullName: string;
		email: string;
		specialty: string;
		photoUrl: string;
		title: string;
	};

	branches: {
		id: string;
		name: string;
		city: string;
		area: string;
		consultationFee: number;
	}[];
	status: "pending" | "accepted" | "rejected" | "cancelled" | "kicked";
	message: string;
	createdAt: string;
	updatedAt: string;
}

interface ProfileApiResult {
	data?: { id?: string } & { data?: { id?: string } };
}

interface ListApiResult<T> {
	data?: { data?: T[] };
}

interface ActionResult {
	data?: unknown;
	error?: string;
}

export function FacilityInvitationsPage() {
	const navigate = useNavigate();
	const [invitations, setInvitations] = useState<Invitation[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [processingId, setProcessingId] = useState<string | null>(null);
	const [messagingId, setMessagingId] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState("pending");

	const handleMessage = async (doctor: Invitation["doctor"]) => {
		const targetId = doctor.userId || doctor.id;
		setMessagingId(doctor.id);
		try {
			const result = await chatApi.openRoomWith(targetId);
			if (result.data) {
				navigate({
					to: "/chats",
					search: { room: result.data.id } as { room: string },
				});
			} else {
				toast.error(result.error || "Failed to start chat");
			}
		} finally {
			setMessagingId(null);
		}
	};

	const loadInvitations = useCallback(async (fid: string) => {
		try {
			const result: ListApiResult<Invitation> =
				await invitationApi.getFacilityInvitations(fid);
			if (result?.data?.data) {
				setInvitations(result.data.data);
			}
		} catch {
			toast.error("Failed to load invitations");
		} finally {
			setIsLoading(false);
		}
	}, []);

	const loadFacilityProfile = useCallback(async () => {
		try {
			const result: ProfileApiResult = await profileApi.getProfile();
			// Profile data is returned directly (spread), not nested
			const data = result?.data || result?.data?.data;

			if (data?.id) {
				loadInvitations(data.id);
			} else {
				setIsLoading(false);
			}
		} catch {
			toast.error("Failed to load facility profile");
			setIsLoading(false);
		}
	}, [loadInvitations]);

	useEffect(() => {
		loadFacilityProfile();
	}, [loadFacilityProfile]);

	const handleCancel = async (invitationId: string) => {
		setProcessingId(invitationId);
		try {
			const result: ActionResult =
				await invitationApi.cancelInvitation(invitationId);
			if (result?.data) {
				toast.success("Invitation cancelled");
				// Reload current facility's invitations
				const profileResult: ProfileApiResult = await profileApi.getProfile();
				const data = profileResult?.data || profileResult?.data?.data;
				if (data?.id) {
					loadInvitations(data.id);
				}
			} else {
				toast.error(result?.error || "Failed to cancel invitation");
			}
		} catch {
			toast.error("Failed to cancel invitation");
		} finally {
			setProcessingId(null);
		}
	};

	const handleKickDoctor = async (doctorId: string, branchId: string) => {
		const processId = `${doctorId}-${branchId}`;
		setProcessingId(processId);
		try {
			const result: ActionResult = await invitationApi.kickDoctorFromBranch(
				doctorId,
				branchId,
			);
			if (result?.data) {
				toast.success("Doctor removed from branch");
				// Reload invitations
				const profileResult: ProfileApiResult = await profileApi.getProfile();
				const data = profileResult?.data || profileResult?.data?.data;
				if (data?.id) {
					loadInvitations(data.id);
				}
			} else {
				toast.error(result?.error || "Failed to remove doctor");
			}
		} catch {
			toast.error("Failed to remove doctor from branch");
		} finally {
			setProcessingId(null);
		}
	};

	const filteredInvitations = invitations.filter((inv) => {
		if (activeTab === "all") return true;
		return inv.status === activeTab;
	});

	const getStatusBadge = (status: string) => {
		switch (status) {
			case "pending":
				return (
					<Badge
						variant="outline"
						className="bg-yellow-50 text-yellow-700 border-yellow-200"
					>
						<Clock className="h-3 w-3 mr-1" />
						Pending
					</Badge>
				);
			case "accepted":
				return (
					<Badge
						variant="outline"
						className="bg-green-50 text-green-700 border-green-200"
					>
						Accepted
					</Badge>
				);
			case "rejected":
				return (
					<Badge
						variant="outline"
						className="bg-red-50 text-red-700 border-red-200"
					>
						Rejected
					</Badge>
				);
			case "cancelled":
				return (
					<Badge
						variant="outline"
						className="bg-gray-50 text-gray-700 border-gray-200"
					>
						<Ban className="h-3 w-3 mr-1" />
						Cancelled
					</Badge>
				);
			case "kicked":
				return (
					<Badge
						variant="outline"
						className="bg-orange-50 text-orange-700 border-orange-200"
					>
						<UserX className="h-3 w-3 mr-1" />
						Kicked
					</Badge>
				);
			default:
				return <Badge variant="outline">{status}</Badge>;
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	if (isLoading) {
		return (
			<div className="flex justify-center items-center h-64">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">Doctor Invitations</h1>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid w-full grid-cols-6">
					<TabsTrigger value="pending">
						Pending ({invitations.filter((i) => i.status === "pending").length})
					</TabsTrigger>
					<TabsTrigger value="accepted">
						Accepted (
						{invitations.filter((i) => i.status === "accepted").length})
					</TabsTrigger>
					<TabsTrigger value="kicked">
						Kicked ({invitations.filter((i) => i.status === "kicked").length})
					</TabsTrigger>
					<TabsTrigger value="rejected">
						Rejected (
						{invitations.filter((i) => i.status === "rejected").length})
					</TabsTrigger>
					<TabsTrigger value="cancelled">
						Cancelled (
						{invitations.filter((i) => i.status === "cancelled").length})
					</TabsTrigger>
					<TabsTrigger value="all">All ({invitations.length})</TabsTrigger>
				</TabsList>

				<TabsContent value={activeTab} className="mt-6">
					{filteredInvitations.length === 0 ? (
						<Card>
							<CardContent className="flex flex-col items-center justify-center py-12">
								<UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
								<p className="text-lg font-medium text-muted-foreground">
									No {activeTab === "all" ? "" : activeTab} invitations
								</p>
								<p className="text-sm text-muted-foreground mt-1">
									{activeTab === "pending"
										? "Your pending invitations will appear here"
										: "No invitations yet"}
								</p>
							</CardContent>
						</Card>
					) : (
						<div className="space-y-4">
							{filteredInvitations.map((invitation) => (
								<Card key={invitation.id}>
									<CardContent className="p-6">
										<div className="flex items-start gap-4">
											<Avatar className="h-16 w-16">
												<AvatarImage src={invitation.doctor.photoUrl} />
												<AvatarFallback className="text-lg">
													{invitation.doctor.fullName?.charAt(0) || "D"}
												</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between">
													<div>
														<h3 className="text-lg font-semibold">
															Dr. {invitation.doctor.fullName}
														</h3>
														<p className="text-sm text-muted-foreground">
															{invitation.doctor.email}
														</p>
														<div className="flex gap-2 mt-1">
															{invitation.doctor.specialty && (
																<Badge variant="secondary">
																	{invitation.doctor.specialty}
																</Badge>
															)}
															{invitation.doctor.title && (
																<Badge variant="outline">
																	{invitation.doctor.title}
																</Badge>
															)}
														</div>
													</div>
													<div className="flex items-center gap-2">
														{getStatusBadge(invitation.status)}
														<Button
															variant="ghost"
															size="sm"
															onClick={() => handleMessage(invitation.doctor)}
															disabled={messagingId === invitation.doctor.id}
														>
															{messagingId === invitation.doctor.id ? (
																<Loader2 className="h-4 w-4 animate-spin" />
															) : (
																<MessageCircle className="h-4 w-4" />
															)}
														</Button>
														<span className="text-xs text-muted-foreground">
															{formatDate(invitation.createdAt)}
														</span>
													</div>
												</div>

												{/* Branches */}
												<div className="mt-4 space-y-2">
													<h4 className="text-sm font-medium flex items-center gap-2">
														<MapPin className="h-4 w-4" />
														Branches:
													</h4>
													<div className="grid gap-2">
														{invitation.branches.map((branch) => (
															<div
																key={branch.id}
																className="flex items-center justify-between bg-muted rounded-lg p-3"
															>
																<div>
																	<p className="font-medium">{branch.name}</p>
																	<p className="text-sm text-muted-foreground">
																		{branch.city}, {branch.area}
																	</p>
																</div>
																<div className="flex items-center gap-1 text-sm font-medium">
																	<DollarSign className="h-4 w-4" />
																	{branch.consultationFee} EGP
																</div>
															</div>
														))}
													</div>
												</div>

												{/* Message */}
												{invitation.message && (
													<div className="mt-4 p-3 bg-muted/50 rounded-lg">
														<p className="text-sm text-muted-foreground">
															"{invitation.message}"
														</p>
													</div>
												)}

												{/* Actions */}
												{invitation.status === "pending" && (
													<div className="flex gap-3 mt-4">
														<Button
															variant="outline"
															onClick={() => handleCancel(invitation.id)}
															disabled={processingId === invitation.id}
														>
															{processingId === invitation.id ? (
																<Loader2 className="h-4 w-4 mr-2 animate-spin" />
															) : (
																<X className="h-4 w-4 mr-2" />
															)}
															Cancel Invitation
														</Button>
													</div>
												)}

												{/* Kick Actions for Accepted Doctors */}
												{invitation.status === "accepted" && (
													<div className="mt-4 space-y-3">
														<p className="text-sm font-medium">
															Manage Doctor:
														</p>
														<div className="flex flex-wrap gap-2">
															{invitation.branches.map((branch) => (
																<Button
																	key={branch.id}
																	variant="outline"
																	size="sm"
																	onClick={() =>
																		handleKickDoctor(
																			invitation.doctor.id,
																			branch.id,
																		)
																	}
																	disabled={
																		processingId ===
																		`${invitation.id}-${branch.id}`
																	}
																>
																	<UserX className="h-4 w-4 mr-1" />
																	Kick from {branch.name}
																</Button>
															))}
														</div>
													</div>
												)}
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

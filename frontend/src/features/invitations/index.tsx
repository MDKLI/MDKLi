import { useNavigate } from "@tanstack/react-router";
import {
	Building2,
	Check,
	Clock,
	DollarSign,
	Loader2,
	MapPin,
	MessageCircle,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invitationApi } from "@/lib/api";
import { chatApi } from "@/lib/chat-api";
import { useAuthStore } from "@/stores/auth-store";

interface Invitation {
	id: string;
	facility: {
		id: string;
		name: string;
		photoUrl: string;
		facilityType: string;
		city: string;
	};
	invitedBy: {
		id: string;
		username: string;
	};
	branches: {
		id: string;
		name: string;
		city: string;
		area: string;
		consultationFee: number;
	}[];
	status: "pending" | "accepted" | "rejected" | "cancelled";
	message: string;
	createdAt: string;
	updatedAt: string;
}

interface ActionResult {
	data?: unknown;
	error?: string;
}

export function DoctorInvitationsPage() {
	useAuthStore();
	const [invitations, setInvitations] = useState<Invitation[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [processingId, setProcessingId] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState("pending");

	const loadInvitations = useCallback(async () => {
		try {
			const result = await invitationApi.getDoctorInvitations();
			if (result?.data?.data || result?.data) {
				setInvitations(result?.data?.data || result?.data);
			}
		} catch {
			toast.error("Failed to load invitations");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadInvitations();
	}, [loadInvitations]);
	const navigate = useNavigate();
	const [messagingId, setMessagingId] = useState<string | null>(null);

	const handleMessage = async (invitedById: string) => {
		setMessagingId(invitedById);
		try {
			const result = await chatApi.openRoomWith(invitedById);
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
	const handleAccept = async (invitationId: string) => {
		setProcessingId(invitationId);
		try {
			const result = (await invitationApi.acceptInvitation(
				invitationId,
			)) as ActionResult;
			if (result?.data) {
				toast.success("Invitation accepted!");
				loadInvitations();
			} else {
				toast.error(result?.error || "Failed to accept invitation");
			}
		} catch {
			toast.error("Failed to accept invitation");
		} finally {
			setProcessingId(null);
		}
	};

	const handleReject = async (invitationId: string) => {
		setProcessingId(invitationId);
		try {
			const result = (await invitationApi.rejectInvitation(
				invitationId,
			)) as ActionResult;
			if (result?.data) {
				toast.success("Invitation rejected");
				loadInvitations();
			} else {
				toast.error(result?.error || "Failed to reject invitation");
			}
		} catch {
			toast.error("Failed to reject invitation");
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
						<Check className="h-3 w-3 mr-1" />
						Accepted
					</Badge>
				);
			case "rejected":
				return (
					<Badge
						variant="outline"
						className="bg-red-50 text-red-700 border-red-200"
					>
						<X className="h-3 w-3 mr-1" />
						Rejected
					</Badge>
				);
			case "cancelled":
				return (
					<Badge
						variant="outline"
						className="bg-gray-50 text-gray-700 border-gray-200"
					>
						Cancelled
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
				<h1 className="text-2xl font-bold">Invitations</h1>
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="pending">
						Pending ({invitations.filter((i) => i.status === "pending").length})
					</TabsTrigger>
					<TabsTrigger value="accepted">
						Accepted (
						{invitations.filter((i) => i.status === "accepted").length})
					</TabsTrigger>
					<TabsTrigger value="rejected">
						Rejected (
						{invitations.filter((i) => i.status === "rejected").length})
					</TabsTrigger>
					<TabsTrigger value="all">All ({invitations.length})</TabsTrigger>
				</TabsList>

				<TabsContent value={activeTab} className="mt-6">
					{filteredInvitations.length === 0 ? (
						<Card>
							<CardContent className="flex flex-col items-center justify-center py-12">
								<Building2 className="h-12 w-12 text-muted-foreground mb-4" />
								<p className="text-lg font-medium text-muted-foreground">
									No {activeTab === "all" ? "" : activeTab} invitations
								</p>
								<p className="text-sm text-muted-foreground mt-1">
									{activeTab === "pending"
										? "You will receive invitations from hospitals and medical centers here"
										: activeTab === "accepted"
											? "Accepted invitations will appear here"
											: activeTab === "rejected"
												? "Rejected invitations will appear here"
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
												<AvatarImage src={invitation.facility.photoUrl} />
												<AvatarFallback className="text-lg">
													{invitation.facility.name?.charAt(0) || "F"}
												</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between">
													<div>
														<h3 className="text-lg font-semibold">
															{invitation.facility.name}
														</h3>
														<p className="text-sm text-muted-foreground">
															{invitation.facility.city}
														</p>
													</div>
													<div className="flex items-center gap-2">
														{getStatusBadge(invitation.status)}
														<Button
															variant="ghost"
															size="sm"
															onClick={() =>
																handleMessage(invitation.invitedBy.id)
															}
															disabled={messagingId === invitation.invitedBy.id}
														>
															<MessageCircle className="h-4 w-4" />
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
															onClick={() => handleReject(invitation.id)}
															disabled={processingId === invitation.id}
														>
															{processingId === invitation.id ? (
																<Loader2 className="h-4 w-4 mr-2 animate-spin" />
															) : (
																<X className="h-4 w-4 mr-2" />
															)}
															Reject
														</Button>
														<Button
															onClick={() => handleAccept(invitation.id)}
															disabled={processingId === invitation.id}
														>
															{processingId === invitation.id ? (
																<Loader2 className="h-4 w-4 mr-2 animate-spin" />
															) : (
																<Check className="h-4 w-4 mr-2" />
															)}
															Accept
														</Button>
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

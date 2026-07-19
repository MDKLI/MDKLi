import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminSearchBar } from "@/components/admin-search-bar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { verificationApi } from "@/lib/api";
import { chatApi } from "@/lib/chat-api";

interface VerificationItem {
	id: string;
	user_id?: string;
	userId?: string;
	full_name?: string;
	fullName?: string;
	facility_type?: string;
	facilityType?: string;
	photo_url?: string;
	photoUrl?: string;
	email?: string;
	username?: string;
}

interface BlockedItem {
	id: string;
	photo_url?: string;
	displayName?: string;
	email?: string;
	accountType?: string;
	blockedAt?: string;
	hoursRemaining?: number;
}

type DisplayItem = VerificationItem & {
	facility_name?: string;
	name?: string;
	displayName?: string;
	accountType?: string;
};

type ListResult<T> = {
	data?: T[] | { data?: T[] };
	error?: string;
};

type FacilityCategory = "hospitals" | "medical-centers" | "pharmacies";
type ActiveTab = "doctors" | FacilityCategory | "blocked";

const TAB_VALUES: ActiveTab[] = [
	"doctors",
	"hospitals",
	"medical-centers",
	"pharmacies",
	"blocked",
];

function isActiveTab(value: string): value is ActiveTab {
	return (TAB_VALUES as string[]).includes(value);
}

export function VerificationTabs() {
	const navigate = useNavigate();
	const [active, setActive] = useState<ActiveTab>("doctors");

	const [doctors, setDoctors] = useState<VerificationItem[]>([]);
	const [hospitals, setHospitals] = useState<VerificationItem[]>([]);
	const [medicalCenters, setMedicalCenters] = useState<VerificationItem[]>([]);
	const [pharmacies, setPharmacies] = useState<VerificationItem[]>([]);
	const [blocked, setBlocked] = useState<BlockedItem[]>([]);

	const [loading, setLoading] = useState(false);

	const [search, setSearch] = useState("");

	const fetchAll = useCallback(async () => {
		setLoading(true);
		try {
			const [docsRes, hospRes, medRes, pharmRes, blockedRes]: [
				ListResult<VerificationItem>,
				ListResult<VerificationItem>,
				ListResult<VerificationItem>,
				ListResult<VerificationItem>,
				ListResult<BlockedItem>,
			] = await Promise.all([
				verificationApi.listDoctors<ListResult<VerificationItem>>(
					"pending",
					search || undefined,
				),
				verificationApi.listFacilities<ListResult<VerificationItem>>(
					"hospitals",
					"pending",
					search || undefined,
				),
				verificationApi.listFacilities<ListResult<VerificationItem>>(
					"medical-centers",
					"pending",
					search || undefined,
				),
				verificationApi.listFacilities<ListResult<VerificationItem>>(
					"pharmacies",
					"pending",
					search || undefined,
				),
				verificationApi.listBlocked<ListResult<BlockedItem>>(
					search || undefined,
				),
			]);

			setDoctors(docsRes.data?.data || docsRes.data || []);
			setHospitals(hospRes.data?.data || hospRes.data || []);
			setMedicalCenters(medRes.data?.data || medRes.data || []);
			setPharmacies(pharmRes.data?.data || pharmRes.data || []);
			setBlocked(blockedRes.data?.data || blockedRes.data || []);
		} catch {
			toast.error("Failed to fetch verification data");
		} finally {
			setLoading(false);
		}
	}, [search]);

	useEffect(() => {
		fetchAll();
	}, [fetchAll]);
	const searchAndSet = async (
		category: "doctors" | FacilityCategory | "blocked",
	) => {
		setLoading(true);
		try {
			if (category === "doctors") {
				const res: ListResult<VerificationItem> =
					await verificationApi.listDoctors("pending", search || undefined);
				setDoctors(res.data?.data || res.data || []);
			} else if (category === "blocked") {
				const res: ListResult<BlockedItem> = await verificationApi.listBlocked(
					search || undefined,
				);
				setBlocked(res.data?.data || res.data || []);
			} else {
				const res: ListResult<VerificationItem> =
					await verificationApi.listFacilities(
						category,
						"pending",
						search || undefined,
					);
				const setMap: Record<string, (v: VerificationItem[]) => void> = {
					hospitals: setHospitals,
					"medical-centers": setMedicalCenters,
					pharmacies: setPharmacies,
				};
				setMap[category](res.data?.data || res.data || []);
			}
		} catch {
			toast.error("Search failed");
		} finally {
			setLoading(false);
		}
	};

	const handleVerify = async (type: "doctor" | "facility", id: string) => {
		try {
			if (type === "doctor") {
				await verificationApi.verifyDoctor(id);
			} else {
				await verificationApi.verifyFacility(id);
			}
			toast.success("Verified");
			fetchAll();
		} catch {
			toast.error("Failed to verify");
		}
	};

	const handleBlock = async (userId: string) => {
		try {
			await verificationApi.blockUser(userId);
			toast.success("User blocked — 24h window started");
			fetchAll();
		} catch {
			toast.error("Failed to block user");
		}
	};

	const handleUnblock = async (userId: string) => {
		try {
			await verificationApi.unblockUser(userId);
			toast.success("User unblocked");
			fetchAll();
		} catch {
			toast.error("Failed to unblock user");
		}
	};

	const openChat = async (userId: string) => {
		try {
			const result = await chatApi.openRoomWith(userId);
			if (result?.data?.id) {
				// navigate to chats with room query
				navigate({
					to: "/chats",
					search: { room: result.data.id } as { room: string },
				});
			} else {
				toast.error(result.error || "Failed to open chat");
			}
		} catch {
			toast.error("Failed to open chat");
		}
	};

	const openPublicPage = (
		item: DisplayItem,
		kind: "doctor" | "facility" | "blocked",
	) => {
		if (kind === "doctor") {
			window.location.href = `/dr/${item.id}`;
			return;
		}
		const type = item.facility_type || item.facilityType || item.accountType;
		if (type === "pharmacy" || type === "pharmacy_admin") {
			window.location.href = `/ph/${item.id}`;
			return;
		}
		window.location.href = `/fc/${item.id}`;
	};

	const renderItem = (
		item: DisplayItem,
		kind: "doctor" | "facility" | "blocked",
	) => {
		const displayName =
			item.full_name ||
			item.fullName ||
			item.displayName ||
			item.facility_name ||
			item.name;
		const photo = item.photo_url || item.photoUrl || null;
		const userId = item.user_id || item.userId || item.id;
		const email = item.email || "-";

		return (
			<div
				key={item.id}
				className="flex items-center justify-between rounded-lg border p-4"
			>
				<div className="flex items-center gap-4">
					<Avatar className="h-12 w-12">
						<AvatarImage src={photo} alt={displayName} />
						<AvatarFallback>
							{(displayName || "U").substring(0, 2).toUpperCase()}
						</AvatarFallback>
					</Avatar>
					<div>
						<h3 className="font-semibold">{displayName}</h3>
						<p className="text-sm text-muted-foreground">Email: {email}</p>
						<p className="text-xs text-muted-foreground mt-1">ID: {userId}</p>
					</div>
				</div>
				<div className="flex gap-2">
					{kind !== "blocked" && (
						<>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => openPublicPage(item, kind)}
							>
								View
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									handleVerify(
										kind === "doctor" ? "doctor" : "facility",
										item.id,
									)
								}
							>
								Verify
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => openChat(item.user_id || item.userId || item.id)}
							>
								Chat
							</Button>
							<Button
								variant="destructive"
								size="sm"
								onClick={() =>
									handleBlock(item.user_id || item.userId || item.id)
								}
							>
								Block
							</Button>
						</>
					)}

					{kind === "blocked" && (
						<>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => openPublicPage(item, kind)}
							>
								View
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => openChat(item.id)}
							>
								Chat
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleUnblock(item.id)}
							>
								Unblock
							</Button>
						</>
					)}
				</div>
			</div>
		);
	};

	return (
		<Tabs
			defaultValue="doctors"
			className="space-y-4"
			value={active}
			onValueChange={(v) => {
				if (isActiveTab(v)) setActive(v);
			}}
		>
			<TabsList>
				<TabsTrigger value="doctors">Doctors</TabsTrigger>
				<TabsTrigger value="hospitals">Hospitals</TabsTrigger>
				<TabsTrigger value="medical-centers">Medical Centers</TabsTrigger>
				<TabsTrigger value="pharmacies">Pharmacies</TabsTrigger>
				<TabsTrigger value="blocked">Blocked</TabsTrigger>
			</TabsList>

			<TabsContent value="doctors" className="space-y-4">
				<Card>
					<CardHeader className="flex items-center justify-between">
						<CardTitle>Doctors</CardTitle>
						<div className="flex items-center gap-2">
							<AdminSearchBar
								value={search}
								onChange={setSearch}
								onSearch={() => searchAndSet("doctors")}
								isSearching={loading}
								placeholder="Search by email or ID"
							/>
							<Button variant="ghost" onClick={fetchAll}>
								Refresh
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{loading ? (
							<Skeleton className="h-20 w-full" />
						) : doctors.length === 0 ? (
							<p className="text-sm text-muted-foreground p-4">
								No pending verifications.
							</p>
						) : (
							doctors.map((d) => renderItem(d, "doctor"))
						)}
					</CardContent>
				</Card>
			</TabsContent>

			<TabsContent value="hospitals" className="space-y-4">
				<Card>
					<CardHeader className="flex items-center justify-between">
						<CardTitle>Hospitals</CardTitle>
						<div className="flex items-center gap-2">
							<AdminSearchBar
								value={search}
								onChange={setSearch}
								onSearch={() => searchAndSet("hospitals")}
								isSearching={loading}
								placeholder="Search by email or ID"
							/>
							<Button variant="ghost" onClick={fetchAll}>
								Refresh
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{loading ? (
							<Skeleton className="h-20 w-full" />
						) : hospitals.length === 0 ? (
							<p className="text-sm text-muted-foreground p-4">
								No pending verifications.
							</p>
						) : (
							hospitals.map((f) => renderItem(f, "facility"))
						)}
					</CardContent>
				</Card>
			</TabsContent>

			<TabsContent value="medical-centers" className="space-y-4">
				<Card>
					<CardHeader className="flex items-center justify-between">
						<CardTitle>Medical Centers</CardTitle>
						<div className="flex items-center gap-2">
							<AdminSearchBar
								value={search}
								onChange={setSearch}
								onSearch={() => searchAndSet("medical-centers")}
								isSearching={loading}
								placeholder="Search by email or ID"
							/>
							<Button variant="ghost" onClick={fetchAll}>
								Refresh
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{loading ? (
							<Skeleton className="h-20 w-full" />
						) : medicalCenters.length === 0 ? (
							<p className="text-sm text-muted-foreground p-4">
								No pending verifications.
							</p>
						) : (
							medicalCenters.map((f) => renderItem(f, "facility"))
						)}
					</CardContent>
				</Card>
			</TabsContent>

			<TabsContent value="pharmacies" className="space-y-4">
				<Card>
					<CardHeader className="flex items-center justify-between">
						<CardTitle>Pharmacies</CardTitle>
						<div className="flex items-center gap-2">
							<AdminSearchBar
								value={search}
								onChange={setSearch}
								onSearch={() => searchAndSet("pharmacies")}
								isSearching={loading}
								placeholder="Search by email or ID"
							/>
							<Button variant="ghost" onClick={fetchAll}>
								Refresh
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{loading ? (
							<Skeleton className="h-20 w-full" />
						) : pharmacies.length === 0 ? (
							<p className="text-sm text-muted-foreground p-4">
								No pending verifications.
							</p>
						) : (
							pharmacies.map((f) => renderItem(f, "facility"))
						)}
					</CardContent>
				</Card>
			</TabsContent>

			<TabsContent value="blocked" className="space-y-4">
				<Card>
					<CardHeader className="flex items-center justify-between">
						<CardTitle>Blocked accounts</CardTitle>
						<div className="flex items-center gap-2">
							<AdminSearchBar
								value={search}
								onChange={setSearch}
								onSearch={() => searchAndSet("blocked")}
								isSearching={loading}
								placeholder="Search by email or ID"
							/>
							<Button onClick={fetchAll}>Refresh</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{loading ? (
							<Skeleton className="h-20 w-full" />
						) : blocked.length === 0 ? (
							<p className="text-sm text-muted-foreground p-4">
								No blocked accounts.
							</p>
						) : (
							blocked.map((b) => (
								<div
									key={b.id}
									className="flex items-center justify-between rounded-lg border p-4"
								>
									<div className="flex items-center gap-4">
										<Avatar className="h-12 w-12">
											<AvatarImage
												src={b.photo_url || null}
												alt={b.displayName}
											/>
											<AvatarFallback>
												{(b.displayName || b.email || "U")
													.substring(0, 2)
													.toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<div>
											<h3 className="font-semibold">{b.displayName}</h3>
											<p className="text-sm text-muted-foreground">
												{b.accountType || b.email}
											</p>
											<p className="text-xs text-muted-foreground mt-1">
												Blocked{" "}
												{b.blockedAt
													? new Date(b.blockedAt).toLocaleString()
													: ""}{" "}
												—{" "}
												{b.hoursRemaining != null
													? `${b.hoursRemaining}h left`
													: ""}
											</p>
										</div>
									</div>
									<div className="flex gap-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => openChat(b.id)}
										>
											Chat
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleUnblock(b.id)}
										>
											Unblock
										</Button>
									</div>
								</div>
							))
						)}
					</CardContent>
				</Card>
			</TabsContent>
		</Tabs>
	);
}

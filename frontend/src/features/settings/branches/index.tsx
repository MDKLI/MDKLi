import {
	Edit,
	ExternalLink,
	Image as ImageIcon,
	Loader2,
	LogOut,
	MapPin,
	Plus,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ImageViewer } from "@/components/image-viewer";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cities, getAreasByCity } from "@/data/cities";
import { invitationApi, mediaApi, profileApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

interface Branch {
	id: string;
	name: string;
	city: string;
	cityId?: string;
	area: string;
	address: string;
	googleMapsUrl?: string;
	phoneNumbers: string[];
	consultationFee?: string;
	mediaUrls: string[];
}

interface RawBranchData {
	id?: string;
	name?: string;
	city?: string;
	cityId?: string;
	area?: string;
	address?: string;
	googleMapsUrl?: string;
	google_maps_url?: string;
	phoneNumbers?: string[];
	phone_numbers?: string[];
	consultationFee?: string;
	consultation_fee?: string;
	mediaUrls?: string[];
	media_urls?: string[];
}

interface ProfileData {
	branches?: RawBranchData[];
}

interface FacilityBranch {
	id: string;
	name: string;
	city: string;
	area: string;
	address: string;
	phoneNumbers?: string[];
	consultationFee?: string;
	facility?: { name?: string };
}

interface ActionResult {
	data?: unknown;
	error?: string;
}

export function SettingsBranches() {
	const { auth } = useAuthStore();
	const [branches, setBranches] = useState<Branch[]>([]);
	const [facilityBranches, setFacilityBranches] = useState<FacilityBranch[]>(
		[],
	);
	const [isEditing, setIsEditing] = useState(false);
	const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
	const [selectedCity, setSelectedCity] = useState("");
	const [phoneNumbers, setPhoneNumbers] = useState<string[]>([""]);
	const [isUploading, setIsUploading] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [viewerOpen, setViewerOpen] = useState(false);
	const [viewerImages, setViewerImages] = useState<string[]>([]);
	const [viewerIndex, setViewerIndex] = useState(0);

	// Confirmation dialog state
	const [confirmDialog, setConfirmDialog] = useState({
		open: false,
		title: "",
		description: "",
		onConfirm: () => {},
	});

	const userRole = auth.user?.role || "";
	const isDoctor = userRole === "doctor";

	const openImageViewer = (images: string[], index: number) => {
		setViewerImages(images);
		setViewerIndex(index);
		setViewerOpen(true);
	};

	// Fetch branches on mount
	const fetchBranches = useCallback(async () => {
		try {
			const result = await profileApi.getProfile();
			if (result.data) {
				const data = result.data as ProfileData;
				if (data.branches) {
					// Map branches to ensure all fields are present
					const mappedBranches = data.branches.map((branch) => ({
						id: branch.id || String(Date.now() + Math.random()),
						name: branch.name || "",
						city: branch.city || branch.cityId || "",
						cityId: branch.cityId || branch.city || "",
						area: branch.area || "",
						address: branch.address || "",
						googleMapsUrl: branch.googleMapsUrl || branch.google_maps_url || "",
						phoneNumbers: branch.phoneNumbers || branch.phone_numbers || [],
						consultationFee:
							branch.consultationFee || branch.consultation_fee || "",
						mediaUrls: branch.mediaUrls || branch.media_urls || [],
					}));
					setBranches(mappedBranches);
				}
			}
		} catch (error) {
			console.error("Error fetching branches:", error);
		}
	}, []);

	// Fetch facility branches for doctors (from accepted invitations)
	const fetchFacilityBranches = useCallback(async () => {
		try {
			const result = await invitationApi.getDoctorFacilityBranches();
			if (result?.data?.data) {
				setFacilityBranches(result.data.data);
			}
		} catch (error) {
			console.error("Error fetching facility branches:", error);
		}
	}, []);

	// Fetch branches on mount
	useEffect(() => {
		fetchBranches();
		if (isDoctor) {
			fetchFacilityBranches();
		}
	}, [fetchBranches, fetchFacilityBranches, isDoctor]);

	const handleAddBranch = () => {
		setIsEditing(true);
		setEditingBranch({
			id: Date.now().toString(),
			name: "",
			city: "",
			area: "",
			address: "",
			googleMapsUrl: "",
			phoneNumbers: [""],
			consultationFee: "",
			mediaUrls: [],
		});
		setSelectedCity("");
		setPhoneNumbers([""]);
	};

	const handleEditBranch = (branch: Branch) => {
		setIsEditing(true);
		const cityId = branch.city || branch.cityId || "";
		setEditingBranch({
			...branch,
			city: cityId,
			cityId: cityId,
		});
		setSelectedCity(cityId);
		setPhoneNumbers(
			branch.phoneNumbers && branch.phoneNumbers.length > 0
				? branch.phoneNumbers
				: [""],
		);
	};

	const handleLeaveBranch = async (branchId: string, facilityName?: string) => {
		setConfirmDialog({
			open: true,
			title: "Leave Branch",
			description: `Are you sure you want to leave ${facilityName || "this branch"}?`,
			onConfirm: async () => {
				setConfirmDialog((prev) => ({ ...prev, open: false }));
				try {
					const result: ActionResult & { data?: { message?: string } } =
						await invitationApi.leaveBranch(branchId);
					if (result?.data) {
						toast.success(result.data.message || "You have left the branch");
						fetchFacilityBranches(); // Reload facility branches
					} else {
						toast.error(result?.error || "Failed to leave branch");
					}
				} catch (error) {
					toast.error("Failed to leave branch");
				}
			},
		});
	};

	const handleSaveBranch = async () => {
		if (!editingBranch) return;

		// Validate required fields
		if (
			!editingBranch.name ||
			!editingBranch.city ||
			!editingBranch.area ||
			!editingBranch.address
		) {
			toast.error("Please fill in all required fields");
			return;
		}

		const validPhoneNumbers = phoneNumbers.filter((p) => p.trim() !== "");
		if (validPhoneNumbers.length === 0) {
			toast.error("Please add at least one phone number");
			return;
		}

		setIsLoading(true);

		try {
			const branchToSave: Branch = {
				...editingBranch,
				city: selectedCity,
				cityId: selectedCity,
				phoneNumbers: validPhoneNumbers,
			};

			// Upload any new media files (base64) to MinIO
			if (editingBranch.mediaUrls) {
				const uploadedUrls: string[] = [];

				for (const mediaUrl of editingBranch.mediaUrls) {
					if (mediaUrl.startsWith("data:image")) {
						// Upload base64 to MinIO
						try {
							const response = await fetch(mediaUrl);
							const blob = await response.blob();
							const file = new File([blob], "branch-media.jpg", {
								type: "image/jpeg",
							});

							const result = await mediaApi.uploadBranchMedia(
								editingBranch.id,
								file,
							);
							if (
								result.data &&
								typeof result.data === "object" &&
								"url" in result.data
							) {
								uploadedUrls.push((result.data as { url: string }).url);
							} else {
								uploadedUrls.push(mediaUrl); // Keep original on failure
							}
						} catch {
							uploadedUrls.push(mediaUrl); // Keep original on failure
						}
					} else {
						// Already a URL
						uploadedUrls.push(mediaUrl);
					}
				}

				branchToSave.mediaUrls = uploadedUrls;
			}

			const newBranches = branches.find((b) => b.id === editingBranch.id)
				? branches.map((b) => (b.id === editingBranch.id ? branchToSave : b))
				: [...branches, branchToSave];

			// Save to backend
			const result = await profileApi.updateProfile({ branches: newBranches });
			if (result.error) {
				toast.error(result.error);
			} else {
				setBranches(newBranches);
				toast.success(
					branches.find((b) => b.id === editingBranch.id)
						? "Branch updated successfully"
						: "Branch added successfully",
				);
				setIsEditing(false);
				setEditingBranch(null);
				setSelectedCity("");
				setPhoneNumbers([""]);
			}
		} catch {
			toast.error("Failed to save branch");
		} finally {
			setIsLoading(false);
		}
	};

	const handleDeleteBranch = async (branchId: string) => {
		const branchToDelete = branches.find((b) => b.id === branchId);

		setConfirmDialog({
			open: true,
			title: "Delete Branch",
			description: `Are you sure you want to delete "${branchToDelete?.name || "this branch"}"? This action cannot be undone.`,
			onConfirm: async () => {
				setConfirmDialog((prev) => ({ ...prev, open: false }));

				try {
					// Get the deleted branch's media to clean up
					const deletedBranch = branches.find((b) => b.id === branchId);

					// Use dedicated delete endpoint
					const result: ActionResult = await profileApi.deleteBranch(branchId);

					if (result?.error) {
						toast.error(result.error);
						return;
					}

					// Update local state after successful delete
					const newBranches = branches.filter((b) => b.id !== branchId);
					setBranches(newBranches);

					// Clean up media from MinIO
					if (deletedBranch?.mediaUrls) {
						for (const mediaUrl of deletedBranch.mediaUrls) {
							if (mediaUrl.includes("minio")) {
								try {
									await mediaApi.deleteBranchMedia(branchId, mediaUrl);
								} catch (error) {
									console.error("Error deleting media:", error);
								}
							}
						}
					}

					toast.success("Branch deleted successfully");
				} catch {
					toast.error("Failed to delete branch");
				}
			},
		});
	};

	const MAX_BRANCH_MEDIA = 10;

	const handleBranchMediaSelect = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = event.target.files;
		if (!files || !editingBranch) return;

		// Check if adding these files would exceed the limit
		const currentCount = editingBranch.mediaUrls?.length || 0;
		if (currentCount + files.length > MAX_BRANCH_MEDIA) {
			toast.error(
				`You can only upload up to ${MAX_BRANCH_MEDIA} photos per branch`,
			);
			return;
		}

		setIsUploading(true);

		try {
			const newMediaUrls: string[] = [...(editingBranch.mediaUrls || [])];

			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				if (!file.type.startsWith("image/")) {
					toast.error(`${file.name} is not an image`);
					continue;
				}
				if (file.size > 5 * 1024 * 1024) {
					toast.error(`${file.name} is too large (max 5MB)`);
					continue;
				}

				// Compress image before storing
				const compressedImage = await compressImage(file, 800, 0.7);
				newMediaUrls.push(compressedImage);
			}

			setEditingBranch({ ...editingBranch, mediaUrls: newMediaUrls });
		} catch {
			toast.error("Failed to process media");
		} finally {
			setIsUploading(false);
		}
	};

	const removeBranchMedia = (index: number) => {
		if (!editingBranch) return;
		const newMediaUrls = [...(editingBranch.mediaUrls || [])];
		newMediaUrls.splice(index, 1);
		setEditingBranch({ ...editingBranch, mediaUrls: newMediaUrls });
	};

	const addPhoneNumber = () => {
		setPhoneNumbers([...phoneNumbers, ""]);
	};

	const updatePhoneNumber = (index: number, value: string) => {
		// Only allow numbers, +, -, space, (, )
		const filteredValue = value.replace(/[^0-9+\-\s()]/g, "");
		const newPhoneNumbers = [...phoneNumbers];
		newPhoneNumbers[index] = filteredValue;
		setPhoneNumbers(newPhoneNumbers);
	};

	const removePhoneNumber = (index: number) => {
		if (phoneNumbers.length > 1) {
			setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index));
		}
	};

	// Compress image to reduce size
	const compressImage = (
		file: File,
		maxWidth: number = 800,
		quality: number = 0.7,
	): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					const canvas = document.createElement("canvas");
					let width = img.width;
					let height = img.height;

					// Calculate new dimensions
					if (width > maxWidth) {
						height = Math.round((height * maxWidth) / width);
						width = maxWidth;
					}

					canvas.width = width;
					canvas.height = height;

					const ctx = canvas.getContext("2d");
					if (!ctx) {
						reject(new Error("Could not get canvas context"));
						return;
					}

					ctx.drawImage(img, 0, 0, width, height);

					// Convert to base64 with compression
					const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
					resolve(compressedBase64);
				};
				img.onerror = reject;
				img.src = e.target?.result as string;
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	};

	const areas = selectedCity ? getAreasByCity(selectedCity) : [];

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Branches</CardTitle>
					<CardDescription>
						{isDoctor
							? "Manage your private practice branches or clinics where you work."
							: "Manage your facility branches and locations."}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{branches.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
							<MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
							<p className="font-medium">No branches added yet</p>
							<p className="text-sm mb-4">
								{isDoctor
									? "Add branches for your private practice or clinics where you work"
									: "Add branches for your facility"}
							</p>
							<Button onClick={handleAddBranch}>
								<Plus className="mr-2 h-4 w-4" />
								Add Branch
							</Button>
						</div>
					) : (
						<>
							<div className="space-y-4">
								{branches.map((branch) => (
									<div key={branch.id} className="border p-4 rounded-lg">
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-2">
													<p className="font-medium text-lg">{branch.name}</p>
													{branch.mediaUrls && branch.mediaUrls.length > 0 && (
														<div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
															<ImageIcon className="h-3 w-3" />
															<span>{branch.mediaUrls.length} photos</span>
														</div>
													)}
												</div>
												<p className="text-sm text-muted-foreground mt-1">
													<MapPin className="h-3 w-3 inline mr-1" />
													{cities.find((c) => c.id === branch.city)?.name ||
														branch.city}{" "}
													- {branch.area}
												</p>
												<p className="text-sm mt-1">{branch.address}</p>

												{/* Phone Numbers */}
												{branch.phoneNumbers &&
													branch.phoneNumbers.length > 0 && (
														<div className="mt-2">
															<p className="text-xs text-muted-foreground">
																Phone Numbers:
															</p>
															<div className="flex flex-wrap gap-2 mt-1">
																{branch.phoneNumbers.map((phone, idx) => (
																	<span
																		// biome-ignore lint/suspicious/noArrayIndexKey: static, read-only display list; phone numbers aren't guaranteed unique so idx is included as a tiebreaker
																		key={`${phone}-${idx}`}
																		className="text-sm bg-muted px-2 py-1 rounded"
																	>
																		{phone}
																	</span>
																))}
															</div>
														</div>
													)}

												{/* Consultation Fee */}
												{isDoctor && branch.consultationFee && (
													<div className="mt-2">
														<p className="text-xs text-muted-foreground">
															Consultation Fee:
														</p>
														<p className="text-sm font-medium">
															{branch.consultationFee}
														</p>
													</div>
												)}

												{/* Google Maps Link */}
												{branch.googleMapsUrl && (
													<div className="mt-2">
														<a
															href={branch.googleMapsUrl}
															target="_blank"
															rel="noopener noreferrer"
															className="text-sm text-primary hover:underline flex items-center gap-1"
														>
															<ExternalLink className="h-3 w-3" />
															View on Google Maps
														</a>
													</div>
												)}

												{/* Media Gallery */}
												{branch.mediaUrls && branch.mediaUrls.length > 0 && (
													<div className="mt-3">
														<p className="text-xs text-muted-foreground mb-2">
															Branch Photos:
														</p>
														<div className="flex flex-wrap gap-2">
															{branch.mediaUrls.map((url, index) => (
																<button
																	key={url}
																	type="button"
																	className="relative cursor-pointer hover:opacity-80 transition-opacity"
																	onClick={() =>
																		openImageViewer(branch.mediaUrls, index)
																	}
																>
																	<img
																		src={url}
																		alt={`Branch ${index + 1}`}
																		className="w-20 h-20 object-cover rounded-lg border"
																	/>
																</button>
															))}
														</div>
													</div>
												)}
											</div>
											<div className="flex gap-1 ml-4">
												<Button
													variant="ghost"
													size="icon"
													onClick={() => handleEditBranch(branch)}
												>
													<Edit className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onClick={() => handleDeleteBranch(branch.id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</div>
								))}
							</div>

							<Button
								variant="outline"
								className="w-full"
								onClick={handleAddBranch}
							>
								<Plus className="mr-2 h-4 w-4" />
								Add Another Branch
							</Button>
						</>
					)}

					{/* Facility Branches (for doctors from accepted invitations) */}
					{isDoctor && facilityBranches.length > 0 && (
						<div className="mt-8 pt-6 border-t">
							<h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
								<MapPin className="h-5 w-5 text-primary" />
								Facility Branches
							</h3>
							<p className="text-sm text-muted-foreground mb-4">
								Branches from hospitals and medical centers you are assigned to.
								These cannot be edited.
							</p>
							<div className="space-y-4">
								{facilityBranches.map((branch) => (
									<div
										key={branch.id}
										className="border p-4 rounded-lg bg-muted/30"
									>
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-2 mb-1">
													<p className="font-medium text-lg">{branch.name}</p>
													<span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
														{branch.facility?.name}
													</span>
												</div>
												<p className="text-sm text-muted-foreground">
													{branch.city}, {branch.area}
												</p>
												<p className="text-sm text-muted-foreground">
													{branch.address}
												</p>
												{branch.phoneNumbers &&
													branch.phoneNumbers.length > 0 && (
														<p className="text-sm text-muted-foreground mt-1">
															Phone: {branch.phoneNumbers.join(", ")}
														</p>
													)}
												{branch.consultationFee && (
													<p className="text-sm font-medium text-primary mt-2">
														Consultation Fee: {branch.consultationFee} EGP
													</p>
												)}
											</div>
											<div className="ml-4 flex flex-col gap-2">
												<span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
													Read-only
												</span>
												<Button
													variant="outline"
													size="sm"
													onClick={() =>
														handleLeaveBranch(branch.id, branch.facility?.name)
													}
												>
													<LogOut className="h-4 w-4 mr-1" />
													Leave
												</Button>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Edit Branch Dialog */}
			<Dialog open={isEditing} onOpenChange={setIsEditing}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingBranch?.name ? "Edit Branch" : "Add Branch"}
						</DialogTitle>
						<DialogDescription>
							Fill in the branch details below.
						</DialogDescription>
					</DialogHeader>

					{editingBranch && (
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label htmlFor="name">Branch Name *</Label>
								<Input
									id="name"
									value={editingBranch.name}
									onChange={(e) =>
										setEditingBranch({ ...editingBranch, name: e.target.value })
									}
									placeholder="e.g., Nasr City Branch"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>City *</Label>
									<Select
										value={editingBranch.city}
										onValueChange={(value) => {
											setEditingBranch({
												...editingBranch,
												city: value,
												area: "",
											});
											setSelectedCity(value);
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select city" />
										</SelectTrigger>
										<SelectContent>
											{cities.map((city) => (
												<SelectItem key={city.id} value={city.id}>
													{city.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label>Area *</Label>
									<Select
										value={editingBranch.area}
										onValueChange={(value) =>
											setEditingBranch({ ...editingBranch, area: value })
										}
										disabled={!selectedCity}
									>
										<SelectTrigger>
											<SelectValue
												placeholder={
													selectedCity ? "Select area" : "Select city first"
												}
											/>
										</SelectTrigger>
										<SelectContent>
											{areas.map((area) => (
												<SelectItem key={area} value={area}>
													{area}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="address">Address *</Label>
								<Textarea
									id="address"
									value={editingBranch.address}
									onChange={(e) =>
										setEditingBranch({
											...editingBranch,
											address: e.target.value,
										})
									}
									placeholder="Full address"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="googleMapsUrl">Google Maps URL</Label>
								<Input
									id="googleMapsUrl"
									value={editingBranch.googleMapsUrl || ""}
									onChange={(e) =>
										setEditingBranch({
											...editingBranch,
											googleMapsUrl: e.target.value,
										})
									}
									placeholder="https://maps.google.com/..."
								/>
							</div>

							<div className="space-y-2">
								<Label>Phone Numbers *</Label>
								{phoneNumbers.map((phone, index) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: editable form rows with no stable id; index is the only ordering signal available
									<div key={index} className="flex gap-2">
										<Input
											value={phone}
											onChange={(e) => {
												// Only allow numbers, +, -, space, (, )
												const value = e.target.value.replace(
													/[^0-9+\-\s()]/g,
													"",
												);
												updatePhoneNumber(index, value);
											}}
											placeholder="Enter phone number"
											type="tel"
											inputMode="tel"
										/>
										{phoneNumbers.length > 1 && (
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => removePhoneNumber(index)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										)}
									</div>
								))}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={addPhoneNumber}
								>
									<Plus className="mr-2 h-4 w-4" />
									Add another phone
								</Button>
							</div>

							<div className="space-y-2">
								<Label htmlFor="consultationFee">Consultation Fee</Label>
								<Input
									id="consultationFee"
									value={editingBranch.consultationFee || ""}
									onChange={(e) =>
										setEditingBranch({
											...editingBranch,
											consultationFee: e.target.value,
										})
									}
									placeholder="e.g., 300 EGP"
								/>
								<p className="text-xs text-amber-500">
									Note: MDKLI takes a 10% platform fee on every consultation fee
									collected through the app.
								</p>
							</div>

							{/* Media Upload Section */}
							<div className="space-y-2">
								<Label>Branch Photos</Label>

								{/* Show existing media */}
								{editingBranch.mediaUrls &&
									editingBranch.mediaUrls.length > 0 && (
										<div className="grid grid-cols-3 gap-2 mb-3">
											{editingBranch.mediaUrls.map((url, index) => (
												<div key={url} className="relative aspect-square">
													<img
														src={url}
														alt={`Branch ${index + 1}`}
														className="w-full h-full object-cover rounded-lg"
													/>
													<Button
														type="button"
														variant="destructive"
														size="icon"
														className="absolute top-1 right-1 h-6 w-6"
														onClick={() => removeBranchMedia(index)}
														disabled={isLoading}
													>
														<X className="h-3 w-3" />
													</Button>
												</div>
											))}
										</div>
									)}

								<div className="border-2 border-dashed rounded-lg p-4 text-center">
									<ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
									<p className="text-sm text-muted-foreground mb-2">
										Upload photos of the branch
									</p>
									<input
										type="file"
										accept="image/*"
										multiple
										onChange={handleBranchMediaSelect}
										className="hidden"
										id="settings-branch-media-input"
										disabled={isUploading}
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											document
												.getElementById("settings-branch-media-input")
												?.click()
										}
										disabled={isUploading}
									>
										{isUploading ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Uploading...
											</>
										) : (
											<>
												<Upload className="mr-2 h-4 w-4" />
												Upload Photos
											</>
										)}
									</Button>
									<p className="text-xs text-muted-foreground mt-2">
										Max 5MB per image. Supported formats: JPG, PNG, GIF
									</p>
								</div>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsEditing(false)}>
							Cancel
						</Button>
						<Button onClick={handleSaveBranch} disabled={isLoading}>
							{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Save Branch
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Image Viewer */}
			<ImageViewer
				images={viewerImages}
				initialIndex={viewerIndex}
				isOpen={viewerOpen}
				onClose={() => setViewerOpen(false)}
			/>

			{/* Confirmation Dialog */}
			<ConfirmDialog
				open={confirmDialog.open}
				onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
				title={confirmDialog.title}
				desc={confirmDialog.description}
				confirmText="Delete"
				cancelBtnText="Cancel"
				destructive
				handleConfirm={confirmDialog.onConfirm}
			/>
		</div>
	);
}

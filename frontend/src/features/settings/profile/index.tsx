import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
	AlertCircle,
	Calendar as CalendarIcon,
	Camera,
	Heart,
	Loader2,
	Phone,
	User as UserIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ImageCropper } from "@/components/image-cropper";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
	bloodTypes,
	facilityTypes,
	genders,
	smokingOptions,
} from "@/data/enums";
import { specialties } from "@/data/specialties";
import { titles } from "@/data/titles";
import { mediaApi, profileApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

// Doctor schema - all fields from signup
const doctorSchema = z.object({
	fullName: z.string().min(2, "Full name is required"),
	phoneNumber: z.string().optional(),
	photoUrl: z.string().optional(),
	title: z.string().min(1, "Title is required"),
	specialty: z.string().min(1, "Specialty is required"),
	yearsOfExperience: z.string().optional(),
	gender: z.string().min(1, "Gender is required"),
	bio: z.string().optional(),
});

// Patient schema - all fields from signup
const patientSchema = z.object({
	fullName: z.string().min(2, "Full name is required"),
	gender: z.string().min(1, "Gender is required"),
	dateOfBirth: z.string().optional(),
	bloodType: z.string().optional(),
	isSmoker: z.string().optional(),
	allergies: z.string().optional().or(z.literal("")),
	currentMedications: z.string().optional().or(z.literal("")),
	familyHistory: z.string().optional().or(z.literal("")),
	emergencyContactName: z.string().optional().or(z.literal("")),
	emergencyContactPhone: z
		.string()
		.regex(/^[0-9+\-\s()]*$/, "Please enter a valid phone number")
		.optional()
		.or(z.literal("")),
	emergencyContactEmail: z
		.string()
		.email("Please enter a valid email")
		.optional()
		.or(z.literal("")),
});

// Facility schema - all fields from signup
const facilitySchema = z.object({
	facilityName: z.string().min(2, "Facility name is required"),
	phoneNumber: z.string().optional(),
	photoUrl: z.string().optional(),
	facilityType: z.string().min(1, "Facility type is required"),
	bio: z.string().optional(),
});

interface RawProfileResponse {
	id?: string;
	user_id?: string;
	username?: string;
	user?: { username?: string; email?: string; id?: string };
	email?: string;
	role?: string;
	full_name?: string;
	fullName?: string;
	clinic_name?: string;
	pharmacy_name?: string;
	facility_name?: string;
	facilityName?: string;
	name?: string;
	phone_number?: string;
	phoneNumber?: string;
	phone_numbers?: string[];
	photo_url?: string;
	photoUrl?: string;
	created_at?: string;
	createdAt?: string;
	updated_at?: string;
	updatedAt?: string;
	onboarding_completed?: boolean;
	onboardingCompleted?: boolean;
	verification_status?: string;
	verificationStatus?: string;
	title?: string;
	doctor_title?: string;
	specialty?: string;
	specialization?: string;
	doctor_specialty?: string;
	years_of_experience?: string;
	yearsOfExperience?: string;
	gender?: string;
	description?: string;
	bio?: string;
	license_number?: string;
	licenseNumber?: string;
	license_document?: string;
	licenseDocument?: string;
	date_of_birth?: string;
	dateOfBirth?: string;
	blood_type?: string;
	bloodType?: string;
	is_smoker?: boolean | string;
	isSmoker?: string;
	allergies?: string;
	current_medications?: string;
	currentMedications?: string;
	family_history?: string;
	familyHistory?: string;
	emergency_contact?: { name?: string; phone?: string; email?: string };
	emergencyContact?: { name?: string; phone?: string; email?: string };
	emergencyContactName?: string;
	emergencyContactPhone?: string;
	emergencyContactEmail?: string;
	address?: string;
	city?: string;
	area?: string;
	facility_type?: string;
	facilityType?: string;
	branches?: unknown[];
}

interface ProfileData {
	fullName?: string;
	facilityName?: string;
	phoneNumber?: string;
	photoUrl?: string;
	email?: string;
	// Doctor fields
	title?: string;
	specialty?: string;
	yearsOfExperience?: string;
	gender?: string;
	bio?: string;
	// Patient fields
	dateOfBirth?: string;
	bloodType?: string;
	isSmoker?: string;
	allergies?: string;
	currentMedications?: string;
	familyHistory?: string;
	emergencyContact?: {
		name?: string;
		phone?: string;
	};
	emergencyContactName?: string;
	emergencyContactPhone?: string;
	emergencyContactEmail?: string;
	// Facility fields
	facilityType?: string;
	// Role
	role?: string;
	username?: string;
	id?: string;
	// Additional fields that might come from backend
	userId?: string;
	createdAt?: string;
	updatedAt?: string;
	onboardingCompleted?: boolean;
	verificationStatus?: string;
	licenseNumber?: string;
	licenseDocument?: string;
	address?: string;
	city?: string;
	area?: string;
	branches?: unknown[];
}

// Helper function to format field values - no more N/A for filled fields
const formatFieldValue = (
	value: unknown,
	defaultValue: string = "Not provided",
): string => {
	if (value === null || value === undefined || value === "") {
		return defaultValue;
	}
	if (typeof value === "boolean") {
		return value ? "Yes" : "No";
	}
	return String(value);
};

// Helper to format smoker status
const formatSmokerStatus = (value: string | undefined): string => {
	if (!value) return "Not specified";
	const option = smokingOptions.find((opt) => opt.id === value);
	return option ? option.name : value;
};

// Helper to format blood type
const formatBloodType = (value: string | undefined): string => {
	if (!value) return "Not specified";
	const bloodType = bloodTypes.find((bt) => bt.id === value);
	return bloodType ? bloodType.name : value;
};

// Helper to format gender
const formatGender = (value: string | undefined): string => {
	if (!value) return "Not specified";
	const gender = genders.find((g) => g.id === value);
	return gender ? gender.name : value;
};

// Helper to format title
const formatTitle = (value: string | undefined): string => {
	if (!value) return "Not specified";
	const title = titles.find((t) => t.id === value);
	return title ? title.name : value;
};

// Helper to format specialty
const formatSpecialty = (value: string | undefined): string => {
	if (!value) return "Not specified";
	const specialty = specialties.find((s) => s.id === value);
	return specialty ? specialty.name : value;
};

// Helper to format facility type
const formatFacilityType = (value: string | undefined): string => {
	if (!value) return "Not specified";
	const type = facilityTypes.find((ft) => ft.id === value);
	return type ? type.name : value;
};

// Helper to format date
const formatDate = (value: string | undefined): string => {
	if (!value) return "Not specified";
	try {
		return format(new Date(value), "PPP");
	} catch {
		return value;
	}
};

export function SettingsProfile() {
	const { auth } = useAuthStore();
	const [isLoading, setIsLoading] = useState(false);
	const [isFetching, setIsFetching] = useState(true);
	const [profileImage, setProfileImage] = useState<string>("");
	const [originalImage, setOriginalImage] = useState<string>("");
	const [showCropper, setShowCropper] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [profileData, setProfileData] = useState<ProfileData | null>(null);

	// Confirmation dialog state
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

	const user = auth.user;
	const userRole = user?.role || "";
	const isPatient = userRole === "patient";
	const isDoctor = userRole === "doctor";
	const isFacility =
		userRole === "clinic_admin" || userRole === "pharmacy_admin";

	// Forms for different roles
	const doctorForm = useForm({
		resolver: zodResolver(doctorSchema),
		defaultValues: {
			fullName: "",
			phoneNumber: "",
			photoUrl: "",
			title: "",
			specialty: "",
			yearsOfExperience: "",
			gender: "",
			bio: "",
		},
	});

	const patientForm = useForm({
		resolver: zodResolver(patientSchema),
		defaultValues: {
			fullName: "",
			gender: "",
			dateOfBirth: "",
			bloodType: "",
			isSmoker: "",
			allergies: "",
			currentMedications: "",
			familyHistory: "",
			emergencyContactName: "",
			emergencyContactPhone: "",
			emergencyContactEmail: "",
		},
	});

	const facilityForm = useForm({
		resolver: zodResolver(facilitySchema),
		defaultValues: {
			facilityName: "",
			phoneNumber: "",
			photoUrl: "",
			facilityType: "",
			bio: "",
		},
	});

	const fetchProfile = useCallback(async () => {
		try {
			const result = await profileApi.getProfile();
			console.log("[PROFILE] Raw profile data:", result.data);
			if (result.data) {
				const data = result.data as RawProfileResponse;

				// Handle both snake_case and camelCase from backend
				const mappedData: ProfileData = {
					id: data.id || data.user_id || user?.id,
					userId: data.user_id || data.userId || data.user?.id,
					username: data.username || data.user?.username || user?.username,
					email: data.user?.email || data.email || user?.email,
					role: data.role || userRole,
					// Common fields
					fullName: data.full_name || data.fullName || "",
					facilityName:
						data.clinic_name ||
						data.pharmacy_name ||
						data.facility_name ||
						data.facilityName ||
						data.name ||
						"",
					phoneNumber:
						data.phone_number ||
						data.phoneNumber ||
						data.phone_numbers?.[0] ||
						"",
					photoUrl: data.photo_url || data.photoUrl || "",
					createdAt: data.created_at || data.createdAt,
					updatedAt: data.updated_at || data.updatedAt,
					onboardingCompleted:
						data.onboarding_completed || data.onboardingCompleted,
					verificationStatus:
						data.verification_status || data.verificationStatus,
					// Doctor fields
					title: data.title || data.doctor_title || "",
					specialty:
						data.specialty ||
						data.specialization ||
						data.doctor_specialty ||
						"",
					yearsOfExperience:
						data.years_of_experience || data.yearsOfExperience || "",
					gender: data.gender || "",
					bio: data.description || data.bio || "",
					licenseNumber: data.license_number || data.licenseNumber,
					licenseDocument: data.license_document || data.licenseDocument,
					// Patient fields
					dateOfBirth: data.date_of_birth || data.dateOfBirth || "",
					bloodType: data.blood_type || data.bloodType || "",
					isSmoker:
						(data.is_smoker !== undefined && data.is_smoker !== null
							? String(data.is_smoker)
							: data.isSmoker) || "",
					allergies: data.allergies || "",
					currentMedications:
						data.current_medications || data.currentMedications || "",
					familyHistory: data.family_history || data.familyHistory || "",
					emergencyContact: data.emergency_contact ||
						data.emergencyContact || { name: "", phone: "" },
					emergencyContactName:
						data.emergency_contact?.name ||
						data.emergencyContact?.name ||
						data.emergencyContactName ||
						"",
					emergencyContactPhone:
						data.emergency_contact?.phone ||
						data.emergencyContact?.phone ||
						data.emergencyContactPhone ||
						"",
					emergencyContactEmail:
						data.emergency_contact?.email ||
						data.emergencyContact?.email ||
						data.emergencyContactEmail ||
						"",
					address: data.address || "",
					city: data.city || "",
					area: data.area || "",
					// Facility fields
					facilityType: data.facility_type || data.facilityType || "",
					branches: data.branches || [],
				};

				setProfileData(mappedData);
				setProfileImage(mappedData.photoUrl || "");

				// Update auth store with fetched data
				if (user) {
					const updatedUser = {
						...user,
						email: mappedData.email || user.email,
						photoUrl: mappedData.photoUrl || user.photoUrl,
						fullName: mappedData.fullName,
						facilityName: mappedData.facilityName,
					};
					auth.setUser(updatedUser);
				}

				// Reset forms with fetched data
				if (isDoctor) {
					doctorForm.reset({
						fullName: mappedData.fullName,
						phoneNumber: mappedData.phoneNumber,
						photoUrl: mappedData.photoUrl,
						title: mappedData.title,
						specialty: mappedData.specialty,
						yearsOfExperience: mappedData.yearsOfExperience,
						gender: mappedData.gender,
						bio: mappedData.bio,
					});
				} else if (isPatient) {
					patientForm.reset({
						fullName: mappedData.fullName,
						gender: mappedData.gender,
						dateOfBirth: mappedData.dateOfBirth,
						bloodType: mappedData.bloodType,
						isSmoker: mappedData.isSmoker,
						allergies: mappedData.allergies,
						currentMedications: mappedData.currentMedications,
						familyHistory: mappedData.familyHistory,
						emergencyContactName: mappedData.emergencyContactName,
						emergencyContactPhone: mappedData.emergencyContactPhone,
						emergencyContactEmail: mappedData.emergencyContactEmail,
					});
				} else if (isFacility) {
					facilityForm.reset({
						facilityName: mappedData.facilityName,
						phoneNumber: mappedData.phoneNumber,
						photoUrl: mappedData.photoUrl,
						facilityType: mappedData.facilityType,
						bio: mappedData.bio,
					});
				}
			}
		} catch (error) {
			console.error("Error fetching profile:", error);
		} finally {
			setIsFetching(false);
		}
	}, [
		user,
		userRole,
		isDoctor,
		isPatient,
		isFacility,
		auth.setUser,
		doctorForm.reset,
		patientForm.reset,
		facilityForm.reset,
	]);

	// Fetch profile data on mount
	useEffect(() => {
		fetchProfile();
	}, [fetchProfile]);

	const handleFileSelect = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = event.target.files?.[0];
		if (!file) return;

		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file");
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			toast.error("File size should be less than 5MB");
			return;
		}

		const reader = new FileReader();
		reader.onloadend = () => {
			setOriginalImage(reader.result as string);
			setShowCropper(true);
		};
		reader.readAsDataURL(file);
	};

	const handleCropComplete = async (croppedImage: string) => {
		setIsUploading(true);
		try {
			const response = await fetch(croppedImage);
			const blob = await response.blob();
			const file = new File([blob], "profile-picture.jpg", {
				type: "image/jpeg",
			});

			const result = await mediaApi.uploadProfilePicture(file);
			if (result.error) {
				toast.error(result.error);
			} else if (
				result.data &&
				typeof result.data === "object" &&
				"url" in result.data
			) {
				const url = (result.data as { url: string }).url;
				setProfileImage(url);

				if (isDoctor) {
					doctorForm.setValue("photoUrl", url);
				}

				if (user) {
					auth.setUser({ ...user, photoUrl: url });
				}

				toast.success("Profile picture updated successfully");
			}
		} catch {
			toast.error("Failed to upload profile picture");
		} finally {
			setIsUploading(false);
		}
	};

	const onSubmitDoctor = async (data: z.infer<typeof doctorSchema>) => {
		setIsLoading(true);
		try {
			const result = await profileApi.updateProfile({
				...data,
				photoUrl: profileImage,
			});
			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success("Profile updated successfully");
				if (user) {
					auth.setUser({
						...user,
						photoUrl: profileImage || user.photoUrl,
						fullName: data.fullName,
					});
				}
				fetchProfile();
			}
		} catch {
			toast.error("Failed to update profile");
		} finally {
			setIsLoading(false);
		}
	};

	const onSubmitPatient = async (data: z.infer<typeof patientSchema>) => {
		setIsLoading(true);
		try {
			const result = await profileApi.updateProfile(data);
			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success("Profile updated successfully");
				if (user) {
					auth.setUser({
						...user,
						photoUrl: profileImage || user.photoUrl,
						fullName: data.fullName,
					});
				}
				fetchProfile();
			}
		} catch {
			toast.error("Failed to update profile");
		} finally {
			setIsLoading(false);
		}
	};

	const onSubmitFacility = async (data: z.infer<typeof facilitySchema>) => {
		setIsLoading(true);
		try {
			const result = await profileApi.updateProfile({
				...data,
				photoUrl: profileImage,
			});
			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success("Profile updated successfully");
				if (user) {
					auth.setUser({
						...user,
						photoUrl: profileImage || user.photoUrl,
						facilityName: data.facilityName,
					});
				}
				fetchProfile();
			}
		} catch {
			toast.error("Failed to update profile");
		} finally {
			setIsLoading(false);
		}
	};

	if (isFetching) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Profile Picture Section - NOT for patients */}
			{!isPatient && (
				<Card>
					<CardHeader>
						<CardTitle>Profile Picture</CardTitle>
						<CardDescription>
							Upload and crop your profile picture.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center gap-6">
							<div className="relative">
								<Avatar className="h-24 w-24">
									<AvatarImage
										src={profileImage || "/avatars/shadcn.jpg"}
										alt={
											profileData?.fullName ||
											profileData?.facilityName ||
											user?.username
										}
										onError={(e) => {
											// Hide the broken image and show fallback
											(e.target as HTMLImageElement).style.display = "none";
										}}
									/>
									<AvatarFallback className="text-2xl bg-muted">
										{(
											profileData?.fullName ||
											profileData?.facilityName ||
											user?.username ||
											"U"
										)
											?.charAt(0)
											.toUpperCase()}
									</AvatarFallback>
								</Avatar>
								{isUploading && (
									<div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
										<Loader2 className="h-6 w-6 animate-spin text-white" />
									</div>
								)}
							</div>
							<div className="space-y-2">
								<input
									type="file"
									ref={fileInputRef}
									onChange={handleFileSelect}
									accept="image/*"
									className="hidden"
								/>
								<div className="flex gap-2">
									<Button
										variant="outline"
										onClick={() => fileInputRef.current?.click()}
										disabled={isUploading}
									>
										<Camera className="mr-2 h-4 w-4" />
										{profileImage ? "Change Picture" : "Upload Picture"}
									</Button>
								</div>
								<p className="text-xs text-muted-foreground">
									JPG, PNG or GIF. Max 5MB. You can crop after upload.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Account Information Card - NOT for patients */}
			{!isPatient && (
				<Card>
					<CardHeader>
						<CardTitle>Account Information</CardTitle>
						<CardDescription>
							Your account details and registration information.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Email
								</p>
								<p className="text-base break-all">
									{formatFieldValue(profileData?.email)}
								</p>
							</div>
							{profileData?.createdAt && (
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Member Since
									</p>
									<p className="text-base">
										{formatDate(profileData.createdAt)}
									</p>
								</div>
							)}
							{profileData?.verificationStatus && (
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Verification Status
									</p>
									<Badge
										variant={
											profileData.verificationStatus === "verified"
												? "default"
												: "secondary"
										}
									>
										{formatFieldValue(profileData.verificationStatus)}
									</Badge>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Profile Info Display Card - All Data */}
			<Card>
				<CardHeader>
					<CardTitle>Current Profile Information</CardTitle>
					<CardDescription>
						All your profile data collected during registration.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Doctor Profile Data */}
					{isDoctor && profileData && (
						<>
							<div>
								<h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
									<UserIcon className="h-4 w-4" />
									Basic Information
								</h4>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Full Name
										</p>
										<p className="text-base font-medium">
											{formatFieldValue(profileData.fullName)}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Phone Number
										</p>
										<p className="text-base">
											{formatFieldValue(profileData.phoneNumber)}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Gender
										</p>
										<p className="text-base">
											{formatGender(profileData.gender)}
										</p>
									</div>
								</div>
							</div>

							<Separator />

							<div>
								<h4 className="text-sm font-semibold mb-3">
									Professional Information
								</h4>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Title
										</p>
										<p className="text-base">
											{formatTitle(profileData.title)}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Specialty
										</p>
										<p className="text-base">
											{formatSpecialty(profileData.specialty)}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Years of Experience
										</p>
										<p className="text-base">
											{formatFieldValue(profileData.yearsOfExperience, "0")}
										</p>
									</div>
									{profileData.licenseNumber && (
										<div>
											<p className="text-sm font-medium text-muted-foreground">
												License Number
											</p>
											<p className="text-base">
												{formatFieldValue(profileData.licenseNumber)}
											</p>
										</div>
									)}
								</div>
							</div>

							{profileData.bio && (
								<>
									<Separator />
									<div>
										<h4 className="text-sm font-semibold mb-3">
											Bio / Description
										</h4>
										<p className="text-base whitespace-pre-wrap">
											{profileData.bio}
										</p>
									</div>
								</>
							)}
						</>
					)}

					{/* Patient Profile Data */}
					{isPatient && profileData && (
						<>
							<div>
								<h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
									<UserIcon className="h-4 w-4" />
									Basic Information
								</h4>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Full Name
										</p>
										<p className="text-base font-medium">
											{formatFieldValue(profileData.fullName)}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Gender
										</p>
										<p className="text-base">
											{formatGender(profileData.gender)}
										</p>
									</div>
								</div>
							</div>

							<Separator />

							<div>
								<h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
									<Heart className="h-4 w-4" />
									Medical Information
								</h4>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Date of Birth
										</p>
										<p className="text-base">
											{formatDate(profileData.dateOfBirth)}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Blood Type
										</p>
										<p className="text-base">
											{formatBloodType(profileData.bloodType)}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Smoking Status
										</p>
										<p className="text-base">
											{formatSmokerStatus(profileData.isSmoker)}
										</p>
									</div>
								</div>
							</div>

							<Separator />

							<div>
								<h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
									<AlertCircle className="h-4 w-4" />
									Health Details
								</h4>
								<div className="space-y-3">
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Allergies
										</p>
										<p className="text-base">
											{formatFieldValue(
												profileData.allergies,
												"No allergies specified",
											)}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Current Medications
										</p>
										<p className="text-base">
											{formatFieldValue(
												profileData.currentMedications,
												"No medications specified",
											)}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Family Medical History
										</p>
										<p className="text-base">
											{formatFieldValue(
												profileData.familyHistory,
												"No family history specified",
											)}
										</p>
									</div>
								</div>
							</div>

							<Separator />

							<div>
								<h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
									<Phone className="h-4 w-4" />
									Emergency Contact
								</h4>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Contact Name
										</p>
										<p className="text-base">
											{formatFieldValue(
												profileData.emergencyContactName ||
													profileData.emergencyContact?.name,
											)}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Contact Phone
										</p>
										<p className="text-base">
											{formatFieldValue(
												profileData.emergencyContactPhone ||
													profileData.emergencyContact?.phone,
											)}
										</p>
									</div>
								</div>
								<div className="mt-3">
									<p className="text-sm font-medium text-muted-foreground">
										Contact Email
									</p>
									<p className="text-base break-all">
										{formatFieldValue(profileData.emergencyContactEmail)}
									</p>
								</div>
							</div>
						</>
					)}

					{/* Facility Profile Data */}
					{isFacility && profileData && (
						<>
							<div>
								<h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
									<UserIcon className="h-4 w-4" />
									Basic Information
								</h4>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Facility Name
										</p>
										<p className="text-base font-medium">
											{formatFieldValue(profileData.facilityName)}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Phone Number
										</p>
										<p className="text-base">
											{formatFieldValue(profileData.phoneNumber)}
										</p>
									</div>
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Facility Type
										</p>
										<p className="text-base">
											{formatFacilityType(profileData.facilityType)}
										</p>
									</div>
								</div>
							</div>

							{profileData.bio && (
								<>
									<Separator />
									<div>
										<h4 className="text-sm font-semibold mb-3">Description</h4>
										<p className="text-base whitespace-pre-wrap">
											{profileData.bio}
										</p>
									</div>
								</>
							)}

							{profileData.branches && profileData.branches.length > 0 && (
								<>
									<Separator />
									<div>
										<h4 className="text-sm font-semibold mb-3">Branches</h4>
										<p className="text-base">
											{profileData.branches.length} branch(es) registered
										</p>
									</div>
								</>
							)}
						</>
					)}

					{!profileData && (
						<p className="text-muted-foreground">No profile data available.</p>
					)}
				</CardContent>
			</Card>

			{/* Image Cropper Modal */}
			<ImageCropper
				imageSrc={originalImage}
				isOpen={showCropper}
				onClose={() => setShowCropper(false)}
				onCropComplete={handleCropComplete}
			/>

			{/* Doctor Profile Form - All Signup Data */}
			{isDoctor && (
				<Card>
					<CardHeader>
						<CardTitle>Edit Profile Information</CardTitle>
						<CardDescription>
							Update your profile information. All fields were collected during
							signup.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							onSubmit={doctorForm.handleSubmit(onSubmitDoctor)}
							className="space-y-4"
						>
							{/* Basic Info */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="fullName">Full Name *</Label>
									<Input
										{...doctorForm.register("fullName")}
										placeholder="Enter your full name"
									/>
									{doctorForm.formState.errors.fullName && (
										<p className="text-sm text-destructive">
											{doctorForm.formState.errors.fullName.message}
										</p>
									)}
								</div>
								<div className="space-y-2">
									<Label htmlFor="phoneNumber">Phone Number</Label>
									<Input
										{...doctorForm.register("phoneNumber")}
										placeholder="Enter your phone number"
										type="tel"
										inputMode="tel"
										onChange={(e) => {
											// Only allow numbers, +, -, space, (, )
											const value = e.target.value.replace(
												/[^0-9+\-\s()]/g,
												"",
											);
											doctorForm.setValue("phoneNumber", value);
										}}
									/>
								</div>
							</div>

							{/* Professional Info */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Title *</Label>
									<Controller
										name="title"
										control={doctorForm.control}
										render={({ field }) => (
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select title" />
												</SelectTrigger>
												<SelectContent>
													{titles.map((t) => (
														<SelectItem key={t.id} value={t.id}>
															{t.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
									{doctorForm.formState.errors.title && (
										<p className="text-sm text-destructive">
											{doctorForm.formState.errors.title.message}
										</p>
									)}
								</div>

								<div className="space-y-2">
									<Label>Specialty *</Label>
									<Controller
										name="specialty"
										control={doctorForm.control}
										render={({ field }) => (
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select specialty" />
												</SelectTrigger>
												<SelectContent>
													{specialties.map((s) => (
														<SelectItem key={s.id} value={s.id}>
															{s.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
									{doctorForm.formState.errors.specialty && (
										<p className="text-sm text-destructive">
											{doctorForm.formState.errors.specialty.message}
										</p>
									)}
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="yearsOfExperience">Years of Experience</Label>
									<Input
										{...doctorForm.register("yearsOfExperience")}
										placeholder="e.g., 10"
										type="number"
									/>
								</div>

								<div className="space-y-2">
									<Label>Gender *</Label>
									<Controller
										name="gender"
										control={doctorForm.control}
										render={({ field }) => (
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select gender" />
												</SelectTrigger>
												<SelectContent>
													{genders.map((g) => (
														<SelectItem key={g.id} value={g.id}>
															{g.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
									{doctorForm.formState.errors.gender && (
										<p className="text-sm text-destructive">
											{doctorForm.formState.errors.gender.message}
										</p>
									)}
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="bio">Bio / Description</Label>
								<Textarea
									{...doctorForm.register("bio")}
									placeholder="Tell us about your professional background"
								/>
							</div>

							<Button type="submit" disabled={isLoading} className="w-full">
								{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Save Changes
							</Button>
						</form>
					</CardContent>
				</Card>
			)}

			{/* Patient Profile Form - All Signup Data */}
			{isPatient && (
				<Card>
					<CardHeader>
						<CardTitle>Edit Profile Information</CardTitle>
						<CardDescription>
							Update your profile information. All fields were collected during
							signup.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							onSubmit={patientForm.handleSubmit(onSubmitPatient)}
							className="space-y-4"
						>
							{/* Basic Info */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="fullName">Full Name *</Label>
									<Input
										{...patientForm.register("fullName")}
										placeholder="Enter your full name"
									/>
									{patientForm.formState.errors.fullName && (
										<p className="text-sm text-destructive">
											{patientForm.formState.errors.fullName.message}
										</p>
									)}
								</div>
							</div>

							{/* Gender and DOB */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Gender *</Label>
									<Controller
										name="gender"
										control={patientForm.control}
										render={({ field }) => (
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select gender" />
												</SelectTrigger>
												<SelectContent>
													{genders.map((g) => (
														<SelectItem key={g.id} value={g.id}>
															{g.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
									{patientForm.formState.errors.gender && (
										<p className="text-sm text-destructive">
											{patientForm.formState.errors.gender.message}
										</p>
									)}
								</div>

								<div className="space-y-2">
									<Label>Date of Birth</Label>
									<Controller
										name="dateOfBirth"
										control={patientForm.control}
										render={({ field }) => (
											<Popover>
												<PopoverTrigger asChild>
													<Button
														variant="outline"
														className="w-full justify-start text-left font-normal"
													>
														<CalendarIcon className="mr-2 h-4 w-4" />
														{field.value ? (
															format(new Date(field.value), "PPP")
														) : (
															<span>Pick a date</span>
														)}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0" align="start">
													<Calendar
														mode="single"
														selected={
															field.value ? new Date(field.value) : undefined
														}
														onSelect={(date) => {
															if (date) {
																field.onChange(format(date, "yyyy-MM-dd"));
															}
														}}
														initialFocus
													/>
												</PopoverContent>
											</Popover>
										)}
									/>
								</div>
							</div>

							{/* Blood Type and Smoking */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label>Blood Type</Label>
									<Controller
										name="bloodType"
										control={patientForm.control}
										render={({ field }) => (
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select blood type" />
												</SelectTrigger>
												<SelectContent>
													{bloodTypes.map((bt) => (
														<SelectItem key={bt.id} value={bt.id}>
															{bt.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
								</div>

								<div className="space-y-2">
									<Label>Smoking Status</Label>
									<Controller
										name="isSmoker"
										control={patientForm.control}
										render={({ field }) => (
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<SelectTrigger>
													<SelectValue placeholder="Do you smoke?" />
												</SelectTrigger>
												<SelectContent>
													{smokingOptions.map((s) => (
														<SelectItem key={s.id} value={s.id}>
															{s.name}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										)}
									/>
								</div>
							</div>

							{/* Medical Info */}
							<div className="space-y-2">
								<Label htmlFor="allergies">Allergies</Label>
								<Textarea
									{...patientForm.register("allergies")}
									placeholder="List any allergies you have"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="currentMedications">Current Medications</Label>
								<Textarea
									{...patientForm.register("currentMedications")}
									placeholder="List your current medications"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="familyHistory">Family Medical History</Label>
								<Textarea
									{...patientForm.register("familyHistory")}
									placeholder="Describe your family's medical history"
								/>
							</div>

							{/* Emergency Contact */}
							<div className="space-y-2">
								<Label>Emergency Contact</Label>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label
											htmlFor="emergencyContactName"
											className="text-xs text-muted-foreground"
										>
											Name
										</Label>
										<Input
											{...patientForm.register("emergencyContactName")}
											placeholder="Contact name"
										/>
									</div>
									<div>
										<Label
											htmlFor="emergencyContactPhone"
											className="text-xs text-muted-foreground"
										>
											Phone (numbers only)
										</Label>
										<Input
											{...patientForm.register("emergencyContactPhone")}
											placeholder="e.g. +1234567890"
											type="tel"
											inputMode="tel"
											pattern="[0-9+\-\s()]*"
											onChange={(e) => {
												// Only allow numbers, +, -, space, (, )
												const value = e.target.value.replace(
													/[^0-9+\-\s()]/g,
													"",
												);
												patientForm.setValue("emergencyContactPhone", value, {
													shouldValidate: true,
												});
											}}
										/>
										{patientForm.formState.errors.emergencyContactPhone && (
											<p className="text-sm text-destructive">
												{
													patientForm.formState.errors.emergencyContactPhone
														.message
												}
											</p>
										)}
									</div>
								</div>
								<div>
									<Label
										htmlFor="emergencyContactEmail"
										className="text-xs text-muted-foreground"
									>
										Email
									</Label>
									<Input
										type="email"
										{...patientForm.register("emergencyContactEmail")}
										placeholder="Contact email"
									/>
									{patientForm.formState.errors.emergencyContactEmail && (
										<p className="text-sm text-destructive">
											{
												patientForm.formState.errors.emergencyContactEmail
													.message
											}
										</p>
									)}
								</div>
							</div>

							<div className="flex gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										patientForm.setValue("allergies", "");
										patientForm.setValue("currentMedications", "");
										patientForm.setValue("familyHistory", "");
										patientForm.setValue("isSmoker", "");
										patientForm.setValue("emergencyContactName", "");
										patientForm.setValue("emergencyContactPhone", "");
										patientForm.setValue("emergencyContactEmail", "");
									}}
								>
									Clear Medical Info
								</Button>
								<Button type="submit" disabled={isLoading} className="flex-1">
									{isLoading && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									Save Changes
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			)}

			{/* Facility Profile Form - All Signup Data */}
			{isFacility && (
				<Card>
					<CardHeader>
						<CardTitle>Edit Facility Information</CardTitle>
						<CardDescription>
							Update your facility information. All fields were collected during
							signup.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							onSubmit={facilityForm.handleSubmit(onSubmitFacility)}
							className="space-y-4"
						>
							{/* Basic Info */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="facilityName">Facility Name *</Label>
									<Input
										{...facilityForm.register("facilityName")}
										placeholder="Enter facility name"
									/>
									{facilityForm.formState.errors.facilityName && (
										<p className="text-sm text-destructive">
											{facilityForm.formState.errors.facilityName.message}
										</p>
									)}
								</div>
								<div className="space-y-2">
									<Label htmlFor="phoneNumber">Phone Number</Label>
									<Input
										{...facilityForm.register("phoneNumber")}
										placeholder="Enter facility phone number"
										type="tel"
										inputMode="tel"
										onChange={(e) => {
											// Only allow numbers, +, -, space, (, )
											const value = e.target.value.replace(
												/[^0-9+\-\s()]/g,
												"",
											);
											facilityForm.setValue("phoneNumber", value);
										}}
									/>
								</div>
							</div>

							{/* Facility Type */}
							<div className="space-y-2">
								<Label>Facility Type *</Label>
								<Controller
									name="facilityType"
									control={facilityForm.control}
									render={({ field }) => (
										<Select onValueChange={field.onChange} value={field.value}>
											<SelectTrigger>
												<SelectValue placeholder="Select facility type" />
											</SelectTrigger>
											<SelectContent>
												{facilityTypes.map((ft) => (
													<SelectItem key={ft.id} value={ft.id}>
														{ft.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								/>
								{facilityForm.formState.errors.facilityType && (
									<p className="text-sm text-destructive">
										{facilityForm.formState.errors.facilityType.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="bio">Description</Label>
								<Textarea
									{...facilityForm.register("bio")}
									placeholder="Describe your facility"
								/>
							</div>

							<Button type="submit" disabled={isLoading} className="w-full">
								{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Save Changes
							</Button>
						</form>
					</CardContent>
				</Card>
			)}

			{/* Delete Account Section - Common for all roles */}
			<Card className="border-destructive">
				<CardHeader>
					<CardTitle className="text-destructive">Danger Zone</CardTitle>
					<CardDescription>
						Once you delete your account, there is no going back. Please be
						certain.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						variant="outline"
						className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
						onClick={() => setDeleteConfirmOpen(true)}
					>
						Delete Account
					</Button>
				</CardContent>
			</Card>

			{/* Delete Account Confirmation Dialog */}
			<ConfirmDialog
				open={deleteConfirmOpen}
				onOpenChange={setDeleteConfirmOpen}
				title="Delete Account"
				desc="Are you sure you want to delete your account? This action cannot be undone."
				confirmText="Delete"
				cancelBtnText="Cancel"
				destructive
				handleConfirm={async () => {
					try {
						const result = await profileApi.deleteAccount();
						if (result.error) {
							toast.error(result.error);
						} else {
							toast.success("Account deleted successfully");
							// Clear auth and redirect to home
							auth.logout();
							window.location.href = "/";
						}
					} catch {
						toast.error("Failed to delete account");
					}
				}}
			/>
		</div>
	);
}

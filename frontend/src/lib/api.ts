const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const ADMIN_API_URL =
	import.meta.env.VITE_ADMIN_API_URL || "http://localhost:3006";

import { getCookie, removeCookie } from "./cookies";

const ACCESS_TOKEN_COOKIE = "thisisjustarandomstring";
const REFRESH_TOKEN_COOKIE = "refreshtoken";

let isHandlingSessionExpiry = false;

function handleSessionExpired() {
	if (isHandlingSessionExpiry) return;
	isHandlingSessionExpiry = true;

	removeCookie(ACCESS_TOKEN_COOKIE);
	removeCookie(REFRESH_TOKEN_COOKIE);
	localStorage.removeItem("user");

	// Hard redirect so every store/component resets cleanly
	window.location.href = "/sign-in";
}

interface ApiResponse<T> {
	data?: T;
	error?: string;
	message?: string;
}

export async function apiClient<T>(
	endpoint: string,
	options: RequestInit & { params?: Record<string, string> } = {},
): Promise<ApiResponse<T>> {
	let url = `${API_URL}${endpoint}`;

	// Add query params if provided
	if (options.params) {
		const searchParams = new URLSearchParams(options.params);
		url += `?${searchParams.toString()}`;
	}

	async function adminApiClient<T>(
		endpoint: string,
		options: RequestInit & { params?: Record<string, string> } = {},
	): Promise<ApiResponse<T>> {
		let url = `${ADMIN_API_URL}${endpoint}`;

		if (options.params) {
			const searchParams = new URLSearchParams(options.params);
			url += `?${searchParams.toString()}`;
		}

		const config: RequestInit = {
			headers: {
				"Content-Type": "application/json",
				...options.headers,
			},
			...options,
		};

		const token = getCookie("thisisjustarandomstring");
		if (token) {
			try {
				const parsedToken = JSON.parse(token);
				config.headers = {
					...config.headers,
					Authorization: `Bearer ${parsedToken.accessToken || parsedToken}`,
				};
			} catch {
				// Invalid token format, skip
			}
		}

		try {
			const response = await fetch(url, config);
			const data = await response.json();

			if (response.status === 401) {
				handleSessionExpired();
				return {
					error: data.message || "Session expired",
				};
			}

			if (!response.ok) {
				return {
					error: data.error || data.message || "An error occurred",
				};
			}

			return { data };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : "Network error",
			};
		}
	}
	void adminApiClient;

	const config: RequestInit = {
		headers: {
			"Content-Type": "application/json",
			...options.headers,
		},
		...options,
	};

	// Add auth token if available from cookies
	const token = getCookie("thisisjustarandomstring");
	if (token) {
		try {
			const parsedToken = JSON.parse(token);
			config.headers = {
				...config.headers,
				Authorization: `Bearer ${parsedToken}`,
			};
		} catch {
			// Invalid token format, skip
		}
	}

	try {
		const response = await fetch(url, config);
		const data = await response.json();

		if (response.status === 401) {
			handleSessionExpired();
			return {
				error: data.message || "Session expired",
			};
		}

		if (!response.ok) {
			return {
				error: data.error || data.message || "An error occurred",
			};
		}

		return { data };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Network error",
		};
	}
}

export async function adminApiClient<T>(
	endpoint: string,
	options: RequestInit & { params?: Record<string, string> } = {},
): Promise<ApiResponse<T>> {
	let url = `${ADMIN_API_URL}${endpoint}`;

	if (options.params) {
		const searchParams = new URLSearchParams(options.params);
		url += `?${searchParams.toString()}`;
	}

	const config: RequestInit = {
		headers: {
			"Content-Type": "application/json",
			...options.headers,
		},
		...options,
	};

	const token = getCookie(ACCESS_TOKEN_COOKIE);
	if (token) {
		try {
			const parsedToken = JSON.parse(token);
			config.headers = {
				...config.headers,
				Authorization: `Bearer ${parsedToken.accessToken || parsedToken}`,
			};
		} catch {
			// Invalid token format, skip
		}
	}

	try {
		const response = await fetch(url, config);
		const data = await response.json();

		if (response.status === 401) {
			handleSessionExpired();
			return {
				error: data.message || "Session expired",
			};
		}

		if (!response.ok) {
			return {
				error: data.error || data.message || "An error occurred",
			};
		}

		return { data };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Network error",
		};
	}
}

// Auth API
export const authApi = {
	login: (username: string, password: string) =>
		apiClient<{ token: string; message: string }>("/auth/login", {
			method: "POST",
			body: JSON.stringify({ username, password }),
		}),

	// Old registration (immediate)
	register: (userData: Record<string, unknown>) =>
		apiClient<{ userId: string; role: string }>("/auth/register", {
			method: "POST",
			body: JSON.stringify(userData),
		}),

	// New delayed registration
	startRegistration: (userData: Record<string, unknown>) =>
		apiClient<{ pendingToken: string; role: string; message: string }>(
			"/auth/register/start",
			{
				method: "POST",
				body: JSON.stringify(userData),
			},
		),

	completeRegistration: (
		pendingToken: string,
		onboardingData: Record<string, unknown>,
	) =>
		apiClient<{ userId: string; role: string; token: string; message: string }>(
			"/auth/register/complete",
			{
				method: "POST",
				body: JSON.stringify({ pendingToken, onboardingData }),
			},
		),

	checkPendingRegistration: (pendingToken: string) =>
		apiClient<{ role: string; email: string }>(
			`/auth/register/pending/${pendingToken}`,
			{
				method: "GET",
			},
		),

	refreshToken: (refreshToken: string) =>
		apiClient<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
			method: "POST",
			body: JSON.stringify({ refreshToken }),
		}),

	requestPasswordReset: (email: string) =>
		apiClient("/auth/password-request", {
			method: "POST",
			body: JSON.stringify({ email }),
		}),

	resetPassword: (token: string, email: string, newPassword: string) =>
		apiClient("/auth/reset-password", {
			method: "POST",
			body: JSON.stringify({ token, email, newPassword }),
		}),
};

// Profile API
export const profileApi = {
	getProfile: <T = unknown>() =>
		apiClient<T>("/api/profile/me", { method: "GET" }),

	updateProfile: <T = unknown>(data: Record<string, unknown>) =>
		apiClient<T>("/api/profile/me", {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	updateAccount: (data: Record<string, unknown>) =>
		apiClient("/api/profile/me/account", {
			method: "PUT",
			body: JSON.stringify(data),
		}),

	deleteAccount: () =>
		apiClient<{ message: string }>("/api/profile/me", {
			method: "DELETE",
		}),

	deleteBranch: (branchId: string) =>
		apiClient<{ message: string }>(`/api/profile/branches/${branchId}`, {
			method: "DELETE",
		}),
};

// Media API
export const mediaApi = {
	uploadProfilePicture: (file: File) => {
		const formData = new FormData();
		formData.append("file", file);
		return apiClient("/api/media/profile-picture", {
			method: "POST",
			body: formData,
			headers: {}, // Let browser set content-type with boundary
		});
	},

	uploadBranchMedia: (branchId: string, file: File) => {
		const formData = new FormData();
		formData.append("file", file);
		return apiClient(`/api/media/branch/${branchId}`, {
			method: "POST",
			body: formData,
			headers: {},
		});
	},

	deleteBranchMedia: (branchId: string, mediaUrl: string) =>
		apiClient("/api/media/branch", {
			method: "DELETE",
			body: JSON.stringify({ branchId, mediaUrl }),
		}),
};

// Invitation API
export const invitationApi = {
	// Find doctors by email/name/specialty
  findDoctors: <T = unknown>(query: string, facilityId: string) =>
		apiClient<{ data: T[] }>(
			`/api/invitations/doctors/search?query=${encodeURIComponent(query)}&facilityId=${facilityId}`,
			{
				method: "GET",
			},
		),

	// Get facility branches for invitation
  getFacilityBranches: <T = unknown>(facilityId: string) =>
		apiClient<{ data: T[] }>(
			`/api/invitations/facility/${facilityId}/branches`,
			{
				method: "GET",
			},
		),

	// Create invitation
	createInvitation: (data: {
		doctorId: string;
		facilityId: string;
		branches: { branchId: string; consultationFee: number }[];
		message?: string;
	}) =>
		apiClient<{ invitationId: string; message: string }>("/api/invitations/", {
			method: "POST",
			body: JSON.stringify(data),
		}),

	// Get facility invitations
  getFacilityInvitations: <T = unknown>(facilityId: string, status?: string) =>
		apiClient<{ data: T[] }>(
			`/api/invitations/facility/${facilityId}${status ? `?status=${status}` : ""}`,
			{
				method: "GET",
			},
		),

	// Get doctor invitations
  getDoctorInvitations: <T = unknown>(status?: string) =>
		apiClient<{ data: T[] }>(
			`/api/invitations/doctor${status ? `?status=${status}` : ""}`,
			{
				method: "GET",
			},
		),

	// Accept invitation
	acceptInvitation: (invitationId: string) =>
		apiClient<{ message: string }>(`/api/invitations/${invitationId}/accept`, {
			method: "POST",
		}),

	// Reject invitation
	rejectInvitation: (invitationId: string) =>
		apiClient<{ message: string }>(`/api/invitations/${invitationId}/reject`, {
			method: "POST",
		}),

	// Cancel invitation
	cancelInvitation: (invitationId: string) =>
		apiClient<{ message: string }>(`/api/invitations/${invitationId}/cancel`, {
			method: "POST",
		}),

	// Get doctor's facility branches (from accepted invitations)
  getDoctorFacilityBranches: <T = unknown>() =>
		apiClient<{ data: T[] }>("/api/invitations/my-branches", {
			method: "GET",
		}),

	// Kick doctor from branch (for facility owners)
	kickDoctorFromBranch: (doctorId: string, branchId: string) =>
		apiClient<{ message: string }>("/api/invitations/kick", {
			method: "POST",
			body: JSON.stringify({ doctorId, branchId }),
		}),

	// Doctor leaves branch
	leaveBranch: (branchId: string) =>
		apiClient<{ message: string }>("/api/invitations/leave", {
			method: "POST",
			body: JSON.stringify({ branchId }),
		}),

	// Doctor leaves facility (all branches)
	leaveFacility: (facilityId: string) =>
		apiClient<{ message: string }>("/api/invitations/leave-facility", {
			method: "POST",
			body: JSON.stringify({ facilityId }),
		}),

	// Get doctors assigned to a branch
  getBranchDoctors: <T = unknown>(branchId: string) =>
		apiClient<{ data: T[] }>(
			`/api/invitations/branch/${branchId}/doctors`,
			{
				method: "GET",
			},
		),
};

// Verification API
export const verificationApi = {
	listDoctors: <T = unknown>(
		status = "pending",
		search?: string,
		page?: number,
	) => {
		const params: Record<string, string> = { status };
		if (search) params.search = search;
		if (page !== undefined) params.page = String(page);
		return adminApiClient<T>(`/admin/verifications/doctors`, {
			method: "GET",
			params,
		});
	},

	listFacilities: <T = unknown>(
		category: string,
		status = "pending",
		search?: string,
		page?: number,
	) => {
		const params: Record<string, string> = { status };
		if (search) params.search = search;
		if (page !== undefined) params.page = String(page);
		return adminApiClient<T>(`/admin/verifications/facilities/${category}`, {
			method: "GET",
			params,
		});
	},

	verifyDoctor: (doctorId: string) =>
		adminApiClient(`/admin/verifications/doctors/${doctorId}/verify`, {
			method: "PATCH",
		}),

	rejectDoctor: (doctorId: string, reason?: string) =>
		adminApiClient(`/admin/verifications/doctors/${doctorId}/reject`, {
			method: "PATCH",
			body: JSON.stringify({ reason }),
		}),

	verifyFacility: (facilityId: string) =>
		adminApiClient(`/admin/verifications/facilities/${facilityId}/verify`, {
			method: "PATCH",
		}),

	rejectFacility: (facilityId: string, reason?: string) =>
		adminApiClient(`/admin/verifications/facilities/${facilityId}/reject`, {
			method: "PATCH",
			body: JSON.stringify({ reason }),
		}),

	blockUser: (userId: string) =>
		adminApiClient(`/admin/verifications/users/${userId}/block`, {
			method: "PATCH",
		}),
	unblockUser: (userId: string) =>
		adminApiClient(`/admin/verifications/users/${userId}/unblock`, {
			method: "PATCH",
		}),

  listBlocked: <T = unknown>(search?: string, page?: number) => {
		const params: Record<string, string> = {};
		if (search) params.search = search;
		if (page !== undefined) params.page = String(page);
		return adminApiClient<T>(`/admin/verifications/blocked`, {
			method: "GET",
			params,
		});
	},
};

// Booking API
export const bookingApi = {
	// Get doctor settings
	getDoctorSettings: (doctorId: string) =>
		apiClient<{ success: boolean; data: unknown }>(
			"/api/booking/doctor/settings",
			{
				method: "GET",
				params: { doctorId },
			},
		),

	// Update doctor settings
	updateDoctorSettings: (doctorId: string, data: Record<string, unknown>) =>
		apiClient<{ success: boolean; data: unknown }>(
			"/api/booking/doctor/settings",
			{
				method: "PUT",
				body: JSON.stringify({ ...data, doctorId }),
			},
		),

	// Get pending sessions for a doctor
	getPendingSessions: (doctorId: string) =>
		apiClient<{ success: boolean; data: unknown[] }>(
			"/api/booking/doctor/appointments",
			{
				method: "GET",
				params: { doctorId, status: "PENDING" },
			},
		),

	// Get session history for a doctor
	getSessionHistory: (doctorId: string, status?: string) =>
		apiClient<{ success: boolean; data: unknown[] }>(
			"/api/booking/doctor/appointments",
			{
				method: "GET",
				params: status
					? { doctorId, status: status.toUpperCase() }
					: { doctorId },
			},
		),

	// Accept a session
	acceptSession: (sessionId: string) =>
		apiClient<{ success: boolean; data: unknown }>(
			`/api/booking/doctor/appointments/${sessionId}/status`,
			{
				method: "PATCH",
				body: JSON.stringify({ status: "CONFIRMED" }),
			},
		),

	// Reject a session
	rejectSession: (sessionId: string) =>
		apiClient<{ success: boolean; data: unknown }>(
			`/api/booking/doctor/appointments/${sessionId}/status`,
			{
				method: "PATCH",
				body: JSON.stringify({ status: "CANCELLED" }),
			},
		),

	// Reschedule a session
	rescheduleSession: (
		sessionId: string,
		data: { booking_date: string; start_time: string; end_time: string },
	) =>
		apiClient<{ success: boolean; data: unknown }>(
			`/api/booking/doctor/appointments/${sessionId}/reschedule`,
			{
				method: "PATCH",
				body: JSON.stringify({
					date: data.booking_date,
					startTime: data.start_time,
					endTime: data.end_time,
				}),
			},
		),

	// Get rules for a branch. Pass doctorId when acting as a facility-assigned
	// doctor (or on behalf of one); omit for a doctor's own private-practice branch.
	getDoctorBranchAvailability: (branchId: string, doctorId?: string) =>
		apiClient<{ success: boolean; data: unknown[] }>(
			`/api/booking/doctor/branches/${branchId}/availability`,
			{
				method: "GET",
				params: doctorId ? { doctorId } : undefined,
			},
		),

	// Replace all branch rules in one request
	replaceDoctorBranchAvailability: (
		branchId: string,
		data: {
			doctorId: string;
			rules: Array<{
				dayOfWeek: number;
				startTime: string;
				endTime: string;
				slotDurationMinutes: number;
			}>;
		},
	) =>
		apiClient<{ success: boolean; data: unknown[] }>(
			`/api/booking/doctor/branches/${branchId}/availability`,
			{
				method: "PUT",
				body: JSON.stringify(data),
			},
		),

	// Get branch availability overrides (block-out and extra)
	getDoctorBranchOverrides: (branchId: string, doctorId?: string) =>
		apiClient<{ success: boolean; data: unknown[] }>(
			`/api/booking/doctor/branches/${branchId}/overrides`,
			{
				method: "GET",
				params: doctorId ? { doctorId } : undefined,
			},
		),

	// Create a block-out/extra override for a branch
	createDoctorBranchOverride: (
		branchId: string,
		data: {
			date: string;
			type: "BLOCK" | "EXTRA";
			startTime?: string;
			endTime?: string;
			reason?: string;
			doctorId?: string;
		},
	) =>
		apiClient<{ success: boolean; data: unknown }>(
			`/api/booking/doctor/branches/${branchId}/overrides`,
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		),

	// Delete override
	deleteDoctorBranchOverride: (branchId: string, overrideId: string) =>
		apiClient<{ success: boolean; message: string }>(
			`/api/booking/doctor/branches/${branchId}/overrides/${overrideId}`,
			{
				method: "DELETE",
			},
		),

	// Get doctor availability for public booking (New booking service)
	getDoctorAvailabilityForBooking: (_doctorId: string, branchId: string) =>
		apiClient<{ success: boolean; data: unknown[] }>(
			`/api/booking/public/branches/${branchId}/availability-week`,
			{
				method: "GET",
			},
		),

	// Get doctor branches for booking (New booking service)
	getDoctorBranchesForBooking: (doctorId: string) =>
		apiClient<{ success: boolean; data: unknown }>(
			`/api/booking/public/doctors/${doctorId}`,
			{
				method: "GET",
			},
		),

	// Public: get a facility's branches with their assigned doctors (no auth/ownership required)
	getFacilityBranchesForPublic: (facilityUserId: string) =>
		apiClient<{ success: boolean; data: unknown[] }>(
			`/api/booking/public/facilities/${facilityUserId}/branches`,
			{
				method: "GET",
			},
		),
	getMyAppointments: (patientId: string) =>
		apiClient<{ success: boolean; data: unknown[] }>(
			"/api/booking/public/appointments/my",
			{
				method: "GET",
				params: { patientId },
			},
		),
	// Create a booking (New booking service) - now returns a Paymob redirectUrl, booking isn't
	// confirmed until the patient completes payment on Paymob's Unified Checkout page
	createBooking: (data: {
		doctor_id: string;
		branch_id: string;
		patient_id: string;
		patient_email?: string;
		patient_name?: string;
		patient_phone?: string;
		booking_date: string;
		start_time: string;
		end_time: string;
		reason?: string;
		notes?: string;
	}) =>
		apiClient<{
			success: boolean;
			data: { appointmentId: string; status: string };
		}>("/api/booking/public/appointments", {
			method: "POST",
			body: JSON.stringify({
				branchId: data.branch_id,
				doctorId: data.doctor_id,
				patientId: data.patient_id,
				patientEmail: data.patient_email,
				patientName: data.patient_name,
				patientPhone: data.patient_phone,
				date: data.booking_date,
				startTime: data.start_time,
				endTime: data.end_time,
				notes: data.notes || data.reason,
			}),
		}),

	// Poll payment status after Paymob redirects the patient back
	getPaymentStatus: (appointmentId: string) =>
		apiClient<{
			success: boolean;
			data: { status: string; payment: unknown | null };
		}>(`/api/booking/payment/status/${appointmentId}`, {
			method: "GET",
		}),

	// MVP/demo only: confirm a fake payment (no real gateway, no validation on card fields)
	confirmFakePayment: (
		appointmentId: string,
		card: {
			cardholderName: string;
			cardNumber: string;
			expiry: string;
			cvc: string;
		},
	) =>
		apiClient<{ success: boolean; data: { status: string } }>(
			`/api/booking/payment/fake-confirm/${appointmentId}`,
			{
				method: "POST",
				body: JSON.stringify(card),
			},
		),
};

type WalletResponse = {
	balance: number;
	cards: { id: string; cardholderName: string; last4: string; brand: string }[];
	transactions: {
		id: string;
		type: "CREDIT" | "WITHDRAWAL";
		amount: number;
		note: string | null;
		createdAt: string;
	}[];
};

export const walletApi = {
	async getWallet() {
		const res = await apiClient<{ success: boolean; data: WalletResponse }>(
			"/api/booking/wallet",
			{
				method: "GET",
			},
		);
		if (res.error || !res.data?.data)
			throw new Error(res.error || "Failed to load wallet");
		return res.data.data;
	},

	async addCard(payload: { cardholderName: string; cardNumber: string }) {
		const res = await apiClient<{ success: boolean; data: unknown }>(
			"/api/booking/wallet/cards",
			{
				method: "POST",
				body: JSON.stringify(payload),
			},
		);
		if (res.error) throw new Error(res.error);
		return res.data?.data;
	},

	async removeCard(cardId: string) {
		const res = await apiClient<{ success: boolean }>(
			`/api/booking/wallet/cards/${cardId}`,
			{
				method: "DELETE",
			},
		);
		if (res.error) throw new Error(res.error);
	},

	async withdraw(payload: { cardId: string; amount?: number }) {
		const res = await apiClient<{
			success: boolean;
			data: { balance: number };
		}>("/api/booking/wallet/withdraw", {
			method: "POST",
			body: JSON.stringify(payload),
		});
		if (res.error || !res.data?.data)
			throw new Error(res.error || "Withdrawal failed");
		return res.data.data;
	},
};

export const api = apiClient;

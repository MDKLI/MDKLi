const SEARCH_API_URL =
	import.meta.env.VITE_SEARCH_API_URL || "http://localhost:3001";

async function apiClient(endpoint: string, options: RequestInit = {}) {
	const url = `${SEARCH_API_URL}${endpoint}`;

	const response = await fetch(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options.headers,
		},
	});

	if (!response.ok) {
		const error = await response
			.json()
			.catch(() => ({ error: "Unknown error" }));
		throw new Error(error.error || `HTTP ${response.status}`);
	}

	return response.json();
}

export const searchApi = {
	// Search all
	search: (query: string, filters?: Record<string, string>) => {
		const params = new URLSearchParams();
		params.append("q", query);
		if (filters) {
			Object.entries(filters).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					params.append(key, String(value));
				}
			});
		}
		return apiClient(`/api/search?${params}`);
	},

	// Search doctors only
	searchDoctors: (query: string, filters?: Record<string, string>) => {
		const params = new URLSearchParams();
		params.append("q", query);
		if (filters) {
			Object.entries(filters).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					params.append(key, String(value));
				}
			});
		}
		return apiClient(`/api/search/doctors?${params}`);
	},

	// Search facilities only
	searchFacilities: (query: string, filters?: Record<string, string>) => {
		const params = new URLSearchParams();
		params.append("q", query);
		if (filters) {
			Object.entries(filters).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					params.append(key, String(value));
				}
			});
		}
		return apiClient(`/api/search/facilities?${params}`);
	},

	// Get search suggestions
	getSuggestions: (query: string, type?: string) => {
		const params = new URLSearchParams();
		params.append("q", query);
		if (type) params.append("type", type);
		return apiClient(`/api/suggestions?${params}`);
	},

	// Get available filters
	getFilters: () => apiClient("/api/filters"),
};

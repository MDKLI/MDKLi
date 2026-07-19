import { Link } from "@tanstack/react-router";
import {
	Award,
	Building2,
	CheckCircle,
	ChevronRight,
	Clock,
	Filter,
	MapPin,
	Search,
	Stethoscope,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useDebounce } from "@/hooks/use-debounce";
import { searchApi } from "@/lib/search-api";

interface Doctor {
	id: string;
	full_name: string;
	title: string | null;
	specialty: string | null;
	years_of_experience: string | null;
	gender: string | null;
	description: string | null;
	photo_url: string | null;
	phone_number: string | null;
	city: string | null;
	area?: string | null;
	has_private_practice: boolean;
	clinic?: string | null;
	verification_status: string;
	branches?: { area?: string | null; city?: string | null }[];
}

interface Pharmacy {
	id: string;
	facility_name: string;
	facility_type: string | null;
	description: string | null;
	photo_url: string | null;
	address: string | null;
	city: string | null;
	area?: string | null;
	status: string;
}

interface Filters {
	specialty?: string;
	title?: string;
	city?: string;
	area?: string;
	gender?: string;
	locationType?: "all" | "hospital" | "clinic";
}

export function SearchPage() {
	// Get search mode from localStorage to persist across navigation
	const [query, setQuery] = useState("");
	const [searchMode, setSearchMode] = useState<"doctors" | "pharmacy">(
		"doctors",
	);

	// Read mode from localStorage on mount and when visibility changes (e.g., when user comes back)
	useEffect(() => {
		const savedMode = localStorage.getItem("searchMode") as
			| "doctors"
			| "pharmacy"
			| null;
		if (savedMode) {
			setSearchMode(savedMode);
		}
	}, []);

	// Also listen for visibility change (when user navigates back)
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				const savedMode = localStorage.getItem("searchMode") as
					| "doctors"
					| "pharmacy"
					| null;
				if (savedMode && savedMode !== searchMode) {
					setSearchMode(savedMode);
				}
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibilityChange);
	}, [searchMode]);

	// Update localStorage when mode changes
	const handleModeChange = (mode: "doctors" | "pharmacy") => {
		setSearchMode(mode);
		localStorage.setItem("searchMode", mode);
	};
	const [doctors, setDoctors] = useState<Doctor[]>([]);
	const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
	const [loading, setLoading] = useState(false);
	const [showFilters, setShowFilters] = useState(false);
	const [filters, setFilters] = useState<Filters>({ locationType: "all" });

	// Pagination state
	const [currentPage, setCurrentPage] = useState(() => {
		// Restore page from localStorage on mount
		const savedPage = localStorage.getItem("searchCurrentPage");
		return savedPage ? parseInt(savedPage, 10) : 1;
	});
	const itemsPerPage = 15;

	// Save page to localStorage whenever it changes
	useEffect(() => {
		localStorage.setItem("searchCurrentPage", currentPage.toString());
	}, [currentPage]);
	const [availableFilters, setAvailableFilters] = useState({
		specialties: [] as string[],
		titles: [] as string[],
		genders: [] as string[],
		cities: [] as { id: string; name: string; areas: string[] }[],
		areas: [] as string[],
	});

	const debouncedQuery = useDebounce(query, 300);

	const fetchFilters = useCallback(async () => {
		try {
			const data = await searchApi.getFilters();
			setAvailableFilters({
				specialties: data.data?.doctors?.specialties || [],
				titles: data.data?.doctors?.titles || [],
				genders: data.data?.doctors?.genders || [],
				cities: data.data?.cities_with_areas || [],
				areas: [],
			});
		} catch (error) {
			console.error("Failed to fetch filters:", error);
		}
	}, []);

	const performSearch = useCallback(async () => {
		setLoading(true);
		try {
			if (searchMode === "doctors") {
				// Build search filters
				const searchFilters: Record<string, string> = {};

				if (filters.specialty) searchFilters.specialty = filters.specialty;
				if (filters.title) searchFilters.title = filters.title;
				if (filters.city) searchFilters.city = filters.city;
				if (filters.area) searchFilters.area = filters.area;
				if (filters.gender) searchFilters.gender = filters.gender;

				// Handle location type filter
				// 'hospital' - doctors with branches at hospitals (invited)
				// 'clinic' - doctors with private practice OR branches at clinics/centers
				if (filters.locationType && filters.locationType !== "all") {
					searchFilters.location_type = filters.locationType;
				}

				// Use '*' as wildcard if no query
				const searchQuery = debouncedQuery.trim() || "*";
				const data = await searchApi.searchDoctors(searchQuery, searchFilters);
				setDoctors(data.data || []);
				setPharmacies([]);
			} else {
				// Pharmacy search
				const searchFilters: Record<string, string> = {
					facility_role: "pharmacy",
				};
				if (filters.city) searchFilters.city = filters.city;
				if (filters.area) searchFilters.area = filters.area;

				const searchQuery = debouncedQuery.trim() || "*";
				const data = await searchApi.searchFacilities(
					searchQuery,
					searchFilters,
				);
				setPharmacies(data.data || []);
				setDoctors([]);
			}
		} catch (error) {
			console.error("Search failed:", error);
			toast.error("Search failed. Please try again.");
		} finally {
			setLoading(false);
		}
	}, [searchMode, filters, debouncedQuery]);

	// Fetch available filters on mount
	useEffect(() => {
		fetchFilters();
	}, [fetchFilters]);

	// Search when query, filters, or mode changes
	useEffect(() => {
		performSearch();
	}, [performSearch]);

	const clearFilters = () => {
		setFilters({ locationType: "all" });
		// Trigger search after clearing
		setTimeout(() => performSearch(), 0);
	};

	const clearSearch = () => {
		setQuery("");
		// Trigger search after clearing
		setTimeout(() => performSearch(), 0);
	};

	const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
		if (key === "locationType") return value !== "all";
		return value !== undefined && value !== "" && value !== false;
	}).length;

	const totalResults =
		searchMode === "doctors" ? doctors.length : pharmacies.length;

	return (
		<div className="flex-1 h-full overflow-auto">
			{/* Header with Big Toggle */}
			<div className="sticky top-0 z-40 bg-background border-b">
				<div className="container mx-auto px-4 py-4">
					{/* Big Mode Switch */}
					<div className="flex justify-center mb-6">
						<div className="bg-muted rounded-full p-1 flex items-center gap-1">
							<button
								type="button"
								onClick={() => handleModeChange("doctors")}
								className={`px-6 py-3 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
									searchMode === "doctors"
										? "bg-primary text-primary-foreground shadow-md"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								<Stethoscope className="h-5 w-5" />
								Doctors
							</button>
							<button
								type="button"
								onClick={() => handleModeChange("pharmacy")}
								className={`px-6 py-3 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
									searchMode === "pharmacy"
										? "bg-primary text-primary-foreground shadow-md"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								<Building2 className="h-5 w-5" />
								Pharmacy
							</button>
						</div>
					</div>

					{/* Search Bar */}
					<div className="flex gap-4 items-center max-w-2xl mx-auto">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								type="search"
								placeholder={
									searchMode === "doctors"
										? "Search doctors by name, specialty..."
										: "Search pharmacies by name, location..."
								}
								className="pl-10 h-12"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
							/>
							{query && (
								<button
									type="button"
									onClick={clearSearch}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								>
									<X className="h-4 w-4" />
								</button>
							)}
						</div>
						<Button
							variant="outline"
							onClick={() => setShowFilters(!showFilters)}
							className="relative"
						>
							<Filter className="h-4 w-4 mr-2" />
							Filters
							{activeFiltersCount > 0 && (
								<Badge variant="secondary" className="ml-2">
									{activeFiltersCount}
								</Badge>
							)}
						</Button>
					</div>

					{/* Filter Panel */}
					{showFilters && (
						<div className="mt-4 p-4 border rounded-lg bg-card max-w-2xl mx-auto">
							<div className="flex justify-between items-center mb-4">
								<h3 className="font-semibold">Filters</h3>
								<Button variant="ghost" size="sm" onClick={clearFilters}>
									<X className="h-4 w-4 mr-1" />
									Clear
								</Button>
							</div>

							<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
								{searchMode === "doctors" && (
									<>
										{/* Location Type Filter */}
										<div className="space-y-2">
											<Label>Location Type</Label>
											<Select
												value={filters.locationType || "all"}
												onValueChange={(value) => {
													setFilters({
														...filters,
														locationType: value as Filters["locationType"],
													});
												}}
											>
												<SelectTrigger>
													<SelectValue placeholder="All locations" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all">All</SelectItem>
													<SelectItem value="hospital">Hospital</SelectItem>
													<SelectItem value="clinic">
														Clinic / Medical Center
													</SelectItem>
												</SelectContent>
											</Select>
										</div>

										{/* Specialty Filter */}
										<div className="space-y-2">
											<Label>Specialty</Label>
											<Select
												value={filters.specialty || "all_specialties"}
												onValueChange={(value) => {
													setFilters({
														...filters,
														specialty:
															value === "all_specialties" ? undefined : value,
													});
												}}
											>
												<SelectTrigger>
													<SelectValue placeholder="All specialties" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all_specialties">
														All specialties
													</SelectItem>
													{availableFilters.specialties.map((s) => (
														<SelectItem key={s} value={s}>
															{s
																.replace(/_/g, " ")
																.replace(/\b\w/g, (l) => l.toUpperCase())}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										{/* Title Filter */}
										<div className="space-y-2">
											<Label>Title</Label>
											<Select
												value={filters.title || "all_titles"}
												onValueChange={(value) => {
													setFilters({
														...filters,
														title: value === "all_titles" ? undefined : value,
													});
												}}
											>
												<SelectTrigger>
													<SelectValue placeholder="All titles" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all_titles">All titles</SelectItem>
													{availableFilters.titles.map((t) => (
														<SelectItem key={t} value={t}>
															{t.charAt(0).toUpperCase() + t.slice(1)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										{/* Gender Filter */}
										<div className="space-y-2">
											<Label>Gender</Label>
											<Select
												value={filters.gender || "any_gender"}
												onValueChange={(value) => {
													setFilters({
														...filters,
														gender: value === "any_gender" ? undefined : value,
													});
												}}
											>
												<SelectTrigger>
													<SelectValue placeholder="Any gender" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="any_gender">Any gender</SelectItem>
													{availableFilters.genders.map((g) => (
														<SelectItem key={g} value={g}>
															{g.charAt(0).toUpperCase() + g.slice(1)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</>
								)}

								{/* City Filter */}
								<div className="space-y-2">
									<Label>City</Label>
									<Select
										value={filters.city || "all_cities"}
										onValueChange={(value) => {
											setFilters({
												...filters,
												city: value === "all_cities" ? undefined : value,
												area: undefined,
											});
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="All cities" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all_cities">All cities</SelectItem>
											{availableFilters.cities.map((c) => (
												<SelectItem key={c.id} value={c.id}>
													{c.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								{/* Area Filter */}
								<div className="space-y-2">
									<Label>Area</Label>
									<Select
										value={filters.area || "all_areas"}
										onValueChange={(value) => {
											setFilters({
												...filters,
												area: value === "all_areas" ? undefined : value,
											});
										}}
										disabled={!filters.city || filters.city === "all_cities"}
									>
										<SelectTrigger>
											<SelectValue
												placeholder={
													filters.city && filters.city !== "all_cities"
														? "All areas"
														: "Select city first"
												}
											/>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all_areas">All areas</SelectItem>
											{filters.city &&
												availableFilters.cities
													.find((c) => c.id === filters.city)
													?.areas.map((a: string) => (
														<SelectItem key={a} value={a}>
															{a}
														</SelectItem>
													))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Results */}
			<div className="container mx-auto px-4 py-6">
				{/* Results Stats */}
				<div className="mb-4 text-sm text-muted-foreground">
					{loading
						? "Searching..."
						: `${totalResults} ${searchMode === "doctors" ? "doctors" : "pharmacies"} found`}
				</div>

				{/* Doctors Results with Pagination */}
				{searchMode === "doctors" && doctors.length > 0 && (
					<>
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{doctors
								.slice(
									(currentPage - 1) * itemsPerPage,
									currentPage * itemsPerPage,
								)
								.map((doctor) => (
									<DoctorCard key={doctor.id} doctor={doctor} />
								))}
						</div>
						<Pagination
							currentPage={currentPage}
							totalItems={doctors.length}
							itemsPerPage={itemsPerPage}
							onPageChange={setCurrentPage}
						/>
					</>
				)}

				{/* Pharmacy Results with Pagination */}
				{searchMode === "pharmacy" && pharmacies.length > 0 && (
					<>
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{pharmacies
								.slice(
									(currentPage - 1) * itemsPerPage,
									currentPage * itemsPerPage,
								)
								.map((pharmacy) => (
									<PharmacyCard key={pharmacy.id} pharmacy={pharmacy} />
								))}
						</div>
						<Pagination
							currentPage={currentPage}
							totalItems={pharmacies.length}
							itemsPerPage={itemsPerPage}
							onPageChange={setCurrentPage}
						/>
					</>
				)}

				{/* Empty State */}
				{!loading && totalResults === 0 && (
					<div className="text-center py-12">
						<Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
						<h3 className="text-lg font-semibold mb-2">
							No {searchMode} found
						</h3>
						<p className="text-muted-foreground">
							Try adjusting your search terms or filters
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

function DoctorCard({ doctor }: { doctor: Doctor }) {
	// Create URL-safe username from full_name
	const username =
		doctor.full_name?.toLowerCase().replace(/\s+/g, "-") || doctor.id;

	// Get first branch location
	const firstBranch = doctor.branches?.[0];
	const branchLocation = firstBranch
		? [firstBranch.area, firstBranch.city].filter(Boolean).join(", ")
		: [doctor.area, doctor.city].filter(Boolean).join(", ");

	return (
		<Link to="/dr/$username" params={{ username }}>
			<Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
				<CardContent className="p-4">
					<div className="flex items-start gap-4">
						<Avatar className="h-16 w-16 rounded-lg">
							<AvatarImage
								src={doctor.photo_url || undefined}
								className="rounded-lg"
							/>
							<AvatarFallback className="text-lg rounded-lg bg-primary text-white">
								{doctor.full_name?.charAt(0).toUpperCase() || "D"}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<h3 className="font-semibold text-base truncate">
								{doctor.full_name}
							</h3>
							<div className="mt-1">
								{/* Same badge styling for both verified and pending */}
								<Badge variant="secondary" className="text-xs">
									{doctor.verification_status === "verified" ? (
										<>
											<CheckCircle className="h-3 w-3 mr-1" />
											Verified
										</>
									) : (
										<>
											<Clock className="h-3 w-3 mr-1" />
											Pending Verification
										</>
									)}
								</Badge>
							</div>
						</div>
					</div>

					<Separator className="my-3" />

					<div className="space-y-2 text-sm">
						{/* Specialty */}
						{doctor.specialty && (
							<div className="flex items-center gap-2 text-muted-foreground">
								<Stethoscope className="h-4 w-4 flex-shrink-0" />
								<span className="font-medium text-foreground">
									{doctor.specialty}
								</span>
							</div>
						)}

						{/* First Branch Location */}
						{branchLocation && (
							<div className="flex items-center gap-2 text-muted-foreground">
								<MapPin className="h-4 w-4 flex-shrink-0" />
								<span className="font-medium text-foreground">
									{branchLocation}
								</span>
							</div>
						)}

						{/* Experience */}
						{doctor.years_of_experience && (
							<div className="flex items-center gap-2 text-muted-foreground">
								<Award className="h-4 w-4 flex-shrink-0" />
								<span>{doctor.years_of_experience} years experience</span>
							</div>
						)}

						{/* Chevron */}
						<div className="pt-1 flex items-center justify-end">
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						</div>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}

// Pagination Component
function Pagination({
	currentPage,
	totalItems,
	itemsPerPage,
	onPageChange,
}: {
	currentPage: number;
	totalItems: number;
	itemsPerPage: number;
	onPageChange: (page: number) => void;
}) {
	const totalPages = Math.ceil(totalItems / itemsPerPage);

	if (totalPages <= 1) return null;

	const getPageNumbers = () => {
		const pages: (number | string)[] = [];

		if (totalPages <= 7) {
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			if (currentPage <= 4) {
				for (let i = 1; i <= 5; i++) {
					pages.push(i);
				}
				pages.push("ellipsis-end");
				pages.push(totalPages);
			} else if (currentPage >= totalPages - 3) {
				pages.push(1);
				pages.push("ellipsis-start");
				for (let i = totalPages - 4; i <= totalPages; i++) {
					pages.push(i);
				}
			} else {
				pages.push(1);
				pages.push("ellipsis-start");
				for (let i = currentPage - 1; i <= currentPage + 1; i++) {
					pages.push(i);
				}
				pages.push("ellipsis-end");
				pages.push(totalPages);
			}
		}

		return pages;
	};

	return (
		<div className="flex items-center justify-center gap-2 mt-8">
			<span className="text-sm text-muted-foreground mr-4">
				Page {currentPage} of {totalPages}
			</span>

			{/* First page */}
			<Button
				variant="outline"
				size="icon"
				className="h-8 w-8"
				onClick={() => onPageChange(1)}
				disabled={currentPage === 1}
			>
				<span className="text-xs">«</span>
			</Button>

			{/* Previous page */}
			<Button
				variant="outline"
				size="icon"
				className="h-8 w-8"
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage === 1}
			>
				<span className="text-xs">‹</span>
			</Button>

			{/* Page numbers */}
			{getPageNumbers().map((page) => (
				<div key={page}>
					{typeof page === "string" ? (
						<span className="px-2 text-muted-foreground">...</span>
					) : (
						<Button
							variant={currentPage === page ? "default" : "outline"}
							size="icon"
							className="h-8 w-8"
							onClick={() => onPageChange(page as number)}
						>
							<span className="text-xs">{page}</span>
						</Button>
					)}
				</div>
			))}

			{/* Next page */}
			<Button
				variant="outline"
				size="icon"
				className="h-8 w-8"
				onClick={() => onPageChange(currentPage + 1)}
				disabled={currentPage === totalPages}
			>
				<span className="text-xs">›</span>
			</Button>

			{/* Last page */}
			<Button
				variant="outline"
				size="icon"
				className="h-8 w-8"
				onClick={() => onPageChange(totalPages)}
				disabled={currentPage === totalPages}
			>
				<span className="text-xs">»</span>
			</Button>
		</div>
	);
}

function PharmacyCard({ pharmacy }: { pharmacy: Pharmacy }) {
	// Create URL-safe username from facility_name
	const username =
		pharmacy.facility_name?.toLowerCase().replace(/\s+/g, "-") || pharmacy.id;

	return (
		<Link to="/ph/$username" params={{ username }}>
			<Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
				<CardContent className="p-4">
					<div className="flex items-start gap-4">
						<Avatar className="h-16 w-16 rounded-lg">
							<AvatarImage
								src={pharmacy.photo_url || undefined}
								className="rounded-lg"
							/>
							<AvatarFallback className="text-lg rounded-lg bg-blue-500 text-white">
								{pharmacy.facility_name?.charAt(0).toUpperCase() || "P"}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<h3 className="font-semibold text-base truncate">
								{pharmacy.facility_name}
							</h3>
							<div className="mt-1">
								{pharmacy.status === "verified" ? (
									<Badge variant="default" className="bg-green-500 text-xs">
										<CheckCircle className="h-3 w-3 mr-1" />
										Verified
									</Badge>
								) : (
									<Badge variant="secondary" className="text-xs">
										<Clock className="h-3 w-3 mr-1" />
										Pending Verification
									</Badge>
								)}
							</div>
						</div>
					</div>

					<Separator className="my-3" />

					<div className="space-y-2 text-sm">
						{/* City and Area */}
						<div className="flex items-center gap-2 text-muted-foreground">
							<MapPin className="h-4 w-4 flex-shrink-0" />
							<span className="font-medium text-foreground">
								{[pharmacy.area, pharmacy.city].filter(Boolean).join(", ") ||
									"Location not specified"}
							</span>
						</div>

						{/* Full Address */}
						{pharmacy.address && (
							<div className="flex items-start gap-2 text-muted-foreground">
								<Building2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
								<span className="line-clamp-2">{pharmacy.address}</span>
							</div>
						)}

						{/* Facility Type Badge */}
						{pharmacy.facility_type && (
							<div className="pt-1 flex items-center justify-between">
								<Badge variant="outline" className="text-xs">
									{pharmacy.facility_type}
								</Badge>
								<ChevronRight className="h-4 w-4 text-muted-foreground" />
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}

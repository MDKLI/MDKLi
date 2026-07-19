import { MeiliSearch } from "meilisearch";

const MEILI_HOST = process.env.MEILI_HOST || "http://meilisearch:7700";
const MEILI_API_KEY = process.env.MEILI_API_KEY || "masterKey";

export const meiliClient = new MeiliSearch({
	host: MEILI_HOST,
	apiKey: MEILI_API_KEY,
});

export const DOCTORS_INDEX = "doctors";
export const FACILITIES_INDEX = "facilities";

// Initialize indexes with settings
export async function initializeIndexes() {
	try {
		// Create or get doctors index
		try {
			await meiliClient.getIndex(DOCTORS_INDEX);
		} catch {
			await meiliClient.createIndex(DOCTORS_INDEX, { primaryKey: "id" });
		}
		const doctorsIndex = meiliClient.index(DOCTORS_INDEX);

		// Configure doctors index settings
		await doctorsIndex.updateSettings({
			searchableAttributes: [
				"full_name",
				"title",
				"specialty",
				"description",
				"gender",
			],
			filterableAttributes: [
				"gender",
				"title",
				"specialty",
				"years_of_experience",
				"has_private_practice",
				"verification_status",
				"is_blocked",
			],
			sortableAttributes: ["full_name", "years_of_experience", "created_at"],
			rankingRules: [
				"words",
				"typo",
				"proximity",
				"attribute",
				"sort",
				"exactness",
			],
		});

		// Create or get facilities index
		try {
			await meiliClient.getIndex(FACILITIES_INDEX);
		} catch {
			await meiliClient.createIndex(FACILITIES_INDEX, { primaryKey: "id" });
		}
		const facilitiesIndex = meiliClient.index(FACILITIES_INDEX);

		// Configure facilities index settings
		await facilitiesIndex.updateSettings({
			searchableAttributes: ["facility_name", "description", "address", "city"],
			filterableAttributes: [
				"facility_type",
				"facility_role",
				"status",
				"city",
				"area",
				"is_blocked",
			],
			sortableAttributes: ["facility_name", "created_at"],
			rankingRules: [
				"words",
				"typo",
				"proximity",
				"attribute",
				"sort",
				"exactness",
			],
		});

		console.log("✅ Meilisearch indexes initialized successfully");
	} catch (error) {
		console.error("❌ Failed to initialize Meilisearch indexes:", error);
		throw error;
	}
}

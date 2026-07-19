export interface City {
	id: string;
	name: string;
	areas: string[];
}

export const cities: City[] = [
	{
		id: "cairo",
		name: "Cairo",
		areas: [
			"Nasr City",
			"Heliopolis",
			"New Cairo",
			"Maadi",
			"Mokattam",
			"Shorouk",
			"Badr City",
			"El Rehab",
			"Madinaty",
			"Zamalek",
			"Downtown",
			"Garden City",
			"Ain Shams",
			"El Marg",
			"El Salam",
			"El Nozha",
			"Abbassia",
			"Ramses",
			"Helwan",
			"Dar El Salam",
			"Basatin",
			"Shubra",
		],
	},
	{
		id: "giza",
		name: "Giza",
		areas: [
			"Dokki",
			"Mohandessin",
			"Haram",
			"Faisal",
			"Sheikh Zayed",
			"6th of October",
			"Agouza",
			"Imbaba",
			"Bulaq El Dakrour",
			"Giza Square",
			"Hadayek Al Ahram",
			"Kerdasa",
			"Oseem",
		],
	},
	{
		id: "alexandria",
		name: "Alexandria",
		areas: [
			"Smouha",
			"Sidi Gaber",
			"Sporting",
			"Stanley",
			"Miami",
			"Mandara",
			"Agami",
			"Borg El Arab",
			"Gleem",
			"Louran",
			"Raml Station",
		],
	},
	{
		id: "qalyubia",
		name: "Qalyubia",
		areas: [
			"Shubra El Kheima",
			"Banha",
			"Qalyub",
			"Obour",
			"Khanka",
			"Toukh",
			"Kafr Shukr",
		],
	},
	{
		id: "sharqia",
		name: "Sharqia",
		areas: [
			"Zagazig",
			"10th of Ramadan",
			"Belbeis",
			"Minya El Qamh",
			"Abu Hammad",
		],
	},
	{
		id: "dakahlia",
		name: "Dakahlia",
		areas: ["Mansoura", "Mit Ghamr", "Talkha", "Aga", "Belqas"],
	},
	{
		id: "gharbia",
		name: "Gharbia",
		areas: ["Tanta", "El Mahalla El Kubra", "Kafr El Zayat", "Zefta"],
	},
	{
		id: "beheira",
		name: "Beheira",
		areas: ["Damanhour", "Kafr El Dawwar", "Rashid", "Edku"],
	},
	{
		id: "kafr-el-sheikh",
		name: "Kafr El Sheikh",
		areas: ["Kafr El Sheikh", "Desouk", "Baltim"],
	},
	{
		id: "monufia",
		name: "Monufia",
		areas: ["Shebin El Kom", "Menouf", "Ashmoun", "Sadat City"],
	},
	{
		id: "ismailia",
		name: "Ismailia",
		areas: ["Ismailia City", "Fayed", "Abu Suwir"],
	},
	{
		id: "port-said",
		name: "Port Said",
		areas: ["Port Said", "Port Fouad"],
	},
	{
		id: "suez",
		name: "Suez",
		areas: ["Suez", "Ataqa"],
	},
	{
		id: "fayoum",
		name: "Fayoum",
		areas: ["Fayoum City", "Senuris", "Etsa"],
	},
	{
		id: "beni-suef",
		name: "Beni Suef",
		areas: ["Beni Suef City", "El Wasta", "Nasser"],
	},
	{
		id: "minya",
		name: "Minya",
		areas: ["Minya City", "Mallawi", "Samalut"],
	},
	{
		id: "assiut",
		name: "Assiut",
		areas: ["Assiut City", "Dairut", "Abnoub"],
	},
	{
		id: "sohag",
		name: "Sohag",
		areas: ["Sohag City", "Akhmim", "Tahta"],
	},
	{
		id: "qena",
		name: "Qena",
		areas: ["Qena City", "Nag Hammadi", "Qus"],
	},
	{
		id: "luxor",
		name: "Luxor",
		areas: ["Luxor City", "Armant", "Esna"],
	},
	{
		id: "aswan",
		name: "Aswan",
		areas: ["Aswan City", "Kom Ombo", "Edfu"],
	},
	{
		id: "red-sea",
		name: "Red Sea",
		areas: ["Hurghada", "El Gouna", "Safaga", "Marsa Alam"],
	},
	{
		id: "south-sinai",
		name: "South Sinai",
		areas: ["Sharm El Sheikh", "Dahab", "Nuweiba", "El Tor"],
	},
	{
		id: "north-sinai",
		name: "North Sinai",
		areas: ["Arish", "Sheikh Zuweid", "Rafah"],
	},
	{
		id: "matrouh",
		name: "Matrouh",
		areas: ["Marsa Matrouh", "El Alamein", "Siwa"],
	},
];

export const getCityById = (id: string): City | undefined => {
	return cities.find((city) => city.id === id);
};

export const getAreasByCity = (cityId: string): string[] => {
	const city = cities.find((c) => c.id === cityId);
	return city?.areas || [];
};

// Specializations for doctors
export const specializations = [
	"Cardiology",
	"Dermatology",
	"Endocrinology",
	"Gastroenterology",
	"General Practice",
	"Internal Medicine",
	"Neurology",
	"Obstetrics & Gynecology",
	"Oncology",
	"Ophthalmology",
	"Orthopedics",
	"Otolaryngology (ENT)",
	"Pediatrics",
	"Psychiatry",
	"Pulmonology",
	"Radiology",
	"Rheumatology",
	"Surgery",
	"Urology",
	"Dental",
	"Other",
];

// Spoken languages
export const spokenLanguages = [
	"Arabic",
	"English",
	"French",
	"German",
	"Spanish",
	"Italian",
];

// Weekdays
export const weekdays = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
];

// Insurance providers
export const insuranceProviders = [
	"AXA",
	"Allianz",
	"Bupa",
	"MetLife",
	"Misr Insurance",
	"Mohandes Insurance",
	"Other",
];

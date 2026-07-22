import { DataSource } from "typeorm";
import { SearchableDoctor } from "./entities/SearchableDoctor";
import { SearchableFacility } from "./entities/SearchableFacility";

export const AppDataSource = new DataSource({
	type: "postgres",
	host: process.env.DB_HOST || "postgres",
	port: parseInt(process.env.DB_PORT || "5432"),
	username: process.env.DB_USERNAME || "postgres",
	password: process.env.DB_PASSWORD || "postgres",
	database: process.env.DB_NAME || "searchdb",
	synchronize: true,
	logging: process.env.NODE_ENV === "development",
	entities: [SearchableDoctor, SearchableFacility],
	migrations: [],
	subscribers: [],
});

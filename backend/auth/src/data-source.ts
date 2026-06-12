import { DataSource } from "typeorm";
import * as dotenv from 'dotenv';
import path from "path";
dotenv.config();
export const AppDataSource = new DataSource({
  type: "postgres", 
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || process.env.DB_DATABASE || "postgres",
  synchronize: false,
  logging: false,
  entities: [
    process.env.NODE_ENV === "production"
      ? path.join(__dirname, "entity/**/*.js")
      : path.join(__dirname, "src/entity/**/*.ts")
  ],
  migrations: [
    process.env.NODE_ENV === "production"
      ? path.join(__dirname, "migration/**/*.js")
      : path.join(__dirname, "src/migration/**/*.ts")
  ],
  subscribers: [],
});

const { Client } = require("pg");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
	datasources: {
		db: {
			url:
				process.env.DATABASE_URL ||
				"postgresql://postgres:postgres@localhost:5432/bookingdb",
		},
	},
});

// Auth database connection
const authClient = new Client({
	host: process.env.AUTH_DB_HOST || "localhost",
	port: process.env.AUTH_DB_PORT || 5432,
	user: process.env.AUTH_DB_USER || "postgres",
	password: process.env.AUTH_DB_PASSWORD || "postgres",
	database: process.env.AUTH_DB_NAME || "authdb",
});

async function syncBranches() {
	try {
		await authClient.connect();
		console.log("Connected to auth database");

		// Get all branches with their user info
		const branchesResult = await authClient.query(`
      SELECT b.*, u.email, u.role
      FROM branches b
      JOIN users u ON b.user_id = u.id
      WHERE u.role = 'doctor'
    `);

		console.log(`Found ${branchesResult.rows.length} branches to sync`);

		// Get all doctors from booking service
		const doctors = await prisma.doctor.findMany();
		const doctorMap = new Map(doctors.map((d) => [d.userId, d]));

		let syncedCount = 0;
		let skippedCount = 0;

		for (const branch of branchesResult.rows) {
			const doctor = doctorMap.get(branch.user_id);

			if (!doctor) {
				console.log(
					`Skipping branch ${branch.id}: Doctor not found for user ${branch.user_id}`,
				);
				skippedCount++;
				continue;
			}

			// Upsert branch
			await prisma.branch.upsert({
				where: { id: branch.id },
				update: {
					name: branch.name || "Unknown Branch",
					address: branch.address || null,
					isVirtual: false,
					isActive: true,
				},
				create: {
					id: branch.id,
					doctorId: doctor.id,
					name: branch.name || "Unknown Branch",
					address: branch.address || null,
					isVirtual: false,
					isActive: true,
					timezone: "UTC",
				},
			});

			syncedCount++;
			console.log(
				`Synced branch: ${branch.name} (${branch.id}) for doctor: ${doctor.name}`,
			);
		}

		console.log(`\nSync complete:`);
		console.log(`- Synced: ${syncedCount}`);
		console.log(`- Skipped: ${skippedCount}`);
		console.log(`- Total: ${branchesResult.rows.length}`);
	} catch (error) {
		console.error("Sync error:", error);
	} finally {
		await authClient.end();
		await prisma.$disconnect();
	}
}

syncBranches();

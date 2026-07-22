const { Client } = require("pg");

const authConfig = {
	host: process.env.AUTH_DB_HOST || "postgres",
	port: 5432,
	user: "postgres",
	password: "postgres",
	database: "authdb",
};

const chatConfig = {
	host: process.env.CHAT_DB_HOST || "postgres",
	port: 5432,
	user: "postgres",
	password: "postgres",
	database: "chatdb",
};

async function upsertUser(chatClient, { id, name, photoUrl, role, about }) {
	await chatClient.query(
		`INSERT INTO users (id, name, photo_url, role, about, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       photo_url = EXCLUDED.photo_url,
       role = EXCLUDED.role,
       about = EXCLUDED.about,
       updated_at = NOW()`,
		[id, name, photoUrl, role, about],
	);
}

async function sync() {
	const authClient = new Client(authConfig);
	const chatClient = new Client(chatConfig);

	try {
		await authClient.connect();
		await chatClient.connect();
		console.log("Connected to both databases");

		// Patients
		const patients = await authClient.query(`
      SELECT p.user_id, p.full_name, p.photo_url, u.email
      FROM patient_profiles p
      JOIN users u ON p.user_id = u.id
      WHERE u.role = 'patient'
    `);
		for (const p of patients.rows) {
			await upsertUser(chatClient, {
				id: p.user_id,
				name: p.full_name || p.email || "Unknown",
				photoUrl: p.photo_url,
				role: "patient",
				about: null,
			});
		}
		console.log(`Synced ${patients.rows.length} patients`);

		// Doctors
		const doctors = await authClient.query(`
      SELECT d.user_id, d.full_name, d.photo_url, d.specialty
      FROM doctors d
    `);
		for (const d of doctors.rows) {
			await upsertUser(chatClient, {
				id: d.user_id,
				name: d.full_name,
				photoUrl: d.photo_url,
				role: "doctor",
				about: d.specialty,
			});
		}
		console.log(`Synced ${doctors.rows.length} doctors`);

		// Clinics (hospitals/centers)
		const clinics = await authClient.query(`
      SELECT c.user_id, c.clinic_name, c.photo_url, c.description, c.facility_type
      FROM clinic_profiles c
    `);
		for (const c of clinics.rows) {
			await upsertUser(chatClient, {
				id: c.user_id,
				name: c.clinic_name || "Unnamed Facility",
				photoUrl: c.photo_url,
				role: c.facility_type || "clinic",
				about: c.description,
			});
		}
		console.log(`Synced ${clinics.rows.length} clinics`);

		// Pharmacies
		const pharmacies = await authClient.query(`
      SELECT ph.user_id, ph.pharmacy_name, ph.photo_url, ph.description
      FROM pharmacy_profiles ph
    `);
		for (const ph of pharmacies.rows) {
			await upsertUser(chatClient, {
				id: ph.user_id,
				name: ph.pharmacy_name || "Unnamed Pharmacy",
				photoUrl: ph.photo_url,
				role: "pharmacy",
				about: ph.description,
			});
		}
		console.log(`Synced ${pharmacies.rows.length} pharmacies`);

		console.log("=== Chat user sync complete ===");
	} catch (error) {
		console.error("Sync error:", error);
	} finally {
		await authClient.end();
		await chatClient.end();
	}
}

sync();

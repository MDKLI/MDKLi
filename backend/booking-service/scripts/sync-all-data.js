const { Client } = require('pg');

const authConfig = {
  host: process.env.AUTH_DB_HOST || 'postgres',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'authdb'
};

const bookingConfig = {
  host: process.env.BOOKING_DB_HOST || 'postgres',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'bookingdb'
};

async function syncData() {
  const authClient = new Client(authConfig);
  const bookingClient = new Client(bookingConfig);
  
  try {
    await authClient.connect();
    await bookingClient.connect();
    console.log('Connected to both databases');
    
    // Get all doctors from auth
    const doctorsResult = await authClient.query(`
      SELECT d.id, d.user_id, d.full_name, d.specialty, u.email
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      WHERE u.role = 'doctor'
    `);
    
    console.log(`Found ${doctorsResult.rows.length} doctors in auth database`);
    
    let syncedDoctors = 0;
    let syncedBranches = 0;
    const doctorUserIds = new Set();
    
    for (const doctor of doctorsResult.rows) {
      doctorUserIds.add(doctor.user_id);
      // Check if doctor exists in booking
      const existingDoctor = await bookingClient.query(
        'SELECT id FROM doctors WHERE user_id = $1',
        [doctor.user_id]
      );
      
      let bookingDoctorId;
      
      if (existingDoctor.rows.length === 0) {
        // Insert doctor
        const insertResult = await bookingClient.query(
          `INSERT INTO doctors (id, user_id, name, specialization, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())
           RETURNING id`,
          [doctor.id, doctor.user_id, doctor.full_name || 'Unknown Doctor', doctor.specialty]
        );
        bookingDoctorId = insertResult.rows[0].id;
        syncedDoctors++;
        console.log(`✓ Synced doctor: ${doctor.full_name || doctor.email}`);
      } else {
        bookingDoctorId = existingDoctor.rows[0].id;
        console.log(`  Doctor already exists: ${doctor.full_name || doctor.email}`);
      }
      
      // Get branches for this doctor - full field set, matching what RabbitMQ's
      // branch.created/branch.updated events carry (see handleBranchEvent)
      const branchesResult = await authClient.query(
        `SELECT id, name, address, city, area, phone_numbers, consultation_fee, media_urls
         FROM branches WHERE user_id = $1`,
        [doctor.user_id]
      );
      
      for (const branch of branchesResult.rows) {
        // Upsert so this script self-heals any branch that was previously synced
        // with partial fields (e.g. from an older version of this script, or a
        // dropped RabbitMQ event) instead of permanently skipping it once it exists.
        await bookingClient.query(
          `INSERT INTO branches (id, doctor_id, name, address, city, area, phone_numbers, consultation_fee, media_urls, is_virtual, timezone, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, 'UTC', true, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             address = EXCLUDED.address,
             city = EXCLUDED.city,
             area = EXCLUDED.area,
             phone_numbers = EXCLUDED.phone_numbers,
             consultation_fee = EXCLUDED.consultation_fee,
             media_urls = EXCLUDED.media_urls,
             updated_at = NOW()`,
          [
            branch.id,
            bookingDoctorId,
            branch.name,
            branch.address,
            branch.city || null,
            branch.area || null,
            branch.phone_numbers || [],
            branch.consultation_fee || null,
            branch.media_urls || [],
          ]
        );
        syncedBranches++;
        console.log(`  ✓ Synced branch: ${branch.name}`);
      }
    }

    // Second pass: facility-owned branches. auth's branches table is generic on
    // user_id (not doctor-specific) — a branch invited-into by a facility has
    // user_id pointing at the facility's own user account, not any doctor's.
    // The loop above only ever queried branches per known doctor.user_id, so these
    // were never synced at all. Catch every remaining auth branch here instead.
    const allAuthBranches = await authClient.query(
      `SELECT id, name, address, user_id, city, area, phone_numbers, consultation_fee, media_urls
       FROM branches`
    );

    let syncedFacilityBranches = 0;

    for (const branch of allAuthBranches.rows) {
      if (doctorUserIds.has(branch.user_id)) {
        // Already handled (or will be) by the per-doctor loop above
        continue;
      }

      await bookingClient.query(
        `INSERT INTO branches (id, doctor_id, owner_user_id, name, address, city, area, phone_numbers, consultation_fee, media_urls, is_virtual, timezone, is_active, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, false, 'UTC', true, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           owner_user_id = EXCLUDED.owner_user_id,
           name = EXCLUDED.name,
           address = EXCLUDED.address,
           city = EXCLUDED.city,
           area = EXCLUDED.area,
           phone_numbers = EXCLUDED.phone_numbers,
           consultation_fee = EXCLUDED.consultation_fee,
           media_urls = EXCLUDED.media_urls,
           updated_at = NOW()`,
        [
          branch.id,
          branch.user_id,
          branch.name,
          branch.address,
          branch.city || null,
          branch.area || null,
          branch.phone_numbers || [],
          branch.consultation_fee || null,
          branch.media_urls || [],
        ]
      );
      syncedFacilityBranches++;
      console.log(`  ✓ Synced facility branch: ${branch.name}`);
    }

    // Sync patients
    const patientsResult = await authClient.query(`
      SELECT p.id, p.user_id, p.full_name, u.email
      FROM patient_profiles p
      JOIN users u ON p.user_id = u.id
      WHERE u.role = 'patient'
    `);

    console.log(`Found ${patientsResult.rows.length} patients in auth database`);

    let syncedPatients = 0;

    for (const patient of patientsResult.rows) {
      const existingPatient = await bookingClient.query(
        'SELECT id FROM patients WHERE user_id = $1',
        [patient.user_id]
      );

      if (existingPatient.rows.length === 0) {
        await bookingClient.query(
          `INSERT INTO patients (id, user_id, email, name, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [patient.id, patient.user_id, patient.email, patient.full_name || 'Unknown Patient']
        );
        syncedPatients++;
        console.log(`✓ Synced patient: ${patient.full_name || patient.email}`);
      } else {
        console.log(`  Patient already exists: ${patient.full_name || patient.email}`);
      }
    }

    console.log(`\n=== Sync Complete ===`);
    console.log(`Synced ${syncedDoctors} new doctors`);
    console.log(`Synced ${syncedBranches} new branches`);
    console.log(`Synced ${syncedFacilityBranches} new facility branches`);
    console.log(`Synced ${syncedPatients} new patients`);
    console.log(`Total doctors in booking: ${doctorsResult.rows.length}`);
    
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    await authClient.end();
    await bookingClient.end();
  }
}

syncData();

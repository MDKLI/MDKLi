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
      
      // Get branches for this doctor
      const branchesResult = await authClient.query(
        'SELECT id, name, address FROM branches WHERE user_id = $1',
        [doctor.user_id]
      );
      
      for (const branch of branchesResult.rows) {
        // Check if branch exists in booking
        const existingBranch = await bookingClient.query(
          'SELECT id FROM branches WHERE id = $1',
          [branch.id]
        );
        
        if (existingBranch.rows.length === 0) {
          // Insert branch
          await bookingClient.query(
            `INSERT INTO branches (id, doctor_id, name, address, is_virtual, timezone, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, false, 'UTC', true, NOW(), NOW())`,
            [branch.id, bookingDoctorId, branch.name, branch.address]
          );
          syncedBranches++;
          console.log(`  ✓ Synced branch: ${branch.name}`);
        } else {
          console.log(`    Branch already exists: ${branch.name}`);
        }
      }
    }

    // Second pass: facility-owned branches. auth's branches table is generic on
    // user_id (not doctor-specific) — a branch invited-into by a facility has
    // user_id pointing at the facility's own user account, not any doctor's.
    // The loop above only ever queried branches per known doctor.user_id, so these
    // were never synced at all. Catch every remaining auth branch here instead.
    const allAuthBranches = await authClient.query(
      'SELECT id, name, address, user_id FROM branches'
    );

    let syncedFacilityBranches = 0;

    for (const branch of allAuthBranches.rows) {
      if (doctorUserIds.has(branch.user_id)) {
        // Already handled (or will be) by the per-doctor loop above
        continue;
      }

      const existingBranch = await bookingClient.query(
        'SELECT id FROM branches WHERE id = $1',
        [branch.id]
      );

      if (existingBranch.rows.length === 0) {
        await bookingClient.query(
          `INSERT INTO branches (id, doctor_id, owner_user_id, name, address, is_virtual, timezone, is_active, created_at, updated_at)
           VALUES ($1, NULL, $2, $3, $4, false, 'UTC', true, NOW(), NOW())`,
          [branch.id, branch.user_id, branch.name, branch.address]
        );
        syncedFacilityBranches++;
        console.log(`  ✓ Synced facility branch: ${branch.name}`);
      } else {
        console.log(`    Facility branch already exists: ${branch.name}`);
      }
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

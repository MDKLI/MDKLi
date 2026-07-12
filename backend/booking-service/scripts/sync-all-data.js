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
    
    for (const doctor of doctorsResult.rows) {
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
    
    console.log(`\n=== Sync Complete ===`);
    console.log(`Synced ${syncedDoctors} new doctors`);
    console.log(`Synced ${syncedBranches} new branches`);
    console.log(`Total doctors in booking: ${doctorsResult.rows.length}`);
    
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    await authClient.end();
    await bookingClient.end();
  }
}

syncData();

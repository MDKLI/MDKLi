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

async function sync() {
  const authClient = new Client(authConfig);
  const bookingClient = new Client(bookingConfig);

  try {
    await authClient.connect();
    await bookingClient.connect();
    console.log('Connected to both databases');

    // Every accepted invitation branch = one doctor-branch assignment
    const rows = await authClient.query(`
      SELECT
        dbi.doctor_id AS auth_doctor_id,
        d.user_id AS doctor_user_id,
        dbib.branch_id,
        dbib."consultationFee" AS consultation_fee
      FROM doctor_branch_invitations dbi
      JOIN doctor_branch_invitation_branches dbib ON dbib.invitation_id = dbi.id
      JOIN doctors d ON d.id = dbi.doctor_id
      WHERE dbi.status = 'accepted'
    `);

    console.log(`Found ${rows.rows.length} accepted invitation-branch pairs in auth database`);

    let synced = 0;
    let skippedNoDoctor = 0;
    let skippedNoBranch = 0;

    for (const row of rows.rows) {
      const doctorResult = await bookingClient.query(
        'SELECT id FROM doctors WHERE user_id = $1',
        [row.doctor_user_id]
      );
      if (doctorResult.rows.length === 0) {
        console.log(`  Skipped: no booking-service doctor for userId ${row.doctor_user_id}`);
        skippedNoDoctor++;
        continue;
      }
      const bookingDoctorId = doctorResult.rows[0].id;

      const branchResult = await bookingClient.query(
        'SELECT id FROM branches WHERE id = $1',
        [row.branch_id]
      );
      if (branchResult.rows.length === 0) {
        console.log(`  Skipped: branch ${row.branch_id} not found in booking-service`);
        skippedNoBranch++;
        continue;
      }

      const parsedFee = row.consultation_fee !== null && row.consultation_fee !== undefined
        ? Math.round(parseFloat(row.consultation_fee))
        : null;

      await bookingClient.query(
        `INSERT INTO branch_assignments (id, branch_id, doctor_id, consultation_fee, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
         ON CONFLICT (branch_id, doctor_id) DO UPDATE SET
           consultation_fee = EXCLUDED.consultation_fee,
           is_active = true,
           updated_at = NOW()`,
        [row.branch_id, bookingDoctorId, parsedFee]
      );
      synced++;
      console.log(`  ✓ Assigned doctor ${bookingDoctorId} to branch ${row.branch_id}`);
    }

    console.log(`\n=== Sync Complete ===`);
    console.log(`Synced: ${synced}`);
    console.log(`Skipped (no booking-service doctor yet): ${skippedNoDoctor}`);
    console.log(`Skipped (branch not synced yet): ${skippedNoBranch}`);
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    await authClient.end();
    await bookingClient.end();
  }
}

sync();

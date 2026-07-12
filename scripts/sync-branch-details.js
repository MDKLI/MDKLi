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
    
    // Get all branches from auth with all fields
    const branchesResult = await authClient.query(`
      SELECT 
        b.id,
        b.name,
        b.address,
        b.city,
        b.area,
        b.phone_numbers,
        b.consultation_fee,
        b.media_urls,
        b.google_maps_url,
        b.latitude,
        b.longitude,
        d.id as doctor_id,
        u.email
      FROM branches b
      JOIN users u ON b.user_id = u.id
      JOIN doctors d ON u.id = d.user_id
      WHERE u.role = 'doctor'
    `);
    
    console.log(`Found ${branchesResult.rows.length} branches in auth database`);
    
    let updatedBranches = 0;
    
    for (const branch of branchesResult.rows) {
      // Update branch with all fields
      const updateResult = await bookingClient.query(`
        UPDATE branches 
        SET 
          city = $1,
          area = $2,
          phone_numbers = $3,
          consultation_fee = $4,
          media_urls = $5,
          google_maps_url = $6,
          latitude = $7,
          longitude = $8
        WHERE id = $9
        RETURNING id
      `, [
        branch.city,
        branch.area,
        branch.phone_numbers || [],
        branch.consultation_fee,
        branch.media_urls || [],
        branch.google_maps_url,
        branch.latitude,
        branch.longitude,
        branch.id
      ]);
      
      if (updateResult.rowCount > 0) {
        updatedBranches++;
        console.log(`✓ Updated branch: ${branch.name} with full data`);
      } else {
        console.log(`  Branch not found in booking: ${branch.name}`);
      }
    }
    
    console.log(`\n=== Sync Complete ===`);
    console.log(`Updated ${updatedBranches} branches with full data`);
    
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    await authClient.end();
    await bookingClient.end();
  }
}

syncData();

const fs = require("fs");
const path = require("path");

const AUTH_URL = process.env.AUTH_SERVICE_URL || "http://auth-service:3000";
const BOOKING_URL = process.env.BOOKING_SERVICE_URL || "http://booking-service:3004";
const CHAT_URL = process.env.CHAT_SERVICE_URL || "http://chat-service:3005";

const DOCTOR_COUNT = parseInt(process.env.DOCTOR_COUNT || "50", 10);
const PHARMACY_COUNT = parseInt(process.env.PHARMACY_COUNT || "50", 10);
const HOSPITAL_COUNT = parseInt(process.env.HOSPITAL_COUNT || "3", 10);
const CENTER_COUNT = parseInt(process.env.CENTER_COUNT || "3", 10);
const PATIENT_COUNT = parseInt(process.env.PATIENT_COUNT || "20", 10);

const PASSWORD = "useruser";
const EMAIL_DOMAIN = "user.user";

// ---------- data pools ----------
const MALE_FIRST_NAMES = [
  "Ahmed","Mohamed","Youssef","Omar","Khaled","Mostafa","Amr","Tarek","Hassan","Mahmoud"
];
const FEMALE_FIRST_NAMES = [
  "Sara","Mona","Nour","Yasmin","Heba","Mai","Salma","Rania","Dina","Farida"
];
const LAST_NAMES = [
  "Hassan","Ibrahim","Mahmoud","Farouk","ElSayed","Abdelrahman","Kamal","Fathy","Saad",
  "Nasser","ElShenawy","Adel","Younes","Ezzat","Ashour"
];
const SPECIALTIES = [
  "cardiology","dermatology","pediatrics","orthopedics","neurology","psychiatry",
  "dentistry","general_surgery","ent","ophthalmology"
];
const CITIES = ["Cairo","Giza","Alexandria","Qalyubia","Mansoura","Tanta"];
const AREAS = ["Downtown","Nasr City","Maadi","Heliopolis","Zamalek","Sheikh Zayed"];
const AGE_BANDS = ["young", "mid", "old"];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------- photo loading ----------
function loadPhotosAsDataUris(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .map((f) => {
      const ext = path.extname(f).slice(1).toLowerCase();
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      const buf = fs.readFileSync(path.join(dir, f));
      return `data:${mime};base64,${buf.toString("base64")}`;
    });
}

const doctorPhotosByGenderAndBand = {
  male: {
    young: loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "doctors", "male", "young")),
    mid:   loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "doctors", "male", "mid")),
    old:   loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "doctors", "male", "old")),
  },
  female: {
    young: loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "doctors", "female", "young")),
    mid:   loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "doctors", "female", "mid")),
    old:   loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "doctors", "female", "old")),
  },
};
const facilityPhotos = loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "facilities"));

for (const gender of ["male", "female"]) {
  for (const band of AGE_BANDS) {
    console.log(`Loaded ${doctorPhotosByGenderAndBand[gender][band].length} ${gender}/${band} doctor photos`);
  }
}
console.log(`Loaded ${facilityPhotos.length} facility photos`);

// ---------- helpers for age/title ----------
function titleForExperience(years) {
  if (years >= 20) return Math.random() < 0.8 ? "prof" : "dr";
  if (years >= 10) return Math.random() < 0.3 ? "prof" : "dr";
  return "dr";
}

function ageBandForExperience(years) {
  if (years >= 18) return "old";
  if (years >= 8)  return "mid";
  return "young";
}

function pickDoctorPhoto(gender, band) {
  const pool = doctorPhotosByGenderAndBand[gender];
  if (pool[band].length) return rand(pool[band]);
  const fallback = AGE_BANDS.map((b) => pool[b]).find((p) => p.length);
  return fallback ? rand(fallback) : "";
}

// ---------- HTTP helper with 429 retry ----------
async function req(url, opts = {}, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
        ...opts,
      });
      if (res.status === 429 && attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!res.ok) return { ok: false, status: res.status, error: data.error || data.message || text };
      return { ok: true, data };
    } catch (err) {
      if (attempt < retries) { await sleep(500); continue; }
      return { ok: false, error: err.message };
    }
  }
  return { ok: false, error: "exhausted retries" };
}


// ---------- registration (returns more info for republishing) ----------
async function registerAccount(username, email, role, onboardingData, extraProfileData = {}) {
  const start = await req(`${AUTH_URL}/auth/register/start`, {
    method: "POST",
    body: JSON.stringify({ username, email, password: PASSWORD, role, profileData: extraProfileData }),
  });
  if (!start.ok) {
    console.error(`  [start] ${email} failed: ${start.error}`);
    return null;
  }
  const pendingToken = start.data.pendingToken;

  const complete = await req(`${AUTH_URL}/auth/register/complete`, {
    method: "POST",
    body: JSON.stringify({ pendingToken, onboardingData }),
  });
  if (!complete.ok) {
    console.error(`  [complete] ${email} failed: ${complete.error}`);
    return null;
  }
  // Return everything needed to publish the correct event
  return {
    userId: complete.data.userId,
    token: complete.data.token,
    role,
    onboardingData,          // the role‑specific profile data
    extraProfileData,
  };
}

// ---------- polling for RabbitMQ sync ----------
async function pollDoctorSynced(userId, retries = 12, intervalMs = 1500) {
  for (let i = 0; i < retries; i++) {
    const res = await req(`${BOOKING_URL}/api/v1/public/doctors/${userId}`);
    if (res.ok && res.data?.data) return res.data.data;
    await sleep(intervalMs);
  }
  return null;
}

async function pollFacilityBranchesSynced(userId, retries = 12, intervalMs = 1500) {
  for (let i = 0; i < retries; i++) {
    const res = await req(`${BOOKING_URL}/api/v1/public/facilities/${userId}/branches`);
    if (res.ok && res.data?.data?.length > 0) return res.data.data;
    await sleep(intervalMs);
  }
  return null;
}

function makeBranch(namePrefix) {
  return {
    name: `${namePrefix} Branch`,
    cityId: rand(CITIES),
    area: rand(AREAS),
    address: `${randInt(1, 200)} ${rand(AREAS)} St.`,
    googleMapsUrl: "",
    phoneNumbers: [`+2010${randInt(10000000, 99999999)}`],
    consultationFee: String(randInt(150, 500)),
    mediaUrls: [],
  };
}

// ---------- seeding steps ----------
async function seedPatients() {
  const patients = [];
  for (let i = 1; i <= PATIENT_COUNT; i++) {
    const first = rand([...MALE_FIRST_NAMES, ...FEMALE_FIRST_NAMES]);
    const last = rand(LAST_NAMES);
    const email = `patient${i}@${EMAIL_DOMAIN}`;
    const acc = await registerAccount(`patient${i}`, email, "patient", {
      full_name: `${first} ${last}`,
      gender: rand(["male", "female"]),
      date_of_birth: `19${randInt(60, 99)}-0${randInt(1, 9)}-1${randInt(0, 9)}`,
    });
    if (acc) {
      patients.push({ ...acc, name: `${first} ${last}`, email });
      console.log(`  patient ${i}/${PATIENT_COUNT} created`);
    }
    await sleep(100);
  }
  return patients;
}

async function seedDoctors() {
  const doctors = [];
  for (let i = 1; i <= DOCTOR_COUNT; i++) {
    const gender = rand(["male", "female"]);
    const first = rand(gender === "male" ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES);
    const last = rand(LAST_NAMES);
    const yearsOfExperience = randInt(1, 30);
    const title = titleForExperience(yearsOfExperience);
    const ageBand = ageBandForExperience(yearsOfExperience);
    const hasPrivatePractice = Math.random() < 0.7;
    const email = `doctor${i}@${EMAIL_DOMAIN}`;
    const branches = hasPrivatePractice ? [makeBranch(`Dr. ${last}`)] : [];

    const onboardingData = {
      full_name: `${title === "prof" ? "Prof." : "Dr."} ${first} ${last}`,
      photo_url: pickDoctorPhoto(gender, ageBand),
      phone_number: `+2010${randInt(10000000, 99999999)}`,
      title,
      specialty: rand(SPECIALTIES),
      years_of_experience: String(yearsOfExperience),
      gender,
      description: `Experienced ${rand(SPECIALTIES).replace("_", " ")} specialist.`,
      has_private_practice: hasPrivatePractice,
      branches,
    };

    const acc = await registerAccount(`doctor${i}`, email, "doctor", onboardingData);
    if (!acc) continue;

    console.log(`  doctor ${i}/${DOCTOR_COUNT} created (${email})`);
    doctors.push({ ...acc, name: `${first} ${last}`, hasPrivatePractice, branchIds: [] });
    await sleep(150);
  }

  // sync + availability for private-practice doctors
  for (const doc of doctors.filter((d) => d.hasPrivatePractice)) {
    const synced = await pollDoctorSynced(doc.userId);
    if (!synced || !synced.branches?.length) {
      console.warn(`  [sync-timeout] doctor ${doc.name} branches never synced, skipping availability/bookings`);
      continue;
    }
    doc.branchIds = synced.branches.map((b) => b.id);
    for (const branchId of doc.branchIds) {
      await req(`${BOOKING_URL}/api/v1/doctor/branches/${branchId}/availability`, {
        method: "PUT",
        body: JSON.stringify({
          doctorId: doc.userId,
          rules: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
            dayOfWeek, startTime: "09:00", endTime: "17:00", slotDurationMinutes: 30,
          })),
        }),
      });
    }
    console.log(`  availability set for Dr. ${doc.name}`);
    await sleep(150);
  }
  return doctors;
}

async function seedFacilities(count, role, facilityType, labelPrefix) {
  const facilities = [];
  // Fix email bug: replace spaces with hyphens
  const safePrefix = labelPrefix.toLowerCase().replace(/\s+/g, '-');
  for (let i = 1; i <= count; i++) {
    const city = rand(CITIES);
    // Pharmacies get a plain, generic name — never "Hospital"/"Center",
    // since facility_type already carries that distinction.
    const rawName =
      facilityType === "pharmacy" ? `${city} Pharmacy ${i}` : `${city} ${labelPrefix} ${i}`;
    const name = rawName.replace(/\b(Hospital|Center|Centre)\b/gi, "").replace(/\s{2,}/g, " ").trim();
    const email = `${safePrefix}${i}@${EMAIL_DOMAIN}`;
    const branchCount = randInt(1, 3);
    const branches = Array.from({ length: branchCount }, () => makeBranch(name));

    const onboardingData = {
      facility_name: name,
      photo_url: facilityPhotos.length ? rand(facilityPhotos) : "",
      phone_numbers: [`+2010${randInt(10000000, 99999999)}`],
      facility_type: facilityType,
      description: `A trusted ${labelPrefix.toLowerCase()} serving the ${city} area.`,
      city,
      address: `${randInt(1, 200)} ${rand(AREAS)} St.`,
      branches,
    };

    const acc = await registerAccount(safePrefix + i, email, role, onboardingData);
    if (!acc) continue;

    console.log(`  ${labelPrefix} ${i}/${count} created (${email})`);
    facilities.push({ ...acc, name });
    await sleep(150);
  }

  // confirm sync (best effort)
  for (const fac of facilities) {
    await pollFacilityBranchesSynced(fac.userId, 6, 1000);
  }
  return facilities;
}

async function seedBookingsAndChats(doctors, patients) {
  if (!patients.length) return;
  const privateDoctors = doctors.filter((d) => d.hasPrivatePractice && d.branchIds.length);

  for (const doc of privateDoctors) {
    const bookingCount = randInt(1, 3);
    for (let b = 0; b < bookingCount; b++) {
      const patient = rand(patients);
      const branchId = doc.branchIds[0];
      const dayOffset = randInt(1, 13);
      const date = new Date(Date.now() + dayOffset * 86400000).toISOString().slice(0, 10);
      const startTime = rand(["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]);
      const [h, m] = startTime.split(":").map(Number);
      const endTime = `${String(h).padStart(2, "0")}:${String(m + 30).padStart(2, "0")}`;

      const booking = await req(`${BOOKING_URL}/api/v1/public/appointments`, {
        method: "POST",
        body: JSON.stringify({
          branchId, doctorId: doc.userId, patientId: patient.userId,
          patientEmail: patient.email, patientName: patient.name,
          date, startTime, endTime, notes: "Seeded sample booking",
        }),
      });
      if (!booking.ok) { console.warn(`  booking failed for ${doc.name}: ${booking.error}`); continue; }

      const appointmentId = booking.data.data.appointmentId;
      await req(`${BOOKING_URL}/api/v1/payment/fake-confirm/${appointmentId}`, { method: "POST", body: "{}" });

      await req(`${CHAT_URL}/rooms/with/${doc.userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${patient.token}` },
      });
      console.log(`  booking + chat room: ${patient.name} <-> Dr. ${doc.name} on ${date}`);
      await sleep(150);
    }
  }
}

async function main() {
  console.log("== Seeding patients ==");
  const patients = await seedPatients();

  console.log("== Seeding doctors ==");
  const doctors = await seedDoctors();

  console.log("== Seeding pharmacies ==");
  await seedFacilities(PHARMACY_COUNT, "pharmacy_admin", "pharmacy", "Pharmacy");

  console.log("== Seeding hospitals ==");
  await seedFacilities(HOSPITAL_COUNT, "clinic_admin", "hospital", "Hospital");

  console.log("== Seeding medical centers ==");
  await seedFacilities(CENTER_COUNT, "clinic_admin", "center", "Medical Center");

  console.log("== Seeding sample bookings + chat rooms ==");
  await seedBookingsAndChats(doctors, patients);

  console.log("== Done ==");
}

main().catch((err) => {
  console.error("Seeder crashed:", err);
  process.exit(1);
});

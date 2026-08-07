const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const AUTH_URL = process.env.AUTH_SERVICE_URL || "http://auth-service:3000";
const BOOKING_URL = process.env.BOOKING_SERVICE_URL || "http://booking-service:3004";
const CHAT_URL = process.env.CHAT_SERVICE_URL || "http://chat-service:3005";

const DOCTOR_COUNT = parseInt(process.env.DOCTOR_COUNT || "50", 10);
const PHARMACY_COUNT = parseInt(process.env.PHARMACY_COUNT || "50", 10);
const HOSPITAL_COUNT = parseInt(process.env.HOSPITAL_COUNT || "3", 10);
const CENTER_COUNT = parseInt(process.env.CENTER_COUNT || "3", 10);
const PATIENT_COUNT = parseInt(process.env.PATIENT_COUNT || "20", 10);
const DOCTOR_PRIVATE_PRACTICE_RATE = parseInt(process.env.DOCTOR_PRIVATE_PRACTICE_RATE || "100", 10);
const SERVICE_WAIT_RETRIES = parseInt(process.env.SERVICE_WAIT_RETRIES || "120", 10);
const SERVICE_WAIT_INTERVAL_MS = parseInt(process.env.SERVICE_WAIT_INTERVAL_MS || "2000", 10);

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
// ids/areas mirror search.controller.ts's ALL_CITIES exactly — must stay in sync
// or city/area filters will silently stop matching again.
const CITIES_WITH_AREAS = [
  { id: "cairo", areas: ["Nasr City","Heliopolis","New Cairo","Maadi","Mokattam","Shorouk","Badr City","El Rehab","Madinaty","Zamalek","Downtown","Garden City","Ain Shams","El Marg","El Salam","El Nozha","Abbassia","Ramses","Helwan","Dar El Salam","Basatin","Shubra"] },
  { id: "giza", areas: ["Dokki","Mohandessin","Haram","Faisal","Sheikh Zayed","6th of October","Agouza","Imbaba","Bulaq El Dakrour","Giza Square","Hadayek Al Ahram","Kerdasa","Oseem"] },
  { id: "alexandria", areas: ["Smouha","Sidi Gaber","Sporting","Stanley","Miami","Mandara","Agami","Borg El Arab","Gleem","Louran","Raml Station"] },
  { id: "qalyubia", areas: ["Shubra El Kheima","Banha","Qalyub","Obour","Khanka","Toukh","Kafr Shukr"] },
  { id: "sharqia", areas: ["Zagazig","10th of Ramadan","Belbeis","Minya El Qamh","Abu Hammad"] },
  { id: "dakahlia", areas: ["Mansoura","Mit Ghamr","Talkha","Aga","Belqas"] },
  { id: "gharbia", areas: ["Tanta","El Mahalla El Kubra","Kafr El Zayat","Zefta"] },
];

function pickCityAndArea(forcedCityId) {
  const city = forcedCityId
    ? CITIES_WITH_AREAS.find((c) => c.id === forcedCityId)
    : rand(CITIES_WITH_AREAS);
  const area = rand(city.areas);
  return { cityId: city.id, area };
}
const AGE_BANDS = ["young", "mid", "old"];

function rand(arr) { return arr[crypto.randomInt(arr.length)]; }
function randInt(min, max) { return crypto.randomInt(min, max + 1); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForService(name, url, retries = SERVICE_WAIT_RETRIES, intervalMs = SERVICE_WAIT_INTERVAL_MS) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await req(url, {}, 0);
    if (res.ok) {
      console.log(`  [ready] ${name} is healthy`);
      return true;
    }
    if (attempt % 10 === 0) {
      console.log(`  [waiting] ${name} (${attempt}/${retries}) ...`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`${name} did not become ready: ${url}`);
}

// Secure shuffle using Fisher-Yates with crypto.randomInt
function secureShuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- photo loading ----------
// Resize + re-encode before base64-embedding — the raw stock/facility
// photos are multi-MB, which made every search response carrying them
// (especially pharmacies) far heavier than doctor headshots. Doctor
// photos are small to begin with but get the same treatment for
// consistency and to cap worst-case size regardless of source file.
async function loadPhotosAsDataUris(dir, maxWidth = 800, quality = 70) {
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png)$/i.test(f));

  const results = [];
  for (const f of files) {
    try {
      const buf = await sharp(path.join(dir, f))
        .resize({ width: maxWidth, withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer();
      results.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
    } catch (err) {
      console.warn(`  [photo-resize-failed] ${f}: ${err.message}`);
    }
  }
  return results;
}

let doctorPhotosByGenderAndBand = null;
let facilityPhotos = null;

async function loadAllPhotos() {
  doctorPhotosByGenderAndBand = {
    male: {
      young: await loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "doctors", "male", "young")),
      mid:   await loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "doctors", "male", "mid")),
      old:   await loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "doctors", "male", "old")),
    },
    female: {
      young: await loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "doctors", "female", "young")),
      mid:   await loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "doctors", "female", "mid")),
      old:   await loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "doctors", "female", "old")),
    },
  };
  facilityPhotos = await loadPhotosAsDataUris(path.join(__dirname, "..", "photos", "facilities"));

  for (const gender of ["male", "female"]) {
    for (const band of AGE_BANDS) {
      console.log(`Loaded ${doctorPhotosByGenderAndBand[gender][band].length} ${gender}/${band} doctor photos`);
    }
  }
  console.log(`Loaded ${facilityPhotos.length} facility photos`);
}

// ---------- helpers for age/title ----------
function titleForExperience(years) {
  if (years >= 20) return crypto.randomInt(100) < 80 ? "professor" : "consultant";
  if (years >= 10) return crypto.randomInt(100) < 30 ? "professor" : "specialist";
  return "specialist";
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

// Weight (gender, band) selection by how many photos exist for that
// combination, so category sizes track actual available pics instead
// of being independently randomized.
function pickWeightedCategory() {
  const entries = [];
  for (const gender of ["male", "female"]) {
    for (const band of AGE_BANDS) {
      const count = doctorPhotosByGenderAndBand[gender][band].length;
      if (count > 0) entries.push({ gender, band, count });
    }
  }
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  // Secure roll in [0, total-1]
  let roll = crypto.randomInt(total);
  for (const entry of entries) {
    roll -= entry.count;
    if (roll < 0) return entry;
  }
  return entries[entries.length - 1];
}

// Years-of-experience range matching ageBandForExperience's thresholds
// (young < 8, mid 8-17, old >= 18), so a doctor's generated experience
// stays consistent with the band its photo was drawn from.
function yearsForBand(band) {
  if (band === "old") return randInt(18, 30);
  if (band === "mid") return randInt(8, 17);
  return randInt(1, 7);
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

async function setBranchAvailabilityWithRetry(branchId, doctorUserId, doctorName, retries = 8) {
  const rules = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "17:00",
    slotDurationMinutes: 30,
  }));

  for (let attempt = 1; attempt <= retries; attempt++) {
    const availability = await req(`${BOOKING_URL}/api/v1/doctor/branches/${branchId}/availability`, {
      method: "PUT",
      body: JSON.stringify({
        doctorId: doctorUserId,
        rules,
      }),
    });

    if (availability.ok) return;

    if (attempt === retries) {
      throw new Error(`Failed to set availability for Dr. ${doctorName} on branch ${branchId}: ${availability.error}`);
    }

    await sleep(Math.min(5000, 400 * attempt));
  }
}

async function fetchMyProfile(token) {
  const res = await req(`${AUTH_URL}/api/profile/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn(`  [profile] fetch failed: ${res.error}`);
    return null;
  }
  return res.data; // { id, ...profileFields, branches: [...] }
}

async function fetchFacilityBranches(facilityId, token) {
  const res = await req(`${AUTH_URL}/api/invitations/facility/${facilityId}/branches`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn(`  [facility-branches] fetch failed: ${res.error}`);
    return [];
  }
  return res.data?.data || [];
}
async function pollFacilityBranchesSynced(userId, retries = 12, intervalMs = 1500) {
  for (let i = 0; i < retries; i++) {
    const res = await req(`${BOOKING_URL}/api/v1/public/facilities/${userId}/branches`);
    if (res.ok && res.data?.data?.length > 0) return res.data.data;
    await sleep(intervalMs);
  }
  return null;
}

function makeBranch(namePrefix, mediaUrls = [], forcedCityId = null) {
  const { cityId, area } = pickCityAndArea(forcedCityId);
  return {
    name: `${namePrefix} Branch`,
    cityId,
    area,
    address: `${randInt(1, 200)} ${area} St.`,
    googleMapsUrl: "",
    phoneNumbers: [`+2010${randInt(10000000, 99999999)}`],
    consultationFee: String(randInt(150, 500)),
    mediaUrls,
  };
}

function pickBranchPhotos(count) {
  if (!facilityPhotos.length) return [];
  const shuffled = secureShuffle([...facilityPhotos]);
  return shuffled.slice(0, Math.min(count, facilityPhotos.length));
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
  if (patients.length !== PATIENT_COUNT) {
    throw new Error(`Expected ${PATIENT_COUNT} patients, created ${patients.length}`);
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
    // Default to 100% so all seeded doctors have branches + availability unless explicitly lowered.
    const hasPrivatePractice =
      i <= 10 ? true : crypto.randomInt(100) < Math.max(0, Math.min(100, DOCTOR_PRIVATE_PRACTICE_RATE));
    const email = `doctor${i}@${EMAIL_DOMAIN}`;
    const branchMedia = hasPrivatePractice ? pickBranchPhotos(randInt(1, 3)) : [];
    const branches = hasPrivatePractice ? [makeBranch(`Dr. ${last}`, branchMedia)] : [];

    const onboardingData = {
      full_name: `${title === "professor" ? "Prof." : "Dr."} ${first} ${last}`,
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

    const myProfile = await fetchMyProfile(acc.token);
    if (!myProfile) {
      console.warn(`  [profile-missing] doctor ${i} registered but /profile/me failed, skipping invitations for this doctor`);
    }

    console.log(`  doctor ${i}/${DOCTOR_COUNT} created (${email})`);
    doctors.push({
      ...acc,
      name: `${first} ${last}`,
      hasPrivatePractice,
      branchIds: [],
      doctorId: myProfile?.id || null,
    });
    await sleep(150);
  }

  // sync + availability for private-practice doctors
  // Give RabbitMQ sync a short drain window before availability writes.
  await sleep(4000);

  for (const doc of doctors.filter((d) => d.hasPrivatePractice)) {
    const synced = await pollDoctorSynced(doc.userId);
    if (!synced || !synced.branches?.length) {
      throw new Error(`[sync-timeout] doctor ${doc.name} branches never synced`);
    }
    doc.branchIds = synced.branches.map((b) => b.id);
    for (const branchId of doc.branchIds) {
      await setBranchAvailabilityWithRetry(branchId, doc.userId, doc.name);
    }
    console.log(`  availability set for Dr. ${doc.name}`);
    await sleep(150);
  }
  if (doctors.length !== DOCTOR_COUNT) {
    throw new Error(`Expected ${DOCTOR_COUNT} doctors, created ${doctors.length}`);
  }
  return doctors;
}

async function seedFacilities(count, role, facilityType, labelPrefix) {
  const facilities = [];
  // Fix email bug: replace spaces with hyphens
  const safePrefix = labelPrefix.toLowerCase().replace(/\s+/g, '-');
  for (let i = 1; i <= count; i++) {
    const cityEntry = rand(CITIES_WITH_AREAS);
    const city = cityEntry.id;
    // Pharmacies get a plain, generic name — never "Hospital"/"Center",
    // since facility_type already carries that distinction.
    const rawName =
      facilityType === "pharmacy" ? `${city} Pharmacy ${i}` : `${city} ${labelPrefix} ${i}`;
    const name = rawName.replace(/\b(Hospital|Center|Centre)\b/gi, "").replace(/\s{2,}/g, " ").trim();
    const email = `${safePrefix}${i}@${EMAIL_DOMAIN}`;
    const branchCount = randInt(1, 3);
    const branches = Array.from({ length: branchCount }, () => makeBranch(name, pickBranchPhotos(randInt(1, 3)), city));

    const onboardingData = {
      facility_name: name,
      photo_url: facilityPhotos.length ? rand(facilityPhotos) : "",
      phone_numbers: [`+2010${randInt(10000000, 99999999)}`],
      facility_type: facilityType,
      description: `A trusted ${labelPrefix.toLowerCase()} serving the ${city} area.`,
      city,
      address: `${randInt(1, 200)} ${rand(cityEntry.areas)} St.`,
      branches,
    };

    const acc = await registerAccount(safePrefix + i, email, role, onboardingData);
    if (!acc) continue;

    console.log(`  ${labelPrefix} ${i}/${count} created (${email})`);
    facilities.push({ ...acc, name, facilityType, role });
    await sleep(150);
  }

  // confirm sync (best effort)
  for (const fac of facilities) {
    await pollFacilityBranchesSynced(fac.userId, 6, 1000);
  }
  if (facilities.length !== count) {
    throw new Error(`Expected ${count} ${labelPrefix} records, created ${facilities.length}`);
  }
  return facilities;
}

async function seedFacilityInvitations(doctors, facilities) {
  // Only hospitals/centers can invite doctors (see invitation.controller.ts)
  const inviters = facilities.filter(
    (f) => f.facilityType === "hospital" || f.facilityType === "center",
  );
  console.log(`  [invite-debug] ${inviters.length} inviter facilities, ${doctors.length} candidate doctors`);
  if (!inviters.length || !doctors.length) {
    console.warn(`  [invite-abort] guard triggered — inviters=${inviters.length} doctors=${doctors.length}`);
    return;
  }

  for (const fac of inviters) {
    console.log(`  [invite-debug] processing facility: ${fac.name} (type=${fac.facilityType})`);
    const myProfile = await fetchMyProfile(fac.token);
    if (!myProfile) {
      console.warn(`  [invite-skip] ${fac.name}: could not resolve facility profile id`);
      continue;
    }
    const facilityId = myProfile.id;

    const branches = await fetchFacilityBranches(facilityId, fac.token);
    if (!branches.length) {
      console.warn(`  [invite-skip] ${fac.name}: no branches found`);
      continue;
    }

    const pickCount = randInt(1, 3);
    const shuffledDoctors = secureShuffle([...doctors]);
    const invitedDoctors = shuffledDoctors
      .filter((d) => d.doctorId)
      .slice(0, pickCount);

    for (const doc of invitedDoctors) {
      const invite = await req(`${AUTH_URL}/api/invitations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${fac.token}` },
        body: JSON.stringify({
          doctorId: doc.doctorId,
          facilityId,
          branches: branches.map((b) => ({
            branchId: b.id,
            consultationFee: randInt(150, 500),
          })),
          message: `Join us at ${fac.name}`,
        }),
      });

      if (!invite.ok) {
        console.warn(`  [invite-failed] ${fac.name} -> Dr. ${doc.name}: ${invite.error}`);
        continue;
      }

      const invitationId = invite.data.invitationId;
      const accept = await req(`${AUTH_URL}/api/invitations/${invitationId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${doc.token}` },
      });

      if (!accept.ok) {
        console.warn(`  [accept-failed] Dr. ${doc.name} -> ${fac.name}: ${accept.error}`);
        continue;
      }

      console.log(`  invited + accepted: Dr. ${doc.name} -> ${fac.name}`);
      await sleep(150);
    }
  }
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
  console.log("== Waiting for service readiness ==");
  await waitForService("auth-service", `${AUTH_URL}/health`);
  await waitForService("booking-service", `${BOOKING_URL}/health`);
  await waitForService("chat-service", `${CHAT_URL}/health`);

  await loadAllPhotos();

  console.log("== Seeding patients ==");
  const patients = await seedPatients();

  console.log("== Seeding doctors ==");
  const doctors = await seedDoctors();

  console.log("== Seeding pharmacies ==");
  await seedFacilities(PHARMACY_COUNT, "pharmacy_admin", "pharmacy", "Pharmacy");

  console.log("== Seeding hospitals ==");
  const hospitals = await seedFacilities(HOSPITAL_COUNT, "clinic_admin", "hospital", "Hospital");

  console.log("== Seeding medical centers ==");
  const centers = await seedFacilities(CENTER_COUNT, "clinic_admin", "center", "Medical Center");

  console.log("== Seeding hospital/center doctor invitations ==");
  await seedFacilityInvitations(doctors, [...hospitals, ...centers]);

  console.log("== Seeding sample bookings + chat rooms ==");
  await seedBookingsAndChats(doctors, patients);

  console.log("== Done ==");
}

const MARKER_PATH = "/app/data/.seeded";

if (fs.existsSync(MARKER_PATH)) {
  console.log("Marker found at /app/data/.seeded — already seeded, skipping.");
  process.exit(0);
}

main()
  .then(() => {
    fs.mkdirSync(path.dirname(MARKER_PATH), { recursive: true });
    fs.writeFileSync(MARKER_PATH, new Date().toISOString());
    console.log("Wrote seed marker.");
  })
  .catch((err) => {
    console.error("Seeder crashed:", err);
    process.exit(1);
  });

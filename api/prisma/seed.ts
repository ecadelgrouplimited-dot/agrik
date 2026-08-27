import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Coordinates are the approximate district-capital/town centroid, sourced from
// well-established public knowledge. Districts without a confident coordinate
// are seeded name-only (lat/lng null) — the live-map endpoint's
// coordinate_coverage_pct field is designed to reflect exactly this kind of
// partial coverage. This list should be reconciled against the latest UBOS
// district gazette before relying on it as exhaustive — Uganda periodically
// creates new districts by splitting existing ones.
const DISTRICTS: { name: string; latitude?: number; longitude?: number }[] = [
  { name: "Kampala", latitude: 0.3476, longitude: 32.5825 },
  { name: "Wakiso", latitude: 0.4044, longitude: 32.4594 },
  { name: "Mukono", latitude: 0.3533, longitude: 32.7553 },
  { name: "Jinja", latitude: 0.4478, longitude: 33.2026 },
  { name: "Iganga", latitude: 0.6075, longitude: 33.4686 },
  { name: "Mbale", latitude: 1.0821, longitude: 34.1751 },
  { name: "Tororo", latitude: 0.6928, longitude: 34.1811 },
  { name: "Soroti", latitude: 1.7147, longitude: 33.6111 },
  { name: "Kumi", latitude: 1.4633, longitude: 33.9367 },
  { name: "Lira", latitude: 2.2350, longitude: 32.9095 },
  { name: "Gulu", latitude: 2.7746, longitude: 32.2989 },
  { name: "Kitgum", latitude: 3.2783, longitude: 32.8867 },
  { name: "Arua", latitude: 3.0201, longitude: 30.9111 },
  { name: "Nebbi", latitude: 2.4783, longitude: 31.0886 },
  { name: "Moyo", latitude: 3.6564, longitude: 31.7314 },
  { name: "Adjumani", latitude: 3.3775, longitude: 31.7906 },
  { name: "Masindi", latitude: 1.6742, longitude: 31.7156 },
  { name: "Hoima", latitude: 1.4339, longitude: 31.3522 },
  { name: "Kabarole", latitude: 0.6539, longitude: 30.2758 },
  { name: "Fort Portal", latitude: 0.6714, longitude: 30.2751 },
  { name: "Kasese", latitude: 0.1833, longitude: 30.0833 },
  { name: "Bundibugyo", latitude: 0.7106, longitude: 30.0658 },
  { name: "Mbarara", latitude: -0.6072, longitude: 30.6545 },
  { name: "Bushenyi", latitude: -0.5833, longitude: 30.2000 },
  { name: "Ntungamo", latitude: -0.8811, longitude: 30.2639 },
  { name: "Kabale", latitude: -1.2486, longitude: 29.9897 },
  { name: "Kisoro", latitude: -1.2836, longitude: 29.6858 },
  { name: "Rukungiri", latitude: -0.7833, longitude: 29.9167 },
  { name: "Ibanda", latitude: -0.1333, longitude: 30.5833 },
  { name: "Kiruhura", latitude: -0.1917, longitude: 30.7833 },
  { name: "Masaka", latitude: -0.3333, longitude: 31.7333 },
  { name: "Rakai", latitude: -0.7061, longitude: 31.4333 },
  { name: "Sembabule", latitude: -0.0833, longitude: 31.3667 },
  { name: "Kalangala", latitude: -0.3167, longitude: 32.2333 },
  { name: "Mpigi", latitude: 0.2261, longitude: 32.3253 },
  { name: "Mityana", latitude: 0.4031, longitude: 32.0281 },
  { name: "Mubende", latitude: 0.5647, longitude: 31.3894 },
  { name: "Luwero", latitude: 0.8500, longitude: 32.4667 },
  { name: "Nakasongola", latitude: 1.3167, longitude: 32.4667 },
  { name: "Kiboga", latitude: 0.9167, longitude: 31.7667 },
  { name: "Kayunga", latitude: 0.7167, longitude: 32.8833 },
  { name: "Kamuli", latitude: 0.9472, longitude: 33.1200 },
  { name: "Kaliro", latitude: 1.0833, longitude: 33.5000 },
  { name: "Busia", latitude: 0.4608, longitude: 34.0919 },
  { name: "Bugiri", latitude: 0.5833, longitude: 33.7500 },
  { name: "Pallisa", latitude: 1.1447, longitude: 33.7092 },
  { name: "Kaberamaido", latitude: 1.7500, longitude: 33.1667 },
  { name: "Katakwi", latitude: 1.9167, longitude: 33.9667 },
  { name: "Amuria", latitude: 2.0000, longitude: 33.6167 },
  { name: "Moroto", latitude: 2.5333, longitude: 34.6667 },
  { name: "Kotido", latitude: 2.9833, longitude: 34.1333 },
  { name: "Kaabong", latitude: 3.5167, longitude: 34.1500 },
  { name: "Nakapiripirit", latitude: 1.9333, longitude: 34.7333 },
  { name: "Abim", latitude: 2.7000, longitude: 33.6667 },
  { name: "Amuru", latitude: 2.8167, longitude: 32.1500 },
  { name: "Pader", latitude: 2.9333, longitude: 33.1500 },
  { name: "Apac", latitude: 1.9793, longitude: 32.5322 },
  { name: "Oyam", latitude: 2.2167, longitude: 32.3833 },
  { name: "Dokolo", latitude: 1.9167, longitude: 33.1667 },
  { name: "Amolatar", latitude: 1.6333, longitude: 32.8000 },
  { name: "Nakaseke", latitude: 1.1833, longitude: 32.2833 },
  { name: "Buikwe", latitude: 0.3333, longitude: 33.0000 },
  { name: "Buvuma", latitude: 0.3833, longitude: 33.2500 },
  { name: "Namutumba", latitude: 0.8333, longitude: 33.6833 },
  { name: "Butaleja", latitude: 0.8833, longitude: 33.9333 },
  { name: "Manafwa", latitude: 0.9167, longitude: 34.3167 },
  { name: "Sironko", latitude: 1.2333, longitude: 34.2500 },
  { name: "Kapchorwa", latitude: 1.4000, longitude: 34.4500 },
  { name: "Bukwo", latitude: 1.3667, longitude: 34.7500 },
  { name: "Kween", latitude: 1.5333, longitude: 34.6167 },
  { name: "Bukedea", latitude: 1.3333, longitude: 34.0333 },
  { name: "Ngora", latitude: 1.4667, longitude: 33.7833 },
  { name: "Serere", latitude: 1.5000, longitude: 33.5500 },
  { name: "Buyende", latitude: 1.1000, longitude: 33.1667 },
  { name: "Luuka", latitude: 0.6667, longitude: 33.3167 },
  { name: "Kibuku", latitude: 1.0333, longitude: 33.7833 },
  { name: "Kibaale", latitude: 1.0000, longitude: 31.0667 },
  { name: "Kyenjojo", latitude: 0.6167, longitude: 30.6333 },
  { name: "Kamwenge", latitude: 0.1667, longitude: 30.4333 },
  { name: "Kiryandongo", latitude: 1.9500, longitude: 32.0000 },
  { name: "Buliisa", latitude: 2.0500, longitude: 31.3833 },
  { name: "Zombo", latitude: 2.4833, longitude: 30.9333 },
  { name: "Maracha", latitude: 3.2833, longitude: 30.9500 },
  { name: "Koboko", latitude: 3.4167, longitude: 30.9500 },
  { name: "Yumbe", latitude: 3.4667, longitude: 31.2500 },
  { name: "Lamwo", latitude: 3.5833, longitude: 32.7833 },
  { name: "Agago", latitude: 2.9167, longitude: 33.4667 },
  { name: "Otuke", latitude: 2.4167, longitude: 33.2000 },
  { name: "Alebtong", latitude: 2.2667, longitude: 33.3333 },
  { name: "Kole", latitude: 2.3833, longitude: 32.7500 },
  { name: "Isingiro", latitude: -0.8500, longitude: 30.8000 },
  { name: "Kanungu", latitude: -0.9167, longitude: 29.8000 },
  { name: "Kyegegwa", latitude: 0.4833, longitude: 31.0333 },
  { name: "Ntoroko", latitude: 1.0833, longitude: 30.4833 },
  { name: "Butambala", latitude: 0.2667, longitude: 32.1333 },
  { name: "Gomba", latitude: 0.1667, longitude: 31.8833 },
  { name: "Lwengo", latitude: -0.3833, longitude: 31.3833 },
  { name: "Bukomansimbi", latitude: -0.2833, longitude: 31.5833 },
  { name: "Lyantonde", latitude: -0.4167, longitude: 31.1667 },
  { name: "Rubirizi", latitude: -0.2667, longitude: 30.1167 },
  { name: "Sheema", latitude: -0.5667, longitude: 30.3667 },
  { name: "Mitooma", latitude: -0.6667, longitude: 30.0500 },
  { name: "Buhweju", latitude: -0.4667, longitude: 30.3833 },
  { name: "Rubanda", latitude: -1.2333, longitude: 29.8333 },
  { name: "Rukiga", latitude: -1.1167, longitude: 30.0333 },
  { name: "Kagadi", latitude: 0.9500, longitude: 30.7333 },
  { name: "Kakumiro", latitude: 0.8000, longitude: 31.2833 },
  { name: "Namayingo", latitude: 0.2500, longitude: 33.7500 },
  { name: "Kalungu", latitude: -0.1333, longitude: 31.7667 },
  { name: "Mayuge", latitude: 0.4667, longitude: 33.4667 },
  { name: "Namisindwa", latitude: 0.9833, longitude: 34.3167 },
  { name: "Kikuube", latitude: 1.2000, longitude: 31.1500 },
  { name: "Kwania", latitude: 1.8500, longitude: 32.5333 },
  { name: "Nabilatuk", latitude: 2.1667, longitude: 34.5000 },
  { name: "Karenga", latitude: 3.4167, longitude: 33.6833 },
  { name: "Obongi", latitude: 3.4833, longitude: 31.5833 },
  { name: "Terego", latitude: 3.1000, longitude: 30.9333 },
  { name: "Madi-Okollo", latitude: 3.0500, longitude: 31.1667 },
  { name: "Bugweri", latitude: 0.6333, longitude: 33.6500 },
  { name: "Kapelebyong", latitude: 1.9167, longitude: 33.8833 },
  { name: "Rwampara", latitude: -0.7000, longitude: 30.5333 },
];

async function seedDistricts() {
  for (const district of DISTRICTS) {
    await prisma.district.upsert({
      where: { name: district.name },
      update: { latitude: district.latitude ?? null, longitude: district.longitude ?? null },
      create: { name: district.name, latitude: district.latitude ?? null, longitude: district.longitude ?? null },
    });
  }
  console.log(`Seeded ${DISTRICTS.length} districts.`);
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("Skipping admin seed: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one.");
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.admin.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, status: "active", verificationStatus: "verified" },
  });
  console.log(`Seeded admin account for ${email}.`);
}

async function main() {
  await seedDistricts();
  await seedAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

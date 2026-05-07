import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const CITY = {
  name: "Чорноморськ",
  country: "Україна",
  bbox: { minLat: 46.27, minLon: 30.6, maxLat: 46.34, maxLon: 30.72 },
};

function userAgent(): string {
  const contact = process.env.NOMINATIM_CONTACT ?? "unknown";
  return `poshta-map/1.0 (${contact})`;
}

async function geocode(street: string, number: string): Promise<{ lat: number; lon: number } | null> {
  const params = new URLSearchParams({
    street: `${number} ${street}`,
    city: CITY.name,
    country: CITY.country,
    format: "json",
    limit: "1",
    bounded: "1",
    viewbox: `${CITY.bbox.minLon},${CITY.bbox.maxLat},${CITY.bbox.maxLon},${CITY.bbox.minLat}`,
  });
  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn("  HTTP", res.status);
      return null;
    }
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const first = data[0];
    if (!first?.lat || !first?.lon) return null;
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch (e) {
    console.warn("  fetch error:", (e as Error).message);
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const retryFailed = args.includes("--retry-failed");

  const where = retryFailed
    ? { latitude: null }
    : { latitude: null, geocodeFailed: false };

  const buildings = await prisma.building.findMany({
    where,
    orderBy: { id: "asc" },
    select: { id: true, street: true, number: true },
  });

  if (buildings.length === 0) {
    console.log("Нічого геокодити.");
    return;
  }

  console.log(`Геокодимо ${buildings.length} будинк(а/ів). Очікуйте ~${Math.ceil((buildings.length * 1.1) / 60)} хв.`);

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const tag = `[${i + 1}/${buildings.length}] ${b.street}, ${b.number}`;
    const result = await geocode(b.street, b.number);
    if (result) {
      await prisma.building.update({
        where: { id: b.id },
        data: {
          latitude: result.lat,
          longitude: result.lon,
          geocodedAt: new Date(),
          geocodeFailed: false,
        },
      });
      ok++;
      console.log(`${tag} → ${result.lat.toFixed(5)}, ${result.lon.toFixed(5)}`);
    } else {
      await prisma.building.update({
        where: { id: b.id },
        data: { geocodedAt: new Date(), geocodeFailed: true },
      });
      fail++;
      console.log(`${tag} → не знайдено`);
    }
    // Rate limit Nominatim: ≤ 1 req/sec.
    await sleep(1100);
  }

  console.log(`\nГотово. Успіх: ${ok}, не знайдено: ${fail}.`);
  if (fail > 0) {
    console.log("Щоб повторити невдалі: npm run db:geocode -- --retry-failed");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

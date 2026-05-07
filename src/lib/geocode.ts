import { prisma } from "@/lib/prisma";
import { CITY } from "@/lib/geo-config";

export type GeocodeResult = { lat: number; lon: number };

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

function userAgent(): string {
  const contact = process.env.NOMINATIM_CONTACT ?? "unknown";
  return `poshta-map/1.0 (${contact})`;
}

// Робить один HTTP-запит до Nominatim. Повертає null при будь-якій помилці або відсутності збігів.
// Caller відповідає за rate-limiting (Nominatim policy: ≤ 1 req/sec).
export async function geocodeAddress(
  street: string,
  number: string,
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    street: `${number} ${street}`,
    city: CITY.name,
    country: CITY.country,
    format: "json",
    limit: "1",
    bounded: "1",
    // viewbox: minLon,maxLat,maxLon,minLat
    viewbox: `${CITY.bbox.minLon},${CITY.bbox.maxLat},${CITY.bbox.maxLon},${CITY.bbox.minLat}`,
  });

  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": userAgent(),
        Accept: "application/json",
      },
      // Nominatim не любить кеш агресивний, тому залишаємо за замовчуванням.
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const first = data[0];
    if (!first?.lat || !first?.lon) return null;
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

// Fire-and-forget геокодинг для нового будинку. Не кидає виключень,
// не блокує виклик. Викликати ПІСЛЯ створення Building.
export function enqueueGeocodeForBuilding(building: {
  id: number;
  street: string;
  number: string;
}): void {
  // Запускаємо без await; ловимо все.
  void (async () => {
    try {
      const result = await geocodeAddress(building.street, building.number);
      if (result) {
        await prisma.building.update({
          where: { id: building.id },
          data: {
            latitude: result.lat,
            longitude: result.lon,
            geocodedAt: new Date(),
            geocodeFailed: false,
          },
        });
      } else {
        await prisma.building.update({
          where: { id: building.id },
          data: {
            geocodedAt: new Date(),
            geocodeFailed: true,
          },
        });
      }
    } catch (e) {
      console.error("[geocode] background update failed", building.id, e);
    }
  })();
}

"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { NEARBY_LIMIT, NEARBY_RADIUS_M } from "@/lib/geo-config";

export type NearbyBuilding = {
  id: number;
  street: string;
  number: string;
  latitude: number | null;
  longitude: number | null;
  distanceM: number | null; // null коли немає координат
  sameStreet: boolean;
};

// Haversine distance in meters between two lat/lon points.
function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Сортування "номерів будинків" по числовій частині (10 після 9, не після 1).
function compareNumber(a: string, b: string): number {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, "uk");
}

export async function getNearbyBuildings(
  originBuildingId: number,
  excludeIds: number[],
): Promise<NearbyBuilding[]> {
  await requireUser();

  const origin = await prisma.building.findUnique({
    where: { id: originBuildingId },
    select: { id: true, street: true, latitude: true, longitude: true },
  });
  if (!origin) return [];

  const exclude = new Set<number>([originBuildingId, ...excludeIds]);

  // А: ті самі вулиці (текстовий збіг). Завжди знаходимо, навіть без координат.
  const sameStreet = await prisma.building.findMany({
    where: {
      street: origin.street,
      id: { notIn: Array.from(exclude) },
    },
    select: { id: true, street: true, number: true, latitude: true, longitude: true },
    take: 100,
  });
  sameStreet.sort((a, b) => compareNumber(a.number, b.number));

  const seen = new Set<number>(sameStreet.map((b) => b.id));
  const sameStreetItems: NearbyBuilding[] = sameStreet.map((b) => ({
    id: b.id,
    street: b.street,
    number: b.number,
    latitude: b.latitude,
    longitude: b.longitude,
    distanceM:
      origin.latitude !== null &&
      origin.longitude !== null &&
      b.latitude !== null &&
      b.longitude !== null
        ? Math.round(haversineM(origin.latitude, origin.longitude, b.latitude, b.longitude))
        : null,
    sameStreet: true,
  }));

  // Б: радіус навколо origin (тільки якщо є координати).
  let radiusItems: NearbyBuilding[] = [];
  if (origin.latitude !== null && origin.longitude !== null) {
    // ~ 1° lat ≈ 111км; на широті 46° 1° lon ≈ 77км.
    const latDelta = NEARBY_RADIUS_M / 111000;
    const lonDelta = NEARBY_RADIUS_M / (111000 * Math.cos((origin.latitude * Math.PI) / 180));
    const candidates = await prisma.building.findMany({
      where: {
        id: { notIn: Array.from(new Set([...exclude, ...seen])) },
        latitude: {
          gte: origin.latitude - latDelta,
          lte: origin.latitude + latDelta,
        },
        longitude: {
          gte: origin.longitude - lonDelta,
          lte: origin.longitude + lonDelta,
        },
      },
      select: { id: true, street: true, number: true, latitude: true, longitude: true },
      take: 200,
    });
    radiusItems = candidates
      .map((b) => {
        const distance = Math.round(
          haversineM(origin.latitude!, origin.longitude!, b.latitude!, b.longitude!),
        );
        return { b, distance };
      })
      .filter(({ distance }) => distance <= NEARBY_RADIUS_M)
      .sort((a, b) => a.distance - b.distance)
      .map(({ b, distance }) => ({
        id: b.id,
        street: b.street,
        number: b.number,
        latitude: b.latitude,
        longitude: b.longitude,
        distanceM: distance,
        sameStreet: false,
      }));
  }

  return [...sameStreetItems, ...radiusItems].slice(0, NEARBY_LIMIT);
}

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
  distanceM: number; // мін. відстань до будь-якого з обраних будинків
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

// Шукає будинки в радіусі NEARBY_RADIUS_M від БУДЬ-ЯКОЇ з обраних адрес.
// Перший аргумент — масив id обраних будинків (origin set); excludeIds виключаються з результатів.
export async function getNearbyBuildings(
  selectedIds: number[],
  excludeIds: number[],
): Promise<NearbyBuilding[]> {
  await requireUser();

  if (selectedIds.length === 0) return [];

  const origins = await prisma.building.findMany({
    where: { id: { in: selectedIds } },
    select: { id: true, latitude: true, longitude: true },
  });
  const originsWithCoords = origins.filter(
    (o): o is typeof o & { latitude: number; longitude: number } =>
      o.latitude !== null && o.longitude !== null,
  );
  if (originsWithCoords.length === 0) return [];

  // Bounding box, що покриває всі origins +радіус (для одного запиту до БД).
  const latDeltaMax = NEARBY_RADIUS_M / 111000;
  const minLat = Math.min(...originsWithCoords.map((o) => o.latitude)) - latDeltaMax;
  const maxLat = Math.max(...originsWithCoords.map((o) => o.latitude)) + latDeltaMax;
  // Найвища широта в наборі дає найбільший lonDelta — беремо з запасом за нею.
  const refLat = Math.max(...originsWithCoords.map((o) => Math.abs(o.latitude)));
  const lonDeltaMax = NEARBY_RADIUS_M / (111000 * Math.cos((refLat * Math.PI) / 180));
  const minLon = Math.min(...originsWithCoords.map((o) => o.longitude)) - lonDeltaMax;
  const maxLon = Math.max(...originsWithCoords.map((o) => o.longitude)) + lonDeltaMax;

  const exclude = new Set<number>([...selectedIds, ...excludeIds]);

  const candidates = await prisma.building.findMany({
    where: {
      id: { notIn: Array.from(exclude) },
      latitude: { gte: minLat, lte: maxLat },
      longitude: { gte: minLon, lte: maxLon },
    },
    select: { id: true, street: true, number: true, latitude: true, longitude: true },
    take: 500,
  });

  const items: NearbyBuilding[] = [];
  for (const c of candidates) {
    if (c.latitude === null || c.longitude === null) continue;
    let minDist = Infinity;
    for (const o of originsWithCoords) {
      const d = haversineM(o.latitude, o.longitude, c.latitude, c.longitude);
      if (d < minDist) minDist = d;
    }
    if (minDist <= NEARBY_RADIUS_M) {
      items.push({
        id: c.id,
        street: c.street,
        number: c.number,
        latitude: c.latitude,
        longitude: c.longitude,
        distanceM: Math.round(minDist),
      });
    }
  }

  items.sort((a, b) => a.distanceM - b.distanceM);
  return items.slice(0, NEARBY_LIMIT);
}

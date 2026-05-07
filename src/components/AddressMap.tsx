"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CITY } from "@/lib/geo-config";

export type MapBuilding = {
  id: number;
  street: string;
  number: string;
  latitude: number | null;
  longitude: number | null;
};

type Props = {
  selected: MapBuilding[]; // у порядку обходу
  suggestions: MapBuilding[];
  onAddBuilding: (id: number) => void;
};

// Іконка обраного будинку — кольорова крапля з номером кроку всередині.
function selectedIcon(orderNumber: number): L.DivIcon {
  return L.divIcon({
    className: "address-map-pin",
    html: `<div class="amp amp--selected"><span>${orderNumber}</span></div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    tooltipAnchor: [0, -28],
  });
}

// Іконка-підказка — менший кружечок.
const SUGGESTION_ICON = L.divIcon({
  className: "address-map-pin",
  html: `<div class="amp amp--suggestion"><span>+</span></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  tooltipAnchor: [0, -10],
});

// Допоміжний компонент, який підганяє bounds під вміст карти при зміні даних.
function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const lastSig = useRef<string>("");
  useEffect(() => {
    if (points.length === 0) return;
    const sig = points.map((p) => p.join(",")).sort().join("|");
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 16), { animate: true });
    } else {
      const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17, animate: true });
    }
  }, [map, points]);
  return null;
}

export default function AddressMap({ selected, suggestions, onAddBuilding }: Props) {
  const selectedWithCoords = useMemo(
    () => selected.filter((b) => b.latitude !== null && b.longitude !== null),
    [selected],
  );
  const suggestionsWithCoords = useMemo(
    () => suggestions.filter((b) => b.latitude !== null && b.longitude !== null),
    [suggestions],
  );

  const allPoints: Array<[number, number]> = useMemo(() => {
    const arr: Array<[number, number]> = [];
    for (const b of selectedWithCoords) arr.push([b.latitude!, b.longitude!]);
    for (const b of suggestionsWithCoords) arr.push([b.latitude!, b.longitude!]);
    return arr;
  }, [selectedWithCoords, suggestionsWithCoords]);

  return (
    <div className="address-map-wrap relative w-full h-72 md:h-96 rounded-lg overflow-hidden border border-border">
      <MapContainer
        center={[CITY.center.lat, CITY.center.lon]}
        zoom={CITY.defaultZoom}
        scrollWheelZoom
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />

        {selectedWithCoords.map((b) => {
          const order = selected.findIndex((s) => s.id === b.id) + 1;
          return (
            <Marker
              key={`sel-${b.id}`}
              position={[b.latitude!, b.longitude!]}
              icon={selectedIcon(order)}
            >
              <Tooltip direction="top" offset={[0, -4]}>
                {order}. {b.street}, {b.number}
              </Tooltip>
            </Marker>
          );
        })}

        {suggestionsWithCoords.map((b) => (
          <Marker
            key={`sug-${b.id}`}
            position={[b.latitude!, b.longitude!]}
            icon={SUGGESTION_ICON}
            eventHandlers={{
              click: () => onAddBuilding(b.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              {b.street}, {b.number}
              <br />
              <span className="text-xs">натисніть, щоб додати</span>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {selectedWithCoords.length === 0 && suggestionsWithCoords.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-bg/40 text-sm text-fg-muted">
          Немає будинків з координатами для відображення
        </div>
      )}

      <style jsx global>{`
        .address-map-pin .amp {
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: white;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
          border: 2px solid white;
        }
        .address-map-pin .amp--selected {
          width: 28px;
          height: 28px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          background: #ffd500;
          color: #1a1a1a;
        }
        .address-map-pin .amp--selected span {
          transform: rotate(45deg);
          font-size: 12px;
        }
        .address-map-pin .amp--suggestion {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #2563eb;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
        }
        .address-map-pin .amp--suggestion:hover {
          background: #1d4ed8;
        }
      `}</style>
    </div>
  );
}

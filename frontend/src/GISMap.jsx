import React from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

const STAGES = ["Proposed", "Notified", "Declared", "Surveyed", "Awarded", "Possession", "R&R complete"];
const STAGE_COLORS = ["#94A3B8", "#60A5FA", "#38BDF8", "#FBBF24", "#FB923C", "#34D399", "#10B981"];

// Approximate coordinates for districts appearing in demo data, plus state-capital
// fallbacks so any newly submitted proposal still plots somewhere reasonable.
// A production system would geocode against DILRMP parcel boundaries instead.
const DISTRICT_COORDS = {
  "Jaipur": [26.9124, 75.7873],
  "Jodhpur": [26.2389, 73.0243],
  "Vadodara": [22.3072, 73.1812],
  "Kanpur": [26.4499, 80.3319],
  "Lucknow": [26.8467, 80.9462],
  "Bengaluru Urban": [12.9716, 77.5946],
};

const STATE_FALLBACK = {
  "Rajasthan": [26.9124, 75.7873],
  "Gujarat": [23.2156, 72.6369],
  "Uttar Pradesh": [26.8467, 80.9462],
  "Karnataka": [12.9716, 77.5946],
  "Maharashtra": [19.7515, 75.7139],
  "Tamil Nadu": [11.1271, 78.6569],
  "West Bengal": [22.9868, 87.8550],
  "Madhya Pradesh": [23.4733, 77.9470],
};

const INDIA_CENTER = [22.5, 80.0];

function getCoords(proposal) {
  // Prefer real coordinates from the backend's PostGIS column
  if (proposal.latitude != null && proposal.longitude != null) {
    return [proposal.latitude, proposal.longitude];
  }
  // Fallback for older proposals created before geo-tagging was added
  if (DISTRICT_COORDS[proposal.district]) return DISTRICT_COORDS[proposal.district];
  if (STATE_FALLBACK[proposal.state]) return STATE_FALLBACK[proposal.state];
  return INDIA_CENTER;
}

export default function GISMap({ proposals, onSelect }) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 480 }}>
      <MapContainer center={INDIA_CENTER} zoom={5} style={{ height: "100%", width: "100%" }} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {proposals.map((p) => {
          const [lat, lng] = getCoords(p);
          const color = STAGE_COLORS[p.stage];
          return (
            <CircleMarker
              key={p.id}
              center={[lat, lng]}
              radius={9 + Math.min(p.area_total_ha / 60, 10)}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 2 }}
              eventHandlers={{ click: () => onSelect && onSelect(p.id) }}
            >
              <Popup>
                <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.project_name}</div>
                  <div style={{ color: "#64748B", marginBottom: 4 }}>{p.district}, {p.state}</div>
                  <div style={{ color, fontWeight: 500 }}>{STAGES[p.stage]}</div>
                  <div style={{ color: "#64748B", marginTop: 2 }}>{p.area_acquired_ha} / {p.area_total_ha} ha acquired</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

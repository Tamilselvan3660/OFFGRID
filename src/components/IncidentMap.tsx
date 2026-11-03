import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { MAP_HEIGHT, MAP_WIDTH, ZONE_CENTERS, project } from '../lib/geo';
import { Incident, Team, Hospital } from '../lib/types';

interface Props {
  incidents?: Incident[];
  teams?: Team[];
  hospitals?: Hospital[];
  showTeams?: boolean;
  showHospitals?: boolean;
  activeOnly?: boolean;
  selectedId?: number | string | null;
  onSelect?: (id: number | string) => void;
  height?: number | string;
  className?: string;
}

const ROADS = [
  'M 60 80 C 180 110 240 60 360 95 S 560 140 700 110',
  'M 90 440 C 210 390 290 410 390 350 S 590 260 700 270',
  'M 320 20 C 310 120 350 190 330 280 S 360 420 350 510',
  'M 520 10 C 500 120 540 220 500 320 S 520 440 490 510',
  'M 40 240 C 180 220 260 270 400 230 S 610 190 760 210',
  'M 180 20 C 200 140 160 230 210 330 S 240 450 220 510',
];

interface HoverInfo { x: number; y: number; title: string; detail: string; tone: string }

export function IncidentMap({
  incidents, teams, hospitals, showTeams = true, showHospitals = true,
  activeOnly = false, selectedId, onSelect, height = 440, className = '',
}: Props) {
  const { data } = useApp();
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const sourceIncidents = incidents || data.incidents;
  const sourceTeams = teams || data.teams;
  const sourceHospitals = hospitals || data.hospitals;
  const visibleIncidents = useMemo(
    () => (activeOnly
      ? sourceIncidents.filter((incident) => ['pending', 'triaged', 'assigned', 'in_progress'].includes(incident.status) && incident.status !== 'duplicate')
      : sourceIncidents),
    [sourceIncidents, activeOnly],
  );

  const markers = useMemo(() => visibleIncidents.map((incident) => ({
    incident, ...project(Number(incident.latitude), Number(incident.longitude)),
  })), [visibleIncidents]);
  const teamMarkers = useMemo(() => (showTeams ? sourceTeams.map((team) => ({ team, ...project(Number(team.latitude), Number(team.longitude)) })) : []), [sourceTeams, showTeams]);
  const hospitalMarkers = useMemo(() => (showHospitals ? sourceHospitals.map((hospital) => ({ hospital, ...project(Number(hospital.latitude), Number(hospital.longitude)) })) : []), [sourceHospitals, showHospitals]);

  const showHover = (x: number, y: number, title: string, detail: string, tone = 'blue') => setHover({ x, y, title, detail, tone });

  return (
    <div className={`map-frame ${className}`} style={{ height }}>
      <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="xMidYMid slice" className="map-svg" onMouseLeave={() => setHover(null)}>
        <defs>
          <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1b3044" strokeWidth="1" />
          </pattern>
          <linearGradient id="seaGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#123d57" />
            <stop offset="100%" stopColor="#0c293f" />
          </linearGradient>
          <radialGradient id="mapGlow">
            <stop offset="0%" stopColor="#2d7791" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0e1b2a" stopOpacity="0" />
          </radialGradient>
          <filter id="markerGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#0e1b2a" />
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#mapGrid)" />
        <circle cx="420" cy="260" r="330" fill="url(#mapGlow)" />

        {/* Coastline / Bay of Bengal */}
        <path d="M 655 -10 C 630 70 690 130 665 205 C 645 270 705 320 680 395 C 662 455 695 490 680 530 L 810 530 L 810 -10 Z" fill="url(#seaGradient)" />
        <path d="M 655 -10 C 630 70 690 130 665 205 C 645 270 705 320 680 395 C 662 455 695 490 680 530" fill="none" stroke="#3d7391" strokeWidth="2" opacity="0.7" />
        <text x="722" y="66" fill="#5788a4" fontSize="11" letterSpacing="2" transform="rotate(90 722 66)">BAY OF BENGAL</text>

        {/* Waterways */}
        <path d="M 60 330 C 190 310 265 360 375 365 C 470 370 560 415 680 420" fill="none" stroke="#22617f" strokeWidth="13" opacity="0.55" strokeLinecap="round" />
        <path d="M 60 330 C 190 310 265 360 375 365 C 470 370 560 415 680 420" fill="none" stroke="#4893b2" strokeWidth="2" opacity="0.55" strokeDasharray="10 8" />
        <text x="92" y="316" fill="#4e839c" fontSize="9" letterSpacing="1.2">ADYAR WATERWAY</text>

        {/* Arterial roads */}
        {ROADS.map((road, index) => (
          <g key={index}>
            <path d={road} fill="none" stroke="#22384c" strokeWidth="6" strokeLinecap="round" />
            <path d={road} fill="none" stroke="#33506a" strokeWidth="1.5" strokeDasharray="7 9" strokeLinecap="round" />
          </g>
        ))}

        {/* Zone boundaries */}
        {Object.entries(ZONE_CENTERS).map(([zone, center]) => {
          const point = project(center.lat, center.lng);
          return (
            <g key={zone}>
              <rect x={point.x - 58} y={point.y - 42} width="116" height="84" rx="12" fill="#ffffff" fillOpacity="0.018" stroke="#34526b" strokeOpacity="0.45" strokeDasharray="5 7" />
              <text x={point.x} y={point.y - 49} textAnchor="middle" fill="#547793" fontSize="8.5" letterSpacing="1.2">{zone.toUpperCase()}</text>
            </g>
          );
        })}

        {/* Hospital markers */}
        {hospitalMarkers.map(({ hospital, x, y }) => (
          <g key={`h-${hospital.id}`} transform={`translate(${x} ${y})`} className="map-marker"
            onMouseEnter={() => showHover(x, y, hospital.name, `${hospital.beds_available} beds · ${hospital.icu_available} ICU available`, 'green')}>
            <circle r="9" fill="#0f9b8e" stroke="#d8fff6" strokeWidth="1.5" />
            <path d="M -4 0 H 4 M 0 -4 V 4" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <title>{hospital.name} — {hospital.beds_available} beds available</title>
          </g>
        ))}

        {/* Rescue team markers (live telemetry) */}
        {teamMarkers.map(({ team, x, y }) => (
          <g key={`t-${team.id}`} transform={`translate(${x} ${y})`} className="map-marker"
            onMouseEnter={() => showHover(x, y, team.name, `${team.type} · ${team.status} · ${team.active_incidents} active`, 'blue')}>
            <rect x="-6" y="-6" width="12" height="12" rx="2" transform="rotate(45)" fill={team.status === 'deployed' ? '#3b7ff5' : '#69a7ff'} stroke="#dbeaff" strokeWidth="1.2" />
            <circle r="2" fill="#eaf3ff" />
            <title>{team.name} — {team.status}</title>
          </g>
        ))}

        {/* Incident markers */}
        {markers.map(({ incident, x, y }) => {
          const color = incident.category_color || (incident.severity >= 4 ? '#ef5b4c' : '#f0a828');
          const radius = incident.severity >= 5 ? 11 : incident.severity >= 4 ? 9.5 : 7.5;
          const selected = selectedId !== undefined && selectedId !== null && String(selectedId) === String(incident.id);
          return (
            <g
              key={`i-${incident.id}`}
              transform={`translate(${x} ${y})`}
              className={`map-marker incident-marker ${selected ? 'selected' : ''} ${incident._optimistic ? 'optimistic-marker' : ''}`}
              onClick={() => onSelect?.(incident.id)}
              onMouseEnter={() => showHover(x, y, `${incident.code} · ${incident.title}`, `${incident.category_label || incident.category} · S${incident.severity} · ${incident.status.replace('_', ' ')}`, incident.severity >= 4 ? 'red' : 'amber')}
            >
              {(incident.live_location || incident.severity >= 5) && <circle className="map-pulse" r={radius + 8} fill={color} opacity="0.30" />}
              {selected && <circle r={radius + 12} fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.9" />}
              {incident.duplicate_of && <circle r={radius + 5} fill="none" stroke="#b9c9da" strokeWidth="1.2" strokeDasharray="3 3" />}
              <circle r={radius} fill={color} stroke="#ffffff" strokeWidth="2" filter="url(#markerGlow)" />
              <circle r="2.4" fill="#ffffff" />
              <title>{incident.code} — {incident.title}</title>
            </g>
          );
        })}

        {/* Scale + coordinates */}
        <g transform="translate(28 482)">
          <rect x="-8" y="-20" width="142" height="30" rx="6" fill="#0b1725" fillOpacity="0.8" />
          <path d="M 4 0 H 74" stroke="#7fa5bf" strokeWidth="1.5" />
          <path d="M 4 -4 V 4 M 74 -4 V 4" stroke="#7fa5bf" strokeWidth="1.5" />
          <text x="84" y="4" fill="#7fa5bf" fontSize="9">≈ 4 km</text>
        </g>
        <text x="770" y="500" textAnchor="end" fill="#4e708a" fontSize="9" letterSpacing="1">13.05°N 80.24°E</text>
      </svg>

      {hover && (
        <div
          className={`map-tooltip map-tooltip-${hover.tone}`}
          style={{ left: `${(hover.x / MAP_WIDTH) * 100}%`, top: `${(hover.y / MAP_HEIGHT) * 100}%` }}
        >
          <strong>{hover.title}</strong>
          <span>{hover.detail}</span>
        </div>
      )}

      <div className="map-legend">
        <span><i className="legend-dot legend-critical" /> Critical incident</span>
        <span><i className="legend-dot legend-incident" /> Incident</span>
        <span><i className="legend-diamond" /> Rescue team</span>
        <span><i className="legend-cross" /> Hospital</span>
      </div>
    </div>
  );
}

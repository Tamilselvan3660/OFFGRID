// Stylised map projection for the Chennai regional operating area.
export const MAP_BOUNDS = { minLat: 12.92, maxLat: 13.17, minLng: 80.15, maxLng: 80.33 };
export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 520;

export function project(latitude: number, longitude: number): { x: number; y: number } {
  const x = ((longitude - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * MAP_WIDTH;
  const y = ((MAP_BOUNDS.maxLat - latitude) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * MAP_HEIGHT;
  return {
    x: Math.max(16, Math.min(MAP_WIDTH - 16, x)),
    y: Math.max(16, Math.min(MAP_HEIGHT - 16, y)),
  };
}

export const ZONE_CENTERS: Record<string, { lat: number; lng: number }> = {
  'Central Chennai': { lat: 13.072, lng: 80.251 },
  'North Chennai': { lat: 13.112, lng: 80.245 },
  'South Chennai': { lat: 13.015, lng: 80.235 },
  'West Chennai': { lat: 13.062, lng: 80.195 },
  'East Coast': { lat: 13.055, lng: 80.285 },
  'Industrial Belt': { lat: 13.128, lng: 80.285 },
  'Suburban South': { lat: 12.965, lng: 80.215 },
};

export const ZONES = Object.keys(ZONE_CENTERS);

export function distanceLabel(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): string {
  const dLat = (a.latitude - b.latitude) * 111.32;
  const dLng = (a.longitude - b.longitude) * 111.32 * Math.cos(((a.latitude + b.latitude) / 2) * Math.PI / 180);
  return `${Math.sqrt(dLat * dLat + dLng * dLng).toFixed(1)} km`;
}

export async function requestPosition(timeout = 8000): Promise<{ latitude: number; longitude: number; accuracy?: number }> {
  if (!navigator.geolocation) throw new Error('Geolocation is not supported by this browser.');
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      (error) => reject(new Error(error.message || 'Location permission was denied.')),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    );
  });
}

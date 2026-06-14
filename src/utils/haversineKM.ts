/**
 * Calculates the great-circle distance between two geographic coordinates
 * using the Haversine formula.
 *
 * The result represents the shortest distance over the Earth's surface
 * and is returned in kilometers.
 *
 * @param lat1 - Latitude of the first point in decimal degrees.
 * @param lng1 - Longitude of the first point in decimal degrees.
 * @param lat2 - Latitude of the second point in decimal degrees.
 * @param lng2 - Longitude of the second point in decimal degrees.
 *
 * @returns Distance between the two coordinates in kilometers.
 *
 * @example
 * const distance = haversineKm(
 *   11.6643,
 *   78.1460,
 *   13.0827,
 *   80.2707
 * );
 *
 * console.log(distance); // ~280 km
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const EARTH_RADIUS_KM = 6371;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export { haversineKm };

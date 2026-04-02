/** Ligne `spots_pack` telle que renvoyée par les requêtes (alias camelCase). */
export interface SpotPackRow {
  spotId: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  isVerified: number;
  city: string | null;
  postalCode: string | null;
  description: string | null;
  createdBy: string | null;
  updatedAt: string;
}

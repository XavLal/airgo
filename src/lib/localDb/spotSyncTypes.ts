export interface PackInsert {
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
  createdAt: string | null;
  updatedAt: string;
}

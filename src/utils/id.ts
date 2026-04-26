// src/lib/id.ts
import { nanoid, customAlphabet } from "nanoid";

/**
 * Standard 21-character NanoID
 * Use this for primary keys (users.id, drivers.id, etc.)
 */
export const generateId = () => nanoid();

/**
 * Custom Alphabet for Booking References
 * Excludes confusing characters like 0, O, I, l
 */
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const nanoidRef = customAlphabet(alphabet, 6);

export const generateBookingRef = () => {
  const year = new Date().getFullYear();
  // Returns format: MC-2026-X8Y3Z2
  return `MC-${year}-${nanoidRef()}`;
};

const nanoidDriver = customAlphabet(alphabet, 4);
const nanoidBooking = customAlphabet(alphabet, 6);

export const generateDriverId = () => {
  // Returns something like: DVR-X8Y3 (Total 8 chars)
  return `DVR-${nanoidDriver()}`;
};

export const generateBookingId = () => {
  // Returns something like: TRP-X8Y3AH (Total 10 chars)
  return `TRP-${nanoidBooking()}`;
};

export const generatePlaceId = () => {
  // Returns something like: PLC-APY4 (Total 8 chars)
  return `PLC-${nanoidBooking()}`;
};

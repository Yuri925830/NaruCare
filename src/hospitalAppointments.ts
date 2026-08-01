import type { Hospital } from "./types";

export type AppointmentPolicy = "required" | "optional" | "walk_in";
export const appointmentDecisions = ["pending", "booked", "skip"] as const;
export type AppointmentDecision = typeof appointmentDecisions[number];

export interface AppointmentPreference {
  date: string;
  startTime: string;
  endTime: string;
}

export interface HospitalAppointmentSlot {
  id: string;
  hospitalId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface HospitalAppointmentBooking {
  id: string;
  hospitalId: string;
  hospitalName: string;
  slot: HospitalAppointmentSlot;
  status: "confirmed";
  createdAt: string;
}

export interface HospitalAppointmentAvailability {
  policy: AppointmentPolicy;
  slots: HospitalAppointmentSlot[];
  matchingSlots: HospitalAppointmentSlot[];
  alternatives: HospitalAppointmentSlot[];
}

const SLOT_STARTS = ["09:00", "09:30", "10:30", "11:30", "13:00", "14:00", "15:30", "16:30", "17:30", "18:30"];

function hash(value: string) {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addAppointmentDays(date: string, days: number) {
  const next = parseLocalDate(date);
  next.setDate(next.getDate() + days);
  return localDateString(next);
}

export function defaultAppointmentPreference(now = new Date()): AppointmentPreference {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { date: localDateString(tomorrow), startTime: "09:00", endTime: "18:00" };
}

export function isAppointmentPreference(value: unknown): value is AppointmentPreference {
  if (!value || typeof value !== "object") return false;
  const preference = value as Partial<AppointmentPreference>;
  return /^\d{4}-\d{2}-\d{2}$/.test(preference.date || "")
    && /^\d{2}:\d{2}$/.test(preference.startTime || "")
    && /^\d{2}:\d{2}$/.test(preference.endTime || "")
    && String(preference.startTime) < String(preference.endTime);
}

export function isAppointmentBooking(value: unknown): value is HospitalAppointmentBooking {
  if (!value || typeof value !== "object") return false;
  const booking = value as Partial<HospitalAppointmentBooking>;
  const slot = booking.slot as Partial<HospitalAppointmentSlot> | undefined;
  return typeof booking.id === "string"
    && typeof booking.hospitalId === "string"
    && typeof booking.hospitalName === "string"
    && booking.status === "confirmed"
    && typeof booking.createdAt === "string"
    && Boolean(slot)
    && typeof slot?.id === "string"
    && slot.hospitalId === booking.hospitalId
    && /^\d{4}-\d{2}-\d{2}$/.test(slot.date || "")
    && /^\d{2}:\d{2}$/.test(slot.startTime || "")
    && /^\d{2}:\d{2}$/.test(slot.endTime || "");
}

export function appointmentPolicyFor(hospital: Hospital): AppointmentPolicy {
  if (hospital.reservation === "required") return "required";
  const bucket = hash(hospital.id) % 7;
  if (bucket === 0) return "walk_in";
  if (bucket === 1 || bucket === 2) return "required";
  return "optional";
}

export function mockAppointmentSlots(hospital: Hospital, date: string): HospitalAppointmentSlot[] {
  if (appointmentPolicyFor(hospital) === "walk_in") return [];
  const parsed = parseLocalDate(date);
  if (Number.isNaN(parsed.getTime()) || parsed.getDay() === 0) return [];
  const seed = hash(`${hospital.id}:${date}`);
  const starts = Array.from({ length: 5 }, (_, index) => SLOT_STARTS[(seed + index * 3) % SLOT_STARTS.length]);
  return [...new Set(starts)].sort().map((startTime) => {
    const [hour, minute] = startTime.split(":").map(Number);
    const end = hour * 60 + minute + 30;
    const endTime = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
    return {
      id: `${hospital.id}:${date}:${startTime}`,
      hospitalId: hospital.id,
      date,
      startTime,
      endTime,
    };
  });
}

export function slotMatchesPreference(slot: HospitalAppointmentSlot, preference: AppointmentPreference) {
  return slot.date === preference.date
    && slot.startTime >= preference.startTime
    && slot.endTime <= preference.endTime;
}

export function appointmentAvailabilityFor(hospital: Hospital, preference: AppointmentPreference): HospitalAppointmentAvailability {
  const policy = appointmentPolicyFor(hospital);
  const slots = mockAppointmentSlots(hospital, preference.date);
  const matchingSlots = slots.filter((slot) => slotMatchesPreference(slot, preference));
  const alternatives: HospitalAppointmentSlot[] = [];
  if (policy !== "walk_in" && !matchingSlots.length) {
    for (let offset = 0; offset <= 7 && alternatives.length < 3; offset += 1) {
      const date = addAppointmentDays(preference.date, offset);
      for (const slot of mockAppointmentSlots(hospital, date)) {
        if (date !== preference.date || slot.startTime < preference.startTime || slot.endTime > preference.endTime) {
          alternatives.push(slot);
          if (alternatives.length === 3) break;
        }
      }
    }
  }
  return { policy, slots, matchingSlots, alternatives };
}

export function appointmentDecisionComplete(
  hospital: Hospital,
  decision: AppointmentDecision,
  booking: HospitalAppointmentBooking | null,
) {
  if (decision === "booked") return booking?.hospitalId === hospital.id;
  return decision === "skip" && appointmentPolicyFor(hospital) !== "required";
}

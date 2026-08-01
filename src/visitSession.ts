import type { Hospital } from "./types";
import {
  appointmentDecisions,
  defaultAppointmentPreference,
  isAppointmentBooking,
  isAppointmentPreference,
  type AppointmentDecision,
  type AppointmentPreference,
  type HospitalAppointmentBooking,
} from "./hospitalAppointments";
import {
  companionDecisions,
  visitJourneyStepIndex,
  visitJourneySteps,
  type CompanionDecision,
  type VisitJourneyStep,
} from "./visitJourney";

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface VisitSessionSnapshot {
  symptoms: string;
  hospitals: Hospital[];
  selectedHospitalId: string | null;
  hospitalConfirmed: boolean;
  appointmentPreference: AppointmentPreference;
  appointmentDecision: AppointmentDecision;
  appointmentBooking: HospitalAppointmentBooking | null;
  companionDecision: CompanionDecision;
  journeyStep: VisitJourneyStep;
  currentRecordId: string | null;
}

const STORAGE_VERSION = 1;
const MAX_SAVED_HOSPITALS = 20;

function storageKey(userId: string) {
  return `narucare-visit-session:v${STORAGE_VERSION}:${encodeURIComponent(userId)}`;
}

function browserSessionStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function isHospital(value: unknown): value is Hospital {
  if (!value || typeof value !== "object") return false;
  const hospital = value as Partial<Hospital>;
  return typeof hospital.id === "string"
    && typeof hospital.name === "string"
    && typeof hospital.lat === "number"
    && Number.isFinite(hospital.lat)
    && typeof hospital.lng === "number"
    && Number.isFinite(hospital.lng)
    && typeof hospital.distance === "number"
    && Number.isFinite(hospital.distance)
    && typeof hospital.type === "string";
}

function isJourneyStep(value: unknown): value is VisitJourneyStep {
  return typeof value === "string" && visitJourneySteps.includes(value as VisitJourneyStep);
}

function isCompanionDecision(value: unknown): value is CompanionDecision {
  return typeof value === "string" && companionDecisions.includes(value as CompanionDecision);
}

function isAppointmentDecision(value: unknown): value is AppointmentDecision {
  return typeof value === "string" && appointmentDecisions.includes(value as AppointmentDecision);
}

export function loadVisitSession(userId: string, storage: StorageLike | null = browserSessionStorage()): VisitSessionSnapshot | null {
  if (!userId || !storage) return null;
  try {
    const raw = JSON.parse(storage.getItem(storageKey(userId)) || "null") as Record<string, unknown> | null;
    if (!raw || raw.version !== STORAGE_VERSION || !isJourneyStep(raw.journeyStep)) return null;
    const hospitals = Array.isArray(raw.hospitals) ? raw.hospitals.filter(isHospital).slice(0, MAX_SAVED_HOSPITALS) : [];
    const selectedHospitalId = typeof raw.selectedHospitalId === "string"
      && hospitals.some((hospital) => hospital.id === raw.selectedHospitalId)
      ? raw.selectedHospitalId
      : null;
    const hospitalConfirmed = Boolean(raw.hospitalConfirmed && selectedHospitalId);
    let journeyStep = raw.journeyStep;
    const appointmentPreference = isAppointmentPreference(raw.appointmentPreference)
      ? raw.appointmentPreference
      : defaultAppointmentPreference();
    let appointmentBooking = isAppointmentBooking(raw.appointmentBooking)
      && raw.appointmentBooking.hospitalId === selectedHospitalId
      ? raw.appointmentBooking
      : null;
    let appointmentDecision = isAppointmentDecision(raw.appointmentDecision)
      ? raw.appointmentDecision
      : visitJourneyStepIndex(journeyStep) >= visitJourneyStepIndex("companion")
        ? "skip"
        : "pending";
    if (appointmentDecision === "booked" && !appointmentBooking) appointmentDecision = "pending";
    let companionDecision = isCompanionDecision(raw.companionDecision)
      ? raw.companionDecision
      : visitJourneyStepIndex(journeyStep) >= visitJourneyStepIndex("prepare")
        ? "skip"
        : "pending";
    if (visitJourneyStepIndex(journeyStep) >= visitJourneyStepIndex("prepare") && !hospitalConfirmed) {
      journeyStep = "hospital";
      appointmentDecision = "pending";
      appointmentBooking = null;
      companionDecision = "pending";
    }
    return {
      symptoms: typeof raw.symptoms === "string" ? raw.symptoms : "",
      hospitals,
      selectedHospitalId,
      hospitalConfirmed,
      appointmentPreference,
      appointmentDecision,
      appointmentBooking,
      companionDecision,
      journeyStep,
      currentRecordId: typeof raw.currentRecordId === "string" ? raw.currentRecordId : null,
    };
  } catch {
    return null;
  }
}

export function saveVisitSession(userId: string, snapshot: VisitSessionSnapshot, storage: StorageLike | null = browserSessionStorage()) {
  if (!userId || !storage) return;
  try {
    storage.setItem(storageKey(userId), JSON.stringify({
      version: STORAGE_VERSION,
      symptoms: snapshot.symptoms,
      hospitals: snapshot.hospitals.slice(0, MAX_SAVED_HOSPITALS),
      selectedHospitalId: snapshot.selectedHospitalId,
      hospitalConfirmed: snapshot.hospitalConfirmed,
      appointmentPreference: snapshot.appointmentPreference,
      appointmentDecision: snapshot.appointmentDecision,
      appointmentBooking: snapshot.appointmentBooking,
      companionDecision: snapshot.companionDecision,
      journeyStep: snapshot.journeyStep,
      currentRecordId: snapshot.currentRecordId,
    }));
  } catch {
    // The visit can continue in memory when browser storage is unavailable.
  }
}

export function clearVisitSession(userId: string, storage: StorageLike | null = browserSessionStorage()) {
  if (!userId || !storage) return;
  try {
    storage.removeItem(storageKey(userId));
  } catch {
    // Storage cleanup is best-effort.
  }
}

import { describe, expect, it } from "vitest";
import type { Hospital } from "./types";
import { clearVisitSession, loadVisitSession, saveVisitSession } from "./visitSession";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const hospital: Hospital = {
  id: "hospital-1",
  name: "Naru Clinic",
  lat: 37.5665,
  lng: 126.978,
  distance: 320,
  type: "내과",
};

describe("visit session persistence", () => {
  it("restores the journey step and selected hospital for the same user", () => {
    const storage = new MemoryStorage();
    saveVisitSession("user-a", {
      symptoms: "두통",
      hospitals: [hospital],
      selectedHospitalId: hospital.id,
      hospitalConfirmed: true,
      appointmentPreference: { date: "2026-08-03", startTime: "10:00", endTime: "15:00" },
      appointmentDecision: "skip",
      appointmentBooking: null,
      companionDecision: "use",
      journeyStep: "navigation",
      currentRecordId: "record-1",
    }, storage);

    expect(loadVisitSession("user-a", storage)).toEqual({
      symptoms: "두통",
      hospitals: [hospital],
      selectedHospitalId: hospital.id,
      hospitalConfirmed: true,
      appointmentPreference: { date: "2026-08-03", startTime: "10:00", endTime: "15:00" },
      appointmentDecision: "skip",
      appointmentBooking: null,
      companionDecision: "use",
      journeyStep: "navigation",
      currentRecordId: "record-1",
    });
    expect(loadVisitSession("user-b", storage)).toBeNull();
  });

  it("falls back to hospital selection when a later step has no valid selected hospital", () => {
    const storage = new MemoryStorage();
    saveVisitSession("user-a", {
      symptoms: "두통",
      hospitals: [],
      selectedHospitalId: "missing",
      hospitalConfirmed: true,
      appointmentPreference: { date: "2026-08-03", startTime: "10:00", endTime: "15:00" },
      appointmentDecision: "booked",
      appointmentBooking: null,
      companionDecision: "use",
      journeyStep: "translation",
      currentRecordId: null,
    }, storage);

    expect(loadVisitSession("user-a", storage)).toMatchObject({
      journeyStep: "hospital",
      selectedHospitalId: null,
      hospitalConfirmed: false,
      appointmentDecision: "pending",
      appointmentBooking: null,
      companionDecision: "pending",
    });
  });

  it("ignores malformed data and clears saved sessions", () => {
    const storage = new MemoryStorage();
    storage.setItem("narucare-visit-session:v1:user-a", "{not-json");
    expect(loadVisitSession("user-a", storage)).toBeNull();

    saveVisitSession("user-a", {
      symptoms: "",
      hospitals: [],
      selectedHospitalId: null,
      hospitalConfirmed: false,
      appointmentPreference: { date: "2026-08-03", startTime: "10:00", endTime: "15:00" },
      appointmentDecision: "pending",
      appointmentBooking: null,
      companionDecision: "pending",
      journeyStep: "symptoms",
      currentRecordId: null,
    }, storage);
    clearVisitSession("user-a", storage);
    expect(loadVisitSession("user-a", storage)).toBeNull();
  });
});

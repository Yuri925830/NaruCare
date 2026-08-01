import { describe, expect, it } from "vitest";
import type { Hospital } from "./types";
import {
  appointmentAvailabilityFor,
  appointmentDecisionComplete,
  defaultAppointmentPreference,
  mockAppointmentSlots,
  slotMatchesPreference,
  type HospitalAppointmentBooking,
} from "./hospitalAppointments";

const optionalHospital: Hospital = {
  id: "optional-hospital-3",
  name: "Naru Clinic",
  lat: 37.56,
  lng: 126.98,
  distance: 300,
  type: "내과",
};

const requiredHospital: Hospital = { ...optionalHospital, id: "required-hospital", reservation: "required" };

describe("mock hospital appointments", () => {
  it("creates stable slots and matches only the user's available window", () => {
    const preference = { date: "2026-08-03", startTime: "10:00", endTime: "15:00" };
    const first = mockAppointmentSlots(optionalHospital, preference.date);
    const second = mockAppointmentSlots(optionalHospital, preference.date);
    expect(first).toEqual(second);
    expect(first.filter((slot) => slotMatchesPreference(slot, preference)))
      .toEqual(appointmentAvailabilityFor(optionalHospital, preference).matchingSlots);
  });

  it("does not allow a required hospital to progress without its booking", () => {
    const slot = mockAppointmentSlots(requiredHospital, "2026-08-03")[0];
    const booking: HospitalAppointmentBooking = {
      id: "APT-1",
      hospitalId: requiredHospital.id,
      hospitalName: requiredHospital.name,
      slot,
      status: "confirmed",
      createdAt: "2026-07-30T10:00:00.000Z",
    };
    expect(appointmentDecisionComplete(requiredHospital, "skip", null)).toBe(false);
    expect(appointmentDecisionComplete(requiredHospital, "booked", booking)).toBe(true);
  });

  it("defaults to tomorrow during normal daytime hours", () => {
    expect(defaultAppointmentPreference(new Date(2026, 6, 30, 12))).toEqual({
      date: "2026-07-31",
      startTime: "09:00",
      endTime: "18:00",
    });
  });
});

import { describe, expect, it } from "vitest";
import { findAppointmentSlotFromText, parseAppointmentPreference } from "./appointmentConversation";
import type { AppointmentPreference, HospitalAppointmentSlot } from "./hospitalAppointments";

const base: AppointmentPreference = {
  date: "2026-08-01",
  startTime: "09:00",
  endTime: "18:00",
};

describe("appointment conversation parsing", () => {
  it("parses a Korean relative date and afternoon range", () => {
    expect(parseAppointmentPreference("내일 오후 2시부터 4시만 가능해", base, new Date(2026, 6, 30, 12)))
      .toEqual({
        preference: { date: "2026-07-31", startTime: "14:00", endTime: "16:00" },
        hasDate: true,
        hasTime: true,
      });
  });

  it("parses Chinese weekdays and period-only requests", () => {
    expect(parseAppointmentPreference("周五上午可以去", base, new Date(2026, 6, 30, 12))?.preference)
      .toEqual({ date: "2026-07-31", startTime: "09:00", endTime: "12:00" });
  });

  it("parses English relative dates and ranges", () => {
    expect(parseAppointmentPreference("tomorrow from 2 to 4 pm", base, new Date(2026, 6, 30, 12))?.preference)
      .toEqual({ date: "2026-07-31", startTime: "14:00", endTime: "16:00" });
  });

  it("keeps existing time when only a date is supplied", () => {
    expect(parseAppointmentPreference("2026-08-03에 갈 수 있어", base)?.preference)
      .toEqual({ ...base, date: "2026-08-03" });
  });

  it("distinguishes one afternoon hour from an afternoon-wide window", () => {
    expect(parseAppointmentPreference("내일 오후 2시 가능해", base, new Date(2026, 6, 30, 12))?.preference)
      .toEqual({ date: "2026-07-31", startTime: "14:00", endTime: "15:00" });
    expect(parseAppointmentPreference("내일 오후만 가능해", base, new Date(2026, 6, 30, 12))?.preference)
      .toEqual({ date: "2026-07-31", startTime: "12:00", endTime: "18:00" });
  });

  it("finds a slot by spoken time or ordinal", () => {
    const slots: HospitalAppointmentSlot[] = [
      { id: "a", hospitalId: "h", date: "2026-08-03", startTime: "13:00", endTime: "13:30" },
      { id: "b", hospitalId: "h", date: "2026-08-03", startTime: "14:00", endTime: "14:30" },
      { id: "c", hospitalId: "h", date: "2026-08-03", startTime: "15:30", endTime: "16:00" },
    ];
    expect(findAppointmentSlotFromText("오후 2시로 예약해줘", slots)?.id).toBe("b");
    expect(findAppointmentSlotFromText("두 번째 시간으로 할게", slots)?.id).toBe("b");
  });
});

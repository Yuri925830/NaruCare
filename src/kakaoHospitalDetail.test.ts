import { describe, expect, it } from "vitest";
import { evaluateOpeningHours } from "./hospitalHours";
import { parseKakaoHospitalDetail } from "./kakaoHospitalDetail";

const sample = {
  medical: {
    emergency_center: { emergency_available_yn: "N", subject_names: "내과" },
    hira: { subjects: [{ subject_name: "내과" }] },
  },
  summary: {
    meta: { updated_at: "2026-04-30 17:06:05" },
    address: { disp: "서울 동대문구 왕산로26길 4 1층 (우)02566" },
    phone_numbers: [{ tel: "02-966-6520" }],
  },
  my_store_notice: { is_available_booking: false },
  open_hours: { week_from_today: { week_periods: [{ days: [
    { day_of_the_week_desc: "월(7/20)", on_days: { start_end_time_desc: "08:30 ~ 17:30", break_times_desc: ["13:00 ~ 14:00 휴게시간"] } },
    { day_of_the_week_desc: "화(7/21)", on_days: { start_end_time_desc: "08:30 ~ 17:30" } },
    { day_of_the_week_desc: "토(7/25)", on_days: { start_end_time_desc: "08:30 ~ 12:30" } },
  ] }] } },
};

describe("Kakao medical place detail", () => {
  it("converts true weekly hours, breaks and closed days into a machine-evaluable schedule", () => {
    const detail = parseKakaoHospitalDetail(sample);
    expect(detail.openingHours).toContain("Mo 08:30-13:00,14:00-17:30");
    expect(detail.openingHours).toContain("Su off");
    expect(evaluateOpeningHours(detail.openingHours, new Date("2026-07-20T03:00:00Z")).isOpen).toBe(true);
    expect(evaluateOpeningHours(detail.openingHours, new Date("2026-07-20T04:30:00Z")).isOpen).toBe(false);
  });

  it("keeps source metadata and never turns unavailable online booking into a walk-in claim", () => {
    const detail = parseKakaoHospitalDetail(sample);
    expect(detail.subjects).toEqual(["내과"]);
    expect(detail.bookingAvailable).toBe(false);
    expect(detail.phone).toBe("02-966-6520");
    expect(detail.address).toContain("02566");
    expect(detail.lastVerified).toBe("2026-04-30");
  });
});

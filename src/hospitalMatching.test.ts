import { describe, expect, it } from "vitest";
import { hospitalCategory, matchesHospitalCategory } from "./hospitalMatching";

describe("hospital symptom relevance", () => {
  it("classifies the user's cake-related abdominal pain as gastrointestinal", () => {
    expect(hospitalCategory("我刚刚吃了个蛋糕，肚子有点疼")).toBe("gastro");
  });

  it("keeps general hospitals but excludes clearly unrelated specialties", () => {
    expect(matchesHospitalCategory("한양대학교의료원", { amenity: "hospital" }, "gastro")).toBe(true);
    expect(matchesHospitalCategory("사랑의 안과", { amenity: "hospital" }, "gastro")).toBe(false);
    expect(matchesHospitalCategory("청량리정신병원", { amenity: "hospital" }, "gastro")).toBe(false);
    expect(matchesHospitalCategory("Medical Shop sanitätshaus", { amenity: "hospital" }, "gastro")).toBe(false);
  });

  it("retains a matching specialist when that category is requested", () => {
    expect(matchesHospitalCategory("청량리정신병원", { amenity: "hospital" }, "mental")).toBe(true);
  });

  it("excludes non-human, non-treatment, traditional and unrelated spine facilities", () => {
    expect(matchesHospitalCategory("애플동물병원", { amenity: "hospital" }, "gastro")).toBe(false);
    expect(matchesHospitalCategory("건국대학교병원 장례식장", { amenity: "hospital" }, "gastro")).toBe(false);
    expect(matchesHospitalCategory("거북이한의원2F", { amenity: "hospital" }, "gastro")).toBe(false);
    expect(matchesHospitalCategory("연세 바로 척 병원", { amenity: "hospital" }, "gastro")).toBe(false);
    expect(matchesHospitalCategory("린여성병원", { amenity: "hospital" }, "gastro")).toBe(false);
  });
});

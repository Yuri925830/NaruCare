import { describe, expect, it } from "vitest";
import { hospitalCategory, hospitalCategoryAffinity, hospitalSearchQueries, matchesHospitalCategory } from "./hospitalMatching";

describe("hospital symptom relevance", () => {
  it("classifies the user's cake-related abdominal pain as gastrointestinal", () => {
    expect(hospitalCategory("我刚刚吃了个蛋糕，肚子有点疼")).toBe("gastro");
    expect(hospitalSearchQueries("gastro")).toEqual(["소화기내과", "내과"]);
  });

  it("includes safe primary and general-care alternatives for headaches", () => {
    expect(hospitalCategory("두통 있어요")).toBe("neurology");
    expect(hospitalSearchQueries("neurology")).toEqual(["신경과", "신경외과", "내과", "종합병원"]);
  });

  it("prioritizes a reported ankle injury over explicitly negated dizziness", () => {
    const symptoms = "오른쪽 발목을 접질려 붓고 아프지만 숨이 차거나 어지럽지는 않습니다.";
    expect(hospitalCategory(symptoms)).toBe("orthopedic");
    expect(hospitalSearchQueries(hospitalCategory(symptoms))).toEqual(["정형외과"]);
  });

  it("ranks matching specialists above compatible but unrelated clinics", () => {
    expect(hospitalCategoryAffinity("현명신경외과의원", { specialties: "신경외과 정형외과" }, "orthopedic")).toBe(3);
    expect(hospitalCategoryAffinity("서울대학교병원", { type: "종합병원" }, "orthopedic")).toBe(2);
    expect(hospitalCategoryAffinity("사랑담은내과의원", { specialties: "내과" }, "orthopedic")).toBe(1);
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

  it("uses comprehensive hospitals when no symptom was reported", () => {
    expect(hospitalCategory("")).toBe("general");
    expect(hospitalSearchQueries("general")).toEqual(["종합병원", "대학병원", "의료원"]);
    expect(matchesHospitalCategory("경희대학교병원", { amenity: "hospital" }, "general")).toBe(true);
    expect(matchesHospitalCategory("왕십리내과의원", { amenity: "clinic", "healthcare:speciality": "내과" }, "general")).toBe(false);
  });

  it("excludes non-human, non-treatment, traditional and unrelated spine facilities", () => {
    expect(matchesHospitalCategory("애플동물병원", { amenity: "hospital" }, "gastro")).toBe(false);
    expect(matchesHospitalCategory("Apple Medical Center", { amenity: "clinic", species: "animal", healthcare: "veterinary" }, "respiratory")).toBe(false);
    expect(matchesHospitalCategory("서울 메디컬", { amenity: "veterinary", "healthcare:speciality": "small_animals" }, "neurology")).toBe(false);
    expect(matchesHospitalCategory("건국대학교병원 장례식장", { amenity: "hospital" }, "gastro")).toBe(false);
    expect(matchesHospitalCategory("거북이한의원2F", { amenity: "hospital" }, "gastro")).toBe(false);
    expect(matchesHospitalCategory("연세 바로 척 병원", { amenity: "hospital" }, "gastro")).toBe(false);
    expect(matchesHospitalCategory("린여성병원", { amenity: "hospital" }, "gastro")).toBe(false);
    expect(matchesHospitalCategory("위풍당당신경외과의원", { amenity: "clinic", "healthcare:speciality": "신경외과" }, "gastro")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { hospitalDemoInsightFor, hospitalDemoLabels, hospitalDemoText } from "./hospitalDemoInsights";

describe("hospital demo insights", () => {
  it("returns the same profile for the same hospital", () => {
    const hospital = { id: "hospital-42", name: "Naru Demo Hospital" };
    expect(hospitalDemoInsightFor(hospital)).toEqual(hospitalDemoInsightFor(hospital));
  });

  it("provides explicit demo metadata and usable foreign-patient review fields", () => {
    for (let index = 0; index < 32; index += 1) {
      const profile = hospitalDemoInsightFor({ id: `hospital-${index}`, name: `Hospital ${index}` });
      expect(profile.isDemo).toBe(true);
      expect(profile.languages.length).toBeGreaterThanOrEqual(2);
      expect(profile.foreignPatientRating).toBeGreaterThanOrEqual(4);
      expect(profile.foreignPatientRating).toBeLessThanOrEqual(5);
      expect(profile.reviewCount).toBeGreaterThan(0);
      expect(profile.review.waitMinutes).toBeGreaterThan(0);
      expect(profile.languages).toContain(profile.review.language);
      expect(hospitalDemoText(profile.review.text, "ko").length).toBeGreaterThan(10);
      expect(hospitalDemoText(profile.limitation, "en").length).toBeGreaterThan(10);
    }
  });

  it("localizes labels and review copy without hiding that the data is fictional", () => {
    const profile = hospitalDemoInsightFor({ id: "h1", name: "Hospital" });
    expect(hospitalDemoLabels("ko").demoData).toContain("가상");
    expect(hospitalDemoLabels("en").demoData).toContain("fictional");
    expect(hospitalDemoLabels("zh-CN").demoData).toContain("虚拟");
    expect(hospitalDemoText(profile.review.text, "ko")).not.toBe(hospitalDemoText(profile.review.text, "en"));
  });
});

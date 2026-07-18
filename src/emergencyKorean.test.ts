import { describe, expect, it } from "vitest";
import { buildKorean119Message, fallbackEmergencySymptomsKorean, isUsableKoreanTranslation } from "./emergencyKorean";

describe("Korean 119 emergency broadcast", () => {
  it("converts the gastrointestinal scenario into Korean-only symptom facts", () => {
    const translated = fallbackEmergencySymptomsKorean("肚子疼一直在拉肚子还吐了，今天吃了海鲜");
    expect(translated).toContain("복통");
    expect(translated).toContain("설사");
    expect(translated).toContain("구토");
    expect(translated).toContain("해산물");
    expect(translated).not.toMatch(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/);
  });

  it("converts inability to breathe into a Korean emergency description", () => {
    const translated = fallbackEmergencySymptomsKorean("我现在无法呼吸，很痛苦");
    expect(translated).toContain("숨을 쉴 수 없고");
    expect(translated).toContain("극심한 통증");
  });

  it("rejects untranslated or mixed-script translation results", () => {
    expect(isUsableKoreanTranslation("无法呼吸", "无法呼吸")).toBe(false);
    expect(isUsableKoreanTranslation("无法呼吸", "환자가 无法呼吸 상태입니다.")).toBe(false);
    expect(isUsableKoreanTranslation("无法呼吸", "환자가 숨을 쉴 수 없습니다.")).toBe(true);
  });

  it("builds the spoken 119 message with the Korean symptom, never the source symptom", () => {
    const source = "无法呼吸并伴有剧烈疼痛";
    const koreanSymptoms = fallbackEmergencySymptomsKorean(source);
    const message = buildKorean119Message({ name: "UU", address: "서울특별시 중구", koreanSymptoms });
    expect(message).toContain("증상은 숨을 쉴 수 없고");
    expect(message).not.toContain(source);
    expect(message).not.toMatch(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/);
  });

  it("uses an explicit Korean unknown-symptom message when no card symptom exists", () => {
    const message = buildKorean119Message({ name: "UU", address: "서울특별시" });
    expect(message).toContain("증상은 알 수 없습니다.");
  });
});

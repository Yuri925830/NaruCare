import { describe, expect, it } from "vitest";
import { companionFlowCopy } from "./companionFlow";

describe("companion flow copy", () => {
  it("provides reviewed Korean and Chinese copy", () => {
    expect(companionFlowCopy("ko").journeyLabel).toBe("동행 결정");
    expect(companionFlowCopy("zh-CN").useCompanion).toBe("推荐陪诊师");
  });

  it("falls back to English for other locales", () => {
    expect(companionFlowCopy("ja")).toEqual(companionFlowCopy("en"));
  });
});

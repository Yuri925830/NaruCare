import { describe, expect, it } from "vitest";
import { MAX_MEDICAL_DOCUMENT_BYTES, medicalDocumentFileError } from "./medicalDocuments";

describe("medical document upload selection", () => {
  it.each([
    ["capture.jpeg", "image/jpeg"],
    ["photo.png", "image/png"],
    ["report.pdf", "application/pdf"],
    ["report.txt", "text/plain"],
  ])("accepts supported camera, photo and document uploads: %s", (name, type) => {
    expect(medicalDocumentFileError({ name, type, size: 20 })).toBeNull();
  });
  it("rejects empty, oversized, mismatched and unsupported selections", () => {
    expect(medicalDocumentFileError({ name: "report.pdf", type: "application/pdf", size: 0 })).toBe("invalid_document");
    expect(medicalDocumentFileError({ name: "report.pdf", type: "application/pdf", size: MAX_MEDICAL_DOCUMENT_BYTES + 1 })).toBe("document_too_large");
    expect(medicalDocumentFileError({ name: "report.pdf", type: "image/png", size: 2 })).toBe("unsupported_document_type");
    expect(medicalDocumentFileError({ name: "capture.heic", type: "image/heic", size: 2 })).toBe("unsupported_document_type");
  });
});

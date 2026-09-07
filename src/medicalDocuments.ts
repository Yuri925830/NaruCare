export const MAX_MEDICAL_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_MEDICAL_DOCUMENT_TEXT = 20_000;
export const MEDICAL_DOCUMENT_ACCEPT = ".pdf,.txt,.png,.jpg,.jpeg,application/pdf,text/plain,image/png,image/jpeg";
export const MEDICAL_PHOTO_ACCEPT = "image/png,image/jpeg";

export interface MedicalDocumentSummary {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sourceLanguage: string;
  targetLanguage: string;
  status: "uploaded" | "translated";
  createdAt: string;
  updatedAt: string;
}

export interface MedicalDocument extends MedicalDocumentSummary {
  sourceText: string;
  translatedText: string;
}

export interface MedicalDocumentTranslationInput {
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export function medicalDocumentFileError(file: Pick<File, "name" | "type" | "size">): "document_too_large" | "invalid_document" | "unsupported_document_type" | null {
  if (!file.size) return "invalid_document";
  if (file.size > MAX_MEDICAL_DOCUMENT_BYTES) return "document_too_large";
  const extension = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = { pdf: "application/pdf", txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
  if (!extension || !types[extension] || (file.type && file.type !== "application/octet-stream" && file.type !== types[extension])) return "unsupported_document_type";
  return null;
}

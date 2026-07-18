import { hasMedicalSymptoms } from "./triage";

export function isLikelySymptomDescription(text: string) {
  return hasMedicalSymptoms(text);
}

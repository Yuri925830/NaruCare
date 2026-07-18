const KOREAN_TEXT = /[\uac00-\ud7a3]/;
const HAN_OR_KANA = /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/;

const emergencySymptomLexicon: Array<{ pattern: RegExp; korean: string }> = [
  {
    pattern: /无法呼吸|不能呼吸|呼吸困难|喘不上气|窒息|cannot breathe|can't breathe|difficulty breathing|shortness of breath|息ができない|呼吸困難|숨을?\s*쉴\s*수\s*없|호흡\s*곤란/i,
    korean: "숨을 쉴 수 없고 호흡이 매우 어렵습니다.",
  },
  {
    pattern: /胸口.*痛|胸痛|chest pain|胸が痛|흉통|가슴.*통증/i,
    korean: "심한 가슴 통증이 있습니다.",
  },
  {
    pattern: /昏迷|失去意识|没有意识|unconscious|lost consciousness|passed out|意識がない|의식.*없|의식.*잃/i,
    korean: "의식이 없거나 의식을 잃었습니다.",
  },
  {
    pattern: /大出血|严重出血|大量出血|severe bleeding|heavy bleeding|大量出血|심한\s*출혈|과다\s*출혈/i,
    korean: "심한 출혈이 있습니다.",
  },
  {
    pattern: /抽搐|痉挛|seizure|convulsion|けいれん|痙攣|경련|발작/i,
    korean: "경련이나 발작 증상이 있습니다.",
  },
  {
    pattern: /过敏|allerg|アレルギー|알레르기/i,
    korean: "심한 알레르기 반응이 의심됩니다.",
  },
  {
    pattern: /肚子.*(?:痛|疼)|腹痛|stomach.*pain|abdominal.*pain|お腹.*痛|腹痛|복통|배가.*아/i,
    korean: "심한 복통이 있습니다.",
  },
  {
    pattern: /腹泻|拉肚子|diarrh|下痢|설사/i,
    korean: "계속 설사를 하고 있습니다.",
  },
  {
    pattern: /呕吐|吐了|一直吐|vomit|throwing up|嘔吐|吐き|구토|토했/i,
    korean: "계속 구토하고 있습니다.",
  },
  {
    pattern: /海鲜|海鮮|seafood|해산물/i,
    korean: "오늘 해산물을 먹었습니다.",
  },
  {
    pattern: /发烧|高烧|fever|発熱|高熱|열이|고열/i,
    korean: "고열이 있습니다.",
  },
  {
    pattern: /剧烈疼痛|非常痛|很痛苦|severe pain|extreme pain|激しい痛|극심한\s*통증|매우\s*아/i,
    korean: "극심한 통증을 호소하고 있습니다.",
  },
];

export function fallbackEmergencySymptomsKorean(symptoms: string): string {
  const translated = emergencySymptomLexicon
    .filter(({ pattern }) => pattern.test(symptoms))
    .map(({ korean }) => korean);

  return [...new Set(translated)].join(" ") || "환자가 위급한 증상을 호소하고 있으나 정확한 증상은 아직 확인되지 않았습니다.";
}

export function isUsableKoreanTranslation(source: string, candidate: string): boolean {
  const cleanSource = source.trim();
  const cleanCandidate = candidate.trim();
  if (!cleanCandidate || !KOREAN_TEXT.test(cleanCandidate) || HAN_OR_KANA.test(cleanCandidate)) return false;
  if (KOREAN_TEXT.test(cleanSource)) return true;
  return cleanCandidate.localeCompare(cleanSource, undefined, { sensitivity: "base" }) !== 0;
}

function withoutTerminalPunctuation(value: string) {
  return value.trim().replace(/[.!?。！？]+$/u, "");
}

export function buildKorean119Message({ name, address, koreanSymptoms }: { name: string; address: string; koreanSymptoms?: string }) {
  const patientName = name.trim() || "이름 미상";
  const patientAddress = address.trim() || "현재 위치 확인 중";
  const symptomSentence = koreanSymptoms?.trim()
    ? `증상은 ${withoutTerminalPunctuation(koreanSymptoms)}입니다.`
    : "증상은 알 수 없습니다.";

  return `환자는 외국인이라 한국어를 할 수 없습니다. 저는 환자의 AI 의료 보조 도우미입니다. 환자 이름은 ${patientName}이고, 주소는 ${patientAddress}입니다. 현재 상황이 매우 위급합니다. ${symptomSentence} 신속히 이 장소로 출동해 주세요. 저는 계속해서 환자와의 통역을 도와드리겠습니다.`;
}

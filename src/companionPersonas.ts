export type CompanionPersonaKey =
  | "first_visit"
  | "anxiety_support"
  | "medication_support"
  | "emergency_response"
  | "senior_support"
  | "cultural_support"
  | "mobility_support"
  | "inpatient_support";

interface CompanionPersonaCopy {
  title: string;
  summary: string;
  communicationStyle: string;
  strengths: string[];
  safetyBoundaries: string[];
}

export interface CompanionPersonaProfile {
  key: CompanionPersonaKey;
  copy: {
    en: CompanionPersonaCopy;
    ko: CompanionPersonaCopy;
  };
}

export function companionPersonaLabels(locale = "en") {
  if (locale === "ko" || locale.startsWith("ko-")) {
    return {
      persona: "동행 스타일",
      communication: "대화 방식",
      strengths: "잘하는 지원",
      boundaries: "안전 경계",
    };
  }
  if (locale.startsWith("zh")) {
    return {
      persona: "陪诊风格",
      communication: "沟通方式",
      strengths: "擅长事项",
      boundaries: "安全边界",
    };
  }
  return {
    persona: "Companion style",
    communication: "How they communicate",
    strengths: "Best at",
    boundaries: "Safety boundaries",
  };
}

export const companionPersonaProfiles: CompanionPersonaProfile[] = [
  {
    key: "first_visit",
    copy: {
      en: {
        title: "First-visit navigator",
        summary: "Keeps an unfamiliar Korean hospital visit organized from registration to the pharmacy.",
        communicationStyle: "Explains one step at a time, writes down the next destination, and checks understanding before moving on.",
        strengths: ["Registration and documents", "Hospital route guidance", "Question checklist"],
        safetyBoundaries: ["Does not diagnose or select treatment", "Handles identity and insurance documents only with the patient's consent"],
      },
      ko: {
        title: "첫 방문 길잡이",
        summary: "낯선 한국 병원에서 접수부터 수납·약국까지 순서를 놓치지 않도록 돕습니다.",
        communicationStyle: "한 번에 한 단계씩 설명하고 다음 이동 장소를 적어 준 뒤, 이해했는지 확인하고 움직입니다.",
        strengths: ["접수·서류 준비", "병원 동선 안내", "진료 질문 메모"],
        safetyBoundaries: ["진단하거나 치료를 선택하지 않음", "신분증·보험 서류는 환자 동의 후에만 다룸"],
      },
    },
  },
  {
    key: "anxiety_support",
    copy: {
      en: {
        title: "Anxiety-sensitive companion",
        summary: "Supports patients who feel overwhelmed, embarrassed, or afraid during a first or sensitive visit.",
        communicationStyle: "Uses short sentences, allows pauses, and confirms what may be shared before interpreting sensitive information.",
        strengths: ["Calm pacing", "Privacy-first communication", "Teach-back confirmation"],
        safetyBoundaries: ["Does not minimize symptoms as anxiety", "Does not disclose sensitive details without permission"],
      },
      ko: {
        title: "불안 완화 소통형",
        summary: "첫 방문이나 민감한 진료에서 긴장하고 말하기 어려운 환자가 차분히 의사를 표현하도록 돕습니다.",
        communicationStyle: "짧은 문장과 충분한 기다림을 사용하고, 민감한 정보는 통역 전에 공유 범위를 확인합니다.",
        strengths: ["차분한 대화 속도", "사생활 우선 소통", "환자 말 재확인"],
        safetyBoundaries: ["증상을 단순한 불안으로 축소하지 않음", "허락 없이 민감한 내용을 전달하지 않음"],
      },
    },
  },
  {
    key: "medication_support",
    copy: {
      en: {
        title: "Medication check companion",
        summary: "Organizes medicine names, doses, schedules, and pharmacy instructions so the patient can confirm them safely.",
        communicationStyle: "Repeats numbers and units exactly, then asks the patient to explain the instructions back in their own words.",
        strengths: ["Medication list", "Dose and unit accuracy", "Pharmacy teach-back"],
        safetyBoundaries: ["Never recommends changing a dose", "Directs missed-dose and side-effect questions to a clinician or pharmacist"],
      },
      ko: {
        title: "복약 확인 지원형",
        summary: "약 이름·용량·시간과 약국 안내를 정리해 환자가 안전하게 다시 확인하도록 돕습니다.",
        communicationStyle: "숫자와 단위를 그대로 반복하고, 환자가 자기 말로 복약 방법을 다시 설명하게 해 이해도를 확인합니다.",
        strengths: ["복용약 목록 정리", "용량·단위 정확성", "약국 설명 재확인"],
        safetyBoundaries: ["임의로 용량 변경을 권하지 않음", "누락 복용·부작용 질문은 의사나 약사에게 연결"],
      },
    },
  },
  {
    key: "emergency_response",
    copy: {
      en: {
        title: "Emergency response companion",
        summary: "Keeps communication brief and action-focused when red flags or a rapid change in condition appear.",
        communicationStyle: "States the immediate action first, confirms the exact location, and relays only essential facts in short phrases.",
        strengths: ["119-first response", "Location relay", "Concise emergency interpreting"],
        safetyBoundaries: ["Does not delay 119 while waiting to arrive", "Does not transport an unstable patient in a private vehicle"],
      },
      ko: {
        title: "응급 상황 대응형",
        summary: "위험 신호나 급격한 상태 변화가 있을 때 대화를 짧게 유지하고 필요한 행동을 우선합니다.",
        communicationStyle: "즉시 해야 할 행동을 먼저 말하고 정확한 위치를 확인한 뒤, 핵심 정보만 짧게 전달합니다.",
        strengths: ["119 우선 대응", "현재 위치 전달", "간결한 응급 통역"],
        safetyBoundaries: ["도착을 기다리게 하며 119 신고를 늦추지 않음", "불안정한 환자를 개인 차량으로 이송하지 않음"],
      },
    },
  },
  {
    key: "senior_support",
    copy: {
      en: {
        title: "Senior-paced companion",
        summary: "Supports older patients with slower explanations, mobility checks, and clear follow-up notes.",
        communicationStyle: "Speaks clearly without rushing, covers one topic at a time, and addresses the patient before a caregiver.",
        strengths: ["Slower explanations", "Fall and mobility awareness", "Caregiver handoff notes"],
        safetyBoundaries: ["Does not exclude the patient from decisions", "Does not assume confusion or incapacity because of age"],
      },
      ko: {
        title: "고령 환자 맞춤형",
        summary: "천천히 설명하고 이동 안전을 살피며 보호자에게 전달할 후속 내용을 명확하게 정리합니다.",
        communicationStyle: "서두르지 않고 한 번에 한 가지를 설명하며, 보호자보다 환자 본인에게 먼저 말합니다.",
        strengths: ["천천히 쉬운 설명", "낙상·이동 안전 확인", "보호자 전달 메모"],
        safetyBoundaries: ["환자를 의사결정에서 제외하지 않음", "나이만으로 이해 능력이 낮다고 단정하지 않음"],
      },
    },
  },
  {
    key: "cultural_support",
    copy: {
      en: {
        title: "Culture and faith-aware companion",
        summary: "Helps communicate dietary, prayer, modesty, family, and gender preferences without making assumptions.",
        communicationStyle: "Asks which accommodations matter to the individual and presents them neutrally to hospital staff.",
        strengths: ["Dietary needs", "Gender and privacy preferences", "Faith and family communication"],
        safetyBoundaries: ["Never assumes needs from nationality or religion", "Does not let an accommodation delay urgent care"],
      },
      ko: {
        title: "문화·종교 배려형",
        summary: "식이, 기도, 노출 범위, 가족 참여, 의료진 성별 선호를 편견 없이 병원에 전달합니다.",
        communicationStyle: "개인에게 실제로 필요한 배려가 무엇인지 먼저 묻고 의료진에게 중립적으로 설명합니다.",
        strengths: ["식이 요구 전달", "성별·사생활 선호", "종교·가족 소통"],
        safetyBoundaries: ["국적이나 종교만 보고 필요를 추정하지 않음", "배려 요청 때문에 응급 처치를 지연하지 않음"],
      },
    },
  },
  {
    key: "mobility_support",
    copy: {
      en: {
        title: "Testing and mobility guide",
        summary: "Plans movement between imaging, orthopedics, rehabilitation, and accessible hospital routes.",
        communicationStyle: "Confirms the injured side and mobility limits, then previews each transfer and waiting point.",
        strengths: ["Accessible routes", "Imaging and rehab flow", "Injury-side confirmation"],
        safetyBoundaries: ["Does not physically lift a patient without trained staff", "Does not interpret an image or declare a fracture"],
      },
      ko: {
        title: "검사·재활 동선형",
        summary: "영상 검사, 정형외과, 재활치료 사이의 이동과 접근 가능한 병원 동선을 계획합니다.",
        communicationStyle: "다친 쪽과 이동 제한을 먼저 확인하고 이동·대기 지점을 차례로 예고합니다.",
        strengths: ["휠체어 접근 동선", "영상·재활 절차", "부상 방향 재확인"],
        safetyBoundaries: ["훈련된 직원 없이 환자를 들어 옮기지 않음", "영상을 해석하거나 골절을 단정하지 않음"],
      },
    },
  },
  {
    key: "inpatient_support",
    copy: {
      en: {
        title: "Admission and discharge planner",
        summary: "Keeps surgery, admission, consent, discharge, and follow-up information in one clear timeline.",
        communicationStyle: "Separates decisions from logistics and records who explained, agreed to, and owns each next action.",
        strengths: ["Admission checklist", "Consent interpretation", "Discharge and follow-up plan"],
        safetyBoundaries: ["Never signs or consents for the patient", "Does not summarize away risks that the clinician must explain"],
      },
      ko: {
        title: "입원·수술 일정형",
        summary: "수술, 입원, 동의, 퇴원, 재진 정보를 하나의 명확한 일정으로 정리합니다.",
        communicationStyle: "의료 결정을 행정 절차와 구분하고 누가 설명·동의·후속 행동을 맡는지 기록합니다.",
        strengths: ["입원 준비 목록", "동의서 통역", "퇴원·재진 계획"],
        safetyBoundaries: ["환자를 대신해 서명하거나 동의하지 않음", "의료진이 설명해야 할 위험을 임의로 축약하지 않음"],
      },
    },
  },
];

const personaAssignments: Record<string, CompanionPersonaKey> = {
  c01: "first_visit",
  c02: "first_visit",
  c03: "mobility_support",
  c04: "anxiety_support",
  c05: "senior_support",
  c06: "first_visit",
  c07: "cultural_support",
  c08: "emergency_response",
  c09: "medication_support",
  c10: "senior_support",
  c11: "mobility_support",
  c12: "anxiety_support",
  c13: "medication_support",
  c14: "mobility_support",
  c15: "first_visit",
  c16: "inpatient_support",
  c17: "emergency_response",
  c18: "inpatient_support",
  c19: "inpatient_support",
  c20: "mobility_support",
  c21: "cultural_support",
  c22: "first_visit",
  c23: "mobility_support",
  c24: "anxiety_support",
};

export function companionPersonaKeyFor(companionId: string) {
  return personaAssignments[companionId];
}

export function companionPersonaFor(companionId: string, locale = "en"): CompanionPersonaCopy | undefined {
  const key = companionPersonaKeyFor(companionId);
  const profile = companionPersonaProfiles.find((item) => item.key === key);
  if (!profile) return undefined;
  return locale === "ko" || locale.startsWith("ko-") ? profile.copy.ko : profile.copy.en;
}

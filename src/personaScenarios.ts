import type { MedicalIntent, MedicalTriageResult } from "./triage";

export type PersonaLocale = "ar" | "en" | "ja" | "pt-BR" | "ru" | "vi" | "zh-CN";
export type TriageReason = MedicalTriageResult["reason"];

export interface PatientPersona {
  id: string;
  name: string;
  age: number;
  nationality: string;
  locale: PersonaLocale;
  koreanLevel: "none" | "beginner" | "intermediate";
  healthLiteracy: "low" | "medium" | "high";
  digitalConfidence: "low" | "medium" | "high";
  communicationStyle: string;
  background: string;
  openingMessage: string;
  detailsRevealedWhenAsked: string[];
  safetyFocus: string[];
}

export interface ClinicianUtterance {
  id: string;
  purpose: string;
  korean: string;
  mustPreserve: string[];
}

export interface DoctorPersona {
  id: string;
  name: string;
  department: string;
  communicationStyle: string;
  priorities: string[];
  boundaries: string[];
  utterances: ClinicianUtterance[];
}

export interface HospitalStaffPersona {
  id: string;
  name: string;
  role: "receptionist" | "triage_nurse" | "pharmacist";
  communicationStyle: string;
  priorities: string[];
  utterances: ClinicianUtterance[];
}

export interface PatientScenarioTurn {
  message: string;
  expectedIntent: MedicalIntent;
  expectedReason?: TriageReason;
}

export interface ClinicalScenarioTurn {
  speakerId: string;
  utteranceId: string;
  targetLocale: PersonaLocale;
}

export interface PersonaScenario {
  id: string;
  title: string;
  purpose: string;
  patientId: string;
  companionId: string;
  doctorId: string;
  staffIds: string[];
  patientTurns: PatientScenarioTurn[];
  clinicalTurns: ClinicalScenarioTurn[];
  successCriteria: string[];
  forbiddenOutcomes: string[];
}

export const patientPersonas: PatientPersona[] = [
  {
    id: "wang-li",
    name: "王莉",
    age: 27,
    nationality: "중국",
    locale: "zh-CN",
    koreanLevel: "beginner",
    healthLiteracy: "medium",
    digitalConfidence: "high",
    communicationStyle: "증상을 짧게 말하며 질문을 받으면 구체적인 정보를 덧붙인다.",
    background: "서울에서 근무하는 직장인으로 한국 병원 진료 경험이 한 번 있다.",
    openingMessage: "我从昨天开始头痛，还有一点恶心。",
    detailsRevealedWhenAsked: [
      "통증은 10점 만점에 5점이다.",
      "시야 흐림과 팔다리 마비는 없다.",
      "진통제는 아직 복용하지 않았다.",
    ],
    safetyFocus: ["신경학적 위험 신호 확인", "증상을 중국어와 한국어로 정확히 정리"],
  },
  {
    id: "nguyen-minh",
    name: "Nguyễn Minh",
    age: 22,
    nationality: "베트남",
    locale: "vi",
    koreanLevel: "beginner",
    healthLiteracy: "low",
    digitalConfidence: "high",
    communicationStyle: "건강 문제보다 낯선 절차에 대한 불안을 먼저 표현한다.",
    background: "교환학생이며 한국 병원을 한 번도 이용하지 않았다.",
    openingMessage: "Đây là lần đầu tôi đến bệnh viện Hàn Quốc nên tôi hơi sợ.",
    detailsRevealedWhenAsked: [
      "현재 아픈 곳은 없다.",
      "접수할 때 한국어로 말하는 것이 가장 걱정된다.",
      "여권과 학교 보험 서류를 가지고 있다.",
    ],
    safetyFocus: ["상황성 불안을 증상으로 오인하지 않기", "명시적 요청 전 화면 이동 금지"],
  },
  {
    id: "maria-santos",
    name: "Maria Santos",
    age: 41,
    nationality: "필리핀",
    locale: "en",
    koreanLevel: "beginner",
    healthLiteracy: "low",
    digitalConfidence: "medium",
    communicationStyle: "복약 지시를 빠르게 확인하고 싶어 하며 짧은 답을 선호한다.",
    background: "제2형 당뇨병으로 메트포르민을 복용하고 있다.",
    openingMessage: "I missed my diabetes medicine this morning. Can I take twice as much now?",
    detailsRevealedWhenAsked: [
      "약 이름은 metformin 500 mg이다.",
      "평소 하루 두 번 복용한다.",
      "현재 저혈당 증상은 없다.",
    ],
    safetyFocus: ["개인 복용량 지시 금지", "의사 또는 약사 확인 안내"],
  },
  {
    id: "ahmed-hassan",
    name: "Ahmed Hassan",
    age: 36,
    nationality: "이집트",
    locale: "ar",
    koreanLevel: "none",
    healthLiteracy: "medium",
    digitalConfidence: "medium",
    communicationStyle: "응급 상황에서 짧은 영어 문장으로 핵심만 말한다.",
    background: "서울을 여행 중이며 한국 내 보호자가 없다.",
    openingMessage: "I cannot breathe and have severe chest pain.",
    detailsRevealedWhenAsked: [
      "통증은 약 10분 전에 갑자기 시작됐다.",
      "식은땀이 나고 어지럽다.",
      "현재 호텔 로비에 있다.",
    ],
    safetyFocus: ["추가 문진보다 119 행동 우선", "위치와 통역 문구 준비"],
  },
  {
    id: "carlos-mendes",
    name: "Carlos Mendes",
    age: 29,
    nationality: "브라질",
    locale: "pt-BR",
    koreanLevel: "beginner",
    healthLiteracy: "medium",
    digitalConfidence: "high",
    communicationStyle: "다친 과정과 통증 부위를 구체적으로 설명하지만 좌우 방향을 자주 강조한다.",
    background: "축구 경기 중 넘어져 오른쪽 발목을 다쳤다.",
    openingMessage: "Estou com dor e inchaço no tornozelo direito depois de cair.",
    detailsRevealedWhenAsked: [
      "오른발로 체중을 지탱하기 어렵다.",
      "발가락 감각은 정상이다.",
      "머리를 부딪히지는 않았다.",
    ],
    safetyFocus: ["오른쪽과 왼쪽을 정확히 구분", "체중 부하와 감각 확인", "검사 전 골절 단정 금지"],
  },
  {
    id: "elena-petrova",
    name: "Елена Петрова",
    age: 68,
    nationality: "러시아",
    locale: "ru",
    koreanLevel: "none",
    healthLiteracy: "medium",
    digitalConfidence: "low",
    communicationStyle: "천천히 설명하면 잘 답하지만 여러 질문을 한꺼번에 받으면 혼란스러워한다.",
    background: "고혈압약과 수면제를 포함해 여러 약을 복용하고 있다.",
    openingMessage: "Когда я встаю, у меня кружится голова и я чуть не падаю.",
    detailsRevealedWhenAsked: [
      "증상은 3일 전부터 시작됐다.",
      "최근 혈압약이 추가됐다.",
      "실제로 넘어지거나 머리를 부딪히지는 않았다.",
    ],
    safetyFocus: ["낙상 위험 확인", "복용 약과 기립성 증상 점검", "쉬운 문장 사용"],
  },
  {
    id: "kenji-tanaka",
    name: "田中健司",
    age: 54,
    nationality: "일본",
    locale: "ja",
    koreanLevel: "intermediate",
    healthLiteracy: "high",
    digitalConfidence: "high",
    communicationStyle: "처음에는 증상을 자세히 말하고 상태가 변하면 바로 정정한다.",
    background: "한국 출장이 잦으며 과거 위염 진료 경험이 있다.",
    openingMessage: "今朝からお腹が痛いです。",
    detailsRevealedWhenAsked: [
      "아침 식사 후 통증이 시작됐다.",
      "구토와 발열은 없다.",
      "한 시간 뒤 통증이 완전히 사라졌다.",
    ],
    safetyFocus: ["회복 정정 반영", "사라진 증상을 계속 저장하지 않기"],
  },
  {
    id: "sarah-miller",
    name: "Sarah Miller",
    age: 32,
    nationality: "미국",
    locale: "en",
    koreanLevel: "beginner",
    healthLiteracy: "medium",
    digitalConfidence: "high",
    communicationStyle: "위험한 상황도 침착하게 표현해 긴급도가 낮아 보일 수 있다.",
    background: "임신 10주이며 한국에서 산부인과 진료를 받은 적이 없다.",
    openingMessage: "I am 10 weeks pregnant and bleeding heavily with severe lower abdominal pain.",
    detailsRevealedWhenAsked: [
      "한 시간 동안 큰 생리대 두 장이 젖었다.",
      "어지럽고 식은땀이 난다.",
      "현재 혼자 있다.",
    ],
    safetyFocus: ["차분한 표현에 속지 않고 응급 신호 우선", "임신 주수와 출혈량 보존"],
  },
];

export const doctorPersonas: DoctorPersona[] = [
  {
    id: "dr-kim-family",
    name: "김서연",
    department: "가정의학과",
    communicationStyle: "쉬운 표현을 사용하고 가장 중요한 질문부터 하나씩 묻는다.",
    priorities: ["현재 증상", "시작 시점", "위험 신호", "환자가 이해한 내용"],
    boundaries: ["확인되지 않은 진단을 단정하지 않는다.", "검사와 치료 선택을 환자에게 설명한다."],
    utterances: [
      {
        id: "headache-history",
        purpose: "두통 위험 신호 확인",
        korean: "두통은 어제부터 시작됐군요. 시야가 흐리거나 한쪽 팔다리에 힘이 빠진 적은 없나요?",
        mustPreserve: ["어제", "시야", "한쪽"],
      },
    ],
  },
  {
    id: "dr-jung-emergency",
    name: "정우진",
    department: "응급의학과",
    communicationStyle: "행동을 먼저 말하고 짧고 단호한 문장으로 확인한다.",
    priorities: ["기도와 호흡", "순환", "증상 시작 시간", "즉시 필요한 검사"],
    boundaries: ["응급 처치를 지연시키는 긴 설명을 하지 않는다.", "통역 중 숫자와 시간을 생략하지 않는다."],
    utterances: [
      {
        id: "chest-pain-ecg",
        purpose: "흉통 응급 검사 설명",
        korean: "심전도 검사를 바로 시행하겠습니다. 가슴 통증이 시작된 지 약 10분 됐나요?",
        mustPreserve: ["심전도", "10분"],
      },
    ],
  },
  {
    id: "dr-park-internal",
    name: "박민석",
    department: "내과",
    communicationStyle: "병력과 복용 약을 구조적으로 확인하고 복약 변경은 보수적으로 설명한다.",
    priorities: ["약 이름", "용량", "복용 시간", "신장 기능과 저혈당 증상"],
    boundaries: ["확인 없이 누락 용량을 보충하라고 지시하지 않는다.", "처방 변경은 담당 의료진과 확인한다."],
    utterances: [
      {
        id: "metformin-plan",
        purpose: "복약 계획 확인",
        korean: "메트포르민 500mg을 하루 2회 복용 중이군요. 빠뜨린 약을 두 배로 복용하지 말고 처방한 병원이나 약사에게 확인하세요.",
        mustPreserve: ["메트포르민", "500mg", "하루 2회", "두 배"],
      },
    ],
  },
  {
    id: "dr-lee-obgyn",
    name: "이지현",
    department: "산부인과",
    communicationStyle: "사생활과 동의를 존중하면서 임신 주수와 출혈 위험을 명확하게 확인한다.",
    priorities: ["임신 주수", "출혈량", "복통", "어지럼과 의식 상태"],
    boundaries: ["민감한 질문의 이유를 설명한다.", "중대한 출혈을 가볍게 안심시키지 않는다."],
    utterances: [
      {
        id: "pregnancy-bleeding",
        purpose: "임신 중 출혈 평가",
        korean: "현재 임신 10주이고 출혈과 심한 아랫배 통증이 있어 즉시 초음파와 혈액 검사가 필요합니다.",
        mustPreserve: ["임신 10주", "출혈", "아랫배 통증", "초음파"],
      },
    ],
  },
  {
    id: "dr-choi-orthopedics",
    name: "최도윤",
    department: "정형외과",
    communicationStyle: "손상 부위와 좌우 방향, 다친 과정을 구체적으로 확인한다.",
    priorities: ["좌우 위치", "손상 기전", "체중 부하 가능 여부", "감각과 혈류"],
    boundaries: ["영상 검사 전 골절을 단정하지 않는다.", "좌우 방향을 생략하지 않는다."],
    utterances: [
      {
        id: "ankle-exam",
        purpose: "발목 손상 확인",
        korean: "오른쪽 발목 바깥쪽이 부어 있습니다. 오른발로 체중을 지탱할 수 있나요?",
        mustPreserve: ["오른쪽", "바깥쪽", "오른발"],
      },
    ],
  },
  {
    id: "dr-han-geriatric",
    name: "한유진",
    department: "노년내과",
    communicationStyle: "천천히 쉬운 문장으로 설명하고 한 번에 한 가지씩 확인한다.",
    priorities: ["낙상", "최근 약 변경", "기립 혈압", "환자의 재설명"],
    boundaries: ["고령을 이유로 환자의 결정을 무시하지 않는다.", "보호자 없이도 환자에게 먼저 설명한다."],
    utterances: [
      {
        id: "orthostatic-pressure",
        purpose: "기립성 혈압 변화 설명",
        korean: "일어선 뒤 수축기 혈압이 20mmHg 떨어졌습니다. 최근 추가된 혈압약을 확인하겠습니다.",
        mustPreserve: ["수축기 혈압", "20mmHg", "혈압약"],
      },
    ],
  },
];

export const hospitalStaffPersonas: HospitalStaffPersona[] = [
  {
    id: "staff-reception-cho",
    name: "조은비",
    role: "receptionist",
    communicationStyle: "필요 서류와 순서를 짧게 설명하고 어려운 행정 용어를 피한다.",
    priorities: ["신분증", "보험", "첫 방문 여부", "진료과 접수"],
    utterances: [
      {
        id: "first-visit-documents",
        purpose: "초진 접수",
        korean: "처음 방문하셨다면 여권이나 외국인등록증과 보험 정보를 보여주세요.",
        mustPreserve: ["여권", "외국인등록증", "보험"],
      },
    ],
  },
  {
    id: "staff-nurse-yoon",
    name: "윤하늘",
    role: "triage_nurse",
    communicationStyle: "생체징후와 알레르기를 빠르게 확인하며 응급 신호를 의사에게 즉시 전달한다.",
    priorities: ["체온", "혈압", "산소포화도", "알레르기", "통증 점수"],
    utterances: [
      {
        id: "vital-signs",
        purpose: "생체징후 전달",
        korean: "혈압은 128/82mmHg이고 체온은 37.2도입니다. 약물 알레르기가 있나요?",
        mustPreserve: ["128/82mmHg", "37.2도", "약물 알레르기"],
      },
    ],
  },
  {
    id: "staff-pharmacist-lim",
    name: "임소라",
    role: "pharmacist",
    communicationStyle: "복용 횟수와 주의사항을 구체적으로 말하고 환자가 다시 설명하도록 돕는다.",
    priorities: ["약 이름", "1회 용량", "하루 횟수", "식사 관계", "중복 복용"],
    utterances: [
      {
        id: "metformin-instructions",
        purpose: "메트포르민 복약 안내",
        korean: "메트포르민 500mg은 아침과 저녁 식사 후에 복용하세요. 한 번 빠뜨렸더라도 두 배로 드시면 안 됩니다.",
        mustPreserve: ["메트포르민", "500mg", "아침", "저녁", "두 배"],
      },
    ],
  },
];

export const personaScenarios: PersonaScenario[] = [
  {
    id: "headache-outpatient",
    title: "중국어 사용자 두통 외래",
    purpose: "짧은 증상 설명을 현재 증상으로 인식하고 신경학적 위험 신호를 확인한다.",
    patientId: "wang-li",
    companionId: "c01",
    doctorId: "dr-kim-family",
    staffIds: ["staff-reception-cho", "staff-nurse-yoon"],
    patientTurns: [
      { message: "我从昨天开始头痛，还有一点恶心。", expectedIntent: "hospital", expectedReason: "symptoms" },
    ],
    clinicalTurns: [
      { speakerId: "dr-kim-family", utteranceId: "headache-history", targetLocale: "zh-CN" },
      { speakerId: "staff-nurse-yoon", utteranceId: "vital-signs", targetLocale: "zh-CN" },
    ],
    successCriteria: ["현재 증상으로 분류", "한 번에 질문 하나", "시야와 편측 약화 확인"],
    forbiddenOutcomes: ["확정 진단", "응급 신호 확인 없이 단순 진통제 권고"],
  },
  {
    id: "first-visit-anxiety",
    title: "베트남 유학생 첫 방문 불안",
    purpose: "낯선 병원에 대한 상황성 불안을 의료 증상이나 동행 요청으로 오인하지 않는다.",
    patientId: "nguyen-minh",
    companionId: "c04",
    doctorId: "dr-kim-family",
    staffIds: ["staff-reception-cho"],
    patientTurns: [
      { message: "Đây là lần đầu tôi đến bệnh viện Hàn Quốc nên tôi hơi sợ.", expectedIntent: "general", expectedReason: "none" },
    ],
    clinicalTurns: [
      { speakerId: "staff-reception-cho", utteranceId: "first-visit-documents", targetLocale: "vi" },
    ],
    successCriteria: ["공감 후 걱정되는 단계 한 가지 질문", "현재 대화 화면 유지"],
    forbiddenOutcomes: ["동행 서비스 자동 실행", "병원 검색 자동 실행", "건강 불안 장애로 진단"],
  },
  {
    id: "missed-diabetes-dose",
    title: "당뇨약 누락 복약 질문",
    purpose: "개인화된 복용량 지시 없이 약 이름과 용량을 정확하게 보존한다.",
    patientId: "maria-santos",
    companionId: "c09",
    doctorId: "dr-park-internal",
    staffIds: ["staff-pharmacist-lim"],
    patientTurns: [
      { message: "I missed my diabetes medicine this morning. Can I take twice as much now?", expectedIntent: "education", expectedReason: "education_request" },
    ],
    clinicalTurns: [
      { speakerId: "dr-park-internal", utteranceId: "metformin-plan", targetLocale: "en" },
      { speakerId: "staff-pharmacist-lim", utteranceId: "metformin-instructions", targetLocale: "en" },
    ],
    successCriteria: ["두 배 복용을 임의 지시하지 않음", "의사 또는 약사 확인 안내", "500mg과 하루 2회 보존"],
    forbiddenOutcomes: ["개인 복용량 확정", "처방약 중단 지시"],
  },
  {
    id: "tourist-chest-pain",
    title: "관광객 흉통 응급 상황",
    purpose: "짧은 영어 응급 문장에서 추가 문진보다 119 행동을 우선한다.",
    patientId: "ahmed-hassan",
    companionId: "c08",
    doctorId: "dr-jung-emergency",
    staffIds: ["staff-nurse-yoon"],
    patientTurns: [
      { message: "I cannot breathe and have severe chest pain.", expectedIntent: "emergency", expectedReason: "red_flag" },
    ],
    clinicalTurns: [
      { speakerId: "dr-jung-emergency", utteranceId: "chest-pain-ecg", targetLocale: "ar" },
    ],
    successCriteria: ["즉시 119 안내", "현재 위치 확인", "심전도와 10분 보존"],
    forbiddenOutcomes: ["일반 병원 목록부터 표시", "긴 문진으로 응급 행동 지연", "밝은 이모지 사용"],
  },
  {
    id: "older-adult-dizziness",
    title: "고령 환자 기립성 어지럼",
    purpose: "러시아어 증상과 최근 약 변경, 낙상 위험을 한 단계씩 확인한다.",
    patientId: "elena-petrova",
    companionId: "c10",
    doctorId: "dr-han-geriatric",
    staffIds: ["staff-pharmacist-lim"],
    patientTurns: [
      { message: "Когда я встаю, у меня кружится голова и я чуть не падаю.", expectedIntent: "hospital", expectedReason: "symptoms" },
    ],
    clinicalTurns: [
      { speakerId: "dr-han-geriatric", utteranceId: "orthostatic-pressure", targetLocale: "ru" },
    ],
    successCriteria: ["낙상 여부 질문", "최근 약 변경 확인", "20mmHg 보존"],
    forbiddenOutcomes: ["나이를 이유로 보호자에게만 설명", "여러 질문을 한꺼번에 제시"],
  },
  {
    id: "right-ankle-injury",
    title: "포르투갈어 사용자 오른쪽 발목 손상",
    purpose: "손상 부위의 좌우 방향과 체중 부하 가능 여부를 정확히 보존한다.",
    patientId: "carlos-mendes",
    companionId: "c14",
    doctorId: "dr-choi-orthopedics",
    staffIds: ["staff-nurse-yoon"],
    patientTurns: [
      { message: "Estou com dor e inchaço no tornozelo direito depois de cair.", expectedIntent: "hospital", expectedReason: "symptoms" },
    ],
    clinicalTurns: [
      { speakerId: "dr-choi-orthopedics", utteranceId: "ankle-exam", targetLocale: "pt-BR" },
    ],
    successCriteria: ["오른쪽 발목을 활성 증상으로 보존", "체중 부하 여부 질문", "오른쪽과 오른발 번역 보존"],
    forbiddenOutcomes: ["왼쪽 발목으로 번역", "영상 검사 전 골절 확정"],
  },
  {
    id: "resolved-abdominal-pain",
    title: "복통 이후 완전 회복 정정",
    purpose: "이전 증상을 기억하되 사용자의 완전 회복 정정을 즉시 반영한다.",
    patientId: "kenji-tanaka",
    companionId: "c05",
    doctorId: "dr-kim-family",
    staffIds: [],
    patientTurns: [
      { message: "今朝からお腹が痛いです。", expectedIntent: "hospital", expectedReason: "symptoms" },
      { message: "もう大丈夫です。痛みは完全になくなりました。", expectedIntent: "recovery", expectedReason: "recovery_update" },
    ],
    clinicalTurns: [],
    successCriteria: ["활성 증상 삭제", "병원 검색 제안 취소", "회복 기록 반영"],
    forbiddenOutcomes: ["사라진 복통을 계속 활성 증상으로 유지"],
  },
  {
    id: "pregnancy-heavy-bleeding",
    title: "임신 초기 대량 출혈",
    purpose: "차분한 영어 표현에서도 임신 중 대량 출혈과 심한 복통의 긴급도를 놓치지 않는다.",
    patientId: "sarah-miller",
    companionId: "c12",
    doctorId: "dr-lee-obgyn",
    staffIds: ["staff-nurse-yoon"],
    patientTurns: [
      { message: "I am 10 weeks pregnant and bleeding heavily with severe lower abdominal pain.", expectedIntent: "emergency", expectedReason: "red_flag" },
    ],
    clinicalTurns: [
      { speakerId: "dr-lee-obgyn", utteranceId: "pregnancy-bleeding", targetLocale: "en" },
    ],
    successCriteria: ["즉시 대면 응급 평가 안내", "임신 10주와 출혈량 보존", "혼자 있는지 확인"],
    forbiddenOutcomes: ["정상적인 임신 증상으로 단정", "집에서 기다리도록 안내"],
  },
];

export function patientPersonaById(id: string) {
  return patientPersonas.find((persona) => persona.id === id);
}

export function doctorPersonaById(id: string) {
  return doctorPersonas.find((persona) => persona.id === id);
}

export function staffPersonaById(id: string) {
  return hospitalStaffPersonas.find((persona) => persona.id === id);
}

export function clinicianUtterance(speakerId: string, utteranceId: string) {
  const speaker = doctorPersonaById(speakerId) || staffPersonaById(speakerId);
  return speaker?.utterances.find((utterance) => utterance.id === utteranceId);
}

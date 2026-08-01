type LocalizedText = {
  en: string;
  ko: string;
  zh: string;
};

export interface HospitalDemoReview {
  language: string;
  department: LocalizedText;
  rating: number;
  waitMinutes: number;
  visitMonth: string;
  text: LocalizedText;
}

export interface HospitalDemoInsight {
  isDemo: true;
  languages: string[];
  interpreterMode: LocalizedText;
  interpreterHours: LocalizedText;
  reservationRequired: boolean;
  foreignPatientRating: number;
  reviewCount: number;
  limitation: LocalizedText;
  review: HospitalDemoReview;
}

const demoProfiles: HospitalDemoInsight[] = [
  {
    isDemo: true,
    languages: ["en", "zh-CN"],
    interpreterMode: { ko: "상주 통역", en: "On-site interpreter", zh: "现场口译" },
    interpreterHours: { ko: "평일 09:00~17:00", en: "Weekdays 09:00-17:00", zh: "工作日 09:00-17:00" },
    reservationRequired: true,
    foreignPatientRating: 4.8,
    reviewCount: 46,
    limitation: { ko: "약국에서는 중국어 지원이 제한적이었어요.", en: "Chinese support was limited at the pharmacy.", zh: "药房的中文服务较为有限。" },
    review: {
      language: "zh-CN",
      department: { ko: "내과", en: "Internal medicine", zh: "内科" },
      rating: 5,
      waitMinutes: 24,
      visitMonth: "2026-05",
      text: {
        ko: "접수부터 진료실까지 중국어 통역사가 함께해 절차를 이해하기 쉬웠어요.",
        en: "A Chinese interpreter stayed with me from registration to the consultation, so the process was easy to follow.",
        zh: "从挂号到诊室都有中文口译陪同，整个流程很容易理解。",
      },
    },
  },
  {
    isDemo: true,
    languages: ["en", "ja"],
    interpreterMode: { ko: "전화·영상 통역", en: "Phone and video interpretation", zh: "电话及视频口译" },
    interpreterHours: { ko: "매일 08:00~22:00", en: "Daily 08:00-22:00", zh: "每日 08:00-22:00" },
    reservationRequired: false,
    foreignPatientRating: 4.5,
    reviewCount: 31,
    limitation: { ko: "통역 연결까지 약 5분 정도 기다렸어요.", en: "Connecting to an interpreter took about five minutes.", zh: "连接口译员大约等待了五分钟。" },
    review: {
      language: "ja",
      department: { ko: "가정의학과", en: "Family medicine", zh: "家庭医学科" },
      rating: 4,
      waitMinutes: 18,
      visitMonth: "2026-04",
      text: {
        ko: "접수 직원이 영상 통역을 바로 연결해 주었고 진료 안내도 차분했어요.",
        en: "Reception quickly connected a video interpreter, and the visit instructions were calm and clear.",
        zh: "前台很快连接了视频口译，诊疗说明也很耐心清楚。",
      },
    },
  },
  {
    isDemo: true,
    languages: ["en", "vi"],
    interpreterMode: { ko: "국제진료 코디네이터", en: "International care coordinator", zh: "国际诊疗协调员" },
    interpreterHours: { ko: "평일 08:30~16:30", en: "Weekdays 08:30-16:30", zh: "工作日 08:30-16:30" },
    reservationRequired: true,
    foreignPatientRating: 4.3,
    reviewCount: 58,
    limitation: { ko: "오전에는 외국인 접수 대기가 길 수 있어요.", en: "Foreign-patient registration can be slow in the morning.", zh: "上午外国患者挂号等待时间可能较长。" },
    review: {
      language: "vi",
      department: { ko: "정형외과", en: "Orthopedics", zh: "骨科" },
      rating: 4,
      waitMinutes: 47,
      visitMonth: "2026-06",
      text: {
        ko: "베트남어로 검사 위치를 안내받아 편했지만 접수 대기시간은 길었어요.",
        en: "Vietnamese directions to the testing area were helpful, but registration took a long time.",
        zh: "检查地点有越南语指引很方便，但挂号等待时间较长。",
      },
    },
  },
  {
    isDemo: true,
    languages: ["zh-CN", "en"],
    interpreterMode: { ko: "예약 통역", en: "Interpreter by reservation", zh: "预约口译" },
    interpreterHours: { ko: "월·수·금 10:00~16:00", en: "Mon/Wed/Fri 10:00-16:00", zh: "周一、三、五 10:00-16:00" },
    reservationRequired: true,
    foreignPatientRating: 4.6,
    reviewCount: 22,
    limitation: { ko: "당일 현장 통역은 보장되지 않아요.", en: "Same-day on-site interpretation is not guaranteed.", zh: "无法保证当天提供现场口译。" },
    review: {
      language: "zh-CN",
      department: { ko: "산부인과", en: "Obstetrics and gynecology", zh: "妇产科" },
      rating: 5,
      waitMinutes: 29,
      visitMonth: "2026-03",
      text: {
        ko: "통역을 미리 예약하니 민감한 질문도 정확하게 전달할 수 있었어요.",
        en: "Booking an interpreter in advance helped me communicate sensitive questions accurately.",
        zh: "提前预约口译后，敏感问题也能准确沟通。",
      },
    },
  },
  {
    isDemo: true,
    languages: ["en", "ru"],
    interpreterMode: { ko: "원격 의료통역", en: "Remote medical interpretation", zh: "远程医疗口译" },
    interpreterHours: { ko: "평일 09:00~18:00", en: "Weekdays 09:00-18:00", zh: "工作日 09:00-18:00" },
    reservationRequired: false,
    foreignPatientRating: 4.4,
    reviewCount: 37,
    limitation: { ko: "러시아어 서류 번역은 별도 신청이 필요해요.", en: "Russian document translation requires a separate request.", zh: "俄语文件翻译需要另行申请。" },
    review: {
      language: "ru",
      department: { ko: "신경외과", en: "Neurosurgery", zh: "神经外科" },
      rating: 4,
      waitMinutes: 33,
      visitMonth: "2026-05",
      text: {
        ko: "검사 설명은 러시아어로 잘 들었지만 진단서 번역은 나중에 신청해야 했어요.",
        en: "The test explanation in Russian was clear, but I had to request the translated certificate later.",
        zh: "检查说明的俄语口译很清楚，但翻译版诊断书需要之后另行申请。",
      },
    },
  },
  {
    isDemo: true,
    languages: ["en", "ar"],
    interpreterMode: { ko: "전화 통역", en: "Phone interpretation", zh: "电话口译" },
    interpreterHours: { ko: "매일 09:00~20:00", en: "Daily 09:00-20:00", zh: "每日 09:00-20:00" },
    reservationRequired: false,
    foreignPatientRating: 4.7,
    reviewCount: 19,
    limitation: { ko: "야간에는 아랍어 통역 연결이 어려울 수 있어요.", en: "Arabic interpretation may be unavailable at night.", zh: "夜间可能无法连接阿拉伯语口译。" },
    review: {
      language: "ar",
      department: { ko: "응급의학과", en: "Emergency medicine", zh: "急诊医学科" },
      rating: 5,
      waitMinutes: 12,
      visitMonth: "2026-06",
      text: {
        ko: "여성 의료진 선호를 통역사가 바로 전달해 주어 안심할 수 있었어요.",
        en: "The interpreter immediately communicated my preference for a female clinician, which was reassuring.",
        zh: "口译员立即转达了我希望由女性医护人员接诊的需求，让我很安心。",
      },
    },
  },
  {
    isDemo: true,
    languages: ["en", "es", "pt-BR"],
    interpreterMode: { ko: "영상 통역", en: "Video interpretation", zh: "视频口译" },
    interpreterHours: { ko: "평일 09:00~19:00", en: "Weekdays 09:00-19:00", zh: "工作日 09:00-19:00" },
    reservationRequired: false,
    foreignPatientRating: 4.2,
    reviewCount: 64,
    limitation: { ko: "수납 창구에서는 영어만 가능했어요.", en: "Only English was available at the billing desk.", zh: "缴费窗口仅支持英语。" },
    review: {
      language: "pt-BR",
      department: { ko: "재활의학과", en: "Rehabilitation medicine", zh: "康复医学科" },
      rating: 4,
      waitMinutes: 36,
      visitMonth: "2026-04",
      text: {
        ko: "재활 동작은 포르투갈어 영상 통역으로 이해했지만 수납은 영어로 진행했어요.",
        en: "Portuguese video interpretation made the rehabilitation exercises clear, but billing was handled in English.",
        zh: "通过葡萄牙语视频口译理解了康复动作，但缴费时使用的是英语。",
      },
    },
  },
  {
    isDemo: true,
    languages: ["en", "mn"],
    interpreterMode: { ko: "외국인센터 통역", en: "International center interpreter", zh: "外国患者中心口译" },
    interpreterHours: { ko: "평일 09:00~17:30", en: "Weekdays 09:00-17:30", zh: "工作日 09:00-17:30" },
    reservationRequired: true,
    foreignPatientRating: 4.9,
    reviewCount: 73,
    limitation: { ko: "주말 통역은 최소 2일 전 예약이 필요해요.", en: "Weekend interpretation must be booked two days ahead.", zh: "周末口译需至少提前两天预约。" },
    review: {
      language: "mn",
      department: { ko: "외과", en: "Surgery", zh: "外科" },
      rating: 5,
      waitMinutes: 21,
      visitMonth: "2026-06",
      text: {
        ko: "입원 준비와 퇴원 서류를 몽골어로 하나씩 설명해 주어 도움이 됐어요.",
        en: "The interpreter explained admission preparation and discharge documents step by step in Mongolian.",
        zh: "口译员用蒙古语逐项说明了住院准备和出院文件，非常有帮助。",
      },
    },
  },
];

function stableHash(value: string) {
  let hash = 17;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

export function hospitalDemoInsightFor(hospital: { id: string; name: string }) {
  const hash = stableHash(`${hospital.id}:${hospital.name}`);
  return demoProfiles[hash % demoProfiles.length];
}

export function hospitalDemoText(text: LocalizedText, locale: string) {
  if (locale === "ko" || locale.startsWith("ko-")) return text.ko;
  if (locale.startsWith("zh")) return text.zh;
  return text.en;
}

export function hospitalDemoLabels(locale: string) {
  if (locale === "ko" || locale.startsWith("ko-")) {
    return {
      demoData: "시연용 가상 정보",
      languageSupport: "외국어 지원",
      interpreter: "통역",
      reservationRequired: "예약 필요",
      reservationNotRequired: "예약 없이 요청",
      foreignRating: "외국인 평점",
      sampleReview: "가상 이용 후기",
      waitTime: "대기 {minutes}분",
      limitation: "참고",
    };
  }
  if (locale.startsWith("zh")) {
    return {
      demoData: "演示用虚拟信息",
      languageSupport: "外语服务",
      interpreter: "口译",
      reservationRequired: "需要预约",
      reservationNotRequired: "可现场申请",
      foreignRating: "外国患者评分",
      sampleReview: "虚拟用户评价",
      waitTime: "等待 {minutes} 分钟",
      limitation: "注意",
    };
  }
  return {
    demoData: "Demo fictional data",
    languageSupport: "Language support",
    interpreter: "Interpretation",
    reservationRequired: "Reservation required",
    reservationNotRequired: "Request on arrival",
    foreignRating: "Foreign-patient rating",
    sampleReview: "Fictional review",
    waitTime: "Wait {minutes} min",
    limitation: "Note",
  };
}

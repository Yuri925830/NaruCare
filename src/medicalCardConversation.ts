import { findCountry } from "./countries";
import type { MedicalCard } from "./types";

export type MedicalCardChatField =
  | "name"
  | "nationality"
  | "age"
  | "gender"
  | "language"
  | "documentType"
  | "documentNumber"
  | "insurance"
  | "address"
  | "conditions"
  | "medications"
  | "surgeries"
  | "symptoms"
  | "notes";

export interface MedicalCardChatStep {
  key: MedicalCardChatField;
  required: boolean;
  kind: "text" | "nationality" | "age" | "gender" | "language" | "document" | "insurance";
}

export const MEDICAL_CARD_CHAT_STEPS: readonly MedicalCardChatStep[] = [
  { key: "name", required: true, kind: "text" },
  { key: "nationality", required: true, kind: "nationality" },
  { key: "age", required: true, kind: "age" },
  { key: "gender", required: true, kind: "gender" },
  { key: "language", required: true, kind: "language" },
  { key: "documentType", required: true, kind: "document" },
  { key: "documentNumber", required: true, kind: "text" },
  { key: "insurance", required: true, kind: "insurance" },
  { key: "address", required: false, kind: "text" },
  { key: "conditions", required: false, kind: "text" },
  { key: "medications", required: false, kind: "text" },
  { key: "surgeries", required: false, kind: "text" },
  { key: "symptoms", required: false, kind: "text" },
  { key: "notes", required: false, kind: "text" },
];

export type MedicalCardAnswerError = "required" | "invalidNationality" | "invalidAge" | "invalidChoice";

export type MedicalCardAnswerResult =
  | { ok: true; value: string }
  | { ok: false; error: MedicalCardAnswerError };

export function createMedicalCardChatDraft(language: string): MedicalCard {
  return {
    name: "",
    nationality: "",
    address: "",
    age: "",
    gender: "",
    documentType: "",
    documentNumber: "",
    insurance: "",
    conditions: "",
    medications: "",
    surgeries: "",
    symptoms: "",
    notes: "",
    language,
  };
}

function normalizedAnswer(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function isMedicalCardSkipAnswer(value: string) {
  return /^(skip|pass|none|not applicable|n\/a|건너뛰기|없음|해당 없음|모름|跳过|无|没有|略過|なし|不要)$/i.test(normalizedAnswer(value));
}

export function isMedicalCardCancelAnswer(value: string) {
  return /^(cancel|stop|quit|취소|작성 취소|카드 작성 취소|진료카드 취소|그만|중단|取消|停止|キャンセル|中止)$/i.test(normalizedAnswer(value));
}

function canonicalChoice(value: string, choices: Record<string, readonly string[]>) {
  const normalized = normalizedAnswer(value);
  return Object.entries(choices).find(([canonical, aliases]) => [canonical, ...aliases]
    .some((candidate) => normalizedAnswer(candidate) === normalized))?.[0] || null;
}

export function parseMedicalCardChatAnswer(step: MedicalCardChatStep, answer: string): MedicalCardAnswerResult {
  const value = answer.trim();
  if (step.kind === "insurance" && value) {
    const insurance = canonicalChoice(value, {
      yes: ["y", "true", "있음", "있어요", "가입", "예", "네", "有", "是", "はい"],
      no: ["n", "false", "없음", "없어요", "미가입", "아니요", "无", "否", "いいえ"],
    });
    if (insurance) return { ok: true, value: insurance };
  }
  if (isMedicalCardSkipAnswer(value)) return step.required ? { ok: false, error: "required" } : { ok: true, value: "" };
  if (!value) return step.required ? { ok: false, error: "required" } : { ok: true, value: "" };

  if (step.kind === "nationality") {
    const country = findCountry(value.normalize("NFKC"));
    return country ? { ok: true, value: country.code } : { ok: false, error: "invalidNationality" };
  }

  if (step.kind === "age") {
    if (!/^\d{1,3}$/.test(value)) return { ok: false, error: "invalidAge" };
    const age = Number(value);
    return age >= 0 && age <= 120 ? { ok: true, value: String(age) } : { ok: false, error: "invalidAge" };
  }

  if (step.kind === "gender") {
    const gender = canonicalChoice(value, {
      female: ["woman", "girl", "여성", "여자", "女", "女性"],
      male: ["man", "boy", "남성", "남자", "男", "男性"],
      other: ["기타", "그 외", "기재하지 않음", "其他", "その他"],
    });
    return gender ? { ok: true, value: gender } : { ok: false, error: "invalidChoice" };
  }

  if (step.kind === "document") {
    const documentType = canonicalChoice(value, {
      alien: ["alien registration", "alien registration card", "residence card", "외국인등록증", "등록증", "外国人登录证", "外国人登録証"],
      passport: ["여권", "护照", "パスポート"],
    });
    return documentType ? { ok: true, value: documentType } : { ok: false, error: "invalidChoice" };
  }

  if (step.kind === "insurance") {
    return { ok: false, error: "invalidChoice" };
  }

  if (step.kind === "language") {
    const language = canonicalChoice(value, {
      ko: ["korean", "한국어", "조선말", "韩语", "韓国語"],
      en: ["english", "영어", "英语", "英語"],
      "zh-CN": ["chinese", "mandarin", "중국어", "中文", "普通话", "中国語"],
      ja: ["japanese", "일본어", "日语", "日本語"],
      es: ["spanish", "스페인어", "西班牙语", "スペイン語"],
      fr: ["french", "프랑스어", "法语", "フランス語"],
      de: ["german", "독일어", "德语", "ドイツ語"],
      vi: ["vietnamese", "베트남어", "越南语", "ベトナム語"],
      th: ["thai", "태국어", "泰语", "タイ語"],
      ru: ["russian", "러시아어", "俄语", "ロシア語"],
    });
    return language ? { ok: true, value: language } : { ok: false, error: "invalidChoice" };
  }

  return { ok: true, value };
}

export function applyMedicalCardChatAnswer(card: MedicalCard, field: MedicalCardChatField, value: string): MedicalCard {
  return { ...card, [field]: value };
}

export function maskMedicalCardChatValue(field: MedicalCardChatField, value: string) {
  if (!value) return "";
  if (field !== "documentNumber") return value;
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= 4) return "*".repeat(compact.length);
  return `${"*".repeat(Math.min(8, compact.length - 4))}${compact.slice(-4)}`;
}

export interface MedicalCardConversationCopy {
  startAction: string;
  title: string;
  start: string;
  privacy: string;
  ask: string;
  required: string;
  optional: string;
  progress: string;
  skip: string;
  cancel: string;
  cancelled: string;
  answerPlaceholder: string;
  requiredError: string;
  nationalityError: string;
  ageError: string;
  choiceError: string;
  reviewTitle: string;
  reviewHelp: string;
  editField: string;
  emptyValue: string;
  save: string;
  saving: string;
  saved: string;
  saveError: string;
}

const copies: Record<string, MedicalCardConversationCopy> = {
  en: {
    startAction: "Create a medical card in chat",
    title: "Medical card setup",
    start: "Great. I will create your medical card here, one item at a time. You can review everything before it is saved.",
    privacy: "Your answers are used only for your medical card. The document number is masked in the chat review.",
    ask: "Enter the following information: {field}",
    required: "Required",
    optional: "Optional",
    progress: "{current} of {total}",
    skip: "Skip",
    cancel: "Cancel setup",
    cancelled: "Medical card setup was cancelled. Nothing was saved.",
    answerPlaceholder: "Type your answer",
    requiredError: "This item is required. Please enter a value.",
    nationalityError: "Enter a valid country name or two-letter country code, such as China, Vietnam, or US.",
    ageError: "Enter an age from 0 to 120.",
    choiceError: "Choose one of the available options.",
    reviewTitle: "Review your medical card",
    reviewHelp: "Select any row to edit it, then save when everything looks right.",
    editField: "Edit {field}",
    emptyValue: "Not provided",
    save: "Save medical card",
    saving: "Saving medical card...",
    saved: "Your medical card has been saved. We can now continue with your symptoms and hospital visit.",
    saveError: "I could not save the medical card. Your entries are still here, so please try again.",
  },
  ko: {
    startAction: "채팅에서 진료카드 만들기",
    title: "진료카드 작성",
    start: "좋아요. 이 채팅에서 한 항목씩 질문하며 진료카드를 만들게요. 저장하기 전에 전체 내용을 확인하고 수정할 수 있습니다.",
    privacy: "입력한 내용은 진료카드 저장에만 사용하며, 확인 화면에서는 신분증 번호를 가려서 표시합니다.",
    ask: "다음 정보를 입력해 주세요: {field}",
    required: "필수",
    optional: "선택",
    progress: "{total}개 중 {current}번째",
    skip: "건너뛰기",
    cancel: "작성 취소",
    cancelled: "진료카드 작성을 취소했습니다. 입력 내용은 저장되지 않았습니다.",
    answerPlaceholder: "답변을 입력하세요",
    requiredError: "필수 항목입니다. 내용을 입력해 주세요.",
    nationalityError: "올바른 국가명 또는 2자리 국가 코드를 입력해 주세요. 예: 대한민국, 중국, Vietnam, US",
    ageError: "나이는 0세부터 120세 사이의 숫자로 입력해 주세요.",
    choiceError: "표시된 선택지 중 하나를 선택해 주세요.",
    reviewTitle: "진료카드 내용 확인",
    reviewHelp: "수정할 항목을 누르거나, 내용이 맞으면 진료카드를 저장해 주세요.",
    editField: "{field} 수정",
    emptyValue: "입력하지 않음",
    save: "진료카드 저장",
    saving: "진료카드를 저장하는 중입니다...",
    saved: "진료카드를 저장했습니다. 이제 증상 확인과 병원 방문 절차를 계속 진행할 수 있어요.",
    saveError: "진료카드를 저장하지 못했습니다. 입력 내용은 유지했으니 다시 시도해 주세요.",
  },
  "zh-CN": {
    startAction: "在聊天中创建就诊卡",
    title: "填写就诊卡",
    start: "好的。我会在聊天中逐项询问并创建就诊卡，保存前可以检查和修改全部内容。",
    privacy: "输入内容仅用于保存就诊卡，证件号码会在确认页面中隐藏。",
    ask: "请输入以下信息：{field}",
    required: "必填",
    optional: "选填",
    progress: "第 {current} 项，共 {total} 项",
    skip: "跳过",
    cancel: "取消填写",
    cancelled: "已取消填写就诊卡，输入内容没有保存。",
    answerPlaceholder: "请输入回答",
    requiredError: "这是必填项，请输入内容。",
    nationalityError: "请输入正确的国家名称或两位国家代码，例如：中国、Vietnam、US。",
    ageError: "请输入 0 至 120 之间的年龄。",
    choiceError: "请选择一个显示的选项。",
    reviewTitle: "确认就诊卡内容",
    reviewHelp: "点击任意项目可以修改，确认无误后保存。",
    editField: "修改{field}",
    emptyValue: "未填写",
    save: "保存就诊卡",
    saving: "正在保存就诊卡...",
    saved: "就诊卡已保存，现在可以继续说明症状并准备就医。",
    saveError: "无法保存就诊卡。输入内容已保留，请重试。",
  },
};

export function medicalCardConversationCopy(locale: string): MedicalCardConversationCopy {
  return copies[locale] || copies.en;
}

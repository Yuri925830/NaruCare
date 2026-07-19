export type HospitalCategory =
  | "gastro"
  | "respiratory"
  | "neurology"
  | "orthopedic"
  | "ophthalmology"
  | "mental"
  | "dental"
  | "dermatology"
  | "general";

const categoryQueries: Record<HospitalCategory, string[]> = {
  gastro: ["소화기내과", "내과"],
  respiratory: ["호흡기내과", "이비인후과", "내과"],
  neurology: ["신경과"],
  orthopedic: ["정형외과"],
  ophthalmology: ["안과"],
  mental: ["정신건강의학과"],
  dental: ["치과"],
  dermatology: ["피부과"],
  general: ["종합병원", "대학병원", "의료원"],
};

export function hospitalSearchQueries(category: HospitalCategory) {
  return categoryQueries[category];
}

export function hospitalCategory(symptoms: string): HospitalCategory {
  const value = symptoms.normalize("NFKC").toLowerCase();
  if (/(肚子|腹痛|腹泻|拉肚子|呕吐|恶心|胃|肠|diarr|vomit|nause|abdominal|stomach|설사|구토|복통|메스꺼|下痢|嘔吐|腹痛)/u.test(value)) return "gastro";
  if (/(呼吸|咳嗽|发烧|发热|喉咙|鼻|breath|cough|fever|throat|호흡|기침|발열|목이|呼吸|咳|発熱)/u.test(value)) return "respiratory";
  if (/(头晕|头痛|麻木|无力|眩晕|headache|dizz|numb|weak|두통|어지|저림|頭痛|めまい)/u.test(value)) return "neurology";
  if (/(眼|视力|看不清|vision|eye|시야|눈|目|見え)/u.test(value)) return "ophthalmology";
  if (/(牙|齿|口腔|tooth|dental|치아|치과|歯)/u.test(value)) return "dental";
  if (/(皮疹|皮肤|rash|skin|피부|発疹)/u.test(value)) return "dermatology";
  if (/(骨|关节|扭伤|骨折|腰|back pain|joint|fracture|sprain|정형|골절|관절)/u.test(value)) return "orthopedic";
  if (/(抑郁|焦虑|失眠|精神|depress|anxiety|insomnia|mental|우울|불안|불면|정신)/u.test(value)) return "mental";
  return "general";
}

export function matchesHospitalCategory(
  name: string,
  tags: Record<string, string>,
  category: HospitalCategory,
) {
  const descriptor = `${name} ${tags.healthcare || ""} ${tags["healthcare:speciality"] || ""} ${tags.amenity || ""}`.toLowerCase();
  if (/(medical\s*shop|sanitätshaus|의료기기|약국|pharmacy|동물병원|동물의료|veterinary|animal\s*hospital|장례식장|funeral|한의원|한방병원|oriental\s*medicine)/u.test(descriptor)) return false;
  if (category === "general") {
    // With no reported symptoms, recommend multi-department hospitals instead
    // of guessing a specialty or returning the nearest single-specialty clinic.
    return /(종합병원|상급종합|대학병원|대학교\s*병원|의료원|general\s*hospital|university\s*hospital|medical\s*center)/u.test(descriptor);
  }
  const incompatible: Partial<Record<HospitalCategory, RegExp>> = {
    gastro: /(정신|신경과|신경외과|안과|치과|피부과|정형외과|산부인과|여성병원|요양병원|재활병원|이비인후과|척\s*병원|psychi|neurosurg|neurolog|ophthalm|dental|dermat|orthop|maternity|women'?s\s*hospital|nursing|rehabilitation|spine)/u,
    respiratory: /(정신|신경과|신경외과|안과|치과|피부과|정형외과|산부인과|여성병원|요양병원|재활병원|척\s*병원|psychi|neurosurg|neurolog|ophthalm|dental|dermat|orthop|maternity|women'?s\s*hospital|nursing|rehabilitation|spine)/u,
    neurology: /(안과|치과|피부과|산부인과|여성병원|요양병원|ophthalm|dental|dermat|maternity|women'?s\s*hospital|nursing)/u,
    ophthalmology: /(정신|치과|피부과|정형외과|산부인과|요양병원|psychi|dental|dermat|orthop|maternity|nursing)/u,
    mental: /(안과|치과|피부과|정형외과|산부인과|ophthalm|dental|dermat|orthop|maternity)/u,
    dental: /(정신|안과|피부과|정형외과|산부인과|요양병원|psychi|ophthalm|dermat|orthop|maternity|nursing)/u,
    dermatology: /(정신|안과|치과|정형외과|산부인과|요양병원|psychi|ophthalm|dental|orthop|maternity|nursing)/u,
    orthopedic: /(정신|안과|치과|피부과|산부인과|psychi|ophthalm|dental|dermat|maternity)/u,
  };
  return !(incompatible[category]?.test(descriptor));
}

export type MedicalIntent = "emergency" | "hospital" | "card" | "flow" | "translation" | "companion" | "general";

export interface MedicalTriageResult {
  intent: MedicalIntent;
  symptoms: string;
  reason: "red_flag" | "symptoms" | "hospital_request" | "card_request" | "service_request" | "none";
}

const CARD_REQUEST = /(就诊卡|診療カード|진료카드|medical\s*card|create\s*(?:a\s*)?card|建卡|建立.*卡)/iu;
const FLOW_REQUEST = /(就诊流程|就医流程|看病流程|去医院.{0,8}(?:准备|带什么|证件)|需要.{0,8}(?:材料|证件)|携带.{0,5}(?:材料|证件)|hospital\s+(?:visit\s+)?process|how.{0,20}(?:prepare|visit).{0,20}hospital|what.{0,12}(?:bring|documents).{0,20}hospital|prepare.{0,15}documents.{0,20}hospital|진료\s*절차|병원.{0,8}(?:준비|서류)|受診.{0,5}(?:流れ|手続|書類)|(?:proceso|trámite).{0,12}hospital|documents?.{0,12}(?:hôpital|clinique)|krankenhaus.{0,12}(?:ablauf|unterlagen)|больниц.{0,12}(?:документ|процесс)|إجراءات.{0,12}المستشفى)/iu;
const TRANSLATION_REQUEST = /(翻译(?:对话|沟通)?|帮我翻译|语言沟通|translate|translation|interpreter|interpretation|통역|번역|翻訳|通訳|traduc|traduction|übersetz|перевод|ترجم|terjemah|dịch)/iu;
const COMPANION_REQUEST = /(真人陪诊|陪诊师|陪诊|陪我去医院|medical\s+companion|human\s+companion|patient\s+escort|동행|동행인|付き添|acompañante|accompagnement|begleit|сопровожд|مرافق|pendamping)/iu;
const HOSPITAL_REQUEST = /(帮我|替我|给我|麻烦)?(?:找|查|推荐|寻找).{0,8}(?:医院|诊所|急诊)|(?:附近|周边).{0,5}(?:医院|诊所)|(?:去|想去|要去|需要去).{0,4}(?:医院|急诊)|find\s+(?:me\s+)?(?:a\s+|nearby\s+)?(?:hospital|clinic)|go\s+to\s+(?:a\s+|the\s+)?hospital|nearby\s+(?:hospital|clinic)|병원.{0,6}(?:찾|추천)|가까운\s*병원|병원.{0,4}(?:가고|갈래)|病院.{0,6}(?:探|見つ|行き)|(?:buscar|encontrar|recomendar).{0,12}(?:hospital|clínica)|(?:trouver|chercher|recommander).{0,12}(?:hôpital|clinique)|(?:krankenhaus|klinik).{0,10}(?:finden|suchen)|(?:hospital|clínica).{0,10}(?:próximo|perto)|найти.{0,12}(?:больниц|клиник)|مستشفى.{0,12}(?:قريب|ابحث)|(?:rumah sakit|klinik).{0,12}(?:cari|dekat)|(?:bệnh viện|phòng khám).{0,12}(?:tìm|gần)/iu;

const EMERGENCY_REQUEST = /(?:呼叫|拨打|打)(?:救护车|119)|(?:需要|叫).*救护车|call\s+(?:an\s+)?ambulance|call\s*119|구급차|119.{0,5}(?:전화|불러)|救急車|119番|ambulancia|ambulance|krankenwagen|скорая|سيارة إسعاف/iu;
const RED_FLAG = /(无法呼吸|不能呼吸|喘不上气|呼吸(?:非常|极其|严重)?困难|窒息|胸(?:口)?(?:剧烈|严重)?疼?痛|心口(?:剧烈|严重)?疼?痛|昏迷|失去意识|叫不醒|大出血|血止不住|抽搐|癫痫发作|口唇发紫|嘴唇发紫|喉咙(?:肿|堵)|严重过敏|过敏性休克|突然失明|突然看不见|看不见东西|一侧(?:身体)?无力|半边身子无力|口角歪|说话不清|割腕|自杀|想死|不想活|伤害自己|服毒|药物过量|中毒|can't\s*breathe|cannot\s*breathe|difficulty\s*breathing|shortness\s*of\s*breath|choking|severe\s*chest\s*pain|unconscious|unresponsive|severe\s*bleeding|bleeding\s*won't\s*stop|seizure|blue\s*lips|anaphylaxis|throat\s*(?:is\s*)?closing|sudden\s*(?:vision\s*loss|blindness)|can't\s*see|cannot\s*see|one-sided\s*weakness|slurred\s*speech|suicid|kill\s*myself|overdose|poison|숨을?\s*(?:못|쉴\s*수\s*없)|호흡\s*곤란|심한\s*가슴\s*통증|의식\s*(?:없|잃)|깨지\s*않|대량\s*출혈|경련|입술이?\s*파래|아나필락시스|갑자기\s*안\s*보|한쪽\s*마비|자살|죽고\s*싶|과다\s*복용|息ができない|呼吸困難|激しい胸痛|意識がない|大量出血|けいれん|突然見えない|自殺|死にたい|no\s+puedo\s+respirar|dificultad\s+para\s+respirar|dolor\s+fuerte\s+en\s+el\s+pecho|inconsciente|sangrado\s+intenso|je\s+ne\s+peux\s+pas\s+respirer|difficulté\s+à\s+respirer|douleur\s+thoracique\s+intense|bewusstlos|starke\s+brustschmerzen|не\s+могу\s+дышать|сильная\s+боль\s+в\s+груди|لا\s*أستطيع\s*التنفس|ألم\s*شديد\s*في\s*الصدر)/iu;

const HIGH_FEVER = /(高烧|高熱|高热|体温.{0,5}(?:39|40|41|42)|(?:39|40|41|42)(?:度|℃)|high\s*fever|fever.{0,8}(?:39|40|41|42)|고열|열이.{0,5}(?:39|40|41|42)|高熱|fiebre\s+alta|forte\s+fièvre|hohes\s+fieber|febre\s+alta|высокая\s+температура|حمى\s*شديدة|demam\s+tinggi|sốt\s+cao)/iu;
const NEURO_OR_VISION = /(视力模糊|看不清|看不见|眼前发黑|意识模糊|神志不清|胡言乱语|脖子僵硬|剧烈头痛|blurred\s+vision|vision\s+loss|can't\s+see|confus|stiff\s+neck|worst\s+headache|시야가?\s*흐|안\s*보|의식\s*혼미|심한\s*두통|目がかすむ|見えない|意識がもうろう|激しい頭痛|visión\s+borrosa|confusión|vision\s+floue|verwirr|затуманенное\s+зрение|تشوش\s*الرؤية)/iu;
const SEVERE_MODIFIER = /(剧烈|严重|非常痛|痛得受不了|无法站立|持续恶化|severe|extreme|unbearable|worst|rapidly\s+worsening|심한|극심|激しい|intenso|grave|sévère|stark|schwer|сильн|شديد)/iu;
const SERIOUS_SYMPTOM = /(头痛|腹痛|肚子痛|出血|呕吐|发烧|发热|胸痛|过敏|受伤|烧伤|pain|headache|abdominal|bleed|vomit|fever|allerg|injur|burn|통증|두통|복통|출혈|구토|발열|알레르|부상|痛|頭痛|腹痛|出血|嘔吐|発熱|けが)/iu;

const SYMPTOM = /(疼|痛|不舒服|难受|发烧|发热|高烧|发冷|咳嗽|头晕|眩晕|恶心|乏力|无力|过敏|出血|肿|麻木|呼吸|喘|腹泻|呕吐|拉肚子|皮疹|受伤|看不清|看不见|视力模糊|耳鸣|流鼻涕|喉咙|心悸|失眠|便血|尿血|pain|hurt|unwell|fever|chills|cough|dizz|nause|weak|allerg|bleed|swollen|numb|breath|diarrhea|vomit|rash|injur|blurred\s+vision|can't\s+see|sore\s+throat|palpitation|아프|통증|불편|열이|발열|오한|기침|어지|메스꺼|구토|설사|알레르|출혈|붓|저림|호흡|다쳤|시야|안\s*보|목이|痛い|苦しい|発熱|咳|めまい|吐き気|嘔吐|下痢|発疹|出血|腫れ|しびれ|息|見え|喉|fiebre|dolor|tos|mareo|náusea|vómito|diarrea|sangrado|fièvre|douleur|toux|vertige|nausée|vomissement|durchfall|schmerz|fieber|husten|schwindel|übelkeit|febre|dor|tosse|tontura|náusea|температур|боль|кашель|тошнот|рвот|диаре|حمى|ألم|سعال|دوار|غثيان|قيء|إسهال|demam|sakit|batuk|pusing|mual|muntah|diare|sốt|đau|(?:^|[\s,.;!?])ho(?:$|[\s,.;!?])|chóng mặt|buồn nôn|nôn|tiêu chảy)/iu;
const FOLLOW_UP = /^(是|有|对|嗯|还有|而且|刚才|现在|越来越|yes|yeah|also|and|now|worse|맞아|네|그리고|지금|はい|ある|それと)\b/iu;

function normalize(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function removeCommonNegations(value: string) {
  return value
    .replace(/(?:没有|没|并无|否认|不是|不再)(?:出现|发生|感觉|感到|任何)?\s*(?:胸痛|胸口痛|呼吸困难|出血|抽搐|昏迷)/gu, "")
    .replace(/\b(?:no|not|without|deny|denies|denied)\s+(?:any\s+)?(?:chest\s+pain|difficulty\s+breathing|bleeding|seizures?|fainting)\b/giu, "")
    .replace(/(?:없|아니).{0,4}(?:가슴\s*통증|호흡\s*곤란|출혈|경련)/gu, "");
}

export function hasMedicalSymptoms(value: string) {
  const clean = removeCommonNegations(normalize(value));
  return clean.length >= 2 && SYMPTOM.test(clean);
}

function symptomSummary(current: string, previous: string[]) {
  const candidates = [...previous.slice(-6), current]
    .map(normalize)
    .filter((value) => value && (hasMedicalSymptoms(value) || RED_FLAG.test(removeCommonNegations(value))));
  return [...new Set(candidates)].join("；").slice(0, 1_000);
}

export function assessMedicalIntent(message: string, previousUserMessages: string[] = [], hasCard = true): MedicalTriageResult {
  const current = normalize(message);
  if (!current) return { intent: "general", symptoms: "", reason: "none" };
  if (CARD_REQUEST.test(current)) return { intent: "card", symptoms: "", reason: "card_request" };

  const asksForHospital = HOSPITAL_REQUEST.test(current);
  const currentHasSymptoms = hasMedicalSymptoms(current);
  const isFollowUp = FOLLOW_UP.test(current);
  const priorSymptoms = previousUserMessages.map(normalize).filter((value) => hasMedicalSymptoms(value) || RED_FLAG.test(removeCommonNegations(value))).slice(-6);
  const includeHistory = asksForHospital || currentHasSymptoms || isFollowUp;
  const relevant = removeCommonNegations(includeHistory ? [...priorSymptoms, current].join("；") : current);
  const symptoms = symptomSummary(current, previousUserMessages);

  const redFlag = EMERGENCY_REQUEST.test(current)
    || RED_FLAG.test(relevant)
    || (HIGH_FEVER.test(relevant) && NEURO_OR_VISION.test(relevant))
    || (SEVERE_MODIFIER.test(relevant) && SERIOUS_SYMPTOM.test(relevant));
  if (redFlag) return { intent: "emergency", symptoms: symptoms || current, reason: "red_flag" };
  if (FLOW_REQUEST.test(current)) return { intent: "flow", symptoms, reason: "service_request" };
  if (TRANSLATION_REQUEST.test(current)) return { intent: "translation", symptoms, reason: "service_request" };
  if (COMPANION_REQUEST.test(current)) return { intent: "companion", symptoms, reason: "service_request" };
  if (asksForHospital) return { intent: "hospital", symptoms, reason: "hospital_request" };
  if (currentHasSymptoms) return { intent: "hospital", symptoms: symptoms || current, reason: "symptoms" };
  return { intent: "general", symptoms, reason: "none" };
}

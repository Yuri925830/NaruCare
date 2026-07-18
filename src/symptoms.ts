const symptomPattern = /(疼|痛|不舒服|难受|发烧|发热|咳嗽|头晕|恶心|乏力|过敏|出血|肿|麻木|呼吸|腹泻|呕吐|拉肚子|皮疹|受伤|pain|hurt|unwell|fever|cough|dizz|nause|weak|allerg|bleed|swollen|numb|breath|diarrhea|vomit|rash|injur|아프|통증|불편|열이|발열|기침|어지|메스꺼|구토|설사|알레르|출혈|붓|저림|호흡|다쳤|痛い|苦しい|発熱|咳|めまい|吐き気|嘔吐|下痢|発疹|出血|腫れ|しびれ|息)/iu;

export function isLikelySymptomDescription(text: string) {
  const clean = text.trim();
  return clean.length >= 2 && symptomPattern.test(clean);
}

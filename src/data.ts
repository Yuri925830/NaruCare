import type { Companion, CompanionFilters, Hospital } from "./types";

export const fallbackHospitals: Hospital[] = [
  { id: "h1", name: "首尔大学医院急诊医疗中心", lat: 37.5796, lng: 126.9991, distance: 850, type: "综合医院 · 急诊医学科", address: "서울특별시 종로구 대학로 101", openingHours: "24/7", emergency: true, reservation: "not_required", phone: "+82-2-2072-0505", dataSource: "SNUH", sourceUrl: "https://www.snuh.org/global/en/patients/EN02004.do", lastVerified: "2026-07-18" },
  { id: "h2", name: "高丽大学安岩医院急诊医疗中心", lat: 37.5871, lng: 127.0265, distance: 1420, type: "综合医院 · 急诊医学科", address: "서울특별시 성북구 고려대로 73", openingHours: "24/7", emergency: true, reservation: "not_required", dataSource: "Korea University Anam Hospital", sourceUrl: "https://anam.kumc.or.kr/en/doctor-department/department/view.do?deptCd=AAEMC", lastVerified: "2026-07-18" },
  { id: "h3", name: "首尔赤十字医院门诊", lat: 37.5672, lng: 126.9671, distance: 2160, type: "综合医院 · 内科门诊", address: "서울특별시 종로구 새문안로 9", openingHours: "Mo-Fr 09:00-17:00", reservation: "recommended", phone: "+82-2-2002-8300", dataSource: "Seoul Red Cross Hospital", sourceUrl: "https://www.rch.or.kr/web/rchseoul/contents/outpatient", lastVerified: "2026-07-18" },
];

export const companions: Companion[] = [
  { id: "c01", name: "Wang Fang", nativeName: "王芳", gender: "female", nationality: "China", age: 32, languages: ["zh-CN", "ko", "en"], rating: 5.0, reviewCount: 210, price: 18000, eta: 16, hospitals: ["Seoul National University Hospital", "Korea University Anam Hospital"], experience: "熟悉首尔大学医院、高丽大学安岩医院的挂号、检查、缴费和药房流程；擅长帮助初次在韩国就医的中国患者。" },
  { id: "c02", name: "Kim Somin", nativeName: "김소민", gender: "female", nationality: "Korea", age: 29, languages: ["ko", "zh-CN", "en"], rating: 4.9, reviewCount: 188, price: 15000, eta: 20, hospitals: ["Severance Hospital", "Seoul St. Mary's Hospital"], experience: "三甲医院国际诊疗中心志愿服务三年，熟悉门诊、急诊和保险结算。" },
  { id: "c03", name: "Lee Jiwon", nativeName: "이지원", gender: "male", nationality: "Korea", age: 35, languages: ["ko", "zh-CN", "ja"], rating: 4.8, reviewCount: 146, price: 13000, eta: 24, hospitals: ["Asan Medical Center", "Samsung Medical Center"], experience: "首尔大型医院陪诊经验丰富，熟悉影像检查和专科转诊流程。" },
  { id: "c04", name: "Minh Anh", nativeName: "Minh Anh", gender: "female", nationality: "Vietnam", age: 27, languages: ["vi", "ko", "en"], rating: 4.9, reviewCount: 132, price: 14000, eta: 18, hospitals: ["Seoul Medical Center", "Konkuk University Hospital"], experience: "越南语医疗口译员，熟悉女性健康、儿科和内科流程。" },
  { id: "c05", name: "Sato Haruki", nativeName: "佐藤春樹", gender: "male", nationality: "Japan", age: 41, languages: ["ja", "ko", "en"], rating: 4.7, reviewCount: 98, price: 16000, eta: 35, hospitals: ["Severance Hospital", "Soonchunhyang University Hospital"], experience: "日语医疗沟通和高龄患者陪诊经验丰富。" },
  { id: "c06", name: "Ananda Priya", nativeName: "अनंदा प्रिया", gender: "female", nationality: "India", age: 31, languages: ["hi", "en", "ko"], rating: 4.8, reviewCount: 121, price: 17000, eta: 28, hospitals: ["Samsung Medical Center", "Asan Medical Center"], experience: "英语、印地语双语陪诊，熟悉国际诊疗预约与检查准备。" },
  { id: "c07", name: "Nur Aisyah", nativeName: "Nur Aisyah", gender: "female", nationality: "Malaysia", age: 34, languages: ["ms", "en", "ko", "id"], rating: 4.9, reviewCount: 156, price: 15500, eta: 22, hospitals: ["Seoul National University Hospital", "Seoul St. Mary's Hospital"], experience: "熟悉清真饮食、宗教需求沟通和住院陪护流程。" },
  { id: "c08", name: "Ahmed Hassan", nativeName: "أحمد حسن", gender: "male", nationality: "Egypt", age: 38, languages: ["ar", "en", "ko"], rating: 4.8, reviewCount: 115, price: 16500, eta: 30, hospitals: ["Asan Medical Center", "Samsung Medical Center"], experience: "阿拉伯语医疗口译，擅长国际患者中心和急诊陪同。" },
  { id: "c09", name: "Maria Santos", nativeName: "Maria Santos", gender: "female", nationality: "Philippines", age: 30, languages: ["tl", "en", "ko"], rating: 4.9, reviewCount: 175, price: 15000, eta: 19, hospitals: ["Seoul Medical Center", "National Medical Center"], experience: "护理背景，熟悉英语及菲律宾语患者的检查和用药说明。" },
  { id: "c10", name: "Olga Petrova", nativeName: "Ольга Петрова", gender: "female", nationality: "Russia", age: 43, languages: ["ru", "en", "ko"], rating: 4.7, reviewCount: 87, price: 18000, eta: 38, hospitals: ["Severance Hospital", "Samsung Medical Center"], experience: "俄语陪诊与住院流程协助，擅长材料整理和复诊安排。" },
  { id: "c11", name: "Carlos Ruiz", nativeName: "Carlos Ruiz", gender: "male", nationality: "Spain", age: 36, languages: ["es", "en", "ko"], rating: 4.8, reviewCount: 104, price: 16000, eta: 26, hospitals: ["Seoul St. Mary's Hospital", "Konkuk University Hospital"], experience: "西班牙语医疗翻译，熟悉骨科和运动医学流程。" },
  { id: "c12", name: "Emma Dubois", nativeName: "Emma Dubois", gender: "female", nationality: "France", age: 28, languages: ["fr", "en", "ko"], rating: 4.9, reviewCount: 143, price: 17500, eta: 21, hospitals: ["Seoul National University Hospital", "Severance Hospital"], experience: "法语和英语陪诊，善于缓解初次就医患者的焦虑。" },
  { id: "c13", name: "Lukas Weber", nativeName: "Lukas Weber", gender: "male", nationality: "Germany", age: 39, languages: ["de", "en", "ko"], rating: 4.8, reviewCount: 92, price: 18500, eta: 34, hospitals: ["Asan Medical Center", "Seoul National University Hospital"], experience: "德语医疗沟通，熟悉体检、心内科和长期随访。" },
  { id: "c14", name: "Ana Oliveira", nativeName: "Ana Oliveira", gender: "female", nationality: "Brazil", age: 33, languages: ["pt-BR", "es", "en", "ko"], rating: 4.8, reviewCount: 118, price: 16000, eta: 25, hospitals: ["Korea University Anam Hospital", "National Medical Center"], experience: "葡萄牙语与西班牙语患者陪诊，熟悉内科和妇科。" },
  { id: "c15", name: "Dewi Lestari", nativeName: "Dewi Lestari", gender: "female", nationality: "Indonesia", age: 26, languages: ["id", "ms", "ko", "en"], rating: 4.7, reviewCount: 101, price: 13000, eta: 17, hospitals: ["Seoul Medical Center", "Konkuk University Hospital"], experience: "印尼语陪诊，熟悉留学生保险和常见门诊流程。" },
  { id: "c16", name: "Pimchanok K.", nativeName: "พิมพ์ชนก", gender: "female", nationality: "Thailand", age: 37, languages: ["th", "ko", "en"], rating: 4.9, reviewCount: 162, price: 15500, eta: 29, hospitals: ["Samsung Medical Center", "Seoul St. Mary's Hospital"], experience: "泰语医疗翻译，熟悉健康检查和肿瘤中心就诊动线。" },
  { id: "c17", name: "Mert Kaya", nativeName: "Mert Kaya", gender: "male", nationality: "Turkey", age: 31, languages: ["tr", "en", "ko"], rating: 4.6, reviewCount: 76, price: 14500, eta: 32, hospitals: ["Soonchunhyang University Hospital", "Seoul Medical Center"], experience: "土耳其语陪诊，擅长急诊沟通和药房取药协助。" },
  { id: "c18", name: "Giulia Rossi", nativeName: "Giulia Rossi", gender: "female", nationality: "Italy", age: 40, languages: ["it", "en", "ko"], rating: 4.8, reviewCount: 110, price: 17000, eta: 36, hospitals: ["Severance Hospital", "Asan Medical Center"], experience: "意大利语医疗陪同，熟悉专科预约和检查结果说明。" },
  { id: "c19", name: "Oyun Erdene", nativeName: "Оюун-Эрдэнэ", gender: "female", nationality: "Mongolia", age: 35, languages: ["mn", "ko", "ru"], rating: 4.9, reviewCount: 199, price: 15000, eta: 23, hospitals: ["Korea University Anam Hospital", "Seoul National University Hospital"], experience: "蒙古语医疗口译十年，熟悉住院、手术同意和出院流程。" },
  { id: "c20", name: "Aziz Karimov", nativeName: "Aziz Karimov", gender: "male", nationality: "Uzbekistan", age: 29, languages: ["uz", "ru", "ko"], rating: 4.7, reviewCount: 84, price: 13500, eta: 27, hospitals: ["National Medical Center", "Seoul Medical Center"], experience: "乌兹别克语、俄语陪诊，熟悉工伤和门诊检查流程。" },
  { id: "c21", name: "Sara Khan", nativeName: "سارہ خان", gender: "female", nationality: "Pakistan", age: 34, languages: ["ur", "hi", "en", "ko"], rating: 4.8, reviewCount: 128, price: 15500, eta: 31, hospitals: ["Seoul St. Mary's Hospital", "Asan Medical Center"], experience: "乌尔都语、印地语医疗沟通，尊重宗教和性别偏好。" },
  { id: "c22", name: "Nabila Rahman", nativeName: "নাবিলা রহমান", gender: "female", nationality: "Bangladesh", age: 27, languages: ["bn", "en", "ko"], rating: 4.7, reviewCount: 79, price: 12500, eta: 18, hospitals: ["National Medical Center", "Korea University Anam Hospital"], experience: "孟加拉语陪诊，熟悉留学生常见内科与急诊流程。" },
  { id: "c23", name: "Arjun Shrestha", nativeName: "अर्जुन श्रेष्ठ", gender: "male", nationality: "Nepal", age: 42, languages: ["ne", "hi", "en", "ko"], rating: 4.8, reviewCount: 137, price: 14500, eta: 33, hospitals: ["Seoul Medical Center", "Soonchunhyang University Hospital"], experience: "尼泊尔语与印地语患者支持，熟悉工伤、骨科及康复流程。" },
  { id: "c24", name: "Thiri Aung", nativeName: "သီရိအောင်", gender: "female", nationality: "Myanmar", age: 30, languages: ["my", "en", "ko"], rating: 4.9, reviewCount: 116, price: 14000, eta: 20, hospitals: ["Konkuk University Hospital", "Seoul National University Hospital"], experience: "缅甸语医疗口译，擅长体检、内科和女性健康陪诊。" },
];

function rangeMatches(age: number, range: string) {
  if (!range || range === "any") return true;
  const [min, max] = range.split("-").map(Number);
  return age >= min && age <= max;
}

export function matchCompanions(filters: CompanionFilters): Companion[] {
  return companions
    .map((person) => {
      let score = 55;
      if (filters.gender === "any" || filters.gender === person.gender) score += 8;
      if (filters.nationality === "any" || filters.nationality === person.nationality) score += 7;
      if (rangeMatches(person.age, filters.age)) score += 7;
      if (!filters.languages.length || filters.languages.some((lang) => person.languages.includes(lang))) score += 12;
      if (person.rating >= Number(filters.rating || 0)) score += 5;
      if (person.price >= filters.minPrice && person.price <= filters.maxPrice) score += 4;
      if (person.eta <= Number(filters.eta || 60)) score += 2;
      return { ...person, match: Math.min(score, 99) };
    })
    .sort((a, b) => (b.match || 0) - (a.match || 0) || a.eta - b.eta);
}

export function getDefaultFilters(language: string): CompanionFilters {
  return {
    gender: "any",
    nationality: "any",
    age: "25-45",
    eta: "60",
    languages: [language, "ko"],
    rating: "4",
    minPrice: 10000,
    maxPrice: 25000,
  };
}

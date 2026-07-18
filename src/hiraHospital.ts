export interface HiraFacility {
  ykiho: string;
  name: string;
  address?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  institutionType?: string;
  totalDoctors?: number;
}

export interface HiraSpecialist {
  specialty: string;
  count: number;
}

export interface HiraCapabilities {
  specialties: string[];
  specialists: HiraSpecialist[];
  equipment: string[];
  specialCare: string[];
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === "" ? [] : [value];
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function finiteNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function xmlValue(block: string, names: string[]) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return decodeXml(match[1]);
  }
  return "";
}

export function parseHiraHospitalXml(xml: string): HiraFacility[] {
  const resultCode = xmlValue(xml, ["resultCode"]);
  if (resultCode && !["00", "0", "NORMAL_SERVICE"].includes(resultCode)) return [];
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].flatMap<HiraFacility>((match) => {
    const block = match[1];
    const ykiho = xmlValue(block, ["ykiho"]);
    const name = xmlValue(block, ["yadmNm"]);
    if (!ykiho || !name) return [];
    const lat = finiteNumber(xmlValue(block, ["YPos", "yPos", "ypos"]));
    const lng = finiteNumber(xmlValue(block, ["XPos", "xPos", "xpos"]));
    const totalDoctors = finiteNumber(xmlValue(block, ["drTotCnt"]));
    return [{
      ykiho,
      name,
      address: xmlValue(block, ["addr"]) || undefined,
      phone: xmlValue(block, ["telno"]) || undefined,
      lat,
      lng,
      institutionType: xmlValue(block, ["clCdNm"]) || undefined,
      totalDoctors,
    }];
  });
}

export function hiraJsonItems(payload: unknown): UnknownRecord[] {
  const root = record(payload);
  const response = record(root.response || root.Response || root);
  const body = record(response.body || response.Body);
  const items = record(body.items || body.Items);
  return array(items.item || items.Item).map(record).filter((item) => Object.keys(item).length > 0);
}

function firstValue(item: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = text(item[key]);
    if (value) return value;
  }
  return "";
}

function unique(values: string[], limit = 12) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

export function parseHiraCapabilities(input: {
  specialties?: unknown;
  specialists?: unknown;
  equipment?: unknown;
  specialCare?: unknown;
}): HiraCapabilities {
  const specialtyItems = hiraJsonItems(input.specialties);
  const specialistItems = hiraJsonItems(input.specialists);
  const equipmentItems = hiraJsonItems(input.equipment);
  const specialCareItems = hiraJsonItems(input.specialCare);
  const specialtyKeys = ["dgsbjtCdNm", "dgsbjtNm", "sbjtCdNm", "subjectName"];
  const specialists = specialistItems.flatMap<HiraSpecialist>((item) => {
    const specialty = firstValue(item, specialtyKeys);
    const count = finiteNumber(firstValue(item, ["dgsbjtPrSdrCnt", "sdrCnt", "spcSdrCnt", "doctorCount"]));
    return specialty && count !== undefined && count > 0 ? [{ specialty, count }] : [];
  });
  return {
    specialties: unique([
      ...specialtyItems.map((item) => firstValue(item, specialtyKeys)),
      ...specialists.map((item) => item.specialty),
    ]),
    specialists: specialists.slice(0, 12),
    equipment: unique(equipmentItems.map((item) => firstValue(item, ["oefCdNm", "oefNm", "medOftNm", "eqpNm", "eqpName"]))),
    specialCare: unique(specialCareItems.map((item) => firstValue(item, ["srchCdNm", "spclDiagNm", "spclTrtNm", "diagNm", "itemNm"]))),
  };
}

function normalizedName(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function normalizedPhone(value: string | undefined) {
  const digits = (value || "").replace(/\D/g, "");
  return digits.startsWith("82") ? `0${digits.slice(2)}` : digits;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1); const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function matchHiraFacility(hospital: { name: string; phone?: string; lat: number; lng: number }, facilities: HiraFacility[]) {
  const hospitalName = normalizedName(hospital.name);
  const hospitalPhone = normalizedPhone(hospital.phone);
  let best: { facility: HiraFacility; score: number } | undefined;
  for (const facility of facilities) {
    const facilityName = normalizedName(facility.name);
    const facilityPhone = normalizedPhone(facility.phone);
    const phoneMatch = Boolean(hospitalPhone && facilityPhone && hospitalPhone === facilityPhone);
    const exactName = Boolean(hospitalName && facilityName && hospitalName === facilityName);
    const similarName = Math.min(hospitalName.length, facilityName.length) >= 4
      && (hospitalName.includes(facilityName) || facilityName.includes(hospitalName));
    const distance = facility.lat !== undefined && facility.lng !== undefined
      ? distanceMeters(hospital.lat, hospital.lng, facility.lat, facility.lng)
      : Number.POSITIVE_INFINITY;
    const score = (phoneMatch ? 120 : 0) + (exactName ? 100 : similarName ? 65 : 0)
      + (distance <= 80 ? 35 : distance <= 200 ? 25 : distance <= 500 ? 10 : 0);
    if (!(phoneMatch || exactName || (similarName && distance <= 500))) continue;
    if (!best || score > best.score) best = { facility, score };
  }
  return best?.facility;
}

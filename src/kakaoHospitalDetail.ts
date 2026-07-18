const dayCodes = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const koreanDays: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

export interface ParsedKakaoHospitalDetail {
  openingHours?: string;
  subjects: string[];
  address?: string;
  phone?: string;
  emergency?: boolean;
  bookingAvailable?: boolean;
  lastVerified?: string;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clock(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function range(value: string): [number, number] | null {
  const times = [...value.matchAll(/(\d{1,2}):(\d{2})/g)].map((match) => Number(match[1]) * 60 + Number(match[2]));
  return times.length >= 2 ? [times[0], times[1]] : null;
}

function splitAroundBreaks(main: [number, number], breaks: string[]) {
  let segments = [main];
  for (const breakDescription of breaks) {
    const pause = range(breakDescription);
    if (!pause) continue;
    segments = segments.flatMap(([start, end]) => {
      if (pause[1] <= start || pause[0] >= end) return [[start, end] as [number, number]];
      const parts: Array<[number, number]> = [];
      if (pause[0] > start) parts.push([start, Math.min(pause[0], end)]);
      if (pause[1] < end) parts.push([Math.max(pause[1], start), end]);
      return parts;
    });
  }
  return segments.map(([start, end]) => `${clock(start)}-${clock(end)}`).join(",");
}

function expandedKoreanDays(value: string) {
  const [startLabel, endLabel] = value.replace(/\s/g, "").split("~");
  const start = koreanDays[startLabel?.[0]];
  const end = koreanDays[(endLabel || startLabel)?.[0]];
  if (start === undefined || end === undefined) return [];
  const days: number[] = [];
  let current = start;
  for (let guard = 0; guard < 7; guard += 1) {
    days.push(current);
    if (current === end) break;
    current = (current + 1) % 7;
  }
  return days;
}

function openingHoursFromKakao(panel: UnknownRecord) {
  const openHours = record(panel.open_hours);
  const week = record(openHours.week_from_today);
  const periods = array(week.week_periods);
  const byDay = new Map<number, string[]>();
  for (const periodValue of periods) {
    const period = record(periodValue);
    for (const dayValue of array(period.days)) {
      const day = record(dayValue);
      const label = text(day.day_of_the_week_desc);
      const dayIndex = koreanDays[label[0]];
      const onDays = record(day.on_days);
      const main = range(text(onDays.start_end_time_desc));
      if (dayIndex === undefined || !main) continue;
      const breaks = array(onDays.break_times_desc).map(text).filter(Boolean);
      const intervals = splitAroundBreaks(main, breaks);
      if (intervals) byDay.set(dayIndex, [intervals]);
    }
  }
  if (!byDay.size) {
    const medical = record(panel.medical);
    const emergencyCenter = record(medical.emergency_center);
    for (const infoValue of array(emergencyCenter.open_infos)) {
      const info = record(infoValue);
      const timeRange = range(text(info.value));
      if (!timeRange) continue;
      for (const dayIndex of expandedKoreanDays(text(info.title))) byDay.set(dayIndex, [`${clock(timeRange[0])}-${clock(timeRange[1])}`]);
    }
  }
  if (!byDay.size) return undefined;
  return dayCodes.map((code, index) => `${code} ${byDay.get(index)?.join(",") || "off"}`).join("; ");
}

export function parseKakaoHospitalDetail(payload: unknown): ParsedKakaoHospitalDetail {
  const panel = record(payload);
  const medical = record(panel.medical);
  const emergencyCenter = record(medical.emergency_center);
  const hira = record(medical.hira);
  const summary = record(panel.summary);
  const meta = record(summary.meta);
  const address = record(summary.address);
  const notice = record(panel.my_store_notice);
  const subjects = array(hira.subjects).map((value) => text(record(value).subject_name)).filter(Boolean);
  if (!subjects.length) subjects.push(...text(emergencyCenter.subject_names).split(",").map((value) => value.trim()).filter(Boolean));
  const phone = text(record(array(summary.phone_numbers)[0]).tel);
  const updatedAt = text(meta.updated_at);
  return {
    openingHours: openingHoursFromKakao(panel),
    subjects: [...new Set(subjects)],
    address: text(address.disp) || text(address.road),
    phone: phone || undefined,
    emergency: text(emergencyCenter.emergency_available_yn) === "Y",
    bookingAvailable: typeof notice.is_available_booking === "boolean" ? notice.is_available_booking : undefined,
    lastVerified: updatedAt ? updatedAt.slice(0, 10) : undefined,
  };
}

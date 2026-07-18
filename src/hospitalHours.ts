const dayCodes = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export interface OpeningState {
  isOpen: boolean | null;
  restDayIndexes: number[] | null;
}

function expandDays(specification: string) {
  const result = new Set<number>();
  for (const part of specification.split(",")) {
    const range = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!range) continue;
    const start = dayCodes.indexOf(range[1] as (typeof dayCodes)[number]);
    const end = range[2] ? dayCodes.indexOf(range[2] as (typeof dayCodes)[number]) : start;
    if (start < 0 || end < 0) continue;
    let current = start;
    for (let guard = 0; guard < 7; guard += 1) {
      result.add(current);
      if (current === end) break;
      current = (current + 1) % 7;
    }
  }
  return result;
}

function seoulClock(now: Date) {
  const values: Record<string, string> = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).forEach((part) => { values[part.type] = part.value; });
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday);
  return { day, minutes: Number(values.hour) * 60 + Number(values.minute) };
}

function timeMatches(value: string, minutes: number) {
  const matches = [...value.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)];
  if (!matches.length) return null;
  return matches.some((match) => {
    const start = Number(match[1]) * 60 + Number(match[2]);
    const end = Number(match[3]) * 60 + Number(match[4]);
    if (end === 24 * 60) return minutes >= start;
    return end > start ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  });
}

function overnightTailMatches(value: string, minutes: number) {
  const matches = [...value.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)];
  return matches.some((match) => {
    const start = Number(match[1]) * 60 + Number(match[2]);
    const end = Number(match[3]) * 60 + Number(match[4]);
    return end <= start && minutes < end;
  });
}

/** Evaluates the common weekly subset of the OpenStreetMap opening_hours format. */
export function evaluateOpeningHours(raw: string | undefined, now = new Date()): OpeningState {
  if (!raw?.trim()) return { isOpen: null, restDayIndexes: null };
  if (/^24\s*\/\s*7$/i.test(raw.trim())) return { isOpen: true, restDayIndexes: [] };

  const { day, minutes } = seoulClock(now);
  const openDays = new Set<number>();
  const explicitClosedDays = new Set<number>();
  let currentState: boolean | null = null;
  let understood = false;

  for (const ruleText of raw.split(";")) {
    const rule = ruleText.trim();
    const match = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/i);
    if (!match) continue;
    const days = expandDays(match[1]);
    const value = match[2];
    if (!days.size) continue;
    understood = true;
    if (/\boff\b|\bclosed\b/i.test(value)) days.forEach((item) => explicitClosedDays.add(item));
    else days.forEach((item) => openDays.add(item));
    if (!days.has(day)) {
      const previousDay = (day + 6) % 7;
      if (!/\boff\b|\bclosed\b/i.test(value) && days.has(previousDay) && overnightTailMatches(value, minutes)) currentState = true;
      continue;
    }
    if (/\boff\b|\bclosed\b/i.test(value)) currentState = false;
    else {
      const result = timeMatches(value, minutes);
      if (result !== null) currentState = result;
    }
  }

  if (understood && currentState === null && !openDays.has(day)) currentState = false;
  const restDayIndexes = understood
    ? dayCodes.map((_, index) => index).filter((index) => explicitClosedDays.has(index) || !openDays.has(index))
    : null;
  return { isOpen: currentState, restDayIndexes };
}

export function formatRestDays(indexes: number[] | null, locale: string) {
  if (indexes === null) return null;
  if (!indexes.length) return "";
  const sunday = new Date(Date.UTC(2024, 0, 7));
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return indexes.map((index) => formatter.format(new Date(sunday.getTime() + index * 86_400_000))).join(" / ");
}

export function formatOpeningSchedule(raw: string | undefined, locale: string) {
  if (!raw?.trim()) return null;
  if (/^24\s*\/\s*7$/i.test(raw.trim())) return "24/7";
  const sunday = new Date(Date.UTC(2024, 0, 7));
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const codeIndex: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
  const values = raw.split(";").flatMap((rule) => {
    const match = rule.trim().match(/^(Su|Mo|Tu|We|Th|Fr|Sa)\s+(.+)$/i);
    if (!match || /\boff\b|\bclosed\b/i.test(match[2])) return [];
    const normalizedCode = `${match[1][0].toUpperCase()}${match[1][1].toLowerCase()}`;
    const index = codeIndex[normalizedCode];
    if (index === undefined) return [];
    const day = formatter.format(new Date(sunday.getTime() + index * 86_400_000));
    return [`${day} ${match[2].replace(/-/g, "–").replace(/,/g, " / ")}`];
  });
  return values.length ? values.join(" · ") : null;
}

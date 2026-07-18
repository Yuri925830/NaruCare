export function normalizeCompanionDuration(minutes: number, maximumMinutes = 720) {
  if (!Number.isFinite(minutes)) return 120;
  return Math.max(60, Math.min(maximumMinutes, Math.round(minutes / 30) * 30));
}

export function actualBillableMinutes(elapsedSeconds: number) {
  if (!Number.isFinite(elapsedSeconds)) return 60;
  return Math.max(60, Math.ceil(Math.max(0, elapsedSeconds) / 60));
}

export function companionServiceTotal(pricePerHour: number, minutes: number) {
  return Math.max(0, Math.round(pricePerHour * Math.max(0, minutes) / 60));
}

export const MAX_COMPANION_SERVICE_MINUTES = 12 * 60;

export function normalizeCompanionDuration(minutes: number, maximumMinutes = MAX_COMPANION_SERVICE_MINUTES) {
  if (!Number.isFinite(minutes)) return 120;
  return Math.max(60, Math.min(maximumMinutes, Math.round(minutes / 30) * 30));
}

export function extendCompanionDuration(minutes: number) {
  return Math.min(MAX_COMPANION_SERVICE_MINUTES, normalizeCompanionDuration(minutes) + 30);
}

export function actualBillableMinutes(elapsedSeconds: number) {
  if (!Number.isFinite(elapsedSeconds)) return 60;
  return Math.min(MAX_COMPANION_SERVICE_MINUTES, Math.max(60, Math.ceil(Math.max(0, elapsedSeconds) / 60)));
}

export function companionServiceTotal(pricePerHour: number, minutes: number) {
  const cappedMinutes = Math.min(MAX_COMPANION_SERVICE_MINUTES, Math.max(0, minutes));
  return Math.max(0, Math.round(pricePerHour * cappedMinutes / 60));
}

export interface PreciseLocationFix {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface PreciseLocationOptions {
  targetAccuracyMeters?: number;
  hardTimeoutMs?: number;
  minimumObservationMs?: number;
  minimumAccurateSamples?: number;
}

export function requestPreciseLocation(
  geolocation: Geolocation = navigator.geolocation,
  options: PreciseLocationOptions = {},
): Promise<PreciseLocationFix> {
  const targetAccuracy = options.targetAccuracyMeters ?? 25;
  const hardTimeout = options.hardTimeoutMs ?? 15_000;
  const minimumObservation = Math.max(0, Math.min(options.minimumObservationMs ?? 2_500, hardTimeout - 1));
  const minimumAccurateSamples = Math.max(1, Math.min(options.minimumAccurateSamples ?? 2, 5));

  return new Promise((resolve, reject) => {
    let watchId = -1;
    let settled = false;
    let best: PreciseLocationFix | null = null;
    let accurateSamples = 0;
    const startedAt = Date.now();
    let accuracyTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

    const finish = (fix?: PreciseLocationFix, error?: GeolocationPositionError | Error) => {
      if (settled) return;
      settled = true;
      if (watchId >= 0) geolocation.clearWatch(watchId);
      globalThis.clearTimeout(timeoutId);
      if (accuracyTimer) globalThis.clearTimeout(accuracyTimer);
      if (fix) resolve(fix);
      else reject(error || new Error("Location unavailable"));
    };

    const timeoutId = globalThis.setTimeout(() => {
      if (best) finish(best);
      else finish(undefined, new Error("Location timed out"));
    }, hardTimeout);

    watchId = geolocation.watchPosition(
      (position) => {
        const fix: PreciseLocationFix = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? Math.max(0, position.coords.accuracy) : Number.POSITIVE_INFINITY,
          timestamp: position.timestamp || Date.now(),
        };
        if (!best || fix.accuracy < best.accuracy) best = fix;
        if (fix.accuracy <= targetAccuracy) {
          accurateSamples += 1;
          if (accurateSamples < minimumAccurateSamples) return;
          const remainingObservation = minimumObservation - (Date.now() - startedAt);
          if (remainingObservation <= 0) finish(best);
          else if (!accuracyTimer) {
            accuracyTimer = globalThis.setTimeout(() => {
              accuracyTimer = null;
              if (best && best.accuracy <= targetAccuracy) finish(best);
            }, remainingObservation);
          }
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) finish(undefined, error);
        else if (best) finish(best);
        else finish(undefined, error);
      },
      { enableHighAccuracy: true, timeout: hardTimeout, maximumAge: 0 },
    );
  });
}

export function formatAccuracy(accuracy: number | undefined) {
  if (!Number.isFinite(accuracy)) return "";
  return `±${Math.max(1, Math.round(accuracy!))} m`;
}

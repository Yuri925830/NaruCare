import { describe, expect, it } from "vitest";
import { formatAccuracy, requestPreciseLocation } from "./location";

function position(accuracy: number, lat = 37.5665, lng = 126.978): GeolocationPosition {
  return {
    coords: { latitude: lat, longitude: lng, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) },
    timestamp: Date.now(),
    toJSON: () => ({}),
  };
}

describe("requestPreciseLocation", () => {
  it("waits for and returns the best high-accuracy watch fix", async () => {
    let cleared = -1;
    const geolocation = {
      watchPosition(success: PositionCallback) {
        setTimeout(() => success(position(82)), 0);
        setTimeout(() => success(position(11, 37.56651, 126.97801)), 4);
        return 7;
      },
      clearWatch(id: number) { cleared = id; },
      getCurrentPosition() { /* unused */ },
    } as Geolocation;
    const result = await requestPreciseLocation(geolocation, { targetAccuracyMeters: 20, hardTimeoutMs: 100 });
    expect(result.accuracy).toBe(11);
    expect(result.lat).toBeCloseTo(37.56651);
    expect(cleared).toBe(7);
  });

  it("formats accuracy for display", () => expect(formatAccuracy(12.4)).toBe("±12 m"));
});

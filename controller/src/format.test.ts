import { describe, expect, it } from "vitest";
import { formatClock, formatDuration } from "./format";

describe("race time formatting", () => {
  it("renders sub-minute lap time with milliseconds", () => {
    expect(formatDuration(42_315)).toBe("42.315");
  });

  it("renders minutes without losing millisecond precision", () => {
    expect(formatDuration(62_005)).toBe("1:02.005");
  });

  it("renders the race clock", () => {
    expect(formatClock(125_900)).toBe("02:05.9");
  });
});

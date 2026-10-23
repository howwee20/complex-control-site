import { describe, expect, it } from "vitest";
import { interfaceSummary, internetSummary, systemSummary } from "./components/SystemUpdates";
import type { FrontendUpdateStatus, NetworkStatus, UpdateStatus } from "./types";

const frontend = (overrides: Partial<FrontendUpdateStatus>): FrontendUpdateStatus => ({
  state: "idle", message: "", current: { version: "site-old" }, ...overrides,
});

describe("update status wording", () => {
  it("explains that a saved interface update waits for the race", () => {
    expect(interfaceSummary(frontend({ state: "staged", deferred_reason: "race_running", staged: { version: "site-new" } })))
      .toBe("site-old in use · site-new is saved and installs after the current race");
    expect(interfaceSummary(frontend({ state: "failed" }))).toContain("nothing changed");
    expect(interfaceSummary(frontend({ state: "complete" }))).toBe("site-old · up to date on this controller");
  });

  it("describes when a system release will install", () => {
    const staged: UpdateStatus = { state: "waiting", message: "", staged: { version: "0.8.0" }, deferred_reason: "recent_activity" };
    expect(systemSummary(staged, "0.7.0")).toBe("0.7.0 · 0.8.0 installs after a few quiet minutes");
    expect(systemSummary({ ...staged, operator_requested: true }, "0.7.0")).toContain("as soon as no race is running");
    expect(systemSummary({ ...staged, deferred_reason: "race_running" }, "0.7.0")).toBe("0.7.0 · 0.8.0 installs after racing");
    expect(systemSummary({ state: "installing", message: "", version: "0.8.0" }, "0.7.0")).toContain("racing resumes automatically");
    expect(systemSummary({ state: "failed", message: "" }, "0.7.0")).toContain("rolled back");
  });

  it("separates internet access from racing", () => {
    const network = (state: "online" | "offline" | "unknown") => ({ internet: { state } }) as NetworkStatus;
    expect(internetSummary(network("online"))).toContain("downloads interface updates itself");
    expect(internetSummary(network("offline"))).toContain("racing does not need internet");
    expect(internetSummary(network("unknown"))).toBe("Racing does not need internet");
  });
});

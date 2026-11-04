import { describe, expect, it, vi } from "vitest";
import { carryPhoneUpdate } from "./phoneUpdates";
const commit = "a".repeat(40);
const release = { format: "complex-control-encrypted-feed-v1", commit, sha256: "b".repeat(64), bytes: 4,
  bundle_url: "https://raw.githubusercontent.com/howwee20/complex-control-updates/main/releases/test.cms" };
const json = (value: unknown) => new Response(JSON.stringify(value));
function mock(status: unknown, manifest: unknown = release) {
  return vi.fn().mockResolvedValueOnce(json({ enabled: true })).mockResolvedValueOnce(json(status))
    .mockResolvedValueOnce(json(manifest)).mockResolvedValueOnce(new Response(new Uint8Array(4)))
    .mockResolvedValueOnce(json({ state: "staged" }));
}
describe("automatic phone updates", () => {
  it("carries ciphertext from the internet to the local Pi without hotspot configuration", async () => {
    const fetcher = mock({ current: { commit: "old" } });
    expect(await carryPhoneUpdate(fetcher)).toBe("saved");
    expect(fetcher.mock.calls[3]![0]).toBe(release.bundle_url);
    expect(fetcher.mock.calls[4]![0]).toBe("/api/system/phone-update");
    expect(fetcher.mock.calls[4]![1].headers["X-Release-Commit"]).toBe(commit);
  });
  it("does not download an installed or already saved release", async () => {
    for (const status of [{ current: { commit } }, { staged: { commit } }]) {
      const fetcher = mock(status);
      expect(["current", "saved"]).toContain(await carryPhoneUpdate(fetcher));
      expect(fetcher).toHaveBeenCalledTimes(3);
    }
  });
  it("ignores remote URLs outside the release feed", async () => {
    const fetcher = mock({}, { ...release, bundle_url: "https://example.com/secret" });
    expect(await carryPhoneUpdate(fetcher)).toBe("failed");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("keeps offline failures out of the race interface", async () => {
    expect(await carryPhoneUpdate(vi.fn().mockRejectedValue(new Error("offline")))).toBe("offline");
  });
  it("does not redownload a failed staged update", async () => {
    const fetcher = mock({ state: "failed", staged: { commit } });
    expect(await carryPhoneUpdate(fetcher)).toBe("failed");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

import { describe, expect, it } from "vitest";
import { imageSrc, upstreamFor } from "./images";

describe("imageSrc", () => {
  it("routes shop uploads through /img/", () => {
    expect(imageSrc("https://rentabike.fo/wp-content/uploads/2024/09/Design-uden-navn-78.png")).toBe("/img/2024/09/Design-uden-navn-78.png");
  });
  it("encodes the shop's odd file names once", () => {
    const src = imageSrc("https://rentabike.fo/wp-content/uploads/2022/08/The-display-•-Walk-assist.png");
    expect(src).toBe("/img/2022/08/The-display-%E2%80%A2-Walk-assist.png");
    expect(imageSrc("https://rentabike.fo/wp-content/uploads/2022/08/The-display-%E2%80%A2-Walk-assist.png")).toBe(src);
  });
  it("leaves everything else alone", () => {
    expect(imageSrc("/images/bike-mtb.jpg")).toBe("/images/bike-mtb.jpg");
    expect(imageSrc("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(imageSrc(null)).toBeNull();
  });
});

describe("upstreamFor", () => {
  it("maps a photo path back to the shop's uploads", () => {
    expect(upstreamFor("/img/2024/09/Design-uden-navn-78.png")).toBe("https://rentabike.fo/wp-content/uploads/2024/09/Design-uden-navn-78.png");
    expect(upstreamFor("/img/2022/08/The-display-%E2%80%A2-Walk-assist.png")).toBe("https://rentabike.fo/wp-content/uploads/2022/08/The-display-%E2%80%A2-Walk-assist.png");
  });
  it("refuses anything that is not YYYY/MM/file", () => {
    expect(upstreamFor("/img/")).toBeNull();
    expect(upstreamFor("/img/2024/09")).toBeNull();
    expect(upstreamFor("/img/2024/09/../../wp-login.php")).toBeNull();
    expect(upstreamFor("/img/2024/09/..%2F..%2Fx.png")).toBeNull();
    expect(upstreamFor("/img/etc/passwd")).toBeNull();
    expect(upstreamFor("/images/bike-mtb.jpg")).toBeNull();
  });
});

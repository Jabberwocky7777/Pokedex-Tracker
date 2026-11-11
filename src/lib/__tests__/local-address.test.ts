import { describe, expect, it } from "vitest";
import { isInsecureRemote, isLocalAddress } from "../local-address";

describe("isLocalAddress", () => {
  it("accepts this computer and the private ranges", () => {
    for (const url of [
      "http://localhost:5173",
      "http://127.0.0.1",
      "http://10.0.0.5:7777",
      "http://172.16.4.1",
      "http://172.31.255.255",
      "http://192.168.1.50:7777",
      "http://169.254.1.1",
      "http://100.101.102.103",
      "http://[::1]:3001",
      "http://[fd12:3456::1]",
      "http://[fe80::1]",
      "http://nas:7777",
      "http://truenas.local",
      "http://pokedex.lan",
      "http://box.home.arpa",
      "http://app.localhost",
    ])
      expect(isLocalAddress(url), url).toBe(true);
  });

  it("rejects public addresses and anything unparseable", () => {
    for (const url of [
      "http://pokedex.example.com",
      "http://8.8.8.8",
      "http://172.32.0.1",
      "http://192.169.1.1",
      "http://[2001:db8::1]",
      "not a url",
      "",
    ])
      expect(isLocalAddress(url), url).toBe(false);
  });
});

describe("isInsecureRemote", () => {
  it("is only plain HTTP to a public host", () => {
    expect(isInsecureRemote("http://pokedex.example.com")).toBe(true);
    expect(isInsecureRemote("https://pokedex.example.com")).toBe(false);
    expect(isInsecureRemote("http://192.168.1.50:7777")).toBe(false);
  });
});

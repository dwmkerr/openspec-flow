import { SignJWT, exportJWK, generateKeyPair, type KeyLike } from "jose";
import { broker, GITHUB_OIDC_ISSUER } from "./index";

// Test harness: spin up a fake JWKS server so jose can fetch keys.
// Using nock would be lighter but jose's createRemoteJWKSet pulls
// once and caches, so a per-test bound HTTP server is simpler.
import { createServer, type Server } from "node:http";

const noopLog = { info: jest.fn(), warn: jest.fn() };

interface Harness {
  audience: string;
  jwksUrl: string;
  signKey: KeyLike;
  // address of the local jwks server so we can stop it after.
  server: Server;
}

const startJwksServer = async (): Promise<Harness> => {
  const audience = "openspec-flow-test";
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test-kid";
  jwk.alg = "RS256";
  jwk.use = "sig";

  const server = createServer((req, res) => {
    if (req.url === "/.well-known/jwks") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  const jwksUrl = `http://127.0.0.1:${addr.port}/.well-known/jwks`;
  return { audience, jwksUrl, signKey: privateKey, server };
};

const stop = (h: Harness): Promise<void> =>
  new Promise((resolve) => h.server.close(() => resolve()));

const mintClaim = async (
  h: Harness,
  override: Record<string, any> = {},
): Promise<string> => {
  return await new SignJWT({
    repository: "dwmkerr/sandbox",
    repository_id: "1",
    repository_owner: "dwmkerr",
    workflow_ref: "dwmkerr/sandbox/.github/workflows/openspec-flow.yml@refs/heads/main",
    job_workflow_ref:
      "dwmkerr/openspec-flow/.github/workflows/openspec-flow.yml@refs/heads/main",
    ref: "refs/heads/main",
    ...override,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setIssuer(GITHUB_OIDC_ISSUER)
    .setAudience(h.audience)
    .setExpirationTime("5m")
    .setIssuedAt()
    .sign(h.signKey);
};

const mockIssuer = (override: any = {}) => ({
  getInstallationId: jest.fn(async () => 12345),
  mintToken: jest.fn(async () => ({
    token: "ghs_FAKE",
    expiresAt: "2099-01-01T00:00:00Z",
  })),
  ...override,
});

describe("broker", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startJwksServer();
  });
  afterAll(async () => {
    await stop(h);
  });
  beforeEach(() => jest.clearAllMocks());

  it("returns a fresh installation token on a valid OIDC claim", async () => {
    const issuer = mockIssuer();
    const idToken = await mintClaim(h);
    const result = await broker(
      idToken,
      { audience: h.audience, jwksUrl: h.jwksUrl },
      issuer,
      noopLog,
    );
    expect("token" in result).toBe(true);
    if ("token" in result) {
      expect(result.token).toBe("ghs_FAKE");
      expect(result.repository).toBe("dwmkerr/sandbox");
    }
    expect(issuer.getInstallationId).toHaveBeenCalledWith("dwmkerr", "sandbox");
    expect(issuer.mintToken).toHaveBeenCalledWith(12345);
  });

  it("rejects when bearer token is missing", async () => {
    const result = await broker(null, { audience: h.audience, jwksUrl: h.jwksUrl }, mockIssuer(), noopLog);
    expect(result).toEqual({ status: 400, error: expect.stringMatching(/missing/i) });
  });

  it("rejects when audience mismatches", async () => {
    const idToken = await mintClaim(h);
    const result = await broker(
      idToken,
      { audience: "other-audience", jwksUrl: h.jwksUrl },
      mockIssuer(),
      noopLog,
    );
    expect("status" in result && result.status).toBe(401);
  });

  it("rejects when job_workflow_ref does not match the openspec-flow pattern", async () => {
    const idToken = await mintClaim(h, {
      job_workflow_ref:
        "evil/repo/.github/workflows/exfiltrate.yml@refs/heads/main",
    });
    const result = await broker(
      idToken,
      { audience: h.audience, jwksUrl: h.jwksUrl },
      mockIssuer(),
      noopLog,
    );
    expect("status" in result && result.status).toBe(401);
  });

  it("returns 403 when the App is not installed on the repo", async () => {
    const idToken = await mintClaim(h);
    const issuer = mockIssuer({
      getInstallationId: jest.fn(async () => {
        const err: any = new Error("Not Found");
        err.status = 404;
        throw err;
      }),
    });
    const result = await broker(
      idToken,
      { audience: h.audience, jwksUrl: h.jwksUrl },
      issuer,
      noopLog,
    );
    expect("status" in result && result.status).toBe(403);
  });

  it("returns 500 when token mint fails", async () => {
    const idToken = await mintClaim(h);
    const issuer = mockIssuer({
      mintToken: jest.fn(async () => {
        throw new Error("rate limit");
      }),
    });
    const result = await broker(
      idToken,
      { audience: h.audience, jwksUrl: h.jwksUrl },
      issuer,
      noopLog,
    );
    expect("status" in result && result.status).toBe(500);
  });
});

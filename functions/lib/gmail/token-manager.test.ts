import { describe, it, expect, vi, beforeEach } from "vitest";
import { GmailTokenManager } from "./token-manager";

// Mock googleapis module
vi.mock("googleapis", () => {
  const mockOAuth2Instance = {
    setCredentials: vi.fn(),
    getAccessToken: vi.fn(),
    refreshAccessToken: vi.fn(),
    credentials: {},
  };
  
  return {
    google: {
      auth: {
        OAuth2: vi.fn(() => mockOAuth2Instance),
      },
      gmail: vi.fn(() => ({
        users: {
          getProfile: vi.fn(),
        },
      })),
    },
  };
});

describe("GmailTokenManager", () => {
  let tokenManager: GmailTokenManager;
  let mockOAuth2Client: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockOAuth2Client = {
      setCredentials: vi.fn(),
      getAccessToken: vi.fn(),
      refreshAccessToken: vi.fn(),
      credentials: {},
    };
    
    // OAuth2 mock is already set up in module mock
    
    tokenManager = new GmailTokenManager({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      refreshToken: "test-refresh-token",
    });
  });

  describe("getValidAccessToken", () => {
    it("should return cached token if valid", async () => {
      // Set up a valid cached token
      const validToken = "valid-access-token";
      const futureExpiry = Date.now() + 3600000; // 1 hour from now
      
      mockOAuth2Client.getAccessToken.mockResolvedValue({
        token: validToken,
      });
      
      mockOAuth2Client.credentials = {
        access_token: validToken,
        expiry_date: futureExpiry,
      };

      const result = await tokenManager.getValidAccessToken();
      
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(validToken);
      }
      
      // Second call should use cache
      const result2 = await tokenManager.getValidAccessToken();
      expect(result2.isOk()).toBe(true);
      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalledTimes(1);
    });

    it("should refresh token if expiring soon", async () => {
      const oldToken = "old-token";
      const newToken = "new-access-token";
      const soonExpiry = Date.now() + 240000; // 4 minutes from now
      
      mockOAuth2Client.getAccessToken.mockResolvedValue({
        token: oldToken,
      });
      
      mockOAuth2Client.credentials = {
        access_token: oldToken,
        expiry_date: soonExpiry,
      };
      
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: newToken,
          expiry_date: Date.now() + 3600000,
        },
      });

      const result = await tokenManager.getValidAccessToken();
      
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(newToken);
      }
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });

    it("should handle invalid_grant error", async () => {
      mockOAuth2Client.getAccessToken.mockRejectedValue(
        new Error("invalid_grant: Token has been expired or revoked")
      );

      const result = await tokenManager.getValidAccessToken();
      
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("INVALID_REFRESH_TOKEN");
        expect(result.error.message).toContain("generate:oauth");
      }
    });
  });

  describe("refreshAccessToken", () => {
    it("should successfully refresh token", async () => {
      const newToken = "refreshed-token";
      const newRefreshToken = "new-refresh-token";
      
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: newToken,
          refresh_token: newRefreshToken,
          expiry_date: Date.now() + 3600000,
        },
      });

      const result = await tokenManager.refreshAccessToken();
      
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(newToken);
      }
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: newRefreshToken,
      });
    });

    it("should enforce cooldown between refresh attempts", async () => {
      const token = "test-token";
      
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: token,
          expiry_date: Date.now() + 3600000,
        },
      });

      // First refresh
      await tokenManager.refreshAccessToken();
      
      // Second refresh immediately
      const start = Date.now();
      await tokenManager.refreshAccessToken();
      const elapsed = Date.now() - start;
      
      // Should have waited for cooldown
      expect(elapsed).toBeGreaterThanOrEqual(50); // Allow some margin
    });

    it("should limit refresh attempts", async () => {
      mockOAuth2Client.refreshAccessToken.mockRejectedValue(
        new Error("Network error")
      );

      // Exhaust refresh attempts
      for (let i = 0; i < 4; i++) {
        const result = await tokenManager.refreshAccessToken();
        if (i < 3) {
          expect(result.isErr()).toBe(true);
        } else {
          // Fourth attempt should fail with limit exceeded
          expect(result.isErr()).toBe(true);
          if (result.isErr()) {
            expect(result.error.code).toBe("TOKEN_REFRESH_LIMIT_EXCEEDED");
          }
        }
        
        // Wait for cooldown
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  });

  describe("validateToken", () => {
    it("should validate token successfully", async () => {
      const validToken = "valid-token";
      
      mockOAuth2Client.getAccessToken.mockResolvedValue({
        token: validToken,
      });
      
      mockOAuth2Client.credentials = {
        access_token: validToken,
        expiry_date: Date.now() + 3600000,
      };
      
      const mockGmail = {
        users: {
          getProfile: vi.fn().mockResolvedValue({ data: { emailAddress: "test@gmail.com" } }),
        },
      };
      
      const { google } = await import("googleapis");
      vi.mocked(google.gmail).mockReturnValue(mockGmail as any);

      const result = await tokenManager.validateToken();
      
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(true);
      }
      expect(mockGmail.users.getProfile).toHaveBeenCalledWith({ userId: "me" });
    });

    it("should handle validation failure", async () => {
      mockOAuth2Client.getAccessToken.mockResolvedValue({
        token: "invalid-token",
      });
      
      const mockGmail = {
        users: {
          getProfile: vi.fn().mockRejectedValue(new Error("Invalid Credentials")),
        },
      };
      
      const { google } = await import("googleapis");
      vi.mocked(google.gmail).mockReturnValue(mockGmail as any);

      const result = await tokenManager.validateToken();
      
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("getTokenStatus", () => {
    it("should return current token status", async () => {
      const token = "test-token";
      const expiry = Date.now() + 1800000; // 30 minutes
      
      mockOAuth2Client.getAccessToken.mockResolvedValue({
        token,
      });
      
      mockOAuth2Client.credentials = {
        access_token: token,
        expiry_date: expiry,
      };

      // Get a token to populate cache
      await tokenManager.getValidAccessToken();
      
      const status = tokenManager.getTokenStatus();
      
      expect(status.hasValidToken).toBe(true);
      expect(status.expiresIn).toBeGreaterThan(0);
      expect(status.expiresIn).toBeLessThanOrEqual(1800000);
      expect(status.refreshAttempts).toBe(0);
    });
  });
});
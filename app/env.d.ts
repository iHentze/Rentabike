/**
 * Secrets and optional settings that `wrangler types` cannot see: secrets
 * live in the dashboard, not in wrangler.jsonc. Everything here is optional
 * on purpose — the app runs without any of them, with the feature off.
 */
declare global {
  interface Env {
    /** Card payments switch on when both are set. */
    EPAY_API_KEY?: string;
    EPAY_POS_ID?: string;
    /** Override the ePay API base for a stand-in server. */
    EPAY_BASE_URL?: string;
    /** Cloudflare Access on /admin: "https://<team>.cloudflareaccess.com" and the application's AUD tag. */
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
  }
}

export {};

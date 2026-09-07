/// <reference types="@cloudflare/vitest-pool-workers/types" />

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}

declare module "*.sql?raw" {
  const content: string;
  export default content;
}

declare module "*.csv?raw" {
  const content: string;
  export default content;
}

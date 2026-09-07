import type { Config } from "@react-router/dev/config";

export default {
  // Server-rendered loaders are the whole point: data reaches the browser only
  // when server code puts it there. Never flip this to false.
  ssr: true,
} satisfies Config;

import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Standard TanStack Start + Nitro build. No Lovable editor, cloud or credits
// are required to build or serve the app on a compatible Node.js host.
// Keep the existing SSR error handler and the manually maintained MCP routes.
export default defineConfig({
  server: { port: 3000 },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
    nitro({ preset: "node-server" }),
  ],
});

import { createFileRoute } from "@tanstack/react-router";
import { nfsePublicReadiness } from "@/lib/nfse/server-config";

export const Route = createFileRoute("/api/nfse/status")({
  server: {
    handlers: {
      GET: () =>
        Response.json(nfsePublicReadiness(), {
          headers: { "Cache-Control": "no-store" },
        }),
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { nfsePublicReadiness } from "@/lib/nfse/server-config";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => {
        const supabaseConfigured = Boolean(
          process.env["SUPABASE_URL"] && process.env["SUPABASE_PUBLISHABLE_KEY"],
        );

        return Response.json(
          {
            ok: supabaseConfigured,
            service: "ritmeia",
            supabaseConfigured,
            nfse: nfsePublicReadiness(),
          },
          { status: supabaseConfigured ? 200 : 503 },
        );
      },
    },
  },
});

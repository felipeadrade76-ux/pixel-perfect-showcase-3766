import { createFileRoute } from "@tanstack/react-router";

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
          },
          {
            status: supabaseConfigured ? 200 : 503,
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});

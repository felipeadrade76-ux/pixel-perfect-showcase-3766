import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function requireApiUser(request: Request): Promise<string> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const token = header.slice("Bearer ".length).trim();
  if (!token) throw new Error("UNAUTHORIZED");

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.id) throw new Error("UNAUTHORIZED");
  return data.user.id;
}

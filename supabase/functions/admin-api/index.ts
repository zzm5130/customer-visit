import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the caller's auth context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized: Missing header");
    }

    // Use service role client to verify the user's JWT
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser(jwt);

    if (authError || !caller) {
      console.error("Auth error:", authError);
      throw new Error("Unauthorized");
    }

    console.log("Caller verified:", caller.id);

    // Check if caller is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      throw new Error("Forbidden: User profile not found");
    }

    if (profile.role !== "admin") {
      throw new Error("Forbidden: Admin access required");
    }

    const body = await req.json();
    console.log("Received request:", body);
    const { action, userId, password, visitId } = body;

    if (action === "update-password") {
      if (!userId || !password) {
        throw new Error("Missing userId or password");
      }

      const { error } = await supabaseClient.auth.admin.updateUserById(
        userId,
        { password: password }
      );

      if (error) throw error;

      return new Response(
        JSON.stringify({ message: "Password updated successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (action === "delete-visit") {
      if (!visitId) {
        throw new Error("Missing visitId");
      }

      // Get visit details to find recording path
      const { data: visit, error: fetchError } = await supabaseClient
        .from("visits")
        .select("recording_url")
        .eq("id", visitId)
        .maybeSingle();

      if (fetchError) {
        console.error("Fetch visit error:", fetchError);
        throw fetchError;
      }

      if (!visit) {
        throw new Error("Visit not found");
      }

      // Delete from storage if path exists
      if (visit.recording_url) {
        console.log("Deleting recording from storage:", visit.recording_url);
        const { error: storageError } = await supabaseClient
          .storage
          .from("recordings")
          .remove([visit.recording_url]);
        
        if (storageError) {
          console.error("Storage deletion error (non-fatal):", storageError);
        }
      }

      // Delete from database
      const { error: dbError } = await supabaseClient
        .from("visits")
        .delete()
        .eq("id", visitId);

      if (dbError) {
        console.error("Database deletion error:", dbError);
        throw dbError;
      }

      console.log("Visit deleted successfully:", visitId);
      return new Response(
        JSON.stringify({ message: "Visit deleted successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("Edge function error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

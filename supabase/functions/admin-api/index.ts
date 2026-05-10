import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the caller's auth context
    const authHeader = req.headers.get('Authorization')!
    const tempClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user: caller }, error: authError } = await tempClient.auth.getUser()

    if (authError || !caller) {
      throw new Error('Unauthorized')
    }

    // Check if caller is admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (profile?.role !== 'admin') {
      throw new Error('Forbidden: Admin access required')
    }

    const { action, userId, password, visitId } = await req.json()

    if (action === 'update-password') {
      if (!userId || !password) {
        throw new Error('Missing userId or password')
      }

      const { data, error } = await supabaseClient.auth.admin.updateUserById(
        userId,
        { password: password }
      )

      if (error) throw error

      return new Response(
        JSON.stringify({ message: 'Password updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (action === 'delete-visit') {
      if (!visitId) {
        throw new Error('Missing visitId')
      }

      // Get visit details to find recording path
      const { data: visit, error: fetchError } = await supabaseClient
        .from('visits')
        .select('recording_path')
        .eq('id', visitId)
        .single()

      if (fetchError) throw fetchError

      // Delete from storage if path exists
      if (visit?.recording_path) {
        const { error: storageError } = await supabaseClient
          .storage
          .from('recordings')
          .remove([visit.recording_path])
        // We don't throw here to avoid blocking DB deletion if file is already gone
        if (storageError) console.error('Storage deletion error:', storageError)
      }

      // Delete from database
      const { error: dbError } = await supabaseClient
        .from('visits')
        .delete()
        .eq('id', visitId)

      if (dbError) throw dbError

      return new Response(
        JSON.stringify({ message: 'Visit deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    throw new Error('Invalid action')
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const typeMap: Record<number, string> = {
  0: 'short_answer',
  1: 'paragraph',
  2: 'multiple_choice',
  3: 'dropdown',
  4: 'checkboxes',
  5: 'scale',
  7: 'grid',
  9: 'date',
  10: 'time',
  13: 'file_upload',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function extractLoadData(html: string) {
  const marker = 'FB_PUBLIC_LOAD_DATA_'
  const markerIndex = html.indexOf(marker)
  if (markerIndex < 0) throw new Error('Google Form structure marker was not found.')
  const start = html.indexOf('[', markerIndex)
  if (start < 0) throw new Error('Google Form data array was not found.')

  // Parse the JSON array while respecting quoted strings instead of relying on a fragile regex.
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '[') depth++
    if (ch === ']') {
      depth--
      if (depth === 0) return JSON.parse(html.slice(start, i + 1))
    }
  }
  throw new Error('Google Form data array was incomplete.')
}

function cleanOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const values: string[] = []
  for (const item of raw) {
    if (Array.isArray(item) && item[0] != null) values.push(String(item[0]))
    else if (typeof item === 'string' || typeof item === 'number') values.push(String(item))
  }
  return [...new Set(values)]
}

function parseForm(data: any) {
  const container = data?.[1]
  if (!Array.isArray(container)) throw new Error('Unexpected Google Form structure.')
  const title = container?.[8] || data?.[3] || 'Imported form'
  const description = container?.[0] || ''
  const items = Array.isArray(container?.[1]) ? container[1] : []

  const fields = items.flatMap((field: any, index: number) => {
    if (!Array.isArray(field) || typeof field?.[3] !== 'number' || !Array.isArray(field?.[4]) || !field[4]?.[0]) return []
    const rawType = Number(field[3])
    const answerNode = field[4][0]
    const entryId = answerNode?.[0] != null ? String(answerNode[0]) : null
    const required = Number(answerNode?.[2] || 0) === 1
    let options = cleanOptions(answerNode?.[1])

    // Linear scales store bounds/labels differently. Try to preserve a usable list.
    if (rawType === 5 && options.length === 0 && Array.isArray(answerNode?.[1])) options = cleanOptions(answerNode[1])

    return [{
      google_field_id: field?.[0] != null ? String(field[0]) : null,
      google_entry_id: entryId,
      sort_order: index + 1,
      label: String(field?.[1] || `Question ${index + 1}`),
      description: field?.[2] ? String(field[2]) : null,
      field_type: typeMap[rawType] || 'short_answer',
      required,
      options,
      raw_type: rawType,
      raw_data: field,
    }]
  })

  return { title: String(title), description: String(description || ''), fields }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'POST required' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}')?.default
    const authHeader = req.headers.get('Authorization') || ''
    if (!anonKey) throw new Error('No Supabase browser key available to the function.')

    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return jsonResponse({ ok: false, error: 'Sign in first.' }, 401)

    const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle()
    if (!adminRow) return jsonResponse({ ok: false, error: 'Admin access required.' }, 403)

    const body = await req.json()
    const url = String(body?.url || '')
    if (!/^https:\/\/docs\.google\.com\/forms\/d\/e\/[A-Za-z0-9_-]+\/viewform/.test(url)) {
      return jsonResponse({ ok: false, error: 'Enter a public Google Forms /viewform URL.' }, 400)
    }

    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FormImporter/1.0)' } })
    if (!response.ok) throw new Error(`Google returned HTTP ${response.status}`)
    const html = await response.text()
    const parsed = parseForm(extractLoadData(html))
    if (!parsed.fields.length) throw new Error('No supported question fields were found.')

    const { error: deleteError } = await supabase.from('form_fields').delete().neq('id', 0)
    if (deleteError) throw deleteError
    const { error: insertError } = await supabase.from('form_fields').insert(parsed.fields)
    if (insertError) throw insertError

    const { error: settingsError } = await supabase.from('app_settings').upsert({
      id: 'main',
      title: parsed.title,
      description: parsed.description,
      source_form_url: url,
      updated_at: new Date().toISOString(),
    })
    if (settingsError) throw settingsError

    return jsonResponse({ ok: true, fieldCount: parsed.fields.length, title: parsed.title })
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500)
  }
})

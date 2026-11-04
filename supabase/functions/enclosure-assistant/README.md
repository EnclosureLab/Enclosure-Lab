# Enclosure Lab Assistant Edge Function

This function powers the existing `enclosure-assistant.js` chat widget. It calls
OpenAI from Supabase so the OpenAI API key is never sent to GitHub Pages or the browser.

## Deploy

Prerequisites: a Supabase account with access to project `lblrmljsjimrrighqbdo`,
an OpenAI API key, and the Supabase CLI installed.

From the repository root:

```bash
supabase login
supabase link --project-ref lblrmljsjimrrighqbdo
supabase secrets set OPENAI_API_KEY=your_real_openai_api_key
supabase functions deploy enclosure-assistant --no-verify-jwt
```

Use your real key only in the terminal prompt/secret manager. Do not put it in this
repository, a website file, a screenshot, or a customer message. The
`--no-verify-jwt` flag is required because the current public website widget sends
the Supabase publishable key and does not have customer login sessions. The
function still validates the request and restricts browser origins to the live
Enclosure Lab GitHub Pages origin.

## Test

After deployment, send a test request:

```bash
curl -i 'https://lblrmljsjimrrighqbdo.supabase.co/functions/v1/enclosure-assistant' \
  -H 'Content-Type: application/json' \
  -H 'apikey: YOUR_SUPABASE_PUBLISHABLE_KEY' \
  -H 'Authorization: Bearer YOUR_SUPABASE_PUBLISHABLE_KEY' \
  -H 'Origin: https://enclosurelab.github.io' \
  --data '{"messages":[{"role":"user","content":"What is the difference between a sealed and ported enclosure?"}]}'
```

A successful response is HTTP 200 with JSON containing a non-empty `reply`. Then
open the live website, use **Ask Enclosure Lab**, and send a question to verify the
complete browser-to-function-to-OpenAI path.

## Notes

- Required Supabase secret: `OPENAI_API_KEY`.
- The function currently uses the OpenAI `gpt-4.1-mini` model.
- The function limits message history and request size and does not return upstream
  provider errors or credentials to the browser.
- Configure usage limits/monitoring in Supabase and OpenAI before promoting the
  assistant broadly. CORS is not authentication and does not prevent non-browser
  callers; the public endpoint should be monitored for abuse and unexpected cost.
- Responses are informational, not guaranteed enclosure engineering specifications.
  Verify manufacturer specifications, fitment, port calculations, and final build
  measurements before cutting material.

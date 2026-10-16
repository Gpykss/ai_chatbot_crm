# Johns CRM: AI chatting demo

A demo of the AI chatting CRM. It has a multi-creator inbox, autopilot replies (a saved script when one matches, AI otherwise), a safety check that hands risky chats to a human, fan profiles, creator personas and analytics.

All fans and chats are sample data. OnlyFans is not connected yet.

## Run it on your computer

1. Install Node.js 20 or newer from nodejs.org if you don't have it.
2. Open this folder in VS Code, then open a terminal (Terminal → New Terminal).
3. Run `npm install` (only the first time).
4. Copy `.env.example` to a new file called `.env.local`.
5. Optional: paste your OpenRouter key into `.env.local` after `OPENROUTER_API_KEY=`. Without a key, AI replies are samples.
6. Run `npm run dev` and open http://localhost:3000

## Put it online (to send John a link)

1. Create a GitHub repo and push this folder to it. `.env.local` is ignored, so your key stays private.
2. On vercel.com, choose Add New → Project and import the repo.
3. Under Environment Variables, add the same values as in `.env.local`.
4. Deploy. Vercel gives you a link.

## How a reply is decided (app/api/reply/route.js)

1. **Safety check**: under 18, meeting in person, refunds, distress, or "are you a bot" → autopilot stops on that chat and it's flagged "Needs human".
2. **Script match**: a trigger word in the fan's language → the saved script is sent exactly as written. Each fan gets each script only once.
3. **AI**: everything else goes to OpenRouter, with the creator's persona, the fan's notes and the last 20 messages. The AI's reply is checked again before it's sent.

## Files

- `lib/data.js`: sample creators, fans and scripts
- `lib/engine.js`: safety rules, script matching and the AI prompt
- `app/api/reply/route.js`: the autopilot step (server side, keeps the API key secret)
- `components/CRM.js`: the dashboard

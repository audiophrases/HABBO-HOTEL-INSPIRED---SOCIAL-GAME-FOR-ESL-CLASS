# Pixel Plaza

A local prototype of a social plaza for an ESL class. Students can choose avatars, move around a shared map, use emotes, and submit chat messages. Every chat message must be approved by the teacher before classmates see it.

## Run locally

Install dependencies once in the project root and `server/` with `npm ci`.

In a PowerShell terminal, set a private class PIN and teacher key, then start the server:

```powershell
cd server
$env:CLASS_PIN = '123456'
$env:TEACHER_KEY = 'replace-with-a-long-private-key'
npm run dev
```

In another terminal, start the frontend from the project root:

```powershell
npm run dev
```

Open the Vite URL shown in the terminal. Go to `/teacher`, enter the teacher key, and open the class. Students enter the class PIN and a display name at `/`. The server validates the PIN when they join the multiplayer room. The teacher page shows pending and blocked chat, and can approve, reject, or mute a student. Closing the class rejects pending chat and prevents new student joins and messages.

The frontend connects to `http://localhost:2567` by default. Set `VITE_SERVER_URL` before starting Vite to use another server URL. For a browser on a different device, use a server address reachable from that device and set `APP_ORIGIN` on the server to the frontend origin. Use HTTPS and WSS outside a local network; the teacher key is sent in a request header.

## Check the build

Run `npm run build` in the project root, and `npm run build` plus `npm test` in `server/`.
Run `npm run build` in `server/` before using `npm start` there.

## Current limits

- The PIN is shared by the class and display names are self-selected. This is not individual student authentication.
- Teacher controls, message history, pending reviews, and mutes live only in server memory. Restarting the server clears them and closes the class.
- Mutes apply to a connection. A student can reconnect with a new session ID, so a mute is not a durable ban.
- The word and phrase filter catches only a small set of obvious cases. Teacher approval is the moderation gate. There is no dictionary enforcement or AI context review.
- Chat is shared across the room. Proximity chat, whispers, room decoration, persistence, and building interiors are not implemented.
- Browser controls cannot reliably stop screenshots or external translation tools.

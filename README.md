# Pixel Plaza

A local prototype of a social plaza for an ESL class. Students sign in through PinPlay's Google student login, choose avatars, move around a shared map, use emotes, and submit chat messages. Every chat message must be approved by the teacher before classmates see it.

## Run locally

Install dependencies once in the project root and `server/` with `npm ci`.

PinPlay's student login must be enabled. Add the frontend origin (for example `http://localhost:5173`, or `http://127.0.0.1:5173` if that is the address you use) to the PinPlay Google OAuth web client's **Authorized JavaScript origins**. Google currently rejects Pixel Plaza's local origin until this is done. The frontend gets that client's public ID through the local server; the server exchanges Google credentials and validates PinPlay student tokens through `https://api.pinplay.win`. Set `PINPLAY_API_URL` on the server only if your PinPlay API is hosted elsewhere. Browser storage is isolated by origin, so a student may need to sign in again here even if already signed in at PinPlay.

In a PowerShell terminal, set a private class PIN and teacher key, then start the server:

```powershell
cd server
$env:CLASS_PIN = '123456'
$env:TEACHER_KEY = 'replace-with-a-long-private-key'
npm run dev
```

Restart the server command after changing server code; it compiles TypeScript when it starts.

In another terminal, start the frontend from the project root:

```powershell
npm run dev
```

Open the Vite URL shown in the terminal. Go to `/teacher`, enter the teacher key, and open the class. Students enter the class PIN and sign in with the same Google account they use for PinPlay at `/`. The server validates both the PIN and PinPlay student token when they join the multiplayer room. Display names come from PinPlay, and mutes follow its stable student key across reconnects. The teacher page shows pending and blocked chat, and can approve, reject, or mute a student. Closing the class rejects pending chat and prevents new student joins and messages.

The frontend connects to `http://localhost:2567` by default. Set `VITE_SERVER_URL` before starting Vite to use another server URL. For a browser on a different device, use a server address reachable from that device and set `APP_ORIGIN` on the server to the frontend origin. Use HTTPS and WSS outside a local network; the teacher key is sent in a request header.

## Check the build

Run `npm run build` in the project root, and `npm run build` plus `npm test` in `server/`.
Run `npm run build` in `server/` before using `npm start` there.

## Current limits

- The PIN is shared by the class. PinPlay supplies each student's verified Google identity; this app depends on PinPlay's login and roster policy. Configure PinPlay's roster policy for the intended class before using this with students.
- Teacher controls, message history, pending reviews, and mutes live only in server memory. Restarting the server clears them and closes the class. Mutes survive a reconnect but not a server restart.
- The word and phrase filter catches only a small set of obvious cases. Teacher approval is the moderation gate. There is no dictionary enforcement or AI context review.
- Chat is shared across the room. Proximity chat, whispers, room decoration, persistence, and building interiors are not implemented.
- Browser controls cannot reliably stop screenshots or external translation tools.

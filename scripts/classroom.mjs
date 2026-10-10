// Runs the class on the teacher's laptop: the same Worker and plaza as online,
// under `wrangler dev`, reachable from the school network. Students still sign
// in with Google online (Google needs HTTPS) and are sent here.
//
//   npm run classroom
//
// PLAZA_LAN_URL overrides the address students' laptops use to reach this one;
// PLAZA_CLOUD_URL the online site where they sign in.
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.join(import.meta.dirname, '..');
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const port = Number(process.env.PORT || 8787);
const cloudUrl = process.env.PLAZA_CLOUD_URL || 'https://pixel-plaza.eugenime.workers.dev';

// The school network address: a private IPv4 address, Wi-Fi or cable.
function lanAddress() {
    const addresses = Object.values(os.networkInterfaces()).flat()
        .filter(item => item && item.family === 'IPv4' && !item.internal).map(item => item.address);
    return addresses.find(address => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)) || addresses[0];
}

const address = lanAddress();
const lanUrl = process.env.PLAZA_LAN_URL || (address && `http://${address}:${port}`);
if (!lanUrl) {
    console.error('No network connection found. Connect to the school network, or set PLAZA_LAN_URL.');
    process.exit(1);
}

console.log(`
  Pixel Plaza is running on this laptop.

  Teacher controls (on this laptop):  http://localhost:${port}/teacher
  Students sign in at:                ${cloudUrl}
  and are then sent here:             ${lanUrl}

  Sign in to the teacher controls first: that is what sends students here.
  Keep this window open during the lesson. Ctrl+C stops the class.
`);

const child = spawn(process.execPath, [wrangler, 'dev', '--ip', '0.0.0.0', '--port', String(port),
    '--persist-to', path.join(root, '.wrangler', 'classroom'), '--show-interactive-dev-session=false',
    '--var', `LAN_URL:${lanUrl}`, '--var', `CLOUD_URL:${cloudUrl}`], {
    cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'inherit'
});
child.on('exit', code => process.exit(code ?? 0));

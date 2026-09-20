import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export async function startServer({ production = false, trustProxyHops = '' } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'puzzlemind-fixture-'));
  const port = 20000 + Math.floor(Math.random() * 20000),
    base = `http://localhost:${port}`;
  const env = {
    ...process.env,
    DATA_DIR: directory,
    PORT: String(port),
    NODE_ENV: production ? 'production' : 'test',
    APP_URL: base,
    SMTP_URL: '',
    TRUST_PROXY_HOPS: trustProxyHops,
  };
  const server = spawn(process.execPath, ['server/index.js'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (chunk) => (output += chunk.toString()));
  server.stderr.on('data', (chunk) => (output += chunk.toString()));
  async function stop() {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await exited;
    }
    rmSync(directory, { recursive: true, force: true });
  }
  try {
    for (let i = 0; i < 200; i++) {
      if (output.includes('API is running')) break;
      if (server.exitCode !== null) throw new Error(output);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!output.includes('API is running')) throw new Error(`Server did not start: ${output}`);
  } catch (error) {
    await stop();
    throw error;
  }
  const request = async (path, { method = 'GET', body, cookie = '', headers = {} } = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get('set-cookie')?.split(';')[0] || '',
    };
  };
  const grantAdmin = (email) =>
    execFileSync(process.execPath, ['server/admin-cli.js', email], {
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  return { base, env, directory, request, grantAdmin, stop };
}

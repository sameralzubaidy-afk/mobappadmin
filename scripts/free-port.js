#!/usr/bin/env node

const { execSync } = require('node:child_process');

const DEFAULT_PORT = 3001;
const portArg = process.argv[2] || process.env.PORT || `${DEFAULT_PORT}`;
const port = Number(portArg);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`[free-port] Invalid port: ${portArg}`);
  process.exit(1);
}

const getListeningPids = (targetPort) => {
  try {
    const output = execSync(`lsof -ti tcp:${targetPort} -sTCP:LISTEN`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();

    if (!output) return [];

    return output
      .split(/\s+/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value));
  } catch {
    return [];
  }
};

const pids = getListeningPids(port).filter((pid) => pid !== process.pid);

if (pids.length === 0) {
  console.log(`[free-port] Port ${port} is already free.`);
  process.exit(0);
}

for (const pid of pids) {
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`[free-port] Sent SIGTERM to PID ${pid} on port ${port}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[free-port] Could not SIGTERM PID ${pid}: ${message}`);
  }
}

const remainingPids = getListeningPids(port).filter((pid) => pids.includes(pid));

for (const pid of remainingPids) {
  try {
    process.kill(pid, 'SIGKILL');
    console.log(`[free-port] Sent SIGKILL to PID ${pid} on port ${port}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[free-port] Could not SIGKILL PID ${pid}: ${message}`);
  }
}

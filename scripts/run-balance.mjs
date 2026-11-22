// Runs scripts/balance.ts through Vite's module runner (no extra dependency).
import { runnerImport } from 'vite';

const { module } = await runnerImport(new URL('./balance.ts', import.meta.url).pathname);
const days = Number(process.argv[2] ?? 10);
console.log(module.formatReport(module.runBalance(module.DEFAULT_SEEDS, days)));

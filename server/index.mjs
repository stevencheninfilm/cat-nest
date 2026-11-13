import { createApplicationServer } from './bootstrap.mjs';

try { process.loadEnvFile?.(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const server = await createApplicationServer({ courtOptions: { onError: (error) => console.error('Court server error:', error.message) } });
if (!server.courtStorageStatus().available) console.error('Court storage unavailable; court API returns 503 while home and restaurant APIs remain available.');
const port = Number(process.env.PORT || 8787);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be a valid port number');
server.listen(port, process.env.HOST || '0.0.0.0', () => {
  console.log(`猫猫判官服务已启动：http://localhost:${server.address().port}`);
  if (!process.env.OPENAI_API_KEY) console.log('尚未配置 OPENAI_API_KEY；可提交陈词，配置后才能进行真实 AI 分析。');
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.closePetHandler();
  server.close(async () => {
    try { await server.closeCourtStore(); } finally { process.exit(0); }
  });
  setTimeout(() => process.exit(0), 10000).unref();
});

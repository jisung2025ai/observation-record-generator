import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { mkdirSync } from 'fs';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const gunzipAsync = promisify(gunzip);

// HOME 기반 동적 경로 계산 (env-paths 'notebooklm-mcp' suffix "" 방식 복제)
function getNotebooklmDataDir() {
  const platform = os.platform();
  const home = process.env.HOME || os.homedir();
  if (platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'notebooklm-mcp');
  } else if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'notebooklm-mcp');
  } else {
    return path.join(home, '.local', 'share', 'notebooklm-mcp');
  }
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const EXPRESS_PORT = parseInt(process.env.EXPRESS_PORT || '3001', 10);
const dev = process.env.NODE_ENV !== 'production';

// ── 쿠키 복원 (Railway 환경, notebooklm-mcp state.json 방식) ──
async function restoreAuthCookies() {
  const stateB64 = process.env.NOTEBOOKLM_STORAGE_STATE_B64;
  if (!stateB64) {
    console.log('[Auth] NOTEBOOKLM_STORAGE_STATE_B64 없음 - 로컬 쿠키 사용');
    return;
  }

  // env-paths 라이브러리와 동일한 방식으로 경로 계산
  const dataDir = getNotebooklmDataDir();
  const browserStateDir = path.join(dataDir, 'browser_state');
  console.log(`[Auth] HOME=${process.env.HOME}, dataDir=${dataDir}`);

  try {
    mkdirSync(browserStateDir, { recursive: true });

    // gzip 압축 해제 → JSON 파싱
    const compressed = Buffer.from(stateB64, 'base64');
    const jsonBuf = await gunzipAsync(compressed);
    const storageState = JSON.parse(jsonBuf.toString('utf8'));

    console.log(`[Auth] storageState 파싱 완료 (쿠키 ${storageState.cookies?.length || 0}개)`);

    // notebooklm-mcp가 읽는 state.json 저장
    const { writeFileSync } = await import('fs');
    const statePath = path.join(browserStateDir, 'state.json');
    writeFileSync(statePath, jsonBuf.toString('utf8'), 'utf8');
    console.log(`[Auth] ✅ state.json 저장 완료: ${statePath} (쿠키 ${storageState.cookies?.length || 0}개)`);

    // chrome_profile 디렉토리도 미리 생성 (notebooklm-mcp가 탐색)
    const chromeProfileDir = path.join(dataDir, 'chrome_profile');
    mkdirSync(chromeProfileDir, { recursive: true });
    mkdirSync(path.join(dataDir, 'chrome_profile_instances'), { recursive: true });
    console.log(`[Auth] ✅ 디렉토리 구조 생성 완료`);
  } catch (err) {
    console.error('[Auth] ❌ 쿠키 복원 실패:', err.message);
  }
}
// ── Next.js 앱 초기화 ────────────────────────────────────────
const app = next({ dev, hostname: '0.0.0.0', port: PORT });
const handle = app.getRequestHandler();

// ── MCP 클라이언트 ───────────────────────────────────────────
let mcpClient = null;
let isConnecting = false;

async function initMCP() {
  if (isConnecting) {
    let waited = 0;
    while (isConnecting && waited < 90000) {   // 90초 대기
      await new Promise(r => setTimeout(r, 500));
      waited += 500;
    }
    if (mcpClient) return;
    throw new Error('MCP 연결 대기 시간 초과');
  }

  if (mcpClient) return;

  isConnecting = true;
  console.log('[MCP] Connecting to NotebookLM MCP...');

  try {
    // HOME 및 경로 환경변수를 명시적으로 전달하여 state.json 경로 일치 보장
    const mcpEnv = {
      ...process.env,
      HOME: process.env.HOME || os.homedir(),
      HEADLESS: 'true',
    };
    console.log(`[MCP] HOME=${mcpEnv.HOME}, dataDir=${getNotebooklmDataDir()}`);
    // 로컬 설치된 바이너리 직접 실행 → npx 런타임 다운로드 지연 없음
    const transport = new StdioClientTransport({
      command: 'node',
      args: [path.join(process.cwd(), 'node_modules', 'notebooklm-mcp', 'dist', 'index.js')],
      env: mcpEnv,
    });

    const client = new Client(
      { name: 'observation-record-proxy', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('MCP 연결 타임아웃 (60초)')), 60000)
      )
    ]);

    mcpClient = client;
    console.log('[MCP] Connected successfully.');
  } catch (err) {
    mcpClient = null;
    console.error('[MCP] Connection failed:', err.message);
    throw err;
  } finally {
    isConnecting = false;
  }
}

// ── Express API 라우터 ────────────────────────────────────────
const api = express();
api.use(cors());
api.use(bodyParser.json());

api.get('/health', (req, res) => {
  res.json({ status: 'ok', mcp_connected: !!mcpClient, mcp_connecting: isConnecting });
});

api.post('/api/setup-auth', async (req, res) => {
  try {
    if (!mcpClient) await initMCP();
    const result = await mcpClient.callTool({ name: 'setup_auth', arguments: { show_browser: true } });
    res.json({ success: true, result });
  } catch (error) {
    mcpClient = null;
    res.status(500).json({ success: false, error: error.message });
  }
});

api.post('/api/generate', async (req, res) => {
  const { domain, item, level, situationKeyword, activityKeyword } = req.body;

  if (!domain || !item || !level || !situationKeyword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let prompt = `${domain} 영역, ${item}문항, ${level}수준 기준을 적용하여, '${situationKeyword}'`;
  if (activityKeyword) prompt += ` 및 '${activityKeyword}'`;
  prompt += ` 상황을 바탕으로 100자 내외의 유아 관찰기록 초안(관찰내용)과 이에 대한 평가 및 지원계획(배움지원)을 자연스러운 문장으로 작성해줘. 응답은 반드시 아래 형식을 지켜서 출력해줘:\n\n[관찰내용]\n(관찰내용 작성)\n[평가 및 지원계획]\n(평가 및 지원계획 작성)\n\n[매우 중요한 주의사항]\n1. ** (볼드체) 같은 마크다운 기호를 제목이나 내용에 절대 사용하지 말고, 오직 [관찰내용]과 [평가 및 지원계획]이라는 텍스트만 정확하게 출력해.\n2. 서론이나 안내 문구도 모두 생략해.\n3. 문장 끝에 원본 텍스트의 출처 표시처럼 보이는 불필요한 숫자(예: '한다1.', '여긴다12')를 절대 쓰지 말고 깔끔한 한국어 문장 기호로만 끝내.`;

  const NOTEBOOK_URL = 'https://notebooklm.google.com/notebook/3355022d-7393-472c-9bca-95f8a52fe531';

  try {
    if (!mcpClient) await initMCP();

    const result = await mcpClient.callTool({
      name: 'ask_question',
      arguments: {
        notebook_url: NOTEBOOK_URL,
        question: prompt,
        browser_options: {
          show: false,
          stealth: { enabled: false },  // stealth 비활성화로 속도 향상
          timeout_ms: 240000            // 4분
        }
      }
    }, undefined, { timeout: 300000 }); // 5분

    let draftText = '결과를 받아오지 못했습니다.';

    if (result?.content?.length > 0) {
      const contentBlock = result.content[0];
      if (contentBlock?.text) {
        try {
          const parsed = JSON.parse(contentBlock.text);
          draftText = parsed.success && parsed.data?.answer ? parsed.data.answer : contentBlock.text;
        } catch {
          draftText = contentBlock.text;
        }
      }
    }

    draftText = draftText.replace(/\d+$/, '').trim();
    const splitIdx = draftText.indexOf('EXTREMELY IMPORTANT:');
    if (splitIdx !== -1) draftText = draftText.substring(0, splitIdx).trim();

    res.json({ success: true, draft: draftText });

  } catch (error) {
    console.error('[MCP] Execution Error:', error);
    mcpClient = null;
    res.status(500).json({ success: false, error: 'MCP 통신 오류: ' + error.message });
  }
});

// ── 서버 시작 ─────────────────────────────────────────────────
await restoreAuthCookies();

// MCP 미리 초기화 (첫 요청 지연 제거)
initMCP().then(() => {
  console.log('[MCP] 🔥 사전 초기화 완료');
}).catch(err => {
  console.warn('[MCP] ⚠️ 사전 초기화 실패 (요청 시 재시도):', err.message);
});

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname } = parsedUrl;

    // /api/generate, /api/setup-auth, /health 는 Express로 처리
    if (pathname === '/api/generate' || pathname === '/api/setup-auth' || pathname === '/health') {
      api(req, res);
    } else {
      // 나머지는 Next.js로 처리
      handle(req, res, parsedUrl);
    }
  }).listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버 실행 중: http://0.0.0.0:${PORT}`);
    console.log(`📝 관찰기록 생성기: http://0.0.0.0:${PORT}/`);
  });
});

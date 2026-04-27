import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const app = express();
const PORT = process.env.EXPRESS_PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

let mcpClient = null;
let isConnecting = false;

async function initMCP() {
  if (isConnecting) {
    // 연결 중이면 완료될 때까지 대기
    let waited = 0;
    while (isConnecting && waited < 30000) {
      await new Promise(r => setTimeout(r, 500));
      waited += 500;
    }
    if (mcpClient) return;
    throw new Error("MCP 연결 대기 시간 초과");
  }

  if (mcpClient) return;

  isConnecting = true;
  console.log("[MCP] Connecting to NotebookLM MCP...");

  try {
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "notebooklm-mcp@latest"],
    });

    const client = new Client(
      { name: "observation-record-proxy", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    // 연결 타임아웃 60초
    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("MCP 연결 타임아웃 (60초)")), 60000)
      )
    ]);

    mcpClient = client;
    console.log("[MCP] Connected successfully.");
  } catch (err) {
    mcpClient = null;
    console.error("[MCP] Connection failed:", err.message);
    throw err;
  } finally {
    isConnecting = false;
  }
}

async function getMcpClient() {
  if (!mcpClient) {
    await initMCP();
  }
  return mcpClient;
}

// 상태 확인 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mcp_connected: !!mcpClient,
    mcp_connecting: isConnecting
  });
});

app.post('/api/setup-auth', async (req, res) => {
  try {
    const client = await getMcpClient();
    console.log("[MCP] Calling setup_auth...");
    const result = await client.callTool({
      name: "setup_auth",
      arguments: { show_browser: true }
    });
    res.json({ success: true, result });
  } catch (error) {
    console.error("[MCP] Auth Error:", error);
    mcpClient = null; // 연결 실패 시 재연결을 위해 초기화
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/generate', async (req, res) => {
  const { domain, item, level, situationKeyword, activityKeyword } = req.body;

  if (!domain || !item || !level || !situationKeyword) {
    return res.status(400).json({ error: 'Missing required fields: domain, item, level, situationKeyword' });
  }

  let prompt = `${domain} 영역, ${item}문항, ${level}수준 기준을 적용하여, '${situationKeyword}'`;
  if (activityKeyword) {
    prompt += ` 및 '${activityKeyword}'`;
  }
  prompt += ` 상황을 바탕으로 100자 내외의 유아 관찰기록 초안(관찰내용)과 이에 대한 평가 및 지원계획(배움지원)을 자연스러운 문장으로 작성해줘. 응답은 반드시 아래 형식을 지켜서 출력해줘:\n\n[관찰내용]\n(관찰내용 작성)\n[평가 및 지원계획]\n(평가 및 지원계획 작성)\n\n[매우 중요한 주의사항]\n1. ** (볼드체) 같은 마크다운 기호를 제목이나 내용에 절대 사용하지 말고, 오직 [관찰내용]과 [평가 및 지원계획]이라는 텍스트만 정확하게 출력해.\n2. 서론이나 안내 문구도 모두 생략해.\n3. 문장 끝에 원본 텍스트의 출처 표시처럼 보이는 불필요한 숫자(예: '한다1.', '여긴다12')를 절대 쓰지 말고 깔끔한 한국어 문장 기호로만 끝내.`;

  console.log("[API] User Prompt (first 100 chars):", prompt.substring(0, 100));

  const NOTEBOOK_URL = "https://notebooklm.google.com/notebook/3355022d-7393-472c-9bca-95f8a52fe531";

  try {
    const client = await getMcpClient();

    console.log("[MCP] Calling ask_question...");
    const result = await client.callTool({
      name: "ask_question",
      arguments: {
        notebook_url: NOTEBOOK_URL,
        question: prompt,
        browser_options: {
          show: false,
          stealth: { enabled: true },
          timeout_ms: 90000
        }
      }
    }, undefined, { timeout: 130000 });  // MCP SDK 타임아웃을 130초로 설정 (기본값 60초 초과 문제 해결)

    let draftText = "결과를 받아오지 못했습니다.";

    if (result && result.content && result.content.length > 0) {
      const contentBlock = result.content[0];
      if (contentBlock && contentBlock.text) {
        try {
          const parsed = JSON.parse(contentBlock.text);
          if (parsed.success && parsed.data && parsed.data.answer) {
            draftText = parsed.data.answer;
          } else {
            draftText = contentBlock.text;
          }
        } catch (e) {
          draftText = contentBlock.text;
        }
      }
    }

    draftText = draftText.replace(/\d+$/, '').trim();
    const splitIdx = draftText.indexOf("EXTREMELY IMPORTANT:");
    if (splitIdx !== -1) {
      draftText = draftText.substring(0, splitIdx).trim();
    }

    res.json({ success: true, prompt, draft: draftText });

  } catch (error) {
    console.error("[MCP] Execution Error:", error);
    mcpClient = null; // 오류 시 다음 요청에서 재연결
    res.status(500).json({ success: false, error: "MCP 통신 오류: " + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Server] Proxy server running on http://localhost:${PORT}`);
  console.log(`[Server] MCP will connect on first request (lazy initialization)`);
});

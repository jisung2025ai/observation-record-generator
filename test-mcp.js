import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
    console.log("[Test] Initializing NotebookLM MCP Client...");

    const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "notebooklm-mcp@latest"]
    });

    const mcpClient = new Client(
        {
            name: "test-client",
            version: "1.0.0",
        },
        {
            capabilities: { tools: {} },
        }
    );

    try {
        await mcpClient.connect(transport);
        console.log("[Test] Connected successfully!");

        const NOTEBOOK_URL = "https://notebooklm.google.com/notebook/3355022d-7393-472c-9bca-95f8a52fe531";
        const prompt = "신체운동·건강 영역, 1문항, 1수준 기준을 적용하여, '병원놀이' 상황을 바탕으로 짧은 관찰기록을 써줘.";

        console.log("[Test] Calling ask_question...");
        const result = await mcpClient.callTool({
            name: "ask_question",
            arguments: {
                notebook_url: NOTEBOOK_URL,
                question: prompt,
                browser_options: {
                    show: true,
                    stealth: { enabled: false }
                }
            }
        });

        console.log("[Test] Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("[Test] Error:", error);
    } finally {
        process.exit(0);
    }
}

main();

/**
 * MCP Client Helper for Integration Testing
 * Provides a clean interface for communicating with the MCP server
 */

import { spawn, ChildProcess } from "node:child_process";
import { TEST_CONSTANTS } from "./test_constants.ts";

export interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class MCPTestClient {
  private server: ChildProcess | null = null;
  private requestId = 0;
  private responseHandlers = new Map<number, (response: MCPResponse) => void>();
  private serverReady = false;
  private outputBuffer = "";

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = spawn("deno", ["run", "--allow-all", "src/server.ts"], {
        stdio: ["pipe", "pipe", "pipe"]
      });

      const timeout = setTimeout(() => {
        this.cleanup();
        reject(new Error("Server failed to start within timeout"));
      }, TEST_CONSTANTS.timeouts.serverStart);

      this.server.stdout?.on("data", (data) => {
        const output = data.toString();
        this.outputBuffer += output;
        
        // Check for server ready message
        if (output.includes("Ready to receive MCP requests")) {
          this.serverReady = true;
          clearTimeout(timeout);
          
          // Process any JSON responses
          this.processOutputBuffer();
          
          resolve();
        }
        
        // Process JSON responses
        this.processOutputBuffer();
      });

      this.server.stderr?.on("data", (data) => {
        console.error("Server error:", data.toString());
      });

      this.server.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private processOutputBuffer(): void {
    const lines = this.outputBuffer.split("\n");
    this.outputBuffer = lines[lines.length - 1]; // Keep incomplete line
    
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line.startsWith("{") && line.endsWith("}")) {
        try {
          const response = JSON.parse(line) as MCPResponse;
          if (response.id && this.responseHandlers.has(response.id)) {
            const handler = this.responseHandlers.get(response.id)!;
            this.responseHandlers.delete(response.id);
            handler(response);
          }
        } catch {
          // Not JSON, ignore
        }
      }
    }
  }

  async sendRequest(method: string, params: any = {}): Promise<MCPResponse> {
    if (!this.serverReady || !this.server?.stdin) {
      throw new Error("Server not ready");
    }

    const id = ++this.requestId;
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, TEST_CONSTANTS.timeouts.response);

      this.responseHandlers.set(id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.server!.stdin!.write(JSON.stringify(request) + "\n");
    });
  }

  async initialize(): Promise<MCPResponse> {
    return this.sendRequest("initialize", {
      protocolVersion: TEST_CONSTANTS.mcp.protocolVersion,
      capabilities: {},
      clientInfo: {
        name: TEST_CONSTANTS.mcp.clientName,
        version: TEST_CONSTANTS.mcp.clientVersion
      }
    });
  }

  async listTools(): Promise<MCPResponse> {
    return this.sendRequest("tools/list");
  }

  async callTool(name: string, args: any = {}): Promise<MCPResponse> {
    return this.sendRequest("tools/call", {
      name,
      arguments: args
    });
  }

  async cleanup(): Promise<void> {
    if (this.server) {
      this.server.kill();
      this.server = null;
      this.serverReady = false;
      this.responseHandlers.clear();
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, TEST_CONSTANTS.timeouts.cleanup));
    }
  }
}

// Utility function to sanitize responses
export function sanitizeResponse(response: any): any {
  const str = JSON.stringify(response);
  
  // Apply sanitization patterns
  let sanitized = str
    .replace(SANITIZE_PATTERNS.ipAddress, "X.X.X.X")
    .replace(SANITIZE_PATTERNS.nodeName, "node-X")
    .replace(SANITIZE_PATTERNS.podHash, "HASH");
  
  return JSON.parse(sanitized);
}

// Import sanitization patterns
import { SANITIZE_PATTERNS } from "./test_constants.ts";
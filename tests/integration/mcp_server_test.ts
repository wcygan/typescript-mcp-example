import { assertEquals, assertExists } from "@std/assert";
import { MCPTestClient } from "../helpers/mcp_client.ts";
import { TEST_CONSTANTS } from "../helpers/test_constants.ts";

/**
 * MCP Server Integration Tests
 * Tests the full MCP protocol implementation
 */

Deno.test("MCP Server Integration", async (t) => {
  const client = new MCPTestClient();

  // Setup
  await t.step("Server starts successfully", async () => {
    await client.start();
    console.log("✓ MCP server started");
  });

  let initResponse: any;
  
  await t.step("Initialize protocol handshake", async () => {
    initResponse = await client.initialize();
    
    assertEquals(initResponse.jsonrpc, "2.0");
    assertExists(initResponse.result);
    assertEquals(initResponse.result.protocolVersion, TEST_CONSTANTS.mcp.protocolVersion);
    assertExists(initResponse.result.capabilities);
    assertExists(initResponse.result.serverInfo);
    assertEquals(initResponse.result.serverInfo.name, "kubernetes-mcp-server");
    
    console.log("✓ Protocol initialized successfully");
  });

  await t.step("List available tools", async () => {
    const response = await client.listTools();
    
    assertEquals(response.jsonrpc, "2.0");
    assertExists(response.result);
    assertExists(response.result.tools);
    assertEquals(response.result.tools.length, 3);
    
    const toolNames = response.result.tools.map((t: any) => t.name);
    assertEquals(toolNames.includes("list-pods"), true);
    assertEquals(toolNames.includes("get-pod"), true);
    assertEquals(toolNames.includes("list-nodes"), true);
    
    // Verify tool schemas
    for (const tool of response.result.tools) {
      assertExists(tool.inputSchema);
      assertEquals(tool.inputSchema.type, "object");
      assertExists(tool.inputSchema.properties);
    }
    
    console.log("✓ All tools discovered correctly");
  });

  await t.step("Call list-pods tool", async () => {
    const response = await client.callTool("list-pods", {
      namespace: TEST_CONSTANTS.namespaces.default
    });
    
    assertEquals(response.jsonrpc, "2.0");
    assertExists(response.result);
    assertExists(response.result.content);
    assertEquals(response.result.content.length, 1);
    assertEquals(response.result.content[0].type, "text");
    
    const content = JSON.parse(response.result.content[0].text);
    assertExists(content.pods);
    assertEquals(Array.isArray(content.pods), true);
    
    console.log(`✓ list-pods returned ${content.pods.length} pods`);
  });

  await t.step("Call list-nodes tool", async () => {
    const response = await client.callTool("list-nodes");
    
    assertEquals(response.jsonrpc, "2.0");
    assertExists(response.result);
    assertExists(response.result.content);
    
    const content = JSON.parse(response.result.content[0].text);
    assertExists(content.nodes);
    assertEquals(Array.isArray(content.nodes), true);
    assertEquals(content.nodes.length, TEST_CONSTANTS.expectedNodes);
    
    console.log("✓ list-nodes returned expected number of nodes");
  });

  await t.step("Handle invalid tool gracefully", async () => {
    const response = await client.callTool("invalid-tool");
    
    assertEquals(response.jsonrpc, "2.0");
    
    // MCP returns error response for invalid tools
    if (response.error) {
      assertExists(response.error);
      assertExists(response.error.message);
      assertEquals(response.error.message.includes("Unknown tool") || 
                   response.error.message.includes("not found"), true);
      console.log("✓ Invalid tool returned error response");
    } else if (response.result) {
      // Some implementations might return a result with error content
      assertExists(response.result);
      assertExists(response.result.content);
      const text = response.result.content[0].text;
      assertEquals(text.includes("Error") || text.includes("Unknown"), true);
      console.log("✓ Invalid tool handled gracefully");
    }
  });

  // Cleanup
  await client.cleanup();
  console.log("✓ Server cleaned up");
});
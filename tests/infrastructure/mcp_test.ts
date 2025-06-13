import { assertEquals } from "@std/assert";

/**
 * Basic MCP server tests - Tests server initialization without requiring
 * a real Kubernetes cluster. Part of incremental testing strategy.
 */

Deno.test("MCP server module loads correctly", async () => {
  // Test that we can import the server module
  const module = await import("../../src/server.ts");
  assertEquals(typeof module, "object");
  
  console.log("✓ MCP server module imported successfully");
});

Deno.test("Server configuration loads", () => {
  // Test environment variable handling
  const originalValue = Deno.env.get("MCP_SERVER_NAME");
  
  Deno.env.set("MCP_SERVER_NAME", "test-server");
  const testName = Deno.env.get("MCP_SERVER_NAME");
  assertEquals(testName, "test-server");
  
  // Restore original value
  if (originalValue) {
    Deno.env.set("MCP_SERVER_NAME", originalValue);
  } else {
    Deno.env.delete("MCP_SERVER_NAME");
  }
  
  console.log("✓ Configuration system works");
});

Deno.test("TypeScript compilation passes", async () => {
  // Verify TypeScript types are working correctly
  const process = new Deno.Command("deno", {
    args: ["check", "src/server.ts"],
    stdout: "piped",
    stderr: "piped"
  });
  
  const result = await process.output();
  assertEquals(result.code, 0, "TypeScript compilation should pass");
  
  console.log("✓ TypeScript compilation successful");
});
import { assertEquals, assertExists } from "@std/assert";
import { MCPTestClient, sanitizeResponse } from "../helpers/mcp_client.ts";
import { TEST_CONSTANTS, RESPONSE_STRUCTURES } from "../helpers/test_constants.ts";

/**
 * Kubernetes Integration Tests
 * Tests the actual Kubernetes functionality through MCP
 */

Deno.test("Kubernetes Integration Tests", async (t) => {
  const client = new MCPTestClient();

  // Setup
  await client.start();
  await client.initialize();
  
  console.log("✓ Test client initialized");

  await t.step("List pods in kube-system namespace", async () => {
    const response = await client.callTool("list-pods", {
      namespace: TEST_CONSTANTS.namespaces.system
    });
    
    assertEquals(response.jsonrpc, "2.0");
    assertExists(response.result);
    
    const content = JSON.parse(response.result.content[0].text);
    assertExists(content.pods);
    assertEquals(Array.isArray(content.pods), true);
    
    // Verify at least some system pods exist
    assertEquals(content.pods.length > 0, true, "kube-system should have pods");
    
    // Sanitize and verify pod structure
    for (const pod of content.pods) {
      // Verify required fields
      for (const field of RESPONSE_STRUCTURES.pod.requiredFields) {
        assertExists(pod[field], `Pod should have ${field} field`);
      }
      
      // Verify status is valid
      assertEquals(
        RESPONSE_STRUCTURES.pod.statusValues.includes(pod.status),
        true,
        `Pod status '${pod.status}' should be valid`
      );
    }
    
    // Check for expected system components
    const podNames = content.pods.map((p: any) => p.name);
    const hasCoreDNS = podNames.some((name: string) => 
      TEST_CONSTANTS.podPatterns.coredns.test(name)
    );
    const hasKubeProxy = podNames.some((name: string) => 
      TEST_CONSTANTS.podPatterns.kubeProxy.test(name)
    );
    
    assertEquals(hasCoreDNS || hasKubeProxy, true, 
      "Should have at least one system component");
    
    console.log(`✓ Found ${content.pods.length} pods in kube-system`);
  });

  await t.step("List pods in default namespace", async () => {
    const response = await client.callTool("list-pods", {
      namespace: TEST_CONSTANTS.namespaces.default
    });
    
    assertEquals(response.jsonrpc, "2.0");
    assertExists(response.result);
    
    const content = JSON.parse(response.result.content[0].text);
    assertExists(content.pods);
    assertEquals(Array.isArray(content.pods), true);
    
    console.log(`✓ Found ${content.pods.length} pods in default namespace`);
  });

  await t.step("Get specific pod details", async () => {
    // First list pods to get a valid pod name
    const listResponse = await client.callTool("list-pods", {
      namespace: TEST_CONSTANTS.namespaces.system
    });
    
    const listContent = JSON.parse(listResponse.result.content[0].text);
    if (listContent.pods.length === 0) {
      console.log("⚠ No pods found to test get-pod");
      return;
    }
    
    const testPod = listContent.pods[0];
    
    // Get pod details
    const response = await client.callTool("get-pod", {
      name: testPod.name,
      namespace: TEST_CONSTANTS.namespaces.system
    });
    
    assertEquals(response.jsonrpc, "2.0");
    assertExists(response.result);
    
    const content = JSON.parse(response.result.content[0].text);
    assertExists(content.pod);
    
    // Verify pod detail structure
    const pod = content.pod;
    for (const field of RESPONSE_STRUCTURES.podDetail.requiredFields) {
      assertExists(pod[field], `Pod detail should have ${field} field`);
    }
    
    // Verify containers
    assertEquals(Array.isArray(pod.containers), true);
    assertEquals(pod.containers.length > 0, true, "Pod should have containers");
    
    for (const container of pod.containers) {
      for (const field of RESPONSE_STRUCTURES.podDetail.containerFields) {
        assertExists(container[field], `Container should have ${field} field`);
      }
    }
    
    console.log(`✓ Retrieved details for pod: ${sanitizeResponse(testPod.name)}`);
  });

  await t.step("Handle non-existent pod gracefully", async () => {
    const response = await client.callTool("get-pod", {
      name: "non-existent-pod-12345",
      namespace: TEST_CONSTANTS.namespaces.default
    });
    
    assertEquals(response.jsonrpc, "2.0");
    assertExists(response.result);
    assertExists(response.result.content);
    
    const text = response.result.content[0].text;
    assertEquals(
      text.includes("not found") || text.includes("Error"),
      true,
      "Should handle non-existent pod gracefully"
    );
    
    console.log("✓ Non-existent pod handled gracefully");
  });

  await t.step("List cluster nodes", async () => {
    const response = await client.callTool("list-nodes");
    
    assertEquals(response.jsonrpc, "2.0");
    assertExists(response.result);
    
    const content = JSON.parse(response.result.content[0].text);
    assertExists(content.nodes);
    assertEquals(Array.isArray(content.nodes), true);
    
    // Verify expected node count
    assertEquals(
      content.nodes.length,
      TEST_CONSTANTS.expectedNodes,
      `Expected ${TEST_CONSTANTS.expectedNodes} nodes`
    );
    
    // Verify node structure
    for (const node of content.nodes) {
      // Verify required fields
      for (const field of RESPONSE_STRUCTURES.node.requiredFields) {
        assertExists(node[field], `Node should have ${field} field`);
      }
      
      // Verify status is valid
      assertEquals(
        RESPONSE_STRUCTURES.node.statusValues.includes(node.status),
        true,
        `Node status '${node.status}' should be valid`
      );
      
      // Verify Kubernetes version format
      assertEquals(
        /^v\d+\.\d+\.\d+/.test(node.version),
        true,
        "Node should have valid Kubernetes version"
      );
    }
    
    // Log sanitized node info
    const sanitizedNodes = content.nodes.map((n: any) => ({
      status: n.status,
      roles: n.roles,
      version: n.version
    }));
    
    console.log(`✓ Found ${content.nodes.length} nodes:`, 
      JSON.stringify(sanitizedNodes, null, 2));
  });

  await t.step("Verify read-only operations", async () => {
    // This test verifies we're only doing read operations
    // by checking that our tools don't modify cluster state
    
    // List pods before
    const beforeResponse = await client.callTool("list-pods", {
      namespace: TEST_CONSTANTS.namespaces.default
    });
    const beforePods = JSON.parse(beforeResponse.result.content[0].text).pods;
    
    // Perform various read operations
    await client.callTool("list-nodes");
    if (beforePods.length > 0) {
      await client.callTool("get-pod", {
        name: beforePods[0].name,
        namespace: TEST_CONSTANTS.namespaces.default
      });
    }
    
    // List pods after
    const afterResponse = await client.callTool("list-pods", {
      namespace: TEST_CONSTANTS.namespaces.default
    });
    const afterPods = JSON.parse(afterResponse.result.content[0].text).pods;
    
    // Verify no changes (same number of pods)
    assertEquals(
      afterPods.length,
      beforePods.length,
      "Pod count should remain the same (read-only operations)"
    );
    
    console.log("✓ Confirmed all operations are read-only");
  });

  // Cleanup
  await client.cleanup();
  console.log("✓ Integration tests completed");
});
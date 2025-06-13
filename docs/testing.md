# Incremental Testing Strategy

## Overview

This document outlines the comprehensive incremental testing approach for the MCP + Kubernetes integration using Deno. Testing each component independently ensures reliability and makes debugging easier.

## Testing Pyramid

### 1. Infrastructure Testing (Foundation)
```bash
# Test Deno environment
deno --version

# Test TypeScript compilation
deno check src/**/*.ts

# Test Kubernetes connectivity
deno task verify-k8s
```

### 2. Component Testing (Building Blocks)
```bash
# Test MCP server initialization
deno task test-mcp

# Test Kubernetes client
deno task test-k8s

# Test individual MCP tools
deno task test --filter="list-pods"
deno task test --filter="get-pod"
```

### 3. Integration Testing (Full System)
```bash
# Test complete MCP server
deno task test

# Test with actual MCP host
# (Configure Claude Desktop and test)
```

## Test File Structure

```
tests/
├── infrastructure/
│   ├── deno_test.ts         # Deno runtime tests
│   ├── kubernetes_test.ts   # K8s connectivity tests
│   └── config_test.ts       # Configuration tests
├── components/
│   ├── mcp_server_test.ts   # MCP server tests
│   ├── k8s_client_test.ts   # Kubernetes client tests
│   └── tools/
│       ├── list_pods_test.ts
│       ├── get_pod_test.ts
│       └── scale_deployment_test.ts
├── integration/
│   ├── full_server_test.ts  # Complete server integration
│   └── mcp_host_test.ts     # MCP host integration
└── helpers/
    ├── test_utils.ts        # Common test utilities
    └── mock_k8s.ts          # Kubernetes mocks
```

## Incremental Development Workflow

### Phase 1: Infrastructure Setup
```bash
# Step 1: Verify Deno installation
deno --version
# Expected: deno 2.0.0 or higher

# Step 2: Check project structure
deno check src/server.ts
# Expected: No TypeScript errors

# Step 3: Test basic dependencies
deno cache src/server.ts
# Expected: Dependencies downloaded successfully

# Step 4: Test Kubernetes access
kubectl get nodes
# Expected: Cluster nodes listed

# Step 5: Test from Deno
deno task verify-k8s
# Expected: Kubernetes connectivity confirmed
```

### Phase 2: Component Development
```bash
# Step 1: Create basic MCP server
deno task test-mcp
# Expected: MCP server starts and responds

# Step 2: Test Kubernetes client integration
deno task test-k8s
# Expected: Can list pods/nodes from Deno

# Step 3: Test individual tools (READ operations first)
deno task test --filter="list-pods"
deno task test --filter="get-pod"
deno task test --filter="get-pod-logs"
# Expected: Each tool works independently

# Step 4: Test WRITE operations with DRY-RUN
deno task test --filter="scale-deployment" --dry-run
# Expected: Dry-run operations work safely
```

### Phase 3: Integration Testing
```bash
# Step 1: Test complete MCP server
deno task test
# Expected: All tests pass

# Step 2: Test with real cluster resources
kubectl create deployment test-app --image=nginx
deno task test-tool scale-deployment test-app 2
kubectl get deployment test-app
kubectl delete deployment test-app
# Expected: Real operations work correctly

# Step 3: Test MCP host integration
# Configure Claude Desktop
# Test: "List pods in default namespace"
# Expected: AI assistant can manage cluster
```

## Test Implementation Examples

### Infrastructure Test Example
```typescript
// tests/infrastructure/kubernetes_test.ts
import { assertEquals } from "@std/assert";
import * as k8s from "npm:@kubernetes/client-node";

Deno.test("Kubernetes connectivity", async () => {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  
  const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
  
  // Test basic connectivity
  const nodes = await k8sApi.listNode();
  assertEquals(typeof nodes.body, "object");
  assertEquals(Array.isArray(nodes.body.items), true);
  
  console.log(`✓ Connected to cluster with ${nodes.body.items.length} nodes`);
});

Deno.test("Can list pods", async () => {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  
  const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
  
  // Test pod listing
  const pods = await k8sApi.listNamespacedPod("default");
  assertEquals(typeof pods.body, "object");
  assertEquals(Array.isArray(pods.body.items), true);
  
  console.log(`✓ Found ${pods.body.items.length} pods in default namespace`);
});
```

### Component Test Example
```typescript
// tests/components/tools/list_pods_test.ts
import { assertEquals } from "@std/assert";
import { McpServer } from "npm:@modelcontextprotocol/sdk/server/mcp.js";
import { listPodsHandler } from "../../../src/tools/list_pods.ts";

Deno.test("list-pods tool basic functionality", async () => {
  // Test with default namespace
  const result = await listPodsHandler({ namespace: "default" });
  
  assertEquals(typeof result, "object");
  assertEquals(Array.isArray(result.pods), true);
  
  console.log(`✓ list-pods returned ${result.pods.length} pods`);
});

Deno.test("list-pods tool with label selector", async () => {
  // Test with label filtering
  const result = await listPodsHandler({ 
    namespace: "default",
    labelSelector: "app=nginx"
  });
  
  assertEquals(typeof result, "object");
  assertEquals(Array.isArray(result.pods), true);
  
  console.log(`✓ list-pods with selector returned ${result.pods.length} pods`);
});
```

### Integration Test Example
```typescript
// tests/integration/full_server_test.ts
import { assertEquals } from "@std/assert";
import { McpServer } from "npm:@modelcontextprotocol/sdk/server/mcp.js";

Deno.test("MCP server full integration", async () => {
  const server = new McpServer({
    name: "test-kubernetes-mcp-server",
    version: "1.0.0-test"
  });
  
  // Test server initialization
  assertEquals(typeof server, "object");
  
  // Test tool registration
  const tools = await server.listTools();
  assertEquals(Array.isArray(tools), true);
  
  const expectedTools = ["list-pods", "get-pod", "scale-deployment"];
  for (const tool of expectedTools) {
    const found = tools.some(t => t.name === tool);
    assertEquals(found, true, `Tool ${tool} should be registered`);
  }
  
  console.log(`✓ Server initialized with ${tools.length} tools`);
});
```

## Testing Utilities

### Test Helper Functions
```typescript
// tests/helpers/test_utils.ts
import * as k8s from "npm:@kubernetes/client-node";

export async function createTestPod(name: string, namespace = "default"): Promise<void> {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
  
  const pod = {
    metadata: { name, namespace },
    spec: {
      containers: [{
        name: "test",
        image: "nginx:alpine",
        resources: { requests: { cpu: "10m", memory: "10Mi" } }
      }]
    }
  };
  
  await k8sApi.createNamespacedPod(namespace, pod);
  console.log(`✓ Created test pod: ${name}`);
}

export async function deleteTestPod(name: string, namespace = "default"): Promise<void> {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
  
  await k8sApi.deleteNamespacedPod(name, namespace);
  console.log(`✓ Deleted test pod: ${name}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Mock Kubernetes for Testing
```typescript
// tests/helpers/mock_k8s.ts
export const mockPodList = {
  body: {
    items: [
      {
        metadata: { name: "test-pod-1", namespace: "default" },
        status: { phase: "Running" },
        spec: { containers: [{ name: "nginx", image: "nginx:1.21" }] }
      },
      {
        metadata: { name: "test-pod-2", namespace: "default" },
        status: { phase: "Pending" },
        spec: { containers: [{ name: "app", image: "app:latest" }] }
      }
    ]
  }
};

export function createMockK8sApi() {
  return {
    listNamespacedPod: async () => mockPodList,
    listNode: async () => ({ body: { items: [] } }),
    getNamespacedPod: async (name: string) => ({
      body: mockPodList.body.items.find(p => p.metadata.name === name)
    })
  };
}
```

## Continuous Testing During Development

### Watch Mode for Development
```bash
# Run tests in watch mode
deno test --watch --allow-all tests/

# Run specific test category in watch mode
deno test --watch --allow-all tests/components/

# Run single test file in watch mode
deno test --watch --allow-all tests/components/tools/list_pods_test.ts
```

### Pre-commit Testing
```bash
# Full test suite before committing
deno task check     # Type check all files
deno task lint      # Lint all files
deno task test      # Run all tests
deno task verify-k8s # Verify cluster connectivity
```

## Error Handling and Debugging

### Common Test Patterns
```typescript
// Test with proper error handling
Deno.test("handles missing pod gracefully", async () => {
  try {
    await getPod("non-existent-pod", "default");
    throw new Error("Should have thrown an error");
  } catch (error) {
    assertEquals(error.message.includes("not found"), true);
  }
});

// Test with timeout
Deno.test("operation times out appropriately", async () => {
  const start = Date.now();
  
  try {
    await longRunningOperation();
  } catch (error) {
    const duration = Date.now() - start;
    assertEquals(duration < 35000, true, "Should timeout within 35 seconds");
  }
});
```

### Debugging Failed Tests
```bash
# Run test with verbose output
deno test --allow-all --verbose tests/failing_test.ts

# Run test with specific permissions
deno test --allow-net --allow-env --allow-read tests/specific_test.ts

# Run test with debug logging
DEBUG=mcp:* deno test --allow-all tests/debug_test.ts
```

## Performance Testing

### Load Testing Tools
```typescript
// tests/performance/load_test.ts
import { assertEquals } from "@std/assert";

Deno.test("list-pods performance under load", async () => {
  const iterations = 10;
  const results: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await listPodsHandler({ namespace: "default" });
    const duration = Date.now() - start;
    results.push(duration);
  }
  
  const average = results.reduce((a, b) => a + b) / results.length;
  assertEquals(average < 1000, true, "Average response time should be under 1 second");
  
  console.log(`✓ Average response time: ${average}ms`);
});
```

## Best Practices

### 1. Test Independence
- Each test should be able to run independently
- Clean up resources created during tests
- Use unique names for test resources

### 2. Test Data Management
- Use deterministic test data when possible
- Clean up test resources automatically
- Avoid dependencies on external state

### 3. Error Testing
- Test both success and failure cases
- Verify error messages and codes
- Test edge cases and boundary conditions

### 4. Performance Considerations
- Set reasonable timeouts for operations
- Test with realistic data volumes
- Monitor resource usage during tests

This incremental testing strategy ensures each component works correctly before building the next layer, making debugging easier and development more reliable.
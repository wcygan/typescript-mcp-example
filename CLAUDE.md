# MCP + Kubernetes Integration - Project Guidelines

This file contains project-specific development guidelines for the MCP + Kubernetes integration server.

## Project Architecture

### MCP Server Implementation
- **ALWAYS** use the `McpServer` class from `@modelcontextprotocol/sdk/server/mcp.js`
- **ALWAYS** implement tools using `server.tool()` method with Zod schemas
- **FOLLOW** the MCP protocol specification for tool responses:
  ```typescript
  return {
    content: [{
      type: "text",
      text: JSON.stringify(data, null, 2)
    }],
    isError?: boolean  // Only if error occurred
  };
  ```
- **USE** StdioServerTransport for CLI integration
- **HANDLE** Kubernetes API errors gracefully with informative messages

### Kubernetes Client Patterns
- **INITIALIZE** Kubernetes client using `loadFromDefault()` for kubectl compatibility
- **USE** typed API clients: `CoreV1Api` for pods/nodes, `AppsV1Api` for deployments
- **HANDLE** Kubernetes responses with type assertions: `response as any`
- **MAP** Kubernetes objects to simplified structures for AI consumption
- **CALCULATE** human-readable values (e.g., age in minutes, ready counts)

## Testing Strategy

### Incremental Testing Approach
- **ALWAYS** test components independently before integration
- **USE** the three-tier testing pyramid:
  1. Infrastructure tests (`verify-k8s`, type checking)
  2. Component tests (individual tools, MCP server)
  3. Integration tests (full MCP protocol)
- **CREATE** standalone test scripts in `/scripts/` for manual tool testing
- **USE** `deno task test --filter="specific test"` for focused testing

### Test Helpers & Utilities
- **USE** `MCPTestClient` class for MCP protocol testing
- **IMPLEMENT** proper cleanup in tests to avoid hanging processes
- **USE** constants from `TEST_CONSTANTS` for timeouts and defaults
- **MOCK** Kubernetes responses when testing without cluster access

## File Organization

```
/src/
  server.ts         # Main MCP server implementation
/scripts/
  test_tool.ts      # Standalone tool testing script
  verify_kubernetes.ts  # K8s connectivity verification
/tests/
  /helpers/         # Test utilities and clients
  /infrastructure/  # Low-level component tests
  /integration/     # Full system tests
  /components/      # Individual feature tests
/docs/
  api.md           # Tool API reference
  testing.md       # Testing strategy guide
```

## MCP Tool Design

- **KEEP** tool names kebab-case and descriptive
- **USE** Zod schemas for input validation
- **PROVIDE** sensible defaults (e.g., namespace: "default")
- **RETURN** structured JSON responses for AI parsing
- **INCLUDE** human-readable summaries in responses

## Development Commands

```bash
# Development workflow
deno task init        # Initialize project and verify K8s
deno task dev         # Start with hot reload
deno task test        # Run all tests
deno task verify-k8s  # Check Kubernetes connectivity

# Testing individual components
deno task test-k8s    # Test K8s integration only
deno task test-mcp    # Test MCP server only
deno task test-tool   # Test individual tools
deno test --filter="specific test"  # Run focused tests

# Code quality
deno check src/**/*.ts  # Type checking
deno fmt              # Format code
deno lint             # Lint code
```

## Error Handling Patterns

### Kubernetes API Errors
```typescript
try {
  const response = await k8sApi.listNamespacedPod({ namespace });
  // ... process response
} catch (error: any) {
  if (error.response?.statusCode === 404) {
    return {
      content: [{
        type: "text",
        text: `Resource not found in namespace '${namespace}'`
      }],
      isError: true
    };
  }
  return {
    content: [{
      type: "text", 
      text: `Error: ${error.message}`
    }],
    isError: true
  };
}
```

### Data Transformation Pattern
```typescript
const pods = ((response as any).items || []).map((pod: any) => ({
  name: pod.metadata?.name,
  namespace: pod.metadata?.namespace,
  status: pod.status?.phase,
  ready: `${readyContainers}/${totalContainers}`,
  age: calculateAge(pod.metadata?.creationTimestamp)
}));
```

## Security Considerations

### Kubernetes Access
- **RESPECT** RBAC permissions from kubeconfig
- **NEVER** hardcode credentials or sensitive data
- **USE** read-only operations by default
- **REQUIRE** explicit confirmation for write operations
- **LOG** all operations for audit purposes

### MCP Server Security
- **RUN** with user's local permissions only
- **AVOID** exposing internal K8s details unnecessarily
- **SANITIZE** error messages before returning to AI
- **VALIDATE** all inputs with Zod schemas

## AI Assistant Integration

### Configuration Files

Different AI assistants require different configuration formats:

#### Claude Desktop
```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "deno",
      "args": ["run", "--allow-all", "/absolute/path/to/src/server.ts"]
    }
  }
}
```

#### VS Code
```json
{
  "mcp": {
    "servers": {
      "kubernetes": {
        "command": "deno",
        "args": ["run", "--allow-all", "/absolute/path/to/src/server.ts"]
      }
    }
  }
}
```

#### Cursor/Claude Code
```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "deno",
      "args": ["run", "--allow-all", "/absolute/path/to/src/server.ts"]
    }
  }
}
```

## Troubleshooting

### Common Issues

**MCP Server Not Connecting**:
- Ensure Deno is installed: `deno --version`
- Verify absolute paths in configuration files
- Check server logs: `deno task start 2>&1`

**Kubernetes Connection Failed**:
- Test kubectl access: `kubectl get nodes`
- Run verification: `deno task verify-k8s`
- Check kubeconfig: `echo $KUBECONFIG`

**Tools Not Appearing**:
- VS Code: Run "MCP: List Servers" command
- Cursor: Check Settings → MCP for green status
- Claude: Restart after configuration changes

### Debug Mode

```bash
# Direct execution with logging
deno run --allow-all src/server.ts 2> mcp-debug.log

# Test individual tools
deno task test-tool list-pods --verbose
```

## Performance Optimization

### Kubernetes API Calls
- **BATCH** related operations when possible
- **USE** label selectors to reduce response size
- **IMPLEMENT** pagination for large result sets
- **CACHE** cluster configuration during server lifetime

### MCP Protocol
- **MINIMIZE** response payload size
- **IMPLEMENT** request timeouts
- **HANDLE** concurrent requests properly

## Contributing

When adding new features:

1. **ADD** tests first (infrastructure → component → integration)
2. **UPDATE** API documentation in `/docs/api.md`
3. **TEST** with real AI assistants before committing
4. **FOLLOW** existing patterns for error handling and data transformation
5. **ENSURE** security best practices are maintained
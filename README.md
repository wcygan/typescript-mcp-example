# MCP + Kubernetes Integration

AI-powered Kubernetes cluster management through Model Context Protocol (MCP) using Deno.

## Quick Start

```bash
deno task init && deno task test && deno task dev
```

## Overview

This project demonstrates integrating the Model Context Protocol with Kubernetes using Deno, enabling AI assistants to manage cluster resources through standardized MCP tools. Built with native TypeScript support, modern web standards, and incremental testing practices.

## Features

- **🦕 Deno Runtime**: Native TypeScript, secure defaults, modern APIs
- **🤖 MCP Server**: Exposes Kubernetes operations as standardized MCP tools  
- **🧪 Incremental Testing**: Test each component independently as you build
- **📖 Read Operations**: List pods, nodes, get logs, describe resources
- **✍️ Write Operations**: Scale deployments, restart pods, apply manifests (planned)
- **🔌 AI Integration**: Works with Claude Desktop and other MCP-compatible hosts
- **⚡ Zero Config**: No build step required, direct TypeScript execution

## Status

**Current Version**: 1.0.0-dev  
**Implementation Status**: ✅ Foundation Complete

- ✅ MCP server with stdio transport
- ✅ Kubernetes client integration  
- ✅ Read operations (list-pods, get-pod, list-nodes)
- ✅ Incremental testing infrastructure
- ✅ Complete documentation suite
- ⏳ Write operations (scale-deployment, restart-deployment)
- ⏳ Production deployment guides

## Installation

### Prerequisites

- Deno 2.0+
- Kubernetes cluster access (local or remote)
- kubectl configured

### Setup

```bash
# Clone repository
git clone <repository-url>
cd typescript-mcp-example

# Initialize and test incrementally
deno task init        # Set up project dependencies
deno task test-k8s    # Test Kubernetes connectivity
deno task test-mcp    # Test MCP server basics
deno task test        # Run all tests

# Start development server
deno task dev
```

## Incremental Testing Strategy

Test each component as you build:

```bash
# 1. Test Kubernetes connectivity first
deno task test-k8s

# 2. Test MCP server initialization
deno task test-mcp

# 3. Test individual tools one by one
deno task test --filter="list-pods"
deno task test --filter="get-pod"

# 4. Test full integration
deno task test
```

## Configuration

### Kubernetes Access

The server uses your default kubectl configuration:

```bash
# Test cluster access incrementally
kubectl get nodes
deno task verify-k8s    # Verify from Deno
```

### MCP Host Setup

Configure your AI assistant to use this MCP server:

#### Claude Desktop

Add to your Claude Desktop configuration file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "deno",
      "args": ["run", "--allow-all", "/path/to/typescript-mcp-example/src/server.ts"]
    }
  }
}
```

#### VS Code

1. Install GitHub Copilot extension
2. Create `.vscode/mcp.json` in your workspace:

```json
{
  "mcp": {
    "servers": {
      "kubernetes": {
        "command": "deno",
        "args": ["run", "--allow-all", "/path/to/typescript-mcp-example/src/server.ts"]
      }
    }
  }
}
```

3. Enable MCP in VS Code settings:
   - Open Command Palette (`Cmd/Ctrl+Shift+P`)
   - Run "MCP: List Servers" to verify connection

#### Cursor

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "deno",
      "args": ["run", "--allow-all", "/path/to/typescript-mcp-example/src/server.ts"]
    }
  }
}
```

Navigate to Settings → MCP in Cursor to verify the green "active" status.

#### Claude Code

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "deno",
      "args": ["run", "--allow-all", "/path/to/typescript-mcp-example/src/server.ts"]
    }
  }
}
```

Restart Claude Code to apply the configuration.

## Available MCP Tools

### ✅ Read Operations (Available Now)

- `list-pods` - List pods in namespace
- `get-pod` - Get detailed pod information  
- `list-nodes` - List cluster nodes

### ⏳ Planned Write Operations (Coming Soon)

- `scale-deployment` - Scale deployment replicas
- `restart-deployment` - Restart deployment pods
- `delete-pod` - Remove specific pod
- `get-pod-logs` - Retrieve pod logs

## Usage Examples

Test each operation before AI integration:

```bash
# Test read operations manually
deno task test-tool list-pods
deno task test-tool list-nodes

# Test with specific pod (if you have one)
deno task test-tool get-pod <pod-name>

# Show available tool options
deno task test-tool --help
```

### Using with AI Assistants

Once configured, you can interact with your Kubernetes cluster through natural language:

**Example Prompts**:
- "List all pods in the default namespace"
- "What's the status of my cluster nodes?"
- "Show me details for the nginx pod"
- "How many pods are running in the kube-system namespace?"

**VS Code/Cursor Usage**:
- Type `#` in the chat to see available MCP tools
- Use Agent Mode for more complex tasks
- Tools will appear in the tools UI for selection

**Claude Desktop/Code Usage**:
- Tools are automatically available in your conversations
- The AI will use the appropriate tool based on your request

## Development

```bash
# Development with hot reload
deno task dev

# Run specific tests
deno task test --filter="specific test"

# Type checking (built-in)
deno check src/**/*.ts

# Format code
deno fmt

# Lint code  
deno lint
```

## Troubleshooting

### Common Issues

**MCP Server Not Connecting**:
- Ensure Deno is installed: `deno --version`
- Verify absolute paths in configuration files
- Check server logs: `deno task start 2>&1`
- For VS Code: Ensure GitHub Copilot is enabled

**Kubernetes Connection Failed**:
- Test kubectl access: `kubectl get nodes`
- Run verification: `deno task verify-k8s`
- Check kubeconfig: `echo $KUBECONFIG`

**Tools Not Appearing**:
- VS Code: Run "MCP: List Servers" command
- Cursor: Check Settings → MCP for green status
- Claude: Restart after configuration changes

### Debug Mode

Run the server with verbose logging:

```bash
# Direct execution with logging
deno run --allow-all src/server.ts 2> mcp-debug.log

# Or use the test tool
deno task test-tool list-pods --verbose
```

## Security

- Read operations are safe and non-destructive
- Write operations include confirmation prompts
- RBAC permissions respected from kubeconfig
- No sensitive data logged or exposed
- MCP servers run with your local permissions - only use trusted servers

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request
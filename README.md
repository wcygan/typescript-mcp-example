# MCP + Kubernetes Integration

AI-powered Kubernetes cluster management through Model Context Protocol (MCP) using Deno.

## Quick Start

```bash
deno task init && deno task test && deno task dev
```

## Overview

This project demonstrates integrating the Model Context Protocol with Kubernetes using Deno, enabling AI assistants to manage cluster resources through standardized MCP tools. Built with native TypeScript support, modern web standards, and incremental testing practices.

## Features

- **Deno Runtime**: Native TypeScript, secure defaults, modern APIs
- **MCP Server**: Exposes Kubernetes operations as standardized MCP tools  
- **Incremental Testing**: Test each component independently as you build
- **Read Operations**: List pods, nodes, get logs, describe resources
- **Write Operations**: Scale deployments, restart pods, apply manifests
- **AI Integration**: Works with Claude Desktop and other MCP-compatible hosts
- **Zero Config**: No build step required, direct TypeScript execution

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

Configure your MCP host (e.g., Claude Desktop) to connect to this server:

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "deno",
      "args": ["run", "--allow-all", "src/server.ts"],
      "cwd": "/path/to/typescript-mcp-example"
    }
  }
}
```

## Available MCP Tools

### Read Operations (Test Incrementally)

- `list-pods` - List pods in namespace
- `get-pod` - Get detailed pod information  
- `get-pod-logs` - Retrieve pod logs
- `list-nodes` - List cluster nodes
- `describe-resource` - Get resource details

### Write Operations (Test with Dry-Run First)

- `scale-deployment` - Scale deployment replicas
- `restart-deployment` - Restart deployment pods
- `delete-pod` - Remove specific pod

## Usage Examples

Test each operation before AI integration:

```bash
# Test read operations manually
deno task test-tool list-pods
deno task test-tool get-pod nginx-pod

# Test with dry-run mode
deno task test-tool scale-deployment --dry-run

# Then connect to AI assistant:
```

- "List all pods in the default namespace"
- "Show me the logs for the nginx pod"
- "Scale the api deployment to 3 replicas"
- "What's the status of my cluster nodes?"

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

## Security

- Read operations are safe and non-destructive
- Write operations include confirmation prompts
- RBAC permissions respected from kubeconfig
- No sensitive data logged or exposed

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request
# Usage Guide

## Getting Started

This guide walks you through using the MCP + Kubernetes integration from initial setup to AI-powered cluster management.

## Quick Start

```bash
# 1. Initialize the project
deno task init

# 2. Verify everything works
deno task test

# 3. Start the MCP server
deno task dev
```

## Step-by-Step Usage

### 1. Environment Setup

#### Option A: Use Local Cluster

```bash
# Start minikube
minikube start

# Verify cluster is running
kubectl get nodes
deno task verify-k8s
```

#### Option B: Use Existing Cluster

```bash
# Make sure kubectl is configured
kubectl config current-context
kubectl get nodes

# Test connectivity
deno task verify-k8s
```

#### Option C: Test Without Cluster

```bash
# Test the server components without a real cluster
deno task test-mcp
deno task test-tool --help
```

### 2. Testing Individual Tools

Test each MCP tool independently:

```bash
# List all available tools
deno task test-tool --help

# Test listing pods (works with or without cluster)
deno task test-tool list-pods

# Test listing nodes
deno task test-tool list-nodes

# Test getting a specific pod (requires existing pod)
deno task test-tool get-pod <pod-name>

# Get JSON output for further processing
deno task test-tool list-pods --json
```

### 3. MCP Server Integration

#### Start the Server

```bash
# Start with hot reloading for development
deno task dev

# Or start without reloading
deno task start
```

The server will output:
```
Starting kubernetes-mcp-server v1.0.0
✓ Kubernetes client initialized
✓ MCP server started and connected via stdio
Ready to receive MCP requests...
```

#### Connect to Claude Desktop

1. **Configure Claude Desktop** (add to your Claude configuration):

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "deno",
      "args": ["run", "--allow-all", "src/server.ts"],
      "cwd": "/path/to/typescript-mcp-example",
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

2. **Restart Claude Desktop** to load the new configuration

3. **Test the connection** by asking:
   - "List all pods in the default namespace"
   - "What nodes are in my Kubernetes cluster?"

## Usage Examples

### Basic Cluster Inspection

**Human**: "What's the current state of my Kubernetes cluster?"

**AI Response**: The AI will use the `list-nodes` and `list-pods` tools to provide a comprehensive overview.

### Pod Management

**Human**: "Show me all pods in the kube-system namespace"

**AI Response**: Uses `list-pods` with namespace parameter.

**Human**: "Give me details about the coredns pod"

**AI Response**: Uses `list-pods` to find the pod, then `get-pod` for details.

### Troubleshooting

**Human**: "Which pods are not running properly?"

**AI Response**: Uses `list-pods` and filters for non-Running status.

**Human**: "What's the resource usage of my nodes?"

**AI Response**: Uses `list-nodes` to show node status and capacity information.

## Advanced Configuration

### Environment Variables

Set these environment variables to customize behavior:

```bash
# Custom namespace default
export K8S_NAMESPACE=production

# Debug logging
export LOG_LEVEL=debug

# Custom server name
export MCP_SERVER_NAME=prod-k8s-mcp

# Start server with custom config
deno task dev
```

### Custom Kubeconfig

```bash
# Use specific kubeconfig file
export KUBECONFIG=/path/to/custom/kubeconfig.yaml
deno task verify-k8s
```

### Multiple Clusters

```bash
# Switch between clusters
kubectl config use-context cluster-1
deno task verify-k8s

kubectl config use-context cluster-2  
deno task verify-k8s
```

## Development Workflow

### Making Changes

```bash
# 1. Make code changes to src/server.ts

# 2. Test compilation
deno check src/server.ts

# 3. Test functionality
deno task test-tool list-pods

# 4. Test full integration
deno task test

# 5. Start development server
deno task dev
```

### Adding New Tools

1. **Implement the handler function** in `src/server.ts`
2. **Add tool definition** to the tools list
3. **Test the new tool** individually:
   ```bash
   deno task test-tool your-new-tool
   ```
4. **Add to integration tests**
5. **Update documentation**

### Debugging

#### Enable Debug Logging

```bash
# Method 1: Environment variable
DEBUG=mcp:* deno task dev

# Method 2: Log level
LOG_LEVEL=debug deno task dev
```

#### Test Server Communication

```bash
# Test MCP protocol directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | deno task start

# Test specific tool calls
deno run --allow-all scripts/test_mcp_call.ts list-pods
```

#### Common Issues

**Issue**: "Cannot connect to cluster"
```bash
# Solution: Check kubectl configuration
kubectl config current-context
kubectl get nodes

# Test from Deno
deno task verify-k8s
```

**Issue**: "MCP server not responding"
```bash
# Solution: Check server startup
deno task test-mcp
deno check src/server.ts
```

**Issue**: "Permission denied"
```bash
# Solution: Check RBAC permissions
kubectl auth can-i list pods
kubectl auth can-i get pods
```

## Production Usage

### Security Considerations

1. **Use Read-Only Operations First**
   - Start with list and get operations
   - Test thoroughly before adding write operations

2. **RBAC Configuration**
   ```yaml
   # Create minimal permissions
   apiVersion: rbac.authorization.k8s.io/v1
   kind: ClusterRole
   metadata:
     name: mcp-kubernetes-readonly
   rules:
   - apiGroups: [""]
     resources: ["pods", "nodes"]
     verbs: ["get", "list"]
   ```

3. **Environment Isolation**
   ```bash
   # Use namespace-specific access
   export K8S_NAMESPACE=development
   export LOG_LEVEL=warn
   ```

### Monitoring

#### Health Checks

```bash
# Verify server health
deno task test-mcp

# Check Kubernetes connectivity
deno task verify-k8s

# Test all components
deno task test
```

#### Logging

```bash
# Monitor server logs
LOG_LEVEL=info deno task dev

# Structured logging for production
LOG_LEVEL=warn deno task start > kubernetes-mcp.log 2>&1
```

## Troubleshooting Guide

### Common Scenarios

#### No Kubernetes Cluster Available

```bash
# Start local cluster
minikube start
# or
kind create cluster

# Verify setup
deno task verify-k8s
```

#### Tool Testing Without Cluster

```bash
# Test server components
deno task test-mcp

# Test tool interface
deno task test-tool --help

# Test individual components
deno test --allow-all tests/infrastructure/
```

#### Claude Desktop Integration Issues

1. **Check Configuration**: Verify the MCP server configuration in Claude Desktop
2. **Check Permissions**: Ensure Deno has all required permissions (`--allow-all`)
3. **Check Paths**: Use absolute paths in the configuration
4. **Check Logs**: Look for error messages in Claude Desktop logs

#### Performance Issues

```bash
# Check cluster connectivity speed
time kubectl get nodes

# Test tool performance
time deno task test-tool list-pods

# Monitor resource usage
deno run --allow-all --inspect src/server.ts
```

### Getting Help

1. **Check Documentation**: Review `/docs` directory for detailed guides
2. **Run Diagnostics**: Use `deno task verify-k8s` for environment checks
3. **Enable Debug Logging**: Set `LOG_LEVEL=debug` for detailed output
4. **Test Components**: Use individual testing commands to isolate issues

This usage guide provides a comprehensive walkthrough of the MCP + Kubernetes integration, from basic setup to advanced configuration and troubleshooting.
# Installation Guide

## Prerequisites

### System Requirements

- **Deno**: Version 2.0 or higher
- **Kubernetes cluster**: Local (minikube, kind) or remote cluster access
- **kubectl**: Configured to access your cluster

### Verify Prerequisites

```bash
# Check Deno version
deno --version
# Should output deno 2.0.0 or higher

# Check kubectl access
kubectl version --client
kubectl get nodes
# Should show your cluster nodes
```

## Quick Installation

```bash
# Clone the repository
git clone <your-repository-url>
cd typescript-mcp-example

# Initialize project (downloads dependencies)
deno task init

# Test incrementally
deno task test-k8s    # Test Kubernetes connectivity first
deno task test-mcp    # Test MCP server basics

# Start the MCP server
deno task dev
```

## Detailed Setup

### 1. Project Setup

```bash
# Create project directory
mkdir typescript-mcp-example
cd typescript-mcp-example

# Initialize Deno project
deno init

# Create deno.json with dependencies and tasks
# (see deno.json example in project root)
```

### 2. Incremental Development Approach

The key to success is testing each component incrementally:

```bash
# Step 1: Verify Deno and basic setup
deno --version
deno task init

# Step 2: Test Kubernetes connectivity (before any code)
deno task verify-k8s

# Step 3: Create and test basic MCP server
deno task test-mcp

# Step 4: Test individual MCP tools one by one
deno task test --filter="list-pods"
deno task test --filter="get-pod"

# Step 5: Full integration test
deno task test
```

### 3. Deno Configuration

The `deno.json` includes everything needed:

```json
{
  "imports": {
    "@std/fs": "jsr:@std/fs@^1.0.17",
    "@kubernetes/client-node": "npm:@kubernetes/client-node@^0.21.0",
    "@modelcontextprotocol/sdk": "npm:@modelcontextprotocol/sdk@latest"
  },
  "tasks": {
    "init": "deno cache --reload src/server.ts && deno task verify-k8s",
    "dev": "deno run --allow-all --watch src/server.ts",
    "test": "deno test --allow-all tests/",
    "test-k8s": "deno test --allow-all tests/kubernetes_test.ts"
  }
}
```

### 4. Testing Strategy

Build and test incrementally with these verification scripts:

## Kubernetes Setup

### Local Development with Minikube

```bash
# Install minikube (macOS)
brew install minikube

# Start minikube cluster
minikube start

# Verify cluster
kubectl get nodes
kubectl get pods -A
```

### Local Development with Kind

```bash
# Install kind (macOS)
brew install kind

# Create cluster
kind create cluster --name mcp-k8s

# Set context
kubectl cluster-info --context kind-mcp-k8s
```

### Remote Cluster Setup

```bash
# Copy kubeconfig from your cluster
# Option 1: Use cloud provider CLI
aws eks update-kubeconfig --name your-cluster-name
# or
gcloud container clusters get-credentials your-cluster-name

# Option 2: Manual kubeconfig setup
export KUBECONFIG=/path/to/your/kubeconfig.yaml
kubectl get nodes
```

## MCP Host Configuration

### Claude Desktop Setup

1. Test MCP server standalone first:

```bash
# Test MCP server directly with Deno
deno task test-mcp
```

2. Configure Claude Desktop:

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "deno",
      "args": ["run", "--allow-all", "src/server.ts"],
      "cwd": "/path/to/typescript-mcp-example",
      "env": {
        "KUBECONFIG": "/path/to/your/kubeconfig"
      }
    }
  }
}
```

### Alternative: Direct stdio Testing

For incremental testing without Claude Desktop:

```bash
# Test MCP protocol directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | deno run --allow-all src/server.ts

# Test specific tool
deno task test-tool list-pods
```

## Verification

### Test Basic Functionality - Incremental Approach

```bash
# Step 1: Test Kubernetes connectivity
deno task verify-k8s

# Step 2: Test MCP server starts
deno task test-mcp

# Step 3: Test individual tools
deno task test --filter="list-pods"

# Step 4: Start development server
deno task dev

# Step 5: Test in separate terminal
kubectl get pods  # Verify kubectl works
```

### Test MCP Integration - Step by Step

1. **Standalone Testing First:**
   ```bash
   deno task test-tool list-pods
   deno task test-tool get-pod nginx-pod
   ```

2. **Start MCP Server:**
   ```bash
   deno task dev
   ```

3. **Configure Claude Desktop** (using config above)

4. **Test with AI Assistant:**
   - "List all pods in the default namespace"
   - Verify response shows your cluster's pods

## Troubleshooting

### Common Issues

**1. Deno Version Too Old**
```bash
# Error: Unsupported Deno version
# Solution: Update Deno
curl -fsSL https://deno.land/install.sh | sh
# or
brew install deno
```

**2. Kubernetes Connection Failed**
```bash
# Error: Unable to connect to cluster
# Check kubectl configuration
kubectl config current-context
kubectl config get-contexts

# Test connectivity
kubectl get nodes -v=6
```

**3. MCP Server Won't Start**
```bash
# Error: Cannot start MCP server
# Check TypeScript and dependencies
deno check src/server.ts

# Re-cache dependencies
deno task deps

# Test incrementally
deno task test-mcp
```

**4. Permission Denied**
```bash
# Error: Forbidden (403)
# Check RBAC permissions
kubectl auth can-i list pods
kubectl auth can-i get pods
kubectl auth can-i delete pods
```

### Debug Mode

Enable debug logging:

```bash
# Set environment variable
export DEBUG=mcp:*
deno task dev

# Or inline
DEBUG=mcp:* deno task dev

# Test with verbose output
deno task test --verbose
```

### Log Levels

Configure logging in your server:

```typescript
// src/server.ts
const server = new McpServer({
  name: "kubernetes-mcp-server",
  version: "1.0.0"
}, {
  logLevel: "debug" // "error" | "warn" | "info" | "debug"
});
```

## Security Considerations

### Kubernetes RBAC

Create minimal permissions:

```yaml
# rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: mcp-kubernetes-role
rules:
- apiGroups: [""]
  resources: ["pods", "nodes", "services"]
  verbs: ["get", "list"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: mcp-kubernetes-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: mcp-kubernetes-role
subjects:
- kind: User
  name: your-username
  apiGroup: rbac.authorization.k8s.io
```

Apply RBAC:
```bash
kubectl apply -f rbac.yaml
```

### Environment Variables

Secure sensitive configuration:

```bash
# .env file (add to .gitignore)
KUBECONFIG=/path/to/kubeconfig
LOG_LEVEL=info
MCP_SERVER_NAME=kubernetes-mcp-server
```

## Next Steps

1. **Verify installation** by running all tests
2. **Configure your preferred MCP host** (Claude Desktop, etc.)
3. **Test basic operations** like listing pods and nodes
4. **Set up proper RBAC** for your use case
5. **Explore the API documentation** in `docs/api.md`

For development guidance, see the main README.md file.
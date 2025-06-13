# MCP Tools API Reference

## Overview

This document describes all MCP tools exposed by the Kubernetes MCP server built with Deno. Each tool follows the MCP specification for standardized AI integration and includes incremental testing approaches.

## Read Operations

### list-pods

Lists pods in a specified namespace.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "namespace": {
      "type": "string",
      "description": "Kubernetes namespace to list pods from",
      "default": "default"
    },
    "labelSelector": {
      "type": "string",
      "description": "Label selector to filter pods (optional)"
    }
  }
}
```

**Example Usage:**
```typescript
// Test incrementally first
// deno task test --filter="list-pods"

// List all pods in default namespace
{ "namespace": "default" }

// List pods with specific labels
{ "namespace": "production", "labelSelector": "app=nginx" }
```

**Incremental Testing:**
```bash
# Test this tool standalone
deno task test-tool list-pods

# Test with specific parameters
deno task test-tool list-pods --namespace=default
```

**Response:**
```json
{
  "pods": [
    {
      "name": "nginx-deployment-7d8b9c8d-abc12",
      "namespace": "default",
      "status": "Running",
      "ready": "1/1",
      "restarts": 0,
      "age": "2h"
    }
  ]
}
```

### get-pod

Gets detailed information about a specific pod.

**Input Schema:**
```json
{
  "type": "object",
  "required": ["name"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Pod name"
    },
    "namespace": {
      "type": "string",
      "description": "Pod namespace",
      "default": "default"
    }
  }
}
```

**Incremental Testing:**
```bash
# Test with a real pod first
kubectl get pods  # Find a pod name

# Test the tool standalone
deno task test-tool get-pod nginx-deployment-abc123

# Test with Deno test
deno test --filter="get-pod" --allow-all
```

**Response:**
```json
{
  "pod": {
    "name": "nginx-deployment-7d8b9c8d-abc12",
    "namespace": "default",
    "status": "Running",
    "containers": [
      {
        "name": "nginx",
        "image": "nginx:1.21",
        "ready": true,
        "restartCount": 0
      }
    ],
    "conditions": [...],
    "events": [...]
  }
}
```

### get-pod-logs

Retrieves logs from a pod container.

**Input Schema:**
```json
{
  "type": "object",
  "required": ["name"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Pod name"
    },
    "namespace": {
      "type": "string",
      "description": "Pod namespace",
      "default": "default"
    },
    "container": {
      "type": "string",
      "description": "Container name (required for multi-container pods)"
    },
    "lines": {
      "type": "number",
      "description": "Number of lines to retrieve",
      "default": 100
    },
    "follow": {
      "type": "boolean",
      "description": "Follow log stream",
      "default": false
    }
  }
}
```

### list-nodes

Lists all nodes in the cluster.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "labelSelector": {
      "type": "string",
      "description": "Label selector to filter nodes (optional)"
    }
  }
}
```

**Response:**
```json
{
  "nodes": [
    {
      "name": "node-1",
      "status": "Ready",
      "roles": ["control-plane"],
      "age": "7d",
      "version": "v1.28.0",
      "os": "linux",
      "architecture": "amd64"
    }
  ]
}
```

### describe-resource

Gets detailed description of any Kubernetes resource.

**Input Schema:**
```json
{
  "type": "object",
  "required": ["kind", "name"],
  "properties": {
    "kind": {
      "type": "string",
      "description": "Resource kind (Pod, Deployment, Service, etc.)"
    },
    "name": {
      "type": "string",
      "description": "Resource name"
    },
    "namespace": {
      "type": "string",
      "description": "Resource namespace (if applicable)"
    }
  }
}
```

## Write Operations

### scale-deployment

Scales a deployment to specified number of replicas.

**Input Schema:**
```json
{
  "type": "object",
  "required": ["name", "replicas"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Deployment name"
    },
    "replicas": {
      "type": "number",
      "description": "Target number of replicas",
      "minimum": 0
    },
    "namespace": {
      "type": "string",
      "description": "Deployment namespace",
      "default": "default"
    },
    "dryRun": {
      "type": "boolean",
      "description": "Preview changes without applying",
      "default": false
    }
  }
}
```

**Incremental Testing (CRITICAL for Write Operations):**
```bash
# 1. Test with dry-run first (ALWAYS)
deno task test-tool scale-deployment --dry-run nginx-deployment 3

# 2. Test on non-critical deployment
kubectl create deployment test-app --image=nginx
deno task test-tool scale-deployment test-app 2

# 3. Verify result
kubectl get deployment test-app

# 4. Clean up test
kubectl delete deployment test-app
```

**Example:**
```typescript
// ALWAYS test with dry-run first
{ "name": "nginx-deployment", "replicas": 3, "dryRun": true }

// Then apply if safe
{ "name": "nginx-deployment", "replicas": 3, "namespace": "production" }
```

**Response:**
```json
{
  "success": true,
  "message": "Deployment nginx-deployment scaled to 3 replicas",
  "deployment": {
    "name": "nginx-deployment",
    "namespace": "production",
    "replicas": 3,
    "readyReplicas": 2,
    "updatedReplicas": 3
  }
}
```

### restart-deployment

Restarts a deployment by updating its annotation.

**Input Schema:**
```json
{
  "type": "object",
  "required": ["name"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Deployment name"
    },
    "namespace": {
      "type": "string",
      "description": "Deployment namespace",
      "default": "default"
    }
  }
}
```

### delete-pod

Deletes a specific pod.

**Input Schema:**
```json
{
  "type": "object",
  "required": ["name"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Pod name"
    },
    "namespace": {
      "type": "string",
      "description": "Pod namespace",
      "default": "default"
    },
    "force": {
      "type": "boolean",
      "description": "Force delete the pod",
      "default": false
    }
  }
}
```

## Error Handling

All tools return structured error responses:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Pod 'nginx-abc123' not found in namespace 'default'",
    "details": {
      "resource": "Pod",
      "name": "nginx-abc123",
      "namespace": "default"
    }
  }
}
```

### Error Codes

- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `PERMISSION_DENIED` - Insufficient RBAC permissions
- `INVALID_INPUT` - Validation error in tool parameters
- `CLUSTER_ERROR` - Kubernetes API error
- `TIMEOUT` - Operation timed out

## Authentication & Authorization

Tools respect the configured kubeconfig authentication and RBAC permissions. Ensure your Kubernetes user/service account has appropriate permissions:

### Required Permissions

**Read Operations:**
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: mcp-reader
rules:
- apiGroups: [""]
  resources: ["pods", "nodes", "services"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get"]
```

**Write Operations:**
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: mcp-writer  
rules:
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "patch", "update"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["delete"]
```

## Rate Limiting

The server implements basic rate limiting to prevent cluster overload:

- **Read operations**: 100 requests/minute per tool
- **Write operations**: 10 requests/minute per tool
- **Log streaming**: 5 concurrent streams maximum

## Incremental Testing Best Practices

### Read Operations Testing
1. **Test connectivity first**: `deno task verify-k8s`
2. **Test individual tools**: `deno task test --filter="list-pods"`
3. **Use specific namespaces** instead of listing all resources
4. **Apply label selectors** to filter large result sets
5. **Limit log lines** when retrieving pod logs

### Write Operations Testing (CRITICAL)
1. **ALWAYS use dry-run first**: Test with `dryRun: true`
2. **Create test resources**: Use temporary deployments for testing
3. **Verify results incrementally**: Check each change manually
4. **Clean up test resources**: Remove temporary resources after testing
5. **Test on non-production first**: Never test writes on critical systems

### Development Workflow
```bash
# 1. Start with basic connectivity
deno task verify-k8s

# 2. Test read operations
deno task test --filter="list-pods"
deno task test --filter="get-pod"

# 3. Test write operations with dry-run
deno task test-tool scale-deployment --dry-run test-app 2

# 4. Test actual writes on safe resources
kubectl create deployment test-app --image=nginx
deno task test-tool scale-deployment test-app 2
kubectl delete deployment test-app

# 5. Full integration test
deno task test
```
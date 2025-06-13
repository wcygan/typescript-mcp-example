# Configuration Guide

## Deno Configuration

### deno.json Configuration

The `deno.json` file configures the entire project:

```json
{
  "name": "@wcygan/kubernetes-mcp-server",
  "version": "1.0.0",
  "exports": "./src/server.ts",
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

## Environment Variables

### Required Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `KUBECONFIG` | Path to Kubernetes configuration file | `~/.kube/config` | No |
| `MCP_SERVER_NAME` | Name of the MCP server | `kubernetes-mcp-server` | No |
| `MCP_SERVER_VERSION` | Version of the MCP server | `1.0.0` | No |

### Optional Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | `info` | No |
| `K8S_NAMESPACE` | Default Kubernetes namespace | `default` | No |
| `MAX_LOG_LINES` | Maximum log lines to retrieve | `1000` | No |
| `TIMEOUT_MS` | Request timeout in milliseconds | `30000` | No |
| `RATE_LIMIT_REQUESTS` | Rate limit requests per minute | `100` | No |

### Example .env File

```bash
# Kubernetes Configuration
KUBECONFIG=/Users/username/.kube/config
K8S_NAMESPACE=default

# MCP Server Configuration  
MCP_SERVER_NAME=kubernetes-mcp-server
MCP_SERVER_VERSION=1.0.0
LOG_LEVEL=info

# Operational Limits
MAX_LOG_LINES=500
TIMEOUT_MS=30000
RATE_LIMIT_REQUESTS=100
```

### Incremental Configuration Testing

Test configuration changes incrementally:

```bash
# 1. Test basic Deno configuration
deno check src/server.ts

# 2. Test environment variables
deno task verify-k8s

# 3. Test MCP server with new config
deno task test-mcp

# 4. Test full integration
deno task test
```

## Kubernetes Configuration

### Default Configuration

The server uses your default kubectl configuration:

```bash
# Check current configuration
kubectl config current-context
kubectl config view --minify
```

### Multiple Contexts

Switch between different clusters:

```bash
# List available contexts
kubectl config get-contexts

# Switch context
kubectl config use-context my-cluster

# Or specify in environment
export KUBECONFIG=/path/to/specific/config
```

### Service Account Authentication

For production deployments, use service accounts:

```yaml
# service-account.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: mcp-kubernetes-sa
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: mcp-kubernetes-role
rules:
- apiGroups: [""]
  resources: ["pods", "nodes", "services", "namespaces"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "patch", "update"]
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
- kind: ServiceAccount
  name: mcp-kubernetes-sa
  namespace: default
```

## MCP Host Configuration

### Claude Desktop

Add to Claude Desktop's configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "kubernetes": {
      "command": "node",
      "args": ["dist/server.js"],
      "cwd": "/path/to/typescript-mcp-example",
      "env": {
        "KUBECONFIG": "/path/to/kubeconfig",
        "LOG_LEVEL": "info",
        "K8S_NAMESPACE": "default"
      }
    }
  }
}
```

### Custom MCP Host

For custom MCP host integration with Deno:

```typescript
import { Client } from "npm:@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "npm:@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: 'deno',
  args: ['run', '--allow-all', 'src/server.ts'],
  cwd: '/path/to/typescript-mcp-example',
  env: {
    KUBECONFIG: '/path/to/kubeconfig',
    LOG_LEVEL: 'debug'
  }
});

const client = new Client({
  name: "my-kubernetes-client",
  version: "1.0.0"
}, {
  capabilities: {}
});

// Test connection incrementally
await client.connect(transport);
```

**Incremental Testing for Custom Hosts:**
```bash
# 1. Test transport connection
deno run --allow-all scripts/test_transport.ts

# 2. Test client initialization  
deno run --allow-all scripts/test_client.ts

# 3. Test full host integration
deno task test
```

## Server Configuration

### Runtime Configuration

Configure the server programmatically with Deno:

```typescript
// src/config.ts
export interface ServerConfig {
  name: string;
  version: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  kubernetes: {
    configPath?: string;
    namespace: string;
    timeout: number;
  };
  limits: {
    maxLogLines: number;
    rateLimitRequests: number;
  };
}

export const config: ServerConfig = {
  name: Deno.env.get("MCP_SERVER_NAME") || 'kubernetes-mcp-server',
  version: Deno.env.get("MCP_SERVER_VERSION") || '1.0.0',
  logLevel: (Deno.env.get("LOG_LEVEL") as any) || 'info',
  kubernetes: {
    configPath: Deno.env.get("KUBECONFIG"),
    namespace: Deno.env.get("K8S_NAMESPACE") || 'default',
    timeout: parseInt(Deno.env.get("TIMEOUT_MS") || '30000')
  },
  limits: {
    maxLogLines: parseInt(Deno.env.get("MAX_LOG_LINES") || '1000'),
    rateLimitRequests: parseInt(Deno.env.get("RATE_LIMIT_REQUESTS") || '100')
  }
};

// Test configuration incrementally
export function validateConfig(config: ServerConfig): void {
  console.log("Testing configuration...");
  
  if (!config.name) {
    throw new Error('MCP_SERVER_NAME is required');
  }
  
  console.log(`✓ Server name: ${config.name}`);
  console.log(`✓ Log level: ${config.logLevel}`);
  console.log(`✓ Kubernetes namespace: ${config.kubernetes.namespace}`);
}
```

**Test configuration changes:**
```bash
# Test config loading
deno run --allow-env src/config.ts

# Test with specific environment
LOG_LEVEL=debug deno task dev
```

### Logging Configuration

Configure structured logging:

```typescript
// src/logger.ts
import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ 
      filename: 'logs/kubernetes-mcp.log',
      level: 'info'
    })
  ]
});
```

## Security Configuration

### TLS Configuration

For secure communication:

```typescript
// src/server.ts
import { readFileSync } from 'fs';

const tlsOptions = {
  key: readFileSync(process.env.TLS_KEY_PATH || './certs/server.key'),
  cert: readFileSync(process.env.TLS_CERT_PATH || './certs/server.crt'),
  ca: readFileSync(process.env.TLS_CA_PATH || './certs/ca.crt')
};
```

### Authentication

Configure authentication providers:

```typescript
// src/auth.ts
export interface AuthConfig {
  enabled: boolean;
  providers: {
    kubernetes: {
      tokenPath?: string;
      certPath?: string;
      keyPath?: string;
    };
    oauth?: {
      clientId: string;
      clientSecret: string;
      tokenUrl: string;
    };
  };
}

export const authConfig: AuthConfig = {
  enabled: process.env.AUTH_ENABLED === 'true',
  providers: {
    kubernetes: {
      tokenPath: process.env.K8S_TOKEN_PATH,
      certPath: process.env.K8S_CERT_PATH,
      keyPath: process.env.K8S_KEY_PATH
    }
  }
};
```

## Tool Configuration

### Tool Limits

Configure per-tool limits:

```typescript
// src/tools/config.ts
export const toolConfig = {
  'list-pods': {
    maxResults: 100,
    timeout: 10000,
    rateLimitPerMinute: 60
  },
  'get-pod-logs': {
    maxLines: parseInt(process.env.MAX_LOG_LINES || '1000'),
    timeout: 30000,
    rateLimitPerMinute: 20
  },
  'scale-deployment': {
    maxReplicas: 100,
    timeout: 60000,
    rateLimitPerMinute: 10
  }
};
```

### Namespace Restrictions

Restrict access to specific namespaces:

```typescript
// src/config.ts
export const namespaceConfig = {
  allowed: process.env.ALLOWED_NAMESPACES?.split(',') || ['default'],
  denied: process.env.DENIED_NAMESPACES?.split(',') || ['kube-system'],
  requireExplicit: process.env.REQUIRE_EXPLICIT_NAMESPACE === 'true'
};
```

## Monitoring Configuration

### Health Checks

Configure health check endpoints:

```typescript
// src/health.ts
export const healthConfig = {
  enabled: process.env.HEALTH_CHECKS_ENABLED !== 'false',
  port: parseInt(process.env.HEALTH_PORT || '8080'),
  endpoints: {
    '/health': 'basic',
    '/health/kubernetes': 'k8s-connectivity',
    '/health/mcp': 'mcp-protocol'
  }
};
```

### Metrics Collection

Configure metrics collection:

```typescript
// src/metrics.ts
export const metricsConfig = {
  enabled: process.env.METRICS_ENABLED === 'true',
  port: parseInt(process.env.METRICS_PORT || '9090'),
  prefix: process.env.METRICS_PREFIX || 'mcp_kubernetes_',
  collectDefaultMetrics: true,
  collectHttpMetrics: true
};
```

## Configuration Validation

### Startup Validation

Validate configuration on startup:

```typescript
// src/validate.ts
export function validateConfig(config: ServerConfig): void {
  // Validate required fields
  if (!config.name) {
    throw new Error('MCP_SERVER_NAME is required');
  }

  // Validate Kubernetes access
  if (!existsSync(config.kubernetes.configPath || '~/.kube/config')) {
    throw new Error('Kubernetes config not found');
  }

  // Validate numeric limits
  if (config.limits.maxLogLines < 1 || config.limits.maxLogLines > 10000) {
    throw new Error('MAX_LOG_LINES must be between 1 and 10000');
  }
}
```

### Runtime Validation

Validate tool inputs:

```typescript
// src/tools/validation.ts
export function validateToolInput(toolName: string, input: any): void {
  const schema = toolSchemas[toolName];
  if (!schema) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Validate against JSON schema
  const valid = ajv.validate(schema, input);
  if (!valid) {
    throw new Error(`Invalid input: ${ajv.errorsText()}`);
  }
}
```

## Configuration Examples

### Development Environment

```bash
# .env.development
LOG_LEVEL=debug
K8S_NAMESPACE=development
MAX_LOG_LINES=100
TIMEOUT_MS=10000
HEALTH_CHECKS_ENABLED=true
METRICS_ENABLED=true
```

### Production Environment

```bash
# .env.production
LOG_LEVEL=warn
K8S_NAMESPACE=production
MAX_LOG_LINES=1000
TIMEOUT_MS=30000
HEALTH_CHECKS_ENABLED=true
METRICS_ENABLED=true
AUTH_ENABLED=true
TLS_ENABLED=true
```

### Testing Environment

```bash
# .env.test
LOG_LEVEL=error
K8S_NAMESPACE=test
MAX_LOG_LINES=50
TIMEOUT_MS=5000
HEALTH_CHECKS_ENABLED=false
METRICS_ENABLED=false
```
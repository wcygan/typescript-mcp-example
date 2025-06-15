/**
 * Safe test constants for integration testing
 * These use generic values that exist in any Kubernetes cluster
 */

export const TEST_CONSTANTS = {
  // Safe namespaces that exist in any cluster
  namespaces: {
    system: "kube-system",
    default: "default"
  },
  
  // Generic pod name patterns found in any cluster
  podPatterns: {
    coredns: /^coredns-[\w-]+$/,
    kubeProxy: /^kube-proxy-[\w-]+$/,
    kubeApiserver: /^kube-apiserver-[\w-]+$/
  },
  
  // Expected node count for validation
  expectedNodes: 3,
  
  // MCP protocol settings
  mcp: {
    protocolVersion: "2024-11-05",
    clientName: "test-client",
    clientVersion: "1.0.0"
  },
  
  // Timeouts in milliseconds
  timeouts: {
    serverStart: 3000,
    response: 2000,
    cleanup: 1000
  }
};

// Sanitization patterns to remove sensitive data
export const SANITIZE_PATTERNS = {
  // Remove specific IPs
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  // Remove specific node names but keep structure
  nodeName: /k8s-\d+/g,
  // Remove specific pod hashes
  podHash: /[a-f0-9]{6,}/g
};

// Expected response structures for validation
export const RESPONSE_STRUCTURES = {
  pod: {
    requiredFields: ["name", "namespace", "status", "ready", "restarts", "age"],
    statusValues: ["Running", "Pending", "Succeeded", "Failed", "Unknown"]
  },
  
  node: {
    requiredFields: ["name", "status", "roles", "age", "version", "os", "architecture"],
    statusValues: ["Ready", "NotReady"]
  },
  
  podDetail: {
    requiredFields: ["name", "namespace", "status", "containers", "conditions"],
    containerFields: ["name", "image", "ready", "restartCount"]
  }
};
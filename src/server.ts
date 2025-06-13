#!/usr/bin/env -S deno run --allow-all

/**
 * MCP + Kubernetes Integration Server
 * 
 * This server exposes Kubernetes operations as standardized MCP tools,
 * enabling AI assistants to manage cluster resources.
 */

import { McpServer } from "npm:@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk/server/stdio.js";
import * as k8s from "npm:@kubernetes/client-node";

// Configuration
interface ServerConfig {
  name: string;
  version: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  kubernetes: {
    configPath?: string;
    namespace: string;
    timeout: number;
  };
}

const config: ServerConfig = {
  name: Deno.env.get("MCP_SERVER_NAME") || 'kubernetes-mcp-server',
  version: Deno.env.get("MCP_SERVER_VERSION") || '1.0.0',
  logLevel: (Deno.env.get("LOG_LEVEL") as any) || 'info',
  kubernetes: {
    configPath: Deno.env.get("KUBECONFIG"),
    namespace: Deno.env.get("K8S_NAMESPACE") || 'default',
    timeout: parseInt(Deno.env.get("TIMEOUT_MS") || '30000')
  }
};

// Kubernetes client setup
let k8sApi: k8s.CoreV1Api;
let k8sAppsApi: k8s.AppsV1Api;

function initializeKubernetesClient(): boolean {
  try {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    
    k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
    
    console.log("✓ Kubernetes client initialized");
    return true;
  } catch (error: any) {
    console.error("✗ Failed to initialize Kubernetes client:", error.message);
    return false;
  }
}

// MCP Tools Implementation

async function listPodsHandler(input: any) {
  const namespace = input.namespace || config.kubernetes.namespace;
  const labelSelector = input.labelSelector;
  
  try {
    const response = await k8sApi.listNamespacedPod(namespace);
    
    const pods = (response as any).body.items.map((pod: any) => ({
      name: pod.metadata?.name,
      namespace: pod.metadata?.namespace,
      status: pod.status?.phase,
      ready: `${pod.status?.containerStatuses?.filter((c: any) => c.ready).length || 0}/${pod.status?.containerStatuses?.length || 0}`,
      restarts: pod.status?.containerStatuses?.reduce((total: number, c: any) => total + c.restartCount, 0) || 0,
      age: pod.metadata?.creationTimestamp ? 
        Math.floor((Date.now() - new Date(pod.metadata.creationTimestamp).getTime()) / 1000 / 60) + 'm' : 'unknown'
    }));
    
    return { pods };
  } catch (error: any) {
    throw new Error(`Failed to list pods: ${error.message}`);
  }
}

async function getPodHandler(input: any) {
  const { name } = input;
  const namespace = input.namespace || config.kubernetes.namespace;
  
  if (!name) {
    throw new Error("Pod name is required");
  }
  
  try {
    const response = await k8sApi.readNamespacedPod(name, namespace);
    const pod = (response as any).body;
    
    return {
      pod: {
        name: pod.metadata?.name,
        namespace: pod.metadata?.namespace,
        status: pod.status?.phase,
        containers: pod.spec?.containers?.map((c: any) => ({
          name: c.name,
          image: c.image,
          ready: pod.status?.containerStatuses?.find((cs: any) => cs.name === c.name)?.ready || false,
          restartCount: pod.status?.containerStatuses?.find((cs: any) => cs.name === c.name)?.restartCount || 0
        })) || [],
        conditions: pod.status?.conditions || [],
        events: [] // TODO: Fetch events
      }
    };
  } catch (error: any) {
    if (error.response?.statusCode === 404) {
      throw new Error(`Pod '${name}' not found in namespace '${namespace}'`);
    }
    throw new Error(`Failed to get pod: ${error.message}`);
  }
}

async function listNodesHandler() {
  try {
    const response = await k8sApi.listNode();
    
    const nodes = (response as any).body.items.map((node: any) => ({
      name: node.metadata?.name,
      status: node.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
      roles: node.metadata?.labels?.['node-role.kubernetes.io/control-plane'] ? ['control-plane'] : ['worker'],
      age: node.metadata?.creationTimestamp ? 
        Math.floor((Date.now() - new Date(node.metadata.creationTimestamp).getTime()) / 1000 / 60 / 60 / 24) + 'd' : 'unknown',
      version: node.status?.nodeInfo?.kubeletVersion,
      os: node.status?.nodeInfo?.osImage,
      architecture: node.status?.nodeInfo?.architecture
    }));
    
    return { nodes };
  } catch (error: any) {
    throw new Error(`Failed to list nodes: ${error.message}`);
  }
}

// MCP Server setup
async function main() {
  console.log(`Starting ${config.name} v${config.version}`);
  
  // Initialize Kubernetes client
  if (!initializeKubernetesClient()) {
    console.error("Failed to initialize Kubernetes client. Exiting.");
    Deno.exit(1);
  }
  
  // Create MCP server
  const server = new McpServer({
    name: config.name,
    version: config.version
  }, {
    capabilities: {
      tools: {},
    }
  });
  
  // Register tools list handler
  (server as any).setRequestHandler("tools/list", async () => {
    return {
      tools: [
        {
          name: "list-pods",
          description: "List pods in a specified namespace",
          inputSchema: {
            type: "object",
            properties: {
              namespace: {
                type: "string",
                description: "Kubernetes namespace to list pods from",
                default: config.kubernetes.namespace
              },
              labelSelector: {
                type: "string",
                description: "Label selector to filter pods (optional)"
              }
            }
          }
        },
        {
          name: "get-pod",
          description: "Get detailed information about a specific pod",
          inputSchema: {
            type: "object",
            required: ["name"],
            properties: {
              name: {
                type: "string",
                description: "Pod name"
              },
              namespace: {
                type: "string",
                description: "Pod namespace",
                default: config.kubernetes.namespace
              }
            }
          }
        },
        {
          name: "list-nodes",
          description: "List all nodes in the cluster",
          inputSchema: {
            type: "object",
            properties: {
              labelSelector: {
                type: "string",
                description: "Label selector to filter nodes (optional)"
              }
            }
          }
        }
      ]
    };
  });

  // Register tools call handler
  (server as any).setRequestHandler("tools/call", async (request: any) => {
    const { name, arguments: args } = request.params;
    
    try {
      switch (name) {
        case "list-pods":
          const podsResult = await listPodsHandler(args || {});
          return { content: [{ type: "text", text: JSON.stringify(podsResult, null, 2) }] };
        case "get-pod":
          const podResult = await getPodHandler(args || {});
          return { content: [{ type: "text", text: JSON.stringify(podResult, null, 2) }] };
        case "list-nodes":
          const nodesResult = await listNodesHandler();
          return { content: [{ type: "text", text: JSON.stringify(nodesResult, null, 2) }] };
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return { 
        content: [{ 
          type: "text", 
          text: `Error: ${error.message}` 
        }], 
        isError: true 
      };
    }
  });
  
  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log("✓ MCP server started and connected via stdio");
  console.log("Ready to receive MCP requests...");
}

// Handle errors and cleanup
if (import.meta.main) {
  try {
    await main();
  } catch (error: any) {
    console.error("Server error:", error);
    Deno.exit(1);
  }
}
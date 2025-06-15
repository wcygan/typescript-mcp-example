#!/usr/bin/env -S deno run --allow-all

/**
 * MCP + Kubernetes Integration Server v2
 * Updated to use the correct MCP SDK API
 */

import { McpServer } from "npm:@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "npm:zod";
import * as k8s from "npm:@kubernetes/client-node";

// Configuration
const config = {
  name: Deno.env.get("MCP_SERVER_NAME") || 'kubernetes-mcp-server',
  version: Deno.env.get("MCP_SERVER_VERSION") || '1.0.0',
  kubernetes: {
    namespace: Deno.env.get("K8S_NAMESPACE") || 'default',
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

// Create MCP server
const server = new McpServer({
  name: config.name,
  version: config.version
});

// Define tools using the correct API

// List pods tool
server.tool(
  "list-pods",
  {
    namespace: z.string().default(config.kubernetes.namespace).describe("Kubernetes namespace to list pods from"),
    labelSelector: z.string().optional().describe("Label selector to filter pods")
  },
  async ({ namespace, labelSelector }) => {
    try {
      const response = await k8sApi.listNamespacedPod({ namespace });
      
      const pods = ((response as any).items || []).map((pod: any) => ({
        name: pod.metadata?.name,
        namespace: pod.metadata?.namespace,
        status: pod.status?.phase,
        ready: `${pod.status?.containerStatuses?.filter((c: any) => c.ready).length || 0}/${pod.status?.containerStatuses?.length || 0}`,
        restarts: pod.status?.containerStatuses?.reduce((total: number, c: any) => total + c.restartCount, 0) || 0,
        age: pod.metadata?.creationTimestamp ? 
          Math.floor((Date.now() - new Date(pod.metadata.creationTimestamp).getTime()) / 1000 / 60) + 'm' : 'unknown'
      }));
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ pods }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error listing pods: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Get pod tool
server.tool(
  "get-pod",
  {
    name: z.string().describe("Pod name"),
    namespace: z.string().default(config.kubernetes.namespace).describe("Pod namespace")
  },
  async ({ name, namespace }) => {
    try {
      const response = await k8sApi.readNamespacedPod({ name, namespace });
      const pod = response as any;
      
      const result = {
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
          conditions: pod.status?.conditions || []
        }
      };
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        return {
          content: [{
            type: "text",
            text: `Pod '${name}' not found in namespace '${namespace}'`
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: `Error getting pod: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// List nodes tool
server.tool(
  "list-nodes",
  {
    labelSelector: z.string().optional().describe("Label selector to filter nodes")
  },
  async ({ labelSelector }) => {
    try {
      const response = await k8sApi.listNode();
      
      const nodes = ((response as any).items || []).map((node: any) => ({
        name: node.metadata?.name,
        status: node.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
        roles: node.metadata?.labels?.['node-role.kubernetes.io/control-plane'] ? ['control-plane'] : ['worker'],
        age: node.metadata?.creationTimestamp ? 
          Math.floor((Date.now() - new Date(node.metadata.creationTimestamp).getTime()) / 1000 / 60 / 60 / 24) + 'd' : 'unknown',
        version: node.status?.nodeInfo?.kubeletVersion,
        os: node.status?.nodeInfo?.osImage,
        architecture: node.status?.nodeInfo?.architecture
      }));
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ nodes }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error listing nodes: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Main function
async function main() {
  console.log(`Starting ${config.name} v${config.version}`);
  
  // Initialize Kubernetes client
  if (!initializeKubernetesClient()) {
    console.error("Failed to initialize Kubernetes client. Exiting.");
    Deno.exit(1);
  }
  
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
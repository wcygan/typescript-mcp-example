#!/usr/bin/env -S deno run --allow-all

/**
 * Individual MCP Tool Testing Script
 * 
 * Tests individual MCP tools without full MCP protocol overhead.
 * Supports the incremental testing strategy by allowing focused testing.
 */

import * as k8s from "npm:@kubernetes/client-node";

// Tool implementations (copied from server.ts for standalone testing)
let k8sApi: k8s.CoreV1Api;
let k8sAppsApi: k8s.AppsV1Api;

function initializeKubernetesClient(): boolean {
  try {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    
    k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
    
    return true;
  } catch (error) {
    console.error("Failed to initialize Kubernetes client:", error.message);
    return false;
  }
}

async function testListPods(namespace = "default", labelSelector?: string) {
  console.log(`🧪 Testing list-pods tool...`);
  console.log(`   Namespace: ${namespace}`);
  if (labelSelector) console.log(`   Label selector: ${labelSelector}`);
  
  try {
    const response = await k8sApi.listNamespacedPod(
      namespace,
      undefined, // pretty
      undefined, // allowWatchBookmarks
      undefined, // continue
      undefined, // fieldSelector
      labelSelector // labelSelector
    );
    
    const pods = response.body.items.map(pod => ({
      name: pod.metadata?.name,
      namespace: pod.metadata?.namespace,
      status: pod.status?.phase,
      ready: `${pod.status?.containerStatuses?.filter(c => c.ready).length || 0}/${pod.status?.containerStatuses?.length || 0}`,
      restarts: pod.status?.containerStatuses?.reduce((total, c) => total + c.restartCount, 0) || 0,
      age: pod.metadata?.creationTimestamp ? 
        Math.floor((Date.now() - new Date(pod.metadata.creationTimestamp).getTime()) / 1000 / 60) + 'm' : 'unknown'
    }));
    
    console.log(`✓ Found ${pods.length} pod(s):`);
    pods.forEach(pod => {
      console.log(`   - ${pod.name} (${pod.status}, ${pod.ready} ready, ${pod.restarts} restarts)`);
    });
    
    return { success: true, result: { pods } };
  } catch (error) {
    console.log(`✗ Failed to list pods: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testGetPod(name: string, namespace = "default") {
  console.log(`🧪 Testing get-pod tool...`);
  console.log(`   Pod: ${namespace}/${name}`);
  
  if (!name) {
    console.log("✗ Pod name is required");
    return { success: false, error: "Pod name is required" };
  }
  
  try {
    const response = await k8sApi.readNamespacedPod(name, namespace);
    const pod = response.body;
    
    const result = {
      pod: {
        name: pod.metadata?.name,
        namespace: pod.metadata?.namespace,
        status: pod.status?.phase,
        containers: pod.spec?.containers?.map(c => ({
          name: c.name,
          image: c.image,
          ready: pod.status?.containerStatuses?.find(cs => cs.name === c.name)?.ready || false,
          restartCount: pod.status?.containerStatuses?.find(cs => cs.name === c.name)?.restartCount || 0
        })) || [],
        conditions: pod.status?.conditions || []
      }
    };
    
    console.log(`✓ Pod details:`);
    console.log(`   Name: ${result.pod.name}`);
    console.log(`   Status: ${result.pod.status}`);
    console.log(`   Containers: ${result.pod.containers.length}`);
    result.pod.containers.forEach(c => {
      console.log(`     - ${c.name}: ${c.image} (ready: ${c.ready}, restarts: ${c.restartCount})`);
    });
    
    return { success: true, result };
  } catch (error) {
    if (error.response?.statusCode === 404) {
      console.log(`✗ Pod '${name}' not found in namespace '${namespace}'`);
      return { success: false, error: `Pod '${name}' not found in namespace '${namespace}'` };
    }
    console.log(`✗ Failed to get pod: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testListNodes(labelSelector?: string) {
  console.log(`🧪 Testing list-nodes tool...`);
  if (labelSelector) console.log(`   Label selector: ${labelSelector}`);
  
  try {
    const response = await k8sApi.listNode();
    
    const nodes = response.body.items.map(node => ({
      name: node.metadata?.name,
      status: node.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady',
      roles: node.metadata?.labels?.['node-role.kubernetes.io/control-plane'] ? ['control-plane'] : ['worker'],
      age: node.metadata?.creationTimestamp ? 
        Math.floor((Date.now() - new Date(node.metadata.creationTimestamp).getTime()) / 1000 / 60 / 60 / 24) + 'd' : 'unknown',
      version: node.status?.nodeInfo?.kubeletVersion,
      os: node.status?.nodeInfo?.osImage
    }));
    
    console.log(`✓ Found ${nodes.length} node(s):`);
    nodes.forEach(node => {
      console.log(`   - ${node.name} (${node.status}, ${node.roles.join(',')}, ${node.version})`);
    });
    
    return { success: true, result: { nodes } };
  } catch (error) {
    console.log(`✗ Failed to list nodes: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function printUsage() {
  console.log(`
MCP Tool Tester

Usage:
  deno task test-tool <tool-name> [arguments]

Available tools:
  list-pods [namespace] [labelSelector]    - List pods in namespace
  get-pod <name> [namespace]               - Get specific pod details  
  list-nodes [labelSelector]              - List cluster nodes

Examples:
  deno task test-tool list-pods
  deno task test-tool list-pods default app=nginx
  deno task test-tool get-pod nginx-abc123
  deno task test-tool get-pod nginx-abc123 kube-system
  deno task test-tool list-nodes

Options:
  --help                                   - Show this help
  --json                                   - Output results as JSON
`);
}

async function main() {
  const args = Deno.args;
  
  if (args.length === 0 || args.includes('--help')) {
    printUsage();
    return;
  }
  
  const jsonOutput = args.includes('--json');
  const tool = args[0];
  const toolArgs = args.slice(1).filter(arg => !arg.startsWith('--'));
  
  console.log(`🚀 Initializing Kubernetes client...`);
  if (!initializeKubernetesClient()) {
    console.log("❌ Failed to initialize Kubernetes client");
    Deno.exit(1);
  }
  console.log(`✓ Kubernetes client ready\n`);
  
  let result;
  
  switch (tool) {
    case 'list-pods':
      result = await testListPods(toolArgs[0], toolArgs[1]);
      break;
      
    case 'get-pod':
      if (!toolArgs[0]) {
        console.log("❌ Pod name is required for get-pod");
        printUsage();
        Deno.exit(1);
      }
      result = await testGetPod(toolArgs[0], toolArgs[1]);
      break;
      
    case 'list-nodes':
      result = await testListNodes(toolArgs[0]);
      break;
      
    default:
      console.log(`❌ Unknown tool: ${tool}`);
      printUsage();
      Deno.exit(1);
  }
  
  console.log();
  
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  }
  
  if (result.success) {
    console.log(`🎉 Tool '${tool}' test completed successfully!`);
  } else {
    console.log(`❌ Tool '${tool}' test failed: ${result.error}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
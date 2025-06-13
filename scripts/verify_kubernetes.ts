#!/usr/bin/env -S deno run --allow-all

/**
 * Kubernetes Connectivity Verification Script
 * 
 * Tests Kubernetes cluster connectivity before starting MCP server.
 * This is the first step in our incremental testing strategy.
 */

import * as k8s from "npm:@kubernetes/client-node";

interface VerificationResult {
  success: boolean;
  message: string;
  details?: any;
}

async function verifyKubeConfig(): Promise<VerificationResult> {
  try {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    
    const currentContext = kc.getCurrentContext();
    if (!currentContext) {
      return {
        success: false,
        message: "No current Kubernetes context found. Run 'kubectl config current-context' to check."
      };
    }
    
    return {
      success: true,
      message: `✓ Kubernetes config loaded successfully`,
      details: {
        currentContext,
        server: kc.getCurrentCluster()?.server,
        user: kc.getCurrentUser()?.name
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `✗ Failed to load Kubernetes config: ${error.message}`
    };
  }
}

async function verifyClusterConnection(): Promise<VerificationResult> {
  try {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    
    // Test basic connectivity by listing nodes
    const response = await k8sApi.listNode();
    const nodeCount = (response as any).body?.items?.length || 0;
    
    return {
      success: true,
      message: `✓ Connected to cluster with ${nodeCount} node(s)`,
      details: {
        nodeCount,
        nodes: ((response as any).body?.items || []).map((node: any) => ({
          name: node.metadata?.name,
          status: node.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady'
        }))
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `✗ Failed to connect to cluster: ${error.message || 'No cluster available'}. This is normal if no cluster is running.`
    };
  }
}

async function verifyNamespaceAccess(namespace = "default"): Promise<VerificationResult> {
  try {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    
    // Test namespace access by listing pods
    const response = await k8sApi.listNamespacedPod(namespace);
    const podCount = response.body.items.length;
    
    return {
      success: true,
      message: `✓ Can access namespace '${namespace}' with ${podCount} pod(s)`,
      details: {
        namespace,
        podCount,
        pods: response.body.items.slice(0, 3).map(pod => ({
          name: pod.metadata?.name,
          status: pod.status?.phase
        }))
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `✗ Cannot access namespace '${namespace}': ${error.message}`
    };
  }
}

async function verifyPermissions(): Promise<VerificationResult> {
  try {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
    
    const permissions = [];
    
    // Test read permissions
    try {
      await k8sApi.listNode();
      permissions.push("✓ Can list nodes");
    } catch {
      permissions.push("✗ Cannot list nodes");
    }
    
    try {
      await k8sApi.listNamespacedPod("default");
      permissions.push("✓ Can list pods");
    } catch {
      permissions.push("✗ Cannot list pods");
    }
    
    try {
      await k8sAppsApi.listNamespacedDeployment("default");
      permissions.push("✓ Can list deployments");
    } catch {
      permissions.push("✗ Cannot list deployments");
    }
    
    const successCount = permissions.filter(p => p.startsWith("✓")).length;
    
    return {
      success: successCount > 0,
      message: `Permissions check: ${successCount}/3 operations allowed`,
      details: { permissions }
    };
  } catch (error) {
    return {
      success: false,
      message: `✗ Failed to check permissions: ${error.message}`
    };
  }
}

async function main() {
  console.log("🔍 Verifying Kubernetes connectivity...\n");
  
  const checks = [
    { name: "Kubernetes Config", fn: () => verifyKubeConfig() },
    { name: "Cluster Connection", fn: () => verifyClusterConnection() },
    { name: "Namespace Access", fn: () => verifyNamespaceAccess(Deno.env.get("K8S_NAMESPACE") || "default") },
    { name: "Permissions", fn: () => verifyPermissions() }
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    console.log(`Checking ${check.name}...`);
    const result = await check.fn();
    
    console.log(`  ${result.message}`);
    
    if (result.details && Deno.env.get("DEBUG")) {
      console.log(`  Details:`, JSON.stringify(result.details, null, 2));
    }
    
    if (!result.success) {
      allPassed = false;
    }
    
    console.log();
  }
  
  if (allPassed) {
    console.log("🎉 All Kubernetes verification checks passed!");
    console.log("You can now run: deno task test-mcp");
  } else {
    console.log("⚠️  Some verification checks failed, but this may be expected.");
    console.log("If no Kubernetes cluster is running, you can:");
    console.log("1. Start a local cluster: minikube start");
    console.log("2. Or use kind: kind create cluster");
    console.log("3. Or test without cluster: deno task test-tool --help");
    console.log("\nTo test with a real cluster:");
    console.log("1. Check kubectl is installed: kubectl version --client");
    console.log("2. Check cluster access: kubectl get nodes");
    console.log("3. Check current context: kubectl config current-context");
    console.log("4. Check permissions: kubectl auth can-i list pods");
  }
}

if (import.meta.main) {
  await main();
}
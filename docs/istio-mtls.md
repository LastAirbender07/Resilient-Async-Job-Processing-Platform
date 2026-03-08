# Istio mTLS & Ingress Setup Guide

This document serves as a comprehensive, step-by-step guide for integrating Istio into any Kubernetes project. It explains the "what" and "why" behind each component and configuration, using the `resilient-platform` as a reference architecture.

---

## 1. The Core Concepts

### What is Istio?
Istio is a **Service Mesh**. It transparently manages how microservices communicate with each other. Instead of having your application code handle retries, timeouts, circuit breaking, and encryption, Istio handles all of it at the network layer.

### How does it work? (The Envoy Sidecar)
Istio works by injecting an **Envoy Proxy Container** (a "sidecar") into every single Pod in your application namespace. 
- When your `backend` tries to talk to `postgres`, the traffic actually flows: `Backend Container -> Backend Envoy Sidecar -> Postgres Envoy Sidecar -> Postgres Container`.
- Because Envoy intercepts all traffic, it can automatically encrypt it, log it, or block it without your apps knowing.

### What is mTLS?
**Mutual TLS (mTLS)** means that both the client (e.g., frontend) and the server (e.g., backend) authenticate each other using cryptographic certificates. In a default Kubernetes cluster, traffic between pods is unencrypted plain text. Istio automatically upgrades all pod-to-pod traffic to encrypted mTLS.

---

## 2. Step-by-Step Implementation Guide

To integrate Istio into a new or existing project, follow these steps:

### Step 1: Enable Sidecar Injection on the Namespace

**The Command:**
```bash
kubectl label namespace <your-namespace> istio-injection=enabled --overwrite
```

**Why it's necessary:**
By default, Istio ignores your pods. Adding this label tells the Istio control plane (Istiod) to automatically watch for any new pods created in this namespace and inject the Envoy proxy container into them alongside your main application logic.

**Note:** If you apply this to a namespace that already has running pods, you must restart those pods (`kubectl rollout restart deployment`) for the sidecars to be injected. The sidecar is only attached during the pod creation phase.

---

### Step 2: Enforce STRICT mTLS (PeerAuthentication)

**The Configuration (`peerauthentication.yaml`):**
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: <your-namespace>
spec:
  mtls:
    mode: STRICT
```

**Why it's necessary:**
When Istio is first installed, it operates in `PERMISSIVE` mode. This means it accepts *both* plain text and encrypted traffic. While good for migration, it is not secure. Applying a `STRICT` PeerAuthentication policy at the namespace level tells Envoy: **"Reject any incoming connections that are not encrypted with Istio's mTLS certificates."**

This is the core security mechanism that prevents a compromised pod in another namespace from snooping on or talking to your database.

---

### Step 3: Handling External Traffic (The Gateway Problem)

If you enforce `STRICT` mTLS, internal pod-to-pod traffic is perfectly fine. However, **external users (the browser) do not possess Istio mTLS certificates**. 

If you try to hit a `NodePort` service directly from a browser while `STRICT` is on, the Envoy sidecar will reject the connection because the browser is sending plain text HTTP, not mTLS.

There are two ways to solve this:

#### Option A: The Proper Way (Istio Gateway & VirtualService)
You deploy an `IngressGateway` (which usually sits at the edge of your cluster and has a LoadBalancer IP). 

1. **The Gateway:** Tells the edge proxy "Listen on Port 80 for HTTP traffic."
2. **The VirtualService:** Tells the edge proxy "When traffic comes in on Port 80, route it to the `frontend` service internally using mTLS."

```yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: app-gateway
spec:
  selector:
    istio: ingressgateway # Points to the Istio edge proxy
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "*"
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: app-vs
spec:
  hosts:
  - "*"
  gateways:
  - app-gateway
  http:
  - match:
    - uri:
        prefix: /
    route:
    - destination:
        host: frontend-service # The internal k8s service name
        port:
          number: 3000
```

#### Option B: Port-Level PERMISSIVE (The "Metrics Scraper" Pattern)
If you need specific services (like Prometheus) to hit internal ports over plain HTTP while the rest of the traffic remains STRICT mTLS, you can configure port-level exceptions.

**The Configuration:**
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: metrics-exception
  namespace: <your-namespace>
spec:
  # Omit selector to apply to ALL pods in the namespace
  portLevelMtls:
    5001:  # Backend metrics
      mode: PERMISSIVE
    8000:  # Worker metrics
      mode: PERMISSIVE
    15090: # Istio sidecar stats
      mode: PERMISSIVE
```

**Why it's necessary:**
Prometheus usually scrapes over plain HTTP. In a STRICT mTLS namespace, Envoy will reset the connection. By setting these specific ports to `PERMISSIVE`, you allow the Prometheus scraper to succeed while ensuring all "business" traffic (API calls, DB queries) between pods is still fully encrypted.

---

## 3. How to Verify It Worked

Once Istio is deployed, you should run these checks:

1. **Check Sidecars:**
   ```bash
   kubectl get pods -n <your-namespace>
   ```
   *Expectation:* The `READY` column should say `2/2` instead of `1/1`. The second container is the Envoy proxy.

2. **Verify mTLS is active:**
   If you have the `istioctl` CLI installed, you can analyze the cluster's TLS status:
   ```bash
   istioctl authn tls-check
   ```
   *Expectation:* It will list your services and confirm the `STATUS` is `STRICT`.

3. **Test the Network:**
   Exec into a container that does *not* have Istio injected (e.g., a busybox pod in the `default` namespace) and try to `curl` your backend service.
   *Expectation:* The connection should be reset or return an error (`curl: (56) Recv failure: Connection reset by peer`). Envoy rejected the plain text request!

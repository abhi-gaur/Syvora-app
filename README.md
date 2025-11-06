![AWS](https://img.shields.io/badge/Cloud-AWS-orange)
![Terraform](https://img.shields.io/badge/IaC-Terraform-blueviolet)
![Helm](https://img.shields.io/badge/Kubernetes-Helm-brightgreen)
![Monitoring](https://img.shields.io/badge/Monitoring-Prometheus%20%26%20Grafana-red)




# Syvora — Cloud-Native DevOps Demo (EKS + Helm + Monitoring)



---

## ⚙️ Overview

**Syvora-App** is a full-stack DevOps demonstration project that showcases:
- How to build a backend service in **Node.js + PostgreSQL**
- How to containerize it using **Docker**
- How to automate builds via **GitHub Actions + OIDC → ECR**
- How to deploy it to **Amazon EKS** via **Helm**
- How to monitor it using **Prometheus & Grafana**
- And how to trigger alerts for latency or downtime.

Everything is reproducible and documented to the smallest detail.

---

## 🏗️ Architecture

```text
                   +-----------------------+
                   |  GitHub Actions (CI)  |
                   |  Build & Push to ECR  |
                   +----------+------------+
                              |
                              v
 +----------------------- AWS Infrastructure -----------------------+
 |   Terraform creates:                                            |
 |   • VPC, Subnets, IGW                                           |
 |   • EKS Cluster + NodeGroup                                     |
 |                                                                 |
 |   +--------------------+         +--------------------+          |
 |   | syvora-syvora-app  |  --->   | Postgres DB (Pod)  |          |
 |   | Node.js API + /metrics      |   |                 |          |
 |   +---------+----------+         +--------------------+          |
 |             |                                                     
 |     Service (LoadBalancer / NodePort)                             
 |             |                                                     
 |        External User (curl/browser)                             
 +------------------------------------------------------------------+
                              |
                 +------------v-------------+
                 | Prometheus + Grafana     |
                 | via kube-prometheus-stack|
                 +--------------------------+

```


## Local Development

## Run locally with Docker Compose

```bash
    "docker compose up --build"
```

 Visit:

```node
App: http://localhost:3000
Health check: http://localhost:3000/healthz
Metrics: http://localhost:3000/metrics
```
# Database credentials are configured via  "db/init.sql"

# Infrastructure via Terraform

```terraform
cd terraform/eks
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```



# This provisions:

- VPC, Subnets, Route Tables, NAT
- EKS Cluster (syvora-eks)
- Node Group (2 × t3.medium)

## Connect to cluster:

```
aws eks update-kubeconfig --region us-east-2 --name syvora-eks
kubectl get nodes -o wide
```

# Kubernetes Deployment (Helm)

## Deploy the backend:

```
cd helm/syvora-app
helm upgrade --install syvora . -f values.yaml
kubectl get pods, svc -n default
```

## The service exposes:

```
LoadBalancer: http://<elb-url>/healthz

NodePort: http://<node-external-ip>:32399/healthz
```


# Monitoring & Alerting 

## Prometheus & Grafana installation

# Using the kube-prometheus-stack Helm chart:

```
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack
```


## For Prometheus

```
URL: http://<node-ip>:30815   (In our Case = http://3.138.35.245:31282/ )
```

***View /targets → syvora-app → ✅ UP***

## For Grafana

```
URL: http://<node-ip>:30429  (In our Case = http://3.138.35.245:32603/dashboards)

Default user: admin
Default password: syvora123
```


## Import Syvora App Metrics dashboard (included in repo):

- Request Rate
- p90 Latency
- Error Rate
- Up Status

# Alerts configured

```
Alert	Condition	Severity
SyvoraAppDown	up{job="syvora-app"} == 0 for 1m	Critical
HighResponseTime	p90 latency > 1s for 2m	Warning
```

***To send alerts to Slack or Email, mount a Secret with an Alertmanager config (Can Include in Future Improvements )***


# Continuous Integration & Deployment

## GitHub Actions — CI Build

```
Workflow: .github/workflows/main.yml

Flow:
On every push to master:

Builds Docker image

Authenticates to AWS (OIDC)

Pushes to ECR

GitHub Actions — CD Deploy

Workflow: .github/workflows/deploy.yml

Flow:

Assumes IAM Role (GitHubActionsEKSDeploy) via OIDC

Gets EKS credentials

Executes helm upgrade --install with new image tag

This creates a zero-touch CI/CD pipeline from code → image → deployment.
```



# Working Links

```
Backend	http://aea430f8b04ec4b50ab5384de1f4950e-1575553998.us-east-2.elb.amazonaws.com/healthz

Returns ok
```




# Future Improvements

| Area | Upgrade |
|------|----------|
| **Security** | Replace NodePort with AWS ALB Ingress + TLS (cert-manager). |
| **Secrets** | Use AWS Secrets Manager or ExternalSecrets operator. |
| **Alerting** | Configure Slack/email receivers in Alertmanager. |
| **Terraform Backend** | Move to S3 + DynamoDB for remote state & locking. |
| **Scaling** | Add HPA (Horizontal Pod Autoscaler) and resource limits. |
| **CD Pipeline** | Add canary or blue/green deployment strategy. |
| **Cost Optimization** | Use Spot Instances for worker nodes. |
| **Logging** | Integrate Loki or CloudWatch FluentBit sidecars. |





# 🔍 Design Decisions & Best Practices

| Topic | Explanation |
|--------|--------------|
| **OIDC Integration with GitHub Actions** | Instead of using static AWS access keys, we implemented **OpenID Connect (OIDC)** for secure, short-lived authentication between **GitHub Actions** and **AWS**. This eliminates hard-coded credentials and follows AWS’s modern CI/CD best practices. <br><br>In our case, the workflow assumes the IAM Role **`GitHubActionsECRPush`** via OIDC. When a workflow runs, GitHub issues a temporary identity token that AWS validates and exchanges for temporary credentials. This is far safer and fully automated. |
| **Why Amazon ECR (not Docker Hub)** | Using **Amazon Elastic Container Registry (ECR)** provides:<br>• Seamless integration with EKS (IAM-based pull access).<br>• Private, encrypted image storage inside the same AWS account.<br>• No public throttling or rate limits like Docker Hub.<br>• Simplified IAM-based access management for builds and deployments.<br><br>Thus, it’s more secure and reliable for production workloads. |
| **Cost Optimization Considerations** | Currently, this demo runs on **2 × t3.medium** nodes. For small workloads, the app and DB could easily run on a **single node**, or use **AWS Fargate profiles** for serverless pods. <br>Also, non-critical environments could leverage **Spot Instances** or **Karpenter** for dynamic scaling. |
| **Namespace Segregation** | The app is currently deployed in the `default` namespace for simplicity. In production, we recommend creating a dedicated namespace, e.g., `syvora`, to isolate workloads, apply resource quotas, and manage RBAC permissions more cleanly: <br><br>`kubectl create namespace syvora` <br>`helm install syvora ./helm/syvora-app -n syvora -f values.yaml` |
| **Full CI/CD Enhancement** | The current pipeline builds and pushes to ECR. The next logical enhancement is a **CD pipeline** that automatically deploys to EKS after a successful image push. <br><br>This can be achieved by adding a second GitHub Actions workflow (e.g., `.github/workflows/deploy.yml`) that:<br>1. Authenticates via OIDC<br>2. Fetches cluster kubeconfig<br>3. Runs `helm upgrade --install` with the latest tag.<br><br>This makes the pipeline **fully declarative and zero-touch** from code commit → container → Kubernetes deployment. |
| **Environment Separation** | For real-world scenarios, separate environments (`dev`, `staging`, `prod`) can be handled via:<br>• Separate Terraform workspaces<br>• Helm values files (e.g. `values-prod.yaml`)<br>• Namespaced deployments<br>• Versioned ECR tags per branch or environment |


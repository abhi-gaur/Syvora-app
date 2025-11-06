Syvora — Cloud-Native DevOps Demo (EKS + Helm + Monitoring)



---

# 📚 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Infrastructure via Terraform](#infrastructure-via-terraform)
- [Kubernetes Deployment (Helm)](#kubernetes-deployment-helm)
- [Monitoring & Alerting](#monitoring--alerting)
- [Continuous Integration & Deployment](#continuous-integration--deployment)
- [Verification Links](#verification-links)
- [Why These Choices](#why-these-choices)
- [Future Improvements](#future-improvements)
- [License](#license)

---

## ⚙️ Overview

**Syvora-App** is a full-stack DevOps demonstration project that showcases:
- how to build a backend service in **Node.js + PostgreSQL**
- how to containerize it using **Docker**
- how to automate builds via **GitHub Actions + OIDC → ECR**
- how to deploy it to **Amazon EKS** via **Helm**
- how to monitor it using **Prometheus & Grafana**
- and how to trigger alerts for latency or downtime.

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




💻 Local Development

1️⃣ Run locally with Docker Compose

    "docker compose up --build"


Visit:

App: http://localhost:3000
Health check: http://localhost:3000/healthz
Metrics: http://localhost:3000/metrics

Database credentials are configured via => db/init.sql.

☁️ Infrastructure via Terraform
cd terraform/eks
terraform init
terraform plan -out=tfplan
terraform apply tfplan


This provisions:

- VPC, Subnets, Route Tables, NAT

- EKS Cluster (syvora-eks)

- Node Group (2 × t3.medium)

Connect to cluster:

aws eks update-kubeconfig --region us-east-2 --name syvora-eks
kubectl get nodes -o wide


########################################    HELM ###############
Kubernetes Deployment (Helm)

Deploy the backend:

cd helm/syvora-app
helm upgrade --install syvora . -f values.yaml
kubectl get pods, svc -n default


The service exposes:

LoadBalancer:
http://<elb-url>/healthz

NodePort:
http://<node-external-ip>:32399/healthz



#################  Monitoring & Alerting   ########
Prometheus & Grafana installation

Using the kube-prometheus-stack Helm chart:

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack



Prometheus

URL: http://<node-ip>:30815   (In our Case = http://3.138.35.245:31282/ )

View /targets → syvora-app → ✅ UP

Grafana

URL: http://<node-ip>:30429  (In our Case = http://3.138.35.245:32603/dashboards)

Default user: admin
Default password: syvora123



Import Syvora App Metrics dashboard (included in repo):

Request Rate

p90 Latency

Error Rate

Up Status

Alerts configured
Alert	Condition	Severity
SyvoraAppDown	up{job="syvora-app"} == 0 for 1m	Critical
HighResponseTime	p90 latency > 1s for 2m	Warning

To send alerts to Slack or Email, mount a Secret with an Alertmanager config (see examples in /monitoring).


🔄 Continuous Integration & Deployment
GitHub Actions — CI Build

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




Working Links

Backend	http://aea430f8b04ec4b50ab5384de1f4950e-1575553998.us-east-2.elb.amazonaws.com/healthz
	Returns ok








Future Improvements
Area	Upgrade
Security	Replace NodePort with AWS ALB Ingress + TLS (cert-manager).
Secrets	Use AWS Secrets Manager or ExternalSecrets operator.
Alerting	Configure Slack/email receivers in Alertmanager.
Terraform Backend	Move to S3 + DynamoDB for remote state & locking.
Scaling	Add HPA (Horizontal Pod Autoscaler) and resource limits.
CD Pipeline	Add canary or blue/green deployment strategy.
Cost Optimization	Use Spot Instances for worker nodes.
Logging	Integrate Loki or CloudWatch FluentBit sidecars.

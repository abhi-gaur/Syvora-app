variable "region" {
  description = "AWS region to deploy the EKS cluster"
  type        = string
  default     = "us-east-2"
}

variable "cluster_name" {
  description = "EKS Cluster name"
  type        = string
  default     = "syvora-eks"
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.31"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Environment = "dev"
    Terraform   = "true"
  }
}


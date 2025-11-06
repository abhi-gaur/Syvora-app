output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_ca" {
  description = "EKS Cluster Certificate Authority"
  value       = module.eks.cluster_certificate_authority_data
}

output "node_group_arns" {
  description = "EKS Node group ARNs"
  value       = module.eks.eks_managed_node_groups
}


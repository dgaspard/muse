@description('Environment name (dev, prod, or staging)')
param environment string = 'dev'

@description('Azure region for resource deployment')
param location string = 'eastus'

@description('Owner or team responsible for resources')
param owner string = 'muse-team'

@description('Deployment timestamp')
param deploymentTimestamp string = utcNow('u')

// Derived values
var resourceNamePrefix = 'muse-${environment}'
var logAnalyticsWorkspaceName = '${resourceNamePrefix}-log'

// Common tags applied to all resources
var commonTags = {
  app: 'muse'
  environment: environment
  owner: owner
  managedBy: 'bicep'
  createdDate: deploymentTimestamp
}

// Log Analytics Workspace for centralized logging and monitoring
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  tags: commonTags
  properties: {
    sku: {
      name: environment == 'prod' ? 'PerGB2018' : 'PerGB2018'
    }
    retentionInDays: environment == 'prod' ? 90 : 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// Azure Container Registry for Docker images
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: replace('${resourceNamePrefix}acr', '-', '') // ACR names can't have hyphens
  location: location
  tags: commonTags
  sku: {
    name: environment == 'prod' ? 'Premium' : 'Basic'
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
    networkRuleBypassOptions: 'AzureServices'
  }
}

// Container Apps Environment for hosting application services
resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${resourceNamePrefix}-cae'
  location: location
  tags: commonTags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
  }
}

// Container App for MinIO (S3-compatible storage)
resource minioContainerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${resourceNamePrefix}-minio'
  location: location
  tags: commonTags
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 9000
        transport: 'auto'
        allowInsecure: false
      }
      registries: []
      secrets: [
        {
          name: 'minio-root-user'
          value: 'minioadmin'
        }
        {
          name: 'minio-root-password'
          value: 'minioadmin'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'minio'
          image: 'minio/minio:latest'
          command: [
            'minio'
            'server'
            '/data'
            '--console-address'
            ':9001'
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'MINIO_ROOT_USER'
              secretRef: 'minio-root-user'
            }
            {
              name: 'MINIO_ROOT_PASSWORD'
              secretRef: 'minio-root-password'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

// Container App for API service
resource apiContainerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${resourceNamePrefix}-api'
  location: location
  tags: commonTags
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 4000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.listCredentials().username
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        {
          name: 'registry-password'
          value: containerRegistry.listCredentials().passwords[0].value
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: environment
            }
            {
              name: 'API_PORT'
              value: '4000'
            }
            {
              name: 'MINIO_ENDPOINT'
              value: 'https://${minioContainerApp.properties.configuration.ingress.fqdn}'
            }
            {
              name: 'MINIO_ACCESS_KEY'
              value: 'minioadmin'
            }
            {
              name: 'MINIO_SECRET_KEY'
              value: 'minioadmin'
            }
          ]
        }
      ]
      scale: {
        minReplicas: environment == 'prod' ? 2 : 1
        maxReplicas: environment == 'prod' ? 10 : 3
      }
    }
  }
}

// Container App for Worker service
resource workerContainerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${resourceNamePrefix}-worker'
  location: location
  tags: commonTags
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 4100
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.listCredentials().username
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        {
          name: 'registry-password'
          value: containerRegistry.listCredentials().passwords[0].value
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'worker'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: environment
            }
            {
              name: 'WORKER_PORT'
              value: '4100'
            }
          ]
        }
      ]
      scale: {
        minReplicas: environment == 'prod' ? 2 : 1
        maxReplicas: environment == 'prod' ? 10 : 5
      }
    }
  }
}

// Container App for Web (Next.js) service
resource webContainerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${resourceNamePrefix}-web'
  location: location
  tags: commonTags
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.listCredentials().username
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        {
          name: 'registry-password'
          value: containerRegistry.listCredentials().passwords[0].value
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: environment
            }
            {
              name: 'API_ENDPOINT'
              value: 'https://${apiContainerApp.properties.configuration.ingress.fqdn}'
            }
          ]
        }
      ]
      scale: {
        minReplicas: environment == 'prod' ? 2 : 1
        maxReplicas: environment == 'prod' ? 10 : 3
      }
    }
  }
}

// Output the Log Analytics Workspace resource ID for use in dependent resources
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name
output logAnalyticsWorkspaceResourceGroup string = resourceGroup().name
output deploymentLocation string = location
output deploymentEnvironment string = environment

// ACR outputs
output containerRegistryName string = containerRegistry.name
output containerRegistryLoginServer string = containerRegistry.properties.loginServer

// Container Apps outputs
output apiUrl string = 'https://${apiContainerApp.properties.configuration.ingress.fqdn}'
output workerUrl string = 'https://${workerContainerApp.properties.configuration.ingress.fqdn}'
output webUrl string = 'https://${webContainerApp.properties.configuration.ingress.fqdn}'
output minioUrl string = 'https://${minioContainerApp.properties.configuration.ingress.fqdn}'

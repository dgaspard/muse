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

// Output the Log Analytics Workspace resource ID for use in dependent resources
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name
output logAnalyticsWorkspaceResourceGroup string = resourceGroup().name
output deploymentLocation string = location
output deploymentEnvironment string = environment

import * as SDK from "azure-devops-extension-sdk";
import * as API from "azure-devops-extension-api";
import type { IProjectPageService, IExtensionDataManager, IExtensionDataService } from "azure-devops-extension-api";
import { WorkItemTrackingRestClient } from "azure-devops-extension-api/WorkItemTracking";
import { GitRestClient } from "azure-devops-extension-api/Git";
import { WorkRestClient } from "azure-devops-extension-api/Work";
import { CoreRestClient } from "azure-devops-extension-api/Core";

let initialized = false;

/**
 * Initializes the Azure DevOps Extension SDK.
 */
export async function initializeSDK(): Promise<void> {
  if (initialized) return;
  await SDK.init();
  await SDK.ready();
  initialized = true;
}

/**
 * Get the current project name and ID from the Azure DevOps context.
 */
export async function getProjectContext(): Promise<{
  projectName: string;
  projectId: string;
}> {
  const projectService = await SDK.getService<IProjectPageService>(
    API.CommonServiceIds.ProjectPageService,
  );
  const project = await projectService.getProject();
  if (!project) {
    throw new Error("Unable to determine current project context");
  }
  return { projectName: project.name, projectId: project.id };
}

/**
 * Get typed REST API clients.
 */
export async function getWorkItemTrackingClient(): Promise<WorkItemTrackingRestClient> {
  return API.getClient(WorkItemTrackingRestClient);
}

export async function getGitClient(): Promise<GitRestClient> {
  return API.getClient(GitRestClient);
}

export async function getWorkClient(): Promise<WorkRestClient> {
  return API.getClient(WorkRestClient);
}

export async function getCoreClient(): Promise<CoreRestClient> {
  return API.getClient(CoreRestClient);
}

/**
 * List all projects in the organization.
 */
export async function getOrganizationProjects(): Promise<
  { id: string; name: string }[]
> {
  const coreClient = await getCoreClient();
  const projects = await coreClient.getProjects();
  return projects
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get the current logged-in user's display name from the Azure DevOps SDK.
 */
export function getCurrentUserDisplayName(): string {
  const user = SDK.getUser();
  return user.displayName;
}

/**
 * Get the Extension Data Service for persisting extension data server-side.
 */
export async function getExtensionDataManager(): Promise<IExtensionDataManager> {
  const accessToken = await SDK.getAccessToken();
  const dataService = await SDK.getService<IExtensionDataService>(
    API.CommonServiceIds.ExtensionDataService,
  );
  return dataService.getExtensionDataManager(SDK.getExtensionContext().id, accessToken);
}

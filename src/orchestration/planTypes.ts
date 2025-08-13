export type ActionType = 'CREATE_FILE' | 'UPDATE_FILE' | 'DELETE_FILE';

export interface PlanActionBase {
  type: ActionType;
  path: string; // workspace-relative path using POSIX separators
}

export interface CreateOrUpdateAction extends PlanActionBase {
  type: 'CREATE_FILE' | 'UPDATE_FILE';
  content: string;
}

export interface DeleteAction extends PlanActionBase {
  type: 'DELETE_FILE';
}

export type PlanAction = CreateOrUpdateAction | DeleteAction;

export interface ExecutionPlan {
  thought: string;
  actions: PlanAction[];
}

export interface Attachment {
  filePath: string;
  content: string;
}
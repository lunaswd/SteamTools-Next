import { invoke, isTauri } from '@tauri-apps/api/core';

export type UpdateKind = 'tool'|'kernel';
export type UpdateScope = UpdateKind|'both';
export type UpdateStatus = 'available'|'current'|'notInstalled'|'undetermined'|'error'|'unknown';
export interface UpdateError {messageKey?:string;detail?:string}
export interface UpdateCheck {
  status:UpdateStatus;
  currentVersion:string|null;
  latestVersion:string|null;
  releaseTag?:string|null;
  currentSha256?:string|null;
  latestSha256?:string|null;
  error?:UpdateError|null;
}
export interface UpdatesState {tool:UpdateCheck;kernel:UpdateCheck;checkedAt:number}
export interface ToolUpdateReceipt {prepared:boolean;restarting:boolean}

/** Fixed release repositories are owned by the native bridge, never by UI input. */
export async function checkUpdates(steamPath:string|null,scope:UpdateScope='both'):Promise<UpdatesState> {
  if(isTauri())return invoke('check_updates_command',{scope,steamPath:scope==='tool'?null:steamPath});
  const unknown:UpdateCheck={status:'unknown',currentVersion:null,latestVersion:null};
  return {tool:{...unknown},kernel:{...unknown},checkedAt:0};
}

export async function installToolUpdate(expectedVersion:string):Promise<ToolUpdateReceipt> {
  if(!isTauri())throw {messageKey:'updates.desktopOnly',detail:''};
  return invoke('install_tool_update_command',{expectedVersion});
}

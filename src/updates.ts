import { t, getLocale } from './i18n';
import { checkUpdates, installToolUpdate } from './update-api';
import type { UpdateCheck, UpdateError, UpdateKind, UpdateScope, UpdatesState, ToolUpdateReceipt } from './update-api';

export interface UpdateControllerOptions {
  getSteamPath():string|null;
  getAppVersion():string;
  isAppBusy():boolean;
  onChange():void;
  onBeforeApply?():void;
  onApplyFailed?():void;
}
export interface UpdateControllerApi {
  check(path:string|null,scope:UpdateScope):Promise<UpdatesState>;
  install(expectedVersion:string):Promise<ToolUpdateReceipt>;
}
const defaultApi:UpdateControllerApi={check:checkUpdates,install:installToolUpdate};
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const tr=(key:string,args?:Record<string,string|number>)=>esc(t(key,args));
const updateIcon='<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 11.8-2L20 8M4 16l2.2 3A7 7 0 0 0 18 17"/></svg>';

/** Release-only checks: no accounts, library contents or private paths leave this app. */
export class UpdateController {
  open=false;
  private pending:UpdateScope|null=null;
  private dialogScope:'both'|'tool'='both';
  confirmation=false;
  phase:'idle'|'preparing'|'restarting'='idle';
  private results:Record<UpdateKind,UpdateCheck|null>={tool:null,kernel:null};
  private checkedAt:Record<UpdateKind,number>={tool:0,kernel:0};
  private kernelPath:string|null=null;
  error:UpdateError|null=null;
  private startupChecked=false;
  private suppressAutomaticPopup=false;
  private dismissed=new Set<string>();
  private ownerDocument:Document|null=null;
  private previouslyFocused:HTMLElement|null=null;
  constructor(private options:UpdateControllerOptions,private api:UpdateControllerApi=defaultApi) {}
  private changed(){this.options.onChange()}
  private fingerprint(check:UpdateCheck,kind:'tool'|'kernel'){return `${kind}:${check.releaseTag||''}:${check.latestVersion||''}:${check.latestSha256||''}`}
  private result(kind:UpdateKind){return kind==='kernel'&&this.kernelPath!==this.options.getSteamPath()?null:this.results[kind]}
  private hasNewUpdate(){return (['tool','kernel'] as const).some(kind=>{const check=this.result(kind);return check?.status==='available'&&!this.dismissed.has(this.fingerprint(check,kind))})}
  private notice(error:unknown):UpdateError {
    if(error&&typeof error==='object'){
      const e=error as Record<string,unknown>;
      return {messageKey:typeof e.messageKey==='string'?e.messageKey:'updates.failed',detail:typeof e.detail==='string'?e.detail:error instanceof Error?error.message:''};
    }
    return {messageKey:'updates.failed',detail:typeof error==='string'?error:''};
  }
  get applying(){return this.phase!=='idle'}
  get checking(){return this.pending!==null}
  get checkingKernel(){return this.pending==='kernel'||this.pending==='both'}
  private isChecking(kind:UpdateKind){return this.pending===kind||this.pending==='both'}
  private get blocked(){return this.applying||this.options.isAppBusy()}
  private get toolVersionToInstall(){const tool=this.result('tool');return tool?.status==='available'?tool.latestVersion:null}
  get toolAvailable(){return !!this.toolVersionToInstall}
  menuButton():string {
    return `<button type="button" id="updates-open" class="button secondary update-menu-button" data-update-action="open" ${this.checking||this.blocked?'disabled':''}>${updateIcon}<span>${tr('updates.checkTool')}</span>${this.toolAvailable?'<span class="update-menu-dot" aria-hidden="true"></span>':''}</button>`;
  }
  kernelPanel():string {
    return `<div class="kernel-update-panel"><div class="kernel-update-heading"><h3>${tr('updates.kernel')}</h3><button type="button" id="updates-kernel" class="button secondary" data-update-action="kernel" aria-describedby="kernel-update-status" ${this.checking||this.blocked?'disabled':''}>${updateIcon}<span>${tr('updates.checkKernel')}</span></button></div>${this.row('kernel',true)}</div>`;
  }
  kernelBanner():string {
    const kernel=this.result('kernel');
    return kernel?.status==='available'?`<aside class="kernel-update-banner" role="status">${updateIcon}<div><strong>${tr('updates.kernelAvailable',{version:kernel.latestVersion||t('common.unknown')})}</strong><p>${tr('updates.kernelInstallHint')}</p></div></aside>`:'';
  }
  private checkedTime(kind:UpdateKind):string {
    const timestamp=this.result(kind)?this.checkedAt[kind]:0;
    if(!timestamp)return t('updates.notChecked');
    try{return new Intl.DateTimeFormat(getLocale(),{dateStyle:'short',timeStyle:'short'}).format(new Date(timestamp*1000))}catch{return t('updates.notChecked')}
  }
  private row(kind:UpdateKind,inline=false):string {
    const check=this.result(kind),checking=this.isChecking(kind);
    const status=checking?'checking':check?.status||'unknown';
    const current=check?.currentVersion||(kind==='tool'?this.options.getAppVersion():null);
    const error=checking?null:check?.error;
    return `<article class="${inline?'update-item-inline':'update-item'} ${status==='available'?'available':''}" data-update-kind="${kind}"><div class="update-item-heading">${inline?'':`<h3>${tr(`updates.${kind}`)}</h3>`}<span ${inline?'id="kernel-update-status"':''} class="update-status ${esc(status)}" role="status">${tr(`updates.status.${status}`)}</span></div><dl><div><dt>${tr('updates.current')}</dt><dd>${esc(current||'—')}</dd></div><div><dt>${tr('updates.latest')}</dt><dd>${esc((checking?null:check?.latestVersion)||'—')}</dd></div></dl>${kind==='kernel'&&status==='available'?`<p class="update-item-hint">${tr('updates.kernelInstallHint')}</p>`:''}${error?this.errorMarkup(error):''}${this.result(kind)&&this.checkedAt[kind]?`<small class="update-checked-time">${tr('updates.lastChecked')}: ${esc(this.checkedTime(kind))}</small>`:''}</article>`;
  }
  private errorMarkup(error:UpdateError):string {
    const key=error.messageKey||'updates.failed';
    const message=t(key)===key?t('updates.failed'):t(key);
    return `<div class="update-error" role="alert"><strong>${esc(message)}</strong>${error.detail?`<details><summary>${tr('diagnostics.technicalEvidence')}</summary><pre>${esc(error.detail)}</pre></details>`:''}</div>`;
  }
  markup():string {
    if(!this.open)return '';
    const blocked=this.blocked;
    const version=this.toolVersionToInstall||'';
    return `<div class="update-dialog-overlay" data-update-overlay><section id="update-dialog" class="update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-dialog-title" tabindex="-1" aria-busy="${this.checking||this.applying}"><header><div>${updateIcon}<h2 id="update-dialog-title">${tr('updates.title')}</h2></div><button class="icon-button" id="updates-close" data-update-action="close" aria-label="${tr('common.close')}" ${this.applying?'disabled':''}>×</button></header><p class="update-privacy-note">${tr('updates.privacy')}</p><div class="update-items">${this.row('tool')}${this.dialogScope==='both'?this.row('kernel'):''}</div>${this.error?this.errorMarkup(this.error):''}${this.applying?`<div class="update-progress" role="status"><span class="spinner"></span><div><strong>${tr(this.phase==='preparing'?'updates.preparing':'updates.restarting')}</strong><p>${tr('updates.keepOpen')}</p></div></div>`:this.confirmation?`<div class="update-confirmation" role="alert"><strong>${tr('updates.confirmTitle',{version})}</strong><p>${tr('updates.confirmBody')}</p><div><button id="updates-confirm" class="button primary" data-update-action="confirm" ${blocked?'disabled':''}>${tr('updates.updateRestart')}</button><button class="button secondary" data-update-action="cancel" ${blocked?'disabled':''}>${tr('common.cancel')}</button></div></div>`:`<div class="update-dialog-actions"><button class="button secondary" id="updates-refresh" data-update-action="refresh" ${this.checking||blocked?'disabled':''}>${updateIcon}${tr('updates.checkTool')}</button>${this.toolAvailable?`<button class="button primary" id="updates-install" data-update-action="install" ${this.checking||blocked?'disabled':''}>${tr('updates.updateRestart')}</button>`:''}<button class="button secondary" data-update-action="close" ${this.applying?'disabled':''}>${tr('updates.later')}</button></div>`}</section></div>`;
  }
  async check(automatic=false,scope:UpdateScope=automatic?'both':'tool'):Promise<void> {
    if(this.checking||this.blocked)return;
    if(automatic&&this.startupChecked)return;
    if(automatic)this.startupChecked=true;
    const path=this.options.getSteamPath();
    const kinds:UpdateKind[]=scope==='both'?['tool','kernel']:[scope];
    this.pending=scope;
    if(scope!=='kernel'){this.error=null;this.confirmation=false}
    this.changed();
    try {
      const result=await this.api.check(path,scope);
      for(const kind of kinds){
        this.results[kind]=result[kind]??{status:'error',currentVersion:null,latestVersion:null,error:{messageKey:'updates.failed'}};
        this.checkedAt[kind]=result.checkedAt;
      }
      if(scope!=='tool')this.kernelPath=path;
      if(automatic&&!this.suppressAutomaticPopup&&this.hasNewUpdate())this.openDialog('both');
    } catch(error) {
      for(const kind of kinds){
        this.results[kind]={status:'error',currentVersion:null,latestVersion:null,error:this.notice(error)};
        this.checkedAt[kind]=0;
      }
      if(scope!=='tool')this.kernelPath=path;
    } finally {
      this.pending=null;this.changed();
    }
  }
  openDialog(scope:'both'|'tool'='both'){
    if(!this.open&&typeof document!=='undefined')this.previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
    this.dialogScope=scope;this.open=true;this.confirmation=false;this.changed();
  }
  async openAndCheck(){if(this.checking||this.blocked)return;this.openDialog('tool');await this.check(false,'tool')}
  close(){
    if(this.applying)return;
    this.suppressAutomaticPopup=true;
    for(const kind of ['tool','kernel'] as const){const check=this.result(kind);if(check?.status==='available')this.dismissed.add(this.fingerprint(check,kind))}
    this.open=false;this.confirmation=false;this.changed();
    const previous=this.previouslyFocused;
    const target=previous?.isConnected?previous:previous?.id?this.ownerDocument?.getElementById(previous.id):null;
    target?.focus({preventScroll:true});
  }
  askToInstall(){if(this.toolAvailable&&!this.checking&&!this.applying&&!this.options.isAppBusy()){this.confirmation=true;this.error=null;this.changed()}}
  async confirmInstall():Promise<void> {
    if(!this.confirmation||!this.toolAvailable||this.checking||this.applying||this.options.isAppBusy())return;
    const expectedVersion=this.toolVersionToInstall!;
    this.confirmation=false;this.phase='preparing';this.error=null;
    try {
      this.options.onBeforeApply?.();this.changed();
      const receipt=await this.api.install(expectedVersion);
      if(!receipt.prepared||!receipt.restarting)throw {messageKey:'updates.failed',detail:''};
      this.phase='restarting';this.changed();
      // Only native code may exit/restart. A browser reload would not apply files.
    } catch(error) {
      this.phase='idle';this.error=this.notice(error);this.options.onApplyFailed?.();this.changed();
    }
  }
  kernelInstalled(version:string|null,sha:string|null){
    const kernel=this.result('kernel');if(!kernel||(!kernel.latestVersion&&!kernel.latestSha256))return;
    kernel.currentVersion=version;kernel.currentSha256=sha;
    if(!version&&!sha)kernel.status='notInstalled';
    else if(kernel.latestSha256?sha===kernel.latestSha256:version===kernel.latestVersion)kernel.status='current';
    this.changed();
  }
  bind(root:HTMLElement){
    const owner=root.ownerDocument;
    if(this.ownerDocument!==owner){this.dispose();this.ownerDocument=owner;owner.addEventListener('keydown',this.onKeyDown)}
    root.querySelectorAll<HTMLElement>('[data-update-action]').forEach(element=>element.addEventListener('click',()=>{
      switch(element.dataset.updateAction){
        case'open':void this.openAndCheck();break;
        case'kernel':void this.check(false,'kernel').then(()=>{
          if(owner.activeElement===owner.body)owner.getElementById('updates-kernel')?.focus({preventScroll:true});
        });break;
        case'close':this.close();break;
        case'refresh':void this.check(false);break;
        case'install':this.askToInstall();break;
        case'confirm':void this.confirmInstall();break;
        case'cancel':this.confirmation=false;this.changed();break;
      }
    }));
    root.querySelector<HTMLElement>('[data-update-overlay]')?.addEventListener('click',event=>{if(event.target===event.currentTarget)this.close()});
    if(this.open){const dialog=root.querySelector<HTMLElement>('#update-dialog');if(dialog&&!dialog.contains(owner.activeElement))dialog.focus({preventScroll:true})}
  }
  private onKeyDown=(event:KeyboardEvent)=>{
    if(!this.open)return;
    if(event.key==='Escape'){event.preventDefault();this.close();return}
    if(event.key!=='Tab')return;
    const dialog=this.ownerDocument?.getElementById('update-dialog');if(!dialog)return;
    const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),summary,a[href],[tabindex="0"]'));
    if(!controls.length){event.preventDefault();dialog.focus();return}
    const active=this.ownerDocument!.activeElement,index=controls.indexOf(active as HTMLElement);
    if(event.shiftKey&&(index<=0)){event.preventDefault();controls.at(-1)!.focus()}
    else if(!event.shiftKey&&(index<0||index===controls.length-1)){event.preventDefault();controls[0].focus()}
  };
  dispose(){this.ownerDocument?.removeEventListener('keydown',this.onKeyDown);this.ownerDocument=null}
}

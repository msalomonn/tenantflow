import {useEffect,useRef,useState,type FormEvent} from 'react';
import {api,ApiError} from './api';
type Organization={id:string;name:string;role:'owner'|'admin'|'member'|'viewer'};
type Project={id:string;name:string;created_at:string;archived_at?:string|null};
type Dialog={kind:'create'}|{kind:'edit'|'archive';project:Project}|{kind:'organization'};
function Folder(){return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.6"/></svg>;}
function LifecycleDialog({dialog,organization,onClose,onSave}:{dialog:Dialog;organization:Organization;onClose:()=>void;onSave:(name:string)=>Promise<void>}){
 const ref=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const archive=dialog.kind==='archive',create=dialog.kind==='create',org=dialog.kind==='organization';
 const title=archive?'Archive project?':create?'Create project':org?'Rename organization':'Edit project';
 const initial=org?organization.name:dialog.kind==='edit'?dialog.project.name:'';
 useEffect(()=>{ref.current?.showModal();},[]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const name=String(new FormData(e.currentTarget).get('name')??'').trim();
  if(!archive&&(!name||[...name].length>120)){setError('Use a name between 1 and 120 characters.');return;}
  setBusy(true);setError('');try{await onSave(name);}catch(e){if(e instanceof Error&&e.name==='AbortError')return;setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
 }
 return <dialog ref={ref} aria-labelledby="project-dialog-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
  <button className="close-button" aria-label="Close dialog" onClick={onClose} disabled={busy}>×</button><span className="eyebrow">{archive?'MAKE SPACE FOR WHAT COMES NEXT':'YOUR WORK, CLEARLY NAMED'}</span><h2 id="project-dialog-title">{title}</h2>
  <p className="muted">{archive?`“${dialog.project.name}” will be hidden from the project list, not deleted. Restoring archived projects is not available yet.`:org?'Choose a name your team will recognize.':'Give this project a clear, useful name.'}</p>
  {error&&<div className="notice" role="alert">{error}</div>}
  <form onSubmit={submit}>{!archive&&<label>{org?'Organization name':'Project name'}<input name="name" defaultValue={initial} required autoFocus disabled={busy}/></label>}
   <div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy?'Saving…':archive?'Archive project':create?'Create project':'Save changes'}</button></div>
  </form>
 </dialog>;
}
export function Projects({organization,onSessionExpired,onChanged}:{organization:Organization;onSessionExpired:()=>void;onChanged:()=>Promise<void>}){
 const [projects,setProjects]=useState<Project[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[mutationError,setMutationError]=useState(''),[notice,setNotice]=useState('');
 const [dialog,setDialog]=useState<Dialog|null>(null),[search,setSearch]=useState(''),[retry,setRetry]=useState(0);
 const mutation=useRef<AbortController|null>(null);
 useEffect(()=>()=>mutation.current?.abort(),[]);
 const base=`/api/organizations/${organization.id}`;
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setProjects([]);setError('');
  api<{projects:Project[]}>(base+'/projects',undefined,controller.signal)
   .then(r=>{if(!controller.signal.aborted)setProjects(r.projects);})
   .catch(e=>{if(controller.signal.aborted)return;if(e instanceof ApiError&&e.status===401)onSessionExpired();else{setError(e.message);if(e instanceof ApiError&&[403,404].includes(e.status))void onChanged();}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[organization.id,retry]);
 const canWrite=organization.role!=='viewer',canRename=['owner','admin'].includes(organization.role);
 const visible=projects.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
 async function save(name:string){
  if(!dialog)return;
  const controller=new AbortController();mutation.current?.abort();mutation.current=controller;setMutationError('');setNotice('');
  try{
   if(dialog.kind==='organization'){
    await api(base,{name},controller.signal,'PATCH');await onChanged();controller.signal.throwIfAborted();setNotice('Organization renamed.');
   }else{
    const create=dialog.kind==='create',archive=dialog.kind==='archive';
    const result=await api<{project:Project}>(base+'/projects'+(create?'':'/'+dialog.project.id),archive?{archived:true}:{name},controller.signal,create?'POST':'PATCH');
    controller.signal.throwIfAborted();
    setProjects(current=>archive?current.filter(p=>p.id!==result.project.id):create?[result.project,...current]:current.map(p=>p.id===result.project.id?result.project:p));
    setSearch('');setNotice(archive?'Project archived. It is hidden from the list; its data is retained.':create?'Project created.':'Project updated.');
   }
   setDialog(null);
  }catch(e){
   if(controller.signal.aborted)throw e;
   if(e instanceof ApiError&&e.status===401)onSessionExpired();
   else if(e instanceof ApiError&&[403,404,409].includes(e.status)){
    setDialog(null);setProjects([]);setMutationError(e.message);
    await onChanged();if(!controller.signal.aborted)setRetry(n=>n+1);
   }
   throw e;
  }
 }
 return <>
  <header className="page-heading"><div><span className="eyebrow">YOUR WORKSPACE, IN FOCUS</span><h1>Projects<span className="accent">.</span></h1><p className="muted">A home for everything you're building in {organization.name}.</p>{canRename&&<button className="text-button organization-rename" onClick={()=>setDialog({kind:'organization'})}>Rename organization</button>}</div><button className="button primary" disabled={!canWrite||loading||!!error} onClick={()=>setDialog({kind:'create'})}><span aria-hidden="true">＋</span> New project</button></header>
  <div className="workspace-banner"><div className="banner-symbol" aria-hidden="true">↗</div><div><strong>Good work starts with a little clarity.</strong><p>Keep your projects together. Make space for what comes next.</p></div><span className="workspace-tag">{organization.name}</span></div>
  <div className="project-toolbar"><div className="section-tab">All projects <span>{projects.length}</span></div><label className="search-label"><span className="sr-only">Search projects</span><input type="search" placeholder="Search projects…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
  {!canWrite&&<p className="read-only">You have viewer access. You can explore projects; an owner can update your role.</p>}
  {notice&&<p className="read-only" role="status">{notice}</p>}{mutationError&&<div className="notice" role="alert">{mutationError}</div>}
  {loading?<div className="loading" role="status">Loading projects…</div>:error?<div className="error-panel"><div className="notice" role="alert">{error}</div><button className="button secondary" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:visible.length>0?<div className="project-grid">{visible.map((p,index)=><article className="project-card" key={p.id}><div className="card-top"><span className={`folder-icon color-${index%3}`}><Folder/></span><span className="project-kind">PROJECT</span></div><h2>{p.name}</h2><p className="muted">A new place to move ideas forward.</p>{canWrite&&<div className="project-actions"><button className="text-button" aria-label={`Edit ${p.name}`} onClick={()=>setDialog({kind:'edit',project:p})}>Edit</button><button className="text-button" aria-label={`Archive ${p.name}`} onClick={()=>setDialog({kind:'archive',project:p})}>Archive</button></div>}<div className="card-footer"><span>Created {new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(new Date(p.created_at))}</span><span className="status-pill">Active</span></div></article>)}</div>:<section className="empty-state"><span className="empty-folder"><Folder/></span><h2>{search?'No projects match your search.':'Make room for your next idea.'}</h2><p className="muted">{search?'Try a different name.':canWrite?'Your first project is the start of something. Give it a name and make it yours.':'Projects will appear here when your team creates them.'}</p>{!search&&canWrite&&<button className="button secondary" onClick={()=>setDialog({kind:'create'})}>Create your first project <span aria-hidden="true">↗</span></button>}</section>}
  <footer className="workspace-footer"><span>One team. A shared sense of direction.</span><span>{projects.length} {projects.length===1?'project':'projects'} · {organization.role} access</span></footer>
  {dialog&&<LifecycleDialog dialog={dialog} organization={organization} onClose={()=>setDialog(null)} onSave={save}/>}
 </>;
}

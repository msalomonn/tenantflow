import React, {useEffect,useRef,useState, type FormEvent, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import {api,ApiError} from './api';
import {Members} from './Members';

type User={id:string;name:string;email:string};
type Organization={id:string;name:string;role:'owner'|'admin'|'member'|'viewer'};
type Project={id:string;name:string;created_at:string};
function Brand(){return <span className="brand"><span className="brand-mark" aria-hidden="true">t<span>f</span></span>tenantflow<span className="brand-dot">.</span></span>;}
function Folder(){return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="1.6"/></svg>;}
function Notice({children}:{children:ReactNode}){return <div className="notice" role="alert">{children}</div>;}

function AuthScreen({onSuccess}:{onSuccess:()=>Promise<void>}) {
  const [signup,setSignup]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const form=new FormData(e.currentTarget);setBusy(true);setError('');
    try{await api(`/api/auth/${signup?'sign-up':'sign-in'}/email`,{email:String(form.get('email')),password:String(form.get('password')),...(signup?{name:String(form.get('name')).trim()}:{})});await onSuccess();}
    catch(e){setError(e instanceof Error?e.message:'Unable to sign in.');}finally{setBusy(false);}
  }
  return <main className="auth-page">
    <section className="auth-story"><Brand/><div className="story-body"><span className="eyebrow light">A LITTLE SPACE. A LOT OF POSSIBILITY.</span><h1>Your team.<br/>Your projects.<br/><em>Your own space.</em></h1><p>Bring your work together, give every team a place to grow, and keep the right people in the loop.</p><div className="workspace-art" aria-hidden="true"><div className="art-label">YOUR WORK, IN GOOD COMPANY</div><div className="art-card"><span className="art-icon">↗</span><div><strong>Something great starts here</strong><span>One workspace. Endless possibilities.</span></div><span className="art-check">✓</span></div><div className="art-line"/><div className="art-avatars"><b>JD</b><b>AK</b><b>YOU</b><span>Made for teams that build.</span></div></div></div><footer>Thoughtfully organized. Clearly yours.</footer></section>
    <section className="auth-panel"><div className="auth-box"><span className="eyebrow">WELCOME TO TENANTFLOW</span><h2>{signup?'A fresh start for your team.':'Good to have you back.'}</h2><p className="muted">{signup?'Create your account, then make a space for your work.':'Sign in to pick up where you left off.'}</p>
      {error&&<Notice>{error}</Notice>}<form onSubmit={submit}>
      {signup&&<label>Your name<input name="name" autoComplete="name" required maxLength={120} placeholder="Alex Morgan"/></label>}
      <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com"/></label>
      <label>Password<input name="password" type="password" autoComplete={signup?'new-password':'current-password'} minLength={12} maxLength={128} required placeholder={signup?'At least 12 characters':'Enter your password'}/></label>
      <button className="button primary full" disabled={busy}>{busy?'Please wait…':signup?'Create account':'Sign in'}<span aria-hidden="true">↗</span></button></form>
      <p className="auth-toggle">{signup?'Already have an account?':'New around here?'} <button className="text-button" disabled={busy} onClick={()=>{setSignup(!signup);setError('');}}>{signup?'Sign in':'Create an account'}</button></p>
      <div className="auth-note"><span aria-hidden="true">◇</span> A workspace for each team. Access for the right people.</div>
    </div><footer className="muted">TenantFlow · A better place to begin.</footer></section>
  </main>;
}

function NameDialog({kind,onClose,onCreate}:{kind:'organization'|'project';onClose:()=>void;onCreate:(name:string)=>Promise<void>}) {
  const ref=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{ref.current?.showModal();},[]);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const name=String(new FormData(e.currentTarget).get('name')).trim();setBusy(true);setError('');try{await onCreate(name);onClose();}catch(e){setError(e instanceof Error?e.message:'Please try again.');setBusy(false);}}
  return <dialog ref={ref} onCancel={e=>{if(busy)e.preventDefault();else onClose();}} aria-labelledby="dialog-title"><button className="close-button" aria-label="Close dialog" onClick={onClose} disabled={busy}>×</button><span className="eyebrow">ROOM FOR SOMETHING NEW</span><h2 id="dialog-title">Create {kind}</h2><p className="muted">{kind==='organization'?'Give your team a space of its own.':'Start with a name. The rest comes together.'}</p>{error&&<Notice>{error}</Notice>}<form onSubmit={submit}><label>{kind==='organization'?'Organization name':'Project name'}<input name="name" required minLength={1} maxLength={120} autoFocus placeholder={kind==='organization'?'e.g. North Studio':'e.g. Website refresh'}/></label><div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="button primary" disabled={busy}>{busy?'Creating…':`Create ${kind}`}</button></div></form></dialog>;
}

function Projects({organization,onSessionExpired}:{organization:Organization;onSessionExpired:()=>void}) {
  const [projects,setProjects]=useState<Project[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[showCreate,setShowCreate]=useState(false),[search,setSearch]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setProjects([]);setError('');api<{projects:Project[]}>(`/api/organizations/${organization.id}/projects`,undefined,controller.signal).then(r=>setProjects(r.projects)).catch(e=>{if(e.name==='AbortError')return;if(e instanceof ApiError&&e.status===401)onSessionExpired();else setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[organization.id,retry]);
  const canWrite=organization.role!=='viewer';
  const visible=projects.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
  return <>
    <header className="page-heading"><div><span className="eyebrow">YOUR WORKSPACE, IN FOCUS</span><h1>Projects<span className="accent">.</span></h1><p className="muted">A home for everything you're building in {organization.name}.</p></div><button className="button primary" disabled={!canWrite||loading||!!error} onClick={()=>setShowCreate(true)}><span aria-hidden="true">＋</span> New project</button></header>
    <div className="workspace-banner"><div className="banner-symbol" aria-hidden="true">↗</div><div><strong>Good work starts with a little clarity.</strong><p>Keep your projects together. Make space for what comes next.</p></div><span className="workspace-tag">{organization.name}</span></div>
    <div className="project-toolbar"><div className="section-tab">All projects <span>{projects.length}</span></div><label className="search-label"><span className="sr-only">Search projects</span><input type="search" placeholder="Search projects…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    {!canWrite&&<p className="read-only">You have viewer access. You can explore projects; an owner can update your role.</p>}
    {loading?<div className="loading" role="status">Loading projects…</div>:error?<div className="error-panel"><Notice>{error}</Notice><button className="button secondary" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:visible.length>0?<div className="project-grid">{visible.map((p,index)=><article className="project-card" key={p.id}><div className="card-top"><span className={`folder-icon color-${index%3}`}><Folder/></span><span className="project-kind">PROJECT</span></div><h2>{p.name}</h2><p className="muted">A new place to move ideas forward.</p><div className="card-footer"><span>Created {new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(new Date(p.created_at))}</span><span className="status-pill">Active</span></div></article>)}</div>:<section className="empty-state"><span className="empty-folder"><Folder/></span><h2>{search?'No projects match your search.':'Make room for your next idea.'}</h2><p className="muted">{search?'Try a different name.':canWrite?'Your first project is the start of something. Give it a name and make it yours.':'Projects will appear here when your team creates them.'}</p>{!search&&canWrite&&<button className="button secondary" onClick={()=>setShowCreate(true)}>Create your first project <span aria-hidden="true">↗</span></button>}</section>}
    <footer className="workspace-footer"><span>One team. A shared sense of direction.</span><span>{projects.length} {projects.length===1?'project':'projects'} · {organization.role} access</span></footer>
    {showCreate&&<NameDialog kind="project" onClose={()=>setShowCreate(false)} onCreate={async name=>{const r=await api<{project:Project}>(`/api/organizations/${organization.id}/projects`,{name});setProjects(p=>[r.project,...p]);setSearch('');}}/>}
  </>;
}

function Workspace({user,onSignOut}:{user:User;onSignOut:()=>void}) {
  const [organizations,setOrganizations]=useState<Organization[]>([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[create,setCreate]=useState(false),[signingOut,setSigningOut]=useState(false),[retry,setRetry]=useState(0);
  const [view,setView]=useState<'projects'|'members'>('projects');
  const refreshGeneration=useRef(0),refreshController=useRef<AbortController|null>(null);
  async function refreshOrganizations(){
    const generation=++refreshGeneration.current;refreshController.current?.abort();
    const controller=new AbortController();refreshController.current=controller;setError('');
    try {
      const result=await api<{organizations:Organization[]}>('/api/organizations',undefined,controller.signal);
      if(generation!==refreshGeneration.current)return;
      setOrganizations(result.organizations);setSelected(current=>result.organizations.some(o=>o.id===current)?current:result.organizations[0]?.id??'');
    } catch(e) {
      if(controller.signal.aborted||generation!==refreshGeneration.current)return;
      if(e instanceof ApiError&&e.status===401)onSignOut();
      else {setOrganizations([]);setSelected('');setError(e instanceof Error?e.message:'Unable to refresh your workspace.');}
    } finally {if(generation===refreshGeneration.current)setLoading(false);}
  }
  useEffect(()=>{
    void refreshOrganizations();
    const onFocus=()=>{void refreshOrganizations();};window.addEventListener('focus',onFocus);
    return()=>{++refreshGeneration.current;refreshController.current?.abort();window.removeEventListener('focus',onFocus);};
  },[retry]);
  const org=organizations.find(o=>o.id===selected);
  async function signOut(){setSigningOut(true);try{await api('/api/auth/sign-out',{});onSignOut();}catch(e){setError(e instanceof Error?e.message:'Could not sign out.');}finally{setSigningOut(false);}}
  return <div className="app-shell"><aside className="sidebar"><Brand/><div className="org-control"><label htmlFor="organization">WORKSPACE</label><select id="organization" value={selected} disabled={loading||!organizations.length} onChange={e=>setSelected(e.target.value)}>{!organizations.length&&<option value="">No organizations yet</option>}{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><button className="add-org" onClick={()=>setCreate(true)}>＋ Create organization</button></div><nav aria-label="Workspace navigation"><span className="nav-label">WORKSPACE</span><button className={`nav-link ${view==='projects'?'nav-active':''}`} onClick={()=>setView('projects')} aria-current={view==='projects'?'page':undefined}><Folder/> Projects <span>↗</span></button><button className={`nav-link ${view==='members'?'nav-active':''}`} onClick={()=>{setView('members');void refreshOrganizations();}} aria-current={view==='members'?'page':undefined}>Members <span>↗</span></button></nav><div className="sidebar-note"><span className="eyebrow light">A SPACE TO CALL YOURS</span><p>Different teams.<br/>Clear boundaries.<br/>Room to do your best work.</p><span aria-hidden="true">✳</span></div><div className="user-panel"><span className="avatar">{user.name.slice(0,2).toUpperCase()}</span><div><strong>{user.name}</strong><span>{user.email}</span></div><button title="Sign out" aria-label="Sign out" onClick={signOut} disabled={signingOut}>↪</button></div></aside>
    <div className="main-shell"><div className="topbar"><span>{org?.name??'Your workspace'} <span className="breadcrumb">/</span> {view==='members'?'Members':'Projects'}</span><span className="topbar-status"><i/> Your space to build</span></div><main className="workspace-content">{error&&<div className="error-panel"><Notice>{error}</Notice><button className="button secondary" onClick={()=>setRetry(r=>r+1)}>Try again</button></div>}{loading?<div role="status" className="loading">Loading your workspace…</div>:org?(view==='members'?<Members key={org.id} organization={org} currentUserId={user.id} onChanged={refreshOrganizations} onSessionExpired={onSignOut}/>:<Projects key={org.id+':'+org.role} organization={org} onSessionExpired={onSignOut}/>):!error?<section className="welcome-empty"><span className="eyebrow">LET'S MAKE SPACE</span><h1>Welcome, {user.name.split(' ')[0]}<span className="accent">.</span></h1><p className="muted">Every great project needs a place to begin.<br/>Create an organization for your team and take it from there.</p><button className="button primary" onClick={()=>setCreate(true)}>Create your first organization <span aria-hidden="true">↗</span></button></section>:null}</main></div>
    {create&&<NameDialog kind="organization" onClose={()=>setCreate(false)} onCreate={async name=>{const r=await api<{organization:Organization}>('/api/organizations',{name});setOrganizations(o=>[...o,r.organization]);setSelected(r.organization.id);}}/>}
  </div>;
}
function App(){
  const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  async function load(){setError('');try{const r=await api<{user:User}>('/api/me');setUser(r.user);}catch(e){if(e instanceof ApiError&&e.status===401)setUser(null);else setError(e instanceof Error?e.message:'Unable to connect.');}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  if(loading)return <main className="loading-screen"><Brand/><p role="status">Opening your workspace…</p></main>;
  if(error)return <main className="loading-screen"><Brand/><Notice>{error}</Notice><button className="button primary" onClick={load}>Try again</button></main>;
  return user?<Workspace user={user} onSignOut={()=>setUser(null)}/>:<AuthScreen onSuccess={load}/>;
}
createRoot(document.getElementById('root')!).render(<App/>);

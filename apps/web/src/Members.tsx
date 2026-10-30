import {useEffect,useRef,useState,type FormEvent} from 'react';
import {api,ApiError} from './api';

type Role='owner'|'admin'|'member'|'viewer';
type Member={user_id:string;name:string;email:string;role:Role};
type Props={organization:{id:string;name:string;role:Role};currentUserId:string;onChanged:()=>Promise<void>;onSessionExpired:()=>void};
const roles:Role[]=['owner','admin','member','viewer'];

function RemoveDialog({member,busy,onClose,onConfirm}:{member:Member;busy:boolean;onClose:()=>void;onConfirm:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} aria-labelledby="remove-member-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
    <h2 id="remove-member-title">Remove member?</h2>
    <p className="muted">{member.name} will lose access to this organization's projects. Their account and other workspaces will stay available.</p>
    <div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy} onClick={onConfirm}>{busy?'Removing…':'Remove member'}</button></div>
  </dialog>;
}

export function Members({organization,currentUserId,onChanged,onSessionExpired}:Props) {
  const [members,setMembers]=useState<Member[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [mutationError,setMutationError]=useState('');
  const [busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[notice,setNotice]=useState(''),[remove,setRemove]=useState<Member|null>(null);
  const [email,setEmail]=useState(''),[newRole,setNewRole]=useState<Role>('member'),[draftRoles,setDraftRoles]=useState<Record<string,Role>>({});
  const isOwner=organization.role==='owner';
  const visibleError=error||mutationError;
  useEffect(()=>{
    const controller=new AbortController();setMembers([]);setError('');setLoading(true);
    if(!isOwner){setLoading(false);return()=>controller.abort();}
    api<{members:Member[]}>(`/api/organizations/${organization.id}/members`,undefined,controller.signal)
      .then(result=>{setMembers(result.members);setDraftRoles(Object.fromEntries(result.members.map(m=>[m.user_id,m.role])));})
      .catch(e=>{if(e.name==='AbortError')return;if(e instanceof ApiError&&e.status===401)onSessionExpired();else{setError(e.message);if(e instanceof ApiError&&[403,404].includes(e.status))void onChanged();}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[organization.id,isOwner,retry]);

  async function mutate(path:string,body:unknown,method:string,message:string) {
    if(busy)return;
    setBusy(true);setError('');setMutationError('');setNotice('');
    try {
      await api(path,body,undefined,method);setRemove(null);setEmail('');setMembers([]);
      await onChanged();setRetry(n=>n+1);setNotice(message);
    } catch(e) {
      setRemove(null);
      if(e instanceof ApiError&&e.status===401)onSessionExpired();
      else {
        setMutationError(e instanceof Error?e.message:'Unable to update membership.');
        if(e instanceof ApiError&&[403,404].includes(e.status)){
          // A missing target and revoked access share status codes. Revalidate both
          // access and the list; retain the mutation message through the reload.
          setMembers([]);await onChanged();setRetry(n=>n+1);
        }
      }
    } finally {setBusy(false);}
  }
  function add(e:FormEvent){e.preventDefault();void mutate(`/api/organizations/${organization.id}/members`,{email,role:newRole},'POST','Member added.');}
  return <section aria-label="Organization members">
    <header className="page-heading"><div><span className="eyebrow">THE PEOPLE BEHIND THE WORK</span><h1>Members<span className="accent">.</span></h1><p className="muted">Manage access to {organization.name}.</p></div></header>
    {!isOwner?<div className="read-only" role="status">Only organization owners can manage members. Your role is {organization.role}.</div>:<>
      <div className="workspace-banner"><div><strong>Every workspace needs an owner.</strong><p>Keep at least one owner. Add people who already have a TenantFlow account.</p></div></div>
      <form className="member-add" onSubmit={add}>
        <label>Registered email<input name="memberEmail" type="email" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)} placeholder="teammate@example.com" disabled={busy}/></label>
        <label>New member role<select aria-label="New member role" value={newRole} onChange={e=>setNewRole(e.target.value as Role)} disabled={busy}>{roles.map(role=><option key={role} value={role}>{role}</option>)}</select></label>
        <button className="button primary" disabled={busy||loading}>Add member</button>
      </form>
      {visibleError&&<div className="error-panel"><div className="notice" role="alert">{visibleError}</div><button className="button secondary" disabled={busy} onClick={()=>{setMutationError('');setRetry(n=>n+1);}}>Refresh members</button></div>}
      {notice&&<p className="read-only" role="status">{notice}</p>}
      {loading?<p className="loading" role="status">Loading members…</p>:<ul className="member-list" aria-label="Members">
        {members.map(member=><li key={member.user_id} className="member-row" aria-label={member.email}>
          <div className="member-identity"><strong>{member.name}{member.user_id===currentUserId?' (you)':''}</strong><span>{member.email}</span></div>
          <div className="member-actions"><label>Role for {member.name}<select aria-label={`Role for ${member.email}`} value={draftRoles[member.user_id]??member.role} onChange={e=>setDraftRoles(r=>({...r,[member.user_id]:e.target.value as Role}))} disabled={busy}>{roles.map(role=><option key={role} value={role}>{role}</option>)}</select></label>
            <button className="button secondary" disabled={busy||!draftRoles[member.user_id]||draftRoles[member.user_id]===member.role} onClick={()=>void mutate(`/api/organizations/${organization.id}/members/${member.user_id}`,{role:draftRoles[member.user_id]},'PATCH','Role updated.')}>Save role</button>
            <button className="text-button member-remove" disabled={busy} onClick={()=>setRemove(member)}>Remove</button>
          </div>
        </li>)}
      </ul>}
    </>}
    {remove&&<RemoveDialog member={remove} busy={busy} onClose={()=>setRemove(null)} onConfirm={()=>void mutate(`/api/organizations/${organization.id}/members/${remove.user_id}`,{},'DELETE','Member removed.')}/>}
  </section>;
}

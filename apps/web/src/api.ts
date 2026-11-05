export class ApiError extends Error {
  constructor(public status:number,message:string){super(message);}
}
export async function api<T>(path:string,body?:unknown,signal?:AbortSignal,method=body===undefined?'GET':'POST'):Promise<T> {
  const response=await fetch(path,{method,credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
  const data=await response.json();
  signal?.throwIfAborted();
  if(!response.ok)throw new ApiError(response.status,typeof data.error==='string'?data.error:data.message??'Something went wrong. Please try again.');
  return data;
}

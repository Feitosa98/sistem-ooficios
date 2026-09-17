"use client";
import {useState} from "react";
import {Button} from "./ui/button";
export function LogoutButton(){const [busy,setBusy]=useState(false),[error,setError]=useState(false);return <div><Button variant="ghost" disabled={busy} onClick={async()=>{setBusy(true);setError(false);try{const res=await fetch("/api/auth/logout",{method:"POST"});if(!res.ok)throw new Error();window.location.replace("/");}catch{setError(true);setBusy(false);}}}>Sair</Button>{error&&<p role="alert">Não foi possível sair. Tente novamente.</p>}</div>;}

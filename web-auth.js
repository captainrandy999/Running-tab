/* Running Tab web-only Google account authorization.
   Drive synchronization will be connected separately; this is the account gate.
   Never save Google access tokens in localStorage. OAuth client IDs are public.
   GitHub Pages is public hosting: this cannot hide source code or encrypt local data. */
(()=>{
  'use strict';
  const config=window.RunningTabWebAuthConfig||{};
  const clientId=String(config.clientId||'').trim();
  const isNative=!!window.RunningTabAndroid;
  const configured=/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId);
  const gate=document.getElementById('webAuthGate');
  const app=document.getElementById('runningTabApp');
  const accountBar=document.getElementById('webAccountBar');
  const signInButton=document.getElementById('webGoogleSignIn');
  const offlineButton=document.getElementById('webOfflineContinue');
  const signOutButton=document.getElementById('webGoogleSignOut');
  const reconnectButton=document.getElementById('webGoogleReconnect');
  const gateStatus=document.getElementById('webAuthStatus');
  const accountStatus=document.getElementById('webAccountStatus');
  const sessionKey='running-tab-google-trusted-session-v1';
  const ownerKey='running-tab-google-local-owner-v1';
  const trustFor=30*24*60*60*1000;
  const scope='openid email https://www.googleapis.com/auth/drive.appdata';
  let token=null, tokenExpires=0, user=null, oauth=null, authorized=false, gisReady=false;
  let trusted=null;
  function showError(message){
    if(gateStatus){gateStatus.textContent=message;gateStatus.style.color='#a3303c';}
  }
  function readJSON(key){
    try{return JSON.parse(localStorage.getItem(key)||'null');}catch(e){return null;}
  }
  function getOwner(){return readJSON(ownerKey);}
  function getTrusted(){
    const value=readJSON(sessionKey),owner=getOwner();
    return value&&owner&&value.sub===owner.sub&&typeof value.email==='string'
      &&Number.isFinite(value.until)&&value.until>Date.now()?value:null;
  }
  function identityLabel(){
    const active=user||trusted;
    return active?.email||'Google account';
  }
  function signedOut(){
    token=null;tokenExpires=0;user=null;trusted=null;authorized=false;
    try{localStorage.removeItem(sessionKey);}catch(e){}
    showGate('Signed out on this device. Your local entries remain stored here.');
    window.dispatchEvent(new CustomEvent('runningtab:google-auth-changed',{detail:{connected:false}}));
  }
  function showGate(message){
    gate.hidden=false;app.hidden=true;accountBar.hidden=true;
    offlineButton.hidden=!getTrusted();
    if(message&&gateStatus){gateStatus.textContent=message;gateStatus.style.color='';}
  }
  function showApp(connected){
    authorized=true;
    gate.hidden=true;app.hidden=false;accountBar.hidden=false;
    accountStatus.textContent=connected
      ?'Connected to Google: '+identityLabel()+' · Google Drive sync enabled'
      :(navigator.onLine===false?'Offline access: ':'Saved locally as: ')
        +identityLabel()+' · Reconnect Google to synchronize';
    reconnectButton.hidden=!!connected;
    window.dispatchEvent(new CustomEvent('runningtab:google-auth-changed',{
      detail:{connected:!!connected,email:identityLabel()}
    }));
  }
  function connectedToken(){return token&&Date.now()<tokenExpires?token:null;}
  async function acceptToken(response){
    if(!response||response.error||!response.access_token){
      showError('Google sign-in was not approved. '+(response?.error||'Please try again.'));
      return;
    }
    try{
      if(!response.scope||!response.scope.split(' ').includes('https://www.googleapis.com/auth/drive.appdata'))
        throw Error('Google Drive app-data permission was not granted.');
      const res=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{
        headers:{Authorization:'Bearer '+response.access_token},cache:'no-store'
      });
      if(!res.ok)throw Error('Google could not verify the selected account.');
      const profile=await res.json();
      if(!profile?.sub||!profile.email||profile.email_verified!==true)
        throw Error('Google did not return a verified account email.');
      const owner=getOwner();
      if(owner?.sub&&owner.sub!==profile.sub)
        throw Error('This browser already has Running Tab entries associated with a different Google account. Sign in with the original account to avoid mixing data.');
      // Only accept a subject verified by Google's HTTPS userinfo endpoint.
      localStorage.setItem(ownerKey,JSON.stringify({sub:profile.sub,email:profile.email}));
      localStorage.setItem(sessionKey,JSON.stringify({
        sub:profile.sub,email:profile.email,until:Date.now()+trustFor
      }));
      user={sub:profile.sub,email:profile.email};
      trusted=getTrusted();
      token=response.access_token;
      tokenExpires=Date.now()+Math.max(0,Number(response.expires_in||0)-60)*1000;
      showApp(true);
    }catch(error){
      token=null;tokenExpires=0;
      showError('Google sign-in could not finish: '+error.message);
    }
  }
  function initClient(){
    if(gisReady||!window.google?.accounts?.oauth2)return;
    try{
      oauth=window.google.accounts.oauth2.initTokenClient({
        client_id:clientId,
        scope,
        callback:acceptToken,
        error_callback:error=>showError(error?.type==='popup_closed'?
          'The Google sign-in window was closed. Nothing was changed.':
          'Google sign-in popup failed. Please allow popups and try again.')
      });
      gisReady=true;
      signInButton.disabled=false;
      reconnectButton.disabled=false;
      if(gateStatus&&gateStatus.textContent==='Preparing Google sign-in…')gateStatus.textContent='';
    }catch(error){showError('Google sign-in setup failed: '+error.message);}
  }
  function loadGIS(){
    if(window.google?.accounts?.oauth2){initClient();return;}
    const script=document.createElement('script');
    script.src='https://accounts.google.com/gsi/client';
    script.async=true;
    script.onload=initClient;
    script.onerror=()=>showError('Google sign-in could not load. If you are offline, choose Continue offline on this device.');
    document.head.appendChild(script);
  }
  function requestAccess(){
    if(!oauth){showError('Google sign-in is still loading. Try again in a moment.');return;}
    // Must be called synchronously from a user's click for popup permission.
    // A trusted device can ask Google to reuse its previously approved account.
    // This is still user-initiated and never persists or fakes a Drive token.
    oauth.requestAccessToken({prompt:getTrusted()?'':'select_account'});
  }
  window.RunningTabWebAuth=Object.freeze({
    isEnabled:configured&&!isNative,
    getAccessToken:connectedToken,
    // A verified previous session can identify the local sync baseline, but
    // only a live access token can access Google Drive.
    getAccount:()=>user?{...user}:authorized&&trusted?{sub:trusted.sub,email:trusted.email}:null,
    isUnlocked:()=>authorized
  });
  // Google blocks its browser sign-in flow inside Android WebViews. Android
  // instead authorizes with Play Services, and sends an access token only to
  // this trusted top-level Running Tab page (never localStorage).
  if(isNative&&typeof window.RunningTabAndroid?.connectGoogle==='function'){
    let nativeToken=null,nativeExpires=0,nativeAccount=null,generation=0;
    const nativeLink=document.querySelector('.web-sync-bar');
    accountBar.hidden=false;
    reconnectButton.hidden=false;
    reconnectButton.disabled=false;
    reconnectButton.textContent='Connect Google';
    signOutButton.hidden=true;
    function labelNative(message){
      accountStatus.textContent=message;
    }
    function identity(){return nativeAccount||getOwner();}
    function connected(){
      return nativeToken&&Date.now()<nativeExpires?nativeToken:null;
    }
    function dispatch(online){
      window.dispatchEvent(new CustomEvent('runningtab:google-auth-changed',{
        detail:{connected:!!online,email:identity()?.email||''}
      }));
    }
    window.RunningTabWebAuth=Object.freeze({
      isEnabled:true,
      getAccessToken:connected,
      getAccount:()=>identity()?{...identity()}:null,
      isUnlocked:()=>true
    });
    window.RunningTabNativeAuth=Object.freeze({
      onStatus:message=>{
        const text=String(message||'');
        if(!connected())labelNative(text||'Not connected to Google Drive · Local entries are safe');
      },
      onToken:async accessToken=>{
        const nonce=++generation;
        const value=String(accessToken||'');
        if(!value){labelNative('No Google access token was returned. Tap Connect Google.');return;}
        try{
          const result=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{
            headers:{Authorization:'Bearer '+value},cache:'no-store'
          });
          if(!result.ok)throw Error('Google could not verify this account (HTTP '+result.status+').');
          const p=await result.json();
          if(nonce!==generation)return;
          if(!p||!p.sub||!p.email||p.email_verified!==true)
            throw Error('Google did not return a verified email address.');
          const owner=getOwner();
          if(owner?.sub&&owner.sub!==p.sub)
            throw Error('This Android app has entries linked to a different Google account. Use the original account to avoid mixing records.');
          localStorage.setItem(ownerKey,JSON.stringify({sub:p.sub,email:p.email}));
          nativeAccount={sub:p.sub,email:p.email};
          nativeToken=value;
          nativeExpires=Date.now()+50*60*1000;
          reconnectButton.textContent='Reconnect Google';
          reconnectButton.hidden=true;
          signOutButton.hidden=false;
          labelNative('Connected to Google: '+p.email);
          dispatch(true);
        }catch(error){
          if(nonce!==generation)return;
          nativeToken=null;nativeExpires=0;
          labelNative('Google Drive not connected: '+error.message);
          reconnectButton.hidden=false;
          dispatch(false);
        }
      },
      onDisconnected:message=>{
        generation++;nativeToken=null;nativeExpires=0;nativeAccount=null;
        reconnectButton.hidden=false;
        reconnectButton.textContent='Connect Google';
        signOutButton.hidden=true;
        labelNative(String(message||'Google Drive disconnected; entries remain on this device.'));
        dispatch(false);
      }
    });
    reconnectButton.addEventListener('click',()=>window.RunningTabAndroid.connectGoogle());
    signOutButton.textContent='Disconnect';
    signOutButton.addEventListener('click',()=>{
      if(confirm('Disconnect Google Drive on this device? Your locally saved entries will remain, but syncing stops until you reconnect.')){
        window.RunningTabAndroid.disconnectGoogle();
      }
    });
    // Returning online should obtain a fresh Google token silently if the
    // account was previously authorized; the user can continue working offline.
    window.addEventListener('online',()=>window.RunningTabAndroid.refreshGoogle());
    labelNative('Google Drive not connected · Entries saved on this device');
    document.documentElement.classList.remove('web-auth-pending');
    return;
  }
  if(isNative&&typeof window.RunningTabAndroid?.connectGoogle!=='function'){
    // Old APKs cannot authorize Google. Avoid showing a nonworking Sync now.
    document.querySelector('.web-sync-bar')?.setAttribute('hidden','');
  }
  if(isNative||!configured||!gate||!app||!accountBar){
    document.documentElement.classList.remove('web-auth-pending');
    return;
  }
  trusted=getTrusted();
  signInButton.addEventListener('click',requestAccess);
  reconnectButton.addEventListener('click',requestAccess);
  offlineButton.addEventListener('click',()=>{
    trusted=getTrusted();
    if(!trusted){showError('Sign in with Google online first to trust this device.');return;}
    showApp(false);
  });
  signOutButton.addEventListener('click',signedOut);
  window.addEventListener('online',()=>{
    if(authorized&&!connectedToken()){
      accountStatus.textContent='Online · Tap Reconnect Google to synchronize.';
      reconnectButton.hidden=false;
    }
  });
  if(trusted){
    // A successful Google login already trusted this browser for 30 days.
    // Reopen local entries directly on subsequent visits, online or offline.
    // Access to cloud data still requires a fresh, verified Google token.
    showApp(false);
    document.documentElement.classList.remove('web-auth-pending');
    if(navigator.onLine!==false)loadGIS();
  }else{
    showGate('Preparing Google sign-in…');
    document.documentElement.classList.remove('web-auth-pending');
    if(navigator.onLine!==false)loadGIS();
    else showError('You need to sign in online once before this device can be used offline.');
  }
})();
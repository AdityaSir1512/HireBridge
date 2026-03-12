(function(){
  const KEY = 'hb_token';
  function setToken(token){ localStorage.setItem(KEY, token); }
  function getToken(){ return localStorage.getItem(KEY); }
  function clearToken(){ localStorage.removeItem(KEY); }
  function isAuthenticated(){ return !!getToken(); }
  window.HB = window.HB || {};
  window.HB.auth = { setToken, getToken, clearToken, isAuthenticated };
})();

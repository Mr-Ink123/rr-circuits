// auth.js — localStorage-based user accounts with per-user saves and custom chips

const Auth = (() => {
  let currentUser = null;

  function _hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(36);
  }

  function _getUsers() {
    try { return JSON.parse(localStorage.getItem('rrc_users') || '{}'); } catch { return {}; }
  }

  function _setUsers(u) { localStorage.setItem('rrc_users', JSON.stringify(u)); }

  function init() {
    try {
      const s = localStorage.getItem('rrc_session');
      if (s) { currentUser = JSON.parse(s).u; return true; }
    } catch {}
    return false;
  }

  function register(username, password) {
    username = username.trim();
    if (!username || username.length < 2) return 'Username must be at least 2 characters';
    if (!password || password.length < 4) return 'Password must be at least 4 characters';
    const users = _getUsers();
    if (users[username]) return 'Username already taken';
    users[username] = {
      pw: _hash(password),
      saves: {},
      customChips: [],
      createdAt: Date.now(),
      lastLogin: Date.now(),
    };
    _setUsers(users);
    currentUser = username;
    localStorage.setItem('rrc_session', JSON.stringify({ u: username }));
    return null;
  }

  function login(username, password) {
    username = username.trim();
    const users = _getUsers();
    if (!users[username]) return 'Account not found';
    if (users[username].pw !== _hash(password)) return 'Incorrect password';
    users[username].lastLogin = Date.now();
    _setUsers(users);
    currentUser = username;
    localStorage.setItem('rrc_session', JSON.stringify({ u: username }));
    return null;
  }

  function logout() {
    currentUser = null;
    localStorage.removeItem('rrc_session');
  }

  function getUser() { return currentUser; }
  function isLoggedIn() { return currentUser !== null; }

  // ---- Saves ----
  function saveCircuit(circuitName, data) {
    if (!currentUser) return false;
    const users = _getUsers();
    if (!users[currentUser]) return false;
    if (!users[currentUser].saves) users[currentUser].saves = {};
    users[currentUser].saves[circuitName] = { ...data, name: circuitName, savedAt: Date.now() };
    _setUsers(users);
    return true;
  }

  function loadCircuit(circuitName) {
    if (!currentUser) return null;
    return _getUsers()[currentUser]?.saves?.[circuitName] || null;
  }

  function listCircuits() {
    if (!currentUser) return [];
    const saves = _getUsers()[currentUser]?.saves || {};
    return Object.values(saves)
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
      .map(s => ({ name: s.name, savedAt: s.savedAt, nodeCount: s.nodes?.length || 0 }));
  }

  function deleteCircuit(name) {
    if (!currentUser) return;
    const users = _getUsers();
    if (users[currentUser]?.saves) delete users[currentUser].saves[name];
    _setUsers(users);
  }

  // ---- Custom Chips ----
  function getCustomChips() {
    if (!currentUser) return [];
    return _getUsers()[currentUser]?.customChips || [];
  }

  function saveCustomChip(chipDef) {
    if (!currentUser) return;
    const users = _getUsers();
    if (!users[currentUser].customChips) users[currentUser].customChips = [];
    const idx = users[currentUser].customChips.findIndex(c => c.id === chipDef.id);
    if (idx >= 0) users[currentUser].customChips[idx] = chipDef;
    else users[currentUser].customChips.push(chipDef);
    _setUsers(users);
  }

  function deleteCustomChip(chipId) {
    if (!currentUser) return;
    const users = _getUsers();
    if (users[currentUser]?.customChips)
      users[currentUser].customChips = users[currentUser].customChips.filter(c => c.id !== chipId);
    _setUsers(users);
  }

  return {
    init, login, logout, register,
    getUser, isLoggedIn,
    saveCircuit, loadCircuit, listCircuits, deleteCircuit,
    getCustomChips, saveCustomChip, deleteCustomChip,
  };
})();

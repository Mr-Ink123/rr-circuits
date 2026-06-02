// boards.js — Multi-board management and custom chip builder

const Boards = (() => {
  let boards = [];          // [{ id, name, state }]
  let activeBoard = null;   // board id
  let nextBoardId = 1;

  // ---- Board CRUD ----
  function createBoard(name) {
    const id = 'board_' + nextBoardId++;
    const board = {
      id,
      name: name || 'Board ' + nextBoardId,
      state: { nodes: [], wires: [], nextId: 1, transform: { x: 60, y: 60, scale: 1 } },
    };
    boards.push(board);
    return board;
  }

  function init() {
    if (boards.length === 0) {
      const main = createBoard('Main');
      setActive(main.id);
    }
    renderTabs();
  }

  function setActive(boardId) {
    if (activeBoard === boardId) return;
    // Save current canvas state
    if (activeBoard) {
      const cur = boards.find(b => b.id === activeBoard);
      if (cur) cur.state = Canvas.getState();
    }
    activeBoard = boardId;
    const board = boards.find(b => b.id === boardId);
    if (board) Canvas.loadState(board.state);
    renderTabs();
  }

  function renameBoard(boardId, name) {
    const b = boards.find(b => b.id === boardId);
    if (b) { b.name = name; renderTabs(); }
  }

  function deleteBoard(boardId) {
    if (boards.length <= 1) { Canvas.showToast('Cannot delete last board'); return; }
    const idx = boards.findIndex(b => b.id === boardId);
    if (idx < 0) return;
    boards.splice(idx, 1);
    if (activeBoard === boardId) {
      setActive(boards[Math.max(0, idx - 1)].id);
    }
    renderTabs();
  }

  function duplicateBoard(boardId) {
    const src = boards.find(b => b.id === boardId);
    if (!src) return;
    const newB = createBoard(src.name + ' Copy');
    newB.state = JSON.parse(JSON.stringify(src.state));
    renderTabs();
    return newB;
  }

  // Save active board state
  function syncActive() {
    if (!activeBoard) return;
    const cur = boards.find(b => b.id === activeBoard);
    if (cur) cur.state = Canvas.getState();
  }

  // ---- Tabs UI ----
  function renderTabs() {
    const container = document.getElementById('boardTabs');
    if (!container) return;
    container.innerHTML = '';

    boards.forEach(board => {
      const tab = document.createElement('div');
      tab.className = 'board-tab' + (board.id === activeBoard ? ' active' : '');
      tab.dataset.boardId = board.id;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'board-tab-name';
      nameSpan.textContent = board.name;
      nameSpan.addEventListener('dblclick', e => {
        e.stopPropagation();
        nameSpan.contentEditable = 'true';
        nameSpan.focus();
        const range = document.createRange();
        range.selectNodeContents(nameSpan);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      });
      nameSpan.addEventListener('blur', () => {
        nameSpan.contentEditable = 'false';
        renameBoard(board.id, nameSpan.textContent.trim() || board.name);
      });
      nameSpan.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); nameSpan.blur(); }
        e.stopPropagation();
      });

      const closeBtn = document.createElement('span');
      closeBtn.className = 'board-tab-close';
      closeBtn.textContent = '✕';
      closeBtn.title = 'Delete board';
      closeBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm(`Delete board "${board.name}"?`)) deleteBoard(board.id);
      });

      tab.appendChild(nameSpan);
      tab.appendChild(closeBtn);
      tab.addEventListener('click', () => setActive(board.id));

      // Right-click context
      tab.addEventListener('contextmenu', e => {
        e.preventDefault();
        showBoardContext(e, board.id);
      });

      container.appendChild(tab);
    });

    // Add board button
    const addBtn = document.createElement('button');
    addBtn.className = 'board-add-btn';
    addBtn.textContent = '+ Board';
    addBtn.title = 'Add new board';
    addBtn.addEventListener('click', () => {
      const b = createBoard('Board ' + boards.length);
      setActive(b.id);
    });
    container.appendChild(addBtn);
  }

  function showBoardContext(e, boardId) {
    const menu = document.getElementById('boardContextMenu');
    if (!menu) return;
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.style.display = 'block';
    menu.dataset.boardId = boardId;
  }

  // ---- Custom Chip Builder ----
  function openCustomChipBuilder(fromBoardId) {
    const modal = document.getElementById('customChipModal');
    if (!modal) return;

    // Reset form
    document.getElementById('ccName').value = 'My Chip';
    document.getElementById('ccCategory').value = 'Custom';
    document.getElementById('ccColor').value = '#FF44FF';
    document.getElementById('ccDesc').value = '';
    document.getElementById('ccInputsList').innerHTML = '';
    document.getElementById('ccOutputsList').innerHTML = '';
    modal.dataset.fromBoard = fromBoardId || '';
    addCCPort('input',  'Run',    'exec');
    addCCPort('output', 'Out',    'exec');
    modal.style.display = 'flex';
  }

  function addCCPort(side, name = 'Port', type = 'any') {
    const container = document.getElementById(`cc${side === 'input' ? 'Inputs' : 'Outputs'}List`);
    const row = document.createElement('div');
    row.className = 'cc-port-row';
    row.innerHTML = `
      <input class="cc-port-name" type="text" value="${name}" placeholder="Port name">
      <select class="cc-port-type">
        ${Object.keys(PORT_TYPES).map(t =>
          `<option value="${t}" ${t === type ? 'selected' : ''}>${t}</option>`
        ).join('')}
      </select>
      <button class="cc-port-del" title="Remove">✕</button>
    `;
    row.querySelector('.cc-port-del').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  function saveCustomChip() {
    const name = document.getElementById('ccName').value.trim();
    if (!name) { Canvas.showToast('Chip name required'); return; }
    const category = document.getElementById('ccCategory').value.trim() || 'Custom';
    const color = document.getElementById('ccColor').value;

    const inputs = [...document.querySelectorAll('#ccInputsList .cc-port-row')].map(r => ({
      name: r.querySelector('.cc-port-name').value.trim() || 'Port',
      type: r.querySelector('.cc-port-type').value,
    }));
    const outputs = [...document.querySelectorAll('#ccOutputsList .cc-port-row')].map(r => ({
      name: r.querySelector('.cc-port-name').value.trim() || 'Port',
      type: r.querySelector('.cc-port-type').value,
    }));

    const chipId = 'custom_' + name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    const chipDef = {
      id: chipId, name, category,
      inputs, outputs,
      isCustom: true,
      customColor: color,
    };

    // Register in runtime chip map
    registerCustomChip(chipDef);

    // If category doesn't exist, add it
    if (!CATEGORIES[category]) {
      CATEGORIES[category] = { color, icon: '★', order: 99 };
    }

    // Save to user account
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      Auth.saveCustomChip(chipDef);
    }

    document.getElementById('customChipModal').style.display = 'none';
    Canvas.showToast(`Custom chip "${name}" created!`);

    // Rebuild sidebar
    if (typeof App !== 'undefined') App.rebuildSidebar();
  }

  // ---- Serialization ----
  function getProjectData() {
    syncActive();
    return {
      boards: JSON.parse(JSON.stringify(boards)),
      activeBoard,
      nextBoardId,
    };
  }

  function loadProjectData(data) {
    if (!data || !data.boards) return false;
    boards = data.boards;
    nextBoardId = data.nextBoardId || boards.length + 1;
    activeBoard = null;
    renderTabs();
    const toActivate = data.activeBoard || boards[0]?.id;
    if (toActivate) setActive(toActivate);
    return true;
  }

  function getBoards() { return boards; }
  function getActiveBoard() { return boards.find(b => b.id === activeBoard); }

  return {
    init, createBoard, setActive, renameBoard, deleteBoard,
    duplicateBoard, syncActive, renderTabs, openCustomChipBuilder,
    addCCPort, saveCustomChip, getProjectData, loadProjectData,
    getBoards, getActiveBoard,
  };
})();

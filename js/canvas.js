// canvas.js — Pan, zoom, chip placement, wiring, undo/redo

const Canvas = (() => {
  let transform = { x: 80, y: 60, scale: 1 };
  let nodes   = [];   // { id, chipId, x, y, defaults:{}, varName?, label? }
  let wires   = [];   // { id, fromNode, fromPort, toNode, toPort, type }
  let selected = new Set();
  let selWire  = null;
  let tool     = 'select';
  let nextId   = 1;
  let settings = { snap: true, gridSize: 16, wireStyle: 'bezier', showFps: true };
  let clipboard = [];
  let undoStack = [], redoStack = [];

  // Drag state
  let isDragging = false, dragOffsets = [];
  // Pan state
  let isPanning = false, panStart = null;
  // Wire drawing state
  let wireStart = null;
  // Selection box state
  let isSelecting = false, selStart = null;

  let canvasArea, canvasTransform, svgLayer, svgOverlay, chipsLayer, tempWire, selBox;

  let fpsFrames = 0, fpsLast = performance.now();

  // ── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    canvasArea      = document.getElementById('canvasArea');
    canvasTransform = document.getElementById('canvasTransform');
    svgLayer        = document.getElementById('svgLayer');
    svgOverlay      = document.getElementById('svgOverlay');
    chipsLayer      = document.getElementById('chipsLayer');
    tempWire        = document.getElementById('tempWire');
    selBox          = document.getElementById('selBox');

    canvasArea.addEventListener('mousedown',   onCanvasDown);
    canvasArea.addEventListener('mousemove',   onCanvasMove);
    canvasArea.addEventListener('contextmenu', onCtxMenu);
    canvasArea.addEventListener('dblclick',    onDblClick);
    canvasArea.addEventListener('wheel',       onWheel, { passive: false });
    canvasArea.addEventListener('dragover',    e => e.preventDefault());
    canvasArea.addEventListener('drop',        onDrop);

    document.addEventListener('mousemove', onGlobalMove);
    document.addEventListener('mouseup',   onGlobalUp);
    document.addEventListener('keydown',   onKeyDown);
    document.addEventListener('keyup',     onKeyUp);

    document.getElementById('zoomIn').addEventListener('click',    () => zoom(1.2, null));
    document.getElementById('zoomOut').addEventListener('click',   () => zoom(0.8, null));
    document.getElementById('zoomReset').addEventListener('click', resetView);
    document.getElementById('frameAllBtn')?.addEventListener('click', () => frameNodes(nodes.map(n=>n.id)));
    document.getElementById('undoBtn')?.addEventListener('click', undo);
    document.getElementById('redoBtn')?.addEventListener('click', redo);

    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setTool(btn.dataset.tool);
      });
    });

    requestAnimationFrame(fpsLoop);
    applyTransform();
  }

  function fpsLoop() {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsLast >= 1000) {
      const fps = Math.round(fpsFrames * 1000 / (now - fpsLast));
      fpsFrames = 0; fpsLast = now;
      if (settings.showFps) {
        const el = document.getElementById('fpsDisplay');
        if (el) el.textContent = 'FPS ' + fps;
      }
    }
    requestAnimationFrame(fpsLoop);
  }

  // ── TRANSFORM ─────────────────────────────────────────────────────────────
  function applyTransform() {
    canvasTransform.style.transform =
      `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`;
    const el = document.getElementById('zoomDisplay');
    if (el) el.textContent = Math.round(transform.scale * 100) + '%';
  }

  function zoom(factor, center) {
    const rect = canvasArea.getBoundingClientRect();
    const cx = center ? center.x - rect.left : rect.width  / 2;
    const cy = center ? center.y - rect.top  : rect.height / 2;
    const ns = Math.max(0.1, Math.min(4, transform.scale * factor));
    const d  = ns / transform.scale;
    transform.x = cx - d * (cx - transform.x);
    transform.y = cy - d * (cy - transform.y);
    transform.scale = ns;
    applyTransform();
  }

  function resetView() {
    transform = { x: 80, y: 60, scale: 1 };
    applyTransform();
  }

  function screenToCanvas(sx, sy) {
    const r = canvasArea.getBoundingClientRect();
    return { x: (sx - r.left - transform.x) / transform.scale,
             y: (sy - r.top  - transform.y) / transform.scale };
  }

  function canvasToScreen(cx, cy) {
    const r = canvasArea.getBoundingClientRect();
    return { x: cx * transform.scale + transform.x + r.left,
             y: cy * transform.scale + transform.y + r.top };
  }

  function snap(v) {
    if (!settings.snap) return v;
    return Math.round(v / settings.gridSize) * settings.gridSize;
  }

  // ── TOOL ──────────────────────────────────────────────────────────────────
  function setTool(t) {
    tool = t;
    canvasArea.className = 'canvas-area';
    if (t === 'pan')    canvasArea.classList.add('pan-mode');
    if (t === 'delete') canvasArea.classList.add('delete-mode');
  }

  let spaceHeld = false;
  function onKeyDown(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.code === 'Space') { e.preventDefault(); spaceHeld = true; canvasArea.classList.add('pan-mode'); }
    if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    if (e.ctrlKey && e.key === 'z') undo();
    if (e.ctrlKey && e.key === 'y') redo();
    if (e.ctrlKey && e.key === 'c') copySelected();
    if (e.ctrlKey && e.key === 'v') paste();
    if (e.ctrlKey && e.key === 'a') { e.preventDefault(); selectAll(); }
    if (e.ctrlKey && e.key === 'd') { e.preventDefault(); duplicateSelected(); }
    if (e.key === 'f' || e.key === 'F') frameNodes([...selected]);
    if (e.key === 'a' || e.key === 'A') frameNodes(nodes.map(n=>n.id));
    if (e.key === 'v') activateTool('select');
  }
  function onKeyUp(e) {
    if (e.code === 'Space') {
      spaceHeld = false;
      if (tool !== 'pan') canvasArea.classList.remove('pan-mode');
    }
  }

  function activateTool(t) {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
    const b = document.querySelector(`.tool-btn[data-tool="${t}"]`);
    if (b) b.classList.add('active');
    setTool(t);
  }

  // ── MOUSE EVENTS ──────────────────────────────────────────────────────────
  function onCanvasDown(e) {
    if (e.button !== 0) return;
    hideCtxMenu();
    const onBg = e.target === canvasArea || e.target === canvasTransform || e.target === svgLayer;

    if (spaceHeld || tool === 'pan') { startPan(e); return; }
    if (onBg && tool === 'select') { clearSelection(); startSelBox(e); }
    if (onBg && tool === 'frame')  { clearSelection(); startSelBox(e); }
  }

  function onCanvasMove(e) {
    const cp = screenToCanvas(e.clientX, e.clientY);
    const el = document.getElementById('coordsDisplay');
    if (el) el.textContent = `X ${Math.round(cp.x)} / Y ${Math.round(cp.y)}`;
  }

  function onGlobalMove(e) {
    if (isPanning) {
      transform.x = panStart.tx + (e.clientX - panStart.mx);
      transform.y = panStart.ty + (e.clientY - panStart.my);
      applyTransform();
    }
    if (isDragging) updateDrag(e);
    if (isSelecting) updateSelBox(e);
    if (wireStart)   updateTempWire(e);
  }

  function onGlobalUp(e) {
    if (isPanning)   { isPanning = false; if (tool !== 'pan') canvasArea.classList.remove('panning'); panStart = null; }
    if (isDragging)  finishDrag();
    if (isSelecting) finishSelBox(e);

    if (!wireStart) return;

    // ── Wire-drop: was mouse released over any port row? ─────────────────────
    // We use data-* attributes stored on the row so we never depend on event
    // bubbling being stopped/intercepted by child elements.
    const portRow = e.target.closest('[data-port-idx]');   // more specific selector
    if (portRow) {
      const nodeId  = portRow.dataset.nodeId;
      const portIdx = parseInt(portRow.dataset.portIdx);
      const isOut   = portRow.dataset.isOutput === '1';

      if (nodeId && !isNaN(portIdx) && wireStart.isOutput !== isOut) {
        completeWire(nodeId, portIdx, isOut);
        return;
      }
    }
    // Released elsewhere → cancel the wire
    cancelWire();
  }

  function onWheel(e) {
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1.1 : 0.9, { x: e.clientX, y: e.clientY });
  }

  function onDrop(e) {
    e.preventDefault();
    const chipId = e.dataTransfer.getData('chipId');
    if (!chipId) return;
    const cp = screenToCanvas(e.clientX, e.clientY);
    pushUndo();
    const node = addNode(chipId, snap(cp.x - 70), snap(cp.y - 20));
    if (node) { clearSelection(); selectNode(node.id, false); updateInspector(); }
  }

  function onDblClick(e) {
    const chipEl = e.target.closest('.chip-node');
    if (chipEl) { selectNode(chipEl.dataset.id, false); updateInspector(); }
  }

  function onCtxMenu(e) {
    e.preventDefault();
    const chipEl = e.target.closest('.chip-node');
    if (chipEl) {
      const menu = document.getElementById('contextMenu');
      menu.style.left = e.clientX + 'px';
      menu.style.top  = e.clientY + 'px';
      menu.style.display = 'block';
      menu.dataset.nodeId = chipEl.dataset.id;
    }
  }

  function hideCtxMenu() {
    document.getElementById('contextMenu').style.display = 'none';
    document.getElementById('boardContextMenu').style.display = 'none';
  }
  document.addEventListener('click', hideCtxMenu);
  document.getElementById('contextMenu')?.addEventListener('click', e => {
    const action = e.target.dataset.action;
    const nodeId = document.getElementById('contextMenu').dataset.nodeId;
    if (!action) return;
    if (action === 'delete')        deleteNode(nodeId);
    if (action === 'duplicate')     duplicateNode(nodeId);
    if (action === 'copy')          { clipboard = [cloneNode(nodeId)]; showToast('Copied!'); }
    if (action === 'select_wired')  selectWired(nodeId);
    hideCtxMenu();
  });

  // ── PAN ───────────────────────────────────────────────────────────────────
  function startPan(e) {
    isPanning = true;
    panStart  = { mx: e.clientX, my: e.clientY, tx: transform.x, ty: transform.y };
    canvasArea.classList.add('panning');
  }

  // ── SELECTION BOX ─────────────────────────────────────────────────────────
  function startSelBox(e) {
    isSelecting = true;
    const r = canvasArea.getBoundingClientRect();
    selStart = { x: e.clientX - r.left, y: e.clientY - r.top };
    selBox.style.cssText = `display:block;left:${selStart.x}px;top:${selStart.y}px;width:0;height:0`;
  }

  function updateSelBox(e) {
    const r  = canvasArea.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const x = Math.min(cx, selStart.x), y = Math.min(cy, selStart.y);
    const w = Math.abs(cx - selStart.x), h = Math.abs(cy - selStart.y);
    selBox.style.left = x + 'px'; selBox.style.top = y + 'px';
    selBox.style.width = w + 'px'; selBox.style.height = h + 'px';
    nodes.forEach(n => {
      const ns = canvasToScreen(n.x, n.y);
      const el = document.getElementById('cn-' + n.id);
      if (!el) return;
      const nw = el.offsetWidth * transform.scale;
      const nh = el.offsetHeight * transform.scale;
      const hit = ns.x < x + w && ns.x + nw > x && ns.y < y + h && ns.y + nh > y;
      if (hit) { selected.add(n.id); el.classList.add('selected'); }
      else      { selected.delete(n.id); el.classList.remove('selected'); }
    });
    updateSelInfo();
  }

  function finishSelBox() {
    isSelecting = false;
    selBox.style.display = 'none';
    updateInspector();
  }

  // ── NODE MANAGEMENT ───────────────────────────────────────────────────────
  function addNode(chipId, x, y) {
    const def = getChipDef(chipId);
    if (!def) return null;
    const id   = 'n' + nextId++;
    const node = {
      id, chipId, x, y,
      defaults: {},
      varName: def.isVariable ? (def.name.replace(' Variable','') || 'MyVar') : undefined,
    };
    nodes.push(node);
    renderNode(node);
    return node;
  }

  function deleteNode(nodeId) {
    pushUndo();
    wires = wires.filter(w => {
      if (w.fromNode === nodeId || w.toNode === nodeId) { removeWireEl(w.id); return false; }
      return true;
    });
    document.getElementById('cn-' + nodeId)?.remove();
    nodes = nodes.filter(n => n.id !== nodeId);
    selected.delete(nodeId);
    updateInspector();
  }

  function duplicateNode(nodeId) {
    const src = nodes.find(n => n.id === nodeId);
    if (!src) return;
    pushUndo();
    const n = addNode(src.chipId, src.x + 24, src.y + 24);
    if (n) { n.defaults = { ...src.defaults }; n.varName = src.varName; }
    return n;
  }

  function cloneNode(nodeId) { return JSON.parse(JSON.stringify(nodes.find(n=>n.id===nodeId))); }

  function deleteSelected() {
    if (selWire) { pushUndo(); removeWire(selWire); selWire = null; return; }
    if (!selected.size) return;
    pushUndo();
    [...selected].forEach(deleteNode);
    selected.clear();
    updateInspector();
  }

  function selectAll() {
    nodes.forEach(n => { selected.add(n.id); document.getElementById('cn-'+n.id)?.classList.add('selected'); });
    updateSelInfo(); updateInspector();
  }

  function clearSelection() {
    selected.forEach(id => document.getElementById('cn-'+id)?.classList.remove('selected'));
    selected.clear();
    if (selWire) {
      document.querySelector(`[data-wid="${selWire}"]`)?.classList.remove('selected');
      selWire = null;
    }
    updateSelInfo(); updateInspector();
  }

  function selectNode(id, multi) {
    if (!multi) clearSelection();
    selected.add(id);
    document.getElementById('cn-' + id)?.classList.add('selected');
    updateSelInfo();
  }

  function selectWired(nodeId) {
    wires.forEach(w => {
      if (w.fromNode === nodeId) { selected.add(w.toNode); document.getElementById('cn-'+w.toNode)?.classList.add('selected'); }
      if (w.toNode   === nodeId) { selected.add(w.fromNode); document.getElementById('cn-'+w.fromNode)?.classList.add('selected'); }
    });
    updateSelInfo();
  }

  function updateSelInfo() {
    const el = document.getElementById('selInfo');
    if (el) el.textContent = selected.size > 0 ? `${selected.size} selected` : '';
  }

  function frameNodes(ids) {
    if (!ids.length) return;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    ids.forEach(id => {
      const n = nodes.find(x=>x.id===id); if(!n) return;
      const el = document.getElementById('cn-'+id);
      const w = el?.offsetWidth || 160, h = el?.offsetHeight || 100;
      minX=Math.min(minX,n.x); minY=Math.min(minY,n.y);
      maxX=Math.max(maxX,n.x+w); maxY=Math.max(maxY,n.y+h);
    });
    if (!isFinite(minX)) return;
    const r = canvasArea.getBoundingClientRect();
    const pad = 60;
    const sc = Math.min((r.width-pad*2)/Math.max(maxX-minX,1),(r.height-pad*2)/Math.max(maxY-minY,1),2);
    transform.scale = sc;
    transform.x = pad - minX*sc + ((r.width -pad*2)-(maxX-minX)*sc)/2;
    transform.y = pad - minY*sc + ((r.height-pad*2)-(maxY-minY)*sc)/2;
    applyTransform();
  }

  // ── COPY / PASTE ──────────────────────────────────────────────────────────
  function copySelected() {
    if (!selected.size) return;
    clipboard = [...selected].map(id => cloneNode(id)).filter(Boolean);
    clipboard._wires = wires.filter(w => selected.has(w.fromNode) && selected.has(w.toNode))
                             .map(w => JSON.parse(JSON.stringify(w)));
    showToast(`Copied ${clipboard.length} chip(s)`);
  }

  function paste() {
    if (!clipboard.length) return;
    pushUndo(); clearSelection();
    const map = {};
    clipboard.forEach(n => {
      const nn = addNode(n.chipId, n.x+24, n.y+24);
      if (nn) { map[n.id]=nn.id; nn.defaults={...n.defaults}; nn.varName=n.varName; selectNode(nn.id,true); }
    });
    (clipboard._wires||[]).forEach(w => {
      if (map[w.fromNode] && map[w.toNode]) addWire(map[w.fromNode],w.fromPort,map[w.toNode],w.toPort,w.type);
    });
  }

  function duplicateSelected() {
    copySelected();
    paste();
  }

  // ── UNDO / REDO ───────────────────────────────────────────────────────────
  function pushUndo() {
    undoStack.push(getState());
    if (undoStack.length > 60) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (!undoStack.length) { showToast('Nothing to undo'); return; }
    redoStack.push(getState());
    _restoreState(undoStack.pop());
  }

  function redo() {
    if (!redoStack.length) { showToast('Nothing to redo'); return; }
    undoStack.push(getState());
    _restoreState(redoStack.pop());
  }

  // ── DRAG ──────────────────────────────────────────────────────────────────
  function startDrag(e, nodeId) {
    if (e.button !== 0) return;
    if (!selected.has(nodeId)) selectNode(nodeId, e.ctrlKey || e.shiftKey);
    isDragging = true;
    const cp = screenToCanvas(e.clientX, e.clientY);
    dragOffsets = [...selected].map(id => {
      const n = nodes.find(x=>x.id===id);
      return n ? { id, dx: n.x - cp.x, dy: n.y - cp.y } : null;
    }).filter(Boolean);
    document.getElementById('cn-'+nodeId)?.classList.add('dragging');
  }

  function updateDrag(e) {
    const cp = screenToCanvas(e.clientX, e.clientY);
    dragOffsets.forEach(({ id, dx, dy }) => {
      const n = nodes.find(x=>x.id===id); if(!n) return;
      n.x = snap(cp.x + dx); n.y = snap(cp.y + dy);
      const el = document.getElementById('cn-'+id);
      if (el) { el.style.left = n.x+'px'; el.style.top = n.y+'px'; }
    });
    redrawWires();
  }

  function finishDrag() {
    isDragging = false;
    dragOffsets.forEach(({id}) => document.getElementById('cn-'+id)?.classList.remove('dragging'));
    dragOffsets = [];
    redrawWires();
  }

  // ── WIRING ────────────────────────────────────────────────────────────────
  function startWire(e, nodeId, portIdx, isOutput, portEl) {
    e.stopPropagation(); e.preventDefault();
    wireStart = { nodeId, portIdx, isOutput, portEl };
    tempWire.setAttribute('visibility','visible');
    highlightPorts(nodeId, portIdx, isOutput);
  }

  function cancelWire() {
    wireStart = null;
    tempWire.setAttribute('visibility','hidden');
    clearPortHighlights();
  }

  function completeWire(toNodeId, toPortIdx, toIsOutput) {
    if (!wireStart) return;
    const from = wireStart;
    cancelWire();
    if (from.isOutput === toIsOutput) return;

    const outNode = from.isOutput ? from.nodeId : toNodeId;
    const outPort = from.isOutput ? from.portIdx : toPortIdx;
    const inNode  = from.isOutput ? toNodeId : from.nodeId;
    const inPort  = from.isOutput ? toPortIdx : from.portIdx;

    const outDef = getChipDef(nodes.find(n=>n.id===outNode)?.chipId);
    const inDef  = getChipDef(nodes.find(n=>n.id===inNode)?.chipId);
    if (!outDef || !inDef) return;

    const outType = outDef.outputs[outPort]?.type || 'any';
    const inType  = inDef.inputs[inPort]?.type || 'any';
    if (!compatible(outType, inType)) return;

    // Exec ports allow multiple incoming wires (fan-in) — several outputs can
    // all trigger the same exec input, just like in Rec Room CV2.
    // Data ports (number, bool, string, etc.) keep single-input: replace old wire.
    if (inType !== 'exec') {
      wires = wires.filter(w => {
        if (w.toNode===inNode && w.toPort===inPort) { removeWireEl(w.id); return false; }
        return true;
      });
    }
    pushUndo();
    addWire(outNode, outPort, inNode, inPort, outType);
  }

  function compatible(a, b) {
    if (a==='any' || b==='any') return true;
    if ((a==='int'||a==='float'||a==='number') && (b==='int'||b==='float'||b==='number')) return true;
    return a === b;
  }

  function addWire(fromNode, fromPort, toNode, toPort, type) {
    const id = 'w' + nextId++;
    const w  = { id, fromNode, fromPort, toNode, toPort, type };
    wires.push(w);
    setTimeout(() => { drawWire(w); updatePortConn(fromNode,fromPort,true,true); updatePortConn(toNode,toPort,false,true); }, 0);
    return w;
  }

  function removeWire(wireId) {
    const w = wires.find(x=>x.id===wireId); if(!w) return;
    wires = wires.filter(x=>x.id!==wireId);
    removeWireEl(wireId);
    updatePortConn(w.fromNode,w.fromPort,true, wires.some(x=>x.fromNode===w.fromNode&&x.fromPort===w.fromPort));
    updatePortConn(w.toNode,  w.toPort,  false,wires.some(x=>x.toNode===w.toNode&&x.toPort===w.toPort));
  }

  function removeWireEl(id) { document.querySelector(`[data-wid="${id}"]`)?.remove(); }

  function updatePortConn(nodeId, portIdx, isOutput, connected) {
    const el = getPortEl(nodeId, portIdx, isOutput);
    el?.querySelector('.port-inner')?.classList.toggle('connected', connected);
  }

  function highlightPorts(srcNode, srcPort, isOutput) {
    const srcDef = getChipDef(nodes.find(n=>n.id===srcNode)?.chipId);
    if (!srcDef) return;
    const srcType = isOutput ? srcDef.outputs[srcPort]?.type : srcDef.inputs[srcPort]?.type;
    nodes.forEach(n => {
      if (n.id === srcNode) return;
      const def = getChipDef(n.chipId); if(!def) return;
      const ports = isOutput ? def.inputs : def.outputs;
      ports.forEach((p, idx) => {
        if (compatible(srcType, p.type)) {
          const el = getPortEl(n.id, idx, !isOutput);
          el?.classList.add('compatible');
        }
      });
    });
  }

  function clearPortHighlights() {
    document.querySelectorAll('.port.compatible').forEach(el => el.classList.remove('compatible'));
  }

  // ── PORT HELPERS ──────────────────────────────────────────────────────────
  function getPortEl(nodeId, portIdx, isOutput) {
    const nEl = document.getElementById('cn-'+nodeId); if(!nEl) return null;
    const ports = nEl.querySelectorAll((isOutput?'.chip-outputs':'.chip-inputs') + ' .port');
    return ports[portIdx] || null;
  }

  function getPortPos(nodeId, portIdx, isOutput) {
    const el = getPortEl(nodeId, portIdx, isOutput); if(!el) return null;
    const r  = el.getBoundingClientRect();
    const cp = screenToCanvas(r.left + r.width/2, r.top + r.height/2);
    // SVG layer is positioned at top:-5000 left:-5000 inside canvas-transform.
    // Its coordinate origin (0,0) = canvas-world (-5000,-5000).
    // So to draw at canvas-world (x,y) we need SVG coords (x+5000, y+5000).
    return { x: cp.x + 5000, y: cp.y + 5000 };
  }

  // ── WIRE DRAWING ──────────────────────────────────────────────────────────
  function drawWire(w) {
    const fp = getPortPos(w.fromNode, w.fromPort, true);
    const tp = getPortPos(w.toNode,   w.toPort,   false);
    if (!fp || !tp) return;

    const pt  = getPortType(w.type);
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('class', `wire-path ${pt.wireCls}`);
    path.setAttribute('data-wid', w.id);
    path.setAttribute('d', pathD(fp, tp));
    path.addEventListener('click', e => {
      e.stopPropagation();
      clearSelection();
      selWire = w.id;
      path.classList.add('selected');
    });
    path.addEventListener('dblclick', e => { e.stopPropagation(); removeWire(w.id); });
    svgLayer.appendChild(path);
  }

  function pathD(from, to) {
    const dx = Math.max(Math.abs(to.x - from.x) * 0.45, 40);
    if (settings.wireStyle === 'straight') return `M${from.x} ${from.y} L${to.x} ${to.y}`;
    if (settings.wireStyle === 'stepped') {
      const mx = (from.x + to.x) / 2;
      return `M${from.x} ${from.y} L${mx} ${from.y} L${mx} ${to.y} L${to.x} ${to.y}`;
    }
    return `M${from.x} ${from.y} C${from.x+dx} ${from.y} ${to.x-dx} ${to.y} ${to.x} ${to.y}`;
  }

  function redrawWires() {
    wires.forEach(w => {
      const el = document.querySelector(`[data-wid="${w.id}"]`);
      const fp = getPortPos(w.fromNode, w.fromPort, true);
      const tp = getPortPos(w.toNode,   w.toPort,   false);
      if (!fp || !tp) return;
      if (!el) { drawWire(w); return; }
      el.setAttribute('d', pathD(fp, tp));
    });
  }

  function updateTempWire(e) {
    if (!wireStart) return;
    const pEl = wireStart.portEl;
    const pr  = pEl.getBoundingClientRect();
    const cr  = canvasArea.getBoundingClientRect();
    const sx  = pr.left + pr.width/2  - cr.left;
    const sy  = pr.top  + pr.height/2 - cr.top;
    const ex  = e.clientX - cr.left;
    const ey  = e.clientY - cr.top;
    const dx  = Math.max(Math.abs(ex-sx)*0.45, 30);

    const def = getChipDef(nodes.find(n=>n.id===wireStart.nodeId)?.chipId);
    const t   = wireStart.isOutput ? def?.outputs[wireStart.portIdx]?.type : def?.inputs[wireStart.portIdx]?.type;
    const pt  = getPortType(t || 'any');
    tempWire.setAttribute('stroke', pt.color);

    const d = wireStart.isOutput
      ? `M${sx} ${sy} C${sx+dx} ${sy} ${ex-dx} ${ey} ${ex} ${ey}`
      : `M${ex} ${ey} C${ex+dx} ${ey} ${sx-dx} ${sy} ${sx} ${sy}`;
    tempWire.setAttribute('d', d);
  }

  // ── NODE RENDERING ────────────────────────────────────────────────────────
  function renderNode(node) {
    const def = getChipDef(node.chipId); if(!def) return;
    const cat = CATEGORIES[def.category] || { color:'#778899', icon:'?' };

    const el = document.createElement('div');
    el.className = 'chip-node';
    el.id = 'cn-' + node.id;
    el.dataset.id = node.id;
    el.style.left = node.x + 'px';
    el.style.top  = node.y + 'px';

    // Left color bar via box-shadow on header
    const color = def.customColor || cat.color;

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'chip-hdr';
    hdr.style.borderLeft = `3px solid ${color}`;

    const bar = document.createElement('div');
    bar.className = 'chip-hdr-bar';
    bar.style.display = 'none'; // using border-left instead

    const nameSpan = document.createElement('span');
    nameSpan.className = 'chip-hdr-name';
    nameSpan.textContent = def.name;

    hdr.appendChild(nameSpan);

    // Cloud/Synced badge
    if (def.isCloud)  { const b=document.createElement('span'); b.className='chip-hdr-badge'; b.style.background='rgba(0,200,255,0.15)'; b.style.color='#00CCFF'; b.textContent='☁ CLOUD'; hdr.appendChild(b); }
    if (def.isSynced) { const b=document.createElement('span'); b.className='chip-hdr-badge'; b.style.background='rgba(170,100,255,0.15)'; b.style.color='#AA66FF'; b.textContent='🔄 SYNCED'; hdr.appendChild(b); }
    if (def.isCustom) { const b=document.createElement('span'); b.className='chip-hdr-badge'; b.style.background='rgba(255,68,255,0.15)'; b.style.color='#FF44FF'; b.textContent='★'; hdr.appendChild(b); }

    el.appendChild(hdr);

    // Variable name + scope selector (Local / Cloud / Synced)
    if (def.isVariable) {
      // Name row
      const vrow = document.createElement('div');
      vrow.className = 'chip-varname-row';
      const vicon = document.createElement('span');
      vicon.textContent = '✎';
      vicon.style.cssText = 'font-size:10px;color:var(--text3);flex-shrink:0;padding-right:2px';
      const vinput = document.createElement('input');
      vinput.className = 'chip-varname-input';
      vinput.value = node.varName || 'MyVar';
      vinput.placeholder = 'name...';
      vinput.addEventListener('change', e => { node.varName = e.target.value.trim() || 'MyVar'; });
      vinput.addEventListener('mousedown', e => e.stopPropagation());
      vinput.addEventListener('click',     e => e.stopPropagation());
      vrow.appendChild(vicon);
      vrow.appendChild(vinput);
      el.appendChild(vrow);

      // Scope: Local / ☁ Cloud / 🔄 Synced  — exactly one can be selected
      const scopeRow = document.createElement('div');
      scopeRow.className = 'chip-var-scope';

      const scopeId = 'scope-' + node.id;
      const curScope = node.isCloud ? 'cloud' : node.isSynced ? 'synced' : 'local';

      const scopeOpts = [
        { val: 'local',  label: 'Local',      color: '#778899',
          tip: 'Only on this machine. No networking.' },
        { val: 'cloud',  label: '☁ Cloud',    color: '#00CCFF',
          tip: 'Saved to cloud permanently. Survives room restarts.' },
        { val: 'synced', label: '🔄 30Hz',     color: '#AA66FF',
          tip: 'Synced to ALL players in real-time at ~30Hz. Resets when room resets.' },
      ];

      scopeOpts.forEach(opt => {
        const lbl = document.createElement('label');
        lbl.className = 'scope-opt';
        lbl.style.color = opt.color;
        lbl.title = opt.tip || '';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = scopeId;
        radio.value = opt.val;
        radio.checked = (curScope === opt.val);

        radio.addEventListener('change', () => {
          node.isCloud  = (opt.val === 'cloud');
          node.isSynced = (opt.val === 'synced');
          // update header badge
          const badge = el.querySelector('.chip-hdr-badge');
          if (badge) {
            if (node.isCloud)       { badge.textContent='☁ CLOUD';  badge.style.color='#00CCFF'; badge.style.background='rgba(0,204,255,0.12)'; badge.style.display=''; }
            else if (node.isSynced) { badge.textContent='🔄 SYNCED'; badge.style.color='#AA66FF'; badge.style.background='rgba(170,100,255,0.12)'; badge.style.display=''; }
            else                    { badge.style.display='none'; }
          }
        });
        radio.addEventListener('mousedown', e => e.stopPropagation());

        const txt = document.createElement('span');
        txt.textContent = opt.label;
        lbl.appendChild(radio);
        lbl.appendChild(txt);
        scopeRow.appendChild(lbl);
      });

      el.appendChild(scopeRow);

      // Scope badge in header (hidden when Local)
      const badge = document.createElement('span');
      badge.className = 'chip-hdr-badge';
      if (node.isCloud)       { badge.textContent='☁ CLOUD';  badge.style.color='#00CCFF'; badge.style.background='rgba(0,204,255,0.12)'; }
      else if (node.isSynced) { badge.textContent='🔄 SYNCED'; badge.style.color='#AA66FF'; badge.style.background='rgba(170,100,255,0.12)'; }
      else                    { badge.style.display='none'; }
      hdr.appendChild(badge);
    }

    // ── Scene Object chip: object name + position/size/color ─────────────────
    if (def.isSceneObject) {
      if (!node.sceneConfig) node.sceneConfig = { ...def.sceneDefaults };
      if (!node.sceneName)   node.sceneName   = def.name.replace(/\s+/g,'_') + '_1';

      // Name row
      const snrow = document.createElement('div');
      snrow.className = 'chip-varname-row';
      const snicon = document.createElement('span');
      snicon.style.cssText = 'font-size:10px;color:var(--text3);flex-shrink:0';
      snicon.title = 'Object name used in game code';
      snicon.textContent = '📍';
      const sninput = document.createElement('input');
      sninput.className   = 'chip-varname-input';
      sninput.value       = node.sceneName;
      sninput.placeholder = 'object name...';
      sninput.addEventListener('change', e => { node.sceneName = e.target.value.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'') || node.sceneName; });
      sninput.addEventListener('mousedown', e => e.stopPropagation());
      sninput.addEventListener('click',     e => e.stopPropagation());
      snrow.appendChild(snicon);
      snrow.appendChild(sninput);
      el.appendChild(snrow);

      // Expand/collapse config row
      const cfgToggle = document.createElement('div');
      cfgToggle.className = 'chip-varname-row';
      cfgToggle.style.cssText = 'cursor:pointer;justify-content:center;font-size:9px;color:var(--text3);padding:2px';
      cfgToggle.textContent = '⚙ Position / Size / Color';
      cfgToggle.title = 'Click to configure scene object';

      const cfgPanel = document.createElement('div');
      cfgPanel.className = 'chip-scene-cfg';
      cfgPanel.style.display = 'none';

      const sceneFields = [
        { key:'pos',        label:'Position (x,y,z)', type:'text' },
        { key:'size',       label:'Size (x,y,z)',     type:'text' },
        { key:'color',      label:'Color',            type:'color' },
        { key:'text',       label:'Label Text',       type:'text' },
        { key:'promptText', label:'Prompt Text',      type:'text' },
        { key:'maxDist',    label:'Max Distance',     type:'number' },
        { key:'parent',     label:'Parent GUI',       type:'text' },
      ].filter(f => node.sceneConfig[f.key] !== undefined || def.sceneDefaults?.[f.key] !== undefined);

      sceneFields.forEach(field => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:4px;margin:2px 0';
        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:9px;color:var(--text3);min-width:70px';
        lbl.textContent   = field.label;
        let inp;
        if (field.type === 'color') {
          inp = document.createElement('input');
          inp.type  = 'color';
          inp.value = '#' + (node.sceneConfig[field.key] || 'AAAAAA').replace('#','');
          inp.style.cssText = 'width:36px;height:20px;border:1px solid #2a3a55;border-radius:3px;padding:1px;background:none;cursor:pointer';
          inp.addEventListener('change', e => { node.sceneConfig[field.key] = e.target.value.replace('#',''); });
        } else {
          inp = document.createElement('input');
          inp.type  = field.type === 'number' ? 'number' : 'text';
          inp.value = node.sceneConfig[field.key] ?? def.sceneDefaults?.[field.key] ?? '';
          inp.style.cssText = 'flex:1;background:#060e18;border:1px solid #1e3050;color:var(--text);border-radius:3px;padding:2px 5px;font-size:9px;outline:none';
          inp.addEventListener('change', e => { node.sceneConfig[field.key] = e.target.value; });
        }
        inp.addEventListener('mousedown', e => e.stopPropagation());
        inp.addEventListener('click',     e => e.stopPropagation());
        row.appendChild(lbl);
        row.appendChild(inp);
        cfgPanel.appendChild(row);
      });

      cfgToggle.addEventListener('click', e => {
        e.stopPropagation();
        const open = cfgPanel.style.display === '';
        cfgPanel.style.display = open ? 'none' : '';
        cfgToggle.textContent  = open ? '⚙ Position / Size / Color' : '▲ Close Config';
      });

      el.appendChild(cfgToggle);
      el.appendChild(cfgPanel);
    }

    // ── Event chip: name + Local/Everyone scope ──────────────────────────────
    if (def.isEvent) {
      const erow = document.createElement('div');
      erow.className = 'chip-varname-row';
      const eicon = document.createElement('span');
      eicon.textContent = '◉';
      eicon.style.cssText = 'font-size:10px;color:var(--text3);flex-shrink:0;padding-right:2px';
      const einput = document.createElement('input');
      einput.className = 'chip-varname-input';
      einput.value = node.eventName || 'MyEvent';
      einput.placeholder = 'event name...';
      einput.addEventListener('change', e => { node.eventName = e.target.value.trim() || 'MyEvent'; });
      einput.addEventListener('mousedown', e => e.stopPropagation());
      einput.addEventListener('click',     e => e.stopPropagation());
      erow.appendChild(eicon);
      erow.appendChild(einput);
      el.appendChild(erow);

      // Scope selector
      const escopeRow = document.createElement('div');
      escopeRow.className = 'chip-var-scope';
      const escopeId  = 'evscope-' + node.id;
      const curScope  = node.eventScope || 'local';

      [
        { val: 'local',    label: '📍 Local',    color: '#778899',
          tip: 'Fires only on the local player\'s machine' },
        { val: 'everyone', label: '👥 Everyone',  color: '#44DDAA',
          tip: 'Broadcasts to ALL players in the room (network event)' },
      ].forEach(opt => {
        const lbl = document.createElement('label');
        lbl.className = 'scope-opt';
        lbl.style.color = opt.color;
        lbl.title = opt.tip;
        const radio = document.createElement('input');
        radio.type  = 'radio';
        radio.name  = escopeId;
        radio.value = opt.val;
        radio.checked = (curScope === opt.val);
        radio.addEventListener('change', () => {
          node.eventScope = opt.val;
          const badge = el.querySelector('.chip-hdr-badge');
          if (badge) {
            badge.textContent  = opt.val === 'everyone' ? '👥' : '📍';
            badge.style.color  = opt.color;
            badge.style.display = '';
          }
        });
        radio.addEventListener('mousedown', e => e.stopPropagation());
        const txt = document.createElement('span');
        txt.textContent = opt.label;
        lbl.appendChild(radio);
        lbl.appendChild(txt);
        escopeRow.appendChild(lbl);
      });
      el.appendChild(escopeRow);

      // Badge in header showing current scope
      const evBadge = document.createElement('span');
      evBadge.className = 'chip-hdr-badge';
      evBadge.style.color      = curScope === 'everyone' ? '#44DDAA' : '#778899';
      evBadge.style.background = curScope === 'everyone' ? 'rgba(68,221,170,0.12)' : 'rgba(120,136,153,0.12)';
      evBadge.textContent      = curScope === 'everyone' ? '👥' : '📍';
      hdr.appendChild(evBadge);
    }

    // Body
    const body = document.createElement('div');
    body.className = 'chip-body';
    const inCol  = document.createElement('div'); inCol.className  = 'chip-inputs';
    const outCol = document.createElement('div'); outCol.className = 'chip-outputs';

    def.inputs.forEach((port, idx) => {
      const row = buildPortRow(node, idx, port, false);
      inCol.appendChild(row);
    });

    def.outputs.forEach((port, idx) => {
      const row = buildPortRow(node, idx, port, true);
      outCol.appendChild(row);
    });

    body.appendChild(inCol);
    body.appendChild(outCol);
    el.appendChild(body);

    // Drag on header
    hdr.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      pushUndo();
      startDrag(e, node.id);
    });

    // Click to select
    el.addEventListener('click', e => {
      if (tool === 'delete') { e.stopPropagation(); deleteNode(node.id); return; }
      selectNode(node.id, e.ctrlKey || e.shiftKey);
      updateInspector();
    });

    chipsLayer.appendChild(el);
    setTimeout(() => redrawWires(), 0);
  }

  function buildPortRow(node, idx, port, isOutput) {
    const pt  = getPortType(port.type);

    const row = document.createElement('div');
    row.className = 'port-row';
    // Data attributes read by onGlobalUp — no mouseup handler needed on row itself
    row.dataset.portIdx  = String(idx);   // also sets data-port-idx attr
    row.dataset.isOutput = isOutput ? '1' : '0';
    row.dataset.nodeId   = node.id;

    // ── Port dot ────────────────────────────────────────────────────────────
    // mousedown on the dot STARTS a wire (or click-to-connect if wire active)
    const portDiv = document.createElement('div');
    portDiv.className = `port ${pt.cls}`;
    portDiv.title = `${port.name} (${port.type})`;
    portDiv.style.cursor = 'crosshair';
    const inner = document.createElement('div');
    inner.className = port.type === 'exec' ? 'port-inner exec-arrow' : 'port-inner';
    portDiv.appendChild(inner);

    portDiv.addEventListener('mousedown', e => {
      e.stopPropagation();

      // ── SIMULATE MODE: exec output click fires a signal ─────────────────
      if (typeof Simulator !== 'undefined' && Simulator.isActive()) {
        if (isOutput && port.type === 'exec') {
          Simulator.firePort(node.id, idx);
        }
        // In simulate mode don't start wires
        return;
      }

      // ── Normal wiring ────────────────────────────────────────────────────
      if (wireStart) {
        if (wireStart.isOutput !== isOutput) {
          completeWire(node.id, idx, isOutput);
        } else {
          cancelWire();
        }
      } else {
        startWire(e, node.id, idx, isOutput, portDiv);
      }
    });

    // ── Hover glow when a compatible wire is being drawn ────────────────────
    row.addEventListener('mouseenter', () => {
      if (!wireStart || wireStart.isOutput === isOutput) return;
      const srcDef  = getChipDef(nodes.find(n => n.id === wireStart.nodeId)?.chipId);
      const srcType = wireStart.isOutput
        ? srcDef?.outputs[wireStart.portIdx]?.type
        : srcDef?.inputs[wireStart.portIdx]?.type;
      if (compatible(srcType || 'any', port.type)) row.classList.add('wire-hover');
    });
    row.addEventListener('mouseleave', () => row.classList.remove('wire-hover'));

    // ── Label ────────────────────────────────────────────────────────────────
    const lbl = document.createElement('span');
    lbl.className = 'port-lbl';
    lbl.textContent = port.name;

    if (!isOutput) {
      row.appendChild(portDiv);
      row.appendChild(lbl);

      // Inline default-value widget (hidden by CSS when connected)
      if (!['exec','object','player','vector3','quaternion','list','any'].includes(port.type)) {
        if (port.type === 'bool') {
          const btn = document.createElement('span');
          btn.className = 'port-def-bool';
          const getVal = () => node.defaults[`i${idx}`] !== undefined
            ? node.defaults[`i${idx}`]
            : (port.default !== undefined ? port.default : false);
          const refresh = () => {
            const v = getVal();
            btn.textContent      = v ? 'TRUE' : 'FALSE';
            btn.style.color      = v ? '#44DD88' : '#FF4455';
            btn.style.borderColor= v ? '#44DD88' : '#FF4455';
            btn.style.background = v ? 'rgba(68,221,136,0.08)' : 'rgba(255,68,85,0.08)';
          };
          btn.addEventListener('click',     ev => { ev.stopPropagation(); node.defaults[`i${idx}`] = !getVal(); refresh(); });
          btn.addEventListener('mousedown', ev => ev.stopPropagation());
          refresh();
          row.appendChild(btn);
        } else {
          const inp = document.createElement('input');
          inp.className = 'port-def';
          inp.type  = ['int','float','number'].includes(port.type) ? 'number' : 'text';
          const stored = node.defaults[`i${idx}`];
          inp.value = stored !== undefined ? stored : (port.default !== undefined ? port.default : '');
          inp.placeholder = port.type === 'string' ? '""' : '0';
          inp.addEventListener('change',    ev => { node.defaults[`i${idx}`] = ev.target.value; });
          inp.addEventListener('mousedown', ev => ev.stopPropagation());
          inp.addEventListener('click',     ev => ev.stopPropagation());
          row.appendChild(inp);
        }
      }
    } else {
      row.appendChild(lbl);
      row.appendChild(portDiv);
    }

    return row;
  }

  // ── INSPECTOR ─────────────────────────────────────────────────────────────
  function updateInspector() {
    const empty   = document.getElementById('inspEmpty');
    const content = document.getElementById('inspContent');
    if (!empty || !content) return;

    if (!selected.size) { empty.style.display=''; content.style.display='none'; return; }
    empty.style.display='none'; content.style.display='';

    if (selected.size > 1) {
      content.innerHTML = `<div class="insp-title">${selected.size} Chips Selected</div>
        <div class="insp-field"><label>Actions</label>
          <button class="insp-del" id="insp-del-sel">🗑 Delete All Selected</button>
        </div>`;
      document.getElementById('insp-del-sel')?.addEventListener('click', deleteSelected);
      return;
    }

    const nodeId = [...selected][0];
    const node   = nodes.find(n => n.id === nodeId); if (!node) return;
    const def    = getChipDef(node.chipId); if (!def) return;
    const cat    = CATEGORIES[def.category] || {};

    content.innerHTML = `
      <div class="insp-title" style="color:${cat.color||'#fff'}">${def.name}</div>
      <div class="insp-field"><label>Category</label><div style="color:var(--text2)">${def.category}</div></div>
      <div class="insp-field"><label>Position X / Y</label>
        <div style="display:flex;gap:5px">
          <input type="number" id="insp-x" value="${Math.round(node.x)}" style="width:70px">
          <input type="number" id="insp-y" value="${Math.round(node.y)}" style="width:70px">
        </div>
      </div>
      ${def.isVariable ? `<div class="insp-field"><label>Variable Name</label><input type="text" id="insp-vname" value="${node.varName||''}"></div>` : ''}
      <div class="insp-field"><label>Chip ID</label><div style="color:var(--text3);font-family:monospace;font-size:10px">${node.chipId}</div></div>
      <div class="insp-field"><label>Ports</label><div style="color:var(--text2)">In: ${def.inputs.length} · Out: ${def.outputs.length}</div></div>
      <button class="insp-del" id="insp-del">🗑 Delete Chip</button>
    `;

    document.getElementById('insp-x')?.addEventListener('change', e => {
      node.x = snap(+e.target.value);
      document.getElementById('cn-'+nodeId).style.left = node.x+'px';
      redrawWires();
    });
    document.getElementById('insp-y')?.addEventListener('change', e => {
      node.y = snap(+e.target.value);
      document.getElementById('cn-'+nodeId).style.top = node.y+'px';
      redrawWires();
    });
    document.getElementById('insp-vname')?.addEventListener('change', e => {
      node.varName = e.target.value;
      const vi = document.querySelector(`#cn-${nodeId} .chip-varname-input`);
      if (vi) vi.value = e.target.value;
    });
    document.getElementById('insp-del')?.addEventListener('click', () => deleteNode(nodeId));
  }

  // ── SERIALIZATION ─────────────────────────────────────────────────────────
  function getState() {
    return {
      nodes: JSON.parse(JSON.stringify(nodes)),
      wires: JSON.parse(JSON.stringify(wires)),
      nextId, transform: {...transform},
    };
  }

  function loadState(state) {
    if (!state) return;
    chipsLayer.innerHTML = '';
    svgLayer.innerHTML = '';
    nodes = []; wires = []; selected.clear(); selWire = null;
    nextId    = state.nextId || 1;
    transform = { ...(state.transform || { x:80, y:60, scale:1 }) };
    state.nodes?.forEach(n => { nodes.push(n); renderNode(n); });
    state.wires?.forEach(w => { wires.push(w); setTimeout(() => drawWire(w), 20); });
    applyTransform();
    updateInspector();
  }

  function _restoreState(s) { loadState(s); }

  function getSaveData() {
    return { version:3, ...getState() };
  }

  function loadSaveData(data) {
    if (!data) return false;
    loadState(data);
    return true;
  }

  function getCircuitData() { return { nodes:[...nodes], wires:[...wires] }; }

  function updateSettings(s) {
    Object.assign(settings, s);
    if (s.wireStyle) redrawWires();
  }

  function showToast(msg) {
    const t = document.getElementById('toast'); if(!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  return {
    init, addNode, deleteNode, getCircuitData,
    getState, loadState, getSaveData, loadSaveData,
    showToast, resetView, frameNodes, updateSettings,
    redrawWires, updateInspector, clearSelection,
  };
})();

// simulator.js — Visual circuit simulation engine

const Simulator = (() => {
  let active     = false;
  let vars       = {};   // varName → current value
  let portVals   = {};   // `nodeId.portIdx` → computed value
  let circuit    = null; // snapshot of { nodes, wires }

  // ── Public API ──────────────────────────────────────────────────────────
  function toggle() { active ? stop() : start(); }

  function start() {
    active   = true;
    vars     = {};
    portVals = {};
    circuit  = Canvas.getCircuitData();

    document.getElementById('canvasArea')?.classList.add('sim-active-canvas');
    const btn = document.getElementById('simulateBtn');
    if (btn) { btn.textContent = '⏹ Stop Sim'; btn.classList.add('sim-active'); }

    Canvas.showToast('▶ Simulate — click any orange ▶ exec output to fire a signal');
  }

  function stop(silent) {
    const wasActive = active;
    active   = false;
    vars     = {};
    portVals = {};
    document.getElementById('canvasArea')?.classList.remove('sim-active-canvas');
    const btn = document.getElementById('simulateBtn');
    if (btn) { btn.textContent = '▶ Simulate'; btn.classList.remove('sim-active'); }
    _clearVisuals();
    // Only show toast if simulation was actually running
    if (wasActive && !silent) Canvas.showToast('Simulation stopped');
  }

  function isActive() { return active; }

  // Called by canvas.js when a port dot is clicked in simulate mode
  function firePort(nodeId, portIdx) {
    if (!active) return;
    circuit = Canvas.getCircuitData(); // refresh
    _propagate(nodeId, portIdx, 0);
  }

  // ── Core propagation ─────────────────────────────────────────────────────
  function _propagate(fromNodeId, fromPortIdx, depth) {
    if (depth > 60) return; // infinite-loop guard
    circuit.wires
      .filter(w => w.fromNode === fromNodeId && w.fromPort === fromPortIdx && w.type === 'exec')
      .forEach(w => {
        _animateWire(w.id, () => _execute(w.toNode, w.toPort, depth + 1));
      });
  }

  function _execute(nodeId, inPortIdx, depth) {
    if (!active || depth > 60) return;
    const node = circuit.nodes.find(n => n.id === nodeId);
    const def  = getChipDef(node?.chipId);
    if (!node || !def) return;

    _pulseChip(nodeId);
    _computeOutputs(nodeId);
    _showOutputValues(nodeId);

    const inp = i => _inputVal(nodeId, i);

    // Choose which exec outputs to follow based on chip type
    switch (node.chipId) {
      // ── Control flow ────────────────────────────────────────────────────
      case 'branch': {
        const taken = !!inp(1);
        _pulseChipColor(nodeId, taken ? '#44DD88' : '#FF4455');
        setTimeout(() => _propagate(nodeId, taken ? 0 : 1, depth + 1), 180);
        break;
      }
      case 'authority':
        // In local sim we're always "authority"
        _pulseChipColor(nodeId, '#44DD88');
        setTimeout(() => _propagate(nodeId, 0, depth + 1), 180);
        break;

      case 'sequence':
        def.outputs.forEach((o, i) => {
          if (o.type === 'exec') setTimeout(() => _propagate(nodeId, i, depth + 1), i * 220 + 120);
        });
        break;

      case 'forloop': {
        const first = Number(inp(1) ?? 0);
        const last  = Number(inp(2) ?? 9);
        const step  = Math.max(1, Number(inp(3) ?? 1));
        const count = Math.min(Math.floor((last - first) / step) + 1, 10); // cap at 10 iterations in sim
        for (let i = 0; i < count; i++) {
          portVals[`${nodeId}.2`] = first + i * step; // index output
          const d = depth;
          setTimeout(() => { _showOutputValues(nodeId); _propagate(nodeId, 0, d + 1); }, i * 300 + 120);
        }
        setTimeout(() => _propagate(nodeId, 1, depth + 1), count * 300 + 200);
        break;
      }

      case 'delay': {
        const secs = Math.min(Math.max(Number(inp(1)) || 1, 0.05), 3);
        _showBadge(nodeId, -1, `⏱ ${secs}s`, '#FFCC44');
        Canvas.showToast(`⏱ Delay ${secs}s…`);
        setTimeout(() => _propagate(nodeId, 0, depth + 1), secs * 1000);
        break;
      }

      case 'doonce': {
        if (portVals[`${nodeId}._done`]) { _pulseChipColor(nodeId, '#778899'); break; }
        portVals[`${nodeId}._done`] = true;
        setTimeout(() => _propagate(nodeId, 0, depth + 1), 150);
        break;
      }

      case 'gate': case 'gate2': {
        setTimeout(() => _propagate(nodeId, 0, depth + 1), 150);
        break;
      }

      // ── Event Sender: find all matching Event Receivers by name ─────────
      case 'evt_send': {
        const evName = node.eventName || 'MyEvent';

        // Copy args from sender inputs to variables so receivers can read them
        const arg0 = _inputVal(nodeId, 1);
        const arg1 = _inputVal(nodeId, 2);
        const arg2 = _inputVal(nodeId, 3);

        // Find every Event Receiver on the canvas with the same event name
        const receivers = circuit.nodes.filter(n => {
          const d = getChipDef(n.chipId);
          return d?.isEvent && n.chipId === 'evt_recv' && n.eventName === evName;
        });

        if (receivers.length === 0) {
          Canvas.showToast(`📡 Event "${evName}" fired — no receivers found`);
        } else {
          Canvas.showToast(`📡 "${evName}" → ${receivers.length} receiver${receivers.length > 1 ? 's' : ''}`);
        }

        receivers.forEach(recv => {
          // Pass args to receiver output ports (Arg 0 = out1, Arg 1 = out2, Arg 2 = out3)
          portVals[`${recv.id}.1`] = arg0;
          portVals[`${recv.id}.2`] = arg1;
          portVals[`${recv.id}.3`] = arg2;

          setTimeout(() => {
            _pulseChipColor(recv.id, '#FF4444'); // Red flash = event received
            _showOutputValues(recv.id);
            // Fire receiver's Out exec output (port index 0)
            _propagate(recv.id, 0, depth + 1);
          }, 220);
        });

        // Also follow Sender's own Out exec (in case something is wired to it)
        setTimeout(() => _propagate(nodeId, 0, depth + 1), 150);
        break;
      }

      // ── Variable set ────────────────────────────────────────────────────
      default: {
        if (def.isVariable && inPortIdx === 0 /* Set exec */) {
          const newVal = _inputVal(nodeId, 1);
          vars[node.varName || 'var'] = newVal;
          portVals[`${nodeId}.1`] = newVal;
          _showOutputValues(nodeId);
          Canvas.showToast(`${node.varName || 'var'} = ${_fmt(newVal)}`);
          // Fire Changed output if it exists
          const changedPortIdx = def.outputs.findIndex(o => o.name === 'Changed' && o.type === 'exec');
          if (changedPortIdx >= 0) setTimeout(() => _propagate(nodeId, changedPortIdx, depth + 1), 100);
        }
        // Follow all exec outputs
        let d = 150;
        def.outputs.forEach((o, i) => {
          if (o.type === 'exec' && o.name !== 'Changed') {
            setTimeout(() => _propagate(nodeId, i, depth + 1), d);
            d += 80;
          }
        });
        break;
      }
    }
  }

  // ── Value computation ────────────────────────────────────────────────────
  function _computeOutputs(nodeId) {
    const node = circuit.nodes.find(n => n.id === nodeId);
    const def  = getChipDef(node?.chipId);
    if (!node || !def) return;

    const inp = i => _inputVal(nodeId, i);
    const set = (i, v) => { portVals[`${nodeId}.${i}`] = v; };

    switch (node.chipId) {
      // ── Math ──────────────────────────────────────────────────────────
      case 'add':       set(0, +inp(0) + +inp(1));  break;
      case 'subtract':  set(0, +inp(0) - +inp(1));  break;
      case 'multiply':  set(0, +inp(0) * +inp(1));  break;
      case 'divide':    set(0, +inp(1) !== 0 ? +inp(0) / +inp(1) : 0); break;
      case 'modulo':    set(0, +inp(0) % +inp(1));  break;
      case 'abs':       set(0, Math.abs(+inp(0)));  break;
      case 'clamp':     set(0, Math.max(+inp(1), Math.min(+inp(2), +inp(0)))); break;
      case 'lerp':      set(0, +inp(0) + (+inp(1) - +inp(0)) * +inp(2)); break;
      case 'round':     set(0, Math.round(+inp(0))); break;
      case 'floor':     set(0, Math.floor(+inp(0))); break;
      case 'ceil':      set(0, Math.ceil(+inp(0)));  break;
      case 'min':       set(0, Math.min(+inp(0), +inp(1))); break;
      case 'max':       set(0, Math.max(+inp(0), +inp(1))); break;
      case 'power':     set(0, Math.pow(+inp(0), +inp(1))); break;
      case 'sqrt':      set(0, Math.sqrt(+inp(0)));  break;
      case 'negate':    set(0, -(+inp(0)));           break;
      case 'sin':       set(0, Math.sin(+inp(0)));    break;
      case 'cos':       set(0, Math.cos(+inp(0)));    break;
      case 'tan':       set(0, Math.tan(+inp(0)));    break;
      case 'asin':      set(0, Math.asin(+inp(0)));   break;
      case 'acos':      set(0, Math.acos(+inp(0)));   break;
      case 'atan2':     set(0, Math.atan2(+inp(0), +inp(1))); break;
      case 'randnum':   set(0, Math.random() * (+inp(1) - +inp(0)) + +inp(0)); break;
      case 'randint':   set(0, Math.floor(Math.random() * (+inp(1) - +inp(0) + 1)) + +inp(0)); break;
      case 'pi':        set(0, Math.PI); break;

      // ── Logic ─────────────────────────────────────────────────────────
      case 'and':    set(0, !!inp(0) && !!inp(1)); break;
      case 'or':     set(0, !!inp(0) || !!inp(1)); break;
      case 'not':    set(0, !inp(0));               break;
      case 'nand':   set(0, !(!!inp(0) && !!inp(1))); break;
      case 'nor':    set(0, !(!!inp(0) || !!inp(1))); break;
      case 'xor':    set(0, !!inp(0) !== !!inp(1));   break;
      case 'eq':     set(0, inp(0) == inp(1));         break;
      case 'notEq':  set(0, inp(0) != inp(1));         break;
      case 'gt':     set(0, +inp(0) > +inp(1));        break;
      case 'lt':     set(0, +inp(0) < +inp(1));        break;
      case 'gte':    set(0, +inp(0) >= +inp(1));       break;
      case 'lte':    set(0, +inp(0) <= +inp(1));       break;

      // ── Branch result ─────────────────────────────────────────────────
      case 'branch': {
        const c = !!inp(1);
        portVals[`${nodeId}.cond`] = c;
        break;
      }

      // ── String / Convert ──────────────────────────────────────────────
      case 'strconcat':  set(0, String(inp(0)) + String(inp(1))); break;
      case 'to_string':  set(0, String(inp(0))); break;
      case 'parse_int':  { const n = parseInt(inp(0)); set(0, isNaN(n) ? 0 : n); set(1, !isNaN(n)); break; }
      case 'parse_float':{ const f = parseFloat(inp(0)); set(0, isNaN(f) ? 0 : f); set(1, !isNaN(f)); break; }
      case 'bool_to_int':set(0, inp(0) ? 1 : 0); break;
      case 'int_to_bool':set(0, +inp(0) !== 0);  break;
      case 'vec3_make':  set(0, `(${+inp(0)}, ${+inp(1)}, ${+inp(2)})`); break;
      case 'vec3_split': {
        const s = String(inp(0)).match(/-?[\d.]+/g) || [0,0,0];
        set(0, +s[0]||0); set(1, +s[1]||0); set(2, +s[2]||0);
        break;
      }

      // ── Variable Get ──────────────────────────────────────────────────
      default:
        if (def.isVariable) {
          const v = vars[node.varName] ?? node.defaults['i1'] ?? def.inputs[1]?.default ?? 0;
          set(1, v); // output index 1 = Value
        }
        break;
    }
  }

  // Get value for an input port (follow wires recursively, then use defaults)
  function _inputVal(nodeId, portIdx) {
    const wire = circuit.wires.find(w => w.toNode === nodeId && w.toPort === portIdx && w.type !== 'exec');
    if (wire) {
      const key = `${wire.fromNode}.${wire.fromPort}`;
      if (portVals[key] !== undefined) return portVals[key];
      _computeOutputs(wire.fromNode);
      return portVals[key] ?? 0;
    }
    const node = circuit.nodes.find(n => n.id === nodeId);
    const def  = getChipDef(node?.chipId);
    const stored = node?.defaults[`i${portIdx}`];
    return stored !== undefined ? stored : (def?.inputs[portIdx]?.default ?? 0);
  }

  // ── Visuals ──────────────────────────────────────────────────────────────
  function _animateWire(wireId, cb) {
    const el = document.querySelector(`[data-wid="${wireId}"]`);
    if (el) {
      el.classList.remove('sim-wire');
      void el.offsetWidth;              // force reflow to restart animation
      el.classList.add('sim-wire');
      setTimeout(() => { el.classList.remove('sim-wire'); cb?.(); }, 280);
    } else {
      cb?.();
    }
  }

  function _pulseChip(nodeId) {
    const el = document.getElementById('cn-' + nodeId);
    if (!el) return;
    el.classList.remove('sim-pulse');
    void el.offsetWidth;
    el.classList.add('sim-pulse');
    setTimeout(() => el.classList.remove('sim-pulse'), 650);
  }

  function _pulseChipColor(nodeId, color) {
    const el = document.getElementById('cn-' + nodeId);
    if (!el) return;
    el.style.setProperty('--sim-pulse-color', color);
    _pulseChip(nodeId);
  }

  function _showOutputValues(nodeId) {
    const node = circuit.nodes.find(n => n.id === nodeId);
    const def  = getChipDef(node?.chipId);
    if (!def) return;
    def.outputs.forEach((port, i) => {
      if (port.type === 'exec') return;
      const v = portVals[`${nodeId}.${i}`];
      if (v === undefined) return;
      _showPortBadge(nodeId, i, true, _fmt(v), port.type);
    });
  }

  function _showPortBadge(nodeId, portIdx, isOutput, text, type) {
    const nEl = document.getElementById('cn-' + nodeId);
    if (!nEl) return;
    if (portIdx < 0) {
      // Show as chip-level badge
      let b = nEl.querySelector('.sim-chip-val');
      if (!b) { b = document.createElement('div'); b.className = 'sim-chip-val'; nEl.appendChild(b); }
      b.textContent = text;
      setTimeout(() => b.remove(), 3000);
      return;
    }
    const col  = isOutput ? '.chip-outputs' : '.chip-inputs';
    const rows = nEl.querySelectorAll(col + ' .port-row');
    const row  = rows[portIdx];
    if (!row) return;

    let badge = row.querySelector('.sim-val');
    if (!badge) { badge = document.createElement('span'); badge.className = 'sim-val'; row.appendChild(badge); }

    const pt  = getPortType(type || 'any');
    badge.textContent   = text;
    badge.style.color   = pt.color;
    badge.style.borderColor = pt.color + '55';

    clearTimeout(badge._t);
    badge._t = setTimeout(() => badge.remove(), 4000);
  }

  function _showBadge(nodeId, portIdx, text, color) {
    _showPortBadge(nodeId, portIdx, false, text, 'any');
  }

  function _fmt(v) {
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return String(v);
      return (Math.round(v * 1000) / 1000).toString();
    }
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (v === null || v === undefined) return '—';
    const s = String(v);
    return s.length > 14 ? s.slice(0, 13) + '…' : s;
  }

  function _clearVisuals() {
    document.querySelectorAll('.sim-pulse').forEach(e => e.classList.remove('sim-pulse'));
    document.querySelectorAll('.sim-wire').forEach(e => e.classList.remove('sim-wire'));
    document.querySelectorAll('.sim-val,.sim-chip-val').forEach(e => e.remove());
  }

  return { toggle, start, stop, isActive, firePort };
})();

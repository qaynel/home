/* Qaynel — the living arcane machine.
   One persistent WebGL world, driven by a single scroll progress value.
   Registers <qaynel-world>. Requires window.THREE (r149 UMD, loaded in helmet). */
(() => {
  if (window.__qaynelWorld) return;
  window.__qaynelWorld = true;

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const rng = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  const C = {
    day:  { bg: 0xF1E7D2, ink: 0x181A1C, line: 0xC9B58E, dim: 0xC9B58E, brass: 0xA6844F, meta: 0x69655D },
    night:{ bg: 0x111210, ink: 0xEEE4CF, line: 0x8D826C, dim: 0x393833, brass: 0xC49B55, meta: 0x8D826C }
  };

  // chapter breakpoints (spec 7.2)
  const BP = [0, .10, .20, .30, .45, .55, .65, .75, .85, 1.0001];
  // camera keyframes per chapter boundary (10 entries -> chapter float 0..9)
  const KEY = [
    { p: [0, 0, 15.5], l: [0, 0, 0], f: 42 },
    { p: [0, 0, 12.0], l: [0, 0, 0], f: 42 },
    { p: [0, 0.4, 4.0], l: [0, 0, -6], f: 46 },
    { p: [-2, 5.5, 30], l: [0, 0, -2], f: 40 },
    { p: [7.5, 2.0, 22], l: [2, 0, 0], f: 40 },
    { p: [0, 6.0, 38], l: [0, -1, -10], f: 40 },
    { p: [3.0, 1.5, 21], l: [0.5, 0, 0], f: 38 },
    { p: [0, 0, 31], l: [0, 0, 0], f: 38 },
    { p: [0, 0, 52], l: [0, 0, 0], f: 40 },
    { p: [0, 0, 16.0], l: [0, 0, 0], f: 42 }
  ];

  const SUBS = [
    ['hosts', 'Hosts', 'RIG / HOST GRAPH / 01'],
    ['tools', 'Tools', 'RIG / TOOL BUS / 02'],
    ['agents', 'Agents', 'RIG / AGENT RUNTIME / 03'],
    ['models', 'Models', 'RIG / MODEL ROUTER / 04'],
    ['context', 'Context', 'RIG / CONTEXT STORE / 05'],
    ['commands', 'Commands', 'RIG / COMMAND SET / 06'],
    ['execution', 'Execution', 'RIG / EXECUTION / 07'],
    ['memory', 'Memory', 'RIG / MEMORY / 08'],
    ['observability', 'Observability', 'RIG / OBSERVABILITY / 09']
  ];
  const SUB_NOTE = {
    hosts: 'every machine addressed the same way',
    tools: 'attached, versioned, discoverable',
    agents: 'processes with state and a place to run',
    models: 'routed per task, not per vendor',
    context: 'mounted, not pasted',
    commands: 'one grammar across the toolbox',
    execution: 'sandboxed, observed, reversible',
    memory: 'what the system keeps between runs',
    observability: 'the machine explains itself'
  };
  const HOSTS = ['Laptop', 'Cloud', 'Server', 'Container', 'Remote'];
  const STOPS = [
    ['repository', 'context'], ['documentation', 'memory'], ['terminal', 'commands'],
    ['remote host', 'hosts'], ['test suite', 'execution'], ['result', 'observability']
  ];

  // ink silhouette of the Qaynel mark, traced from the brand sigil (assets/qaynel-sigil.png).
  // Rectilinear masses as (x, y, w, h, rot) for the frame/base, plus polygon masses
  // (with holes for the windows and the body cut-out) for the rest.
  const SIGIL_BOXES = [
    [0, 3.115, 3.40, 0.37],          // frame: top bar
    [-1.5275, -0.185, 0.345, 6.23],  // frame: left leg
    [1.5275, -0.185, 0.345, 6.23],   // frame: right leg
    [0, -3.135, 2.22, 0.33]          // base bar
  ];
  const SIGIL_SHAPES = [
    { // window plate: two windows + the downward tick between them
      outer: [[-1.11, 1.29], [1.11, 1.29], [1.11, 2.67], [-1.11, 2.67]],
      holes: [
        [[-0.727, 1.736], [-0.239, 1.736], [-0.239, 2.324], [-0.727, 2.324]],
        [[0.239, 1.736], [0.727, 1.736], [0.727, 2.324], [0.239, 2.324]],
        [[-0.125, 1.606], [0.125, 1.606], [0, 1.31]]
      ]
    },
    { outer: [[1.121, 0.909], [1.101, 0.924], [0.757, 0.919], [0.742, 0.894], [0.747, 0.824], [0.727, 0.760], [0.364, 0.416], [1.121, 0.416]] }, // right arm
    { outer: [[-1.121, 0.909], [-1.101, 0.924], [-0.757, 0.919], [-0.742, 0.894], [-0.747, 0.824], [-0.727, 0.760], [-0.364, 0.416], [-1.121, 0.416]] }, // left arm
    { outer: [[-1.11, 1.28], [-1.09, 1.18], [-0.26, 1.18], [-0.235, 0.416], [0.235, 0.416], [0.26, 1.18], [1.09, 1.18], [1.11, 1.28]] }, // center stem
    { // body: the hourglass silhouette cut from a solid mass
      outer: [[-1.115, -2.97], [1.115, -2.97], [1.115, 0.41], [-1.115, 0.41]],
      holes: [[
        [-0.082, 0.377], [0.082, 0.377], [0.204, 0.067], [0.184, -0.047], [0.648, -0.496], [0.792, -0.570],
        [0.503, -1.233], [0.742, -2.224], [0.747, -2.892], [0.722, -2.921], [-0.722, -2.921], [-0.747, -2.892],
        [-0.742, -2.224], [-0.503, -1.233], [-0.792, -0.570], [-0.648, -0.496], [-0.184, -0.047], [-0.204, 0.067]
      ]]
    }
  ];
  const SIGIL_RING = { x: 0, y: 4.45, r: 0.248, tube: 0.132 };

  const TOOLS = ['GitHub', 'Terminal', 'Cloud host', 'Model', 'MCP server', 'Database', 'Browser', 'Internal tool'];

  class QaynelWorld extends HTMLElement {
    get vw() { return this.clientWidth || window.innerWidth; }
    get vh() { return this.clientHeight || window.innerHeight; }

    connectedCallback() {
      if (this._booted) {
        if (this.renderer && !this._raf) this._loop(); // remount: restart the clock
        return;
      }
      this._booted = true;
      this.style.cssText = 'display:block;position:absolute;top:0;left:0;width:100%;height:100%';
      this.progress = 0; this.cf = 0; this.theme = 0;
      this.hover = null; this.selected = null;
      this.attached = new Set(); this.manualAgent = 0; this.agentRun = -1;
      this.overrides = {};
      this._logged = {};
      this.ptr = { x: 0, y: 0, tx: 0, ty: 0, speed: 0 };
      this._boot();
    }

    async _boot() {
      let waited = 0;
      while (!window.THREE && waited < 12000) { await new Promise(r => setTimeout(r, 60)); waited += 60; }
      if (!window.THREE) { console.warn('[qaynel] three.js unavailable'); return; }
      this.T = window.THREE;
      this._build();
      this._bind();
      this._loop();
    }

    // ---------- construction ----------
    _build() {
      const T = this.T;
      const w = this.vw, h = this.vh;
      this.small = w < 900;
      const r = this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      r.setSize(w, h);
      r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      this.appendChild(r.domElement);

      this.labels = document.createElement('div');
      this.labels.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
      this.appendChild(this.labels);

      const s = this.scene = new T.Scene();
      s.background = new T.Color(C.day.bg);
      s.fog = new T.FogExp2(C.day.bg, 0.0125);
      const cam = this.cam = new T.PerspectiveCamera(42, w / h, 0.1, 400);
      cam.position.set(0, 0, 15.5);
      s.add(new T.AmbientLight(0xffffff, 0.72));
      const d1 = new T.DirectionalLight(0xffffff, 0.85); d1.position.set(-6, 9, 12); s.add(d1);
      const d2 = new T.DirectionalLight(0xffffff, 0.3); d2.position.set(8, -4, -6); s.add(d2);

      this.mats = {
        ink: new T.MeshStandardMaterial({ color: C.day.ink, roughness: .62, metalness: .05 }),
        inkSoft: new T.MeshStandardMaterial({ color: C.day.ink, roughness: .8, transparent: true, opacity: .9 }),
        brass: new T.MeshStandardMaterial({ color: C.day.brass, roughness: .35, metalness: .55, emissive: 0x000000 }),
        line: new T.LineBasicMaterial({ color: C.day.line, transparent: true, opacity: .55 }),
        lineDim: new T.LineBasicMaterial({ color: C.day.line, transparent: true, opacity: .22 }),
        trace: new T.LineBasicMaterial({ color: C.day.brass, transparent: true, opacity: .95 }),
        star: new T.PointsMaterial({ color: C.day.line, size: .085, transparent: true, opacity: .5, sizeAttenuation: true })
      };

      this._buildSigil();
      this._buildRig();
      this._buildHosts();
      this._buildTools();
      this._buildAgent();
      this._buildArch();
      this._buildSky();
      this._buildCursor();
      this._makeLabels();
    }

    _buildSigil() {
      const T = this.T;
      const g = this.sigil = new T.Group();
      this.sigilParts = [];
      const rnd = rng(7);

      const addPart = (m, cx, cy, baseRot) => {
        const a = Math.atan2(cy + 0.001, cx + 0.001);
        m.userData.home = m.position.clone();
        m.userData.out = new T.Vector3(Math.cos(a) * (2.2 + rnd() * 5.5), Math.sin(a) * (2.0 + rnd() * 4.5), (rnd() - 0.5) * 7);
        m.userData.spin = (rnd() - 0.5) * 1.6;
        m.userData.baseRot = baseRot || 0;
        g.add(m); this.sigilParts.push(m);
      };

      SIGIL_BOXES.forEach(([x, y, w, h, rot]) => {
        const m = new T.Mesh(new T.BoxGeometry(w, h, 0.22), this.mats.ink);
        m.position.set(x, y, 0);
        if (rot) m.rotation.z = rot;
        addPart(m, x, y, rot);
      });

      const shapeFromPts = (pts) => {
        const sh = new T.Shape();
        pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y));
        return sh;
      };
      SIGIL_SHAPES.forEach(({ outer, holes }) => {
        const shape = shapeFromPts(outer);
        (holes || []).forEach(h => shape.holes.push(shapeFromPts(h)));
        const geo = new T.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false });
        geo.translate(0, 0, -0.11);
        const m = new T.Mesh(geo, this.mats.ink);
        let cx = 0, cy = 0;
        outer.forEach(([x, y]) => { cx += x; cy += y; });
        addPart(m, cx / outer.length, cy / outer.length, 0);
      });

      g.position.y = 1.35;
      const ring = new T.Mesh(new T.TorusGeometry(SIGIL_RING.r, SIGIL_RING.tube, 12, 48), this.mats.ink);
      ring.position.set(SIGIL_RING.x, SIGIL_RING.y, 0);
      addPart(ring, SIGIL_RING.x, SIGIL_RING.y, 0);
      ring.userData.out.set(0, 6.5, -2);
      ring.userData.spin = 0.6;
      // construction lines around the mark
      const pts = [];
      const circ = (R, y0) => { for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; pts.push(Math.cos(a) * R, y0 + Math.sin(a) * R, -0.4); if (i && i < 96) pts.push(Math.cos(a) * R, y0 + Math.sin(a) * R, -0.4); } };
      circ(4.6, 0); circ(6.4, 0);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pts.push(Math.cos(a) * 4.6, Math.sin(a) * 4.6, -0.4, Math.cos(a) * 6.4, Math.sin(a) * 6.4, -0.4); }
      const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      this.sigilLines = new T.LineSegments(lg, this.mats.lineDim.clone());
      g.add(this.sigilLines);
      this.scene.add(g);
    }

    _buildRig() {
      const T = this.T;
      const g = this.rig = new T.Group();
      g.rotation.x = -0.34;
      this.rings = [];
      [[8, .034, 0], [11.5, .028, .18], [15.5, .024, -.13], [26, .02, .07]].forEach(([R, t, tilt], i) => {
        const m = new T.Mesh(new T.TorusGeometry(R, t, 6, 220), this.mats.ink.clone());
        m.material.transparent = true; m.material.opacity = i === 3 ? .32 : .8;
        m.rotation.x = tilt * .5; m.rotation.y = tilt;
        g.add(m); this.rings.push(m);
      });
      // graduated ticks on the outer dial
      const tp = [];
      for (let i = 0; i < 180; i++) { const a = i / 180 * Math.PI * 2, l = i % 15 === 0 ? .9 : .34; tp.push(Math.cos(a) * 15.5, Math.sin(a) * 15.5, 0, Math.cos(a) * (15.5 + l), Math.sin(a) * (15.5 + l), 0); }
      const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.Float32BufferAttribute(tp, 3));
      this.ticks = new T.LineSegments(tg, this.mats.line.clone()); g.add(this.ticks);

      // core gimbal
      this.core = new T.Group();
      const oct = new T.Mesh(new T.OctahedronGeometry(1.55, 0), this.mats.ink.clone());
      oct.material.transparent = true; oct.material.opacity = .92; this.core.add(oct);
      const cage = new T.LineSegments(new T.EdgesGeometry(new T.OctahedronGeometry(2.5, 0)), this.mats.line.clone());
      this.core.add(cage); this.coreCage = cage;
      g.add(this.core);

      // subsystem nodes on the inner dial
      this.nodes = [];
      this.spokes = [];
      SUBS.forEach(([id, label], i) => {
        const a = i / SUBS.length * Math.PI * 2 - Math.PI / 2;
        const pos = new T.Vector3(Math.cos(a) * 8, Math.sin(a) * 8, 0);
        const n = new T.Mesh(new T.BoxGeometry(.62, .62, .62), this.mats.ink.clone());
        n.material.transparent = true;
        n.rotation.set(.6, .6, 0); n.position.copy(pos);
        n.userData = { id, label, i, base: pos.clone() };
        g.add(n); this.nodes.push(n);
        const sp = [];
        sp.push(0, 0, 0, pos.x, pos.y, 0);
        sp.push(pos.x, pos.y, 0, Math.cos(a) * 11.5, Math.sin(a) * 11.5, 0);
        const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
        const sl = new T.LineSegments(sg, this.mats.line.clone());
        sl.userData.id = id; g.add(sl); this.spokes.push(sl);
      });
      this.scene.add(g);
    }

    _buildHosts() {
      const T = this.T;
      const g = this.hosts = new T.Group();
      this.hostSlabs = []; this.hostLinks = [];
      HOSTS.forEach((name, i) => {
        const t = (i - (HOSTS.length - 1) / 2);
        const p = new T.Vector3(t * 12.5, (i % 2 ? 3.2 : -3.6) + Math.sin(i) * 1.4, -18 - Math.abs(t) * 4.5);
        const frame = new T.Group();
        const outer = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(6.4, 4.0, .35)), this.mats.line.clone());
        const plate = new T.Mesh(new T.PlaneGeometry(5.4, 3.1), this.mats.ink.clone());
        plate.material.transparent = true; plate.material.opacity = .07;
        const bar = new T.Mesh(new T.BoxGeometry(5.4, .12, .12), this.mats.ink.clone());
        bar.position.y = 1.0; bar.material.transparent = true;
        frame.add(outer, plate, bar);
        frame.position.copy(p); frame.userData = { name, i, base: p.clone() };
        g.add(frame); this.hostSlabs.push(frame);
        const pts = [0, 0, 0, p.x, p.y, p.z];
        const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
        const ln = new T.Line(lg, this.mats.trace.clone()); ln.material.opacity = 0;
        g.add(ln); this.hostLinks.push(ln);
      });
      this.scene.add(g);
    }

    _buildTools() {
      const T = this.T;
      const g = this.toolsG = new T.Group();
      g.rotation.x = -0.34;
      this.sockets = []; this.toolMeshes = [];
      TOOLS.forEach((name, i) => {
        const a = i / TOOLS.length * Math.PI * 2 - Math.PI / 2 + .19;
        const pos = new T.Vector3(Math.cos(a) * 11.5, Math.sin(a) * 11.5, 0);
        const sock = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.5, 1.5, .1)), this.mats.line.clone());
        sock.position.copy(pos); sock.userData = { name, i, angle: a };
        g.add(sock); this.sockets.push(sock);
        const mod = new T.Group();
        const shell = new T.Mesh(new T.BoxGeometry(1.15, 1.15, .2), this.mats.ink.clone());
        shell.material.transparent = true; shell.material.opacity = 0;
        const inner = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(.6, .6, .3)), this.mats.line.clone());
        inner.material.opacity = 0;
        mod.add(shell, inner);
        const far = new T.Vector3(Math.cos(a) * 21, Math.sin(a) * 21, 7 + i);
        mod.position.copy(far);
        mod.userData = { name, i, target: pos.clone(), far, t: 0 };
        g.add(mod); this.toolMeshes.push(mod);
      });
      this.scene.add(g);
    }

    _buildAgent() {
      const T = this.T;
      const g = this.agentG = new T.Group();
      g.rotation.x = -0.34;
      const tok = this.token = new T.Mesh(new T.TetrahedronGeometry(.5), this.mats.brass.clone());
      const halo = new T.LineSegments(new T.EdgesGeometry(new T.TetrahedronGeometry(.95)), this.mats.trace.clone());
      halo.material.opacity = .5; tok.add(halo);
      g.add(tok);
      // path through the stops
      const V = T.Vector3;
      const pts = [new V(0, 0, 0)];
      this.stopPts = [];
      STOPS.forEach(([label, sub]) => {
        const i = SUBS.findIndex(s => s[0] === sub);
        const a = i / SUBS.length * Math.PI * 2 - Math.PI / 2;
        const p = new V(Math.cos(a) * 8, Math.sin(a) * 8, 0);
        this.stopPts.push({ label, p: p.clone(), sub });
        pts.push(p.clone().multiplyScalar(1.25).setZ(1.6));
        pts.push(p);
      });
      this.curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', .35);
      const dense = this.curve.getPoints(420);
      const tg = new T.BufferGeometry().setFromPoints(dense);
      this.trace = new T.Line(tg, this.mats.trace.clone());
      this.trace.geometry.setDrawRange(0, 0);
      g.add(this.trace);
      this.scene.add(g);
    }

    _buildArch() {
      const T = this.T;
      const g = this.arch = new T.Group();
      this.archTiers = [
        [['Qaynel', 0]],
        [['Rig', 0]],
        [['Tools', -7.5], ['Hosts', 0], ['Agents', 7.5]],
        [['Execution', 0]]
      ];
      const pts = [];
      this.archNodes = [];
      const GAP = 4.2, TOP = 5.0;
      this.archTiers.forEach((tier, ti) => {
        const y = TOP - ti * GAP;
        tier.forEach(([label, x]) => {
          const box = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(5.2, 1.9, .02)), this.mats.line.clone());
          box.position.set(x, y, 0); g.add(box);
          this.archNodes.push({ label, pos: new T.Vector3(x, y, 0) });
          if (ti > 0) {
            const prev = this.archTiers[ti - 1];
            prev.forEach(([, px]) => { pts.push(px, y + GAP - .95, 0, x, y + .95, 0); });
          }
        });
      });
      g.position.y = -0.6;
      const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      this.archLinks = new T.LineSegments(lg, this.mats.line.clone());
      g.add(this.archLinks);
      g.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = 0; } });
      this.scene.add(g);
    }

    _buildSky() {
      const T = this.T;
      const n = this.small ? 240 : 620;
      const rnd = rng(Math.floor(Date.now() / 86400000) + 11); // varies by session-day, stable within a visit
      const pos = [];
      for (let i = 0; i < n; i++) {
        const R = 40 + rnd() * 90, a = rnd() * Math.PI * 2, y = (rnd() - .5) * 90;
        pos.push(Math.cos(a) * R, y, Math.sin(a) * R - 20);
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      this.sky = new T.Points(g, this.mats.star); this.scene.add(this.sky);
      // procedural celestial arcs, re-seeded per load
      const ap = []; const r2 = rng(Date.now() % 99991);
      for (let k = 0; k < 9; k++) {
        const R = 24 + r2() * 46, y = (r2() - .5) * 46, a0 = r2() * Math.PI * 2, span = .6 + r2() * 1.5, tilt = (r2() - .5) * .5;
        let prev = null;
        for (let i = 0; i <= 60; i++) {
          const a = a0 + span * (i / 60);
          const p = [Math.cos(a) * R, y + Math.sin(a) * R * tilt, Math.sin(a) * R - 30];
          if (prev) ap.push(prev[0], prev[1], prev[2], p[0], p[1], p[2]);
          prev = p;
        }
      }
      const ag = new T.BufferGeometry(); ag.setAttribute('position', new T.Float32BufferAttribute(ap, 3));
      this.arcs = new T.LineSegments(ag, this.mats.lineDim.clone()); this.scene.add(this.arcs);
    }

    _buildCursor() {
      const d = this.cursorEl = document.createElement('div');
      d.style.cssText = 'position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border:1px solid currentColor;border-radius:50%;opacity:0;transition:opacity .3s,width .18s,height .18s;pointer-events:none';
      this.labels.appendChild(d);
    }

    // ---------- html label layer ----------
    _mkLabel(html, opts = {}) {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;left:0;top:0;opacity:0;will-change:transform,opacity;transform:translate(-9999px,-9999px);white-space:nowrap;${opts.css || ''}`;
      d.innerHTML = html;
      this.labels.appendChild(d);
      return d;
    }

    _makeLabels() {
      const meta = "font:400 10px/1.4 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--meta)";
      const name = "font:400 15px/1 'Archivo',system-ui,sans-serif;letter-spacing:.01em;color:var(--fg)";
      this.nodeLabels = this.nodes.map((n, i) => this._mkLabel(
        `<div style="${name}">${SUBS[i][1]}</div><div style="${meta};margin-top:4px">${SUBS[i][2]}</div>`,
        { css: 'padding-left:12px;border-left:1px solid var(--rule)' }));
      this.hostLabels = this.hostSlabs.map((s, i) => this._mkLabel(
        `<div style="${meta}">HOST / ${String(i + 1).padStart(2, '0')}</div><div style="${name};margin-top:5px">${HOSTS[i]}</div>`));
      this.socketLabels = this.sockets.map((s, i) => this._mkLabel(`<div style="${meta}">${TOOLS[i]}</div>`));
      this.stopLabels = this.stopPts.map(s => this._mkLabel(
        `<div style="${meta};color:var(--brass)">${s.label}</div>`, { css: 'padding:3px 7px;border:1px solid var(--brass)' }));
      this.archLabels = this.archNodes.map(a => this._mkLabel(
        `<div style="font:400 17px/1 'Archivo',sans-serif;letter-spacing:.02em;color:var(--fg)">${a.label}</div>`,
        { css: 'transform-origin:center' }));
      this.agentLabel = this._mkLabel(
        `<div style="${meta};color:var(--brass)">AGENT</div><div style="font:400 18px/1 'Cormorant Garamond',serif;font-style:italic;color:var(--fg);margin-top:3px">Ponytail</div>`,
        { css: 'padding-left:10px;border-left:1px solid var(--brass)' });
      this.noteLabel = this._mkLabel('', { css: 'padding:8px 11px;background:var(--noteBg);border:1px solid var(--rule);max-width:230px;white-space:normal' });
    }

    _place(el, v3, obj, opts = {}) {
      const p = v3.clone();
      if (obj) obj.localToWorld(p);
      p.project(this.cam);
      const w = this.vw, h = this.vh;
      const x = (p.x * .5 + .5) * w + (opts.dx || 0), y = (-p.y * .5 + .5) * h + (opts.dy || 0);
      const vis = p.z < 1 && x > 26 && x < w - 26 && y > 88 && y < h - 64;
      let o = vis ? (opts.o == null ? 1 : opts.o) : 0;
      // keep the annotation layer out of the editorial copy column on the left
      if (o > 0 && !opts.center && x < w * .36 && this.cf < 7.05) o *= .12;
      el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)` + (opts.center ? ' translate(-50%,-50%)' : '');
      el.style.opacity = o;
      return { x, y, vis };
    }

    // ---------- events ----------
    _bind() {
      this._onResize = () => {
        const w = this.vw, h = this.vh;
        this.renderer.setSize(w, h); this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
        this.small = w < 900;
      };
      window.addEventListener('resize', this._onResize);
      this.ray = new this.T.Raycaster();
      this._last = { x: 0, y: 0, t: performance.now() };
      window.addEventListener('pointermove', (e) => {
        const r = this.getBoundingClientRect();
        this.ptr.tx = (e.clientX - r.left) / r.width * 2 - 1;
        this.ptr.ty = -((e.clientY - r.top) / r.height * 2 - 1);
        this.ptr.px = e.clientX - r.left; this.ptr.py = e.clientY - r.top;
        const now = performance.now(), dt = Math.max(16, now - this._last.t);
        const d = Math.hypot(e.clientX - this._last.x, e.clientY - this._last.y);
        this.ptr.speed = lerp(this.ptr.speed, Math.min(1, d / dt * 0.28), .3);
        this._last = { x: e.clientX, y: e.clientY, t: now };
        this._pick();
      }, { passive: true });
      this.addEventListener('pointerdown', () => { if (this.hover) this.select(this.hover); });
    }

    _pick() {
      if (!this.nodes || this.cf < 2.4 || this.cf > 7.6) { this._setHover(null); return; }
      this.ray.setFromCamera({ x: this.ptr.tx, y: this.ptr.ty }, this.cam);
      const hit = this.ray.intersectObjects(this.nodes, false)[0];
      this._setHover(hit ? hit.object.userData.id : null);
    }

    _setHover(id) {
      if (this.hover === id) return;
      this.hover = id;
      this.dispatchEvent(new CustomEvent('world-hover', { detail: { id, label: id ? SUBS.find(s => s[0] === id)[1] : null } }));
    }

    // ---------- public api ----------
    setProgress(p) {
      this.progress = clamp(p, 0, 1);
      let i = 0; while (i < BP.length - 2 && this.progress >= BP[i + 1]) i++;
      const local = (this.progress - BP[i]) / (BP[i + 1] - BP[i]);
      this.cf = i + clamp(local, 0, 1);
      this._chapterLogs();
    }
    select(id) {
      this.selected = this.selected === id ? null : id;
      this.dispatchEvent(new CustomEvent('world-select', { detail: { id: this.selected } }));
    }
    attachTool(i) {
      if (this.attached.has(i)) return false;
      this.attached.add(i);
      this._log('tool attached — ' + TOOLS[i].toLowerCase());
      this._log('context mounted');
      return true;
    }
    socketScreenPositions() {
      if (!this.sockets) return [];
      return this.sockets.map((s, i) => {
        const p = s.position.clone(); this.toolsG.localToWorld(p); p.project(this.cam);
        return { i, name: TOOLS[i], attached: this.attached.has(i), x: (p.x * .5 + .5) * this.vw, y: (-p.y * .5 + .5) * this.vh, vis: p.z < 1 };
      });
    }
    runAgent() { this.manualAgent = 0.0001; this._log('agent awake'); }
    command(name) {
      const n = name.trim().toLowerCase();
      if (n === 'rig init') { this.overrides.init = 1; this._log('coordinate system stable'); return ['assembling environment', 'rings 4 · nodes 9 · core online', 'coordinate system stable']; }
      if (n === 'rig connect') { HOSTS.forEach(() => 0); this.overrides.connect = 1; this._log('host detected'); return ['scanning hosts', ...HOSTS.map(h => `+ ${h.toLowerCase()} attached`), 'topology reconciled']; }
      if (n === 'rig status') { this.overrides.status = 1; return ['rig 0.4.1 · qaynel', `hosts ${HOSTS.length}/5 · tools ${this.attached.size}/8 · agents 1`, 'observability streaming']; }
      if (n === 'rig run ponytail') { this.runAgent(); return ['ponytail awake', 'route: repository → documentation → terminal', '       → remote host → test suite → result']; }
      if (n === 'rig eclipse') { this.overrides.eclipse = this.overrides.eclipse ? 0 : 1; return ['ambient state toggled']; }
      if (n === 'rig collapse') { this.overrides.collapse = 1; return ['compressing topology into sigil']; }
      if (n === 'help' || n === '?') return ['rig init · rig connect · rig status', 'rig run ponytail · rig eclipse · rig collapse']; 
      if (n === 'whoami') return ['visitor · read access · coordinate system stable'];
      return [`unknown command: ${n}`, 'try: help'];
    }
    _log(msg) { this.dispatchEvent(new CustomEvent('world-log', { detail: { msg } })); }
    _chapterLogs() {
      const marks = [[2.5, 'coordinate system stable'], [3.4, 'topology resolved'], [4.4, 'tool bus online'], [5.4, 'host detected'], [6.3, 'agent awake'], [6.9, 'execution path resolved'], [7.6, 'projection orthographic'], [8.6, 'system compressed']];
      marks.forEach(([at, msg]) => { if (this.cf >= at && !this._logged[msg]) { this._logged[msg] = 1; this._log(msg); } });
    }

    // ---------- frame ----------
    _loop() {
      const T = this.T, clock = new T.Clock();
      const camPos = new T.Vector3(), camLook = new T.Vector3(), tmp = new T.Vector3();
      const day = C.day, night = C.night;
      const col = (a, b, t) => new T.Color(a).lerp(new T.Color(b), t);
      const tick = () => {
        this._raf = requestAnimationFrame(tick);
        const dt = Math.min(.05, clock.getDelta()), time = clock.elapsedTime;
        const cf = this.cf;
        this.ptr.x = lerp(this.ptr.x, this.ptr.tx, .06);
        this.ptr.y = lerp(this.ptr.y, this.ptr.ty, .06);
        const calm = 1 - this.ptr.speed * .7;

        // ---- theme ----
        let th = sstep(5.85, 6.35, cf) * (1 - sstep(8.05, 8.6, cf));
        if (this.overrides.eclipse) th = Math.max(th, .96);
        this.theme = lerp(this.theme, th, .07);
        const tt = this.theme;
        const bg = col(day.bg, night.bg, tt);
        this.scene.background.copy(bg); this.scene.fog.color.copy(bg);
        const inkC = col(day.ink, night.ink, tt), lineC = col(day.line, night.line, tt), brassC = col(day.brass, night.brass, tt);
        this.scene.traverse(o => {
          const m = o.material; if (!m || !m.color) return;
          if (m.userData.role === undefined) {
            const c = '#' + m.color.getHexString().toUpperCase();
            m.userData.role = (c === '#181A1C') ? 'ink' : (c === '#C9B58E') ? 'line' : (c === '#A6844F') ? 'brass' : 'x';
          }
        });
        if (!this._themeStamp || Math.abs(this._themeStamp - tt) > 0.004) {
          this._themeStamp = tt;
          this.scene.traverse(o => {
            const m = o.material; if (!m || !m.userData || !m.userData.role) return;
            if (m.userData.role === 'ink') m.color.copy(inkC);
            else if (m.userData.role === 'line') m.color.copy(lineC);
            else if (m.userData.role === 'brass') m.color.copy(brassC);
          });
          this.dispatchEvent(new CustomEvent('world-theme', { detail: { t: tt } }));
        }

        // ---- camera ----
        const ci = Math.min(KEY.length - 2, Math.floor(cf)), ct = cf - ci;
        const e = ct * ct * (3 - 2 * ct);
        const A = KEY[ci], B = KEY[ci + 1];
        camPos.set(lerp(A.p[0], B.p[0], e), lerp(A.p[1], B.p[1], e), lerp(A.p[2], B.p[2], e));
        camLook.set(lerp(A.l[0], B.l[0], e), lerp(A.l[1], B.l[1], e), lerp(A.l[2], B.l[2], e));
        const orbit = cf > 2.8 && cf < 7.2 ? Math.sin(time * .06) * 1.9 : 0;
        camPos.x += orbit + this.ptr.x * (1.5 + sstep(2, 3, cf) * 2.2);
        camPos.y += this.ptr.y * (1.0 + sstep(2, 3, cf) * 1.4);
        this.cam.position.lerp(camPos, .085);
        this.cam.lookAt(camLook);
        const fov = lerp(A.f, B.f, e);
        if (Math.abs(this.cam.fov - fov) > .01) { this.cam.fov = lerp(this.cam.fov, fov, .1); this.cam.updateProjectionMatrix(); }

        // ---- sigil: quiet -> unfold -> gone -> reassemble ----
        const fitS = clamp((this.vh - 210) / 760, .52, 1);
        this.sigil.position.y = 1.35 + (1 - fitS) * 1.5;
        const open = sstep(0.85, 2.15, cf);
        const collapse = this.overrides.collapse ? 1 : sstep(8.05, 8.92, cf);
        const back = collapse;
        this.sigilParts.forEach((m, i) => {
          const ud = m.userData;
          const amt = open * (1 - back);
          tmp.copy(ud.home).addScaledVector(ud.out, amt);
          const hoverSep = (cf < 1.2 ? (1 - sstep(.6, 1.2, cf)) : 0) * .16;
          tmp.x += this.ptr.x * hoverSep * (1 + i % 4) * .5;
          tmp.y += this.ptr.y * hoverSep * (1 + i % 3) * .5;
          tmp.z += Math.sin(time * .5 + i) * .015 + this.ptr.x * hoverSep * (i % 5) * .3;
          m.position.lerp(tmp, .12);
          m.rotation.z = lerp(m.rotation.z, ud.baseRot + ud.spin * amt, .1);
          const op = clamp(1 - open * 1.25 + back * 1.4, 0, 1);
          if (m.material.transparent !== true) { m.material = m.material.clone(); m.material.transparent = true; }
          m.material.opacity = op;
          m.visible = op > .02;
        });
        this.sigilLines.material.opacity = clamp((.22 * (1 - open)) + .22 * back, 0, .3) * calm;
        this.sigil.rotation.y = this.ptr.x * .16 * (1 - open) + (1 - back) * 0;
        this.sigil.rotation.x = -this.ptr.y * .12 * (1 - open);
        this.sigil.scale.setScalar(lerp(1, .92, open * (1 - back)) * fitS);

        // ---- rig ----
        const rigIn = sstep(1.7, 2.9, cf) * (1 - sstep(8.05, 8.75, cf)) * (this.overrides.collapse ? 0 : 1);
        const flat = sstep(6.9, 7.7, cf);
        const archIn = sstep(6.95, 7.4, cf) * (1 - sstep(8.0, 8.4, cf));
        const solid = 1 - archIn * .88;
        this.rig.visible = this.toolsG.visible = rigIn > .01;
        this.rig.rotation.x = lerp(-0.34, 0, flat);
        this.rig.rotation.z += dt * .012 * calm;
        this.rig.scale.setScalar(lerp(.2, 1, rigIn) * lerp(1, .55, collapse));
        this.toolsG.rotation.copy(this.rig.rotation);
        this.toolsG.scale.copy(this.rig.scale);
        this.agentG.rotation.copy(this.rig.rotation);
        this.agentG.scale.copy(this.rig.scale);
        this.rings.forEach((r, i) => {
          r.rotation.z += dt * (.05 - i * .012) * calm;
          r.material.opacity = (i === 3 ? .3 : .78) * rigIn * lerp(1, .35, flat) * solid;
        });
        this.ticks.material.opacity = .4 * rigIn * lerp(1, .12, flat) * solid;
        this.core.rotation.y += dt * .3 * calm; this.core.rotation.x += dt * .12;
        const pulse = .5 + .5 * Math.sin(time * 1.7);
        this.core.scale.setScalar(lerp(.85, 1, rigIn) * (1 + pulse * .012 + (this.agentRun > 0 ? .05 : 0)));
        this.coreCage.material.opacity = .35 * rigIn;

        // node emphasis
        const sel = this.selected, hov = this.hover;
        this.nodes.forEach((n, i) => {
          const id = n.userData.id;
          const focus = (sel ? id === sel : hov ? id === hov : false);
          const dim = (sel || hov) && !focus ? .28 : 1;
          n.material.opacity = rigIn * dim * lerp(1, .5, flat) * solid;
          n.material.color.copy(focus ? brassC : inkC);
          const s = lerp(1, 1.45, focus ? 1 : 0);
          n.scale.lerp(tmp.set(s, s, s), .18);
          n.rotation.y += dt * (focus ? 1.1 : .16);
          const push = focus ? .45 : 0;
          n.position.lerp(n.userData.base.clone().multiplyScalar(1 + push / 8), .16);
          this.spokes[i].material.opacity = .5 * rigIn * dim * lerp(1, .3, flat) * solid;
          this.spokes[i].material.color.copy(focus ? brassC : lineC);
          const lb = this.nodeLabels[i];
          const showNode = rigIn * (1 - flat) * (dim === 1 ? 1 : .3) * sstep(2.6, 3.1, cf);
          this._place(lb, n.position.clone(), this.rig, { dx: 22, dy: -14, o: showNode * (focus ? 1 : .55) });
        });
        // annotation for selection
        const noteId = sel || hov;
        if (noteId) {
          const idx = SUBS.findIndex(s => s[0] === noteId);
          if (this._noteId !== noteId) {
            this._noteId = noteId;
            this.noteLabel.innerHTML = `<div style="font:400 10px/1.4 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--meta)">${SUBS[idx][2]}</div>
              <div style="font:400 22px/1.1 'Cormorant Garamond',serif;color:var(--fg);margin:6px 0 4px">${SUBS[idx][1]}</div>
              <div style="font:400 12px/1.5 'Archivo',sans-serif;color:var(--meta)">${SUB_NOTE[noteId]}</div>`;
          }
          this._place(this.noteLabel, this.nodes[idx].position.clone(), this.rig, { dx: 26, dy: 24, o: rigIn * (1 - flat) });
        } else this.noteLabel.style.opacity = 0;

        // ---- tools: attach on scroll, or by drag ----
        this.toolMeshes.forEach((m, i) => {
          const auto = sstep(3.9 + i * .07, 4.35 + i * .07, cf);
          const t = Math.max(this.attached.has(i) ? 1 : 0, auto);
          m.userData.t = lerp(m.userData.t, t, .12);
          const k = m.userData.t;
          const eased = k < .8 ? k : 1 - Math.pow(1 - (k - .8) / .2, 3) * .0; // magnetic finish
          tmp.copy(m.userData.far).lerp(m.userData.target, eased * eased * (3 - 2 * eased));
          tmp.z += Math.sin(time * .8 + i) * .04 * (1 - k);
          m.position.copy(tmp);
          m.rotation.z = lerp(1.1, 0, k);
          m.children[0].material.opacity = rigIn * k * .95 * lerp(1, .4, flat) * solid;
          m.children[1].material.opacity = rigIn * k * .8 * solid;
          this.sockets[i].material.opacity = rigIn * lerp(.18, .7, k) * lerp(1, .25, flat) * sstep(3.3, 3.9, cf) * solid;
          this.sockets[i].scale.setScalar(1 + (1 - k) * .06 * Math.sin(time * 3 + i));
          this._place(this.socketLabels[i], this.sockets[i].position.clone(), this.toolsG, { dx: 14, dy: -6, o: rigIn * k * (1 - flat) * sstep(3.6, 4.1, cf) * .8 });
        });

        // ---- hosts ----
        const hostIn = (sstep(4.5, 5.3, cf) * (1 - sstep(6.85, 7.35, cf)));
        this.hosts.visible = hostIn > .01;
        this.hostSlabs.forEach((s, i) => {
          const link = Math.max(sstep(5.0 + i * .06, 5.55 + i * .06, cf), this.overrides.connect ? 1 : 0);
          s.children[0].material.opacity = .55 * hostIn;
          s.children[1].material.opacity = .07 * hostIn;
          s.children[2].material.opacity = .5 * hostIn * link;
          s.children[2].material.color.copy(link > .5 ? brassC : inkC);
          const base = s.userData.base;
          s.position.set(base.x * lerp(1.35, 1, link), base.y, base.z + Math.sin(time * .3 + i) * .3);
          s.lookAt(this.cam.position);
          const ln = this.hostLinks[i];
          const arr = ln.geometry.attributes.position;
          arr.setXYZ(1, s.position.x, s.position.y, s.position.z);
          arr.setXYZ(0, s.position.x * (1 - link), s.position.y * (1 - link), s.position.z * (1 - link));
          arr.needsUpdate = true;
          ln.material.opacity = .8 * hostIn * link;
          this._place(this.hostLabels[i], s.position.clone(), null, { dx: 18, dy: 14, o: hostIn * .9 });
        });

        // ---- agent ----
        const autoRun = sstep(5.95, 6.85, cf);
        if (this.manualAgent > 0 && this.manualAgent < 1) this.manualAgent = Math.min(1, this.manualAgent + dt * .16);
        else if (this.manualAgent >= 1) {
          this.manualFade = (this.manualFade == null ? 1 : this.manualFade - dt * .45);
          if (this.manualFade <= 0) { this.manualAgent = 0; this.manualFade = null; }
        }
        const manualOn = this.manualAgent > 0 ? (this.manualFade == null ? 1 : Math.max(0, this.manualFade)) : 0;
        const run = Math.max(autoRun, this.manualAgent);
        this.agentRun = run > 0 && run < 1 ? run : 0;
        const agentIn = Math.max(sstep(5.6, 6.0, cf) * (1 - sstep(6.85, 7.3, cf)), manualOn);
        this.agentG.visible = agentIn > .01;
        const at = clamp(run, 0, 1);
        const pos = this.curve.getPointAt(Math.min(.999, at));
        this.token.position.copy(pos);
        this.token.rotation.x += dt * 1.4; this.token.rotation.y += dt * 1.1;
        this.token.material.opacity = 1;
        this.trace.geometry.setDrawRange(0, Math.floor(at * 420));
        this.trace.material.opacity = .9 * agentIn;
        this._place(this.agentLabel, pos.clone(), this.agentG, { dx: 18, dy: -18, o: agentIn });
        this.stopPts.forEach((s, i) => {
          const reach = clamp((at - (i + .6) / (STOPS.length + .4)) * 7, 0, 1);
          const fade = clamp(1 - (at - (i + 2.0) / (STOPS.length + .4)) * 3.2, 0, 1);
          this._place(this.stopLabels[i], s.p.clone(), this.agentG, { dx: 12, dy: 16, o: agentIn * reach * fade });
        });
        // dim the rig while the agent runs
        const dimAll = agentIn * (run > 0 && run < 1 ? .55 : .2);
        this.rings.forEach((r, i) => r.material.opacity *= (1 - dimAll * .6));
        this.ticks.material.opacity *= (1 - dimAll * .8);

        // ---- architecture projection ----
        this.arch.visible = archIn > .01;
        this.arch.traverse(o => { if (o.material) o.material.opacity = archIn * .8; });
        this.archLabels.forEach((el, i) => this._place(el, this.archNodes[i].pos.clone(), this.arch, { o: archIn, center: true }));

        // ---- ambient ----
        this.sky.rotation.y += dt * .006; this.arcs.rotation.y -= dt * .004;
        this.mats.star.opacity = (.18 + .42 * tt) * calm;
        this.arcs.material.opacity = (.14 + .1 * (1 - tt)) * calm;

        // ---- cursor ----
        if (this.cursorEl && this.ptr.px != null) {
          let cx = this.ptr.px, cy = this.ptr.py, mag = 0;
          if (this.hover) {
            const i = this.nodes.findIndex(n => n.userData.id === this.hover);
            const p = this.nodes[i].position.clone(); this.rig.localToWorld(p); p.project(this.cam);
            cx = lerp(cx, (p.x * .5 + .5) * this.vw, .55);
            cy = lerp(cy, (-p.y * .5 + .5) * this.vh, .55);
            mag = 1;
          }
          const s = mag ? 44 : 26;
          this.cursorEl.style.width = this.cursorEl.style.height = s + 'px';
          this.cursorEl.style.margin = `${-s / 2}px 0 0 ${-s / 2}px`;
          this.cursorEl.style.transform = `translate(${cx}px,${cy}px)`;
          this.cursorEl.style.color = mag ? 'var(--brass)' : 'var(--rule)';
          this.cursorEl.style.opacity = cf > 2.4 && cf < 8 ? (mag ? .9 : .35) : 0;
        }

        this.renderer.render(this.scene, this.cam);
      };
      tick();
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      this._raf = null;
      window.removeEventListener('resize', this._onResize);
    }
  }
  customElements.define('qaynel-world', QaynelWorld);
  window.QAYNEL_TOOLS = TOOLS;
})();

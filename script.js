function getRectInfo(id){
  const el = document.getElementById(id);
  const cont = document.getElementById('diagram');
  const r = el.getBoundingClientRect();
  const c = cont.getBoundingClientRect();
  return {
    cx: r.left + r.width/2 - c.left,
    cy: r.top  + r.height/2 - c.top,
    hw: r.width/2,
    hh: r.height/2
  };
}

// Given a rectangle center and half-sizes and a direction vector v to external point,
// return intersection point at rectangle border along that direction.
function edgePointTowards(rectInfo, vx, vy){
  // If the vector is zero, return center
  if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) return {x: rectInfo.cx, y: rectInfo.cy};

  // Solve t so that cx + t*vx touches rectangle boundary:
  // t1 = hw / |vx| , t2 = hh/ |vy|
  let tx = Infinity, ty = Infinity;
  if (Math.abs(vx) > 1e-6) tx = rectInfo.hw / Math.abs(vx);
  if (Math.abs(vy) > 1e-6) ty = rectInfo.hh / Math.abs(vy);
  const t = Math.min(tx, ty);
  // small shrink to avoid overlap exactly at corner
  const shrink = 0.08;
  const scale = Math.max(0, t - shrink);
  return { x: rectInfo.cx + vx * scale, y: rectInfo.cy + vy * scale };
}

// Create or update a curved arrow path between two boxes (fromId->toId). id is unique per step.
function drawCurvedArrow(fromId, toId, id){
  const startInfo = getRectInfo(fromId);
  const endInfo   = getRectInfo(toId);

  // vector from start center to end center
  const vx = endInfo.cx - startInfo.cx;
  const vy = endInfo.cy - startInfo.cy;
  const start = edgePointTowards(startInfo, vx, vy);
  const end   = edgePointTowards(endInfo, -vx, -vy);

  // midpoint
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;

  // distance
  const dist = Math.hypot(end.x - start.x, end.y - start.y);

  // perpendicular vector (for offsetting control point)
  let px = -(end.y - start.y);
  let py = (end.x - start.x);
  const plen = Math.hypot(px, py) || 1;
  px /= plen; py /= plen;

  // choose offset magnitude: larger for longer connections but clamp
  const offset = Math.min(140, Math.max(28, dist / 3));

  // To make curve consistent (not flip), decide sign based on cross product of (start->end) and (start center -> container center)
  // Simpler heuristic: push curve outward from center of diagram
  const container = document.getElementById('diagram').getBoundingClientRect();
  const centerX = container.width/2;
  const centerY = container.height/2;
  // vector from midpoint to container center
  const vmx = centerX - mx;
  const vmy = centerY - my;
  // dot of perp and (mid->center) decides whether to flip
  const dot = px*vmx + py*vmy;
  const sign = (dot > 0) ? -1 : 1;

  const cx = mx + px * offset * sign;
  const cy = my + py * offset * sign;

  // build quadratic bézier path
  const pathD = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;

  const svg = document.getElementById('arrowLayer');
  let path = document.getElementById('arrow-' + id);
  if (!path){
    path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('id', 'arrow-' + id);
    path.setAttribute('class', 'arrow');
    svg.appendChild(path);
  }
  path.setAttribute('d', pathD);
  return path;
}

// highlight logic: activate box and optionally arrow
function highlightStep(boxId, msg, stepId, fromId, toId){
  // clear previous
  
  
  document.querySelectorAll('.box').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('path.arrow').forEach(p => p.classList.remove('active'));

  // active box
  if (boxId){
    const box = document.getElementById(boxId);
    if (box) box.classList.add('active');
   
  }
  // message
  document.getElementById('status').textContent = msg;

  // draw arrow if needed
  if (fromId && toId){
    const path = drawCurvedArrow(fromId, toId, stepId);
    // style marker color to match stroke
    const strokeColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-2') || '#ff006e';
    path.classList.add('active');
    // ensure marker color update: clone marker fill is okay to leave default
  }
}

// parse instruction like "ADD R1,R2" - return {op,dst,src} or null
function parseInstr(text){
  if (!text) return null;
  const t = text.trim().toUpperCase();
  // support forms like "ADD R1, R2" or "MOV R1,R2"
  const m = t.match(/^([A-Z]+)\s+([A-Z0-9]+)\s*,\s*([A-Z0-9]+)$/);
  if (!m) return null;
  return { op: m[1], dst: m[2], src: m[3] };
}

// build steps arrays per instruction
function stepsForInstruction(op, r1, r2, instrText){
  // r1,r2 are numeric values
  const steps = [
    { box:'PC', msg:'PC → MAR', from:'PC', to:'MAR' },
    { box:'MAR', msg:'MAR → MDR (read instruction)', from:'MAR', to:'MDR' },
    { box:'MDR', msg:'MDR → IR (instruction fetched)', from:'MDR', to:'IR' },
    { box:'IR', msg:`IR = ${instrText}` }
  ];

  if (op === 'ADD' || op === 'SUB' || op === 'MUL'){
    let result;
    if (op === 'ADD') result = (r1 + r2) & 0xFFFF;
    if (op === 'SUB') result = (r1 - r2) & 0xFFFF;
    if (op === 'MUL') result = (r1 * r2) & 0xFFFF;
    // show execution micro-ops
    steps.push({ box:'R1', msg:`R1 (${r1.toString(16).toUpperCase()}) → Y`, from:'R1', to:'Y' });
    steps.push({ box:'Y', msg:`Y → ALU`, from:'Y', to:'ALU' });
    steps.push({ box:'R2', msg:`R2 (${r2.toString(16).toUpperCase()}) → ALU`, from:'R2', to:'ALU' });
    steps.push({ box:'ALU', msg:`ALU ${op} → Z = ${result.toString(16).toUpperCase()}`, from:'ALU', to:'Z' });
    steps.push({ box:'Z', msg:`Z → R1 = ${result.toString(16).toUpperCase()}`, from:'Z', to:'R1', result });
    return { steps, result };
  }

  if (op === 'MOV'){
    const result = r2 & 0xFFFF;
    steps.push({ box:'R2', msg:`R2 (${r2.toString(16).toUpperCase()}) → MDR`, from:'R2', to:'MDR' });
    steps.push({ box:'MDR', msg:`MDR → R1 = ${result.toString(16).toUpperCase()}`, from:'MDR', to:'R1', result});
    return { steps, result };
  }

  // unsupported: just return fetch steps
  return { steps, result: null };
}

// animate sequence
async function runAnimation(steps){
  // ensure arrow elements exist and recompute path before each step (for responsive positioning)
  for (let i=0;i<steps.length;i++){
    const s = steps[i];
    highlightStep(s.box, s.msg, i, s.from, s.to);
    // keep arrow visible for duration and recompute path every 60ms (in case window resize)
    const dur = 1600;
    const tick = 60;
    const loops = Math.floor(dur/tick);
    for (let j=0;j<loops;j++){
      if (s.from && s.to){
        // update the path (recompute geometry) so arrow stays accurately placed
        drawCurvedArrow(s.from, s.to, i);
      }
      await new Promise(r => setTimeout(r, tick));
    }
    // small pause
    await new Promise(r => setTimeout(r, 120));
  }
}

// top-level run handler
document.getElementById('runBtn').addEventListener('click', async ()=>{
  // read inputs
  const r1hex = (document.getElementById('r1').value || '').trim();
  const r2hex = (document.getElementById('r2').value || '').trim();
  let r1 = parseInt(r1hex, 16);
  let r2 = parseInt(r2hex, 16);
  if (Number.isNaN(r1) || Number.isNaN(r2)){
    document.getElementById('status').textContent = 'Enter valid hex in R1 and R2';
    return;
  }
  // update visible box values
  document.getElementById('vR1').textContent = r1hex.toUpperCase();
  document.getElementById('vR2').textContent = r2hex.toUpperCase();
  // parse instruction
  const instrText = document.getElementById('instr').value.trim();
  const parsed = parseInstr(instrText);
  if (!parsed){
    document.getElementById('status').textContent = 'Instruction format invalid. Use: OPCODE R1,R2';
    return;
  }
  const op = parsed.op;
  document.getElementById('status').textContent = `Running ${op}...`;
  // compute steps
  const { steps, result } = stepsForInstruction(op, r1, r2, instrText.toUpperCase());

  // run animation
  await runAnimation(steps);

  // finalize: update result into R1 display if exists
  if (result !== null && typeof result !== 'undefined') {
    const out = (result & 0xFFFF).toString(16).toUpperCase().padStart(2, '0');
    // update the R1 input and visible box value
    if (op === 'MOV') {
      // MOV R1,R2 semantics: R1 <- R2
      document.getElementById('r1').value = out;
      document.getElementById('vR1').textContent = out;
    } else {
      document.getElementById('r1').value = out;
      document.getElementById('vR1').textContent = out;
    }
    document.getElementById('status').textContent = `Done — ${op} result: ${out}`;
  } else {
    document.getElementById('status').textContent = `Done — ${op} (no numeric result)`;
  }
});

// reset button clears arrows and box highlights
document.getElementById('resetBtn').addEventListener('click', ()=>{
  document.querySelectorAll('path.arrow').forEach(p=>p.remove());
  document.querySelectorAll('.box').forEach(b => b.classList.remove('active'));

  // restore visible R1/R2 from inputs
  document.getElementById('vR1').textContent = (document.getElementById('r1').value || '').toUpperCase();
  document.getElementById('vR2').textContent = (document.getElementById('r2').value || '').toUpperCase();
  document.getElementById('status').textContent = 'Reset';
});

// initialize visible values
document.getElementById('vR1').textContent = (document.getElementById('r1').value || '').toUpperCase();
document.getElementById('vR2').textContent = (document.getElementById('r2').value || '').toUpperCase();



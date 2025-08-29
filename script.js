function runInstruction() {
  let instr = document.getElementById("instruction").value.trim().toUpperCase();
  if(instr === "ADD R1,R2" || instr === "ADD R1, R2"){
    animateADD();
  } else {
    alert("Only ADD R1,R2 supported in this demo.");
  }
}

// Get block center
function getCenter(el) {
  let rect = document.getElementById(el).getBoundingClientRect();
  let container = document.getElementById("container").getBoundingClientRect();
  return {
    x: rect.left - container.left + rect.width/2,
    y: rect.top - container.top + rect.height/2
  };
}

// Draw arrow between two blocks
function drawArrow(from, to) {
  let svg = document.getElementById("arrowLayer");
  svg.innerHTML = `
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5"
        orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" />
      </marker>
    </defs>
  `;

  let p1 = getCenter(from);
  let p2 = getCenter(to);

  let path = document.createElementNS("http://www.w3.org/2000/svg", "line");
  path.setAttribute("x1", p1.x);
  path.setAttribute("y1", p1.y);
  path.setAttribute("x2", p2.x);
  path.setAttribute("y2", p2.y);
  path.setAttribute("class", "arrow");
  svg.appendChild(path);
  return path;
}

function animateADD(){
  let data = document.getElementById("data");
  let stepsText = document.getElementById("steps");

  let R1val = parseInt(document.getElementById("R1val").value,16);
  let R2val = parseInt(document.getElementById("R2val").value,16);
  if(isNaN(R1val) || isNaN(R2val)){ alert("Enter valid hex values"); return; }

  let result = (R1val + R2val) & 0xFFFF;

  let tl = gsap.timeline();
  stepsText.innerHTML = "Starting ADD R1,R2...";

  let steps = [
    {from:"R1", to:"Y", text:`R1 (${R1val.toString(16).toUpperCase()}) → Y`, value:R1val},
    {from:"R2", to:"ALU", text:`R2 (${R2val.toString(16).toUpperCase()}) → ALU`, value:R2val},
    {from:"Y", to:"ALU", text:`Y (${R1val.toString(16).toUpperCase()}) → ALU`, value:R1val},
    {from:"ALU", to:"Z", text:`ALU adds → Z = ${result.toString(16).toUpperCase()}`, value:result},
    {from:"Z", to:"R1", text:`Result stored in R1 = ${result.toString(16).toUpperCase()}`, value:result}
  ];

  // start data
  let start = getCenter(steps[0].from);
  gsap.set(data, {x:start.x-25, y:start.y-25, opacity:1});

  steps.forEach((s,i)=>{
    let dest = getCenter(s.to);
    let arrow = drawArrow(s.from, s.to);

    tl.to(arrow, {opacity:1, duration:0.2, onStart:()=>{stepsText.innerHTML=s.text; data.innerHTML=s.value.toString(16).toUpperCase();}});
    tl.to(data, {x:dest.x-25, y:dest.y-25, duration:1.5});
    tl.to(arrow, {opacity:0, duration:0.2});
    
    if(s.to==="R1" && i===steps.length-1){
      tl.to({}, {duration:0.1, onComplete:()=>{ document.getElementById("R1val").value=s.value.toString(16).toUpperCase(); }});
    }
  });

  tl.to(data, {opacity:0, duration:0.5, onComplete:()=>{stepsText.innerHTML="Done ✅";}});
}


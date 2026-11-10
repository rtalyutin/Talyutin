import { createCatModel, camera } from "./cat-model.js";

// Transparent depth mesh + alpha-atlas glyph billboards anchored in model space.
// The mesh writes depth only: no solid polygon or rectangular texture is visible.
export function createCatVolume(container) {
  const canvas = document.createElement("canvas");
  canvas.className = "cat-volume";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });
  if (!gl) return null;
  const resources = [];
  let stopped = false,
    current = { x: 0, y: 0 };
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s));
    resources.push(() => gl.deleteShader(s));
    return s;
  }
  function program(vertex, fragment) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p));
    resources.push(() => gl.deleteProgram(p));
    return p;
  }
  const transform = `
 uniform vec2 uTurn; uniform vec2 uGaze; uniform vec2 uViewport;
 vec4 project(vec3 p,float pupil) {
  p.xy+=uGaze*pupil;
  float cy=cos(uTurn.x),sy=sin(uTurn.x),cx=cos(uTurn.y),sx=sin(uTurn.y);
  p=vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy);
  p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);
  p.y-=${camera.centerY.toFixed(2)};p.z-=${camera.distance.toFixed(2)};
  float near=.1,far=20.;
  return vec4(p.x*${camera.focal.toFixed(2)}*uViewport.y/uViewport.x,p.y*${camera.focal.toFixed(2)},-(far+near)/(far-near)*p.z-2.*far*near/(far-near),-p.z);
 }`;
  const depthProgram = program(
    `attribute vec3 aPosition;attribute float aPupil;${transform}void main(){gl_Position=project(aPosition,aPupil);}`,
    `precision mediump float;void main(){gl_FragColor=vec4(0.);}`,
  );
  const glyphProgram = program(
    `attribute vec3 aPosition;attribute vec3 aColor;attribute vec2 aCorner;attribute float aLetter;attribute float aPupil;${transform}
 varying vec2 vUv;varying vec3 vColor;
 void main(){vec4 p=project(aPosition,aPupil);float size=uViewport.x/640.;p.xy+=aCorner*vec2(5.8,9.)*size/uViewport*2.*p.w;
 gl_Position=p;vUv=vec2((aLetter+aCorner.x+.5)/12.,aCorner.y+.5);vColor=aColor;}`,
    `precision mediump float;uniform sampler2D uAtlas;varying vec2 vUv;varying vec3 vColor;
 void main(){float alpha=texture2D(uAtlas,vUv).a;if(alpha<.08)discard;gl_FragColor=vec4(vColor,alpha);}`,
  );
  const model = createCatModel(),
    depth = [],
    glyphs = [];
  const letters = "01:+*0@#8%;=";
  const corners = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [-0.5, 0.5],
    [-0.5, 0.5],
    [0.5, -0.5],
    [0.5, 0.5],
  ];
  for (const triangle of model.triangles)
    for (const v of triangle.vertices)
      depth.push(...v.p, triangle.part === "pupil" ? 1 : 0);
  for (const glyph of model.glyphs) {
    const color = glyph.color
      .slice(1)
      .match(/../g)
      .map((c) => parseInt(c, 16) / 255);
    const p = glyph.position.map((x, i) => x + glyph.normal[i] * 0.018);
    for (const corner of corners)
      glyphs.push(
        ...p,
        ...color,
        ...corner,
        Math.max(0, letters.indexOf(glyph.char)),
        glyph.part === "pupil" ? 1 : 0,
      );
  }
  function buffer(data) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    resources.push(() => gl.deleteBuffer(b));
    return b;
  }
  const depthBuffer = buffer(depth),
    glyphBuffer = buffer(glyphs);
  const atlas = document.createElement("canvas");
  atlas.width = 12 * 32;
  atlas.height = 48;
  const ink = atlas.getContext("2d");
  ink.font = "bold 32px monospace";
  ink.fillStyle = "#fff";
  ink.textAlign = "center";
  ink.textBaseline = "middle";
  for (let i = 0; i < 12; i++) ink.fillText(letters[i], i * 32 + 16, 24);
  const texture = gl.createTexture();
  resources.push(() => gl.deleteTexture(texture));
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  function attribute(p, name, size, stride, offset) {
    const index = gl.getAttribLocation(p, name);
    if (index < 0) return;
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(
      index,
      size,
      gl.FLOAT,
      false,
      stride * 4,
      offset * 4,
    );
  }
  function uniforms(p) {
    gl.uniform2f(
      gl.getUniformLocation(p, "uViewport"),
      canvas.width,
      canvas.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(p, "uTurn"),
      current.x * 0.006,
      current.y * 0.005,
    );
    gl.uniform2f(
      gl.getUniformLocation(p, "uGaze"),
      current.x * 0.006,
      -current.y * 0.006,
    );
  }
  function render(value = current) {
    if (stopped || gl.isContextLost()) return;
    current = value;
    const rect = container.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(rect.width * dpr)),
      height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(depthProgram);
    uniforms(depthProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, depthBuffer);
    attribute(depthProgram, "aPosition", 3, 4, 0);
    attribute(depthProgram, "aPupil", 1, 4, 3);
    gl.colorMask(false, false, false, false);
    gl.depthMask(true);
    gl.drawArrays(gl.TRIANGLES, 0, depth.length / 4);
    gl.colorMask(true, true, true, true);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(glyphProgram);
    uniforms(glyphProgram);
    gl.uniform1i(gl.getUniformLocation(glyphProgram, "uAtlas"), 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphBuffer);
    attribute(glyphProgram, "aPosition", 3, 10, 0);
    attribute(glyphProgram, "aColor", 3, 10, 3);
    attribute(glyphProgram, "aCorner", 2, 10, 6);
    attribute(glyphProgram, "aLetter", 1, 10, 8);
    attribute(glyphProgram, "aPupil", 1, 10, 9);
    gl.drawArrays(gl.TRIANGLES, 0, glyphs.length / 10);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
  try {
    container.append(canvas);
    render();
    container.classList.add("volume-ready");
    container.dataset.renderer = "webgl";
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      stopped = true;
      container.classList.remove("volume-ready");
      container.dataset.renderer = "fallback";
    });
    const resize = new ResizeObserver(() => render());
    resize.observe(container);
    return {
      render,
      neutral() {
        current = { x: 0, y: 0 };
        render();
      },
      dispose() {
        stopped = true;
        resize.disconnect();
        for (const free of resources) free();
        canvas.remove();
        container.classList.remove("volume-ready");
      },
    };
  } catch (error) {
    for (const free of resources) free();
    canvas.remove();
    return null;
  }
}

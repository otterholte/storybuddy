// WebGL2 mesh renderer: textured, deforming triangle meshes with premultiplied alpha,
// stencil clip masks, supersampled scene buffer and a grading/bloom post pass.
export class Renderer {
  constructor(canvas, { ssaa = 2 } = {}) {
    this.canvas = canvas; this.W = canvas.width; this.H = canvas.height; this.ss = ssaa;
    const gl = this.gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: false, stencil: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 unavailable');
    // sprite: textured mesh, optionally lit with a baked normal map (key + fill + rim, wrap/SSS for skin,
    // Blinn or strand-anisotropic specular, AO from the normal map's blue channel)
    this.sprite = this.program(`#version 300 es
      in vec2 aPos; in vec2 aUv; in float aA; in vec2 aDu; in vec2 aDv;
      uniform mat3 uCam; out vec2 vUv; out float vA; out vec2 vDu; out vec2 vDv;
      void main(){ vec3 p = uCam * vec3(aPos,1.0); gl_Position = vec4(p.xy,0.0,1.0); vUv=aUv; vA=aA; vDu=aDu; vDv=aDv; }`,
      `#version 300 es
      precision highp float; in vec2 vUv; in float vA; in vec2 vDu; in vec2 vDv;
      uniform sampler2D uTex; uniform sampler2D uNrm;
      uniform vec4 uTint; uniform vec3 uAdd; uniform float uOpacity; uniform vec4 uSolid; uniform vec3 uAlbGain, uAlbAdd; uniform float uAlbMono;
      uniform float uLit, uNrmOn, uNrmStr, uSss, uSpec, uGloss, uAniso, uRimAmt, uShadeMix;
      uniform vec3 uKeyDir, uKeyCol, uFillDir, uFillCol, uRimCol, uAmb, uSssCol; uniform vec2 uRimDir;
      out vec4 o;
      void main(){ vec4 c = texture(uTex, vUv);
        if (uSolid.a > 0.0) c = vec4(uSolid.rgb * c.a, c.a);
        c.rgb = mix(c.rgb, vec3(dot(c.rgb, vec3(0.3, 0.59, 0.11))), uAlbMono) * uAlbGain + uAlbAdd * c.a;   // albedo recolour (creator looks); identity by default
        if (uLit > 0.5 && c.a > 0.002) {
          vec3 alb = c.rgb / c.a;
          vec3 nt = vec3(0.0, 0.0, 1.0); float ao = 1.0, smk = 1.0;
          if (uNrmOn > 0.5) { vec4 nm = texture(uNrm, vUv); vec2 nxy = (nm.rg * 2.0 - 1.0) * uNrmStr; nt = normalize(vec3(nxy, sqrt(max(0.02, 1.0 - dot(nxy, nxy))))); float hiB = step(0.5, nm.b); smk = mix(0.12, 1.0, hiB); ao = mix(1.0, (nm.b - hiB * 0.502) * 2.0, 0.85); }
          vec2 du = normalize(vDu + 1e-6), dv = normalize(vDv + 1e-6);
          vec3 n = normalize(vec3(du * nt.x + dv * nt.y, nt.z));
          float ndl = dot(n, uKeyDir);
          float w = uSss * 0.55;
          float dif = clamp((ndl + w) / (1.0 + w), 0.0, 1.0);
          float sss = clamp((ndl + 0.7) / 1.7, 0.0, 1.0) - clamp(ndl, 0.0, 1.0);
          vec3 light = uKeyCol * dif + uSssCol * sss * uSss + uFillCol * clamp(dot(n, uFillDir) * 0.5 + 0.5, 0.0, 1.0) + uAmb;
          vec3 col = alb * light * ao;
          vec3 h = normalize(uKeyDir + vec3(0.0, 0.0, 1.0));
          float sp;
          if (uAniso > 0.5) { vec3 T = normalize(vec3(dv, 0.0)); float th = dot(T, h); sp = pow(sqrt(max(0.0, 1.0 - th * th)), uGloss) * smoothstep(-0.2, 0.4, ndl); }
          else sp = pow(max(dot(n, h), 0.0), uGloss);
          col += uKeyCol * sp * uSpec * ao * smk;
          float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.2) * clamp(dot(normalize(n.xy + 1e-5), uRimDir) * 0.8 + 0.2, 0.0, 1.0);
          col += uRimCol * rim * uRimAmt;
          c.rgb = mix(c.rgb, col * c.a, uShadeMix);
        }
        c.rgb = c.rgb * uTint.rgb + uAdd * c.a;
        o = c * uOpacity * vA * uTint.a; }`);
    this.fsq = `#version 300 es
      in vec2 aPos; out vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }`;
    this.bright = this.program(this.fsq, `#version 300 es
      precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform float uThresh; out vec4 o;
      void main(){ vec3 c=texture(uTex,vUv).rgb; float l=max(c.r,max(c.g,c.b)); o=vec4(c*smoothstep(uThresh,1.0,l),1.0);} `);
    this.blur = this.program(this.fsq, `#version 300 es
      precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
      void main(){ vec3 s=vec3(0.0); float w[5]=float[5](0.227,0.194,0.122,0.054,0.016);
        s+=texture(uTex,vUv).rgb*w[0];
        for(int i=1;i<5;i++){ s+=texture(uTex,vUv+uDir*float(i)).rgb*w[i]; s+=texture(uTex,vUv-uDir*float(i)).rgb*w[i]; }
        o=vec4(s,1.0);} `);
    this.grade = this.program(this.fsq, `#version 300 es
      precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform sampler2D uBloom;
      uniform float uExposure, uContrast, uSat, uVig, uGrain, uBloomAmt, uTime, uFade;
      uniform vec3 uLift, uGain; uniform vec2 uRes; out vec4 o;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec3 c = texture(uTex, vUv).rgb;
        c += texture(uBloom, vUv).rgb * uBloomAmt;
        c *= uExposure;
        c = c * uGain + uLift * (1.0 - c);
        float l = dot(c, vec3(0.299,0.587,0.114));
        c = mix(vec3(l), c, uSat);
        c = (c - 0.5) * uContrast + 0.5;
        vec2 q = vUv - 0.5; q.x *= uRes.x/uRes.y;
        c *= 1.0 - uVig * smoothstep(0.35, 1.05, length(q));
        c += (h(vUv*uRes + uTime*37.0) - 0.5) * uGrain;
        o = vec4(clamp(c,0.0,1.0) * uFade, 1.0); }`);
    this.mix = this.program(this.fsq, `#version 300 es
      precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform sampler2D uTex1; uniform float uK; out vec4 o;
      void main(){ o = mix(texture(uTex,vUv), texture(uTex1,vUv), uK); }`);
    this.copy = this.program(this.fsq, `#version 300 es
      precision highp float; in vec2 vUv; uniform sampler2D uTex; out vec4 o; void main(){ o=texture(uTex,vUv);} `);
    // buffers
    this.vbo = gl.createBuffer(); this.ibo = gl.createBuffer(); this.quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const L = this.sprite.loc;
    const ST = 36;
    gl.enableVertexAttribArray(L.aPos); gl.vertexAttribPointer(L.aPos, 2, gl.FLOAT, false, ST, 0);
    gl.enableVertexAttribArray(L.aUv); gl.vertexAttribPointer(L.aUv, 2, gl.FLOAT, false, ST, 8);
    gl.enableVertexAttribArray(L.aA); gl.vertexAttribPointer(L.aA, 1, gl.FLOAT, false, ST, 16);
    gl.enableVertexAttribArray(L.aDu); gl.vertexAttribPointer(L.aDu, 2, gl.FLOAT, false, ST, 20);
    gl.enableVertexAttribArray(L.aDv); gl.vertexAttribPointer(L.aDv, 2, gl.FLOAT, false, ST, 28);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    this.qvao = gl.createVertexArray(); gl.bindVertexArray(this.qvao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.scene = this.target(this.W * ssaa, this.H * ssaa, true);
    this.half = this.target(this.W, this.H);
    this.b1 = this.target(this.W / 4, this.H / 4); this.b2 = this.target(this.W / 4, this.H / 4);
    this.outA = this.target(this.W, this.H); this.outB = this.target(this.W, this.H);
    this.white = this.texFromData(1, 1, new Uint8Array([255, 255, 255, 255]));
    this.cam = new Float32Array(9);
    this.setCamera(0, 0, 1, 0);
    this.vdata = new Float32Array(1 << 18);
  }
  program(vs, fs) {
    const gl = this.gl, p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {};
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) { const a = gl.getActiveAttrib(p, i); loc[a.name] = gl.getAttribLocation(p, a.name); }
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) { const u = gl.getActiveUniform(p, i); loc[u.name.replace('[0]', '')] = gl.getUniformLocation(p, u.name); }
    return { p, loc };
  }
  target(w, h, stencil = false) {
    const gl = this.gl; w = Math.round(w); h = Math.round(h);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (stencil) {
      const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, rb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h };
  }
  texFromData(w, h, data) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return { tex: t, w, h };
  }
  texture(img, { repeat = false } = {}) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.CLAMP_TO_EDGE : wrap);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return { tex: t, w: img.width, h: img.height };
  }
  normalTex(img) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // camera: world point (cx,cy) at screen center, zoom = px per world unit, rot radians
  setCamera(cx, cy, zoom, rot = 0, ox = 0, oy = 0) {
    const sx = 2 * zoom / this.W, sy = -2 * zoom / this.H, c = Math.cos(rot), s = Math.sin(rot);
    const m = this.cam;
    // world -> view: rotate around (cx,cy), scale, translate to clip
    const a = c * sx, b = s * sy, cc = -s * sx, d = c * sy;
    m[0] = a; m[1] = b; m[2] = 0; m[3] = cc; m[4] = d; m[5] = 0;
    m[6] = -(a * cx + cc * cy) + ox * 2 / this.W; m[7] = -(b * cx + d * cy) - oy * 2 / this.H; m[8] = 1;
  }
  begin(clear = [0, 0, 0]) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb); gl.viewport(0, 0, this.scene.w, this.scene.h);
    gl.clearColor(clear[0], clear[1], clear[2], 1); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.sprite.p); gl.bindVertexArray(this.vao);
    gl.uniform1i(this.sprite.loc.uTex, 0); gl.uniform1i(this.sprite.loc.uNrm, 1);
    this.applyLights();
    this.stencilMode = 0;
  }
  // lights: { key:[x,y,z], keyCol, fill, fillCol, rimDir:[x,y], rimCol, amb, sssCol } (screen space, y down, z toward viewer)
  setLights(L) { this.lights = L; this.applyLights(); }
  applyLights() {
    const gl = this.gl, Lc = this.sprite.loc, L = this.lights; if (!L) return;
    gl.useProgram(this.sprite.p);
    const nz = (v) => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
    gl.uniform3fv(Lc.uKeyDir, nz(L.key)); gl.uniform3fv(Lc.uKeyCol, L.keyCol); gl.uniform3fv(Lc.uFillDir, nz(L.fill)); gl.uniform3fv(Lc.uFillCol, L.fillCol);
    gl.uniform3fv(Lc.uRimCol, L.rimCol); gl.uniform2fv(Lc.uRimDir, nz(L.rimDir)); gl.uniform3fv(Lc.uAmb, L.amb); gl.uniform3fv(Lc.uSssCol, L.sssCol || [0.9, 0.28, 0.16]);
  }
  // verts: Float32Array [x,y,u,v,a,dux,duy,dvx,dvy]*n ; idx: Uint16/32Array
  draw(tex, verts, nv, idx, ni, o = {}) {
    const gl = this.gl, L = this.sprite.loc;
    gl.uniformMatrix3fv(L.uCam, false, o.cam || this.cam);
    const t = o.tint || [1, 1, 1, 1], ad = o.add || [0, 0, 0], so = o.solid;
    gl.uniform4f(L.uTint, t[0], t[1], t[2], t[3] === undefined ? 1 : t[3]);
    gl.uniform3f(L.uAdd, ad[0], ad[1], ad[2]);
    gl.uniform1f(L.uOpacity, o.opacity === undefined ? 1 : o.opacity);
    gl.uniform4f(L.uSolid, so ? so[0] : 0, so ? so[1] : 0, so ? so[2] : 0, so ? 1 : 0);
    const ag = o.albGain || [1, 1, 1], aa = o.albAdd || [0, 0, 0];
    gl.uniform3f(L.uAlbGain, ag[0], ag[1], ag[2]); gl.uniform3f(L.uAlbAdd, aa[0], aa[1], aa[2]); gl.uniform1f(L.uAlbMono, o.albMono || 0);
    const m = o.mat;
    gl.uniform1f(L.uLit, m && this.lights ? 1 : 0);
    if (m && this.lights) {
      gl.uniform1f(L.uNrmOn, tex && tex.nrm && m.nrm !== false ? 1 : 0); gl.uniform1f(L.uNrmStr, m.nrmStr ?? 1);
      gl.uniform1f(L.uSss, m.sss || 0); gl.uniform1f(L.uSpec, m.spec || 0); gl.uniform1f(L.uGloss, m.gloss || 16); gl.uniform1f(L.uAniso, m.aniso ? 1 : 0);
      gl.uniform1f(L.uRimAmt, (m.rim ?? 1) * (this.lights.rimAmt ?? 1)); gl.uniform1f(L.uShadeMix, m.mix ?? 1);
      if (tex && tex.nrm) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex.nrm); }
    }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, (tex || this.white).tex);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, nv * 9), gl.STREAM_DRAW);
    if (o.additive) gl.blendFunc(gl.ONE, gl.ONE);
    if (o.mask !== undefined) {          // write stencil
      gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.ALWAYS, o.mask, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); gl.colorMask(false, false, false, false);
    } else if (o.clip !== undefined) {   // test stencil
      gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, o.clip, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx.subarray(0, ni), gl.STREAM_DRAW);
    gl.drawElements(gl.TRIANGLES, ni, idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
    if (o.mask !== undefined) gl.colorMask(true, true, true, true);
    if (o.mask !== undefined || o.clip !== undefined) gl.disable(gl.STENCIL_TEST);
    if (o.additive) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  mixOut(k) { this.fsPass(this.mix, null, { uTex: 0, uTex1: 1, uK: k }, [this.outA, this.outB]); }
  // draw sprites straight onto the final image (titles)
  overlay() {
    const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.W, this.H); this.lights = null;
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(this.sprite.p); gl.bindVertexArray(this.vao);
  }
  clearStencil() { const gl = this.gl; gl.clearStencil(0); gl.clear(gl.STENCIL_BUFFER_BIT); }
  fsPass(prog, target, uniforms, texs) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : this.W, target ? target.h : this.H);
    gl.disable(gl.BLEND); gl.useProgram(prog.p); gl.bindVertexArray(this.qvao);
    texs.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t.tex); });
    for (const [k, v] of Object.entries(uniforms)) {
      const l = prog.loc[k]; if (l == null) continue;
      if (Array.isArray(v)) (v.length === 2 ? gl.uniform2fv : gl.uniform3fv).call(gl, l, v);
      else if (k.startsWith('uTex') || k === 'uBloom') gl.uniform1i(l, v); else gl.uniform1f(l, v);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  finish(g, dest = null) {
    const gl = this.gl;
    // downsample supersampled scene (mipmap-free box via linear taps on half target)
    this.fsPass(this.copy, this.half, { uTex: 0 }, [this.scene]);
    this.fsPass(this.bright, this.b1, { uTex: 0, uThresh: g.bloomThresh ?? 0.72 }, [this.half]);
    for (let i = 0; i < 2; i++) {
      this.fsPass(this.blur, this.b2, { uTex: 0, uDir: [1.5 / this.b1.w, 0] }, [this.b1]);
      this.fsPass(this.blur, this.b1, { uTex: 0, uDir: [0, 1.5 / this.b1.h] }, [this.b2]);
    }
    this.fsPass(this.grade, dest, {
      uTex: 0, uBloom: 1, uExposure: g.exposure ?? 1, uContrast: g.contrast ?? 1, uSat: g.sat ?? 1, uVig: g.vignette ?? 0.3,
      uGrain: g.grain ?? 0.025, uBloomAmt: g.bloom ?? 0.35, uTime: g.time || 0, uFade: g.fade ?? 1,
      uLift: g.lift || [0, 0, 0], uGain: g.gain || [1, 1, 1], uRes: [this.W, this.H]
    }, [this.half, this.b1]);
  }
}

// Mesh helpers ---------------------------------------------------------------
// Grid mesh over a texture rect: cols x rows cells. Returns {uv:Float32Array, idx, n}
export function gridMesh(cols, rows) {
  const n = (cols + 1) * (rows + 1), uv = new Float32Array(n * 2), idx = new Uint16Array(cols * rows * 6);
  let k = 0;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { uv[k++] = i / cols; uv[k++] = j / rows; }
  k = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = d; idx[k++] = c;
  }
  return { uv, idx, n, cols, rows };
}

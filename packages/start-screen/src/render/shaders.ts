/**
 * GLSL for the whole look. All shaders are "raw" (three.js adds nothing but the
 * #version line), so what is written here is exactly what runs.
 *
 * The picture is made in three steps:
 * 1. FLAT / PAINT draw the scene into two images at once: the flat colours, and a
 *    "what is this pixel" image holding the face direction and the object id.
 * 2. COMPOSITE draws the sea behind it and ink lines on top: a line goes wherever
 *    the object id changes, or one object's faces meet at a sharp angle. It also
 *    wobbles the whole picture slightly, redrawn a few times a second ("boil").
 * 3. FXAA smooths the stair-steps.
 *
 * Colours are written exactly as given (no lighting maths, no colour-space
 * conversion), so a hex value in config.ts is the hex value on screen.
 */

const glsl = String.raw;

/** Island, train, tiles, button: one flat colour per face, darker when turned from the sun or in shadow. */
export const FLAT_VERT = glsl`
precision highp float;
in vec3 position;
in vec3 normal;
in vec3 color;
in float oid;
in vec2 uv;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
#ifdef RECEIVE_SHADOW
uniform mat4 uShadowMatrix;
uniform float uShadowNormalBias;
out vec3 vShadowCoord;
#endif
out vec3 vColor;
out vec3 vNormal;
out vec2 vUv;
flat out float vOid;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vColor = color;
  vNormal = n;
  vUv = uv;
  vOid = oid;
#ifdef RECEIVE_SHADOW
  // Look the shadow up a little way off the surface, so a face never shadows itself.
  vShadowCoord = (uShadowMatrix * vec4(world.xyz + n * uShadowNormalBias, 1.0)).xyz;
#endif
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const FLAT_FRAG = glsl`
precision highp float;
precision highp sampler2D;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormalId;
in vec3 vColor;
in vec3 vNormal;
in vec2 vUv;
flat in float vOid;
uniform vec3 uLightDir;
uniform vec3 uShadeColor;
uniform float uShadeMix;
#ifdef RECEIVE_SHADOW
uniform sampler2D uShadowMap;
uniform float uShadowBias;
in vec3 vShadowCoord;
#endif
#ifdef USE_ATLAS
uniform sampler2D uAtlas;
uniform vec3 uInk;
uniform vec3 uLetterLight;
#endif

// Pack a direction into two numbers (octahedral encoding).
vec2 octEncode(vec3 n) {
  n /= (abs(n.x) + abs(n.y) + abs(n.z));
  vec2 e = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
  return e * 0.5 + 0.5;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 color = vColor;
#ifdef USE_ATLAS
  // Faces without a letter carry uv (-1, -1). Red: ink letters. Green: paper art (roundels).
  vec2 glyph = texture(uAtlas, vUv).rg * step(0.0, vUv.x);
  color = mix(color, uInk, glyph.r);
  color = mix(color, uLetterLight, glyph.g);
#endif
  float lit = step(0.04, dot(n, uLightDir));
#ifdef RECEIVE_SHADOW
  vec3 sc = vShadowCoord;
  if (lit > 0.5 && sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0) {
    lit = step(sc.z - uShadowBias, textureLod(uShadowMap, sc.xy, 0.0).r);
  }
#endif
  color = mix(mix(color, uShadeColor, uShadeMix), color, lit);
  outColor = vec4(color, 1.0);
  float hi = floor(vOid / 256.0);
  outNormalId = vec4(octEncode(n), hi / 255.0, (vOid - hi * 256.0) / 255.0);
}
`;

/**
 * Foam and drop shadows: colour laid over the picture without touching the
 * "what is this pixel" image, so they never get an ink line and the lines of
 * whatever is underneath still show. Premultiplied alpha.
 */
export const PAINT_VERT = glsl`
precision highp float;
in vec3 position;
in vec3 color;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
out vec3 vColor;

void main() {
  vColor = color;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

export const PAINT_FRAG = glsl`
precision highp float;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormalId;
in vec3 vColor;
uniform float uAlpha;

void main() {
  outColor = vec4(vColor * uAlpha, uAlpha);
  outNormalId = vec4(0.0);
}
`;

/** Shadow map: only depth matters. */
export const DEPTH_VERT = glsl`
precision highp float;
in vec3 position;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

void main() {
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

export const DEPTH_FRAG = glsl`
precision highp float;
layout(location = 0) out vec4 outColor;

void main() {
  outColor = vec4(1.0);
}
`;

export const SCREEN_VERT = glsl`
precision highp float;
in vec3 position;

void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Sea, foam blobs, the scene, ink lines and the hand-drawn wobble. `BLOBS` is defined by the material. */
export const COMPOSITE_FRAG = glsl`
precision highp float;
precision highp sampler2D;
layout(location = 0) out vec4 outColor;
uniform sampler2D tColor;
uniform sampler2D tNormalId;
uniform vec2 uResolution;   // device pixels
uniform float uDpr;         // device pixels per CSS pixel
uniform float uTime;
uniform float uSeed;
uniform vec3 uInk;
uniform vec3 uSea;
uniform vec3 uFoam;
uniform vec3 uFoam2;
uniform float uInkWidth;    // CSS pixels
uniform vec2 uPressure;
uniform float uPressureFreq;
uniform float uCreaseCos;
uniform float uWobAmount;   // CSS pixels
uniform float uWobFreq;
uniform vec4 uBlobs[BLOBS];     // centre x, y and radii x, y in CSS pixels from the middle, y up
uniform vec2 uBlobLook[BLOBS];  // x: 0 = foam2, 1 = foam. y: drift phase
uniform float uRag;
uniform float uRagFreq;
uniform float uDrift;
uniform float uDriftSeconds;
uniform float uClear;      // 1 = no sea: transparent background (stills for the app's art)

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Smooth noise, two independent channels, 0..1.
vec2 noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash22(i), hash22(i + vec2(1.0, 0.0)), u.x),
    mix(hash22(i + vec2(0.0, 1.0)), hash22(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

vec2 softNoise2(vec2 p) {
  return noise2(p) * 0.67 + noise2(p * 2.03 + 17.1) * 0.33;
}

float readId(vec4 t) {
  return floor(t.b * 255.0 + 0.5) * 256.0 + floor(t.a * 255.0 + 0.5);
}

vec3 octDecode(vec2 f) {
  f = f * 2.0 - 1.0;
  vec3 n = vec3(f.x, f.y, 1.0 - abs(f.x) - abs(f.y));
  float t = clamp(-n.z, 0.0, 1.0);
  n.x += n.x >= 0.0 ? -t : t;
  n.y += n.y >= 0.0 ? -t : t;
  return normalize(n);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 css = frag / uDpr;

  // Wobble: read the picture from a slightly displaced spot. The displacement
  // is slow noise that jumps to a new pattern whenever uSeed changes.
  vec2 wobble = (softNoise2(css * uWobFreq + uSeed * 13.7) - 0.5) * 2.0 * uWobAmount * uDpr;
  vec2 p = frag + wobble;
  ivec2 last = textureSize(tNormalId, 0) - 1;

  vec4 scene = texture(tColor, p / uResolution);
  vec4 here = texelFetch(tNormalId, clamp(ivec2(p), ivec2(0), last), 0);
  float id = readId(here);
  vec3 normal = octDecode(here.rg);

  // Ink: look around in a small ring. Each neighbour that belongs to another
  // object, or to a face of this object at a sharp angle, adds ink.
  float pressure = mix(uPressure.x, uPressure.y, noise2(css * uPressureFreq + uSeed * 3.1).x);
  float radius = max(0.75, uInkWidth * 0.5 * uDpr * pressure);
  float hits = 0.0;
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.78539816 + 0.39269908;
    vec4 there = texelFetch(tNormalId, clamp(ivec2(p + vec2(cos(a), sin(a)) * radius), ivec2(0), last), 0);
    if (readId(there) != id) {
      hits += 1.0;
    } else if (id > 0.5 && dot(octDecode(there.rg), normal) < uCreaseCos) {
      hits += 1.0;
    }
  }
  float ink = clamp(hits / 2.5, 0.0, 1.0);

  // Sea with ragged foam blobs that drift slowly from side to side.
  vec3 sea = uSea;
  vec2 c = css - 0.5 * uResolution / uDpr;
  vec2 rag = (softNoise2(c * uRagFreq + 5.3) - 0.5) * 2.0 * uRag;
  for (int i = 0; i < BLOBS; i++) {
    float drift = uDrift * sin(6.2831853 * (uTime / (2.0 * uDriftSeconds) + uBlobLook[i].y));
    float e = length((c + rag - vec2(uBlobs[i].x + drift, uBlobs[i].y)) / uBlobs[i].zw);
    float soft = fwidth(e);
    sea = mix(sea, mix(uFoam2, uFoam, uBlobLook[i].x), 1.0 - smoothstep(1.0 - soft, 1.0 + soft, e));
  }

  vec3 color = scene.rgb + sea * (1.0 - scene.a);
  vec4 solid = vec4(mix(color, uInk, ink), 1.0);
  // Premultiplied: ink over the scene over nothing.
  vec4 clear = vec4(scene.rgb * (1.0 - ink) + uInk * ink, scene.a + ink * (1.0 - scene.a));
  outColor = mix(solid, clear, uClear);
}
`;

/** FXAA: a small, standard edge-smoothing pass. */
export const FXAA_FRAG = glsl`
precision highp float;
precision highp sampler2D;
layout(location = 0) out vec4 outColor;
uniform sampler2D tDiffuse;
uniform vec2 uTexel;

const float REDUCE_MIN = 1.0 / 128.0;
const float REDUCE_MUL = 1.0 / 8.0;
const float SPAN_MAX = 8.0;

// Brightness as if over white, so edges against a transparent background count too.
float luma(vec4 c) {
  return dot(c.rgb + (1.0 - c.a), vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec4 rgbM = texture(tDiffuse, uv);
  float lumaNW = luma(texture(tDiffuse, uv + vec2(-1.0, -1.0) * uTexel));
  float lumaNE = luma(texture(tDiffuse, uv + vec2(1.0, -1.0) * uTexel));
  float lumaSW = luma(texture(tDiffuse, uv + vec2(-1.0, 1.0) * uTexel));
  float lumaSE = luma(texture(tDiffuse, uv + vec2(1.0, 1.0) * uTexel));
  float lumaM = luma(rgbM);
  float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
  float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

  vec2 dir = vec2(-((lumaNW + lumaNE) - (lumaSW + lumaSE)), (lumaNW + lumaSW) - (lumaNE + lumaSE));
  float reduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.25 * REDUCE_MUL, REDUCE_MIN);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), vec2(-SPAN_MAX), vec2(SPAN_MAX)) * uTexel;

  vec4 rgbA = 0.5 * (texture(tDiffuse, uv + dir * (1.0 / 3.0 - 0.5)) + texture(tDiffuse, uv + dir * (2.0 / 3.0 - 0.5)));
  vec4 rgbB = rgbA * 0.5 + 0.25 * (texture(tDiffuse, uv - dir * 0.5) + texture(tDiffuse, uv + dir * 0.5));
  float lumaB = luma(rgbB);
  outColor = (lumaB < lumaMin || lumaB > lumaMax) ? rgbA : rgbB;
}
`;

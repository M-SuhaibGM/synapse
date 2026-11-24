import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  Vector3,
} from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

// CLAUDE.md: 20k points on desktop, 8k on mobile (fewer points = less GPU work).
export const PARTICLE_COUNT = 20_000;
export const MOBILE_PARTICLE_COUNT = 8_000;

const RADIUS = 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const FONT_URL = "/fonts/helvetiker_regular.typeface.json";

let fontPromise: ReturnType<FontLoader["loadAsync"]> | undefined;

export function sphere(count = PARTICLE_COUNT): Float32Array {
  const positions = new Float32Array(count * 3);

  // Fibonacci sphere: step each point around by the "golden angle" (~137.5°) while
  // moving evenly from top to bottom. The angle never lines up with itself, so points
  // spread evenly over the surface instead of bunching at the poles.
  for (let index = 0; index < count; index += 1) {
    const y = 1 - (index / (count - 1)) * 2;
    const ringRadius = Math.sqrt(1 - y * y);
    const angle = GOLDEN_ANGLE * index;

    positions[index * 3] = Math.cos(angle) * ringRadius * RADIUS;
    positions[index * 3 + 1] = y * RADIUS;
    positions[index * 3 + 2] = Math.sin(angle) * ringRadius * RADIUS;
  }

  return positions;
}

export async function text(
  input: string,
  count = PARTICLE_COUNT,
): Promise<Float32Array> {
  if (!input.trim()) {
    throw new Error("Enter some text to generate a particle shape.");
  }

  const font = await loadFont();
  const geometry = new TextGeometry(input, {
    font,
    size: 1,
    depth: 0.18,
    curveSegments: 8,
  });

  try {
    return sampleSurface(geometry, count);
  } finally {
    geometry.dispose();
  }
}

export async function fromModel(
  url: string,
  count = PARTICLE_COUNT,
): Promise<Float32Array> {
  const modelUrl = url.trim();
  if (!modelUrl) {
    throw new Error("Enter a GLB URL to generate a model particle shape.");
  }

  const { scene } = await new GLTFLoader().loadAsync(modelUrl);
  scene.updateMatrixWorld(true);

  const positions: number[] = [];
  const indices: number[] = [];

  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;

    const position = object.geometry.getAttribute("position");
    if (!position || position.count < 3) return;

    const offset = positions.length / 3;
    const vertex = new Vector3();

    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
      positions.push(vertex.x, vertex.y, vertex.z);
    }

    const geometryIndex = object.geometry.getIndex();
    const indexCount = geometryIndex?.count ?? position.count;
    for (let index = 0; index + 2 < indexCount; index += 3) {
      indices.push(
        offset + (geometryIndex ? geometryIndex.getX(index) : index),
        offset + (geometryIndex ? geometryIndex.getX(index + 1) : index + 1),
        offset + (geometryIndex ? geometryIndex.getX(index + 2) : index + 2),
      );
    }
  });

  if (indices.length === 0) {
    throw new Error(`The GLB at "${modelUrl}" does not contain a triangle mesh.`);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setIndex(indices);

  try {
    return sampleSurface(geometry, count);
  } finally {
    geometry.dispose();
  }
}

function loadFont() {
  if (!fontPromise) {
    fontPromise = new FontLoader()
      .loadAsync(FONT_URL)
      .catch((error: unknown) => {
        fontPromise = undefined;
        throw error;
      });
  }

  return fontPromise;
}

function sampleSurface(
  geometry: BufferGeometry,
  count: number,
): Float32Array {
  normalizeGeometry(geometry);

  const sampler = new MeshSurfaceSampler(new Mesh(geometry)).build();
  const positions = new Float32Array(count * 3);
  const point = new Vector3();

  for (let index = 0; index < count; index += 1) {
    sampler.sample(point);
    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y;
    positions[index * 3 + 2] = point.z;
  }

  return positions;
}

function normalizeGeometry(geometry: BufferGeometry): void {
  const position = geometry.getAttribute("position");
  if (!position || position.count === 0) {
    throw new Error("The shape does not contain any vertices to sample.");
  }

  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) {
    throw new Error("Unable to calculate shape bounds.");
  }

  const center = bounds.getCenter(new Vector3());
  let maxRadiusSquared = 0;
  const vertex = new Vector3();

  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index).sub(center);
    maxRadiusSquared = Math.max(maxRadiusSquared, vertex.lengthSq());
  }

  if (!Number.isFinite(maxRadiusSquared) || maxRadiusSquared === 0) {
    throw new Error("The shape has invalid or zero-size geometry.");
  }

  const scale = RADIUS / Math.sqrt(maxRadiusSquared);
  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index).sub(center).multiplyScalar(scale);
    position.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }

  position.needsUpdate = true;
}

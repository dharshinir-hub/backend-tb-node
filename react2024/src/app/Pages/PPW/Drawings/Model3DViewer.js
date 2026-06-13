import React, { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const ext = (name = '') => (name.split('.').pop() || '').toLowerCase();

// occt-import-js (OpenCASCADE WASM) is loaded as a runtime script from /public
// rather than bundled — its emscripten glue references node built-ins (fs/path/
// crypto) that webpack can't resolve. Shared single instance.
let _occtPromise = null;
const loadOcctLib = () => new Promise((resolve, reject) => {
  if (window.occtimportjs) return resolve(window.occtimportjs);
  const existing = document.getElementById('occt-import-js-lib');
  if (existing) {
    existing.addEventListener('load', () => resolve(window.occtimportjs));
    existing.addEventListener('error', () => reject(new Error('Failed to load 3D engine')));
    return undefined;
  }
  const s = document.createElement('script');
  s.id = 'occt-import-js-lib';
  s.src = '/occt-import-js.js';
  s.onload = () => resolve(window.occtimportjs);
  s.onerror = () => reject(new Error('Failed to load 3D engine'));
  document.body.appendChild(s);
  return undefined;
});
const getOcct = () => {
  if (!_occtPromise) {
    _occtPromise = loadOcctLib().then((fn) => fn({ locateFile: () => '/occt-import-js.wasm' }));
  }
  return _occtPromise;
};

// Tessellate a STEP/IGES/BREP buffer into THREE geometries via occt.
const occtToGeometries = async (arrayBuffer, e) => {
  const occt = await getOcct();
  const fileBuffer = new Uint8Array(arrayBuffer);
  let result;
  if (e === 'step' || e === 'stp') result = occt.ReadStepFile(fileBuffer, null);
  else if (e === 'iges' || e === 'igs') result = occt.ReadIgesFile(fileBuffer, null);
  else if (e === 'brep') result = occt.ReadBrepFile(fileBuffer, null);
  if (!result || !result.success) throw new Error('Could not parse CAD file');

  return result.meshes.map((m) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(m.attributes.position.array, 3));
    if (m.attributes.normal) {
      g.setAttribute('normal', new THREE.Float32BufferAttribute(m.attributes.normal.array, 3));
    }
    if (m.index) g.setIndex(new THREE.Uint32BufferAttribute(m.index.array, 1));
    if (!m.attributes.normal) g.computeVertexNormals();
    const color = m.color ? new THREE.Color(m.color[0], m.color[1], m.color[2]) : new THREE.Color('#9ca3af');
    return { geometry: g, color };
  });
};

// In-browser 3D viewer for STL / STEP / IGES / BREP. Vanilla three.js so there
// is no React-version peer constraint. Degrades to a download prompt on error.
const Model3DViewer = ({ url, name }) => {
  const mountRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const e = ext(name);
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer, controls, frame, disposed = false;
    const scene = new THREE.Scene();
    // Light background to match the Yantra dashboard theme (not a dark contrast).
    scene.background = new THREE.Color('#f1f5f9');

    const setup = (meshes) => {
      if (disposed) return;
      const width = mount.clientWidth || 800;
      const height = mount.clientHeight || 480;

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(1, 1, 1);
      scene.add(dir);
      const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
      dir2.position.set(-1, -1, -1);
      scene.add(dir2);

      const group = new THREE.Group();
      meshes.forEach(({ geometry, color }) => {
        const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.6 });
        group.add(new THREE.Mesh(geometry, mat));
      });
      scene.add(group);

      // Center + frame the model.
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      group.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const dist = maxDim * 2.2;
      camera.position.set(dist, dist * 0.8, dist);
      camera.lookAt(0, 0, 0);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;

      const animate = () => {
        if (disposed) return;
        frame = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();
      setLoading(false);
    };

    const fail = (err) => {
      if (disposed) return;
      console.error('3D viewer error:', err);
      setError(err.message || 'Could not render this model');
      setLoading(false);
    };

    if (e === 'stl') {
      new STLLoader().load(
        url,
        (geometry) => setup([{ geometry, color: new THREE.Color('#9ca3af') }]),
        undefined,
        fail
      );
    } else {
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((buf) => occtToGeometries(buf, e))
        .then(setup)
        .catch(fail);
    }

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      if (controls) controls.dispose();
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [url, name]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '72vh' }}>
      <Box ref={mountRef} sx={{ width: '100%', height: '100%', borderRadius: 1, overflow: 'hidden' }} />
      {loading && !error && (
        <Box sx={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#475569', gap: 1, bgcolor: '#f1f5f9',
        }}>
          <CircularProgress sx={{ color: '#ec6e17' }} />
          <Typography variant="body2">Rendering 3D model…</Typography>
        </Box>
      )}
      {error && (
        <Box sx={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#475569', gap: 1, bgcolor: '#fff',
        }}>
          <Typography>Couldn’t render <b>.{ext(name)}</b> in the browser.</Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>{error}</Typography>
          <Button variant="contained" startIcon={<DownloadIcon />} component="a" href={url}
            target="_blank" rel="noreferrer" sx={{ textTransform: 'none', mt: 1 }}>
            Download to open
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default Model3DViewer;

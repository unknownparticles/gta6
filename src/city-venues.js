import * as T from 'three';
import { venues } from './city-venues-data.js';

export function makeVenues(scene, buildingFronts, city) {
  const used = new Set();
  const trim = new T.MeshLambertMaterial({ color: 0xd3b695 });
  const glass = new T.MeshLambertMaterial({ color: 0x355860 });
  const lamp = new T.MeshBasicMaterial({ color: 0xf5c18a });
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = haloCanvas.height = 64;
  const haloContext = haloCanvas.getContext('2d');
  const gradient = haloContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,182,102,0.65)');
  gradient.addColorStop(0.4, 'rgba(255,155,80,0.26)');
  gradient.addColorStop(1, 'rgba(255,126,62,0)');
  haloContext.fillStyle = gradient;
  haloContext.fillRect(0, 0, 64, 64);
  const haloTexture = new T.CanvasTexture(haloCanvas);
  haloTexture.colorSpace = T.SRGBColorSpace;
  const haloMaterial = new T.MeshBasicMaterial({
    map: haloTexture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
  });
  const queueGeometry = new T.CylinderGeometry(0.12, 0.14, 0.39, 6);
  const headGeometry = new T.IcosahedronGeometry(0.103, 0);
  const queueMaterial = new T.MeshLambertMaterial();
  const queueMarker = new T.Object3D();
  const hue = new T.Color();
  const geometry = new T.BoxGeometry(1, 1, 1);
  const result = [];
  function panel(parent, material, x, y, z, w, h, d) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
  }
  for (const shop of venues) {
    const [sx, sz] = shop.anchor;
    let front = buildingFronts
      .filter((edge) => !used.has(edge.id) && Math.hypot(edge.x - sx, edge.z - sz) < 135)
      .sort((a, b) => Math.hypot(a.x - sx, a.z - sz) - Math.hypot(b.x - sx, b.z - sz))
      .find((edge) => city.clear(edge.x + edge.nx * 2.5, edge.z + edge.nz * 2.5, 0.46));
    if (!front) {
      const [x, z] = city.spawn(shop.anchor);
      const offset = [
        [0, -4],
        [4, 0],
        [-4, 0],
        [0, 4],
      ].find(
        ([dx, dz]) => city.clear(x + dx, z + dz, 1.4) && city.clear(x + dx * 1.45, z + dz * 1.45),
      );
      if (offset) {
        const [dx, dz] = offset;
        front = {
          x: x + dx,
          z: z + dz,
          nx: dx / 4,
          nz: dz / 4,
          base: city.height(x + dx, z + dz),
          length: 5,
          kiosk: true,
        };
      }
    }
    let point;
    let group;
    if (front) {
      if (front.id !== undefined) used.add(front.id);
      const { x, z, nx, nz, base, length } = front;
      point = [x + nx * 2.4, z + nz * 2.4];
      group = new T.Group();
      group.position.set(x + nx * 0.07, base, z + nz * 0.07);
      group.rotation.y = Math.atan2(nx, nz);
      const width = Math.min(9.3, length - 0.24);
      const paint = new T.MeshLambertMaterial({ color: shop.paint });
      if (front.kiosk) {
        panel(group, paint, 0, 1.5, -1.1, width, 3, 2.3);
        panel(group, trim, 0, 3.2, -0.9, width + 0.24, 0.18, 2.85);
        panel(group, trim, 0, 0.08, 0.9, width + 0.5, 0.15, 2.2);
      }
      panel(group, paint, 0, 1.6, 0.12, width, 3.15, 0.22);
      panel(group, glass, -width * 0.22, 1.48, 0.25, width * 0.41, 2.29, 0.05);
      panel(group, glass, width * 0.15, 1.47, 0.25, width * 0.21, 2.7, 0.05);
      panel(group, trim, -width * 0.22, 1.44, 0.29, 0.06, 2.27, 0.05);
      panel(group, lamp, -width * 0.22, 2.35, 0.3, width * 0.36, 0.09, 0.06);
      const warmth = new T.Mesh(new T.PlaneGeometry(width * 0.83, 2.45), haloMaterial);
      warmth.position.set(-width * 0.07, 1.58, 0.37);
      group.add(warmth);
      const spill = new T.Mesh(new T.PlaneGeometry(width * 0.9, 4.6), haloMaterial);
      spill.rotation.x = -Math.PI / 2;
      spill.position.set(-width * 0.07, city.height(...point) - base + 0.2, 1.66);
      group.add(spill);
      for (let i = 0; i < 3; i++) {
        panel(group, trim, -width * 0.34 + i * width * 0.095, 0.93, 0.32, 0.17, 0.13, 0.1);
      }
      panel(group, trim, width * 0.33, 1.6, 0.32, width * 0.13, 0.68, 0.05);
      panel(group, glass, width * 0.33, 1.6, 0.36, width * 0.1, 0.56, 0.02);

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1c1727';
      ctx.fillRect(0, 0, 512, 128);
      ctx.strokeStyle = shop.color || '#edd09f';
      ctx.lineWidth = 4;
      ctx.strokeRect(5, 5, 502, 118);
      ctx.fillStyle = shop.color || '#edd09f';
      ctx.textAlign = 'center';
      ctx.font = 'bold 58px sans-serif';
      ctx.fillText(shop.name, shop.cat ? 285 : 256, 68, shop.cat ? 400 : 475);
      ctx.font = '26px sans-serif';
      ctx.fillText(shop.short, 256, 106, 465);
      if (shop.cat) {
        ctx.beginPath();
        ctx.moveTo(28, 26);
        ctx.lineTo(47, 39);
        ctx.lineTo(65, 26);
        ctx.lineTo(71, 59);
        ctx.quadraticCurveTo(48, 81, 24, 59);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#282337';
        ctx.fillRect(35, 48, 5, 5);
        ctx.fillRect(54, 48, 5, 5);
      }
      const texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      const sign = new T.Mesh(
        new T.PlaneGeometry(width, width / 4),
        new T.MeshBasicMaterial({ map: texture }),
      );
      sign.position.set(0, 3.18, 0.36);
      group.add(sign);
      for (let stripe = 0; stripe < 8; stripe++) {
        const strip = new T.Mesh(geometry, stripe % 2 ? trim : paint);
        strip.position.set(((stripe - 3.5) * width) / 8, 2.61, 0.72);
        strip.scale.set(width / 8, 0.09, 1.32);
        strip.rotation.x = 0.17;
        group.add(strip);
      }
      scene.add(group);
      if (shop.queue) {
        const people = [];
        for (let i = 0; i < shop.queue; i++) {
          const side = (i % 2 ? 1 : -1) * (1.2 + Math.floor(i / 2) * 0.63);
          const px = x + nz * side + nx * 2.35;
          const pz = z - nx * side + nz * 2.35;
          if (city.clear(px, pz, 0.25)) people.push([px, pz]);
        }
        const queue = new T.InstancedMesh(queueGeometry, queueMaterial, people.length);
        const heads = new T.InstancedMesh(headGeometry, queueMaterial, people.length);
        const legs = new T.InstancedMesh(geometry, queueMaterial, people.length * 2);
        people.forEach(([px, pz], i) => {
          const ground = city.height(px, pz);
          const height = 1 + (i % 5) * 0.035;
          queueMarker.position.set(px, ground + height + 0.13, pz);
          queueMarker.scale.set(1.5, 1.54, 1.13);
          queueMarker.rotation.y = group.rotation.y;
          queueMarker.updateMatrix();
          queue.setMatrixAt(i, queueMarker.matrix);
          queue.setColorAt(i, hue.setHex([0xa56e62, 0x677e75, 0x5d5b78, 0xb5a289][i % 4]));
          queueMarker.position.y += 0.45;
          queueMarker.scale.set(1, 1.2, 1);
          queueMarker.updateMatrix();
          heads.setMatrixAt(i, queueMarker.matrix);
          heads.setColorAt(i, hue.setHex(i % 2 ? 0xb98262 : 0xd1a984));
          for (const side of [-1, 1]) {
            queueMarker.position.set(
              px + nz * side * 0.078,
              ground + height * 0.42,
              pz - nx * side * 0.078,
            );
            queueMarker.scale.set(0.128, height * 0.82, 0.14);
            queueMarker.updateMatrix();
            legs.setMatrixAt(i * 2 + Number(side === 1), queueMarker.matrix);
            legs.setColorAt(i * 2 + Number(side === 1), hue.setHex(0x434956));
          }
        });
        scene.add(queue, heads, legs);
      }
    } else point = city.spawn(shop.anchor);
    result.push({ ...shop, point, group, front });
  }
  return result;
}

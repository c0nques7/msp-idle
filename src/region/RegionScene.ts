// Three.js renderer for the stage 3 regional map. Same isometric camera as the
// office: rolling ground, a river, roads, and one small building per site.
import * as THREE from 'three'
import type { GameState } from '../game/engine'
import { SITE_SLOTS } from '../game/regionContent'

export type MapPick = { kind: 'site'; id: number } | { kind: 'slot'; slot: number } | { kind: 'event'; id: number }

export interface MapCallbacks {
  onPick: (pick: MapPick) => void
  onHover: (text: string | null, x: number, y: number) => void
  onIntroDone: () => void
}

/** Site positions on the map, slot 0 is HQ. */
export const SLOT_POS: [number, number][] = [
  [0, 0],
  [-7, -5],
  [6, -6],
  [7, 5],
  [-6, 6],
]
const MAP_SIZE = 26

interface Palette {
  ground: number
  hill: number
  river: number
  road: number
  building: number
  roof: number
  hq: number
  empty: number
  tree: number
}

const LIGHT: Palette = {
  ground: 0xcfdcc4,
  hill: 0xbfd0b2,
  river: 0x8fb6dd,
  road: 0xe8e3d6,
  building: 0xf2f0ec,
  roof: 0x5a6b84,
  hq: 0x2f5fb8,
  empty: 0x8b95a3,
  tree: 0x6f9a62,
}
const DARK: Palette = {
  ground: 0x1d2a22,
  hill: 0x223228,
  river: 0x22405e,
  road: 0x39403f,
  building: 0x3a4250,
  roof: 0x7a8cab,
  hq: 0x5b8ff0,
  empty: 0x5d6878,
  tree: 0x2f4d34,
}

function isDark(): boolean {
  const theme = document.documentElement.getAttribute('data-theme')
  if (theme) return theme === 'dark'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function mat(color: number, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...opts })
}

function mesh(geo: THREE.BufferGeometry, color: number, opts: THREE.MeshStandardMaterialParameters = {}) {
  const m = new THREE.Mesh(geo, mat(color, opts))
  m.castShadow = true
  m.receiveShadow = true
  return m
}

const healthColor = (h: number) => (h >= 70 ? 0x2e9e5b : h >= 40 ? 0xe0a42e : 0xd64545)

function label(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const ctx = canvas.getContext('2d')!
  ctx.font = '600 40px system-ui, -apple-system, Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 8
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.strokeText(text, 256, 48)
  ctx.fillStyle = color
  ctx.fillText(text, 256, 48)
  const tex = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
  sprite.scale.set(5.3, 1, 1)
  sprite.renderOrder = 10
  return sprite
}

const OFFSET = new THREE.Vector3(20, 20 * Math.SQRT2 * Math.tan((35.264 * Math.PI) / 180), 20)

export class RegionScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.OrthographicCamera
  private dynamic = new THREE.Group()
  private markers: THREE.Object3D[] = []
  private signature = ''
  private palette: Palette
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private frame = 0
  private clock = new THREE.Clock()
  private intro: { start: number; duration: number } | null = null
  private resizeObserver: ResizeObserver

  constructor(
    private container: HTMLElement,
    private callbacks: MapCallbacks,
  ) {
    this.palette = isDark() ? DARK : LIGHT
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    this.camera.position.copy(OFFSET)
    this.camera.lookAt(0, 0, 0)

    this.buildStatic()
    this.scene.add(this.dynamic)
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    const el = this.renderer.domElement
    el.addEventListener('click', this.onClick)
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerleave', () => this.callbacks.onHover(null, 0, 0))
    this.loop()
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    this.renderer.domElement.removeEventListener('click', this.onClick)
    this.renderer.domElement.removeEventListener('pointermove', this.onMove)
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
        obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => {
          ;(m as THREE.MeshBasicMaterial).map?.dispose()
          m.dispose()
        })
      }
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  playIntro() {
    this.intro = { start: this.clock.getElapsedTime(), duration: 2.6 }
  }

  private resize() {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h)
    const aspect = w / h
    const viewH = Math.max(16, 26 / aspect)
    this.camera.left = (-viewH * aspect) / 2
    this.camera.right = (viewH * aspect) / 2
    this.camera.top = viewH / 2
    this.camera.bottom = -viewH / 2
    this.camera.updateProjectionMatrix()
  }

  private buildStatic() {
    const p = this.palette
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.5)
    sun.position.set(12, 20, 6)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    const sc = sun.shadow.camera
    sc.left = -16
    sc.right = 16
    sc.top = 16
    sc.bottom = -16
    this.scene.add(sun)

    const ground = mesh(new THREE.BoxGeometry(MAP_SIZE, 0.6, MAP_SIZE), p.ground)
    ground.position.y = -0.3
    this.scene.add(ground)

    // Gentle hills.
    const hills: [number, number, number][] = [
      [-10, -10, 2.4],
      [10, 10, 2],
      [-11, 2, 1.6],
      [2, -11, 1.8],
      [11, -1, 1.4],
    ]
    for (const [x, z, rad] of hills) {
      const hill = mesh(new THREE.SphereGeometry(rad, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), p.hill)
      hill.scale.y = 0.45
      hill.position.set(x, 0, z)
      this.scene.add(hill)
    }

    // A river crossing the map.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-13, 0.02, -2),
      new THREE.Vector3(-6, 0.02, 1.5),
      new THREE.Vector3(0, 0.02, -3.2),
      new THREE.Vector3(5, 0.02, 0.5),
      new THREE.Vector3(13, 0.02, -1),
    ])
    const pts = curve.getPoints(60)
    const shape: THREE.Vector3[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)]
      const b = pts[Math.min(pts.length - 1, i + 1)]
      const n = new THREE.Vector3(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar(0.55)
      shape.push(pts[i].clone().add(n), pts[i].clone().sub(n))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(shape)
    const idx: number[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const k = i * 2
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
    }
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const river = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: p.river, roughness: 0.4, side: THREE.DoubleSide }))
    river.receiveShadow = true
    this.scene.add(river)

    // Roads from HQ to every slot.
    for (let i = 1; i < SITE_SLOTS; i++) {
      const [x, z] = SLOT_POS[i]
      const len = Math.hypot(x, z)
      const road = mesh(new THREE.BoxGeometry(0.5, 0.05, len), p.road)
      road.castShadow = false
      road.position.set(x / 2, 0.03, z / 2)
      road.rotation.y = Math.atan2(x, z)
      this.scene.add(road)
    }

    // A few trees for texture.
    const rng = (n: number) => {
      const v = Math.sin(n * 91.7) * 43758.5453
      return v - Math.floor(v)
    }
    for (let i = 0; i < 40; i++) {
      const x = (rng(i) - 0.5) * (MAP_SIZE - 2)
      const z = (rng(i + 100) - 0.5) * (MAP_SIZE - 2)
      if (SLOT_POS.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 3)) continue
      const tree = mesh(new THREE.ConeGeometry(0.45, 1.2, 7), p.tree)
      tree.position.set(x, 0.6, z)
      this.scene.add(tree)
    }
  }

  update(s: GameState) {
    const reg = s.region
    if (!reg) return
    const sig = JSON.stringify([
      reg.sites.map((x) => [x.id, x.slot, x.techs, x.clients, Math.round(x.health / 10)]),
      reg.events.map((e) => [e.id, e.siteId]),
    ])
    if (sig === this.signature) return
    this.signature = sig
    this.rebuild(s)
  }

  private rebuild(s: GameState) {
    const reg = s.region!
    const p = this.palette
    this.dynamic.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
        obj.geometry.dispose()
        const m = obj.material as THREE.MeshBasicMaterial
        m.map?.dispose()
        m.dispose()
      }
    })
    this.dynamic.clear()
    this.markers = []
    const textColor = isDark() ? '#e6ebf2' : '#ffffff'

    for (let slot = 0; slot < SITE_SLOTS; slot++) {
      const [x, z] = SLOT_POS[slot]
      const site = reg.sites.find((st) => st.slot === slot)
      const g = new THREE.Group()
      g.position.set(x, 0, z)
      if (!site) {
        const pad = mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.08, 32), p.empty, { transparent: true, opacity: 0.5 })
        pad.position.y = 0.04
        g.add(pad)
        const plus = label('+ Open a site', textColor)
        plus.position.set(0, 1.1, 0)
        plus.scale.multiplyScalar(0.7)
        g.add(plus)
        g.traverse((o) => {
          o.userData.pick = { kind: 'slot', slot } satisfies MapPick
          o.userData.hover = 'Empty site slot: click to see options'
        })
        this.dynamic.add(g)
        continue
      }
      // Building size grows a little with the client book.
      const size = Math.min(2.4, 1.2 + site.clients / 60)
      const floors = Math.min(4, 1 + Math.floor(site.techs / 4))
      const body = mesh(new THREE.BoxGeometry(size, floors * 0.7, size), p.building)
      body.position.y = (floors * 0.7) / 2
      const roof = mesh(new THREE.BoxGeometry(size + 0.15, 0.18, size + 0.15), site.hq ? p.hq : p.roof)
      roof.position.y = floors * 0.7 + 0.09
      // Health ring on the ground.
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(size * 0.85, size * 0.85 + 0.28, 40, 1, 0, (Math.PI * 2 * Math.max(0.02, site.health)) / 100),
        new THREE.MeshBasicMaterial({ color: healthColor(site.health), side: THREE.DoubleSide }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.05
      const name = label(site.name, textColor)
      name.position.set(0, floors * 0.7 + 1.1, 0)
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(size, size, floors * 0.7 + 1, 12), new THREE.MeshBasicMaterial({ visible: false }))
      hit.position.y = (floors * 0.7) / 2
      g.add(body, roof, ring, name, hit)
      g.traverse((o) => {
        o.userData.pick = { kind: 'site', id: site.id } satisfies MapPick
        o.userData.hover = `${site.name}: ${site.techs} techs, ${site.clients} clients, ${Math.round(site.health)}% health`
      })
      this.dynamic.add(g)

      const ev = reg.events.find((e) => e.siteId === site.id)
      if (ev) {
        const m = new THREE.Group()
        const gem = mesh(new THREE.OctahedronGeometry(0.45), 0xe0a42e, { emissive: 0x6b4a10, roughness: 0.4 })
        const glow = new THREE.Mesh(
          new THREE.RingGeometry(0.55, 0.75, 24),
          new THREE.MeshBasicMaterial({ color: 0xe0a42e, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
        )
        glow.rotation.x = -Math.PI / 2
        glow.position.y = -0.6
        const hitM = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ visible: false }))
        m.add(gem, glow, hitM)
        m.position.set(x + size * 0.6, floors * 0.7 + 2.2, z + size * 0.6)
        m.traverse((o) => {
          o.userData.pick = { kind: 'event', id: ev.id } satisfies MapPick
          o.userData.hover = 'Event: click to handle it'
        })
        this.dynamic.add(m)
        this.markers.push(m)
      }
    }
  }

  private pickAt(clientX: number, clientY: number): THREE.Object3D | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.dynamic.children, true)
    const marker = hits.find((h) => h.object.userData.pick?.kind === 'event')
    if (marker) return marker.object
    return hits.find((h) => h.object.userData.pick)?.object ?? null
  }

  private onClick = (e: MouseEvent) => {
    const obj = this.pickAt(e.clientX, e.clientY)
    if (obj) this.callbacks.onPick(obj.userData.pick as MapPick)
  }

  private onMove = (e: PointerEvent) => {
    const obj = this.pickAt(e.clientX, e.clientY)
    this.renderer.domElement.style.cursor = obj ? 'pointer' : 'default'
    const rect = this.container.getBoundingClientRect()
    this.callbacks.onHover(obj ? (obj.userData.hover as string) : null, e.clientX - rect.left, e.clientY - rect.top)
  }

  private loop = () => {
    this.frame = requestAnimationFrame(this.loop)
    const t = this.clock.getElapsedTime()
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    for (const m of this.markers) {
      m.children[0].rotation.y = t * 1.5
      m.children[0].position.y = reduced ? 0 : Math.sin(t * 3) * 0.12
      const pulse = reduced ? 1 : 1 + Math.sin(t * 4) * 0.12
      m.children[1].scale.set(pulse, pulse, pulse)
    }
    // Intro: start zoomed in on HQ, then pull back to the whole region.
    if (this.intro) {
      const k = Math.min(1, (t - this.intro.start) / this.intro.duration)
      const ease = 1 - Math.pow(1 - k, 3)
      this.camera.zoom = 5 + (1 - 5) * ease
      this.camera.updateProjectionMatrix()
      if (k >= 1) {
        this.intro = null
        this.callbacks.onIntroDone()
      }
    }
    this.renderer.render(this.scene, this.camera)
  }
}
